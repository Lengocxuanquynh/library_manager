import { NextResponse } from 'next/server';
import { returnBorrowRecord } from '@/services/db';
import { verifyAdmin } from '@/services/admin-check';

export async function POST(request) {
  try {
    const body = await request.json();
    const { recordId, bookId, adminId } = body;

    if (!recordId || !bookId || !adminId) {
      return NextResponse.json({ error: 'Thiếu thông tin yêu cầu hoặc adminId' }, { status: 400 });
    }

    // Security check
    const isAdmin = await verifyAdmin(adminId);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    await returnBorrowRecord(recordId, bookId);

    return NextResponse.json({
      success: true,
      message: 'Đã trả sách thành công.'
    });
  } catch (error) {
    console.error('Error in return-book API:', error);
    return NextResponse.json({ error: 'Lỗi hệ thống khi trả sách.' }, { status: 500 });
  }
}
