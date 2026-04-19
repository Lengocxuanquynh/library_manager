import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { createNotification } from '@/services/db';

export async function POST(request) {
  try {
    const body = await request.json();
    const { userId, adminId } = body;

    if (!userId) {
      return NextResponse.json({ error: 'Thiếu mã độc giả' }, { status: 400 });
    }

    const userRef = doc(db, "users", userId);
    
    // 1. Mở khóa tài khoản & Xóa dấu vết vi phạm cũ để khôi phục quyền gia hạn
    await updateDoc(userRef, {
      isLocked: false,
      lastOverdueAt: null // Tùy chọn: Xử lý khoan hồng, cho phép gia hạn ngay
    });

    // 2. Gửi thông báo chúc mừng vào inbox sinh viên
    await createNotification(
      userId,
      "✅ TÀI KHOẢN ĐÃ ĐƯỢC MỞ KHÓA",
      "Chào bạn, tài khoản của bạn đã chính thức được mở khóa sau khi hoàn tất thủ tục. Chúc bạn có những trải nghiệm đọc sách thú vị tại thư viện!",
      "success"
    );

    return NextResponse.json({
      success: true,
      message: 'Mở khóa tài khoản thành công.'
    });

  } catch (error) {
    console.error('Error unlocking member:', error);
    return NextResponse.json({ error: 'Lỗi hệ thống khi mở khóa' }, { status: 500 });
  }
}
