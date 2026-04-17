import { NextResponse } from 'next/server';
import { db } from '../../../lib/firebase';
import { collection, addDoc, serverTimestamp, getDocs, query, where, updateDoc, doc } from 'firebase/firestore';
import { canUserBorrow, isBookAvailable } from '../../../services/db';
import { sendMail } from '../../../services/emailService';

export async function POST(request) {
  try {
    const body = await request.json();
    const { userId, userName, email, phone, books, paymentStatus, isAdmin } = body;

    if (!userId || !books || !Array.isArray(books) || books.length === 0) {
      return NextResponse.json({ error: 'Thiếu người dùng hoặc sách trong giỏ hàng' }, { status: 400 });
    }

    if (books.length > 3) {
      return NextResponse.json({ error: 'Bạn chỉ được mượn tối đa 3 cuốn sách' }, { status: 400 });
    }

    if (!phone || !email) {
      return NextResponse.json({ error: 'Vui lòng cung cấp đủ SĐT và Email để thư viện liên lạc khi cần.' }, { status: 400 });
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
      
      // Cho phép sách trùng lặp, nên chúng ta lấy toàn bộ mảng sách mới
      const newBooksBatch = books;
      
      if (existingBooks.length + newBooksBatch.length > 3) {
        return NextResponse.json({ 
          error: `Giỏ hàng bị đầy! Bạn đang có ${existingBooks.length} cuốn chờ duyệt. Tối đa chỉ được mượn 3 cuốn tổng cộng.` 
        }, { status: 400 });
      }

      // Cập nhật đơn mượn cũ bằng cách nối thêm các sách mới
      const updatedBooks = [...existingBooks, ...newBooksBatch];
      await updateDoc(doc(db, "borrowRequests", existingDoc.id), {
        books: updatedBooks,
        updatedAt: serverTimestamp()
      });

      // Gửi email thông báo Gộp đơn
      await sendMail(email, userName, {
        subject: "Cập nhật yêu cầu mượn sách (Gộp đơn)",
        message: `Bạn vừa gộp thêm ${newBooksBatch.length} cuốn sách vào đơn mượn đang chờ duyệt của mình. Tổng số sách hiện tại là ${existingBooks.length + newBooksBatch.length} cuốn.`
      }).catch(err => console.error("Email notify merge failed:", err));

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
      books, // Array of { bookId, bookTitle }
      paymentStatus: paymentStatus || 'UNPAID',
      status: 'PENDING',
      createdAt: serverTimestamp()
    });

    // Gửi email thông báo Đơn mới
    await sendMail(email, userName, {
      subject: "Xác nhận yêu cầu mượn sách thành công",
      message: `Cảm ơn bạn đã sử dụng dịch vụ thư viện. Yêu cầu mượn ${books.length} cuốn sách của bạn đã được gửi tới quản trị viên và đang chờ phê duyệt. Chúng tôi sẽ thông báo cho bạn ngay khi có kết quả!`
    }).catch(err => console.error("Email notify new request failed:", err));

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
