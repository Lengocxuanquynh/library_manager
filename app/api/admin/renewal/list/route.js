import { NextResponse } from 'next/server';
import { getRenewalRequests } from '@/services/db';
import { verifyAdmin } from '@/services/admin-check';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const adminId = searchParams.get('adminId');

    const isAdmin = await verifyAdmin(adminId);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Quyền truy cập bị từ chối' }, { status: 403 });
    }

    const requests = await getRenewalRequests();
    return NextResponse.json(requests);
  } catch (error) {
    console.error('Lỗi lấy danh sách gia hạn:', error);
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 });
  }
}
