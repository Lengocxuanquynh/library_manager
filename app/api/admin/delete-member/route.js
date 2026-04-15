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
      return NextResponse.json(
        { error: 'Firebase Admin chưa được cấu hình. Không thể thực hiện các thao tác quản trị.' },
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
      return NextResponse.json(
        { error: 'Không thể xóa độc giả này vì họ đang mượn sách hoặc có sách quá hạn.' },
        { status: 400 }
      );
    }

    // 3. Xử lý xóa khỏi Firebase Authentication
    let targetUid = uid;

    // FALLBACK: Nếu thiếu UID nhưng có Email, tìm UID từ Auth
    if (!targetUid && email) {
      console.log(`>>> [Fallback] Thiếu UID, đang tìm kiếm theo Email: ${email}`);
      try {
        const userRecord = await adminAuth.getUserByEmail(email);
        targetUid = userRecord.uid;
        console.log(`>>> [Fallback] Tìm thấy UID: ${targetUid}`);
      } catch (err) {
        if (err.code === 'auth/user-not-found') {
          console.warn(`>>> [Warning] Không tìm thấy user trong Auth bằng Email: ${email}`);
        } else {
          throw err;
        }
      }
    }

    // Thực hiện xóa User trong Auth
    if (targetUid) {
      try {
        await adminAuth.deleteUser(targetUid);
        console.log(`>>> [SUCCESS] Đã xóa tài khoản Auth: ${targetUid}`);
      } catch (authError) {
        if (authError.code === 'auth/user-not-found') {
          console.warn(`>>> [Warning] User đã bị xóa khỏi Auth từ trước.`);
        } else {
          console.error(">>> [ERROR] Lỗi khi xóa Auth:", authError);
          return NextResponse.json(
            { error: `Lỗi khi xóa tài khoản Authentication: ${authError.message}` },
            { status: 500 }
          );
        }
      }
    }

    // 4. Xóa khỏi Firestore (Chỉ thực hiện sau khi dọn dẹp Auth)
    try {
      await adminDb.collection("members").doc(id).delete();
      console.log(`>>> [SUCCESS] Đã xóa dữ liệu Firestore: ${id}`);
    } catch (dbError) {
      console.error(">>> [ERROR] Lỗi khi xóa Firestore:", dbError);
      return NextResponse.json(
        { error: `Lỗi khi xóa dữ liệu trong database: ${dbError.message}` },
        { status: 500 }
      );
    }

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
