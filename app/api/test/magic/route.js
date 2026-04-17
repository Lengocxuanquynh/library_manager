import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  updateDoc, 
  serverTimestamp, 
  writeBatch,
  orderBy,
  limit
} from 'firebase/firestore';

export async function POST(request) {
  try {
    const body = await request.json();
    const { action, userId, adminId } = body;

    const now = new Date();
    const batch = writeBatch(db);

    switch (action) {
      case 'NEAR_DUE': {
        // Tìm đơn mượn mới nhất đang hoạt động
        const q = query(
          collection(db, "borrowRecords"),
          where("userId", "==", userId),
          where("status", "in", ["BORROWING", "PARTIALLY_RETURNED"]),
          orderBy("createdAt", "desc"),
          limit(1)
        );
        const snap = await getDocs(q);
        if (snap.empty) return NextResponse.json({ error: "Không tìm thấy đơn mượn nào để phù phép." }, { status: 404 });
        
        const recordId = snap.docs[0].id;
        // Set hạn trả thành 1 ngày sau
        const newDueDate = new Date(now.getTime() + (24 * 60 * 60 * 1000));
        await updateDoc(doc(db, "borrowRecords", recordId), {
          dueDate: newDueDate,
          notifiedDueSoon: false,
          notifiedOverdue: false
        });
        break;
      }

      case 'OVERDUE_LIGHT': {
        const q = query(
          collection(db, "borrowRecords"),
          where("userId", "==", userId),
          where("status", "in", ["BORROWING", "PARTIALLY_RETURNED", "OVERDUE"]),
          orderBy("createdAt", "desc"),
          limit(1)
        );
        const snap = await getDocs(q);
        if (snap.empty) return NextResponse.json({ error: "Không tìm thấy đơn mượn nào." }, { status: 404 });
        
        const recordId = snap.docs[0].id;
        // Set trễ 5 ngày
        const newDueDate = new Date(now.getTime() - (5 * 24 * 60 * 60 * 1000));
        await updateDoc(doc(db, "borrowRecords", recordId), {
          dueDate: newDueDate,
          status: 'OVERDUE',
          notifiedOverdue: false,
          notifiedFinal: false
        });
        break;
      }

      case 'OVERDUE_SEVERE': {
        const q = query(
          collection(db, "borrowRecords"),
          where("userId", "==", userId),
          where("status", "in", ["BORROWING", "PARTIALLY_RETURNED", "OVERDUE"]),
          orderBy("createdAt", "desc"),
          limit(1)
        );
        const snap = await getDocs(q);
        if (snap.empty) return NextResponse.json({ error: "Không tìm thấy đơn mượn nào." }, { status: 404 });
        
        const recordId = snap.docs[0].id;
        // Set trễ 15 ngày (Mốc khóa tài khoản)
        const newDueDate = new Date(now.getTime() - (15 * 24 * 60 * 60 * 1000));
        await updateDoc(doc(db, "borrowRecords", recordId), {
          dueDate: newDueDate,
          status: 'OVERDUE',
          notifiedOverdue: true,
          notifiedFinal: false
        });
        break;
      }

      case 'JUMP_3_MONTHS': {
        const userRef = doc(db, "users", userId);
        const threeMonthsAgo = new Date(now.getTime() - (91 * 24 * 60 * 60 * 1000));
        await updateDoc(userRef, {
          lastQuotaReset: threeMonthsAgo,
          lastOverdueAt: threeMonthsAgo
        });
        break;
      }

      case 'HEAL_USER': {
        const userRef = doc(db, "users", userId);
        await updateDoc(userRef, {
          isLocked: false,
          lastOverdueAt: null,
          renewalCount: 0, // Hồi đủ 3 lượt
          lastQuotaReset: serverTimestamp()
        });
        break;
      }

      case 'WARP_ALL_OVERDUE': {
        const q = query(
          collection(db, "borrowRecords"),
          where("status", "in", ["BORROWING", "PARTIALLY_RETURNED"])
        );
        const snap = await getDocs(q);
        const overdueDate = new Date(now.getTime() - (20 * 24 * 60 * 60 * 1000));
        
        const warpBatch = writeBatch(db);
        snap.docs.forEach(d => {
          warpBatch.update(d.ref, { 
            dueDate: overdueDate,
            status: 'OVERDUE',
            notifiedOverdue: true
          });
        });
        await warpBatch.commit();
        break;
      }

      case 'WIPE_RECORDS': {
        const q = query(collection(db, "borrowRecords"));
        const snap = await getDocs(q);
        const wipeBatch = writeBatch(db);
        snap.docs.forEach(d => wipeBatch.delete(d.ref));
        await wipeBatch.commit();
        break;
      }

      case 'SPAWN_MOCK': {
        const mockBooks = [
          { title: "Dế Mèn Phiêu Lưu Ký", author: "Tô Hoài", category: "Văn học Việt Nam", quantity: 5, status: "available", createdAt: serverTimestamp() },
          { title: "Đất Rừng Phương Nam", author: "Đoàn Giỏi", category: "Văn học Việt Nam", quantity: 3, status: "available", createdAt: serverTimestamp() },
          { title: "Lão Hạc", author: "Nam Cao", category: "Văn học Việt Nam", quantity: 10, status: "available", createdAt: serverTimestamp() },
          { title: "Clean Code", author: "Robert C. Martin", category: "Công nghệ", quantity: 2, status: "available", createdAt: serverTimestamp() },
          { title: "The Pragmatic Programmer", author: "Andrew Hunt", category: "Công nghệ", quantity: 4, status: "available", createdAt: serverTimestamp() }
        ];
        
        const spawnBatch = writeBatch(db);
        mockBooks.forEach(book => {
          const newBookRef = doc(collection(db, "books"));
          spawnBatch.set(newBookRef, book);
        });
        await spawnBatch.commit();
        break;
      }

      default:
        return NextResponse.json({ error: "Hành động không hợp lệ" }, { status: 400 });
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Magic API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
