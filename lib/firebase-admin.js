import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * FIREBASE ADMIN SDK CONFIGURATION
 * Optimized for Vercel Serverless environment.
 */

let serviceAccount = null;

// 1. Try reading from service-account.json (Local development)
try {
  const filePath = join(process.cwd(), 'service-account.json');
  const raw = readFileSync(filePath, 'utf8');
  serviceAccount = JSON.parse(raw);
  console.log('✅ [Firebase Admin] read service-account.json from file.');
} catch {
  // console.warn('⚠️ [Firebase Admin] service-account.json not found, falling back to env vars...');
}

// 2. Fallback to Environment Variables (Vercel production)
if (!serviceAccount) {
  const projectId   = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const rawKey      = process.env.FIREBASE_PRIVATE_KEY;

  // Clean the private key (handle Vercel line breaks and quotes)
  const privateKey  = rawKey
    ?.replace(/^["']|["']$/g, '') // Remove outer quotes
    ?.replace(/\\n/g, '\n')        // Handle escaped newlines
    ?.trim();

  if (projectId && clientEmail && privateKey?.includes('-----BEGIN PRIVATE KEY-----')) {
    serviceAccount = { projectId, clientEmail, privateKey };
    console.log('✅ [Firebase Admin] Using credentials from Environment Variables.');
  } else {
    // console.error('❌ [Firebase Admin] Missing valid credentials in BOTH file and env vars!');
  }
}

// 3. Initialize SDK (Singleton Pattern)
if (serviceAccount && !admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log('🚀 [Firebase Admin] SDK initialized successfully');
  } catch (error) {
    console.error('❌ [Firebase Admin] Initialization FAILED:', error.message);
  }
}

const isReady = admin.apps.length > 0;

export const adminAuth = isReady ? admin.auth()      : null;
export const adminDb   = isReady ? admin.firestore() : null;
export default admin;
