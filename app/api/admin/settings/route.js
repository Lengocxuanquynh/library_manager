import { NextResponse } from 'next/server';
import admin, { adminDb } from '@/lib/firebase-admin';

export async function GET() {
  try {
    const settingsRef = adminDb.collection('settings').doc('library_config');
    const doc = await settingsRef.get();
    
    if (!doc.exists) {
      // Trả về cấu hình mặc định nếu chưa có
      return NextResponse.json({
        excludeSundays: true,
        holidays: []
      });
    }
    
    return NextResponse.json(doc.data());
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { excludeSundays, holidays } = body;
    
    const settingsRef = adminDb.collection('settings').doc('library_config');
    
    await settingsRef.set({
      excludeSundays: excludeSundays ?? true,
      holidays: holidays || [],
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    
    return NextResponse.json({ success: true, message: 'Cấu hình hệ thống đã được cập nhật.' });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
