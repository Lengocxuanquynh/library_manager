import { adminAuth } from '@/lib/firebase-admin';
import { NextResponse } from 'next/server';

/**
 * API Đặt lại mật khẩu an toàn (Sử dụng Admin SDK)
 * Thao tác này chỉ được gọi sau khi OTP đã được xác thực thành công ở client.
 */
export async function POST(request) {
  try {
    const { uid, newPassword } = await request.json();

    if (!uid || !newPassword) {
      return NextResponse.json({ error: 'Thiếu thông tin UID hoặc mật khẩu mới.' }, { status: 400 });
    }

    if (!adminAuth) {
      return NextResponse.json({ error: 'Firebase Admin SDK chưa được cấu hình.' }, { status: 500 });
    }

    // Tiêu chuẩn tối thiểu (Double check ở server)
    if (newPassword.length < 8) {
      return NextResponse.json({ error: 'Mật khẩu phải dài ít nhất 8 ký tự.' }, { status: 400 });
    }

    // Thực hiện cập nhật mật khẩu qua Admin SDK (Bypass re-auth)
    await adminAuth.updateUser(uid, {
      password: newPassword
    });

    return NextResponse.json({ success: true, message: 'Mật khẩu đã được cập nhật thành công.' });
  } catch (error) {
    console.error('Reset Password API Error:', error);
    return NextResponse.json({ error: error.message || 'Lỗi khi cập nhật mật khẩu.' }, { status: 500 });
  }
}
