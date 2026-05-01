import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';

const initializeAdmin = () => {
  if (admin.apps.length > 0) return admin.app();

  try {
    // 1. Check for environment variable (highest priority)
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
      return admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    }

    // 2. Check for local file
    const keyPath = path.join(process.cwd(), 'firebase-admin-key.json');
    if (fs.existsSync(keyPath)) {
      const fileContent = fs.readFileSync(keyPath, 'utf8');
      const serviceAccount = JSON.parse(fileContent);
      return admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    }

    // 3. Fallback to ADC
    console.warn('Firebase Admin: No credentials found, falling back to Application Default Credentials.');
    return admin.initializeApp({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'licorera-otro-zarpe',
    });
  } catch (error) {
    console.error('Firebase Admin initialization error:', error);
    // Last resort fallback to avoid app crash
    if (admin.apps.length === 0) {
        return admin.initializeApp({
            projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'licorera-otro-zarpe',
        });
    }
  }
};

const app = initializeAdmin();

export const adminAuth = admin.auth(app);
export const adminDb = admin.firestore(app);
export const adminStorage = admin.storage(app);
