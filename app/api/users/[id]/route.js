import { NextResponse } from 'next/server';
import { updateUserRole } from '@/services/db';

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
