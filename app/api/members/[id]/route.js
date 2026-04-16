import { NextResponse } from 'next/server';
import { updateMember, deleteMember, getBorrowRecords } from '../../../../services/db';
import { adminAuth, adminDb } from '../../../../lib/firebase-admin';

export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name } = body;

    // 1. Lấy thông tin UID của độc giả từ Document ID
    const memberRef = adminDb.collection('members').doc(id);
    const memberSnap = await memberRef.get();
    
    if (!memberSnap.exists) {
      return NextResponse.json({ error: 'Không tìm thấy độc giả' }, { status: 404 });
    }
    
    const memberData = memberSnap.data();
    const uid = memberData.uid;

    // 2. Chạy cập nhật Firestore Member trước
    await updateMember(id, body);

    // 3. Nếu có đổi tên, tiến hành đồng bộ hóa đa tầng
    if (name && name !== memberData.name) {
      console.log(`>>> Sycing name change: "${memberData.name}" -> "${name}" for UID: ${uid}`);
      
      const syncPromises = [];

      // A. Cập nhật Firebase Auth Display Name
      if (uid && adminAuth) {
        syncPromises.push(adminAuth.updateUser(uid, { displayName: name }));
      }

      // B. Cập nhật borrowRequests (Tên người mượn trong các phiếu đang chờ)
      if (uid) {
        const requestsSnap = await adminDb.collection('borrowRequests').where('userId', '==', uid).get();
        requestsSnap.forEach(doc => {
          syncPromises.push(doc.ref.update({ userName: name }));
        });
      }

      // C. Cập nhật borrowRecords (Tên người mượn trong lịch sử/đang mượn)
      if (uid) {
        const recordsSnap = await adminDb.collection('borrowRecords').where('userId', '==', uid).get();
        recordsSnap.forEach(doc => {
          syncPromises.push(doc.ref.update({ userName: name }));
        });
      }

      // D. Cập nhật bộ sưu tập users (Tài khoản người dùng)
      if (uid) {
        const usersSnap = await adminDb.collection('users').where('uid', '==', uid).get();
        usersSnap.forEach(doc => {
          syncPromises.push(doc.ref.update({ name: name }));
        });
      }

      // Đợi tất cả hoàn tất
      await Promise.all(syncPromises);
      console.log(`>>> Name sync completed for ${uid}`);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating and syncing member API:', error);
    return NextResponse.json({ error: 'Failed', details: error.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;

    // Check for active borrow records
    const records = await getBorrowRecords(id);
    const hasActiveRecords = records.some(r => r.status === 'BORROWING' || r.status === 'OVERDUE');

    if (hasActiveRecords) {
      return NextResponse.json(
        { error: 'Không thể xóa độc giả này vì họ đang mượn sách. Vui lòng yêu cầu trả sách trước khi xóa.' },
        { status: 400 }
      );
    }

    await deleteMember(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting member API:', error);
    return NextResponse.json({ error: 'Failed to delete member' }, { status: 500 });
  }
}
