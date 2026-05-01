import admin from 'firebase-admin';

if (!admin.apps.length) {
  try {
    // 1. Try environment variable
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    } 
    // 2. Try local file (for dev)
    else {
      try {
        const path = require('path');
        const fs = require('fs');
        const keyPath = path.join(process.cwd(), 'firebase-admin-key.json');
        
        if (fs.existsSync(keyPath)) {
          admin.initializeApp({
            credential: admin.credential.cert(keyPath),
          });
        } else {
          // 3. Fallback for environments with ADC
          admin.initializeApp({
            projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'licorera-otro-zarpe',
          });
        }
      } catch (e) {
        // Fallback if require fails (Edge runtime etc)
        admin.initializeApp({
          projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'licorera-otro-zarpe',
        });
      }
    }
  } catch (error) {
    console.error('Firebase Admin initialization error:', error);
  }
}

export const adminAuth = admin.auth();
export const adminDb = admin.firestore();
