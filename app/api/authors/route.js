import { NextResponse } from 'next/server';
import { getAuthors, addAuthor } from '../../../services/db';

export async function GET() {
  try {
    const authors = await getAuthors();
    return NextResponse.json(authors);
  } catch (error) {
    console.error('Lỗi lấy danh sách tác giả:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { name } = await request.json();
    if (!name) {
      return NextResponse.json({ error: 'Tên tác giả là bắt buộc' }, { status: 400 });
    }

    const docRef = await addAuthor(name);
    return NextResponse.json({ id: docRef.id, message: 'Thêm tác giả thành công' });
  } catch (error) {
    console.error('Lỗi thêm tác giả:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
