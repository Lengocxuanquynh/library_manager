import { NextResponse } from 'next/server';
import { addCategory, getCategories } from '@/services/db';

export async function GET() {
  try {
    const categories = await getCategories();
    return NextResponse.json(categories);
  } catch (error) {
    console.error('Error listing categories API:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { name, description } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'Tên thể loại là bắt buộc' },
        { status: 400 }
      );
    }

    const docRef = await addCategory({
      name,
      description: description || ''
    });

    return NextResponse.json({
      success: true,
      id: docRef.id
    }, { status: 201 });
  } catch (error) {
    console.error('Error adding category API:', error);
    return NextResponse.json(
      { error: 'Lỗi hệ thống' },
      { status: 500 }
    );
  }
}
