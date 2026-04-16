import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '../../../../lib/firebase-admin';

export async function POST(request) {
  try {
    const body = await request.json();
    const { uid, newEmail } = body;

    if (!uid || !newEmail) {
      return NextResponse.json({ error: 'Missing uid or newEmail' }, { status: 400 });
    }

    if (!adminAuth || !adminDb) {
      return NextResponse.json({ error: 'Firebase Admin không khả dụng' }, { status: 500 });
    }

    // 1. Ép đổi Email quyền Admin (Bỏ qua cơ chế gửi Mail mặc định của Google)
    await adminAuth.updateUser(uid, { email: newEmail });

    // 2. Chép Email mới vào cơ sở dữ liệu
    await adminDb.collection("users").doc(uid).set({ email: newEmail }, { merge: true });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Lỗi khi ép đổi Email:", error);
    
    if (error.code === 'auth/email-already-exists') {
      return NextResponse.json({ error: 'Email này đã được đăng ký bởi tài khoản khác!' }, { status: 400 });
    }

    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
