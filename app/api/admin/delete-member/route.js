import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '../../../../lib/firebase-admin';

/**
 * API Xóa độc giả hoàn toàn (Auth + Firestore)
 * Hỗ trợ Fallback theo Email nếu thiếu UID để đảm bảo dọn dẹp sạch sẽ.
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { id, uid, email } = body;

    console.log(">>> [API /admin/delete-member] Bắt đầu xử lý xóa:", { id, uid, email });

    if (!id) {
      return NextResponse.json({ error: 'Thiếu ID độc giả (Firestore)' }, { status: 400 });
    }

    // 1. Kiểm tra cấu hình Firebase Admin
    if (!adminAuth || !adminDb) {
      console.error(">>> [ERROR] Firebase Admin chưa được cấu hình.");
      return NextResponse.json(
        { error: 'Firebase Admin chưa được cấu hình.' },
        { status: 500 }
      );
    }

    // 2. Kiểm tra an toàn: Độc giả có đang mượn sách không?
    const recordsSnap = await adminDb.collection("borrowRecords")
      .where("userId", "==", id)
      .get();
    
    const hasActiveBooks = recordsSnap.docs.some(doc => {
      const status = doc.data().status;
      return status === 'BORROWING' || status === 'OVERDUE';
    });

    if (hasActiveBooks) {
      console.warn(`>>> [REJECT] Không thể xóa độc giả ${id} vì còn sách chưa trả.`);
      return NextResponse.json(
        { error: 'Không thể xóa độc giả này vì họ đang mượn sách hoặc có sách quá hạn.' },
        { status: 400 }
      );
    }

    // 3. Xử lý xóa khỏi Firebase Authentication (Ưu tiên)
    let targetUid = uid;

    // FALLBACK: Nếu thiếu UID nhưng có Email, tìm UID từ Auth
    if (!targetUid && email) {
      console.log(`>>> [FALLBACK] Thiếu UID, đang tìm UID bằng Email: ${email}`);
      try {
        const userRecord = await adminAuth.getUserByEmail(email);
        targetUid = userRecord.uid;
        console.log(`>>> [FALLBACK] Tìm thấy UID: ${targetUid}`);
      } catch (err) {
        if (err.code === 'auth/user-not-found') {
          console.warn(`>>> [WARNING] Không tìm thấy user trong Auth bằng Email: ${email}`);
        } else {
          console.error(">>> [ERROR] Lỗi khi tra cứu UID bằng email:", err);
        }
      }
    }

    // Thực hiện xóa User trong Auth
    if (targetUid) {
      try {
        await adminAuth.deleteUser(targetUid);
        console.log(`>>> [SUCCESS] Đã xóa tài khoản Authentication: ${targetUid}`);
      } catch (authError) {
        if (authError.code === 'auth/user-not-found') {
          console.warn(`>>> [WARNING] User ${targetUid} không tồn tại trong Auth (có thể đã xóa trước đó).`);
        } else {
          console.error(">>> [ERROR] Lỗi khi xóa Auth user:", authError);
          // Vẫn tiếp tục xóa Firestore để đồng bộ dữ liệu nếu Auth báo lỗi không nghiêm trọng
        }
      }
    } else {
      console.log(">>> [INFO] Không tìm thấy UID hợp lệ để xóa trong Auth. Tiếp tục xóa Firestore.");
    }

    // 4. Xóa khỏi Firestore
    try {
      await adminDb.collection("members").doc(id).delete();
      console.log(`>>> [SUCCESS] Đã xóa dữ liệu trong Firestore: ${id}`);
    } catch (dbError) {
      console.error(">>> [ERROR] Lỗi khi xóa Firestore document:", dbError);
      return NextResponse.json(
        { error: `Lỗi khi xóa dữ liệu trong database: ${dbError.message}` },
        { status: 500 }
      );
    }

    console.log(`>>> [DONE] Hoàn tất xóa độc giả: ${id}`);
    return NextResponse.json({
      success: true,
      message: 'Đã xóa độc giả và dọn dẹp tài khoản thành công.'
    });

  } catch (error) {
    console.error(">>> [CRITICAL] Lỗi API delete-member:", error);
    return NextResponse.json(
      { error: error.message || 'Lỗi hệ thống không xác định' },
      { status: 500 }
    );
  }
}
