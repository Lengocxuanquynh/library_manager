import { NextResponse } from 'next/server';
import admin, { adminDb } from '@/lib/firebase-admin';

export async function POST(request) {
  try {
    const body = await request.json();
    const { userId, adminId } = body;

    if (!userId) {
      return NextResponse.json({ error: 'Thiếu mã độc giả' }, { status: 400 });
    }

    // 1. Lấy cấu hình hệ thống
    const settingsSnap = await adminDb.collection('settings').doc('library_config').get();
    const config = settingsSnap.exists ? settingsSnap.data() : { excludeSundays: true, holidays: [] };

    // 2. KIỂM TRA RÀNG BUỘC: Độc giả có còn phiếu vi phạm/quá hạn nặng chưa trả không?
    const { calculatePenaltyDetails } = require('@/lib/penalty-utils');
    const now = new Date();
    
    const overdueRecords = await adminDb.collection('borrowRecords')
      .where('userId', '==', userId)
      .where('status', 'in', ['BORROWING', 'OVERDUE', 'PARTIALLY_RETURNED', 'LOST_LOCKED'])
      .get();

    let hasViolation = false;
    overdueRecords.forEach(doc => {
      const data = doc.data();
      const dueDate = data.dueDate?.toDate() || new Date(data.dueDate);
      
      const penaltyInfo = calculatePenaltyDetails(dueDate, now, config);
      
      // Nếu trạng thái là LOST_LOCKED HOẶC trễ thực tế quá 14 ngày (sau khi trừ ngày nghỉ)
      if (data.status === 'LOST_LOCKED' || penaltyInfo.isLocked) {
        hasViolation = true;
      }
    });

    if (hasViolation) {
      return NextResponse.json({ 
        error: 'Không thể mở khóa! Độc giả vẫn còn phiếu mượn đang bị PHONG TỎA hoặc quá hạn trên 14 ngày chưa xử lý bồi thường.' 
      }, { status: 400 });
    }

    const userRef = adminDb.collection("users").doc(userId);
    const FieldValue = admin.firestore.FieldValue;
    
    // 2. Mở khóa tài khoản
    await userRef.update({
      isLocked: false,
      lockReason: null,
      lastOverdueAt: null,
      updatedAt: FieldValue.serverTimestamp()
    });

    // 3. Gửi thông báo
    const notifRef = adminDb.collection("notifications").doc();
    await notifRef.set({
      userId,
      title: "✅ TÀI KHOẢN ĐÃ ĐƯỢC MỞ KHÓA",
      message: "Chào bạn, quản trị viên đã xác nhận bạn hoàn tất các thủ tục bồi thường. Thẻ của bạn đã chính thức được khôi phục quyền lợi mượn sách. Chào mừng quay trở lại!",
      type: "success",
      read: false,
      createdAt: FieldValue.serverTimestamp()
    });

    return NextResponse.json({
      success: true,
      message: 'Mở khóa tài khoản thành công.'
    });

  } catch (error) {
    console.error('Error unlocking member:', error);
    return NextResponse.json({ error: 'Lỗi hệ thống: ' + error.message }, { status: 500 });
  }
}
