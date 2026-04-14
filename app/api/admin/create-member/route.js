import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

export async function POST(request) {
  try {
    const body = await request.json();
    const { name, email, phone, password } = body;

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: 'Họ tên, email và mật khẩu là bắt buộc' },
        { status: 400 }
      );
    }

    if (!adminAuth) {
      return NextResponse.json(
        { error: 'Firebase Admin chưa được cấu hình (Thiếu Credentials).' },
        { status: 500 }
      );
    }

    // 1. Create user in Firebase Auth using Admin SDK
    const userRecord = await adminAuth.createUser({
      email,
      password,
      displayName: name,
    });

    if (!adminDb) {
      return NextResponse.json(
        { error: 'Firebase Admin Database chưa được cấu hình.' },
        { status: 500 }
      );
    }

    // 2. Save to Firestore (members collection) using Admin SDK
    const docRef = await adminDb.collection("members").add({
      name,
      email,
      phone: phone || '',
      uid: userRecord.uid
    });

    return NextResponse.json({
      success: true,
      message: 'Thêm độc giả mới thành công',
      id: docRef.id,
      uid: userRecord.uid
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating member API:', error);
    
    let errorMessage = 'Lỗi hệ thống khi thêm độc giả';
    if (error.code === 'auth/email-already-exists') {
      errorMessage = 'Email này đã được sử dụng cho một tài khoản khác.';
    } else if (error.code === 'auth/invalid-password') {
      errorMessage = 'Mật khẩu phải có ít nhất 6 ký tự.';
    }

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
