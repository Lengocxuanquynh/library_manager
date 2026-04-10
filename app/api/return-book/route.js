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

    // Allow if admin OR if the user owns this borrow record
    if (adminId) {
      const isAdmin = await verifyAdmin(adminId);
      if (!isAdmin) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
      }
    } else if (userId) {
      // Verify user owns this record
      const record = await getBorrowRecord(recordId);
      if (!record || record.userId !== userId) {
        return NextResponse.json({ error: 'Bạn không có quyền trả sách này' }, { status: 403 });
      }
    } else {
      return NextResponse.json({ error: 'Thiếu thông tin xác thực' }, { status: 401 });
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
