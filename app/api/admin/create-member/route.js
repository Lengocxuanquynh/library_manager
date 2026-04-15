import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '../../../lib/firebase-admin';

export async function POST(request) {
  console.log(">>> [SERVER] API /api/admin/create-member started.");
  
  try {
    const body = await request.json();
    const { name, email, phone, password } = body;

    // Diagnostic logging (Hidden in production log, but visible in development terminal)
    console.log(">>> Request Data:", { name, email, phone, password: password ? '********' : 'MISSING' });

    // 1. Basic Validation
    if (!name || !email || !password) {
      return NextResponse.json(
        { message: 'Họ tên, email và mật khẩu là bắt buộc' },
        { status: 400 }
      );
    }

    // 2. Check Firebase Admin Initialization
    if (!adminAuth || !adminDb) {
      console.error(">>> [ERROR] Firebase Admin SDK matches null. Current State:", {
        adminAuth: !!adminAuth,
        adminDb: !!adminDb,
        env_client_email: !!process.env.FIREBASE_CLIENT_EMAIL,
        env_private_key: !!process.env.FIREBASE_PRIVATE_KEY
      });
      return NextResponse.json(
        { message: 'Firebase Admin chưa được cấu hình hoặc lỗi khởi tạo. Kiểm tra lại .env.local hoặc service-account.json.' },
        { status: 500 }
      );
    }

    // 3. Create User in Firebase Auth
    let userRecord;
    try {
      userRecord = await adminAuth.createUser({
        email,
        password,
        displayName: name,
      });
      console.log(">>> [SUCCESS] Auth user created:", userRecord.uid);
    } catch (authError) {
      console.error(">>> [ERROR] Auth creation failed:", authError.code, authError.message);
      
      let msg = "Lỗi khi tạo tài khoản xác thực.";
      if (authError.code === 'auth/email-already-exists') msg = "Email này đã được sử dụng.";
      if (authError.code === 'auth/invalid-password') msg = "Mật khẩu không hợp lệ (tối thiểu 6 ký tự).";
      
      return NextResponse.json({ message: msg }, { status: 400 });
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
      // Optional: Cleanup Auth user if DB save fails
      // await adminAuth.deleteUser(userRecord.uid);
      
      return NextResponse.json(
        { message: 'Đã tạo tài khoản nhưng lỗi khi lưu thông tin vào Database.' },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error(">>> [CRITICAL] Chi tiết lỗi tại Server:", error);
    // ALWAYS return JSON
    return NextResponse.json(
      { message: error.message || 'Lỗi hệ thống không xác định' },
      { status: 500 }
    );
  }
}
