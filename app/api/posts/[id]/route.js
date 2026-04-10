import { NextResponse } from 'next/server';
import { updatePost, deletePost } from '@/services/db';

export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    
    await updatePost(id, body);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating post API:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    await deletePost(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting post API:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
