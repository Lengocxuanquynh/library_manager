import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { join } from 'path';

// =====================================================
// GIẢI PHÁP CẤU HÌNH FIREBASE ADMIN:
// ─────────────────────────────────────────────────────
// Cách 1 (Ưu tiên): Đọc Service Account từ file JSON
//    - Tải file từ Firebase Console -> Service Accounts -> Generate new private key
//    - Đổi tên thành: service-account.json và đặt vào thư mục gốc project.
// Cách 2 (Fallback): Đọc từ biến môi trường (.env)
//    - FIREBASE_CLIENT_EMAIL="..."
//    - FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
// =====================================================

let serviceAccount = null;

// --- 1. Thử đọc từ file JSON trước (Cách ổn định nhất) ---
try {
  const filePath = join(process.cwd(), 'service-account.json');
  const raw = readFileSync(filePath, 'utf8');
  serviceAccount = JSON.parse(raw);
  console.log('✅ [Firebase Admin] Đã tải cấu hình từ file service-account.json');
} catch {
  // Bỏ qua lỗi nếu không có file JSON, sẽ chuyển sang dùng biến môi trường
}

// --- 2. Fallback: Đọc từ biến môi trường (Nếu không có file JSON) ---
if (!serviceAccount) {
  const projectId   = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const rawKey      = process.env.FIREBASE_PRIVATE_KEY;

  // Xử lý private key: convert \n literal thành ký tự xuống dòng thật
  const privateKey = rawKey
    ?.replace(/^["']|["']$/g, '') // Xóa dấu ngoặc bao quanh (nếu có)
    ?.replace(/\\n/g, '\n')        // Chuyển \n literal → newline thật
    ?.trim();

  // Diagnostic Logs (giúp debug nhanh)
  console.log('--- Firebase Admin Diagnostic (Env Vars) ---');
  console.log('PROJECT_ID    :', projectId   ? `✅ ${projectId}` : '❌ Undefined');
  console.log('CLIENT_EMAIL  :', clientEmail ? `✅ ${clientEmail}` : '❌ Undefined');
  console.log('PRIVATE_KEY   :', privateKey
    ? `✅ ${privateKey.length} ký tự | Bắt đầu: ${privateKey.substring(0, 27)}...`
    : '❌ Undefined');
  console.log('--------------------------------------------');

  if (projectId && clientEmail && privateKey?.includes('-----BEGIN PRIVATE KEY-----')) {
    serviceAccount = { projectId, clientEmail, privateKey };
    console.log('✅ [Firebase Admin] Đã tải cấu hình từ biến môi trường thành công.');
  } else {
    console.warn('⚠️ [Firebase Admin] Không tìm thấy thông tin cấu hình hợp lệ (cả file JSON và biến môi trường).');
  }
}

// --- 3. Khởi tạo SDK ---
if (serviceAccount && !admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log('✅ [SERVER] Firebase Admin SDK đã được khởi tạo thành công.');
  } catch (error) {
    console.error('❌ [Firebase Admin] Lỗi khi khởi tạo:', error.message);
  }
}

const isReady = admin.apps.length > 0;
export const adminAuth = isReady ? admin.auth()      : null;
export const adminDb   = isReady ? admin.firestore() : null;
