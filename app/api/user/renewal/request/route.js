import { NextResponse } from 'next/server';
import { canUserRenew, submitRenewalRequest } from '@/services/db';

export async function POST(request) {
  try {
    const body = await request.json();
    const { userId, recordId, reason, userName, bookTitles } = body;

    if (!userId || !recordId || !reason) {
      return NextResponse.json({ error: 'Thiếu thông tin người dùng, đơn mượn hoặc lý do.' }, { status: 400 });
    }

    // 1. Kiểm tra điều kiện gia hạn
    const check = await canUserRenew(userId, recordId);
    if (!check.canRenew) {
      return NextResponse.json({ error: check.reason }, { status: 400 });
    }

    // 2. Gửi yêu cầu
    await submitRenewalRequest(recordId, userId, reason, userName, bookTitles);

    return NextResponse.json({ success: true, message: 'Gửi yêu cầu gia hạn thành công. Vui lòng chờ Admin phê duyệt.' });
  } catch (error) {
    console.error('Lỗi yêu cầu gia hạn:', error);
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 });
  }
}
