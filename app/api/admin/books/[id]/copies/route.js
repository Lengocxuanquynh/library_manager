import { NextResponse } from 'next/server';
import { getBookCopies, addBookCopies } from '@/services/db';

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const copies = await getBookCopies(id);
    return NextResponse.json(copies);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const { count, bookTitle } = await request.json();
    
    if (!count || count <= 0) {
      return NextResponse.json({ error: "Số lượng không hợp lệ" }, { status: 400 });
    }

    await addBookCopies(id, count, bookTitle);
    return NextResponse.json({ success: true, message: `Đã thêm ${count} bản sao mới.` });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
