import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  increment,
  writeBatch
} from "firebase/firestore";
import { db } from "../lib/firebase";

// Helper for getting collection data
const getCollectionData = async (colRef) => {
  const snapshot = await getDocs(colRef);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

// ========================
// BOOKS
// ========================

export const getBooks = async () => {
  const q = query(collection(db, "books"), orderBy("title"));
  return await getCollectionData(q);
};

export const getBook = async (id) => {
  const docRef = doc(db, "books", id);
  const snap = await getDoc(docRef);
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};

export const addBook = async (data) => {
  return await addDoc(collection(db, "books"), data);
};

export const updateBook = async (id, data) => {
  const docRef = doc(db, "books", id);
  return await updateDoc(docRef, data);
};

export const deleteBook = async (id) => {
  const docRef = doc(db, "books", id);
  return await deleteDoc(docRef);
};

export const countActiveBookUsage = async (bookId) => {
  // 1. Check PENDING borrow requests
  const qRequests = query(
    collection(db, "borrowRequests"),
    where("bookId", "==", bookId),
    where("status", "==", "PENDING")
  );
  const snapRequests = await getDocs(qRequests);
  
  // 2. Check active borrow records
  const qRecords = query(
    collection(db, "borrowRecords"),
    where("status", "in", ["BORROWING", "OVERDUE", "PARTIALLY_RETURNED", "APPROVED_PENDING_PICKUP", "PARTIALLY_PICKED_UP"])
  );
  const snapRecords = await getDocs(qRecords);
  let activeInRecords = 0;
  snapRecords.forEach(doc => {
    const data = doc.data();
    const hasActiveBook = (data.books || []).some(b => 
      b.bookId === bookId && !['RETURNED', 'RETURNED_OVERDUE', 'LOST'].includes(b.status)
    );
    if (hasActiveBook) activeInRecords++;
  });

  return snapRequests.size + activeInRecords;
};

// ========================
// MEMBERS
// ========================
export const getMembers = async () => {
  const q = query(collection(db, "members"), orderBy("name"));
  return await getCollectionData(q);
};

export const addMember = async (data) => {
  return await addDoc(collection(db, "members"), data);
};

export const updateMember = async (id, data) => {
  const docRef = doc(db, "members", id);
  return await updateDoc(docRef, data);
};

export const deleteMember = async (id) => {
  const docRef = doc(db, "members", id);
  return await deleteDoc(docRef);
};

// ========================
// TRANSACTIONS
// ========================
export const getTransactions = async () => {
  const q = query(collection(db, "transactions"), orderBy("borrowDate", "desc"));
  return await getCollectionData(q);
};

export const getUserTransactions = async (userId) => {
  // Use plain query to avoid Firebase composite index requirements, then sort in JS
  const q = query(collection(db, "transactions"), where("memberId", "==", userId));
  const data = await getCollectionData(q);
  return data.sort((a, b) => (b.borrowDate?.toMillis() || 0) - (a.borrowDate?.toMillis() || 0));
};

export const addTransaction = async (data) => {
  return await addDoc(collection(db, "transactions"), {
    ...data,
    borrowDate: data.borrowDate || serverTimestamp()
  });
};

export const updateTransaction = async (id, data) => {
  const docRef = doc(db, "transactions", id);
  return await updateDoc(docRef, data);
};

export const processBorrow = async (bookId, memberId, memberName, bookTitle) => {
  const bookRef = doc(db, "books", bookId);
  await updateDoc(bookRef, { status: 'Borrowed' });

  return await addDoc(collection(db, "transactions"), {
    bookId,
    bookTitle,
    memberId,
    memberName,
    status: 'Active',
    borrowDate: serverTimestamp(),
    returnDate: null
  });
};

// ========================
// POSTS (BLOG)
// ========================
export const getPosts = async () => {
  const q = query(collection(db, "posts"), orderBy("createdAt", "desc"));
  return await getCollectionData(q);
};

export const getPostBySlug = async (slug) => {
  const q = query(collection(db, "posts"), where("slug", "==", slug));
  const snap = await getDocs(q);
  if (!snap.empty) {
    return { id: snap.docs[0].id, ...snap.docs[0].data() };
  }
  return null;
};

export const addPost = async (data) => {
  return await addDoc(collection(db, "posts"), {
    ...data,
    createdAt: serverTimestamp()
  });
};

export const updatePost = async (id, data) => {
  const docRef = doc(db, "posts", id);
  return await updateDoc(docRef, data);
};

export const deletePost = async (id) => {
  const docRef = doc(db, "posts", id);
  return await deleteDoc(docRef);
};

// ========================
// BORROW REQUESTS
// ========================
export const getBorrowRequests = async (status = null, userId = null) => {
  let q = collection(db, "borrowRequests");
  const constraints = [];
  if (status) constraints.push(where("status", "==", status));
  if (userId) constraints.push(where("userId", "==", userId));

  if (constraints.length > 0) {
    q = query(q, ...constraints);
  }

  const data = await getCollectionData(q);
  return data.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
};

export const createBorrowRequest = async (userId, bookId, userName, bookTitle) => {
  return await addDoc(collection(db, "borrowRequests"), {
    userId,
    bookId,
    userName,
    bookTitle,
    status: 'PENDING',
    createdAt: serverTimestamp()
  });
};

export const updateBorrowRequestStatus = async (requestId, status) => {
  const docRef = doc(db, "borrowRequests", requestId);
  return await updateDoc(docRef, { status });
};

// ========================
// BORROW RECORDS
// ========================
export const getBorrowRecord = async (recordId) => {
  const docRef = doc(db, "borrowRecords", recordId);
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) return null;
  return { id: docSnap.id, ...docSnap.data() };
};

