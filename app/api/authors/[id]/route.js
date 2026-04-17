import { NextResponse } from 'next/server';
import { deleteAuthor } from '../../../../services/db';

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    await deleteAuthor(id);
    return NextResponse.json({ message: 'Xóa tác giả thành công' });
  } catch (error) {
    console.error('Lỗi xóa tác giả:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
