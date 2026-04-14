import { NextResponse } from 'next/server';
import { approveBorrowRequest, updateBorrowRequestStatus, createBorrowRecord } from '@/services/db';
import { verifyAdmin } from '@/services/admin-check';

export async function POST(request) {
  try {
    const body = await request.json();
    const { requestId, userId, bookId, userName, bookTitle, books, adminId } = body;

    if (!requestId || !userId || !adminId) {
      return NextResponse.json({ error: 'Thiếu thông tin yêu cầu hoặc quyền hạn' }, { status: 400 });
    }

    // Security check
    const isAdmin = await verifyAdmin(adminId);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Bạn không có quyền thực hiện hành động này' }, { status: 403 });
    }

    // Handle batch or single request
    if (books && Array.isArray(books) && books.length > 0) {
      await updateBorrowRequestStatus(requestId, 'APPROVED');
      for (const b of books) {
        await createBorrowRecord(userId, b.bookId, userName, b.bookTitle, null, null, false);
      }
    } else if (bookId && bookTitle) {
      await approveBorrowRequest(requestId, userId, bookId, userName, bookTitle);
    } else {
      return NextResponse.json({ error: 'Không tìm thấy thông tin sách để duyệt' }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: 'Đã duyệt yêu cầu mượn sách.'
    });
  } catch (error) {
    console.error('Error in approve-request API:', error);
    return NextResponse.json({ error: 'Lỗi hệ thống khi duyệt yêu cầu.' }, { status: 500 });
  }
}
