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
  increment
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
  }).sort((a, b) => (b.borrowDate?.toMillis() || 0) - (a.borrowDate?.toMillis() || 0));
};

export const createBorrowRecord = async (userId, userName, books, customBorrowDate = null, customDueDate = null, autoDecrement = true, borrowerPhone = "") => {
  const borrowDateObj = customBorrowDate ? new Date(customBorrowDate) : new Date();
  const dueDateObj = customDueDate ? new Date(customDueDate) : new Date(borrowDateObj);

  if (!customDueDate) {
    dueDateObj.setDate(dueDateObj.getDate() + 14); // Default 14 days
  }

  const initialStatus = autoDecrement ? 'BORROWING' : 'APPROVED_PENDING_PICKUP';

  // Process all books
  const booksWithStatus = books.map(b => ({
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
};

export const approveBorrowRequest = async (requestId, userId, userName, books) => {
  await updateBorrowRequestStatus(requestId, 'APPROVED');
  // For online approval, we reserve the books (decrement quantity) immediately
  return await createBorrowRecord(userId, userName, books, null, null, true);
};

export const rejectBorrowRequest = async (requestId) => {
  return await updateBorrowRequestStatus(requestId, 'REJECTED');
};

export const returnBorrowRecord = async (recordId, bookId, returnNote = '', penaltyAmount = 0) => {
  const recordRef = doc(db, "borrowRecords", recordId);
  const recordSnap = await getDoc(recordRef);

  if (!recordSnap.exists()) return;
  const data = recordSnap.data();
  const books = data.books || [];
  
  // Find which book is being returned
  let allReturned = true;
  const updatedBooks = books.map(b => {
    if (b.bookId === bookId && b.status !== 'RETURNED' && b.status !== 'RETURNED_OVERDUE') {
      const dueDate = data.dueDate?.toDate ? data.dueDate.toDate() : (data.dueDate ? new Date(data.dueDate) : null);
      const now = new Date();
      const finalStatus = (dueDate && now > dueDate) ? 'RETURNED_OVERDUE' : 'RETURNED';
      
      return {
        ...b,
        status: finalStatus,
        actualReturnDate: new Date(),
        returnNote: returnNote || '',
        penaltyAmount: Number(penaltyAmount) || 0
      };
    }
    
    // Check if others are still borrowed
    if (b.status === 'BORROWING' || b.status === 'APPROVED_PENDING_PICKUP') {
      allReturned = false;
    }
    return b;
  });

  await updateDoc(recordRef, {
    books: updatedBooks,
    status: allReturned ? 'RETURNED' : 'PARTIALLY_RETURNED'
  });

  // Increase book quantity atomically
  const bookRef = doc(db, "books", bookId);
  await updateDoc(bookRef, {
    quantity: increment(1)
  });
};

// ========================
// BUSINESS RULES
// ========================
export const canUserBorrow = async (userId, isAdmin = false) => {
  if (isAdmin) return { canBorrow: true }; // Admin bypass

  const records = await getBorrowRecords(userId);
  
  // 1. Quá hạn
  const overdueRecord = records.find(r => r.status === 'OVERDUE');
  if (overdueRecord) return { 
    canBorrow: false, 
    reason: `Bạn đang có sách quá hạn chưa trả: "${overdueRecord.bookTitle}". Vui lòng trả sách trước khi mượn sự kiện mới.` 
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

// ========================
// CATEGORIES
// ========================
export const getCategories = async () => {
  const q = query(collection(db, "categories"), orderBy("name"));
  return await getCollectionData(q);
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


