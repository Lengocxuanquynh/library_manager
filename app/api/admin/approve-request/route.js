import { NextResponse } from 'next/server';
import { approveBorrowRequest } from '@/services/db';
import { verifyAdmin } from '@/services/admin-check';

export async function POST(request) {
  try {
    const body = await request.json();
    const { requestId, userId, bookId, userName, bookTitle, adminId } = body;

    if (!requestId || !userId || !bookId || !adminId) {
      return NextResponse.json({ error: 'Thiếu thông tin yêu cầu hoặc quyền hạn' }, { status: 400 });
    }

    // Security check
    const isAdmin = await verifyAdmin(adminId);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Bạn không có quyền thực hiện hành động này' }, { status: 403 });
    }

    await approveBorrowRequest(requestId, userId, bookId, userName, bookTitle);

    return NextResponse.json({
      success: true,
      message: 'Đã duyệt yêu cầu mượn sách.'
    });
  } catch (error) {
    console.error('Error in approve-request API:', error);
    return NextResponse.json({ error: 'Lỗi hệ thống khi duyệt yêu cầu.' }, { status: 500 });
  }
}
