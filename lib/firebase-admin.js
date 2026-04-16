import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { join } from 'path';

// =====================================================
// GIẢI PHÁP: Đọc Service Account từ file JSON
// ─────────────────────────────────────────────────────
// 1. Tải file JSON từ Firebase Console:
//    Project Settings → Service Accounts → Generate new private key
// 2. Đổi tên file thành: service-account.json
// 3. Đặt file vào thư mục gốc của project (cùng cấp với package.json)
// 4. File đã được thêm vào .gitignore — an toàn, không bị push lên Git
// =====================================================

let serviceAccount = null;

const isVercel = process.env.VERCEL === '1';

// Chỉ đọc file JSON nếu không ở trên Vercel
if (!isVercel) {
  try {
    const filePath = join(process.cwd(), 'service-account.json');
    const raw = readFileSync(filePath, 'utf8');
    serviceAccount = JSON.parse(raw);
    console.log('✅ [Firebase Admin] Đọc service-account.json thành công (Local).');
  } catch {
    console.log('ℹ️  [Firebase Admin] Không dùng file JSON → Chuyển sang Env Vars...');
  }
}

// Fallback: đọc từ biến môi trường (nếu không có file JSON)
if (!serviceAccount) {
  const projectId   = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const rawKey      = process.env.FIREBASE_PRIVATE_KEY;
  const privateKey  = rawKey
    ?.replace(/^["']|["']$/g, '') // Xóa dấu ngoặc " hoặc ' bao quanh
    ?.replace(/\\n/g, '\n')        // Chuyển \n literal → newline thật
    ?.trim();

  // Diagnostic Logs (giúp debug nhanh trên Vercel)
  if (isVercel) {
    console.log('--- Firebase Admin Vercel Diagnostic ---');
    console.log('PROJECT_ID    :', projectId   ? '✅ OK' : '❌ MISSING (FIREBASE_PROJECT_ID)');
    console.log('CLIENT_EMAIL  :', clientEmail ? '✅ OK' : '❌ MISSING (FIREBASE_CLIENT_EMAIL)');
    console.log('PRIVATE_KEY   :', privateKey  ? `✅ OK (${privateKey.length} chars)` : '❌ MISSING (FIREBASE_PRIVATE_KEY)');
    console.log('----------------------------------------');
  }

  if (projectId && clientEmail && privateKey?.includes('-----BEGIN PRIVATE KEY-----')) {
    serviceAccount = { projectId, clientEmail, privateKey };
    console.log('✅ [Firebase Admin] Đọc credentials từ env vars thành công.');
  } else {
    const missing = [];
    if (!projectId) missing.push('PROJECT_ID');
    if (!clientEmail) missing.push('CLIENT_EMAIL');
    if (!privateKey) missing.push('PRIVATE_KEY');
    
    console.error(
      `❌ [Firebase Admin] Thiếu thông tin cấu hình: ${missing.join(', ')}\n` +
      '   → Hãy kiểm tra Environment Variables trên Vercel Dashboard.'
    );
  }
}

// Khởi tạo Firebase Admin SDK
if (serviceAccount && !admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log('✅ [SERVER] Firebase Admin SDK initialized successfully');
  } catch (error) {
    console.error('❌ [Firebase Admin] Khởi tạo LỖI:', error.message);
  }
}

const isReady = admin.apps.length > 0;

export const adminAuth = isReady ? admin.auth()      : null;
export const adminDb   = isReady ? admin.firestore() : null;
export default admin;
