import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

export async function POST(req) {
  try {
    const { recordId, bookUid, bookId, actionType } = await req.json();

    if (!recordId || !bookUid || !bookId) {
      return NextResponse.json({ success: false, error: "Thiếu thông tin yêu cầu" }, { status: 400 });
    }

    const recordRef = adminDb.collection("borrowRecords").doc(recordId);
    const bookRef = adminDb.collection("books").doc(bookId);

    await adminDb.runTransaction(async (transaction) => {
      // 1. Lấy dữ liệu phiếu mượn
      const recordDoc = await transaction.get(recordRef);
      if (!recordDoc.exists) {
        throw new Error("Không tìm thấy phiếu mượn");
      }

      const recordData = recordDoc.data();
      const updatedBooks = (recordData.books || []).map(b => {
        if (b.uid === bookUid) {
          return {
            ...b,
            isResolved: true,
            resolvedAt: new Date(),
            resolutionType: actionType || 'RENEWED'
          };
        }
        return b;
      });

      // 2. Lấy dữ liệu sách trong kho
      const bookDoc = await transaction.get(bookRef);
      if (!bookDoc.exists) {
        throw new Error("Không tìm thấy đầu sách trong kho");
      }

      const bookData = bookDoc.data();
      const currentQuantity = bookData.quantity || 0;
      const currentDamaged = bookData.damagedCount || 0;
      const currentLost = bookData.lostCount || 0;

      // Find the specific book in the record to know its status
      const targetBookInRecord = (recordData.books || []).find(b => b.uid === bookUid);
      const isDamaged = targetBookInRecord?.status === 'Damaged';
      const isLost = targetBookInRecord?.status === 'Lost';

      // 3. Thực hiện cập nhật
      transaction.update(recordRef, { books: updatedBooks });
      
      const bookUpdates = { quantity: currentQuantity + 1 };
      if (isDamaged && currentDamaged > 0) bookUpdates.damagedCount = currentDamaged - 1;
      if (isLost && currentLost > 0) bookUpdates.lostCount = currentLost - 1;
      
      transaction.update(bookRef, bookUpdates);
    });

    console.log(`>>> [SERVER] Restored book ${bookId} (UID: ${bookUid}) from record ${recordId}`);

    return NextResponse.json({ 
      success: true, 
      message: actionType === 'RESTOCKED' ? "Đã bổ sung sách vào kho thành công" : "Đã đổi mới và thêm sách vào kho thành công" 
    });

  } catch (error) {
    console.error(">>> [ERROR] Restore book failed:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
