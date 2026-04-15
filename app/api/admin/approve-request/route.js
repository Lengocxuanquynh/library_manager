import { NextResponse } from 'next/server';
import { doc, collection, addDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../../lib/firebase';
import { updateBorrowRequestStatus } from '../../../../services/db';
import { verifyAdmin } from '../../../../services/admin-check';

export async function POST(request) {
  try {
    const body = await request.json();
    const { requestId, userId, userName, books, bookId, bookTitle, adminId } = body;

    if (!requestId || !userId || !adminId) {
      return NextResponse.json({ error: 'Thiếu thông tin yêu cầu hoặc quyền hạn' }, { status: 400 });
    }

    // Security check
    const isAdmin = await verifyAdmin(adminId);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Bạn không có quyền thực hiện hành động này' }, { status: 403 });
    }

    // Chuẩn bị pickupDeadline = hiện tại + 24 giờ
    const approvedAt = new Date();
    const pickupDeadline = new Date(approvedAt.getTime() + 24 * 60 * 60 * 1000);

    const hasBooksArray = Array.isArray(books) && books.length > 0;
    const hasSingleBook = bookId && bookTitle;

    if (!hasBooksArray && !hasSingleBook) {
      console.error('[approve-request] Dữ liệu thiếu sách:', body);
      return NextResponse.json({ error: 'Không tìm thấy thông tin sách để duyệt. Kiểm tra lại cấu trúc phiếu.' }, { status: 400 });
    }

    // Cập nhật trạng thái phiếu yêu cầu -> APPROVED
    await updateBorrowRequestStatus(requestId, 'APPROVED');

    if (hasBooksArray) {
      // ── Phiếu batch từ giỏ hàng: tạo 1 borrowRecord mỗi cuốn sách ──
      for (const b of books) {
        if (!b.bookId || !b.bookTitle) {
          console.warn('[approve-request] Mục sách thiếu bookId/bookTitle, bỏ qua:', b);
          continue;
        }
        await addDoc(collection(db, 'borrowRecords'), {
          userId,
          userName,
          bookId: b.bookId,
          bookTitle: b.bookTitle,
          borrowerPhone: '',
          borrowDate: null,
          dueDate: null,
          returnDate: null,
          status: 'APPROVED_PENDING_PICKUP',
          approvedAt: serverTimestamp(),
          pickupDeadline,
        });
      }
    } else {
      // ── Phiếu đơn (cũ): 1 cuốn sách ──
      await addDoc(collection(db, 'borrowRecords'), {
        userId,
        userName,
        bookId,
        bookTitle,
        borrowerPhone: '',
        borrowDate: null,
        dueDate: null,
        returnDate: null,
        status: 'APPROVED_PENDING_PICKUP',
        approvedAt: serverTimestamp(),
        pickupDeadline,
      });
    }

    const count = hasBooksArray ? books.length : 1;
    return NextResponse.json({
      success: true,
      message: `Đã duyệt ${count} sách. Độc giả có 24h để lấy sách.`,
    });
  } catch (error) {
    console.error('[approve-request] Lỗi hệ thống:', error);
    return NextResponse.json({ error: 'Lỗi hệ thống khi duyệt yêu cầu.' }, { status: 500 });
  }
}
