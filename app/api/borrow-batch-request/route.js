import { NextResponse } from 'next/server';
import { db } from '../../../lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { canUserBorrow, isBookAvailable } from '../../../services/db';

export async function POST(request) {
  try {
    const body = await request.json();
    const { userId, userName, email, phone, cccd, books, paymentStatus } = body;

    if (!userId || !books || !Array.isArray(books) || books.length === 0) {
      return NextResponse.json({ error: 'Thiếu người dùng hoặc sách trong giỏ hàng' }, { status: 400 });
    }

    if (books.length > 3) {
      return NextResponse.json({ error: 'Bạn chỉ được mượn tối đa 3 cuốn sách' }, { status: 400 });
    }

    if (!phone || !cccd || !email) {
      return NextResponse.json({ error: 'Vui lòng cung cấp đủ SĐT, CCCD và Email' }, { status: 400 });
    }

    // 1. Check book availability
    for (const b of books) {
      const available = await isBookAvailable(b.bookId);
      if (!available) {
        return NextResponse.json({ error: `Sách "${b.bookTitle}" đã hết.` }, { status: 400 });
      }
    }

    // 2. Check user overdue/pending books limits
    const userStatus = await canUserBorrow(userId);
    if (!userStatus.canBorrow) {
      return NextResponse.json({ error: userStatus.reason }, { status: 400 });
    }

    // Create a unified borrow request
    const docRef = await addDoc(collection(db, "borrowRequests"), {
      userId,
      userName: userName || 'Ẩn danh',
      userEmail: email,
      userPhone: phone,
      userCCCD: cccd,
      books, // Array of { bookId, bookTitle }
      paymentStatus: paymentStatus || 'UNPAID',
      status: 'PENDING',
      createdAt: serverTimestamp()
    });

    return NextResponse.json({
      success: true,
      message: 'Yêu cầu mượn giỏ sách đã được gửi, vui lòng chờ admin duyệt.',
      id: docRef.id
    });
  } catch (error) {
    console.error('Error in borrow-batch-request API:', error);
    return NextResponse.json({ error: 'Lỗi hệ thống khi gửi yêu cầu batch.' }, { status: 500 });
  }
}
