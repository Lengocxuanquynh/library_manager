import { NextResponse } from 'next/server';
import { verifyOTPSession } from '@/services/otp';

export async function POST(request) {
  try {
    const { uid, otp } = await request.json();

    if (!uid || !otp) {
      return NextResponse.json({ error: "Missing UID or OTP code" }, { status: 400 });
    }

    const userAgent = request.headers.get('user-agent') || 'unknown';
    const result = await verifyOTPSession(uid, otp, userAgent);

    if (result.success) {
      return NextResponse.json({ 
        success: true, 
        message: result.message 
      });
    } else {
      return NextResponse.json({ 
        success: false, 
        message: result.message,
        shouldLogout: result.shouldLogout 
      }, { status: 200 }); // Still 200 because it's a logical "incorrect code" response
    }
  } catch (error) {
    console.error("Error verifying OTP API:", error);
    return NextResponse.json({ 
      error: error.message || "Lỗi hệ thống khi xác thực mã OTP" 
    }, { status: 500 });
  }
}
