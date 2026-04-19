import { NextResponse } from 'next/server';
import { getUserTransactions } from '@/services/db';

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const transactions = await getUserTransactions(id);
    return NextResponse.json(transactions);
  } catch (error) {
    console.error('Error getting user transactions API:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
