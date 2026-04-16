import { NextResponse } from 'next/server';
import { rejectBorrowRequest } from '../../../../services/db';
import { verifyAdmin } from '../../../../services/admin-check';

export async function POST(request) {
  try {
    const body = await request.json();
    const { requestId, adminId } = body;

    if (!requestId || !adminId) {
      return NextResponse.json({ message: 'Thiếu requestId hoặc adminId' }, { status: 400 });
    }

    // Security check
    const isAdmin = await verifyAdmin(adminId);
    if (!isAdmin) {
      return NextResponse.json({ message: 'Bạn không có quyền thực hiện hành động này' }, { status: 403 });
    }

    await rejectBorrowRequest(requestId);

    return NextResponse.json({
      success: true,
      message: 'Đã từ chối yêu cầu mượn sách.'
    });
  } catch (error) {
    console.error('Error in reject-request API:', error);
    return NextResponse.json({ message: 'Lỗi hệ thống khi từ chối yêu cầu.' }, { status: 500 });
  }
}
