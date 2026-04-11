import { NextResponse } from 'next/server';
import { createBorrowRecord, isBookAvailable, canUserBorrow } from '@/services/db';

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

    // 2. Check if user can borrow (only if userId is provided)
    if (userId) {
      const eligibility = await canUserBorrow(userId);
      if (!eligibility.canBorrow) {
        return NextResponse.json(
          { error: eligibility.reason },
          { status: 400 }
        );
      }
    }

    // 3. Create the record — use "offline" as fallback userId for walk-ins
    await createBorrowRecord(userId || `offline_${Date.now()}`, bookId, userName, bookTitle, borrowDate, dueDate);

    return NextResponse.json({
      success: true,
      message: 'Tạo phiếu mượn offline thành công'
    });
  } catch (error) {
    console.error('Error in offline-borrow API:', error);
    return NextResponse.json(
      { error: 'Lỗi hệ thống khi xử lý phiếu mượn' },
      { status: 500 }
    );
  }
}
