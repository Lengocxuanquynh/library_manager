import { NextResponse } from 'next/server';
import { processBorrow } from '../../../../services/db';

export async function POST(request) {
  try {
    const body = await request.json();
    const { bookId, memberId, memberName, bookTitle } = body;

    if (!bookId || !memberId || !memberName || !bookTitle) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    const transaction = await processBorrow(bookId, memberId, memberName, bookTitle);

    return NextResponse.json({
      success: true,
      message: 'Borrow transaction successful',
      transactionId: transaction.id
    }, { status: 201 });
  } catch (error) {
    console.error('Error processing borrow API:', error);
    return NextResponse.json(
      { error: 'Internal server error processing borrow' },
      { status: 500 }
    );
  }
}
