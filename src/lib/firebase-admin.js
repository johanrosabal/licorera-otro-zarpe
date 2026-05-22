import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';

const initializeAdmin = () => {
  if (admin.apps.length > 0) return admin.app();

  try {
    // 1. Check for environment variable (highest priority)
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      try {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
        return admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
        });
      } catch (parseError) {
        console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY env var:', parseError);
        console.error('Length of env var:', process.env.FIREBASE_SERVICE_ACCOUNT_KEY?.length);
      }
    }

    // 2. Check for local file
    const keyPath = path.join(process.cwd(), 'firebase-admin-key.json');
    if (fs.existsSync(keyPath)) {
      try {
        const fileContent = fs.readFileSync(keyPath, 'utf8');
        if (fileContent.trim() !== '') {
          const serviceAccount = JSON.parse(fileContent);
          return admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
          });
        } else {
          console.warn('firebase-admin-key.json file is empty.');
        }
      } catch (parseError) {
        console.error('Failed to parse firebase-admin-key.json file:', parseError);
      }
    }

    // 3. Fallback to Project ID from Env
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    console.warn(`Firebase Admin: No credentials found, falling back to project: ${projectId || 'default'}`);
    
    return admin.initializeApp({
      projectId: projectId,
    });
  } catch (error) {
    console.error('Firebase Admin initialization error:', error);
    if (admin.apps.length === 0) {
        return admin.initializeApp();
    }
  }
};

const app = initializeAdmin();

export const adminAuth = admin.auth(app);
export const adminDb = admin.firestore(app);
export const adminStorage = admin.storage(app);
