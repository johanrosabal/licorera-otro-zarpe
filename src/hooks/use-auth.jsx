
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

const AuthContext = createContext({
  user: null,
  loading: true,
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        
        // Use onSnapshot for real-time role updates
        const unsubSnapshot = onSnapshot(userDocRef, (docSnap) => {
          if (docSnap.exists()) {
            const userData = docSnap.data();
            setUser({
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              name: userData.name || firebaseUser.displayName,
              whatsapp: userData.whatsapp,
              photoURL: firebaseUser.photoURL,
              role: userData.role || 'CLIENT', // Default to CLIENT if role is not set
              locationUrl: userData.locationUrl,
            });
          } else {
            // If user doc doesn't exist, they are a regular client.
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
            console.error("Error fetching user role:", error);
            setUser({
                uid: firebaseUser.uid,
                email: firebaseUser.email,
                name: firebaseUser.displayName,
                photoURL: firebaseUser.photoURL,
                whatsapp: null,
                role: 'CLIENT',
                locationUrl: null,
            });
            setLoading(false);
        });

        return () => unsubSnapshot();

      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const value = { user, loading };

  return (
    <AuthContext.Provider value={value}>
      {loading ? (
        <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-background">
            <div className="animate-blur-in flex flex-col items-center w-full max-w-md px-8">
                <Image
                    src="https://firebasestorage.googleapis.com/v0/b/licorera-otro-zarpe.firebasestorage.app/o/settings%2FOtro_Zarpe_Logo.png?alt=media&token=7d496c2b-533a-4651-8ffa-3e4ce3ca598e"
                    alt="Otro Zarpe Logo"
                    width={400}
                    height={67}
                    unoptimized
                    priority
                    className="hidden dark:block"
                />
                <Image
                    src="https://firebasestorage.googleapis.com/v0/b/licorera-otro-zarpe.firebasestorage.app/o/settings%2FLogoTemaClaro.png?alt=media&token=df823679-246c-43b3-890c-68b9a612e2d1"
                    alt="Otro Zarpe Logo"
                    width={400}
                    height={67}
                    unoptimized
                    priority
                    className="block dark:hidden"
                />
                <p className="mt-8 text-lg text-muted-foreground">Bienvenidos a la experiencia en Línea</p>
            </div>
        </div>
      ) : (
        children
      )}
    </AuthContext.Provider>
  );
};
