import { NextResponse } from 'next/server';
import { canUserBorrow, getUserQuota } from '@/services/db';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

    // 1. Kiểm tra trạng thái tài khoản (Bị khóa, quá hạn...)
    const status = await canUserBorrow(userId);
    
    // 2. Lấy chi tiết hạn ngạch (Pending + Borrowed)
    const quota = await getUserQuota(userId);

    // Debug Log trên Server
    console.log(`[API can-borrow-check] User: ${userId} | Pending: ${quota.totalPending} | Borrowed: ${quota.totalBorrowed} | Remaining: ${quota.remaining}`);

    // Luôn cho phép thêm vào giỏ hàng (canAdd: true)
    // Nhưng gửi kèm thông tin quota để UI hiển thị VÙNG MƯỢN phù hợp
    return NextResponse.json({ 
      canAdd: true,
      canBorrowNow: status.canBorrow,
      borrowBlockReason: status.reason,
      ...quota 
    });
  } catch (error) {
    console.error('Error in can-borrow-check API:', error);
    return NextResponse.json({ error: 'Lỗi hệ thống khi kiểm tra hạn ngạch.' }, { status: 500 });
  }
}
