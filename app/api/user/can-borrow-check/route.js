import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { canUserBorrow } from '@/services/db';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const cartSize = parseInt(searchParams.get('cartSize') || '0');

    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

    // 1. Kiểm tra quyền mượn cơ bản (Lock, Overdue, active loans)
    const status = await canUserBorrow(userId);
    if (!status.canBorrow) {
      return NextResponse.json({ canAdd: false, reason: status.reason });
    }

    // 2. Kiểm tra số lượng sách chờ duyệt (Pending) để tính toán limit 3 cuốn
    const qPending = query(
      collection(db, "borrowRequests"), 
      where("userId", "==", userId), 
      where("status", "==", "PENDING")
    );
    const pendingSnap = await getDocs(qPending);
    
    let pendingCount = 0;
    if (!pendingSnap.empty) {
      const data = pendingSnap.docs[0].data();
      pendingCount = (data.books || []).length;
    }

    // Limit tổng cộng: Pending + Cart + New Item (1) <= 3
    if (pendingCount + cartSize + 1 > 3) {
      return NextResponse.json({ 
        canAdd: false, 
        reason: `Giỏ hàng bị đầy! Bạn đang có ${pendingCount} cuốn chờ duyệt. Tối đa chỉ được mượn 3 cuốn tổng cộng.` 
      });
    }

    return NextResponse.json({ canAdd: true });
  } catch (error) {
    console.error('Error in can-borrow-check API:', error);
    return NextResponse.json({ error: 'Lỗi hệ thống khi kiểm tra hạn ngạch.' }, { status: 500 });
  }
}
