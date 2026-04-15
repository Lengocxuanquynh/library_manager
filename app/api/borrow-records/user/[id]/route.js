import { NextResponse } from 'next/server';
import { getBorrowRecords } from '../../../../../services/db';

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const records = await getBorrowRecords(id);
    return NextResponse.json(records);
  } catch (error) {
    console.error('Error getting user borrow records API:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
