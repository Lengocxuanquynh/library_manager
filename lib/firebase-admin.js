import admin from 'firebase-admin';

const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY;

// Kiểm tra nhanh các biến môi trường
console.log("--- Firebase Admin Config Check ---");
console.log("NEXT_PUBLIC_FIREBASE_PROJECT_ID:", projectId ? "✅ Có dữ liệu" : "❌ Undefined");
console.log("FIREBASE_CLIENT_EMAIL:", clientEmail ? "✅ Có dữ liệu" : "❌ Undefined");
console.log("FIREBASE_PRIVATE_KEY:", privateKey ? `✅ Có dữ liệu (Độ dài: ${privateKey.length} ký tự)` : "❌ Undefined");
console.log("-----------------------------------");

if (!admin.apps.length) {
  try {
    if (projectId && clientEmail && privateKey && privateKey.includes("PRIVATE KEY")) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: projectId,
          clientEmail: clientEmail,
          // Replace escaped newlines with actual newlines if present
          privateKey: privateKey.replace(/\\n/g, '\n'),
        })
      });
      console.log("✅ Firebase Admin SDK khởi tạo THÀNH CÔNG!");
    } else {
      console.warn("⚠️ Firebase Admin SDK chưa được khởi tạo: Thiếu hoặc sai định dạng credentials.");
    }
  } catch (error) {
    console.error('❌ Firebase Admin SDK khởi tạo LỖI:', error.message);
  }
}

export const adminAuth = admin.apps.length ? admin.auth() : null;
export const adminDb = admin.apps.length ? admin.firestore() : null;
