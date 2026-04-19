import { NextResponse } from 'next/server';
import { getBook, updateBook, deleteBook, ensureCategoryExists, ensureAuthorExists } from '../../../../services/db';

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const book = await getBook(id);
    if (!book) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(book);
  } catch (error) {
    console.error('Error getting book API:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    if (body.category) await ensureCategoryExists(body.category);
    if (body.author) await ensureAuthorExists(body.author);
    await updateBook(id, body);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating book API:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    
    // Safety check: Prevent deleting if currently borrowed or requested
    const { countActiveBookUsage } = await import('../../../../services/db');
    const usageCount = await countActiveBookUsage(id);
    
    if (usageCount > 0) {
      return NextResponse.json({ 
        success: false, 
        error: `Không thể xóa: Cuốn sách này đang có ${usageCount} phiếu mượn hoạt động hoặc yêu cầu chờ duyệt.` 
      }, { status: 400 });
    }

    await deleteBook(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting book API:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
