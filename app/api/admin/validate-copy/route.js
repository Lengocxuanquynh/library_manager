import { NextResponse } from 'next/server';
import { getCopyByLabel } from '@/services/db';
import { verifyAdmin } from '@/services/admin-check';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const copyId = searchParams.get('copyId');
    const bookId = searchParams.get('bookId');
    const adminId = searchParams.get('adminId');

    if (!adminId || !copyId) {
      return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
    }

    const isAdmin = await verifyAdmin(adminId);
    if (!isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const copy = await getCopyByLabel(copyId);
    
    if (!copy) {
      return NextResponse.json({ valid: false, message: "Mã sách không tồn tại trong hệ thống." });
    }

    if (bookId && copy.bookId !== bookId) {
      return NextResponse.json({ valid: false, message: "Mã sách này thuộc về một đầu sách khác." });
    }

    if (copy.status !== 'AVAILABLE') {
      return NextResponse.json({ valid: false, message: `Sách đang ở trạng thái "${copy.status}", không thể cho mượn.` });
    }

    return NextResponse.json({ valid: true, copy });
  } catch (error) {
    console.error("Error validating copy:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
