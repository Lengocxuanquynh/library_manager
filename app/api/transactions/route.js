import { NextResponse } from 'next/server';
import { getTransactions } from '../../../services/db';

export async function GET() {
  try {
    const transactions = await getTransactions();
    return NextResponse.json(transactions);
  } catch (error) {
    console.error('Error listing transactions API:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
