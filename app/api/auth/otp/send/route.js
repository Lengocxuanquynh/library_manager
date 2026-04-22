import { NextResponse } from 'next/server';
import { createOTPSession, checkOTPLimit } from '@/services/otp';
import { sendMail } from '@/services/emailService';

export async function POST(request) {
  try {
    const { uid, email, name, isMock } = await request.json();

    if (!uid || !email) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // 0. Check Lockout (Case 2, 10)
    const lockout = await checkOTPLimit(email);
    if (lockout.isLocked) {
      return NextResponse.json({ error: lockout.message }, { status: 429 });
    }

    // 1. Create OTP in Firestore with Device Fingerprint (Case 8)
    const userAgent = request.headers.get('user-agent') || 'unknown';
    const otpCode = await createOTPSession(uid, email, userAgent);

    // 2. Send Email (Only if NOT in Mock Mode)
    if (!isMock) {
      await sendMail(email, name || "Thành viên", otpCode);
    }

    return NextResponse.json({ 
      success: true, 
      message: isMock ? "Mã OTP đã tạo (Chế độ Mock)" : "Mã OTP đã được gửi đến email của bạn.",
      devOtp: isMock ? otpCode : null // Chỉ trả về mã khi ở chế độ Mock
    });
  } catch (error) {
    console.error("Error sending OTP API:", error);
    return NextResponse.json({ 
      error: error.message || "Lỗi hệ thống khi gửi mã OTP" 
    }, { status: 500 });
  }
}
