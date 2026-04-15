import { NextResponse } from 'next/server';
import { getBorrowRequests } from '../../../../services/db';
import { verifyAdmin } from '../../../../services/admin-check';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const adminId = searchParams.get('adminId');

    if (!adminId) {
      return NextResponse.json({ error: 'Thiếu adminId' }, { status: 401 });
    }

    const isAdmin = await verifyAdmin(adminId);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const requests = await getBorrowRequests(status);
    return NextResponse.json(requests);
  } catch (error) {
    console.error('Error listing borrow requests API:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
