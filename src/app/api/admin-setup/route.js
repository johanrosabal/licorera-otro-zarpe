import { promises as fs } from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export async function POST(request) {
  try {
    const body = await request.json();
    const { secret, uid, name, email, whatsapp, locationUrl } = body;
    
    // Read secret from root file
    const filePath = path.join(process.cwd(), 'admin_secret.json');
    const fileContent = await fs.readFile(filePath, 'utf8');
    const { adminRegistrationSecret } = JSON.parse(fileContent);

    if (secret !== adminRegistrationSecret) {
      return NextResponse.json({ valid: false, message: 'Clave de administrador incorrecta.' }, { status: 401 });
    }

    // If uid is provided, set ADMIN role on the server securely via Firebase Admin SDK
    if (uid) {
      await adminDb.collection('users').doc(uid).set({
        authUID: uid,
        name: (name || '').trim(),
        email: email || '',
        whatsapp: (whatsapp || '').trim(),
        locationUrl: locationUrl || '',
        role: 'ADMIN',
        createdAt: new Date(),
        updatedAt: new Date(),
      }, { merge: true });

      return NextResponse.json({ valid: true, adminCreated: true });
    }

    return NextResponse.json({ valid: true });
  } catch (error) {
    console.error('Error verifying admin secret:', error);
    return NextResponse.json({ valid: false, error: 'Server error' }, { status: 500 });
  }
}
