import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { join } from 'path';

// Load config
const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const rawKey = process.env.FIREBASE_PRIVATE_KEY;
const privateKey = rawKey?.replace(/^["']|["']$/g, '')?.replace(/\\n/g, '\n')?.trim();

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
  });
}

const db = admin.firestore();

async function simulateOverdue() {
  console.log('--- Đang tạo dữ liệu giả lập Quá Hạn ---');

  // 1. Tạo 1 cuốn sách test
  const bookRef = await db.collection('books').add({
    title: 'Sách Giả Lập Quá Hạn (Test)',
    author: 'Robot Antigravity',
    category: 'Testing',
    quantity: 10,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });
  console.log(`✅ Đã tạo sách test ID: ${bookRef.id}`);

  // 2. Tạo 1 phiếu mượn trễ hạn 7 ngày
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
  const borrowDate = new Date(now.getTime() - (21 * 24 * 60 * 60 * 1000)); // Mượn từ 21 ngày trước

  const recordRef = await db.collection('borrowRecords').add({
    userId: 'test_user_overdue',
    userName: 'Người Mượn Trễ Hẹn (Mẫu)',
    bookId: bookRef.id,
    bookTitle: 'Sách Giả Lập Quá Hạn (Test)',
    borrowDate: admin.firestore.Timestamp.fromDate(borrowDate),
    dueDate: admin.firestore.Timestamp.fromDate(sevenDaysAgo),
    status: 'BORROWING',
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });

  console.log(`✅ Đã tạo phiếu mượn QUÁ HẠN ID: ${recordRef.id}`);
  console.log(`📅 Hạn trả đã đặt là: ${sevenDaysAgo.toLocaleDateString()}`);
  console.log('\n👉 Bây giờ hãy vào Dashboard của bạn để kiểm tra kết quả!');
  
  process.exit(0);
}

simulateOverdue().catch(err => {
  console.error('❌ Lỗi:', err);
  process.exit(1);
});
