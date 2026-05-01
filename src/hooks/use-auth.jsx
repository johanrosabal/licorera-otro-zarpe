
'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
} from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import Image from 'next/image';
import { BrandLogo } from '@/components/brand-logo';

const AuthContext = createContext({
  user: null,
  loading: true,
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [siteName, setSiteName] = useState('LOS TIOS');
  const [siteSlogan, setSiteSlogan] = useState('LICORERA EXCLUSIVA');
  const [imagesLoaded, setImagesLoaded] = useState(false);

  useEffect(() => {
    // Wait for all assets (including images) to load
    const handleLoad = () => setImagesLoaded(true);

    if (document.readyState === 'complete') {
      setImagesLoaded(true);
    } else {
      window.addEventListener('load', handleLoad);
      return () => window.removeEventListener('load', handleLoad);
    }
  }, []);

  useEffect(() => {
    let unsubSnapshot = null;

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      // Clean up previous snapshot listener if any
      if (unsubSnapshot) {
        unsubSnapshot();
        unsubSnapshot = null;
      }

      if (firebaseUser) {
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        
        unsubSnapshot = onSnapshot(userDocRef, (docSnap) => {
          if (docSnap.exists()) {
            const userData = docSnap.data();
            setUser({
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              name: userData.name || firebaseUser.displayName,
              whatsapp: userData.whatsapp,
              photoURL: firebaseUser.photoURL,
              role: userData.role || 'CLIENT',
              locationUrl: userData.locationUrl,
            });
          } else {
            setUser({
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              name: firebaseUser.displayName,
              photoURL: firebaseUser.photoURL,
              whatsapp: null,
              role: 'CLIENT',
              locationUrl: null,
            });
          }
          setLoading(false);
        }, (error) => {
            // If we get a permission error, it might be because we just logged out.
            // Only set user if we still have a firebaseUser from the current scope.
            // But actually, if there's an error, we should probably not set a "fake" user if the auth state is changing.
            console.error("AuthProvider snapshot error:", error);
            
            // Only fall back to CLIENT if this is a genuine fetch error for a logged-in user
            if (auth.currentUser) {
                setUser({
                    uid: firebaseUser.uid,
                    email: firebaseUser.email,
                    name: firebaseUser.displayName,
                    photoURL: firebaseUser.photoURL,
                    whatsapp: null,
                    role: 'CLIENT',
                    locationUrl: null,
                });
            }
            setLoading(false);
        });

      } else {
        setUser(null);
        setLoading(false);
      }
    });

    const unsubSettings = onSnapshot(doc(db, 'settings', 'homepage'), (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setSiteName(data.siteName ?? 'LOS TIOS');
        setSiteSlogan(data.siteSlogan ?? 'LICORERA EXCLUSIVA');
      }
    });

    return () => {
      unsubscribe();
      unsubSettings();
      if (unsubSnapshot) unsubSnapshot();
    };
  }, []);

  const value = { user, loading };

  return (
    <AuthContext.Provider value={value}>
      {loading || !imagesLoaded ? (
        <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-background">
            <div className="animate-blur-in flex flex-col items-center w-full max-w-md px-8">
                <BrandLogo siteName={siteName} siteSlogan={siteSlogan} isSplash />
                <p className="mt-8 text-lg text-muted-foreground animate-pulse">Bienvenidos a la experiencia en Línea</p>
            </div>
        </div>
      ) : (
        children
      )}
    </AuthContext.Provider>
  );
};
