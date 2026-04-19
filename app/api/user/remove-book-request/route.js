import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';

export async function POST(request) {
  try {
    const { requestId, userId, bookId } = await request.json();

    if (!requestId || !userId || !bookId) {
      return NextResponse.json({ error: 'Thiếu tham số bắt buộc' }, { status: 400 });
    }

    const docRef = doc(db, 'borrowRequests', requestId);
    const snap = await getDoc(docRef);

    if (!snap.exists()) {
      return NextResponse.json({ error: 'Không tìm thấy Yêu cầu này' }, { status: 404 });
    }

    const data = snap.data();
    if (data.userId !== userId) {
      return NextResponse.json({ error: 'Không đủ quyền truy cập' }, { status: 403 });
    }

    if (data.status !== 'PENDING') {
      return NextResponse.json({ error: 'Chỉ có thể thay đổi đơn đang chờ duyệt' }, { status: 400 });
    }

    const currentBooks = data.books || [];
    const indexToRemove = currentBooks.findIndex(b => b.bookId === bookId);

    if (indexToRemove === -1) {
      return NextResponse.json({ error: 'Cuốn sách này không có trong yêu cầu' }, { status: 400 });
    }

    // Chỉ xóa 1 cuốn duy nhất
    currentBooks.splice(indexToRemove, 1);
    const filteredBooks = [...currentBooks];

    if (filteredBooks.length === 0) {
      // Hết sách, hủy luôn yêu cầu
      await updateDoc(docRef, { status: 'CANCELLED', books: [] });
      return NextResponse.json({ success: true, message: 'Đã xóa cuốn cuối cùng. Đơn tự động hủy.', action: 'CANCELLED' });
    } else {
      // Cập nhật lại list sách
      await updateDoc(docRef, { books: filteredBooks });
      return NextResponse.json({ success: true, message: 'Đã bỏ sách khỏi yêu cầu', action: 'REMOVED' });
    }
  } catch (error) {
    console.error('Lỗi khi rút sách khỏi đơn:', error);
    return NextResponse.json({ error: 'Lỗi hệ thống' }, { status: 500 });
  }
}
