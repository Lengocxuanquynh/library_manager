import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { getUserQuota } from '@/services/db';

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'Thiếu ID người dùng' }, { status: 400 });
    }

    const userRef = doc(db, "users", id);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      return NextResponse.json({ error: 'Không tìm thấy người dùng' }, { status: 404 });
    }

    const userData = userSnap.data();
    const quota = await getUserQuota(id);
    
    // Return relevant fields for dashboard
    return NextResponse.json({
      renewalCount: userData.renewalCount || 0,
      lastOverdueAt: userData.lastOverdueAt || null,
      lastQuotaReset: userData.lastQuotaReset || null,
      isLocked: userData.isLocked || false,
      quota
    });

  } catch (error) {
    console.error('Error fetching user profile API:', error);
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 });
  }
}
