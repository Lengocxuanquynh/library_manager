import { NextResponse } from 'next/server';
import { getUserNotifications } from '@/services/db';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'Thiếu userId' }, { status: 400 });
    }

    const notifications = await getUserNotifications(userId);
    return NextResponse.json(notifications);
  } catch (error) {
    console.error('Lỗi lấy thông báo:', error);
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 });
  }
}
