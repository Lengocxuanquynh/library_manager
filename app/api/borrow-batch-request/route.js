import { NextResponse } from 'next/server';
import { db } from '../../../lib/firebase';
import { collection, addDoc, serverTimestamp, getDocs, query, where, updateDoc, doc } from 'firebase/firestore';
import { canUserBorrow, isBookAvailable } from '../../../services/db';

export async function POST(request) {
  try {
    const body = await request.json();
    const { userId, userName, email, phone, cccd, books, paymentStatus, isAdmin } = body;

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
    const userStatus = await canUserBorrow(userId, isAdmin);
    if (!userStatus.canBorrow) {
      return NextResponse.json({ error: userStatus.reason }, { status: 400 });
    }

    // 3. Xử lý Gộp Đơn (Dynamic Merge)
    const qPending = query(
      collection(db, "borrowRequests"), 
      where("userId", "==", userId), 
      where("status", "==", "PENDING")
    );
    const pendingSnap = await getDocs(qPending);
    
    if (!pendingSnap.empty) {
      const existingDoc = pendingSnap.docs[0];
      const existingData = existingDoc.data();
      const existingBooks = existingData.books || [];
      
      // Lọc các sách chưa có trong đơn Pending
      const uniqueNewBooks = books.filter(newB => !existingBooks.some(oldB => oldB.bookId === newB.bookId));
      
      if (uniqueNewBooks.length === 0) {
        return NextResponse.json({ error: 'Tất cả sách này đã nằm sẵn trong đơn chờ duyệt của bạn rồi.' }, { status: 400 });
      }

      if (existingBooks.length + uniqueNewBooks.length > 3) {
        return NextResponse.json({ 
          error: `Giỏ hàng bị đầy! Bạn đang có ${existingBooks.length} cuốn chờ duyệt. Tổng sách không được quá 3 cuốn.` 
        }, { status: 400 });
      }
      
      // Gộp đơn
      await updateDoc(doc(db, "borrowRequests", existingDoc.id), {
        books: [...existingBooks, ...uniqueNewBooks]
      });

      return NextResponse.json({
        success: true,
        message: `Đã GỘP THÊM ${uniqueNewBooks.length} cuốn vào Đơn mượn đang chờ duyệt của bạn!`,
        id: existingDoc.id
      });
    }

    // 4. Nếu không có đơn Pending nào, tạo Đơn mới
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
