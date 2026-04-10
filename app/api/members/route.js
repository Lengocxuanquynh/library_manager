import { NextResponse } from 'next/server';
import { addMember, getMembers } from '@/services/db';

export async function GET() {
  try {
    const members = await getMembers();
    return NextResponse.json(members);
  } catch (error) {
    console.error('Error listing members API:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { name, email, phone } = body;

    if (!name || !email) {
      return NextResponse.json(
        { error: 'Họ tên và email là bắt buộc' },
        { status: 400 }
      );
    }

    const docRef = await addMember({
      name,
      email,
      phone: phone || ''
    });

    return NextResponse.json({
      success: true,
      message: 'Thêm hội viên thành công',
      id: docRef.id
    }, { status: 201 });
  } catch (error) {
    console.error('Error adding member API:', error);
    return NextResponse.json(
      { error: 'Lỗi hệ thống khi thêm hội viên' },
      { status: 500 }
    );
  }
}
