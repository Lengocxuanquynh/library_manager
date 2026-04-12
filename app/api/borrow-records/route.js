import { NextResponse } from 'next/server';
import { createBorrowRecord, isBookAvailable } from '@/services/db';

export async function POST(request) {
  try {
    const body = await request.json();
    const { userId, bookId, userName, bookTitle, borrowDate, dueDate } = body;

    if (!bookId || !userName || !bookTitle) {
      return NextResponse.json(
        { error: 'Thiếu thông tin bắt buộc (Tên người mượn, Sách)' },
        { status: 400 }
      );
    }

    // 1. Check if book is available
    const available = await isBookAvailable(bookId);
    if (!available) {
      return NextResponse.json(
        { error: 'Sách hiện không khả dụng hoặc đã hết trong kho.' },
        { status: 400 }
      );
    }

    // 2. Create the record
    await createBorrowRecord(
      userId || `guest_${Date.now()}`, 
      bookId, 
      userName, 
      bookTitle, 
      borrowDate, 
      dueDate
    );

    return NextResponse.json({
      success: true,
      message: 'Tạo phiếu mượn thành công'
    });
  } catch (error) {
    console.error('Error in borrow-records API:', error);
    return NextResponse.json(
      { error: 'Lỗi hệ thống khi xử lý phiếu mượn' },
      { status: 500 }
    );
  }
}
