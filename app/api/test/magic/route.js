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
  limit,
  increment,
  getDoc
} from 'firebase/firestore';
import { sendMail } from '@/services/emailService';
import { createNotification } from '@/services/db';
import { processRecordOverdue } from '@/services/overdueService';

export async function POST(request) {
  try {
    const body = await request.json();
    const { action, userId, isMock } = body;

    const now = new Date();
    const batch = writeBatch(db);

    switch (action) {
      case 'NEAR_DUE': {
        // Tìm đơn mượn mới nhất đang hoạt động - Sửa lại để tránh lỗi Index Firestore
        const q = query(
          collection(db, "borrowRecords"),
          where("userId", "==", userId)
        );
        const snap = await getDocs(q);
        const activeDocs = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(d => ["BORROWING", "PARTIALLY_RETURNED"].includes(d.status))
          .sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));

        if (activeDocs.length === 0) {
          return NextResponse.json({ error: "Không tìm thấy đơn mượn nào để phù phép." }, { status: 404 });
        }
        
        const record = activeDocs[0];
        const recordId = record.id;
        // Set hạn trả thành 1 ngày sau
        const newDueDate = new Date(now.getTime() + (24 * 60 * 60 * 1000));
        await updateDoc(doc(db, "borrowRecords", recordId), {
          dueDate: newDueDate,
          notifiedDueSoon: false // Reset để processRecordOverdue có thể gửi thông báo
        });

        // Kích hoạt logic thật từ service tập trung
        const updatedSnapNear = await getDoc(doc(db, "borrowRecords", recordId));
        await processRecordOverdue(recordId, updatedSnapNear.data(), now);
        break;
      }

      case 'OVERDUE_LIGHT': {
        // Sửa lại để tránh lỗi Index Firestore
        const q = query(
          collection(db, "borrowRecords"),
          where("userId", "==", userId)
        );
        const snap = await getDocs(q);
        const activeDocs = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(d => ["BORROWING", "PARTIALLY_RETURNED", "OVERDUE"].includes(d.status))
          .sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));

        if (activeDocs.length === 0) {
          return NextResponse.json({ error: "Không tìm thấy đơn mượn nào." }, { status: 404 });
        }
        
        const record = activeDocs[0];
        const recordId = record.id;
        const dueDate = record.dueDate?.toDate ? record.dueDate.toDate() : new Date(record.dueDate);
        
        const newDueDate = new Date(now.getTime() - (5 * 24 * 60 * 60 * 1000));
        await updateDoc(doc(db, "borrowRecords", recordId), {
          dueDate: newDueDate,
          status: 'OVERDUE',
          notifiedOverdue: false // Reset để có thể gửi lại
        });

        // Trigger logic thật
        const updatedSnap = await getDoc(doc(db, "borrowRecords", recordId));
        await processRecordOverdue(recordId, updatedSnap.data(), now);
        break;
      }

      case 'OVERDUE_SEVERE': {
        // Sửa lại để tránh lỗi Index Firestore
        const q = query(
          collection(db, "borrowRecords"),
          where("userId", "==", userId)
        );
        const snap = await getDocs(q);
        const activeDocs = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(d => ["BORROWING", "PARTIALLY_RETURNED", "OVERDUE"].includes(d.status))
          .sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));

        if (activeDocs.length === 0) {
          return NextResponse.json({ error: "Không tìm thấy đơn mượn nào." }, { status: 404 });
        }
        
        const record = activeDocs[0];
        const recordId = record.id;
        // Set trễ 15 ngày (Mốc khóa tài khoản)
        const newDueDate = new Date(now.getTime() - (15 * 24 * 60 * 60 * 1000));
        const userSnap = await getDoc(doc(db, "users", userId));
        if (userSnap.exists() && !userSnap.data().isLocked) {
          await updateDoc(doc(db, "users", userId), { isLocked: true });
          await createNotification(userId, "🔒 TÀI KHOẢN ĐÃ BỊ KHÓA", "Tài khoản bạn đã bị khóa, vui lòng đến phòng chăm sóc sinh viên của trường để giải quyết", "error");
        }

        // CHUYỂN TRẠNG THÁI PHIẾU THÀNH 'MẤT/KHÓA'
        const updatedBooks = (record.books || []).map(b => {
          if (b.status === 'BORROWING' || b.status === 'OVERDUE' || b.status === 'APPROVED_PENDING_PICKUP') {
            return { ...b, status: 'LOST_LOCKED' };
          }
          return b;
        });

        await updateDoc(doc(db, "borrowRecords", recordId), {
          dueDate: newDueDate,
          status: 'OVERDUE',
          notifiedOverdue: false,
          notifiedFinal: false,
          notifiedLocked: false
        });

        // Trigger logic thật (sẽ tự động khóa tài khoản vì trễ > 14 ngày)
        const updatedSnapSever = await getDoc(doc(db, "borrowRecords", recordId));
        await processRecordOverdue(recordId, updatedSnapSever.data(), now);
        break;
      }

      case 'APPROVE_LATEST': {
        const q = query(collection(db, "borrowRequests"), where("userId", "==", userId), where("status", "==", "PENDING"));
        const snap = await getDocs(q);
        if (snap.empty) return NextResponse.json({ error: "Không có yêu cầu nào đang chờ duyệt." }, { status: 404 });
        
        const latest = snap.docs.sort((a, b) => (b.data().createdAt?.toMillis() || 0) - (a.data().createdAt?.toMillis() || 0))[0];
        const data = latest.data();
        const requestId = latest.id;
        
        const batch = writeBatch(db);
        batch.update(doc(db, "borrowRequests", requestId), { status: 'APPROVED' });
        
        // TỰ ĐỘNG PICKUP LUÔN
        const borrowDate = new Date();
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 14);
        
        const booksWithStatus = (data.books || []).map(b => ({
          uid: Math.random().toString(36).substring(2, 11) + Date.now(),
          bookId: b.bookId,
          bookTitle: b.bookTitle,
          status: 'BORROWING',
          returnDate: null,
          penaltyAmount: 0
        }));

        const recordRef = doc(collection(db, "borrowRecords"));
        batch.set(recordRef, {
          userId,
          userName: data.userName,
          userEmail: data.userEmail || "",
          books: booksWithStatus,
          status: 'BORROWING',
          borrowDate: serverTimestamp(),
          dueDate: dueDate,
          createdAt: serverTimestamp()
        });

        // Giảm số lượng sách trong kho
        for (const b of data.books || []) {
          batch.update(doc(db, "books", b.bookId), { quantity: increment(-1) });
        }

        await batch.commit();

        const nowStr = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + " " + new Date().toLocaleDateString('vi-VN');
        
        // 1. Thông báo Duyệt
        await createNotification(userId, "✅ Đơn mượn đã được duyệt", "Yêu cầu mượn sách của bạn đã được phê duyệt. Vui lòng đến quầy nhận sách.", "success");
        
        // 2. Thông báo Nhận sách (ngay lập tức vì đã tích hợp nút)
        await createNotification(userId, "📚 Đã lấy sách thành công", `Bạn đã nhận sách thành công vào lúc ${nowStr}. Chúc bạn đọc sách vui vẻ!`, "success");
        break;
      }

      case 'PICKUP_LATEST': {
        const q = query(collection(db, "borrowRecords"), where("userId", "==", userId), where("status", "==", "APPROVED_PENDING_PICKUP"));
        const snap = await getDocs(q);
        if (snap.empty) return NextResponse.json({ error: "Không có đơn nào đang chờ nhận sách." }, { status: 404 });

        const latest = snap.docs.sort((a, b) => (b.data().createdAt?.toMillis() || 0) - (a.data().createdAt?.toMillis() || 0))[0];
        const data = latest.data();
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 14);

        const updatedBooks = (data.books || []).map(b => ({ ...b, status: 'BORROWING' }));
        
        await updateDoc(doc(db, "borrowRecords", latest.id), {
          status: 'BORROWING',
          borrowDate: serverTimestamp(),
          dueDate: dueDate,
          books: updatedBooks
        });

        // Giảm số lượng sách trong kho
        for (const b of data.books || []) {
          await updateDoc(doc(db, "books", b.bookId), { quantity: increment(-1) });
        }

        const nowStr = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + " " + new Date().toLocaleDateString('vi-VN');
        await createNotification(userId, "📚 Đã nhận sách thành công", `Bạn đã nhận sách thành công vào lúc ${nowStr}. Chúc bạn đọc sách vui vẻ!`, "success");
        break;
      }

      case 'RETURN_LATEST': {
        const q = query(collection(db, "borrowRecords"), where("userId", "==", userId));
        const snap = await getDocs(q);
        const activeDocs = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(d => ['BORROWING', 'OVERDUE', 'PARTIALLY_RETURNED'].includes(d.status))
          .sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));

        if (activeDocs.length === 0) return NextResponse.json({ error: "Không có đơn nào đang mượn để trả." }, { status: 404 });

        const record = activeDocs[0];
        const updatedBooks = (record.books || []).map(b => ({
          ...b,
          status: 'RETURNED',
          actualReturnDate: new Date()
        }));

        await updateDoc(doc(db, "borrowRecords", record.id), {
          status: 'RETURNED',
          books: updatedBooks
        });

        // Tăng số lượng sách trong kho
        for (const b of record.books || []) {
          await updateDoc(doc(db, "books", b.bookId), { quantity: increment(1) });
        }

        await createNotification(userId, "✨ Đã trả sách thành công", "Cảm ơn bạn đã hoàn trả sách đúng hạn!", "success");
        break;
      }

      case 'RESET_USER': {
        const batch = writeBatch(db);
        
        // 1. Xóa Borrow Records
        const qRecords = query(collection(db, "borrowRecords"), where("userId", "==", userId));
        const snapRecords = await getDocs(qRecords);
        snapRecords.forEach(d => batch.delete(d.ref));

        // 2. Xóa Borrow Requests
        const qReqs = query(collection(db, "borrowRequests"), where("userId", "==", userId));
        const snapReqs = await getDocs(qReqs);
        snapReqs.forEach(d => batch.delete(d.ref));

        // 3. Xóa Notifications
        const qNotis = query(collection(db, "notifications"), where("userId", "==", userId));
        const snapNotis = await getDocs(qNotis);
        snapNotis.forEach(d => batch.delete(d.ref));

        // 4. Reset User Meta
        batch.update(doc(db, "users", userId), {
          renewalCount: 0,
          lastOverdueAt: null,
          isLocked: false
        });

        await batch.commit();
        break;
      }

      case 'JUMP_3_MONTHS': {
        const userRef = doc(db, "users", userId);
        const threeMonthsAgo = new Date(now.getTime() - (91 * 24 * 60 * 60 * 1000));
        await updateDoc(userRef, {
          lastQuotaReset: threeMonthsAgo,
          lastOverdueAt: threeMonthsAgo
        });

        // Kiểm tra xem có đơn quá hạn nào không và User CHƯA bị khóa
        const qRecords = query(collection(db, "borrowRecords"), where("userId", "==", userId), where("status", "==", "OVERDUE"));
        const snapRecords = await getDocs(qRecords);
        const userSnap = await getDoc(userRef);
        const isAlreadyLocked = userSnap.exists() && userSnap.data().isLocked;

        if (!snapRecords.empty) {
          if (!isAlreadyLocked) {
            await updateDoc(userRef, { isLocked: true });
            await createNotification(userId, "🔒 Tài khoản đã bị khóa", "Tài khoản bạn đã bị khóa, vui lòng đến phòng chăm sóc sinh viên của trường để giải quyết", "error");
          }

          // Chuyển toàn bộ các phiếu đã quá hạn thành LOST_LOCKED
          for (const d of snapRecords.docs) {
            const rData = d.data();
            const uBooks = (rData.books || []).map(b => (b.status === 'OVERDUE' || b.status === 'BORROWING') ? { ...b, status: 'LOST_LOCKED' } : b);
            await updateDoc(d.ref, { status: 'LOST_LOCKED', notifiedLocked: true, books: uBooks });
          }
        }
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

      case 'ADJUST_DATE': {
        const { days } = body;
        const q = query(collection(db, "borrowRecords"), where("userId", "==", userId));
        const snap = await getDocs(q);
        const activeDocs = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(d => ["BORROWING", "PARTIALLY_RETURNED", "OVERDUE"].includes(d.status))
          .sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));

        if (activeDocs.length === 0) return NextResponse.json({ error: "Không tìm thấy đơn mượn để điều chỉnh." }, { status: 404 });
        
        const record = activeDocs[0];
        const currentDueDate = record.dueDate?.toDate ? record.dueDate.toDate() : new Date(record.dueDate);
        const newDueDate = new Date(currentDueDate.getTime() + (days * 24 * 60 * 60 * 1000));
        
        const updates = { dueDate: newDueDate };
        // Tự động cập nhật status nếu ngày mới biến nó thành quá hạn/hết quá hạn
        if (newDueDate < now && record.status === 'BORROWING') updates.status = 'OVERDUE';
        if (newDueDate >= now && record.status === 'OVERDUE') updates.status = 'BORROWING';

        await updateDoc(doc(db, "borrowRecords", record.id), updates);
        
        // TRIGGER THÔNG BÁO (Hệ thống sẽ chỉ bắn nếu chưa từng thông báo cho phiếu này)
        const updatedSnapAdjust = await getDoc(doc(db, "borrowRecords", record.id));
        await processRecordOverdue(record.id, updatedSnapAdjust.data(), now);
        break;
      }

      case 'GET_LATEST_STATUS': {
        const q = query(collection(db, "borrowRecords"), where("userId", "==", userId));
        const snap = await getDocs(q);
        const activeDocs = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(d => ["BORROWING", "PARTIALLY_RETURNED", "OVERDUE"].includes(d.status))
          .sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));

        if (activeDocs.length === 0) return NextResponse.json({ status: "No Active Record" });
        
        const record = activeDocs[0];
        const dueDate = record.dueDate?.toDate ? record.dueDate.toDate() : new Date(record.dueDate);
        
        return NextResponse.json({ 
          success: true, 
          recordId: record.id,
          dueDate: dueDate.toISOString(),
          status: record.status,
          now: now.toISOString()
        });
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