export const getBorrowRecords = async (userId = null) => {
  if (userId) {
    await syncUserQuotas(userId).catch(err => console.error("Passive sync in getBorrowRecords failed:", err));
  }
  let q = collection(db, "borrowRecords");
  if (userId) {
    q = query(q, where("userId", "==", userId));
  }
  const data = await getCollectionData(q);

  // Enhance data with dynamic status (OVERDUE check)
  const now = new Date();
  return data.map(record => {
    let currentStatus = record.status;
    let books = record.books || [];

    // Fallback for legacy flat records
    if (books.length === 0 && record.bookId) {
      books = [{
        bookId: record.bookId,
        bookTitle: record.bookTitle,
        status: record.status,
        borrowDate: record.borrowDate,
        dueDate: record.dueDate,
        returnDate: record.returnDate
      }];
    }

    // Convert dueDate to JS Date for comparison
    let dueDate = null;
    const recordDueDate = record.dueDate;
    if (recordDueDate?._seconds) dueDate = new Date(recordDueDate._seconds * 1000);
    else if (recordDueDate?.seconds) dueDate = new Date(recordDueDate.seconds * 1000);
    else if (typeof recordDueDate?.toDate === 'function') dueDate = recordDueDate.toDate();
    else if (recordDueDate) dueDate = new Date(recordDueDate);

    // If active and past due date, mark as OVERDUE
    const isActive = (currentStatus === 'BORROWING' || currentStatus === 'Active' || currentStatus === 'PARTIALLY_RETURNED');
    if (isActive && dueDate && dueDate < now) {
      currentStatus = 'OVERDUE';
    }

    return { ...record, books, status: currentStatus };
  }).sort((a, b) => {
    // Ưu tiên xếp theo createdAt desc để đơn mới duyệt luôn lên đầu
    const timeA = a.createdAt?.toMillis() || a.borrowDate?.toMillis() || 0;
    const timeB = b.createdAt?.toMillis() || b.borrowDate?.toMillis() || 0;
    return timeB - timeA;
  });
};

export const createBorrowRecord = async (userId, userName, books, customBorrowDate = null, customDueDate = null, autoDecrement = true, borrowerPhone = "", userEmail = "") => {
  const borrowDateObj = customBorrowDate ? new Date(customBorrowDate) : new Date();
  const dueDateObj = customDueDate ? new Date(customDueDate) : new Date(borrowDateObj);

  if (!customDueDate) {
    dueDateObj.setDate(dueDateObj.getDate() + 14); // Default 14 days
  }

  const initialStatus = autoDecrement ? 'BORROWING' : 'APPROVED_PENDING_PICKUP';

  // Process all books with unique record IDs
  const booksWithStatus = books.map(b => ({
    uid: Math.random().toString(36).substring(2, 11) + Date.now(), // Unique identifier for THIS borrowing instance
    bookId: b.bookId,
    bookTitle: b.bookTitle,
    status: initialStatus,
    returnDate: null,
    penaltyAmount: 0
  }));

  if (autoDecrement) {
    // Decrement quantities atomically
    for (const b of books) {
      const bookRef = doc(db, "books", b.bookId);
      await updateDoc(bookRef, {
        quantity: increment(-1)
      });
    }
  }

  return await addDoc(collection(db, "borrowRecords"), {
    userId,
    userName,
    userEmail: userEmail || "",
    books: booksWithStatus,
    borrowerPhone: borrowerPhone || "",
    borrowDate: autoDecrement ? (customBorrowDate ? borrowDateObj : serverTimestamp()) : null,
    dueDate: autoDecrement ? dueDateObj : null,
    status: initialStatus,
    createdAt: serverTimestamp()
  });
};

