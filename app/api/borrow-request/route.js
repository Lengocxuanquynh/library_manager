import { NextResponse } from 'next/server';
import { createBorrowRequest, canUserBorrow, isBookAvailable } from '@/services/db';

export async function POST(request) {
  try {
    const body = await request.json();
    const { userId, bookId, userName, bookTitle, isAdmin } = body;

    if (!userId || !bookId) {
      return NextResponse.json({ error: 'Thiếu userId hoặc bookId' }, { status: 400 });
    }

    // 1. Check book availability (quantity > 0)
    const available = await isBookAvailable(bookId);
    if (!available) {
      return NextResponse.json({ error: 'Sách đã hết số lượng để mượn.' }, { status: 400 });
    }

    // 2. Check user overdue books
    const userStatus = await canUserBorrow(userId, isAdmin);
    if (!userStatus.canBorrow) {
      return NextResponse.json({ error: userStatus.reason }, { status: 400 });
    }

    // 3. Create request
    const docRef = await createBorrowRequest(userId, bookId, userName || 'Ẩn danh', bookTitle || 'Không rõ');

    return NextResponse.json({
      success: true,
      message: 'Yêu cầu mượn sách đã được gửi, vui lòng chờ admin duyệt.',
      id: docRef.id
    });
  } catch (error) {
    console.error('Error in borrow-request API:', error);
    return NextResponse.json({ error: 'Lỗi hệ thống khi gửi yêu cầu.' }, { status: 500 });
  }
}
