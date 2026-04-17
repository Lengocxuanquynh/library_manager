import { NextResponse } from 'next/server';
import { markAllNotificationsAsRead } from '@/services/db';

export async function POST(request) {
  try {
    const { userId } = await request.json();
    if (!userId) return NextResponse.json({ error: 'Thiếu userId' }, { status: 400 });

    await markAllNotificationsAsRead(userId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Lỗi đánh dấu đọc tất cả:', error);
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 });
  }
}
