import { NextResponse } from 'next/server';
import { migrateExistingBooksToCopies } from '@/services/db';

export async function POST(request) {
  try {
    const { adminId } = await request.json();

    if (!adminId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const results = await migrateExistingBooksToCopies();
    
    return NextResponse.json({
      success: true,
      message: `Đã hoàn tất di chuyển dữ liệu.`,
      details: results
    });
  } catch (error) {
    console.error("Migration API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
