import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export async function GET() {
  try {
    const settingsRef = adminDb.collection('settings').doc('library_config');
    const doc = await settingsRef.get();
    
    if (!doc.exists) {
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
