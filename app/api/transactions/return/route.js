import { NextResponse } from 'next/server';
import { returnBorrowRecord } from '../../../../services/db';

export async function POST(request) {
  try {
    const body = await request.json();
    const { transactionId, bookId } = body;

    if (!transactionId || !bookId) {
      return NextResponse.json(
        { error: 'Missing transactionId or bookId' },
        { status: 400 }
      );
    }

    await returnBorrowRecord(transactionId, bookId);

    return NextResponse.json({
      success: true,
      message: 'Return transaction successful'
    }, { status: 200 });
  } catch (error) {
    console.error('Error processing return API:', error);
    return NextResponse.json(
      { error: 'Internal server error processing return' },
      { status: 500 }
    );
  }
}
