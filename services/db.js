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
