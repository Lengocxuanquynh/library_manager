import { NextResponse } from 'next/server';
import { getBorrowRecords } from '@/services/db';
import { verifyAdmin } from '@/services/admin-check';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const adminId = searchParams.get('adminId');

    if (!adminId) {
      return NextResponse.json({ error: 'Missing admin credentials' }, { status: 401 });
    }

    const isAdmin = await verifyAdmin(adminId);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Passing null to userId fetch all records for admin
    const records = await getBorrowRecords(null);
    return NextResponse.json(records);
  } catch (error) {
    console.error('Error listing all borrow records API:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
