import { NextResponse } from 'next/server';
import { verifyAdmin } from '@/services/admin-check';
import { scanAllOverdue } from '@/services/overdueService';

export async function POST(request) {
  try {
    const body = await request.json();
    const { adminId } = body;

    const isAdmin = await verifyAdmin(adminId);
    if (!isAdmin) {
      return NextResponse.json({ message: 'Quyền truy cập bị từ chối' }, { status: 403 });
    }

    // Sử dụng service tập trung để quét hệ thống
    const results = await scanAllOverdue();

    return NextResponse.json({
      success: true,
      summary: {
        totalProcessed: results.totalProcessed,
        remindedOverdue: results.notifiedCount,
        lockedAccounts: results.lockedCount
      }
    });

  } catch (error) {
    console.error('Lỗi quét thông báo tự động:', error);
    return NextResponse.json({ message: 'Lỗi server' }, { status: 500 });
  }
}
