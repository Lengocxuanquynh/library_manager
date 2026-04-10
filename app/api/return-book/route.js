import { NextResponse } from 'next/server';
import { returnBorrowRecord } from '@/services/db';

export async function POST(request) {
  try {
    const body = await request.json();
    const { recordId, bookId } = body;

    if (!recordId || !bookId) {
      return NextResponse.json({ error: 'Thiếu recordId hoặc bookId' }, { status: 400 });
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
