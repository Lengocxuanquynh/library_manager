import { NextResponse } from 'next/server';
import admin, { adminDb } from '@/lib/firebase-admin';
import { createNotification } from '@/services/db';

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

    // Lấy record từ DB (Sử dụng Admin SDK)
    const recordRef = adminDb.collection("borrowRecords").doc(mainId);
    const recordSnap = await recordRef.get();
    
    if (!recordSnap.exists) {
      return NextResponse.json(
        { error: 'Không tìm thấy phiếu mượn' },
        { status: 404 }
      );
    }

    const data = recordSnap.data();
    const currentBooks = data.books || [];
    const batch = adminDb.batch();
    const now = new Date();
    const nowISO = now.toISOString();
    const FieldValue = admin.firestore.FieldValue;
    
    // Xử lý dueDate (tương thích nhiều định dạng)
    let dueDate = null;
    if (data.dueDate?.toDate) dueDate = data.dueDate.toDate();
    else if (data.dueDate?._seconds) dueDate = new Date(data.dueDate._seconds * 1000);
    else if (data.dueDate) dueDate = new Date(data.dueDate);

    let anyViolation = false;
    let lateFeeToAssign = Number(recordLateFee) || 0;
    let allProcessedAsReturned = true;
    let lateFeeAssigned = false;

    // Duyệt danh sách sách trong phiếu
    const updatedBooks = currentBooks.map(b => {
      const itemConfig = returnItems.find(item => item.uid === b.uid);
      
      let finalBookStatus = b.status;
      let currentItemLateFee = 0;
      let currentItemDamageFee = Number(b.damageFee) || 0;
      let currentReturnNote = b.returnNote || '';

      if (itemConfig && !['RETURNED', 'RETURNED_OVERDUE', 'LOST', 'DAMAGED'].includes(b.status)) {
        const isNowOverdue = b.status === 'OVERDUE' || (dueDate && now > dueDate);
        const { isLost, isDamaged, damageFee, returnNote } = itemConfig;
        
        if (!lateFeeAssigned && lateFeeToAssign > 0) {
           currentItemLateFee = lateFeeToAssign;
           lateFeeAssigned = true;
        }

        finalBookStatus = isLost ? 'LOST' : isDamaged ? 'DAMAGED' : (isNowOverdue ? 'RETURNED_OVERDUE' : 'RETURNED');
        if (isLost || isDamaged || isNowOverdue || currentItemLateFee > 0) anyViolation = true;

        const bookRef = adminDb.collection("books").doc(b.bookId);
        if (!isLost && !isDamaged) {
          batch.update(bookRef, { quantity: FieldValue.increment(1) });
        } else {
          if (isDamaged) {
            batch.update(bookRef, { damagedCount: FieldValue.increment(1) });
          } else if (isLost) {
            batch.update(bookRef, { lostCount: FieldValue.increment(1) });
          }
        }

        currentItemDamageFee = Number(damageFee) || 0;
        currentReturnNote = returnNote || 'Thu hồi hàng loạt';

        const updatedBook = {
          ...b,
          status: finalBookStatus,
          actualReturnDate: nowISO,
          returnNote: currentReturnNote,
          lateFee: currentItemLateFee,
          damageFee: currentItemDamageFee,
          penaltyAmount: currentItemLateFee + currentItemDamageFee
        };

        if (!['RETURNED', 'RETURNED_OVERDUE', 'LOST', 'DAMAGED'].includes(finalBookStatus)) {
          allProcessedAsReturned = false;
        }
        return updatedBook;
      }
      
      const isAlreadyReturned = ['RETURNED', 'RETURNED_OVERDUE', 'LOST', 'DAMAGED'].includes(b.status);
      if (!isAlreadyReturned) {
        allProcessedAsReturned = false;
      }
      return b;
    });

    batch.update(recordRef, {
      books: updatedBooks,
      status: allProcessedAsReturned ? 'RETURNED' : 'PARTIALLY_RETURNED'
    });

    if (anyViolation && data.userId) {
      const userRef = adminDb.collection("users").doc(data.userId);
      batch.update(userRef, { lastOverdueAt: FieldValue.serverTimestamp() });

      for (const b of updatedBooks) {
        if (b.actualReturnDate === nowISO) {
          const msgBase = `Cuốn sách "${b.bookTitle}" `;
          if (b.status === 'RETURNED_OVERDUE' || b.lateFee > 0) {
            await createNotification(data.userId, "⚠️ Tạm khóa gia hạn", msgBase + "bị trả trễ hạn.", "warning");
          }
          if (b.status === 'DAMAGED' || b.damageFee > 0) {
            await createNotification(data.userId, "⚠️ Tạm khóa gia hạn", msgBase + "bị hư hỏng khi trả.", "warning");
          }
          if (b.status === 'LOST') {
            await createNotification(data.userId, "❌ Ghi nhận mất sách", msgBase + "được báo mất.", "error");
          }
        }
      }
    }

    await batch.commit();

    return NextResponse.json({
      success: true,
      message: 'Thu hồi hàng loạt thành công'
    }, { status: 200 });

  } catch (error) {
    console.error('>>> [ERROR] bulk return-all failed:', error);
    return NextResponse.json(
      { error: 'Lỗi server khi thu hồi hàng loạt: ' + error.message },
      { status: 500 }
    );
  }
}
