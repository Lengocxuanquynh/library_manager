import { NextResponse } from 'next/server';
import { markNotificationAsRead } from '@/services/db';

export async function POST(request) {
  try {
    const { notiId } = await request.json();
    if (!notiId) return NextResponse.json({ error: 'Thiếu notiId' }, { status: 400 });

    await markNotificationAsRead(notiId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Lỗi đánh dấu đã đọc:', error);
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 });
  }
}
