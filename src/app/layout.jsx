
import './globals.css'
import { Header } from '@/components/layout/header'
import { Footer } from '@/components/layout/footer'
import { Toaster } from "@/components/ui/toaster"
import { AuthProvider } from '@/hooks/use-auth'
import { CartProvider } from '@/hooks/use-cart'
import { FavoritesProvider } from '@/hooks/use-favorites'
import { ThemeProvider } from '@/components/theme-provider'
import { NotificationBanner } from '@/components/layout/notification-banner'

const siteName = process.env.NEXT_PUBLIC_APP_NAME || 'LICORERA';
const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `https://${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'licorera-otro-zarpe'}.web.app`;

export const metadata = {
  metadataBase: new URL(baseUrl),
  title: {
    default: `${siteName} | Licores Premium y Selección Exclusiva`,
    template: `%s | ${siteName}`
  },
  description: 'Descubre la mejor selección de licores premium, vinos y cervezas en Costa Rica. Entrega a domicilio rápida y segura. Calidad garantizada en cada botella.',
  keywords: ['licorera', 'licores costa rica', 'vinos', 'cervezas artesanales', 'whisky premium', 'ron', 'entrega licores', 'licorera online'],
  authors: [{ name: siteName }],
  creator: siteName,
  openGraph: {
    type: 'website',
    locale: 'es_CR',
    url: baseUrl,
    siteName: siteName,
    title: `${siteName} | Tu Licorera Premium`,
    description: 'La mejor selección de licores con entrega a domicilio.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: siteName,
      },
    ],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;700;900&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased bg-background text-foreground">
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <AuthProvider>
            <FavoritesProvider>
              <CartProvider>
                <NotificationBanner />
                <div className="flex flex-col min-h-screen">
                  <Header />
                  <main className="flex-grow">
                    {children}
                  </main>
                  <Footer />
                </div>
                <Toaster />
              </CartProvider>
            </FavoritesProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
