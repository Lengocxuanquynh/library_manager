import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

export async function POST(request) {
  console.log(">>> [SERVER] API /api/admin/create-member started.");
  
  try {
    const body = await request.json();
    const { name, email, phone, password } = body;

    // 1. Basic Validation
    if (!name || !email || !password) {
      return NextResponse.json(
        { message: 'Họ tên, email và mật khẩu là bắt buộc' },
        { status: 400 }
      );
    }

    // 2. Check Firebase Admin Initialization
    if (!adminAuth || !adminDb) {
      console.error(">>> [ERROR] Firebase Admin SDK matches null.");
      return NextResponse.json(
        { message: 'Firebase Admin chưa được cấu hình hoặc lỗi khởi tạo.' },
        { status: 500 }
      );
    }

    // 3. Create User in Firebase Auth with Orphan Handling
    let userRecord;
    try {
      userRecord = await adminAuth.createUser({
        email,
        password,
        displayName: name,
      });
      console.log(">>> [SUCCESS] Auth user created:", userRecord.uid);
    } catch (authError) {
      if (authError.code === 'auth/email-already-exists') {
        console.log(`>>> [INFO] Email ${email} đã tồn tại trong Auth. Đang kiểm tra tài khoản mồ côi...`);
        
        // Kiểm tra xem có tài liệu nào trong Firestore (members hoặc users) khớp với email này không
        const memberSnap = await adminDb.collection("members").where("email", "==", email).get();
        const userSnap = await adminDb.collection("users").where("email", "==", email).get();

        if (memberSnap.empty && userSnap.empty) {
          console.log(">>> [ACTION] Phát hiện tài khoản mồ côi (Không có dữ liệu trong Firestore). Đang xóa để tạo lại...");
          const existingUser = await adminAuth.getUserByEmail(email);
          await adminAuth.deleteUser(existingUser.uid);
          
          // Thử tạo lại
          userRecord = await adminAuth.createUser({
            email,
            password,
            displayName: name,
          });
          console.log(">>> [SUCCESS] Đã dọn dẹp và tạo lại tài khoản Auth thành công:", userRecord.uid);
        } else {
          console.warn(">>> [REJECT] Email thực sự đang được sử dụng bởi một bản ghi active.");
          return NextResponse.json(
            { message: "Email này đã được sử dụng bởi một thành viên khác." }, 
            { status: 400 }
          );
        }
      } else {
        console.error(">>> [ERROR] Auth creation failed:", authError.code, authError.message);
        let msg = "Lỗi khi tạo tài khoản xác thực.";
        if (authError.code === 'auth/invalid-password') msg = "Mật khẩu không hợp lệ (tối thiểu 6 ký tự).";
        return NextResponse.json({ message: msg }, { status: 400 });
      }
    }

    // 4. Save Additional Data to Firestore
    try {
      const docRef = await adminDb.collection("members").add({
        name,
        email,
        phone: phone || '',
        uid: userRecord.uid,
        createdAt: new Date().toISOString(),
        role: 'user',
        borrowCount: 0
      });
      console.log(">>> [SUCCESS] Firestore record created:", docRef.id);

      return NextResponse.json({
        success: true,
        message: 'Thêm độc giả mới thành công',
        id: docRef.id,
        uid: userRecord.uid
      }, { status: 201 });

    } catch (dbError) {
      console.error(">>> [ERROR] Firestore save failed:", dbError);
      return NextResponse.json(
        { message: 'Đã tạo tài khoản nhưng lỗi khi lưu thông tin vào Database.' },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error(">>> [CRITICAL] Lỗi Server:", error);
    return NextResponse.json(
      { message: error.message || 'Lỗi hệ thống không xác định' },
      { status: 500 }
    );
  }
}
