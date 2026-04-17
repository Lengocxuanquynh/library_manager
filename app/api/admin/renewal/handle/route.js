import { NextResponse } from 'next/server';
import { processRenewalRequest } from '@/services/db';
import { verifyAdmin } from '@/services/admin-check';

export async function POST(request) {
  try {
    const body = await request.json();
    const { requestId, requestIds, isApproved, adminId } = body;
    const finalIds = requestIds || requestId;

    // 1. Xác thực quyền Admin
    const isAdmin = await verifyAdmin(adminId);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Quyền truy cập bị từ chối' }, { status: 403 });
    }

    if (!finalIds) {
      return NextResponse.json({ error: 'Thiếu ID yêu cầu gia hạn' }, { status: 400 });
    }

    // 2. Xử lý yêu cầu (Hàm processRenewalRequest đã hỗ trợ mảng)
    await processRenewalRequest(finalIds, isApproved);

    return NextResponse.json({ 
      success: true, 
      message: isApproved ? 'Đã duyệt yêu cầu gia hạn!' : 'Đã từ chối yêu cầu gia hạn.' 
    });
  } catch (error) {
    console.error('Lỗi xử lý gia hạn (Admin):', error);
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 });
  }
}
