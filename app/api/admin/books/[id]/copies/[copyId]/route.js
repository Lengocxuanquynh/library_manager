import { NextResponse } from 'next/server';
import { deleteBookCopy } from '@/services/db';
import { verifyAdmin } from '@/services/admin-check';

export async function DELETE(request, { params }) {
  try {
    const { id: bookId, copyId } = await params;
    const { searchParams } = new URL(request.url);
    const adminId = searchParams.get('adminId');

    if (!adminId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isAdmin = await verifyAdmin(adminId);
    if (!isAdmin) {
      return NextResponse.json({ error: "Bạn không có quyền thực hiện hành động này" }, { status: 403 });
    }

    await deleteBookCopy(copyId, bookId);
    return NextResponse.json({ success: true, message: "Đã xóa bản sao và cập nhật số lượng sách." });
  } catch (error) {
    console.error("Error deleting copy API:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
