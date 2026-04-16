import { NextResponse } from 'next/server';
import { doc, collection, addDoc, updateDoc, serverTimestamp, increment } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { updateBorrowRequestStatus, createBorrowRecord } from '@/services/db';
import { verifyAdmin } from '@/services/admin-check';

export async function POST(request) {
  try {
    const body = await request.json();
    const { requestId, userId, userName, books, bookId, bookTitle, adminId } = body;

    if (!requestId || !userId || !adminId) {
      return NextResponse.json({ message: 'Thiếu thông tin yêu cầu hoặc quyền hạn' }, { status: 400 });
    }

    // Security check
    const isAdmin = await verifyAdmin(adminId);
    if (!isAdmin) {
      return NextResponse.json({ message: 'Bạn không có quyền thực hiện hành động này' }, { status: 403 });
    }

    // Chuẩn bị pickupDeadline = hiện tại + 24 giờ
    const approvedAt = new Date();
    const pickupDeadline = new Date(approvedAt.getTime() + 24 * 60 * 60 * 1000);

    const hasBooksArray = Array.isArray(books) && books.length > 0;
    const hasSingleBook = bookId && bookTitle;

    if (!hasBooksArray && !hasSingleBook) {
      console.error('[approve-request] Dữ liệu thiếu sách:', body);
      return NextResponse.json({ message: 'Không tìm thấy thông tin sách để duyệt. Kiểm tra lại cấu trúc phiếu.' }, { status: 400 });
    }

    // Cập nhật trạng thái phiếu yêu cầu -> APPROVED
    await updateBorrowRequestStatus(requestId, 'APPROVED');

    // Tạo 1 phiếu mượn duy nhất chứa toàn bộ sách
    const finalBooks = hasBooksArray ? books : [{ bookId, bookTitle }];
    
    // Dự trữ sách (Reservation model): giảm tồn kho ngay lập tức
    for (const b of finalBooks) {
      if (b.bookId) {
        const bookRef = doc(db, 'books', b.bookId);
        await updateDoc(bookRef, { 
          quantity: increment(-1)
        });
      }
    }

    await createBorrowRecord(
      userId,
      userName,
      finalBooks.map(b => ({
        bookId: b.bookId,
        bookTitle: b.bookTitle
      })),
      null, // use current date
      null, // use default 14 days
      false, // already decremented above manually (to keep control)
      "" // phone can be added later
    );

    // Update the record with approval metadata
    // Wait, createBorrowRecord returns the doc ref.
    // However, createBorrowRecord in db.js already sets initial status.
    // Let's refine the record after creation to add approval info if needed,
    // or just let createBorrowRecord handle it.
    // Actually, createBorrowRecord now sets status: 'BORROWING' by default if autoDecrement is true.
    // But here we want 'APPROVED_PENDING_PICKUP'.
    
    // Let's fix createBorrowRecord call to use autoDecrement=false to get 'APPROVED_PENDING_PICKUP'
    // but we already decremented quantity above. Correct.

    const count = hasBooksArray ? books.length : 1;
    return NextResponse.json({
      success: true,
      message: `Đã duyệt ${count} sách. Độc giả có 24h để lấy sách.`,
    });
  } catch (error) {
    console.error('[approve-request] Lỗi hệ thống:', error);
    return NextResponse.json({ message: 'Lỗi hệ thống khi duyệt yêu cầu.' }, { status: 500 });
  }
}
