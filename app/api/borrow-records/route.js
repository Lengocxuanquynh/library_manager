import { NextResponse } from 'next/server';
import { createBorrowRecord, isBookAvailable } from '../../../services/db';

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
    // 1. Check if all books are available
    for (const b of books) {
      if (!b.bookId) continue;
      const available = await isBookAvailable(b.bookId);
      if (!available) {
        return NextResponse.json({ error: `Sách "${b.bookTitle}" hiện không khả dụng.` }, { status: 400 });
      }
    }

    const finalUserId = userId || `guest_${Date.now()}`;

    // 2. Create a single grouped record
    const result = await createBorrowRecord(
      finalUserId,
      userName,
      books.map(b => ({ bookId: b.bookId, bookTitle: b.bookTitle })),
      borrowDate, 
      dueDate,
      true, // autoDecrement for offline
      borrowerPhone
    );

    return NextResponse.json({
      success: true,
      message: `Tạo phiếu mượn thành công cho ${books.length} cuốn sách.`,
      recordId: result.id
    });
  } catch (error) {
    console.error('Error in borrow-records API:', error);
    return NextResponse.json(
      { error: 'Lỗi hệ thống khi xử lý phiếu mượn' },
      { status: 500 }
    );
  }
}
