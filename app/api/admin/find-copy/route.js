import { NextResponse } from 'next/server';
import { findBorrowRecordByCopyId } from '@/services/db';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const copyId = searchParams.get('copyId');
    const adminId = searchParams.get('adminId');

    if (!adminId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!copyId) {
      return NextResponse.json({ error: "Thiếu mã sách (Copy ID)" }, { status: 400 });
    }

    const result = await findBorrowRecordByCopyId(copyId);
    
    if (!result) {
      return NextResponse.json({ error: "Không tìm thấy thông tin mượn cho mã sách này." }, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error in find-copy API:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
