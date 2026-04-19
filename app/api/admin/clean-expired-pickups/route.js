import { NextResponse } from 'next/server';
import { doc, collection, getDocs, query, where, updateDoc, increment } from 'firebase/firestore';
import { db } from '@/lib/firebase';

/**
 * POST /api/admin/clean-expired-pickups
 * Quét tất cả phiếu APPROVED_PENDING_PICKUP đã quá pickupDeadline,
 * chuyển trạng thái thành CANCELLED_EXPIRED và hoàn lại số lượng sách về kho.
 */
export async function POST() {
  try {
    const now = new Date();
    const q = query(
      collection(db, 'borrowRecords'),
      where('status', '==', 'APPROVED_PENDING_PICKUP')
    );
    const snapshot = await getDocs(q);

    let cancelledCount = 0;
    const tasks = [];

    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      let pickupDeadline = null;

      // Chuyển đổi pickupDeadline từ Firestore Timestamp hoặc JS Date string
      if (data.pickupDeadline?._seconds) {
        pickupDeadline = new Date(data.pickupDeadline._seconds * 1000);
      } else if (data.pickupDeadline?.seconds) {
        pickupDeadline = new Date(data.pickupDeadline.seconds * 1000);
      } else if (typeof data.pickupDeadline?.toDate === 'function') {
        pickupDeadline = data.pickupDeadline.toDate();
      } else if (data.pickupDeadline) {
        pickupDeadline = new Date(data.pickupDeadline);
      }

      // Nếu chưa có pickupDeadline (phiếu cũ trước khi nâng cấp), bỏ qua
      if (!pickupDeadline) return;

      // Nếu đã quá hạn
      if (pickupDeadline < now) {
        cancelledCount++;
        const recordRef = doc(db, 'borrowRecords', docSnap.id);
        tasks.push(
          updateDoc(recordRef, {
            status: 'CANCELLED_EXPIRED',
            cancelledAt: now,
            cancelReason: 'Quá hạn lấy sách (24 giờ)',
          })
        );

        // Hoàn lại sách vào kho nếu có bookId
        if (data.bookId) {
          const bookRef = doc(db, 'books', data.bookId);
          tasks.push(updateDoc(bookRef, { quantity: increment(1) }));
        }
        // Hoàn lại sách từ mảng books (phiếu batch)
        if (Array.isArray(data.books)) {
          data.books.forEach((b) => {
            if (b.bookId) {
              const bookRef = doc(db, 'books', b.bookId);
              tasks.push(updateDoc(bookRef, { quantity: increment(1) }));
            }
          });
        }
      }
    });

    await Promise.all(tasks);

    return NextResponse.json({
      success: true,
      cancelledCount,
      message: `Đã xử lý ${cancelledCount} phiếu hết hạn.`,
    });
  } catch (error) {
    console.error('Error in clean-expired-pickups:', error);
    return NextResponse.json({ message: 'Lỗi hệ thống khi dọn phiếu hết hạn.' }, { status: 500 });
  }
}