export const confirmBorrowPickup = async (recordId) => {
  const recordRef = doc(db, "borrowRecords", recordId);
  const recordSnap = await getDoc(recordRef);
  
  if (!recordSnap.exists()) return;
  const data = recordSnap.data();

  const dueDateObj = new Date();
  dueDateObj.setDate(dueDateObj.getDate() + 14);

  // Update all books status
  const updatedBooks = (data.books || []).map(b => ({
    ...b,
    status: 'BORROWING'
  }));

  await updateDoc(recordRef, {
    status: 'BORROWING',
    pickupDate: serverTimestamp(),
    borrowDate: serverTimestamp(),
    dueDate: dueDateObj,
    books: updatedBooks
  });

  // Tạo thông báo cho Độc giả
  const nowStr = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + " " + new Date().toLocaleDateString('vi-VN');
  await createNotification(
    data.userId,
    "📚 Sách đã được nhận thành công",
    `Bạn đã nhận mượn ${updatedBooks.length} cuốn sách vào lúc ${nowStr}. Hạn trả là ngày ${dueDateObj.toLocaleDateString('vi-VN')}. Chúc bạn đọc sách vui vẻ!`,
    "success"
  ).catch(err => console.error("Notify pickup failed:", err));
};

export const approveBorrowRequest = async (requestId, userId, userName, books) => {
  const reqSnap = await getDoc(doc(db, "borrowRequests", requestId));
  const reqData = reqSnap.exists() ? reqSnap.data() : {};
  
  await updateBorrowRequestStatus(requestId, 'APPROVED');
  // Pass phone/email from request to record
  return await createBorrowRecord(userId, userName, books, null, null, true, reqData.userPhone || "", reqData.userEmail || "");
};

export const rejectBorrowRequest = async (requestId) => {
  return await updateBorrowRequestStatus(requestId, 'REJECTED');
};

export const pickupBorrowRecord = async (recordId, bookUid) => {
  const recordRef = doc(db, "borrowRecords", recordId);
  const recordSnap = await getDoc(recordRef);

  if (!recordSnap.exists()) return;
  const data = recordSnap.data();
  const books = data.books || [];

  let allPickedUp = true;
  const updatedBooks = books.map(b => {
    if (b.uid === bookUid && b.status === 'APPROVED_PENDING_PICKUP') {
      return { ...b, status: 'BORROWING' };
    }
    if (b.status === 'APPROVED_PENDING_PICKUP') allPickedUp = false;
    return b;
  });

  await updateDoc(recordRef, {
    books: updatedBooks,
    status: allPickedUp ? 'BORROWING' : 'PARTIALLY_PICKED_UP'
  });
};

