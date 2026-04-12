import { NextResponse } from 'next/server';
import { createBorrowRecord, isBookAvailable } from '@/services/db';

export async function POST(request) {
  try {
    const body = await request.json();
    const { userId, userName, books, borrowerPhone, borrowDate, dueDate } = body;

    if (!books || !Array.isArray(books) || books.length === 0 || !userName) {
      return NextResponse.json(
        { error: 'Thiếu thông tin bắt buộc (Tên người mượn, Danh sách sách)' },
        { status: 400 }
      );
    }

    // Process each book
    const results = [];
    for (const bookInfo of books) {
      const { bookId, bookTitle } = bookInfo;
      
      // 1. Check if book is available
      const available = await isBookAvailable(bookId);
      if (!available) {
        continue; // Skip unavailable books in a multi-book request or handle error
      }

      // 2. Create the record
      await createBorrowRecord(
        userId || `guest_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`, 
        bookId, 
        userName, 
        bookTitle, 
        borrowDate, 
        dueDate,
        true, // autoDecrement for offline
        borrowerPhone
      );
      results.push(bookTitle);
    }

    if (results.length === 0) {
      return NextResponse.json({ error: 'Không có sách nào khả dụng để mượn.' }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: `Tạo phiếu mượn thành công cho ${results.length} cuốn sách.`
    });
  } catch (error) {
    console.error('Error in borrow-records API:', error);
    return NextResponse.json(
      { error: 'Lỗi hệ thống khi xử lý phiếu mượn' },
      { status: 500 }
    );
  }
}
