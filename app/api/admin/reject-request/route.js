import { NextResponse } from 'next/server';
import { rejectBorrowRequest } from '../../../../services/db';
import { verifyAdmin } from '../../../../services/admin-check';

export async function POST(request) {
  try {
    const body = await request.json();
    const { requestId, adminId } = body;

    if (!requestId || !adminId) {
      return NextResponse.json({ message: 'Thiếu requestId hoặc adminId' }, { status: 400 });
    }

    // Security check
    const isAdmin = await verifyAdmin(adminId);
    if (!isAdmin) {
      return NextResponse.json({ message: 'Bạn không có quyền thực hiện hành động này' }, { status: 403 });
    }

    // Lấy thông tin đơn trước khi cập nhật để lấy userId
    const { db } = await import('@/lib/firebase');
    const { doc, getDoc } = await import('firebase/firestore');
    const reqSnap = await getDoc(doc(db, "borrowRequests", requestId));
    const reqData = reqSnap.exists() ? reqSnap.data() : null;

    const { rejectBorrowRequest, createNotification } = await import('@/services/db');
    await rejectBorrowRequest(requestId);

    if (reqData && reqData.userId) {
      await createNotification(
        reqData.userId,
        "❌ Yêu cầu mượn sách bị từ chối",
        `Rất tiếc, yêu cầu mượn ${reqData.books?.length || 1} cuốn sách của bạn không được duyệt. Vui lòng liên hệ quầy hỗ trợ để biết thêm chi tiết.`,
        "error"
      ).catch(err => console.error("Internal notify rejection failed:", err));
    }

    return NextResponse.json({
      success: true,
      message: 'Đã từ chối yêu cầu mượn sách.'
    });
  } catch (error) {
    console.error('Error in reject-request API:', error);
    return NextResponse.json({ message: 'Lỗi hệ thống khi từ chối yêu cầu.' }, { status: 500 });
  }
}