export const returnBorrowRecord = async (recordId, bookUid, returnNote = "", penaltyAmount = 0, isLost = false, damageFee = 0) => {
  const recordRef = doc(db, "borrowRecords", recordId);
  const recordSnap = await getDoc(recordRef);
  if (!recordSnap.exists()) throw new Error("Phiếu mượn không tồn tại");

  const data = recordSnap.data();
  const books = data.books || [];
  const bookIndex = books.findIndex(b => b.uid === bookUid);
  
  if (bookIndex === -1) throw new Error("Không tìm thấy sách trong phiếu");

  const bookItem = books[bookIndex];
  if (['RETURNED', 'RETURNED_OVERDUE', 'LOST'].includes(bookItem.status)) {
     throw new Error("Sách này đã được xử lý (trả hoặc báo mất) trước đó");
  }

  // Update book status
  const dueDateObj = data.dueDate?.toDate ? data.dueDate.toDate() : new Date(data.dueDate);
  const isNowOverdue = bookItem.status === 'OVERDUE' || dueDateObj < new Date();
  
  const finalBookStatus = isLost ? 'LOST' : (isNowOverdue ? 'RETURNED_OVERDUE' : 'RETURNED');

  books[bookIndex] = {
    ...bookItem,
    status: finalBookStatus,
    actualReturnDate: serverTimestamp(),
    returnNote,
    lateFee: Number(penaltyAmount) || 0,
    damageFee: Number(damageFee) || 0,
    penaltyAmount: (Number(penaltyAmount) || 0) + (Number(damageFee) || 0)
  };

  const allReturned = books.every(b => ['RETURNED', 'RETURNED_OVERDUE', 'LOST'].includes(b.status));
  
  const updates = { 
    books,
    status: allReturned ? 'RETURNED' : 'PARTIALLY_RETURNED'
  };

  // Nếu có cuốn nào trả trễ hoặc báo mất, cập nhật lịch sử vi phạm
  if ((isNowOverdue || isLost) && data.userId) {
    const userRef = doc(db, "users", data.userId);
    await updateDoc(userRef, { 
      lastOverdueAt: serverTimestamp() 
    });

    if (isNowOverdue && !isLost) {
      await createNotification(
        data.userId,
        "⚠️ Tạm khóa quyền gia hạn",
        "Bạn đã trả sách trễ hạn. Theo quy định, quyền lợi gia hạn sách của bạn sẽ bị tạm khóa trong 3 tháng tới.",
        "warning"
      ).catch(err => console.error("Notify overdue penalty failed:", err));
    }
    if (isLost) {
      await createNotification(
        data.userId,
        "❌ Ghi nhận mất sách",
        `Cuốn sách "${bookItem.bookTitle}" đã được ghi nhận là bị mất. Phí bồi thường đã được cập nhật vào phiếu mượn.`,
        "error"
      ).catch(err => console.error("Notify lost book failed:", err));
    }
  }

  await updateDoc(recordRef, updates);

  // Tăng số lượng sách trong kho NẾU sách không bị mất
  if (!isLost) {
    const bookRef = doc(db, "books", bookItem.bookId);
    await updateDoc(bookRef, {
      quantity: increment(1)
    });
  }

  return { success: true, allReturned };
};

// ========================
// RENEWALS
// ========================
export const submitRenewalRequest = async (recordId, userId, reason, userName, bookTitles) => {
  // KIỂM TRA TRẠNG THÁI PHIẾU MƯỢN TRƯỚC KHI GIA HẠN
  const recordRef = doc(db, "borrowRecords", recordId);
  const recordSnap = await getDoc(recordRef);
  if (recordSnap.exists()) {
    const recordData = recordSnap.data();
    if (recordData.status === 'LOST_LOCKED' || recordData.status === 'RETURNED' || recordData.status === 'RETURNED_OVERDUE') {
      throw new Error("Không thể gia hạn phiếu mượn ở trạng thái này.");
    }
  }

  return await addDoc(collection(db, "renewalRequests"), {
    recordId,
    userId,
    userName,
    bookTitles, // Ví dụ: "Dế Mèn Phiêu Lưu Ký, Đất Rừng Phương Nam"
    reason,
    status: 'PENDING',
    createdAt: serverTimestamp()
  });
};

export const getRenewalRequests = async () => {
  const q = query(collection(db, "renewalRequests"), where("status", "==", "PENDING"));
  return await getCollectionData(q);
};

export const processRenewalRequest = async (requestIds, isApproved) => {
  // Đảm bảo requestIds luôn là mảng
  const ids = Array.isArray(requestIds) ? requestIds : [requestIds];

  for (const requestId of ids) {
    const reqRef = doc(db, "renewalRequests", requestId);
    const reqSnap = await getDoc(reqRef);
    if (!reqSnap.exists()) continue;

    const reqData = reqSnap.data();
    if (isApproved && reqData.status === 'PENDING') {
      // 1. Cập nhật record mượn sách
      const recordRef = doc(db, "borrowRecords", reqData.recordId);
      const recordSnap = await getDoc(recordRef);
      if (recordSnap.exists()) {
        const recordData = recordSnap.data();
        const currentDueDate = recordData.dueDate?.toDate ? recordData.dueDate.toDate() : new Date(recordData.dueDate);
        const newDueDate = new Date(currentDueDate);
        newDueDate.setDate(newDueDate.getDate() + 14);

        await updateDoc(recordRef, {
          dueDate: newDueDate,
          isRenewed: true
        });
      }

      // 2. Tăng số lần gia hạn của User
      const userRef = doc(db, "users", reqData.userId);
      await updateDoc(userRef, {
        renewalCount: increment(1)
      });
    }

    // Cập nhật trạng thái yêu cầu
    const finalStatus = isApproved ? 'APPROVED' : 'REJECTED';
    await updateDoc(reqRef, { 
      status: finalStatus,
      processedAt: serverTimestamp()
    });

    // Tạo thông báo cho Độc giả
    const title = finalStatus === 'APPROVED' ? "✅ Yêu cầu gia hạn được duyệt" : "❌ Yêu cầu gia hạn bị từ chối";
    const msg = finalStatus === 'APPROVED' 
      ? `Sách "${reqData.bookTitles}" đã được gia hạn thêm 14 ngày. Hạn mới đã được cập nhật.` 
      : `Yêu cầu gia hạn sách "${reqData.bookTitles}" không được Admin phê duyệt. Vui lòng trả sách đúng hạn.`;
    
    await createNotification(
      reqData.userId,
      title,
      msg,
      finalStatus === 'APPROVED' ? 'success' : 'error'
    ).catch(err => console.error("Notify renewal processed failed:", err));
  }
};

