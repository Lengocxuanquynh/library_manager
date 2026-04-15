import { NextResponse } from 'next/server';
import { confirmBorrowPickup } from '../../../services/db';
import { verifyAdmin } from '../../../services/admin-check';

export async function POST(request) {
  try {
    const body = await request.json();
    const { recordId, bookId, adminId } = body;

    if (!recordId || !bookId || !adminId) {
      return NextResponse.json({ error: 'Thiếu thông tin yêu cầu' }, { status: 400 });
    }

    const isAdmin = await verifyAdmin(adminId);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Bạn không có quyền thực hiện hành động này' }, { status: 403 });
    }

    await confirmBorrowPickup(recordId, bookId);

    return NextResponse.json({
      success: true,
      message: 'Đã xác nhận lấy sách và cập nhật kho.'
    });
  } catch (error) {
    console.error('Error in confirm-pickup API:', error);
    return NextResponse.json({ error: 'Lỗi hệ thống khi xác nhận lấy sách.' }, { status: 500 });
  }
}
