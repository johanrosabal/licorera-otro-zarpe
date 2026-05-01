
import './globals.css'
import { Header } from '@/components/layout/header'
import { Footer } from '@/components/layout/footer'
import { Toaster } from "@/components/ui/toaster"
import { AuthProvider } from '@/hooks/use-auth'
import { CartProvider } from '@/hooks/use-cart'
import { FavoritesProvider } from '@/hooks/use-favorites'
import { ThemeProvider } from '@/components/theme-provider'
import { NotificationBanner } from '@/components/layout/notification-banner'

export const metadata = {
  title: {
    default: 'Licorera Otro Zarpe | Licores Premium y Selección Exclusiva',
    template: '%s | Licorera Otro Zarpe'
  },
  description: 'Descubre la mejor selección de licores premium, vinos y cervezas en Costa Rica. Entrega a domicilio rápida y segura. Calidad garantizada en cada botella.',
  keywords: ['licorera', 'licores costa rica', 'vinos', 'cervezas artesanales', 'whisky premium', 'ron', 'entrega licores', 'licorera online'],
  authors: [{ name: 'Licorera Otro Zarpe' }],
  creator: 'Licorera Otro Zarpe',
  openGraph: {
    type: 'website',
    locale: 'es_CR',
    url: 'https://licorera-otro-zarpe.web.app',
    siteName: 'Licorera Otro Zarpe',
    title: 'Licorera Otro Zarpe | Tu Licorera Premium',
    description: 'La mejor selección de licores con entrega a domicilio.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Licorera Otro Zarpe',
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