export const canUserRenew = async (userId, recordId) => {
  // 0. Đồng bộ quyền lợi (passive sync)
  await syncUserQuotas(userId).catch(err => console.error("Sync quotas failed:", err));

  // 1. Kiểm tra đơn hiện tại đã gia hạn chưa
  const recordRef = doc(db, "borrowRecords", recordId);
  const recordSnap = await getDoc(recordRef);
  if (recordSnap.exists() && recordSnap.data().isRenewed) {
    return { canRenew: false, reason: "Đơn mượn này đã được gia hạn trước đó (tối đa 1 lần)." };
  }

  // 2. Kiểm tra sách đã bị quá hạn chưa (Chỉ được gia hạn khi chưa trễ)
  if (recordSnap.exists()) {
    const data = recordSnap.data();
    const dueDate = data.dueDate?.toDate ? data.dueDate.toDate() : new Date(data.dueDate);
    if (dueDate < new Date()) {
      return { canRenew: false, reason: "Sách đã quá hạn trả, không được phép gia hạn thêm. Vui lòng mang trả ngay." };
    }
  }

  // 3. Kiểm tra lịch sử vi phạm (3 tháng)
  const userRef = doc(db, "users", userId);
  const userSnap = await getDoc(userRef);
  if (userSnap.exists()) {
    const userData = userSnap.data();
    
    // Check renewalCount (Lượt đã dùng >= 3 nghĩa là hết lượt)
    if ((userData.renewalCount || 0) >= 3) {
      return { canRenew: false, reason: "Bạn đã hết lượt gia hạn trong quý này (Tối đa 3 lượt dự trữ)." };
    }

    // Check lastOverdueAt
    if (userData.lastOverdueAt) {
      const lastOverdue = userData.lastOverdueAt.toDate ? userData.lastOverdueAt.toDate() : new Date(userData.lastOverdueAt);
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
      
      if (lastOverdue > threeMonthsAgo) {
        return { 
          canRenew: false, 
          reason: "Bạn có lịch sử trả trễ trong 3 tháng qua. Quyền lợi gia hạn của bạn đang bị tạm khóa." 
        };
      }
    }
  }

  return { canRenew: true };
};

export const syncUserQuotas = async (userId) => {
  if (!userId) return;
  const userRef = doc(db, "users", userId);
  const userSnap = await getDoc(userRef);
  if (!userSnap.exists()) return;

  const userData = userSnap.data();
  const now = new Date();
  const batch = writeBatch(db);
  let hasChanges = false;

  // 1. Reset/Top-up Lượt Gia hạn ( renewalCount là số lần đã dùng)
  // renewalCount = 0 -> Có 3 lượt
  // renewalCount = 3 -> Có 0 lượt
  const lastReset = userData.lastQuotaReset?.toDate ? userData.lastQuotaReset.toDate() : (userData.lastQuotaReset ? new Date(userData.lastQuotaReset) : new Date(0));
  const threeMonthsInMs = 90 * 24 * 60 * 60 * 1000;

  if (now - lastReset > threeMonthsInMs) {
    const currentUsed = userData.renewalCount || 0;
    if (currentUsed > 0) {
      // Tặng thêm 1 lượt = giảm số lần đã dùng đi 1
      const newUsed = currentUsed - 1;
      batch.update(userRef, { 
        renewalCount: newUsed,
        lastQuotaReset: serverTimestamp() 
      });
      hasChanges = true;

      // Thông báo tặng lượt
      await createNotification(
        userId,
        "🎁 Quà tặng gia hạn",
        "Chào mừng chu kỳ mới! Bạn đã được Thư viện tặng thêm 1 lượt gia hạn sách mới. Hãy sử dụng thật hiệu quả nhé!",
        "success"
      ).catch(err => console.error("Notify top-up failed:", err));
    } else {
      // Nếu đang còn nguyên 3 lượt (used=0), chỉ cập nhật ngày reset âm thầm
      batch.update(userRef, { lastQuotaReset: serverTimestamp() });
      hasChanges = true;
    }
  }

  // 2. Xóa vết trễ hạn sau 3 tháng
  if (userData.lastOverdueAt) {
    const lastOverdue = userData.lastOverdueAt.toDate ? userData.lastOverdueAt.toDate() : new Date(userData.lastOverdueAt);
    
    // KIỂM TRA: Chỉ khôi phục nếu User KHÔNG còn đơn nào đang quá hạn
    const qOverdue = query(collection(db, "borrowRecords"), where("userId", "==", userId), where("status", "==", "OVERDUE"));
    const snapOverdue = await getDocs(qOverdue);
    
    if (now - lastOverdue > threeMonthsInMs && snapOverdue.empty) {
      batch.update(userRef, { lastOverdueAt: null });
      hasChanges = true;

      await createNotification(
        userId,
        "✨ Quyền lợi khôi phục",
        "Đã quá 3 tháng kể từ lần trả trễ cuối cùng, lịch sử vi phạm của bạn đã được xóa bỏ. Bạn đã có thể sử dụng quyền gia hạn sách trở lại.",
        "success"
      ).catch(err => console.error("Notify restoration failed:", err));
    }
  }

  if (hasChanges) {
    await batch.commit();
  }
};

