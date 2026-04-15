import { NextResponse } from 'next/server';
import { updateMember, deleteMember, getBorrowRecords } from '../../../../services/db';

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

    // Check for active borrow records
    const records = await getBorrowRecords(id);
    const hasActiveRecords = records.some(r => r.status === 'BORROWING' || r.status === 'OVERDUE');

    if (hasActiveRecords) {
      return NextResponse.json(
        { error: 'Không thể xóa độc giả này vì họ đang mượn sách. Vui lòng yêu cầu trả sách trước khi xóa.' },
        { status: 400 }
      );
    }

    await deleteMember(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting member API:', error);
    return NextResponse.json({ error: 'Failed to delete member' }, { status: 500 });
  }
}
