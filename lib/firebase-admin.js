import admin from 'firebase-admin';

// =====================================================
// Tên biến môi trường cần có trong .env:
//   FIREBASE_CLIENT_EMAIL="..."
//   FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
//
// NEXT_PUBLIC_FIREBASE_PROJECT_ID đọc từ .env (dùng chung)
// =====================================================

const projectId   = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const rawKey      = process.env.FIREBASE_PRIVATE_KEY;

// Xử lý private key: convert \n dạng text thành ký tự xuống dòng thật
// Hỗ trợ cả 2 trường hợp:
//   - Chuỗi chứa ký tự \n literal (phổ biến khi dán vào .env)
//   - Chuỗi đã có newline thật (ít gặp)
const privateKey = rawKey ? rawKey.replace(/\\n/g, '\n') : null;

// ── Diagnostic Logs (xóa khi production ổn định) ──
console.log('--- Firebase Admin Config Check ---');
console.log('PROJECT_ID    :', projectId    ? `✅ ${projectId}` : '❌ Undefined');
console.log('CLIENT_EMAIL  :', clientEmail  ? `✅ ${clientEmail}` : '❌ Undefined');
console.log('PRIVATE_KEY   :', privateKey
  ? `✅ ${privateKey.length} ký tự | Bắt đầu: ${privateKey.substring(0, 27)}...`
  : '❌ Undefined');
console.log('-----------------------------------');

const isConfigured = !!(projectId && clientEmail && privateKey);

if (!isConfigured) {
  console.error(
    '🚨 Firebase Admin CHƯA ĐƯỢC CẤU HÌNH!\n' +
    'Kiểm tra file .env — cần có đủ 2 biến:\n' +
    '  FIREBASE_CLIENT_EMAIL="..."\n' +
    '  FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----\\n"'
  );
}

if (isConfigured && !admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });
    console.log('✅ Firebase Admin SDK khởi tạo THÀNH CÔNG!');
  } catch (error) {
    console.error('❌ Firebase Admin SDK khởi tạo LỖI:', error.message);
  }
}

export const adminAuth = (admin.apps.length && isConfigured) ? admin.auth()      : null;
export const adminDb   = (admin.apps.length && isConfigured) ? admin.firestore() : null;
