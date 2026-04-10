import { NextResponse } from 'next/server';
import { updateCategory, deleteCategory } from '@/services/db';

export async function PATCH(request, context) {
  try {
    const { id } = await context.params;
    const body = await request.json();

    await updateCategory(id, body);

    return NextResponse.json({ success: true, message: 'Cập nhật thành công' });
  } catch (error) {
    console.error('Error updating category API:', error);
    return NextResponse.json({ error: 'Lỗi hệ thống' }, { status: 500 });
  }
}

export async function DELETE(request, context) {
  try {
    const { id } = await context.params;
    await deleteCategory(id);
    return NextResponse.json({ success: true, message: 'Xóa thành công' });
  } catch (error) {
    console.error('Error deleting category API:', error);
    return NextResponse.json({ error: 'Lỗi hệ thống' }, { status: 500 });
  }
}
