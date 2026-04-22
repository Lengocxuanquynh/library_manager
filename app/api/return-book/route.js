import { NextResponse } from 'next/server';
import { returnBorrowRecord } from '@/services/db';

export async function POST(request) {
  try {
    const body = await request.json();
    const { recordId, bookUid, returnNote, penaltyAmount, isLost, damageFee, isDamaged } = body;

    console.log(">>> [SERVER] API /api/return-book started with:", { recordId, bookUid, returnNote, penaltyAmount, isLost, damageFee, isDamaged });

    if (!recordId || !bookUid) {
      return NextResponse.json(
        { message: 'Thiếu thông tin phiếu mượn hoặc mã định danh sách (UID).' },
        { status: 400 }
      );
    }

    // Process the return logic
    await returnBorrowRecord(recordId, bookUid, returnNote, penaltyAmount, isLost, damageFee, isDamaged);

    return NextResponse.json({
      success: true,
      message: 'Xác nhận trả sách thành công.'
    }, { status: 200 });

  } catch (error) {
    console.error(">>> [CRITICAL] Lỗi API return-book:", error);
    // Ensure we ALWAYS return JSON
    return NextResponse.json(
      { message: error.message || 'Lỗi hệ thống không xác định tại API trả sách' },
      { status: 500 }
    );
  }
}
