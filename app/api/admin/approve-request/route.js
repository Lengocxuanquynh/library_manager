import { NextResponse } from 'next/server';
import { doc, collection, addDoc, updateDoc, serverTimestamp, increment } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { updateBorrowRequestStatus, createBorrowRecord, createNotification, decrementBookStock } from '@/services/db';
import { verifyAdmin } from '@/services/admin-check';
import { sendMail } from '@/services/emailService';
import { getDoc } from 'firebase/firestore';

export async function POST(request) {
  try {
    const body = await request.json();
    const { requestId, userId, userName, books, bookId, bookTitle, adminId } = body;

    if (!requestId || !userId || !adminId) {
      return NextResponse.json({ message: 'Thiếu thông tin yêu cầu hoặc quyền hạn' }, { status: 400 });
    }

    // Security check
    const isAdmin = await verifyAdmin(adminId);
    if (!isAdmin) {
      return NextResponse.json({ message: 'Bạn không có quyền thực hiện hành động này' }, { status: 403 });
    }

    // Chuẩn bị pickupDeadline = hiện tại + 24 giờ
    const approvedAt = new Date();
    const pickupDeadline = new Date(approvedAt.getTime() + 24 * 60 * 60 * 1000);

    // Lấy thông tin email từ đơn yêu cầu gốc để gửi thông báo
    const reqRef = doc(db, "borrowRequests", requestId);
    const reqSnap = await getDoc(reqRef);
    const reqData = reqSnap.exists() ? reqSnap.data() : {};
    const userEmail = reqData.userEmail || null;
    const userPhone = reqData.userPhone || "";

    const hasBooksArray = Array.isArray(books) && books.length > 0;
    const hasSingleBook = bookId && bookTitle;

    if (!hasBooksArray && !hasSingleBook) {
      console.error('[approve-request] Dữ liệu thiếu sách:', body);
      return NextResponse.json({ message: 'Không tìm thấy thông tin sách để duyệt. Kiểm tra lại cấu trúc phiếu.' }, { status: 400 });
    }

    // Gom nhóm sách để trừ tồn kho
    const booksToProcess = hasBooksArray ? books : [{ bookId, bookTitle }];
    const finalBooks = [];
    
    // 1. Thực hiện trừ kho và lấy thông tin giá sách
    try {
      for (const b of booksToProcess) {
        // Trừ kho an toàn
        await decrementBookStock(b.bookId, 1);
        
        // Lấy giá sách
        let price = 0;
        const bookRef = doc(db, 'books', b.bookId);
        const bookSnap = await getDoc(bookRef);
        if (bookSnap.exists()) {
          price = bookSnap.data().price || 0;
        }
        
        finalBooks.push({
          bookId: b.bookId,
          bookTitle: b.bookTitle,
          price: price
        });
      }
    } catch (err) {
      console.error('[approve-request] Lỗi trừ kho:', err);
      return NextResponse.json({ message: err.message || 'Lỗi trừ kho khi duyệt.' }, { status: 400 });
    }

    // 2. Tạo bản ghi mượn sách (Status sẽ là APPROVED_PENDING_PICKUP vì autoDecrement=false)
    await createBorrowRecord(
      userId,
      userName,
      finalBooks,
      null, 
      null, 
      false, // Không tự động trừ kho nữa vì đã trừ thủ công ở trên
      userPhone, 
      userEmail,
      pickupDeadline // <--- THÊM VÀO ĐÂY
    );

    // 3. CẬP NHẬT TRẠNG THÁI PHIẾU YÊU CẦU (Quan trọng: Giải quyết lỗi phân thân)
    await updateBorrowRequestStatus(requestId, 'APPROVED');

    // Gửi email thông báo Phê duyệt thành công
    if (userEmail) {
      await sendMail(userEmail, userName, {
        subject: "Yêu cầu mượn sách đã được DUYỆT",
        message: `Thư viện xin thông báo: Yêu cầu mượn ${finalBooks.length} cuốn sách của bạn đã được Admin phê duyệt thành công. 

Vui lòng đến thư viện nhận sách trong vòng 24 GIỜ tới (trước khi phiếu mượn tự động hết hạn). 
Trân trọng!`
      }).catch(err => console.error("Email notify approval failed:", err));

      // Tạo thông báo trong App (Inbox)
      await createNotification(
        userId,
        "🎉 Yêu cầu mượn sách được duyệt",
        `Đơn mượn ${finalBooks.length} cuốn sách của bạn đã được phê duyệt. Hãy đến thư viện nhận sách trong 24h tới!`,
        "success"
      ).catch(err => console.error("Internal notify approval failed:", err));
    }

    const count = hasBooksArray ? books.length : 1;
    return NextResponse.json({
      success: true,
      message: `Đã duyệt ${count} sách. Độc giả có 24h để lấy sách.`,
    });
  } catch (error) {
    console.error('[approve-request] Lỗi hệ thống:', error);
    return NextResponse.json({ message: 'Lỗi hệ thống khi duyệt yêu cầu.' }, { status: 500 });
  }
}
