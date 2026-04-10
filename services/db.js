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
  serverTimestamp
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
    if (currentStatus === 'BORROWING' && record.dueDate?.toDate() < now) {
      currentStatus = 'OVERDUE';
    }
    return { ...record, status: currentStatus };
  }).sort((a, b) => (b.borrowDate?.toMillis() || 0) - (a.borrowDate?.toMillis() || 0));
};

export const createBorrowRecord = async (userId, bookId, userName, bookTitle) => {
  const borrowDate = new Date();
  const dueDate = new Date();
  dueDate.setDate(borrowDate.getDate() + 7); // Default 7 days

  // Decrement book quantity
  const bookRef = doc(db, "books", bookId);
  const bookSnap = await getDoc(bookRef);
  if (bookSnap.exists()) {
    const currentQty = bookSnap.data().quantity || 1;
    await updateDoc(bookRef, { quantity: Math.max(0, currentQty - 1) });
  }

  return await addDoc(collection(db, "borrowRecords"), {
    userId,
    bookId,
    userName,
    bookTitle,
    borrowDate: serverTimestamp(),
    dueDate,
    returnDate: null,
    status: 'BORROWING'
  });
};

export const approveBorrowRequest = async (requestId, userId, bookId, userName, bookTitle) => {
  await updateBorrowRequestStatus(requestId, 'APPROVED');
  return await createBorrowRecord(userId, bookId, userName, bookTitle);
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

  // Increase book quantity
  const bookRef = doc(db, "books", bookId);
  const bookSnap = await getDoc(bookRef);
  if (bookSnap.exists()) {
    const currentQty = bookSnap.data().quantity || 0;
    await updateDoc(bookRef, { quantity: currentQty + 1 });
  }
};

// ========================
// BUSINESS RULES
// ========================
export const canUserBorrow = async (userId) => {
  const records = await getBorrowRecords(userId);
  const hasOverdue = records.some(r => r.status === 'OVERDUE');
  if (hasOverdue) return { canBorrow: false, reason: 'Bạn đang có sách quá hạn chưa trả.' };

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
