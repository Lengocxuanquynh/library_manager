import { NextResponse } from 'next/server';
import { confirmBorrowPickup } from '@/services/db';
import { verifyAdmin } from '@/services/admin-check';

export async function POST(request) {
  try {
    const body = await request.json();
    const { recordId, adminId, manualCopyIds } = body;

    if (!recordId || !adminId) {
      return NextResponse.json({ message: 'Thiếu thông tin yêu cầu' }, { status: 400 });
    }

    const isAdmin = await verifyAdmin(adminId);
    if (!isAdmin) {
      return NextResponse.json({ message: 'Bạn không có quyền thực hiện hành động này' }, { status: 403 });
    }

    await confirmBorrowPickup(recordId, manualCopyIds || {});

    return NextResponse.json({
      success: true,
      message: 'Đã xác nhận lấy sách và cập nhật kho.'
    });
  } catch (error) {
    console.error('Error in confirm-pickup API:', error);
    return NextResponse.json({ message: error.message || 'Lỗi hệ thống khi xác nhận lấy sách.' }, { status: 500 });
  }
}
