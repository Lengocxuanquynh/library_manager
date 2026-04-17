import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, writeBatch, doc } from 'firebase/firestore';
import { sendMail } from '@/services/emailService';
import { verifyAdmin } from '@/services/admin-check';
import { createNotification } from '@/services/db';

export async function POST(request) {
  try {
    const body = await request.json();
    const { adminId } = body;

    const isAdmin = await verifyAdmin(adminId);
    if (!isAdmin) {
      return NextResponse.json({ message: 'Quyền truy cập bị từ chối' }, { status: 403 });
    }

    const q = query(
      collection(db, "borrowRecords"),
      where("status", "in", ["BORROWING", "PARTIALLY_RETURNED", "OVERDUE"])
    );
    const snap = await getDocs(q);
    const now = new Date();
    const batch = writeBatch(db);
    
    let processedCount = 0;
    let notifySoonCount = 0;
    let notifyOverdueCount = 0;
    let notifyFinalCount = 0;
    let lockCount = 0;

    const promises = snap.docs.map(async (recordDoc) => {
      try {
        const data = recordDoc.data();
        const recordId = recordDoc.id;
        const dueDate = data.dueDate?.toDate ? data.dueDate.toDate() : new Date(data.dueDate);
        
        if (!dueDate) return;

        const diffMs = now - dueDate;
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        const targetEmail = data.userEmail || data.email;
        const targetName = data.userName || "Thành viên";

        if (!targetEmail) return;

        // Lấy danh sách tên sách
        const bookList = (data.books || []).map(b => b.title).join(", ");
        const recordSummary = `Mã phiếu: [${recordId.slice(0,8)}]\nSách: ${bookList}`;

        const msUntilDue = dueDate - now;

        // 1. Sắp hết hạn
        if (msUntilDue > 0 && msUntilDue <= 24 * 60 * 60 * 1000 && !data.notifiedDueSoon) {
          await sendMail(targetEmail, targetName, {
            subject: "THÔNG BÁO: Sách mượn sắp đến hạn trả",
            message: `Xin chào ${targetName},\n\nBạn có sách mượn sắp đến hạn trả vào ngày ${dueDate.toLocaleDateString('vi-VN')}.\n\nThông tin chi tiết:\n${recordSummary}\n\nVui lòng sắp xếp thời gian để hoàn trả hoặc gia hạn đúng hạn. Tâm tâm!`
          }, "template_f32qg1b");
          
          await createNotification(data.userId, "📅 Sách mượn sắp đến hạn trả", `Phiếu mượn [${recordId.slice(0,8)}] sắp hết hạn trả vào ngày ${dueDate.toLocaleDateString('vi-VN')}.`, "info");
          batch.update(doc(db, "borrowRecords", recordId), { notifiedDueSoon: true });
          notifySoonCount++;
        }

        // 2. Vừa quá hạn
        if (diffMs > 0 && !data.notifiedOverdue) {
          await sendMail(targetEmail, targetName, {
            subject: "CẢNH BÁO: Sách mượn đã QUÁ HẠN",
            message: `Xin chào ${targetName},\n\nPhiếu mượn của bạn đã QUÁ HẠN kể từ ngày ${dueDate.toLocaleDateString('vi-VN')}.\n\nThông tin chi tiết:\n${recordSummary}\n\nĐã quá hạn ${diffDays > 0 ? diffDays : 1} ngày. Vui lòng mang sách đến thư viện để hoàn trả ngay lập tức để tránh phát sinh chi phí hoặc bị khóa thẻ.`
          }, "template_f32qg1b");

          await createNotification(data.userId, "⚠️ Cảnh báo: Sách QUÁ HẠN", `Phiếu mượn [${recordId.slice(0,8)}] đã quá hạn ${diffDays > 0 ? diffDays : 1} ngày.`, "warning");
          batch.update(doc(db, "borrowRecords", recordId), { notifiedOverdue: true });
          notifyOverdueCount++;
        }

        // 3. Cảnh báo cuối & Khóa tài khoản
        const gracePeriodDays = 14;
        if (diffDays >= gracePeriodDays - 1 && diffDays < gracePeriodDays && !data.notifiedFinal) {
          await sendMail(targetEmail, targetName, {
            subject: "CẢNH BÁO CUỐI: Nguy cơ khóa tài khoản",
            message: `Xin chào ${targetName},\n\nCẢNH BÁO KHẨN CẤP: Phiếu mượn của bạn đã quá hạn gần 14 ngày.\n\nThông tin chi tiết:\n${recordSummary}\n\nNếu bạn không hoàn trả sách trong HÔM NAY, tài khoản của bạn sẽ tự động bị hệ thống KHÓA.`
          }, "template_f32qg1b");

          await createNotification(data.userId, "🚨 THÔNG BÁO CUỐI: Nguy cơ khóa thẻ", `Nguy cơ khóa thẻ do quá hạn 14 ngày. Vui lòng trả sách ngay hôm nay!`, "error");
          batch.update(doc(db, "borrowRecords", recordId), { notifiedFinal: true });
          notifyFinalCount++;
        }

        if (diffDays >= gracePeriodDays) {
          const userRef = doc(db, "users", data.userId);
          batch.update(userRef, { isLocked: true });
          await createNotification(data.userId, "🔒 TÀI KHOẢN ĐÃ BỊ KHÓA", "Tài khoản của bạn đã bị khóa do quá hạn trả sách 14 ngày.", "error");
          lockCount++;
        }

        processedCount++;
      } catch (err) {
        console.error("Error processing record:", recordDoc.id, err);
      }
    });

    await Promise.all(promises);
    await batch.commit();

    return NextResponse.json({
      success: true,
      summary: {
        totalProcessed: processedCount,
        remindedSoon: notifySoonCount,
        remindedOverdue: notifyOverdueCount,
        warnedFinal: notifyFinalCount,
        lockedAccounts: lockCount
      }
    });

  } catch (error) {
    console.error('Lỗi quét thông báo tự động:', error);
    return NextResponse.json({ message: 'Lỗi server' }, { status: 500 });
  }
}
