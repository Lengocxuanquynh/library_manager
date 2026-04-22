import { NextResponse } from "next/server";
import admin, { adminDb } from "@/lib/firebase-admin";

export async function POST(req) {
  try {
    const { recordId, userId, adminId } = await req.json();

    if (!recordId || !userId || !adminId) {
      return NextResponse.json({ error: "Thiếu thông tin yêu cầu" }, { status: 400 });
    }

    const recordRef = adminDb.collection("borrowRecords").doc(recordId);
    const userRef = adminDb.collection("users").doc(userId);
    const batch = adminDb.batch();

    const recordSnap = await recordRef.get();
    if (!recordSnap.exists) {
      return NextResponse.json({ error: "Không tìm thấy phiếu mượn" }, { status: 404 });
    }

    const FieldValue = admin.firestore.FieldValue;
    
    // 1. Cập nhật trạng thái phiếu mượn - Giữ lại lịch sử
    batch.update(recordRef, {
      status: "RETURNED_LOST_PAID", 
      actualReturnDate: FieldValue.serverTimestamp(),
      updatedBy: adminId,
      updatedAt: FieldValue.serverTimestamp()
    });

    // 2. Mở khóa tài khoản người dùng và xóa các vết vi phạm cũ để họ có thể mượn tiếp
    batch.update(userRef, {
      isLocked: false,
      lockReason: null,
      lastOverdueAt: null, // Xóa vết vi phạm để được mượn ngay
      updatedAt: FieldValue.serverTimestamp()
    });

    // 3. Tạo thông báo cho độc giả
    const notifRef = adminDb.collection("notifications").doc();
    batch.set(notifRef, {
      userId,
      title: "✅ Tài khoản đã được mở khóa",
      message: `Thư viện xác nhận bạn đã hoàn tất xử lý vi phạm cho phiếu ${recordId}. Chào mừng bạn quay trở lại!`,
      type: "success",
      read: false,
      createdAt: FieldValue.serverTimestamp()
    });

    await batch.commit();

    return NextResponse.json({ success: true, message: "Đã xử lý vi phạm và mở khóa thành công" });
  } catch (error) {
    console.error(">>> [ERROR] Settle Violation failed:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
