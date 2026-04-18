import { db } from '@/lib/firebase';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  writeBatch, 
  doc, 
  getDoc 
} from 'firebase/firestore';
import { sendMail } from '@/services/emailService';
import { createNotification } from '@/services/db';

/**
 * Xử lý quá hạn cho một bản ghi mượn sách cụ thể.
 * Bao gồm cập nhật trạng thái, gửi mail và khóa tài khoản nếu cần.
 * 
 * @param {Object} recordData Dữ liệu bản ghi (kèm ID)
 * @param {Date} now Thời điểm hiện tại để so sánh
 * @returns {Promise<Object>} Kết quả xử lý { notified: boolean, locked: boolean }
 */
export async function processRecordOverdue(recordId, recordData, now = new Date()) {
  const batch = writeBatch(db);
  const result = { notified: false, locked: false, statusChanged: false };
  
  try {
    const userId = recordData.userId;
    const dueDate = recordData.dueDate?.toDate ? recordData.dueDate.toDate() : new Date(recordData.dueDate);
    
    if (!dueDate || !userId) return result;

    const diffMs = now - dueDate;
    // Đồng bộ với UI: Dùng Math.ceil để tính ngày trễ (chỉ cần chớm qua ngày là tính 1 ngày)
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    const targetEmail = recordData.userEmail || recordData.email;
    const targetName = recordData.userName || "Thành viên";

    // Lấy danh sách tên sách để gửi mail
    const bookList = (recordData.books || []).map(b => b.bookTitle || b.title || "Sách không tên").join(", ");
    const recordSummary = `Mã phiếu: [${recordId.slice(0,8)}]\nSách: ${bookList}`;
    const dueDateStr = dueDate.toLocaleDateString('vi-VN');
    const lockingDeadline = new Date(dueDate.getTime() + (14 * 24 * 60 * 60 * 1000)).toLocaleDateString('vi-VN');

    const msUntilDue = dueDate - now;

    // --- KIỂM TRA LẠI CỜ (Để tránh Spam do Race Condition) ---
    // Nếu dữ liệu truyền vào báo đã gửi rồi, thoát ngay
    if (recordData.notifiedOverdue && diffMs > 0 && diffDays < 13) return result;
    if (recordData.notifiedDueSoon && msUntilDue > 0 && msUntilDue <= 24 * 60 * 60 * 1000) return result;

    // Re-verify flags from DB before critical actions
    const freshSnap = await getDoc(doc(db, "borrowRecords", recordId));
    if (!freshSnap.exists()) return result;
    const freshData = freshSnap.data();

    // 1. CẬP NHẬT TRẠNG THÁI OVERDUE TRONG DB (Nếu thực tế đã quá hạn nhưng DB chưa ghi nhận)
    if (diffMs > 0 && freshData.status === 'BORROWING') {
      batch.update(doc(db, "borrowRecords", recordId), { status: 'OVERDUE' });
      result.statusChanged = true;
    }

    // 2. SẮP HẾT HẠN (1 ngày trước mốc trả)
    if (msUntilDue > 0 && msUntilDue <= 24 * 60 * 60 * 1000 && !freshData.notifiedDueSoon) {
      if (targetEmail) {
        await sendMail(targetEmail, targetName, {
          subject: "THÔNG BÁO: Sách mượn sắp đến hạn trả",
          message: `Xin chào ${targetName},\n\nBạn có sách mượn sắp đến hạn trả vào ngày ${dueDateStr}.\n\nHôm nay là: ${now.toLocaleDateString('vi-VN')}\n\nThông tin chi tiết:\n${recordSummary}\n\nVui lòng sắp xếp thời gian để hoàn trả hoặc gia hạn đúng hạn. Thân ái!`
        }, "template_f32qg1b");
      }
      
      await createNotification(userId, "📅 Sách mượn sắp đến hạn trả", `Phiếu mượn [${recordId.slice(0,8)}] sắp hết hạn trả vào ngày ${dueDateStr}.`, "info");
      batch.update(doc(db, "borrowRecords", recordId), { notifiedDueSoon: true });
      result.notified = true;
    }

    // 3. VỪA QUÁ HẠN (Gửi mail ngay lập tức khi diffMs > 0)
    if (diffMs > 0 && !freshData.notifiedOverdue) {
      if (targetEmail) {
        await sendMail(targetEmail, targetName, {
          subject: "CẢNH BÁO: Sách mượn đã QUÁ HẠN",
          message: `Xin chào ${targetName},\n\nPhiếu mượn của bạn đã QUÁ HẠN kể từ ngày ${dueDateStr}.\n\nThông tin chi tiết:\n${recordSummary}\n\nĐã quá hạn ${diffDays} ngày.\n\nLƯU Ý QUAN TRỌNG: Nếu không trả sách trước ngày ${lockingDeadline}, tài khoản của bạn sẽ bị hệ thống KHÓA TỰ ĐỘNG và bị phạt phí bồi thường.`
        }, "template_f32qg1b");
      }

      await createNotification(userId, "⚠️ Cảnh báo: Sách QUÁ HẠN", `Phiếu mượn [${recordId.slice(0,8)}] đã quá hạn kể từ ngày ${dueDateStr}. Hạn cuối để không bị khóa thẻ là ${lockingDeadline}.`, "warning");
      batch.update(doc(db, "borrowRecords", recordId), { notifiedOverdue: true, status: 'OVERDUE' });
      result.notified = true;
    }

    // 4. CẢNH BÁO CUỐI (Mốc trễ >= 13 ngày)
    // Dùng >= để bao quát trường hợp nhảy cóc ngày
    const gracePeriodDays = 14;
    if (diffDays >= gracePeriodDays - 1 && !freshData.notifiedFinal) {
      if (targetEmail) {
        await sendMail(targetEmail, targetName, {
          subject: "CẢNH BÁO CUỐI: Nguy cơ khóa tài khoản và báo cáo vi phạm",
          message: `Xin chào ${targetName},\n\nCẢNH BÁO KHẨN CẤP: Phiếu mượn của bạn đã quá hạn ${diffDays} ngày.\n\nThông tin chi tiết:\n${recordSummary}\n\nNếu bạn không hoàn trả sách và nộp phạt trong HÔM NAY, tài khoản của bạn sẽ bị KHÓA do nộp phạt trễ. Thư viện sẽ gửi danh sách báo cáo vi phạm này lên Nhà trường để xử lý kỷ luật.`
        }, "template_f32qg1b");
      }

      await createNotification(userId, "🚨 THÔNG BÁO CUỐI: Khóa thẻ & Báo cáo vi phạm", `Nguy cơ khóa thẻ và gửi báo cáo lên nhà trường do đã trễ ${diffDays} ngày. Vui lòng trả sách ngay hôm nay!`, "error");
      batch.update(doc(db, "borrowRecords", recordId), { notifiedFinal: true });
      result.notified = true;
    }

    // 5. KHÓA TÀI KHOẢN (Trễ >= 14 ngày)
    if (diffDays >= gracePeriodDays && !freshData.notifiedLocked) {
      const userRef = doc(db, "users", userId);
      const userSnap = await getDoc(userRef);
      const userData = userSnap.data();
      const isUserAlreadyLocked = userSnap.exists() && userData?.isLocked === true;
      
      if (!isUserAlreadyLocked) {
        batch.update(userRef, { isLocked: true });
        await createNotification(userId, "🔒 TÀI KHOẢN ĐÃ BỊ KHÓA", "Tài khoản bạn đã bị khóa do vi phạm quy định về thời hạn trả sách và nộp phạt.", "error");
        result.locked = true;
      }

      // CHUYỂN TRẠNG THÁI PHIẾU THÀNH 'MẤT/KHÓA'
      const updatedBooks = (recordData.books || []).map(b => {
        // Chỉ cập nhật trạng thái những cuốn chưa trả
        if (b.status !== 'RETURNED' && b.status !== 'RETURNED_OVERDUE') {
          return { ...b, status: 'LOST_LOCKED' };
        }
        return b;
      });

      batch.update(doc(db, "borrowRecords", recordId), { 
        status: 'LOST_LOCKED',
        notifiedLocked: true,
        books: updatedBooks
      });
      result.statusChanged = true;
    }

    await batch.commit();
    return result;
  } catch (error) {
    console.error(`Error processing record ${recordId}:`, error);
    return result;
  }
}

/**
 * Quét toàn bộ các bản ghi mượn sách đang hoạt động để xử lý quá hạn.
 */
export async function scanAllOverdue() {
  const now = new Date();
  const q = query(
    collection(db, "borrowRecords"),
    where("status", "in", ["BORROWING", "PARTIALLY_RETURNED", "OVERDUE"])
  );
  
  const snap = await getDocs(q);
  const results = {
    totalProcessed: 0,
    notifiedCount: 0,
    lockedCount: 0
  };

  // Sử dụng map thay vì for-of để xử lý song song
  const promises = snap.docs.map(async (doc) => {
    const res = await processRecordOverdue(doc.id, doc.data(), now);
    results.totalProcessed++;
    if (res.notified) results.notifiedCount++;
    if (res.locked) results.lockedCount++;
  });

  await Promise.all(promises);
  return results;
}
