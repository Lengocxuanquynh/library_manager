import { NextResponse } from 'next/server';
import { getBorrowRequests } from '../../../../../services/db';

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    // status=null (fetch all statuses), userId=id
    const requests = await getBorrowRequests(null, id);
    return NextResponse.json(requests);
  } catch (error) {
    console.error('Error getting user borrow requests API:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