// ========================
// BUSINESS RULES
// ========================
export const canUserBorrow = async (userId, isAdmin = false) => {
  if (isAdmin) return { canBorrow: true }; // Admin bypass

  // 0. Đồng bộ quyền lợi
  await syncUserQuotas(userId).catch(err => console.error("Sync quotas in borrow check failed:", err));

  // Kiểm tra xem có bị khóa không
  const userDocRef = doc(db, "users", userId);
  const userSnap = await getDoc(userDocRef);
  if (userSnap.exists() && userSnap.data().isLocked) {
    return { 
      canBorrow: false, 
      reason: 'Tài khoản của bạn đã bị KHÓA do vi phạm quy định trả sách quá hạn (trên 14 ngày). Vui lòng liên hệ Admin để xử lý.' 
    };
  }

  const records = await getBorrowRecords(userId);
  
  // 1. Quá hạn
  const overdueRecord = records.find(r => r.status === 'OVERDUE');
  if (overdueRecord) return {
    canBorrow: false,
    reason: `Bạn đang có sách quá hạn chưa trả: "${overdueRecord.bookTitle}". Vui lòng trả sách trước khi mượn cuốn mới. [ID: ${overdueRecord.id}]`
  };

  // 2. Chờ lấy sách
  const hasPendingPickup = records.some(r => r.status === 'APPROVED_PENDING_PICKUP');
  if (hasPendingPickup) return { canBorrow: false, reason: 'Bạn đang có sách đã được duyệt, vui lòng ra quầy lấy sách trước.' };

  // 3. Đang mượn hợc trả thiếu (TRẢ HẾT MỚI ĐƯỢC MƯỢN MỚI)
  const isCurrentlyHoldingBooks = records.some(r => r.status === 'BORROWING' || r.status === 'PARTIALLY_RETURNED');
  if (isCurrentlyHoldingBooks) return { 
    canBorrow: false, 
    reason: 'Luật Thư Viện: Bạn đang mượn sách. Vui lòng đem trả TOÀN BỘ sách đang giữ để có thể mượn đợt mới.' 
  };

  // Tính năng Gộp Đơn (Dynamic Cart): Đã gỡ bỏ luật cấm tạo Yêu Cầu khi đang có Đơn Pending.
  // Việc giới hạn Tổng số sách <= 3 sẽ được xử lý ở Tầng API Mượn sách hàng loạt.

  return { canBorrow: true };
};

export const getUserQuota = async (userId) => {
  if (!userId) return { totalPending: 0, totalBorrowed: 0, totalUsed: 0, remaining: 3 };

  // 1. Số lượng sách đang chờ duyệt
  const qPending = query(
    collection(db, "borrowRequests"), 
    where("userId", "==", userId), 
    where("status", "==", "PENDING")
  );
  const snapPending = await getDocs(qPending);
  let totalPending = 0;
  snapPending.forEach(d => {
    // Nếu đơn cũ (flat) không có mảng books, mặc định tính là 1 cuốn
    totalPending += (d.data().books || []).length || 1;
  });

  // 2. Số lượng sách đang mượn thực tế (tính theo từng book trong record)
  const qRecords = query(collection(db, "borrowRecords"), where("userId", "==", userId));
  const snapRecords = await getDocs(qRecords);
  let totalBorrowed = 0;
  snapRecords.forEach(d => {
    const recData = d.data();
    const books = recData.books || [];
    // Chỉ đếm các cuốn sách chưa trả
    totalBorrowed += books.filter(b => 
      ["BORROWING", "OVERDUE", "PARTIALLY_RETURNED", "APPROVED_PENDING_PICKUP", "Active", "PARTIALLY_PICKED_UP"].includes(b.status || recData.status)
    ).length;
  });

  const totalUsed = totalPending + totalBorrowed;
  return {
    totalPending,
    totalBorrowed,
    totalUsed,
    remaining: Math.max(0, 3 - totalUsed)
  };
};

