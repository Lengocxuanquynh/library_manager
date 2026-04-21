import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, getDocs, query, where, updateDoc, doc } from 'firebase/firestore';
import { canUserBorrow, isBookAvailable, decrementBookStock, incrementBookStock } from '@/services/db';
import { sendMail } from '@/services/emailService';

export async function POST(request) {
  try {
    const body = await request.json();
    const { userId, userName, email, phone, books, paymentStatus, isAdmin, isMock } = body;

    if (!userId || !books || !Array.isArray(books) || books.length === 0) {
      return NextResponse.json({ error: 'Thiếu người dùng hoặc sách trong giỏ hàng' }, { status: 400 });
    }

    if (books.length > 3) {
      return NextResponse.json({ error: 'Bạn chỉ được mượn tối đa 3 cuốn sách' }, { status: 400 });
    }

    if (!phone || !email) {
      return NextResponse.json({ error: 'Vui lòng cung cấp đủ SĐT và Email để thư viện liên lạc khi cần.' }, { status: 400 });
    }

    // 1. Kiểm tra tồn kho chính xác (Gom nhóm các sách giống nhau)
    const bookCounts = {};
    books.forEach(b => {
      bookCounts[b.bookId] = (bookCounts[b.bookId] || 0) + 1;
    });

    for (const [bid, count] of Object.entries(bookCounts)) {
      const available = await isBookAvailable(bid, count);
      if (!available) {
        const bookTitle = books.find(b => b.bookId === bid)?.bookTitle || bid;
        return NextResponse.json({ error: `Sách "${bookTitle}" không đủ số lượng khả dụng trong kho.` }, { status: 400 });
      }
    }

    // 2. GIỮ CHỖ (Trừ kho ngay lập tức)
    const decrementedBooks = [];
    try {
      for (const [bid, count] of Object.entries(bookCounts)) {
        await decrementBookStock(bid, count);
        decrementedBooks.push({ bid, count });
      }
    } catch (stockErr) {
      // Hoàn lại những gì đã lỡ trừ trước khi báo lỗi
      for (const item of decrementedBooks) {
        await incrementBookStock(item.bid, item.count).catch(e => console.error("Rollback failed:", e));
      }
      return NextResponse.json({ error: stockErr.message || "Lỗi khi giữ chỗ sách." }, { status: 400 });
    }

    // 2. Check user overdue/pending books limits
    const userStatus = await canUserBorrow(userId, isAdmin);
    if (!userStatus.canBorrow) {
      // Hoàn kho nếu không đủ điều kiện mượn
      for (const item of decrementedBooks) {
        await incrementBookStock(item.bid, item.count).catch(e => console.error("Rollback failed:", e));
      }
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
        // Hoàn kho nếu gộp đơn thất bại do đầy
        for (const item of decrementedBooks) {
          await incrementBookStock(item.bid, item.count).catch(e => console.error("Rollback failed:", e));
        }
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

      // Gửi email thông báo Gộp đơn (Không await để tránh treo UI)
      sendMail(email, userName, {
        subject: "Cập nhật yêu cầu mượn sách (Gộp đơn)",
        message: `Bạn vừa gộp thêm ${newBooksBatch.length} cuốn sách vào đơn mượn đang chờ duyệt của mình. Tổng số sách hiện tại là ${existingBooks.length + newBooksBatch.length} cuốn.`
      }, null, isMock).catch(err => console.error("Email notify merge failed:", err));

      return NextResponse.json({
        success: true,
        message: `Đã GỘP THÊM ${newBooksBatch.length} cuốn vào Đơn mượn đang chờ duyệt của bạn!`,
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

    // Gửi email thông báo Đơn mới (Không await để tránh treo UI)
    sendMail(email, userName, {
      subject: "Xác nhận yêu cầu mượn sách thành công",
      message: `Cảm ơn bạn đã sử dụng dịch vụ thư viện. Yêu cầu mượn ${books.length} cuốn sách của bạn đã được gửi tới quản trị viên và đang chờ phê duyệt. Chúng tôi sẽ thông báo cho bạn ngay khi có kết quả!`
    }, null, isMock).catch(err => console.error("Email notify new request failed:", err));

    return NextResponse.json({
      success: true,
      message: 'Yêu cầu mượn giỏ sách đã được gửi, vui lòng chờ admin duyệt.',
      id: docRef.id
    });
  } catch (error) {
    // Trường hợp lỗi bất ngờ, cố gắng hoàn kho nếu có decrementedBooks
    for (const item of decrementedBooks) {
      await incrementBookStock(item.bid, item.count).catch(e => console.error("Rollback failed:", e));
    }
    console.error('Error in borrow-batch-request:', error);
    return NextResponse.json({ error: 'Lỗi hệ thống khi gửi yêu cầu mượn.' }, { status: 500 });
  }
}
