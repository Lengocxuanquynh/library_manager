import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';

export async function POST(request) {
  try {
    const { requestId, userId } = await request.json();

    if (!requestId || !userId) {
      return NextResponse.json({ error: 'Thiếu ID yêu cầu hoặc ID Độc giả' }, { status: 400 });
    }

    const docRef = doc(db, 'borrowRequests', requestId);
    const snap = await getDoc(docRef);

    if (!snap.exists()) {
      return NextResponse.json({ error: 'Không tìm thấy Yêu cầu này' }, { status: 404 });
    }

    const data = snap.data();
    if (data.userId !== userId) {
      return NextResponse.json({ error: 'Bạn không có quyền Hủy yêu cầu của người khác!' }, { status: 403 });
    }

    if (data.status !== 'PENDING') {
      return NextResponse.json({ error: 'Chỉ có thể Hủy các yêu cầu đang chờ duyệt' }, { status: 400 });
    }

    // 2. HOÀN KHO (Vì đơn PENDING đã bị trừ kho ở bước Request)
    const books = data.books || [];
    const { incrementBookStock } = await import('@/services/db');
    
    const bookCounts = {};
    books.forEach(b => {
      bookCounts[b.bookId] = (bookCounts[b.bookId] || 0) + 1;
    });

    for (const [bid, count] of Object.entries(bookCounts)) {
      await incrementBookStock(bid, count).catch(e => console.error("Rollback failed:", e));
    }

    await updateDoc(docRef, { 
      status: 'CANCELLED',
      cancelledAt: new Date()
    });

    return NextResponse.json({ success: true, message: 'Hủy yêu cầu thành công' });
  } catch (error) {
    console.error('Lỗi khi hủy yêu cầu:', error);
    return NextResponse.json({ error: 'Lỗi hệ thống khi hủy yêu cầu' }, { status: 500 });
  }
}