export const isBookAvailable = async (bookId) => {
  const book = await getBook(bookId);
  if (!book || (book.quantity || 0) <= 0) return false;
  return true;
};

// ========================
// USERS
// ========================
export const getUsers = async () => {
  const q = query(collection(db, "users"), orderBy("name"));
  return await getCollectionData(q);
};

export const updateUserRole = async (id, role) => {
  const docRef = doc(db, "users", id);
  return await updateDoc(docRef, { role });
};

export const lockUserAccount = async (id, isLocked = true) => {
  const docRef = doc(db, "users", id);
  return await updateDoc(docRef, { isLocked });
};

// ========================
// CATEGORIES
// ========================
export const getCategories = async () => {
  const q = query(collection(db, "categories"), orderBy("name"));
  return await getCollectionData(q);
};

export const getCategory = async (id) => {
  const docRef = doc(db, "categories", id);
  const snap = await getDoc(docRef);
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};


export const addCategory = async (data) => {
  return await addDoc(collection(db, "categories"), {
    ...data,
    createdAt: serverTimestamp()
  });
};

export const updateCategory = async (id, data) => {
  const docRef = doc(db, "categories", id);
  return await updateDoc(docRef, data);
};

export const deleteCategory = async (id) => {
  const docRef = doc(db, "categories", id);
  return await deleteDoc(docRef);
};

export const countBooksByCategory = async (categoryName) => {
  const q = query(collection(db, "books"), where("category", "==", categoryName));
  const snap = await getDocs(q);
  return snap.size;
};

export const hasActiveBorrowingsByCategory = async (categoryName) => {
  // Tìm tất cả sách thuộc thể loại này
  const qBooks = query(collection(db, "books"), where("category", "==", categoryName));
  const snapBooks = await getDocs(qBooks);
  if (snapBooks.empty) return false;
  
  const bookIds = snapBooks.docs.map(doc => doc.id);
  
  // Kiểm tra từng cuốn sách xem có đang được mượn không (sử dụng logic giống countActiveBookUsage)
  for (const bid of bookIds) {
    const activeCount = await countActiveBookUsage(bid);
    if (activeCount > 0) return true;
  }
  return false;
};


export const ensureCategoryExists = async (categoryName) => {
  if (!categoryName || categoryName === "Chưa phân loại" || categoryName === "Khác") return;

  const q = query(collection(db, "categories"), where("name", "==", categoryName));
  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    await addCategory({
      name: categoryName,
      description: "Tự động tạo từ hệ thống sách"
    });
  }
};


// ========================
// NOTIFICATIONS
// ========================
export const createNotification = async (userId, title, message, type = 'info') => {
  return await addDoc(collection(db, "notifications"), {
    userId,
    title,
    message,
    type, // info, success, warning, error
    isRead: false,
    createdAt: serverTimestamp()
  });
};

export const getUserNotifications = async (userId) => {
  const q = query(
    collection(db, "notifications"), 
    where("userId", "==", userId)
  );
  const data = await getCollectionData(q);
  // Sắp xếp thủ công để tránh lỗi Missing Index trong Firestore (Composite Index)
  return data.sort((a, b) => {
    const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : (a.createdAt || 0);
    const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : (b.createdAt || 0);
    return dateB - dateA; // Mới nhất lên đầu
  });
};

export const markNotificationAsRead = async (id) => {
  const docRef = doc(db, "notifications", id);
  return await updateDoc(docRef, { isRead: true });
};

export const markAllNotificationsAsRead = async (userId) => {
  const q = query(
    collection(db, "notifications"),
    where("userId", "==", userId),
    where("isRead", "==", false)
  );
  const snap = await getDocs(q);
  const batch = writeBatch(db);
  snap.docs.forEach((d) => {
    batch.update(d.ref, { isRead: true });
  });
  return await batch.commit();
};

