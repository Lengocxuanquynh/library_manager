import { NextResponse } from 'next/server';
import { returnBorrowRecord, getBorrowRecord } from '@/services/db';
import { verifyAdmin } from '@/services/admin-check';

export async function POST(request) {
  try {
    const body = await request.json();
    const { recordId, bookId, adminId, userId } = body;

    if (!recordId || !bookId) {
      return NextResponse.json({ error: 'Thiếu thông tin yêu cầu' }, { status: 400 });
    }

    let authorized = false;

    // 1. Check Admin
    if (adminId) {
      authorized = await verifyAdmin(adminId);
    }

    // 2. Check Owner (User)
    if (!authorized && userId) {
      const record = await getBorrowRecord(recordId);
      if (record && record.userId === userId) {
        authorized = true;
      }
    }

    if (!authorized) {
      return NextResponse.json({ error: 'Bạn không có quyền thực hiện thao tác này' }, { status: 403 });
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
