import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { uid } = await request.json();

    if (!uid) {
      return NextResponse.json({ message: 'UID is required' }, { status: 400 });
    }

    // Optional: Verify the requester is an admin
    // In a real app, you'd verify the ID Token from the Authorization header:
    /*
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    if (decodedToken.role !== 'ADMIN') return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    */

    // 1. Delete from Firebase Authentication
    try {
      await adminAuth.deleteUser(uid);
    } catch (authError) {
      // If user doesn't exist in Auth, we still want to delete from Firestore
      console.warn('Auth deletion warning:', authError.message);
      if (authError.code !== 'auth/user-not-found') {
        throw authError;
      }
    }

    // 2. Delete from Firestore users collection
    await adminDb.collection('users').doc(uid).delete();

    return NextResponse.json({ success: true, message: 'Usuario eliminado correctamente.' });
  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json(
      { message: error.message || 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
