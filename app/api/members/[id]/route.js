import { NextResponse } from 'next/server';
import { updateMember, deleteMember } from '@/services/db';

export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    await updateMember(id, body);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating member API:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    await deleteMember(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting member API:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
