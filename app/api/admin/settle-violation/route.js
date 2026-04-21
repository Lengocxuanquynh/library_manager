import { NextResponse } from "next/server";
import { db } from "@/services/firebase";
import { doc, getDoc, updateDoc, increment, collection, addDoc, serverTimestamp } from "firebase/firestore";

export async function POST(req) {
  try {
    const { recordId, userId, adminId } = await req.json();

    if (!recordId || !userId || !adminId) {
      return NextResponse.json({ error: "Thiếu thông tin yêu cầu" }, { status: 400 });
    }

    const recordRef = doc(db, "borrowRecords", recordId);
    const userRef = doc(db, "users", userId);

    const recordSnap = await getDoc(recordRef);
    if (!recordSnap.exists()) {
      return NextResponse.json({ error: "Không tìm thấy phiếu mượn" }, { status: 404 });
    }

    const recordData = recordSnap.data();
    
    // 1. Cập nhật trạng thái phiếu mượn
    await updateDoc(recordRef, {
      status: "RETURNED_LOST_PAID", // Trạng thái đã đền bù xong
      actualReturnDate: serverTimestamp(),
      updatedBy: adminId,
      updatedAt: serverTimestamp()
    });

    // 2. Mở khóa tài khoản người dùng
    await updateDoc(userRef, {
      isLocked: false,
      lockReason: null,
      updatedAt: serverTimestamp()
    });

    // 3. Lưu thông báo cho người dùng
    await addDoc(collection(db, "notifications"), {
      userId,
      title: "✅ Tài khoản đã được mở khóa",
      message: `Quản trị viên đã xác nhận bạn hoàn tất đền bù cho phiếu ${recordId}. Thẻ của bạn đã được kích hoạt lại.`,
      type: "success",
      read: false,
      createdAt: serverTimestamp()
    });

    return NextResponse.json({ success: true, message: "Đã xử lý vi phạm và mở khóa thành công" });
  } catch (error) {
    console.error("Settle Violation Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
