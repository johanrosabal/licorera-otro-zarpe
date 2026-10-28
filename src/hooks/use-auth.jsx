
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
import { BrandLogo } from '@/components/brand-logo';
import { usePathname } from 'next/navigation';

const AuthContext = createContext({
  user: null,
  loading: true,
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [siteName, setSiteName] = useState(process.env.NEXT_PUBLIC_APP_NAME || 'MI TIENDA');
  const [siteSlogan, setSiteSlogan] = useState(process.env.NEXT_PUBLIC_APP_SLOGAN || 'LICORERA EXCLUSIVA');
  const [showSplash, setShowSplash] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    // Only show splash on the home page ('/') and only once per session
    if (pathname === '/') {
      const hasSeen = typeof window !== 'undefined' ? sessionStorage.getItem('has_seen_splash') : 'true';
      if (!hasSeen) {
        setShowSplash(true);
        sessionStorage.setItem('has_seen_splash', 'true');
        const timer = setTimeout(() => {
          setShowSplash(false);
        }, 2500);
        return () => clearTimeout(timer);
      }
    }
  }, [pathname]);

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
        const isGoogle = firebaseUser.providerData?.some(p => p.providerId === 'google.com') || false;
        
        unsubSnapshot = onSnapshot(userDocRef, (docSnap) => {
          if (docSnap.exists()) {
            const userData = docSnap.data();
            setUser({
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              name: userData.name || firebaseUser.displayName,
              whatsapp: userData.whatsapp || '',
              photoURL: firebaseUser.photoURL,
              role: userData.role || 'CLIENT',
              locationUrl: userData.locationUrl,
              isGoogle,
            });
          } else {
            setUser({
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              name: firebaseUser.displayName,
              photoURL: firebaseUser.photoURL,
              whatsapp: '',
              role: 'CLIENT',
              locationUrl: null,
              isGoogle,
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
                    whatsapp: '',
                    role: 'CLIENT',
                    locationUrl: null,
                    isGoogle,
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
        setSiteName(data.siteName ?? (process.env.NEXT_PUBLIC_APP_NAME || 'MI TIENDA'));
        setSiteSlogan(data.siteSlogan ?? (process.env.NEXT_PUBLIC_APP_SLOGAN || 'LICORERA EXCLUSIVA'));
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
      {showSplash && (
        <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-background pointer-events-none transition-opacity duration-500">
          <div className="animate-blur-in flex flex-col items-center w-full max-w-xl px-4">
            <BrandLogo siteName={siteName} siteSlogan={siteSlogan} isSplash />
            <p className="mt-8 text-lg text-muted-foreground animate-pulse text-center">
              Bienvenidos a la experiencia en Línea
            </p>
          </div>
        </div>
      )}
      {children}
    </AuthContext.Provider>
  );
};
