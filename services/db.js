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
import { db } from "@/lib/firebase";

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

export const processReturn = async (transactionId, bookId) => {
  const transRef = doc(db, "transactions", transactionId);
  await updateDoc(transRef, { status: 'Returned', returnDate: serverTimestamp() });

  const bookRef = doc(db, "books", bookId);
  await updateDoc(bookRef, { status: 'Available' });
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
    
    // Convert dueDate to JS Date for comparison
    let dueDate = null;
    if (record.dueDate?._seconds) dueDate = new Date(record.dueDate._seconds * 1000);
    else if (record.dueDate?.seconds) dueDate = new Date(record.dueDate.seconds * 1000);
    else if (typeof record.dueDate?.toDate === 'function') dueDate = record.dueDate.toDate();
    else if (record.dueDate) dueDate = new Date(record.dueDate);

    if (currentStatus === 'BORROWING' && dueDate && dueDate < now) {
      currentStatus = 'OVERDUE';
    }
    return { ...record, status: currentStatus };
  }).sort((a, b) => (b.borrowDate?.toMillis() || 0) - (a.borrowDate?.toMillis() || 0));
};

export const createBorrowRecord = async (userId, bookId, userName, bookTitle, customBorrowDate = null, customDueDate = null, autoDecrement = true, borrowerPhone = "") => {
  const borrowDateObj = customBorrowDate ? new Date(customBorrowDate) : new Date();
  const dueDateObj = customDueDate ? new Date(customDueDate) : (customBorrowDate ? new Date(customBorrowDate) : new Date());
  
  if (!customDueDate) {
    dueDateObj.setDate(dueDateObj.getDate() + 14); // Default 14 days
  }

  if (autoDecrement) {
    // Decrement book quantity atomically
    const bookRef = doc(db, "books", bookId);
    await updateDoc(bookRef, { 
      quantity: increment(-1)
    });
  }

  return await addDoc(collection(db, "borrowRecords"), {
    userId,
    bookId,
    userName,
    bookTitle,
    borrowerPhone: borrowerPhone || "",
    borrowDate: autoDecrement ? (customBorrowDate ? borrowDateObj : serverTimestamp()) : null,
    dueDate: autoDecrement ? dueDateObj : null,
    returnDate: null,
    status: autoDecrement ? 'BORROWING' : 'APPROVED_PENDING_PICKUP'
  });
};

export const confirmBorrowPickup = async (recordId, bookId) => {
  const recordRef = doc(db, "borrowRecords", recordId);
  
  const dueDateObj = new Date();
  dueDateObj.setDate(dueDateObj.getDate() + 14);

  await updateDoc(recordRef, {
    status: 'BORROWING',
    pickupDate: serverTimestamp(),
    borrowDate: serverTimestamp(),
    dueDate: dueDateObj
  });

  // Decrement book quantity atomically only when picked up
  const bookRef = doc(db, "books", bookId);
  await updateDoc(bookRef, { 
    quantity: increment(-1)
  });
};

export const approveBorrowRequest = async (requestId, userId, bookId, userName, bookTitle) => {
  await updateBorrowRequestStatus(requestId, 'APPROVED');
  // For online approval, we wait for pickup to decrement quantity
  return await createBorrowRecord(userId, bookId, userName, bookTitle, null, null, false);
};

export const rejectBorrowRequest = async (requestId) => {
  return await updateBorrowRequestStatus(requestId, 'REJECTED');
};

export const returnBorrowRecord = async (recordId, bookId) => {
  const recordRef = doc(db, "borrowRecords", recordId);
  await updateDoc(recordRef, {
    status: 'RETURNED',
    returnDate: serverTimestamp()
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
export const canUserBorrow = async (userId) => {
  const records = await getBorrowRecords(userId);
  const hasOverdue = records.some(r => r.status === 'OVERDUE');
  if (hasOverdue) return { canBorrow: false, reason: 'Bạn đang có sách quá hạn chưa trả.' };

  // Check if user has a book approved but not yet picked up
  const hasPendingPickup = records.some(r => r.status === 'APPROVED_PENDING_PICKUP');
  if (hasPendingPickup) return { canBorrow: false, reason: 'Bạn đang có sách đã được duyệt, vui lòng đến thư viện lấy sách trước.' };

  // Also check if they already requested this book and it's pending
  const requests = await getBorrowRequests('PENDING', userId);
  if (requests.length > 0) return { canBorrow: false, reason: 'Bạn đang có một yêu cầu mượn sách đang chờ duyệt.' };

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


