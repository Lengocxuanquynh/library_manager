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
  writeBatch,
  runTransaction
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { toTitleCase } from "../lib/utils";
import { calculateSmartDueDate } from "../lib/penalty-utils";

// Helper for getting collection data
const getCollectionData = async (colRef) => {
  const snapshot = await getDocs(colRef);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

const getLibraryConfig = async () => {
  try {
    const configSnap = await getDoc(doc(db, 'library_config', 'settings'));
    if (configSnap.exists()) return configSnap.data();
    return { excludeSundays: true, holidays: [] };
  } catch (error) {
    return { excludeSundays: true, holidays: [] };
  }
};

/**
 * Safely decrements book stock using a transaction.
 * Ensures quantity - damagedCount >= count.
 */
export const decrementBookStock = async (bookId, count = 1) => {
  const bookRef = doc(db, "books", bookId);
  
  return await runTransaction(db, async (transaction) => {
    const bookDoc = await transaction.get(bookRef);
    if (!bookDoc.exists()) {
      throw new Error("Không tìm thấy sách trong cơ sở dữ liệu.");
    }
    
    const data = bookDoc.data();
    const qty = Number(data.quantity) || 0;
    const damaged = Number(data.damagedCount) || 0;
    const available = qty - damaged;
    
    if (available < count) {
      throw new Error(`Sách "${data.title}" đã hết hoặc không đủ bản sao khả dụng (Hiện có: ${available}, Cần: ${count}).`);
    }
    
    transaction.update(bookRef, {
      quantity: qty - count
    });
    
    return true;
  });
};

/**
 * Safely increments book stock using a transaction.
 */
export const incrementBookStock = async (bookId, count = 1) => {
  const bookRef = doc(db, "books", bookId);
  
  return await runTransaction(db, async (transaction) => {
    const bookDoc = await transaction.get(bookRef);
    if (!bookDoc.exists()) {
      throw new Error("Không tìm thấy sách trong cơ sở dữ liệu.");
    }
    
    const data = bookDoc.data();
    const qty = Number(data.quantity) || 0;
    
    transaction.update(bookRef, {
      quantity: qty + count
    });
    
    return true;
  });
};

/**
 * Checks if a name already exists in a collection (case-insensitive).
 * Useful for Authors and Categories.
 */
export const checkNameExists = async (collectionName, name, excludeId = null) => {
  if (!name) return false;
  const nameStandardized = toTitleCase(name);
  
  const q = query(collection(db, collectionName), where("name", "==", nameStandardized));
  const snap = await getDocs(q);
  
  if (snap.empty) return false;
  
  // If we have an excludeId, check if the existing document is the same one
  if (excludeId) {
    return snap.docs.some(doc => doc.id !== excludeId);
  }
  
  return true;
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
  const bookRef = await addDoc(collection(db, "books"), {
    ...data,
    createdAt: serverTimestamp()
  });
  
  // Tự động tạo các bản sao vật lý dựa trên số lượng ban đầu
  const quantity = Number(data.quantity) || 0;
  if (quantity > 0) {
    await addBookCopies(bookRef.id, quantity, data.title);
  }
  
  return bookRef;
};

export const addBookCopies = async (bookId, count, bookTitle, updateQuantity = true) => {
  const batch = writeBatch(db);
  const bookPrefix = bookTitle ? bookTitle.substring(0, 3).toUpperCase().replace(/\s/g, '') : 'BK';
  
  for (let i = 0; i < count; i++) {
    const copyId = `${bookPrefix}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    const copyRef = doc(collection(db, "bookCopies"));
    batch.set(copyRef, {
      bookId,
      copyId,
      status: 'AVAILABLE',
      condition: 'EXCELLENT',
      conditionNote: '',
      createdAt: serverTimestamp()
    });
  }
  await batch.commit();
  
  if (updateQuantity) {
    const bookRef = doc(db, "books", bookId);
    await updateDoc(bookRef, { 
      quantity: increment(count) 
    });
  }
};

/**
 * Lấy danh sách tất cả bản sao của một đầu sách
 */
export const getBookCopies = async (bookId) => {
  const q = query(collection(db, "bookCopies"), where("bookId", "==", bookId));
  return await getCollectionData(q);
};

export const deleteBookCopy = async (copyId, bookId) => {
  const copyRef = doc(db, "bookCopies", copyId);
  const copySnap = await getDoc(copyRef);
  
  if (copySnap.exists()) {
    const copyData = copySnap.data();
    if (copyData.status !== 'AVAILABLE') {
      throw new Error("Không thể xóa bản sao đang được mượn hoặc đang gặp sự cố. Vui lòng thu hồi sách trước.");
    }
  }

  await deleteDoc(copyRef);
  
  // Tự động giảm số lượng trong đầu sách tương ứng
  const bookRef = doc(db, "books", bookId);
  await updateDoc(bookRef, {
    quantity: increment(-1)
  });
};

/**
 * Tìm bản sao vật lý thông qua mã định danh (Copy ID Label)
 */
export const getCopyByLabel = async (copyIdLabel) => {
  if (!copyIdLabel) return null;
  const q = query(collection(db, "bookCopies"), where("copyId", "==", copyIdLabel.trim().toUpperCase()));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() };
};

/**
 * Tìm một bản sao đang sẵn sàng để cho mượn
 */
export const getAvailableCopy = async (bookId) => {
  const q = query(
    collection(db, "bookCopies"), 
    where("bookId", "==", bookId), 
    where("status", "==", "AVAILABLE")
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() };
};

/**
 * Tìm phiếu mượn đang chứa một bản sao cụ thể
 * Dùng cho tính năng "Trả nhanh bằng mã sách"
 */
export const findBorrowRecordByCopyId = async (copyId) => {
  if (!copyId) return null;
  
  // 1. Tìm thông tin bản sao vật lý trước
  const cleanId = copyId.trim().toUpperCase();
  const qCopy = query(collection(db, "bookCopies"), where("copyId", "==", cleanId));
  const snapCopy = await getDocs(qCopy);
  
  if (snapCopy.empty) throw new Error(`Không tìm thấy mã sách "${cleanId}" trong hệ thống.`);
  const copyDoc = snapCopy.docs[0];
  const copyData = copyDoc.data();
  
  // Kiểm tra trạng thái của bản sao (BORROWED là trạng thái chuẩn của bản sao vật lý)
  if (copyData.status !== 'BORROWED' && copyData.status !== 'BORROWING' && copyData.status !== 'OVERDUE') {
    throw new Error(`Sách này hiện đang ở trạng thái "${copyData.status}", không có trong phiếu mượn nào đang hoạt động.`);
  }

  // 2. Tìm phiếu mượn (borrowRecords) đang chứa physicalCopyId này
  const qRecord = query(
    collection(db, "borrowRecords"), 
    where("status", "in", ["BORROWING", "OVERDUE", "PARTIALLY_RETURNED", "PARTIALLY_PICKED_UP"])
  );
  
  const snapRecords = await getDocs(qRecord);
  let targetRecord = null;
  let targetBook = null;

  snapRecords.forEach(doc => {
    const data = doc.data();
    const books = data.books || [];
    // Tìm chính xác cuốn sách theo physicalCopyId và chưa trả
    const foundBook = books.find(b => 
      b.physicalCopyId === copyDoc.id && 
      !['RETURNED', 'RETURNED_OVERDUE', 'LOST', 'DAMAGED'].includes(b.status)
    );
    if (foundBook) {
      targetRecord = { id: doc.id, ...data };
      targetBook = foundBook;
    }
  });

  if (!targetRecord) {
    throw new Error(`Mã sách "${cleanId}" được ghi nhận là Đang mượn nhưng không tìm thấy phiếu mượn tương ứng. Vui lòng kiểm tra lại dữ liệu.`);
  }

  return { record: targetRecord, book: targetBook };
};

export const updateBook = async (id, data) => {
  const docRef = doc(db, "books", id);
  const oldSnap = await getDoc(docRef);
  
  if (oldSnap.exists() && data.quantity !== undefined) {
    const oldData = oldSnap.data();
    const oldQty = Number(oldData.quantity) || 0;
    const newQty = Number(data.quantity) || 0;
    
    // Nếu tăng số lượng, tự động tạo thêm các bản sao còn thiếu
    if (newQty > oldQty) {
      const diff = newQty - oldQty;
      await addBookCopies(id, diff, data.title || oldData.title, false);
      console.log(`Auto-created ${diff} additional copies for book: ${id}`);
    }
  }

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

/**
 * Checks if email or phone already exists in 'users' or 'members'
 * Useful for preventing duplicate registrations/additions.
 */
export const checkMemberDuplicate = async (email, phone, excludeId = null) => {
  // 1. Check in 'users' collection
  const userEmailQuery = query(collection(db, "users"), where("email", "==", email));
  const userPhoneQuery = phone ? query(collection(db, "users"), where("phone", "==", phone)) : null;
  
  const [uEmailSnap, uPhoneSnap] = await Promise.all([
    getDocs(userEmailQuery),
    userPhoneQuery ? getDocs(userPhoneQuery) : Promise.resolve({ empty: true })
  ]);

  if (!uEmailSnap.empty) {
    if (!excludeId || uEmailSnap.docs.some(d => d.id !== excludeId)) return { exists: true, field: 'Email', source: 'tài khoản hệ thống' };
  }
  if (!uPhoneSnap.empty) {
    if (!excludeId || uPhoneSnap.docs.some(d => d.id !== excludeId)) return { exists: true, field: 'Số điện thoại', source: 'tài khoản hệ thống' };
  }

  // 2. Check in 'members' collection
  const memEmailQuery = query(collection(db, "members"), where("email", "==", email));
  const memPhoneQuery = phone ? query(collection(db, "members"), where("phone", "==", phone)) : null;

  const [mEmailSnap, mPhoneSnap] = await Promise.all([
    getDocs(memEmailQuery),
    memPhoneQuery ? getDocs(memPhoneQuery) : Promise.resolve({ empty: true })
  ]);

  if (!mEmailSnap.empty) {
    if (!excludeId || mEmailSnap.docs.some(d => d.id !== excludeId)) return { exists: true, field: 'Email', source: 'danh sách hội viên' };
  }
  if (!mPhoneSnap.empty) {
    if (!excludeId || mPhoneSnap.docs.some(d => d.id !== excludeId)) return { exists: true, field: 'Số điện thoại', source: 'danh sách hội viên' };
  }

  return { exists: false };
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
    if (isActive && dueDate) {
      const endOfDueDate = new Date(dueDate);
      endOfDueDate.setHours(23, 59, 59, 999);
      if (now > endOfDueDate) {
        currentStatus = 'OVERDUE';
      }
    }

    return { ...record, books, status: currentStatus };
  }).sort((a, b) => {
    // Ưu tiên xếp theo createdAt desc để đơn mới duyệt luôn lên đầu
    const timeA = a.createdAt?.toMillis() || a.borrowDate?.toMillis() || 0;
    const timeB = b.createdAt?.toMillis() || b.borrowDate?.toMillis() || 0;
    return timeB - timeA;
  });
};

export const createBorrowRecord = async (userId, userName, books, customBorrowDate = null, customDueDate = null, autoDecrement = true, borrowerPhone = "", userEmail = "", pickupDeadline = null) => {
  const borrowDateObj = customBorrowDate ? new Date(customBorrowDate) : new Date();
  const dueDateObj = customDueDate ? new Date(customDueDate) : new Date(borrowDateObj);

  if (!customDueDate) {
    const config = await getLibraryConfig();
    const smartDueDate = calculateSmartDueDate(borrowDateObj, 14, config);
    dueDateObj.setTime(smartDueDate.getTime());
  }

  const initialStatus = autoDecrement ? 'BORROWING' : 'APPROVED_PENDING_PICKUP';

  if (autoDecrement) {
    // 1. Kiểm tra tồn kho trước khi thực hiện bất kỳ thay đổi nào
    // Gom nhóm để kiểm tra tổng số lượng mượn cho mỗi ID
    const bookCounts = {};
    books.forEach(b => {
      bookCounts[b.bookId] = (bookCounts[b.bookId] || 0) + 1;
    });

    for (const [bid, count] of Object.entries(bookCounts)) {
      const available = await isBookAvailable(bid, count);
      if (!available) {
        // Tìm thông tin sách để báo lỗi chính xác
        const book = books.find(b => b.bookId === bid);
        throw new Error(`Sách "${book?.bookTitle || bid}" không đủ số lượng khả dụng trong kho.`);
      }
    }

    // 2. Chuyển sang mô hình Asset-based: 
    // Chúng ta KHÔNG trừ quantity ở đây nữa, vì quantity = tổng số bản sao vật lý.
    // Việc kiểm tra "còn sách hay không" đã được thực hiện ở bước 1 qua isBookAvailable.
  }

  // Process all books with unique record IDs and assign physical copies
  const booksWithStatus = [];
  
  for (const b of books) {
    let copyId = "N/A";
    let physicalCopyId = null;

    if (autoDecrement) {
      const availableCopy = await getAvailableCopy(b.bookId);
      if (availableCopy) {
        copyId = availableCopy.copyId;
        physicalCopyId = availableCopy.id;
        // Đánh dấu bản sao là đang mượn
        await updateDoc(doc(db, "bookCopies", physicalCopyId), { 
          status: 'BORROWED',
          lastBorrowerId: userId,
          lastBorrowDate: serverTimestamp()
        });
        // Cập nhật số lượng đang mượn trong đầu sách
        const bookRef = doc(db, "books", b.bookId);
        await updateDoc(bookRef, { 
          borrowedCount: increment(1)
        });
      }
    }

    booksWithStatus.push({
      uid: Math.random().toString(36).substring(2, 11) + Date.now(),
      bookId: b.bookId,
      bookTitle: b.bookTitle,
      copyId: copyId, // Mã định danh cuốn sách vật lý
      physicalCopyId: physicalCopyId, // Document ID trong collection bookCopies
      status: initialStatus,
      returnDate: null,
      penaltyAmount: 0
    });
  }

  return await addDoc(collection(db, "borrowRecords"), {
    userId,
    userName,
    userEmail: userEmail || "",
    books: booksWithStatus,
    borrowerPhone: borrowerPhone || "",
    borrowDate: autoDecrement ? (customBorrowDate ? borrowDateObj : serverTimestamp()) : null,
    dueDate: autoDecrement ? dueDateObj : null,
    pickupDeadline: pickupDeadline,
    status: initialStatus,
    createdAt: serverTimestamp()
  });
};

export const confirmBorrowPickup = async (recordId, manualCopyIds = {}) => {
  const recordRef = doc(db, "borrowRecords", recordId);
  const recordSnap = await getDoc(recordRef);
  
  if (!recordSnap.exists()) throw new Error("Phiếu mượn không tồn tại.");
  const data = recordSnap.data();

  const config = await getLibraryConfig();
  const dueDateObj = calculateSmartDueDate(new Date(), 14, config);

  // Update all books status and assign physical copies
  const books = data.books || [];
  const updatedBooks = [];

  for (const b of books) {
    let copyId = b.copyId;
    let physicalCopyId = b.physicalCopyId;

    // Ưu tiên mã được nhập thủ công từ giao diện
    const manualId = manualCopyIds[b.uid];
    if (manualId && manualId !== "N/A") {
      const cleanManualId = manualId.trim().toUpperCase();
      const q = query(collection(db, "bookCopies"), where("copyId", "==", cleanManualId));
      const snap = await getDocs(q);
      
      if (snap.empty) throw new Error(`Mã sách "${cleanManualId}" không tồn tại trong hệ thống.`);
      const copyDoc = snap.docs[0];
      const copyData = copyDoc.data();
      
      if (copyData.bookId !== b.bookId) {
        throw new Error(`Mã sách "${cleanManualId}" không thuộc về đầu sách "${b.bookTitle}".`);
      }
      
      if (copyData.status !== 'AVAILABLE' && physicalCopyId !== copyDoc.id) {
        throw new Error(`Mã sách "${cleanManualId}" hiện đang ở trạng thái "${copyData.status}", không thể cho mượn.`);
      }

      copyId = cleanManualId;
      physicalCopyId = copyDoc.id;
    }

    // Nếu vẫn chưa có mã (BẮT BUỘC PHẢI CÓ MÃ THỦ CÔNG TỪ ADMIN)
    if (copyId === "N/A" || !physicalCopyId) {
      throw new Error(`Bắt buộc phải nhập mã gáy sách cho cuốn "${b.bookTitle}" trước khi xác nhận cho mượn.`);
    }

    // Đánh dấu bản sao là đang mượn
    await updateDoc(doc(db, "bookCopies", physicalCopyId), { 
      status: 'BORROWED',
      lastBorrowerId: data.userId,
      lastBorrowDate: serverTimestamp()
    });

    // Cập nhật số lượng đang mượn trong đầu sách
    const bookRef = doc(db, "books", b.bookId);
    await updateDoc(bookRef, { 
      borrowedCount: increment(1)
    });

    updatedBooks.push({
      ...b,
      copyId,
      physicalCopyId,
      status: 'BORROWING'
    });
  }

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

export const returnBorrowRecord = async (recordId, bookUid, returnNote = "", penaltyAmount = 0, isLost = false, damageFee = 0, isDamaged = false, condition = 'EXCELLENT', conditionNote = "") => {
  const recordRef = doc(db, "borrowRecords", recordId);
  const recordSnap = await getDoc(recordRef);
  if (!recordSnap.exists()) throw new Error("Phiếu mượn không tồn tại");

  const data = recordSnap.data();
  const books = data.books || [];
  const bookIndex = books.findIndex(b => b.uid === bookUid);
  
  if (bookIndex === -1) throw new Error("Không tìm thấy sách trong phiếu");

  const bookItem = books[bookIndex];
  if (['RETURNED', 'RETURNED_OVERDUE', 'LOST', 'DAMAGED'].includes(bookItem.status)) {
     throw new Error("Sách này đã được xử lý (trả hoặc báo mất/hỏng) trước đó");
  }

  // Update book status
  const dueDateObj = data.dueDate?.toDate ? data.dueDate.toDate() : new Date(data.dueDate);
  const isNowOverdue = bookItem.status === 'OVERDUE' || dueDateObj < new Date();
  
  // Logic trạng thái cuối cùng
  let finalBookStatus = 'RETURNED';
  if (isLost) finalBookStatus = 'LOST';
  else if (isDamaged) finalBookStatus = 'DAMAGED';
  else if (isNowOverdue) finalBookStatus = 'RETURNED_OVERDUE';

  const now = new Date();

  books[bookIndex] = {
    ...bookItem,
    status: finalBookStatus,
    actualReturnDate: now,
    returnNote,
    lateFee: Number(penaltyAmount) || 0,
    damageFee: Number(damageFee) || 0,
    penaltyAmount: (Number(penaltyAmount) || 0) + (Number(damageFee) || 0),
    condition, // Lưu tình trạng lúc trả
    conditionNote
  };

  const allReturned = books.every(b => ['RETURNED', 'RETURNED_OVERDUE', 'LOST', 'DAMAGED'].includes(b.status));
  
  const updates = { 
    books,
    status: allReturned ? 'RETURNED' : 'PARTIALLY_RETURNED'
  };

  // Nếu có vi phạm, cập nhật lịch sử và thông báo
  if ((isNowOverdue || isLost || isDamaged || Number(damageFee) > 0) && data.userId) {
    const userRef = doc(db, "users", data.userId);
    await updateDoc(userRef, { lastOverdueAt: serverTimestamp() });

    const msgBase = `Cuốn sách "${bookItem.bookTitle}" `;
    if (isNowOverdue && !isLost && !isDamaged) {
      await createNotification(data.userId, "⚠️ Tạm khóa gia hạn", msgBase + "bị trả trễ hạn.", "warning");
    }
    if (isDamaged) {
      await createNotification(data.userId, "⚠️ Tạm khóa gia hạn", msgBase + "bị hư hỏng khi trả.", "warning");
    }
    if (isLost) {
      await createNotification(data.userId, "❌ Ghi nhận mất sách", msgBase + "đã được ghi nhận là bị mất.", "error");
    }
  }

  await updateDoc(recordRef, updates);

  // CẬP NHẬT KHO SÁCH VÀ TRẠNG THÁI BẢN SAO
  const bookRef = doc(db, "books", bookItem.bookId);
  const copyRef = bookItem.physicalCopyId ? doc(db, "bookCopies", bookItem.physicalCopyId) : null;

  if (!isLost) {
    // Nếu không phải bị mất (tức là trả lại sách bình thường hoặc hỏng)
    // KHÔNG tăng quantity ở đây nữa vì quantity = tổng số bản sao vật lý
    
    if (copyRef) {
      await updateDoc(copyRef, { 
        status: isDamaged ? 'DAMAGED' : 'AVAILABLE',
        condition: condition, // Cập nhật tình trạng vật lý mới nhất
        conditionNote: conditionNote || returnNote,
        lastReturnDate: serverTimestamp()
      });
    }

    // Khi trả sách, giảm số lượng đang mượn (borrowedCount)
    await updateDoc(bookRef, { borrowedCount: increment(-1) });

    if (isDamaged) {
      await updateDoc(bookRef, { damagedCount: increment(1) });
    }
  } else {
    // Sách bị mất hoàn toàn -> Giảm tổng số lượng sách sở hữu (quantity)
    await updateDoc(bookRef, { 
      quantity: increment(-1),
      lostCount: increment(1),
      borrowedCount: increment(-1) 
    });
    if (copyRef) {
      await updateDoc(copyRef, { 
        status: 'LOST',
        lastReturnDate: serverTimestamp()
      });
    }
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
        const config = await getLibraryConfig();
        const newDueDate = calculateSmartDueDate(currentDueDate, 14, config);

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
    const rawDueDate = data.dueDate?.toDate ? data.dueDate.toDate() : new Date(data.dueDate);
    const endOfDueDate = new Date(rawDueDate);
    endOfDueDate.setHours(23, 59, 59, 999);
    if (new Date() > endOfDueDate) {
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
          reason: "Bạn có lịch sử vi phạm (trả trễ, hỏng hoặc mất sách) trong 3 tháng qua. Quyền lợi gia hạn của bạn đang bị tạm khóa." 
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

export const isBookAvailable = async (bookId, requestedCount = 1) => {
  try {
    const q = query(
      collection(db, "bookCopies"), 
      where("bookId", "==", bookId), 
      where("status", "==", "AVAILABLE")
    );
    const snap = await getDocs(q);
    
    // Nếu có bản sao khả dụng, ưu tiên dùng dữ liệu này
    if (!snap.empty) {
      return snap.size >= requestedCount;
    }

    // Fallback cho dữ liệu cũ (nếu chưa có bản sao nào được tạo)
    const book = await getBook(bookId);
    if (!book) return false;
    if (book.status === 'Damaged' || book.status === 'Lost') return false;
    const availableCount = (Number(book.quantity) || 0) - (Number(book.damagedCount) || 0);
    return availableCount >= requestedCount;
  } catch (error) {
    console.error("Error checking book availability:", error);
    return false;
  }
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
  const nameStandardized = toTitleCase(data.name);
  return await addDoc(collection(db, "categories"), {
    ...data,
    name: nameStandardized,
    createdAt: serverTimestamp()
  });
};

export const updateCategory = async (id, data) => {
  const docRef = doc(db, "categories", id);
  const updateData = { ...data };
  if (data.name) updateData.name = toTitleCase(data.name);
  
  return await updateDoc(docRef, updateData);
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

/**
 * Migration script: Khởi tạo bản sao cho các đầu sách cũ chưa có Copy ID
 */
export const migrateExistingBooksToCopies = async () => {
  const books = await getBooks();
  const results = {
    totalBooks: books.length,
    processed: 0,
    copiesCreated: 0,
    countsRecalculated: 0,
    skipped: 0
  };

  for (const book of books) {
    let existingCopies = await getBookCopies(book.id);
    const quantity = Number(book.quantity) || 0;
    const missingCount = quantity - existingCopies.length;

    // 1. Tạo thêm bản sao nếu thiếu
    if (missingCount > 0) {
      await addBookCopies(book.id, missingCount, book.title, false);
      // Tải lại danh sách bản sao sau khi tạo mới
      existingCopies = await getBookCopies(book.id);
      results.processed++;
      results.copiesCreated += missingCount;
    } else {
      results.skipped++;
    }

    // 2. TỔNG KIỂM KÊ (AUDIT): Tính toán lại các con số thống kê dựa trên bản sao thực tế
    const borrowedCount = existingCopies.filter(c => c.status === 'BORROWED').length;
    const damagedCount = existingCopies.filter(c => c.status === 'DAMAGED').length;
    const lostCount = existingCopies.filter(c => c.status === 'LOST').length;

    await updateDoc(doc(db, "books", book.id), {
      borrowedCount: borrowedCount,
      damagedCount: damagedCount,
      lostCount: lostCount
    });
    results.countsRecalculated++;
  }

  return results;
};


export const ensureCategoryExists = async (categoryName) => {
  if (!categoryName || categoryName === "Chưa phân loại" || categoryName === "Khác") return;

  const nameStandardized = toTitleCase(categoryName);
  const q = query(collection(db, "categories"), where("name", "==", nameStandardized));
  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    await addCategory({
      name: nameStandardized,
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
  const nameStandardized = toTitleCase(name);
  const docRef = await addDoc(collection(db, "authors"), {
    name: nameStandardized,
    createdAt: serverTimestamp()
  });
  return docRef;
};

export const updateAuthor = async (id, name) => {
  const docRef = doc(db, "authors", id);
  return await updateDoc(docRef, { 
    name: toTitleCase(name)
  });
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
  const nameStandardized = toTitleCase(authorName);
  const q = query(collection(db, "authors"), where("name", "==", nameStandardized));
  const snap = await getDocs(q);
  
  if (snap.empty) {
    await addDoc(collection(db, "authors"), {
      name: nameStandardized,
      createdAt: serverTimestamp()
    });
    console.log(`Auto-added new author to catalog: ${nameStandardized}`);
  }
};
