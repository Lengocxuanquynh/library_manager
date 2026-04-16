import { NextResponse } from 'next/server';
import { db } from '../../../../lib/firebase';
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

    await updateDoc(docRef, { status: 'CANCELLED' });

    return NextResponse.json({ success: true, message: 'Hủy yêu cầu thành công' });
  } catch (error) {
    console.error('Lỗi khi hủy yêu cầu:', error);
    return NextResponse.json({ error: 'Lỗi hệ thống khi hủy yêu cầu' }, { status: 500 });
  }
}
