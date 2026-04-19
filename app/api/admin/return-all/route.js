import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc, writeBatch, increment } from 'firebase/firestore';

export async function POST(request) {
  try {
    const body = await request.json();
    const { recordId, transactionId, returnItems, recordLateFee, adminId } = body;

    const mainId = transactionId || recordId;

    if (!mainId || !Array.isArray(returnItems) || returnItems.length === 0) {
       return NextResponse.json(
        { error: 'Thiếu thông tin phiếu mượn hoặc danh sách sách trả chi tiết' },
        { status: 400 }
      );
    }

    // Lấy record từ DB
    const recordRef = doc(db, "borrowRecords", mainId);
    const recordSnap = await getDoc(recordRef);
    
    if (!recordSnap.exists()) {
      return NextResponse.json(
        { error: 'Không tìm thấy phiếu mượn' },
        { status: 404 }
      );
    }

    const data = recordSnap.data();
    const currentBooks = data.books || [];
    const batch = writeBatch(db);
    const now = new Date();
    const dueDate = data.dueDate?.toDate ? data.dueDate.toDate() : (data.dueDate ? new Date(data.dueDate) : null);

    let anyViolation = false;
    let lateFeeToAssign = Number(recordLateFee) || 0;
    let allProcessedAsReturned = true;
    let lateFeeAssigned = false;
    // Duyệt danh sách sách trong phiếu
    const updatedBooks = currentBooks.map(b => {
      // Tìm cấu hình trả cho cuốn sách này
      const itemConfig = returnItems.find(item => item.uid === b.uid);
      
      let finalBookStatus = b.status;
      let currentItemLateFee = 0;
      let currentItemDamageFee = Number(b.damageFee) || 0;
      let currentReturnNote = b.returnNote || '';

      // Nếu có cấu hình trả và sách chưa được trả trước đó
      if (itemConfig && !['RETURNED', 'RETURNED_OVERDUE', 'LOST', 'DAMAGED'].includes(b.status)) {
        const isNowOverdue = b.status === 'OVERDUE' || (dueDate && now > dueDate);
        const { isLost, isDamaged, damageFee, returnNote } = itemConfig;
        
        // Gán phí trễ hạn của đơn cho cuốn sách đầu tiên tìm thấy
        if (!lateFeeAssigned && lateFeeToAssign > 0) {
           currentItemLateFee = lateFeeToAssign;
           lateFeeAssigned = true;
        }

        finalBookStatus = isLost ? 'LOST' : isDamaged ? 'DAMAGED' : (isNowOverdue ? 'RETURNED_OVERDUE' : 'RETURNED');
        if (isLost || isDamaged || isNowOverdue || currentItemLateFee > 0) anyViolation = true;

        // Cập nhật kho nếu KHÔNG mất và KHÔNG hỏng nặng
        if (!isLost && !isDamaged) {
          const bookRef = doc(db, "books", b.bookId);
          batch.update(bookRef, { quantity: increment(1) });
        } else if (isDamaged) {
          // Nếu hỏng nặng thì tăng trường damagedCount để làm thống kê
          const bookRef = doc(db, "books", b.bookId);
          batch.update(bookRef, { damagedCount: increment(1) });
        }

        currentItemDamageFee = Number(damageFee) || 0;
        currentReturnNote = returnNote || 'Thu hồi hàng loạt';

        // Cập nhật thông tin sách
        const updatedBook = {
          ...b,
          status: finalBookStatus,
          actualReturnDate: now,
          returnNote: currentReturnNote,
          lateFee: currentItemLateFee,
          damageFee: currentItemDamageFee,
          penaltyAmount: currentItemLateFee + currentItemDamageFee
        };

        // Kiểm tra xem sau khi cập nhật cuốn này có coi là đã xong chưa
        if (!['RETURNED', 'RETURNED_OVERDUE', 'LOST', 'DAMAGED'].includes(finalBookStatus)) {
          allProcessedAsReturned = false;
        }

        return updatedBook;
      }
      
      // Nếu không có cấu hình trả mới, kiểm tra trạng thái hiện tại của sách
      const isAlreadyReturned = ['RETURNED', 'RETURNED_OVERDUE', 'LOST', 'DAMAGED'].includes(b.status);
      if (!isAlreadyReturned) {
        allProcessedAsReturned = false;
      }

      return b;
    });

    // Cập nhật lại Phiếu mượn
    batch.update(recordRef, {
      books: updatedBooks,
      status: allProcessedAsReturned ? 'RETURNED' : 'PARTIALLY_RETURNED'
    });

    // Cập nhật vi phạm cho User nếu có
    if (anyViolation && data.userId) {
      const userRef = doc(db, "users", data.userId);
      batch.update(userRef, { lastOverdueAt: now });
    }

    // Thực thi toàn bộ lệnh cập nhật
    await batch.commit();

    return NextResponse.json({
      success: true,
      message: 'Thu hồi hàng loạt thành công'
    }, { status: 200 });

  } catch (error) {
    console.error('Error processing return-all API:', error);
    return NextResponse.json(
      { error: 'Lỗi server khi thu hồi hàng loạt' },
      { status: 500 }
    );
  }
}
