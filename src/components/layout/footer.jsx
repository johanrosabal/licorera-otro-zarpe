

'use client'

import Link from 'next/link'
import { Phone, Facebook, Instagram, Twitter } from 'lucide-react'
import { useState, useEffect } from 'react'
import { onSnapshot, doc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import Image from 'next/image'

function WhatsAppIcon(props) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
        </svg>
    )
}

export function Footer() {
  const currentYear = new Date().getFullYear()
  const [socials, setSocials] = useState({ facebookUrl: '', instagramUrl: '', twitterUrl: '', whatsappUrl: '' });

  useEffect(() => {
    const settingsRef = doc(db, 'settings', 'homepage');
    const unsubscribe = onSnapshot(settingsRef, (doc) => {
        if (doc.exists()) {
            const data = doc.data();
            setSocials({
                facebookUrl: data.facebookUrl || '',
                instagramUrl: data.instagramUrl || '',
                twitterUrl: data.twitterUrl || '',
                whatsappUrl: data.whatsappUrl || '',
            });
        }
    });

    return () => unsubscribe();
  }, []);

  return (
    <footer className="bg-secondary text-secondary-foreground">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-2">
            <Link href="/">
                <Image
                    src="https://firebasestorage.googleapis.com/v0/b/licorera-otro-zarpe.firebasestorage.app/o/settings%2FOtro_Zarpe_Logo.png?alt=media&token=7d496c2b-533a-4651-8ffa-3e4ce3ca598e"
                    alt="Otro Zarpe Logo"
                    width={180}
                    height={30}
                    unoptimized
                    className="hidden dark:block"
                />
                 <Image
                    src="https://firebasestorage.googleapis.com/v0/b/licorera-otro-zarpe.firebasestorage.app/o/settings%2FLogoTemaClaro.png?alt=media&token=df823679-246c-43b3-890c-68b9a612e2d1"
                    alt="Otro Zarpe Logo"
                    width={180}
                    height={30}
                    unoptimized
                    className="block dark:hidden"
                />
            </Link>
          </div>
          <nav className="flex gap-6 font-medium">
            <Link href="/" className="hover:text-primary transition-colors">
              Inicio
            </Link>
            <Link href="/products" className="hover:text-primary transition-colors">
              Productos
            </Link>
          </nav>
          <div className="flex gap-4">
             {socials.whatsappUrl && (
              <Link href={socials.whatsappUrl} target="_blank" rel="noopener noreferrer" className="text-secondary-foreground/70 hover:text-primary transition-colors">
                <WhatsAppIcon className="h-6 w-6" />
              </Link>
            )}
            {socials.facebookUrl && (
              <Link href={socials.facebookUrl} target="_blank" rel="noopener noreferrer" className="text-secondary-foreground/70 hover:text-primary transition-colors">
                <Facebook className="h-6 w-6" />
              </Link>
            )}
            {socials.instagramUrl && (
              <Link href={socials.instagramUrl} target="_blank" rel="noopener noreferrer" className="text-secondary-foreground/70 hover:text-primary transition-colors">
                <Instagram className="h-6 w-6" />
              </Link>
            )}
             {socials.twitterUrl && (
              <Link href={socials.twitterUrl} target="_blank" rel="noopener noreferrer" className="text-secondary-foreground/70 hover:text-primary transition-colors">
                <Twitter className="h-6 w-6" />
              </Link>
            )}
          </div>
        </div>
        <div className="mt-8 pt-8 border-t border-border text-center text-sm text-muted-foreground">
          <p>&copy; {currentYear} Licorera Otro Zarpe. Todos los derechos reservados.</p>
          <p className="mt-1">El consumo de alcohol es perjudicial para la salud. Prohibida la venta a menores de 18 años.</p>
        </div>
      </div>
    </footer>
  )
}
