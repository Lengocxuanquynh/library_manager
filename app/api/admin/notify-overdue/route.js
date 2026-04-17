import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { sendMail } from '@/services/emailService';
import { verifyAdmin } from '@/services/admin-check';

export async function POST(request) {
  try {
    const body = await request.json();
    const { adminId } = body;

    // 1. Kiểm tra quyền Admin
    const isAdmin = await verifyAdmin(adminId);
    if (!isAdmin) {
      return NextResponse.json({ message: 'Quyền truy cập bị từ chối' }, { status: 403 });
    }

    // 2. Tìm các bản ghi có khả năng quá hạn
    const q = query(
      collection(db, "borrowRecords"),
      where("status", "in", ["BORROWING", "PARTIALLY_RETURNED", "OVERDUE"])
    );
    const snap = await getDocs(q);
    const now = new Date();
    let sentCount = 0;
    const errors = [];

    const overdueRecords = snap.docs.filter(doc => {
      const data = doc.data();
      const dueDate = data.dueDate?.toDate ? data.dueDate.toDate() : new Date(data.dueDate);
      return dueDate < now;
    });

    if (overdueRecords.length === 0) {
      return NextResponse.json({ success: true, message: 'Hiện không có phiếu nào quá hạn cần thông báo.' });
    }

    // 3. Gửi Email thông báo (xử lý song song)
    const emailPromises = overdueRecords.map(async (recordDoc) => {
      const data = recordDoc.data();
      const userEmail = data.userEmail || data.email;
      const userName = data.userName || data.memberName;
      
      if (!userEmail) return;

      try {
        await sendMail(userEmail, userName, {
          subject: "CẢNH BÁO: Sách mượn tại Thư Viện đã QUÁ HẠN",
          message: `Chào bạn, Thư viện xin thông báo phiếu mượn của bạn đã quá hạn trả sách. 
          
Sách mượn: ${data.books?.map(b => b.bookTitle).join(", ") || "Sách đã mượn"}
Hạn trả cũ: ${data.dueDate?.toDate ? data.dueDate.toDate().toLocaleDateString('vi-VN') : new Date(data.dueDate).toLocaleDateString('vi-VN')}

Vui lòng đến thư viện HOÀN TRẢ SÁCH ngay trong ngày hôm nay để tránh phát sinh thêm phí phạt quá hạn (nếu có). 
Cảm ơn bạn!`
        });
        sentCount++;
      } catch (err) {
        console.error(`Gửi mail thất bại tới ${userEmail}:`, err);
        errors.push(userEmail);
      }
    });

    await Promise.all(emailPromises);

    return NextResponse.json({
      success: true,
      message: `Đã gửi thông báo nhắc nợ tới ${sentCount} độc giả.`,
      failedEmails: errors
    });

  } catch (error) {
    console.error('Lỗi API Notify Overdue:', error);
    return NextResponse.json({ message: 'Lỗi hệ thống khi gửi thông báo.' }, { status: 500 });
  }
}
