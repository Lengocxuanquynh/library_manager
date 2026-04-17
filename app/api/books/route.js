import { NextResponse } from 'next/server';
import { addBook, getBooks, ensureCategoryExists, notifyFollowers, ensureAuthorExists } from '../../../services/db';

export async function GET() {
  try {
    const books = await getBooks();
    return NextResponse.json(books);
  } catch (error) {
    console.error('Error listing books API:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { title, author, category, status, coverImage, quantity, isbn, publisher, year, description } = body;

    if (!title || !author) {
      return NextResponse.json(
        { error: 'Tiêu đề và tác giả là bắt buộc' },
        { status: 400 }
      );
    }

    // Auto-sync category & author
    if (category) await ensureCategoryExists(category);
    if (author) await ensureAuthorExists(author);


    const docRef = await addBook({
      title,
      author,
      category: category || 'Chưa phân loại',
      status: status || 'Available',
      coverImage: coverImage || '',
      quantity: parseInt(quantity) || 0,
      isbn: isbn || '',
      publisher: publisher || '',
      year: year || '',
      description: description || ''
    });

    // Thông báo cho Fan của tác giả
    await notifyFollowers(author, title).catch(e => console.error("Notify failed:", e));

    return NextResponse.json({
      success: true,
      message: 'Thêm sách thành công',
      id: docRef.id
    }, { status: 201 });
  } catch (error) {
    console.error('Error adding book API:', error);
    return NextResponse.json(
      { error: 'Lỗi hệ thống khi thêm sách' },
      { status: 500 }
    );
  }
}
