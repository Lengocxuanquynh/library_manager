import { NextResponse } from 'next/server';
import { db } from '../../../../lib/firebase';
import { doc, getDoc, writeBatch, increment } from 'firebase/firestore';

export async function POST(request) {
  try {
    const body = await request.json();
    const { recordId, transactionId, books, adminId } = body;

    const mainId = transactionId || recordId;

    if (!mainId && (!books || books.length === 0)) {
       return NextResponse.json(
        { error: 'Thiếu transactionId hoặc sách để thu hồi' },
        { status: 400 }
      );
    }

    if (!Array.isArray(books) || books.length === 0) {
      return NextResponse.json(
        { error: 'Không tìm thấy danh sách sách cần trả hợp lệ' },
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

    // Mảng lưu ID sách yêu cầu trả
    const returnBookIds = books.map(b => b.bookId || b.id);

    // Xử lý trạng thái mới cho mảng sách trong Phiếu
    let allReturned = true;
    const updatedBooks = currentBooks.map(b => {
      if (returnBookIds.includes(b.bookId) && b.status !== 'RETURNED' && b.status !== 'RETURNED_OVERDUE') {
        const finalStatus = (dueDate && now > dueDate) ? 'RETURNED_OVERDUE' : 'RETURNED';
        
        // Cộng kho cho cuốn sách này
        const bookRef = doc(db, "books", b.bookId);
        batch.update(bookRef, { quantity: increment(1) });
        
        return {
          ...b,
          status: finalStatus,
          actualReturnDate: now,
          returnNote: body.returnNote || 'Thu hồi hàng loạt',
          penaltyAmount: Number(body.penaltyAmount) || 0
        };
      }
      
      if (b.status === 'BORROWING' || b.status === 'APPROVED_PENDING_PICKUP') {
        allReturned = false;
      }
      return b;
    });

    // Cập nhật lại Phiếu mượn
    batch.update(recordRef, {
      books: updatedBooks,
      status: allReturned ? 'RETURNED' : 'PARTIALLY_RETURNED'
    });

    // Thực thi toàn bộ lệnh cập nhật
    await batch.commit();

    return NextResponse.json({
      success: true,
      message: 'Thu hồi toàn bộ sách thành công'
    }, { status: 200 });

  } catch (error) {
    console.error('Error processing return-all API:', error);
    return NextResponse.json(
      { error: 'Lỗi server khi thu hồi hàng loạt' },
      { status: 500 }
    );
  }
}
