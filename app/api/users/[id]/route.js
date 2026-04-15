import { NextResponse } from 'next/server';
import { updateUserRole } from '../../../../services/db';
import { updateUserProfile } from '../../../../services/auth';

export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { role } = body;

    if (!role) {
      return NextResponse.json({ error: 'Role is required' }, { status: 400 });
    }

    await updateUserRole(id, role);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating user role API:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name } = body;

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    await updateUserProfile(id, { name });
    return NextResponse.json({ success: true, message: 'Cập nhật thành công' });
  } catch (error) {
    console.error('Error updating user profile API:', error);
    return NextResponse.json({ error: 'Lỗi khi cập nhật profile' }, { status: 500 });
  }
}