// ========================
// AUTHOR INTERESTS & SMART NOTIFICATIONS
// ========================

/**
 * Thêm hoặc xóa một tác giả khỏi danh sách yêu thích của người dùng
 */
export const toggleAuthorFavorite = async (userId, authorName) => {
  if (!userId || !authorName) return;
  const userRef = doc(db, "users", userId);
  const userSnap = await getDoc(userRef);
  if (!userSnap.exists()) return;

  const userData = userSnap.data();
  const favorites = userData.favoriteAuthors || [];
  
  let newFavorites;
  if (favorites.includes(authorName)) {
    newFavorites = favorites.filter(a => a !== authorName);
  } else {
    newFavorites = [...favorites, authorName];
  }

  await updateDoc(userRef, { favoriteAuthors: newFavorites });
  return newFavorites;
};

/**
 * Tìm tất cả fan của một tác giả và gửi thông báo Inbox cho họ
 */
export const notifyFollowers = async (authorName, bookTitle) => {
  try {
    const q = query(
      collection(db, "users"),
      where("favoriteAuthors", "array-contains", authorName)
    );
    const snap = await getDocs(q);
    
    if (snap.empty) return;

    const batch = writeBatch(db);
    snap.docs.forEach(userDoc => {
      const notificationRef = doc(collection(db, "notifications"));
      batch.set(notificationRef, {
        userId: userDoc.id,
        title: "📚 Sách mới từ thần tượng!",
        message: `Tác giả [${authorName}] mà bạn yêu thích vừa có tác phẩm mới: "${bookTitle}". Hãy khám phá ngay!`,
        type: 'success',
        isRead: false,
        createdAt: serverTimestamp()
      });
    });

    await batch.commit();
    console.log(`Sent notifications to ${snap.size} fans of ${authorName}`);
  } catch (error) {
    console.error("Error in notifyFollowers:", error);
  }
};

// ========================
// AUTHOR MANAGEMENT
// ========================

export const getAuthors = async () => {
  const q = query(collection(db, "authors"), orderBy("name", "asc"));
  const snap = await getDocs(q);
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const getAuthor = async (id) => {
  const docRef = doc(db, "authors", id);
  const snap = await getDoc(docRef);
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};


export const addAuthor = async (name) => {
  if (!name) return;
  const docRef = await addDoc(collection(db, "authors"), {
    name: name.trim(),
    createdAt: serverTimestamp()
  });
  return docRef;
};

export const deleteAuthor = async (id) => {
  await deleteDoc(doc(db, "authors", id));
};

export const countBooksByAuthor = async (authorName) => {
  const q = query(collection(db, "books"), where("author", "==", authorName));
  const snap = await getDocs(q);
  return snap.size;
};

export const hasActiveBorrowingsByAuthor = async (authorName) => {
  const qBooks = query(collection(db, "books"), where("author", "==", authorName));
  const snapBooks = await getDocs(qBooks);
  if (snapBooks.empty) return false;
  
  const bookIds = snapBooks.docs.map(doc => doc.id);
  for (const bid of bookIds) {
    const activeCount = await countActiveBookUsage(bid);
    if (activeCount > 0) return true;
  }
  return false;
};

export const deleteAuthorWithBooks = async (authorId, authorName) => {
  const qBooks = query(collection(db, "books"), where("author", "==", authorName));
  const snapBooks = await getDocs(qBooks);
  
  const batch = writeBatch(db);
  snapBooks.docs.forEach(d => {
    batch.delete(d.ref);
  });
  batch.delete(doc(db, "authors", authorId));
  
  await batch.commit();
};

export const deleteCategoryWithBooks = async (categoryId, categoryName) => {
  const qBooks = query(collection(db, "books"), where("category", "==", categoryName));
  const snapBooks = await getDocs(qBooks);
  
  const batch = writeBatch(db);
  snapBooks.docs.forEach(d => {
    batch.delete(d.ref);
  });
  batch.delete(doc(db, "categories", categoryId));
  
  await batch.commit();
};


export const ensureAuthorExists = async (authorName) => {
  if (!authorName) return;
  const nameTrimmed = authorName.trim();
  const q = query(collection(db, "authors"), where("name", "==", nameTrimmed));
  const snap = await getDocs(q);
  
  if (snap.empty) {
    await addDoc(collection(db, "authors"), {
      name: nameTrimmed,
      createdAt: serverTimestamp()
    });
    console.log(`Auto-added new author to catalog: ${nameTrimmed}`);
  }
};
