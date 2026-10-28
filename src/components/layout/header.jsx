'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { LayoutDashboard, Menu, LogOut, User as UserIcon, Shield, ListTree, ShoppingBag, Scaling, Bookmark, Warehouse, FileText, Truck, Receipt, Settings, Landmark, Wallet, CreditCard, ChevronDown, Package, PackageCheck, Users, TrendingUp, Share2, BookOpen, BarChart, Route, AlertTriangle, Heart, MessageSquare, Megaphone, Loader2, Bell, PlayCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/use-auth'
import { signOut, GoogleAuthProvider, signInWithPopup } from 'firebase/auth'
import { auth, db } from '@/lib/firebase'
import { useToast } from '@/hooks/use-toast'
import { onSnapshot, doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { CompleteProfileDialog } from '../auth/complete-profile-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar'
import React from 'react'
import { useCart } from '@/hooks/use-cart'
import { CartSheet } from '../cart/cart-sheet'
import { ScrollArea } from '../ui/scroll-area'
import Image from 'next/image'
import { ThemeToggle } from '../theme-toggle'
import { BrandLogo } from '../brand-logo'
import { DemoCheckoutDialog } from '../demo-checkout-dialog'

const navLinks = [
  { href: '/', label: 'Inicio' },
  { href: '/products', label: 'Productos' },
]

const adminLinks = [
    { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['ADMIN'] },
    { href: '/admin/orders', label: 'Órdenes', icon: FileText, roles: ['ADMIN'] },
    { 
        label: 'Reparto', 
        icon: Truck,
        roles: ['ADMIN', 'DELIVERY', 'REPARTIDOR'],
        isDropdown: true,
        subLinks: [
            { href: '/admin/picking', label: 'Preparación', icon: PackageCheck },
            { href: '/admin/shipping', label: 'Envíos', icon: Truck },
            { href: '/admin/delivery-fees', label: 'Tarifas de Envío', icon: Route },
        ] 
    },
    { href: '/admin/inventory/report', label: 'Inventario', icon: Warehouse, roles: ['ADMIN'] },
    { 
        label: 'Finanzas', 
        icon: Landmark,
        roles: ['ADMIN'],
        isDropdown: true,
        subLinks: [
            { href: '/admin/sales-report', label: 'Reporte de Ventas', icon: BarChart },
            { href: '/admin/purchases', label: 'Facturas de Compra', icon: Receipt },
            { href: '/admin/projections', label: 'Proyecciones', icon: TrendingUp },
            { href: '/admin/banks', label: 'Bancos', icon: Landmark },
            { href: '/admin/bank-accounts', label: 'Cuentas Bancarias', icon: Wallet },
            { href: '/admin/payment-methods', label: 'Métodos de Pago', icon: CreditCard },
        ] 
    },
     { 
        label: 'Gestión de Contenido', 
        icon: Settings,
        roles: ['ADMIN'],
        isDropdown: true,
        subLinks: [
             { href: '/admin/notifications', label: 'Notificaciones', icon: Megaphone },
             { href: '/admin/reviews', label: 'Gestión de Reseñas', icon: MessageSquare },
             { href: '/admin/products', label: 'Productos', icon: Package },
             { href: '/admin/suppliers', label: 'Proveedores', icon: Truck },
             { href: '/admin/categories', label: 'Categorías', icon: ListTree },
             { href: '/admin/units-of-measure', label: 'Unidades', icon: Scaling },
             { href: '/admin/brands', label: 'Marcas', icon: Bookmark },
             { href: '/admin/users', label: 'Usuarios', icon: Users },
             { href: '/admin/settings', label: 'Tienda', icon: Settings },
             { href: '/admin/error-log', label: 'Log de Errores', icon: AlertTriangle },
             { href: '/admin/documentation', label: 'Documentación', icon: BookOpen },
        ]
    }
]

export function Header() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, loading } = useAuth()
  const { toast } = useToast()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false)
  const [googleLoading, setGoogleLoading] = React.useState(false)
  const [isCompleteProfileOpen, setIsCompleteProfileOpen] = React.useState(false)
  const [isDemoOpen, setIsDemoOpen] = React.useState(false)

  const isGoogleUser = user?.isGoogle || (typeof window !== 'undefined' && auth.currentUser?.providerData?.some(p => p.providerId === 'google.com'));
  const isMissingName = Boolean(user && (!user.name || !user.name.trim() || user.name.trim().toLowerCase() === 'usuario'));
  const isMissingWhatsapp = Boolean(user && (!user.whatsapp || !user.whatsapp.trim()));
  const needsProfileCompletion = Boolean(user && (isMissingName || isMissingWhatsapp));

  const missingFieldsLabel = React.useMemo(() => {
    if (isMissingName && isMissingWhatsapp) return 'nombre completo y número de WhatsApp';
    if (isMissingName) return 'nombre completo';
    if (isMissingWhatsapp) return 'número de WhatsApp';
    return '';
  }, [isMissingName, isMissingWhatsapp]);

  // Prompt the user automatically once per session if they log in with Google and lack WhatsApp or Name
  React.useEffect(() => {
    if (!loading && user && needsProfileCompletion) {
      const sessionKey = `has_prompted_profile_${user.uid}`;
      const hasPrompted = typeof window !== 'undefined' ? sessionStorage.getItem(sessionKey) : 'true';
      if (!hasPrompted) {
        sessionStorage.setItem(sessionKey, 'true');
        setIsCompleteProfileOpen(true);
      }
    }
  }, [loading, user, needsProfileCompletion]);

  const handleGoogleAuth = async () => {
    setGoogleLoading(true);
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      const userDocRef = doc(db, 'users', user.uid);
      const userDocSnap = await getDoc(userDocRef);

      if (!userDocSnap.exists()) {
        await setDoc(userDocRef, {
          authUID: user.uid,
          name: user.displayName || user.email?.split('@')[0] || 'Usuario',
          email: user.email || '',
          photoURL: user.photoURL || '',
          whatsapp: '',
          locationUrl: '',
          role: 'CLIENT',
          createdAt: serverTimestamp(),
        });
      }

      toast({ title: '¡Bienvenido!', description: `Hola, ${user.displayName || 'Usuario'}` });
      setIsMobileMenuOpen(false);

      const userRole = userDocSnap.exists() ? (userDocSnap.data().role || 'CLIENT') : 'CLIENT';
      if (userRole === 'ADMIN') {
        router.push('/admin/dashboard');
      } else if (userRole === 'REPARTIDOR' || userRole === 'DELIVERY') {
        router.push('/admin/shipping');
      }
    } catch (error) {
      console.error("Google Auth Error:", error);
      if (error.code === 'auth/popup-closed-by-user') return;

      if (error.code === 'auth/unauthorized-domain') {
        toast({
          title: 'Dominio no autorizado',
          description: `Añade "${typeof window !== 'undefined' ? window.location.hostname : 'localhost'}" a los dominios autorizados en Firebase (Auth > Ajustes).`,
          variant: 'destructive',
        });
        return;
      }

      if (error.code === 'auth/account-exists-with-different-credential') {
        toast({
          title: 'Cuenta ya existe',
          description: 'Ya tienes una cuenta registrada con este correo usando otro método. Inicia sesión con contraseña.',
          variant: 'destructive',
        });
        return;
      }

      if (error.code === 'auth/popup-blocked') {
        toast({
          title: 'Ventana emergente bloqueada',
          description: 'Por favor permite las ventanas emergentes en tu navegador para continuar con Google.',
          variant: 'destructive',
        });
        return;
      }

      toast({
        title: 'Error de autenticación',
        description: error.message || 'No se pudo iniciar sesión con Google.',
        variant: 'destructive',
      });
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth)
      toast({ title: 'Sesión cerrada', description: 'Has cerrado sesión exitosamente.' })
      router.push('/')
    } catch (error) {
      toast({ title: 'Error', description: 'No se pudo cerrar la sesión.', variant: 'destructive' })
    }
  }

  const getInitials = (nameOrEmail) => {
    if (!nameOrEmail) return 'U';
    const names = nameOrEmail.split(' ');
    if (names.length > 1 && names[0].length > 0 && names[1].length > 0) {
        return `${names[0][0]}${names[1][0]}`.toUpperCase();
    }
    return nameOrEmail.charAt(0).toUpperCase();
  }
  
  const visibleAdminLinks = user ? adminLinks.filter(link => link.roles.includes(user.role)) : [];
  const { totalItems } = useCart();
  const [isCartOpen, setIsCartOpen] = React.useState(false);
  const [deliveriesEnabled, setDeliveriesEnabled] = React.useState(true);
  const [storeLocationUrl, setStoreLocationUrl] = React.useState('');
  const [siteName, setSiteName] = React.useState(process.env.NEXT_PUBLIC_APP_NAME || 'MI TIENDA');
  const [siteSlogan, setSiteSlogan] = React.useState(process.env.NEXT_PUBLIC_APP_SLOGAN || 'LICORERA EXCLUSIVA');

  React.useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'homepage'), (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setDeliveriesEnabled(data.deliveriesEnabled ?? true);
        setStoreLocationUrl(data.storeLocationUrl ?? '');
        setSiteName(data.siteName ?? 'OTRO ZARPE');
        setSiteSlogan(data.siteSlogan ?? 'PREMIUM SELECTION');
      }
    });
    return () => unsub();
  }, []);

  const processedAdminLinks = React.useMemo(() => {
    return visibleAdminLinks.map(link => {
      if (link.label === 'Reparto') {
        const filteredSubLinks = link.subLinks.filter(sub => {
          if (!deliveriesEnabled && (sub.label === 'Envíos' || sub.label === 'Tarifas de Envío')) {
            return false;
          }
          return true;
        });
        return { ...link, subLinks: filteredSubLinks };
      }
      return link;
    });
  }, [visibleAdminLinks, deliveriesEnabled]);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <CartSheet open={isCartOpen} onOpenChange={setIsCartOpen} />

      {/* ── Notification Banner: Missing Profile Info (Google / Email) ── */}
      {!loading && needsProfileCompletion && (
        <div className="bg-amber-500/15 border-b border-amber-500/30 text-amber-950 dark:text-amber-100 px-4 py-2 text-xs sm:text-sm animate-in fade-in slide-in-from-top-1">
          <div className="container mx-auto max-w-7xl flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
              </span>
              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <span className="text-xs sm:text-sm font-medium">
                <strong>Notificación:</strong> Falta ingresar tu <strong>{missingFieldsLabel}</strong> vinculado a tu correo (<strong>{user.email}</strong>).
              </span>
            </div>
            <Button
              size="sm"
              onClick={() => setIsCompleteProfileOpen(true)}
              className="h-7 px-3 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white shadow-sm shrink-0"
            >
              Ingresar datos
            </Button>
          </div>
        </div>
      )}

      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

        {/* ── DESKTOP Logo (Centered) ── */}
        <div className="hidden md:flex h-20 items-center justify-center">
            <Link href="/" className="flex items-center gap-2">
                <BrandLogo siteName={siteName} siteSlogan={siteSlogan} />
            </Link>
        </div>

        {/* ── MOBILE Header (Integrated Single Row) ── */}
        <div className="flex md:hidden h-16 items-center justify-between gap-2">
            {/* Left: Mobile hamburger menu */}
            <div className="flex items-center">
                <MobileMenu
                    user={user} loading={loading} handleLogout={handleLogout}
                    handleGoogleAuth={handleGoogleAuth} googleLoading={googleLoading}
                    visibleAdminLinks={processedAdminLinks}
                    isOpen={isMobileMenuOpen} setIsOpen={setIsMobileMenuOpen}
                    onCartClick={() => setIsCartOpen(true)}
                    storeLocationUrl={storeLocationUrl}
                    siteName={siteName}
                    siteSlogan={siteSlogan}
                    needsProfileCompletion={needsProfileCompletion}
                    missingFieldsLabel={missingFieldsLabel}
                    onOpenCompleteProfile={() => setIsCompleteProfileOpen(true)}
                    onOpenDemo={() => setIsDemoOpen(true)}
                />
            </div>

            {/* Center: Brand Logo */}
            <div className="flex items-center justify-center flex-1 px-1 overflow-hidden">
                <Link href="/" className="flex items-center justify-center">
                    <BrandLogo siteName={siteName} siteSlogan={siteSlogan} isMobile />
                </Link>
            </div>

            {/* Right: Actions (Theme toggle, notifications, cart/login) */}
            <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                {user && needsProfileCompletion && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsCompleteProfileOpen(true)}
                    className="relative h-9 w-9 text-amber-600 dark:text-amber-400"
                    title={`Falta ingresar tu ${missingFieldsLabel}`}
                  >
                    <Bell className="h-5 w-5" />
                    <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-amber-500 animate-ping" />
                    <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-amber-500" />
                  </Button>
                )}
                <ThemeToggle />
                {user ? (
                    <Button variant="ghost" size="icon" className="relative h-9 w-9" onClick={() => setIsCartOpen(true)} aria-label="Carrito de compras">
                        <ShoppingBag className="h-5 w-5" />
                        {totalItems > 0 && (
                            <span className="absolute -top-1 -right-1 inline-flex items-center justify-center min-w-[20px] h-5 px-1 text-xs font-bold text-white bg-primary rounded-full">
                                {totalItems}
                            </span>
                        )}
                    </Button>
                ) : (
                    <Button asChild variant="ghost" size="sm">
                        <Link href="/login">Ingresar</Link>
                    </Button>
                )}
            </div>
        </div>

        {/* ── DESKTOP Navigation Bar ── */}
        <div className="hidden md:flex h-14 items-center justify-between border-t border-border/40">
            {/* Center: public links only */}
            <nav className="flex flex-1 items-center justify-center gap-8 text-sm">
                {navLinks.map((link) => (
                    <Link key={link.href} href={link.href}
                        className={cn('transition-colors hover:text-primary font-medium',
                            pathname === link.href ? 'text-primary font-semibold' : 'text-foreground/60'
                        )}
                    >
                        {link.label}
                    </Link>
                ))}
                <button
                    type="button"
                    onClick={() => setIsDemoOpen(true)}
                    className="inline-flex items-center gap-1.5 transition-colors hover:text-primary font-medium text-foreground/70 hover:bg-primary/5 px-2.5 py-1 rounded-md cursor-pointer"
                >
                    <PlayCircle className="h-4 w-4 text-primary" />
                    <span>Demo Checkout</span>
                </button>
            </nav>

            {/* Right: auth + cart */}
            <div className="flex flex-1 items-center justify-end gap-2">
                <AuthButtons 
                    user={user} 
                    loading={loading} 
                    handleLogout={handleLogout}
                    handleGoogleAuth={handleGoogleAuth}
                    googleLoading={googleLoading}
                    getInitials={getInitials} 
                    onCartClick={() => setIsCartOpen(true)} 
                    needsProfileCompletion={needsProfileCompletion}
                    missingFieldsLabel={missingFieldsLabel}
                    onOpenCompleteProfile={() => setIsCompleteProfileOpen(true)}
                />
            </div>
        </div>
      </div>

      {/* ── ADMIN Navigation Bar (separate second row, desktop only) ── */}
      {!loading && user && user.role !== 'CLIENT' && visibleAdminLinks.length > 0 && (
        <div className="hidden md:block border-t border-border/60 bg-muted/50">
          <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex h-10 items-center gap-1">

              {/* "Admin" badge */}
              <div className="flex items-center gap-1.5 pr-3 border-r border-border/60 mr-1 shrink-0">
                <Shield className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-bold text-primary uppercase tracking-wider">Admin</span>
              </div>

              {/* Admin nav items */}
              {processedAdminLinks.map((link) => {
                if (link.isDropdown) {
                  const isSublinkActive = link.subLinks.some(sub => pathname.startsWith(sub.href));
                  return (
                    <DropdownMenu key={link.label}>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className={cn(
                          'h-7 px-2.5 text-xs gap-1 transition-colors hover:text-primary hover:bg-primary/10',
                          isSublinkActive ? 'text-primary font-semibold bg-primary/10' : 'text-foreground/60'
                        )}>
                          <link.icon className="h-3.5 w-3.5" />
                          {link.label}
                          <ChevronDown className="h-3 w-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="min-w-[180px]">
                        {link.subLinks.map(sub => (
                          <DropdownMenuItem key={sub.href} asChild>
                            <Link href={sub.href} className={cn(pathname.startsWith(sub.href) && 'text-primary font-semibold')}>
                              <sub.icon className="mr-2 h-4 w-4" />
                              {sub.label}
                            </Link>
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  );
                }
                return (
                  <Button key={link.href} asChild variant="ghost" size="sm" className={cn(
                    'h-7 px-2.5 text-xs gap-1 transition-colors hover:text-primary hover:bg-primary/10',
                    pathname.startsWith(link.href) ? 'text-primary font-semibold bg-primary/10' : 'text-foreground/60'
                  )}>
                    <Link href={link.href}>
                      <link.icon className="h-3.5 w-3.5" />
                      {link.label}
                    </Link>
                  </Button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Dialog to Complete Profile (Google / Missing Info) ── */}
      <CompleteProfileDialog
        open={isCompleteProfileOpen}
        onOpenChange={setIsCompleteProfileOpen}
        user={user}
      />

      {/* ── Dialog Demo Checkout Video ── */}
      <DemoCheckoutDialog
        open={isDemoOpen}
        onOpenChange={setIsDemoOpen}
      />
    </header>
  )
}


function GoogleIcon({ className = "h-4 w-4" }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
    </svg>
  );
}

const AuthButtons = ({ 
  user, 
  loading, 
  handleLogout, 
  handleGoogleAuth, 
  googleLoading, 
  getInitials, 
  onCartClick, 
  needsProfileCompletion, 
  missingFieldsLabel, 
  onOpenCompleteProfile 
}) => {
  const { totalItems } = useCart();
  if (loading) return null;
  return (
    <div className="hidden md:flex items-center gap-2">
      {user ? (
        <>
          {needsProfileCompletion && (
            <Button
              variant="outline"
              size="sm"
              onClick={onOpenCompleteProfile}
              className="h-8 gap-1.5 border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 text-xs font-semibold rounded-full animate-in fade-in"
              title={`Falta ingresar tu ${missingFieldsLabel}`}
            >
              <Bell className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 animate-bounce" />
              <span className="hidden xl:inline">Completar datos</span>
              <span className="h-2 w-2 rounded-full bg-amber-500" />
            </Button>
          )}
          <Button asChild variant="ghost">
            <Link href="/my-orders">
              <FileText className="mr-2 h-5 w-5" />
              <span>Mis Órdenes</span>
            </Link>
          </Button>
          <Button variant="ghost" onClick={onCartClick}>
            <ShoppingBag className="mr-2 h-5 w-5" />
            <span>Carrito</span>
            {totalItems > 0 && (
              <span className="ml-2 inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-primary rounded-full">
                {totalItems}
              </span>
            )}
          </Button>
          <ThemeToggle />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={user.photoURL ?? ''} alt={user.name ?? ''} />
                  <AvatarFallback>{getInitials(user.name || user.email)}</AvatarFallback>
                </Avatar>
                {needsProfileCompletion && (
                  <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500 border-2 border-background"></span>
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">{user.name || user.email}</p>
                  <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {needsProfileCompletion && (
                <>
                  <DropdownMenuItem onClick={onOpenCompleteProfile} className="text-amber-600 dark:text-amber-400 font-semibold focus:text-amber-600 cursor-pointer">
                    <AlertTriangle className="mr-2 h-4 w-4" />
                    <span>Completar datos ({missingFieldsLabel})</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem asChild>
                <Link href="/favorites"><Heart className="mr-2 h-4 w-4" /><span>Mis Favoritos</span></Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/profile"><UserIcon className="mr-2 h-4 w-4" /><span>Mi Perfil</span></Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/share"><Share2 className="mr-2 h-4 w-4" /><span>Compartir Catálogo</span></Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" /><span>Cerrar sesión</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      ) : (
        <>
          <ThemeToggle />
          <Button asChild variant="ghost" size="sm"><Link href="/login">Ingresar</Link></Button>
        </>
      )}
    </div>
  );
}

const MobileMenu = ({ 
  user, 
  loading, 
  handleLogout, 
  handleGoogleAuth, 
  googleLoading, 
  visibleAdminLinks, 
  isOpen, 
  setIsOpen, 
  onCartClick, 
  storeLocationUrl, 
  siteName, 
  siteSlogan, 
  needsProfileCompletion, 
  missingFieldsLabel, 
  onOpenCompleteProfile,
  onOpenDemo,
}) => {
    const pathname = usePathname();
    const handleLinkClick = () => setIsOpen(false);
    const handleActionClick = (action) => { action(); setIsOpen(false); };
    
    const renderAdminLink = (link) => {
        const Icon = link.icon;
        const isActive = pathname.startsWith(link.href);
        return (
            <Button asChild variant={isActive ? "secondary" : "outline"} className="w-full justify-start" key={link.href}>
                <Link href={link.href} onClick={handleLinkClick}>
                    <Icon className="mr-2 h-4 w-4" />
                    {link.label}
                </Link>
            </Button>
        )
    }
    
    return (
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetTrigger asChild>
            <Button variant="ghost" size="icon">
            <Menu className="h-6 w-6" />
            <span className="sr-only">Abrir menú</span>
            </Button>
        </SheetTrigger>
        <SheetContent side="left" className="flex flex-col">
            <SheetHeader>
                <SheetTitle>
                    <Link href="/" className="flex items-center gap-2" onClick={handleLinkClick}>
                       <BrandLogo siteName={siteName} siteSlogan={siteSlogan} isMobile />
                    </Link>
                </SheetTitle>
            </SheetHeader>
            <ScrollArea className="flex-1">
                <div className="flex flex-col gap-4 p-4">
                <nav className="flex flex-col gap-4">
                    {navLinks.map((link) => (
                    <Link key={link.href} href={link.href} onClick={handleLinkClick}
                        className={cn('text-lg', pathname === link.href ? 'text-primary font-bold' : 'text-foreground')}
                    >
                        {link.label}
                    </Link>
                    ))}
                    <button
                        type="button"
                        onClick={() => {
                            setIsOpen(false);
                            if (onOpenDemo) onOpenDemo();
                        }}
                        className="flex items-center gap-2 text-lg font-medium text-foreground hover:text-primary text-left py-1 cursor-pointer"
                    >
                        <PlayCircle className="h-5 w-5 text-primary" />
                        <span>Demo Checkout</span>
                    </button>
                </nav>
                <div className="border-t pt-4 mt-4 space-y-2">
                    {!loading && (
                        <>
                        {user ? (
                            <>
                                {needsProfileCompletion && (
                                    <div className="p-3 mb-2 bg-amber-500/15 border border-amber-500/30 rounded-lg space-y-2">
                                        <div className="flex items-center gap-2 text-xs font-bold text-amber-900 dark:text-amber-200">
                                            <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                                            <span>Completa tus datos</span>
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            Falta registrar tu {missingFieldsLabel} vinculado a <strong>{user.email}</strong>.
                                        </p>
                                        <Button 
                                            size="sm" 
                                            className="w-full bg-amber-600 hover:bg-amber-700 text-white text-xs h-8 font-semibold shadow-sm"
                                            onClick={() => {
                                                setIsOpen(false);
                                                onOpenCompleteProfile();
                                            }}
                                        >
                                            Ingresar datos ahora
                                        </Button>
                                    </div>
                                )}
                                <div className="px-2 py-1 text-sm text-muted-foreground">Hola, {user.name || 'Usuario'}</div>
                                <Button asChild variant={pathname === '/my-orders' ? "secondary" : "outline"} className="w-full justify-start">
                                    <Link href="/my-orders" onClick={handleLinkClick}><FileText className="mr-2 h-4 w-4" /><span>Mis Órdenes</span></Link>
                                </Button>
                                <Button asChild variant={pathname === '/favorites' ? "secondary" : "outline"} className="w-full justify-start">
                                    <Link href="/favorites" onClick={handleLinkClick}><Heart className="mr-2 h-4 w-4" /><span>Mis Favoritos</span></Link>
                                </Button>
                                <Button asChild variant={pathname === '/profile' ? "secondary" : "outline"} className="w-full justify-start">
                                    <Link href="/profile" onClick={handleLinkClick}><UserIcon className="mr-2 h-4 w-4" /><span>Mi Perfil</span></Link>
                                </Button>
                                <Button asChild variant={pathname === '/share' ? "secondary" : "outline"} className="w-full justify-start">
                                    <Link href="/share" onClick={handleLinkClick}><Share2 className="mr-2 h-4 w-4" /><span>Compartir Catálogo</span></Link>
                                </Button>

                                {user.role !== 'CLIENT' && (
                                    <div className="space-y-2 pt-4 border-t">
                                        <div className="flex items-center gap-1.5 px-2 py-1">
                                            <Shield className="h-3.5 w-3.5 text-primary" />
                                            <p className="text-xs font-bold text-primary uppercase tracking-wider">Portal Admin</p>
                                        </div>
                                        {visibleAdminLinks.map((link) => {
                                            if (link.isDropdown) {
                                                return link.subLinks.map(sublink => renderAdminLink(sublink));
                                            }
                                            return renderAdminLink(link);
                                        })}
                                    </div>
                                )}
                                <div className="border-t pt-4 mt-4">
                                    <Button variant="outline" className="w-full" onClick={() => handleActionClick(handleLogout)}>
                                        <LogOut className="mr-2 h-4 w-4" />
                                        Cerrar Sesión
                                    </Button>
                                </div>
                            </>
                        ) : (
                            <div className="space-y-2">
                                <Button 
                                  variant="outline" 
                                  className="w-full flex items-center justify-center gap-2 border-primary/20 hover:bg-primary/5" 
                                  onClick={() => handleActionClick(handleGoogleAuth)}
                                  disabled={googleLoading}
                                >
                                  {googleLoading ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  ) : (
                                    <GoogleIcon className="mr-2 h-4 w-4 shrink-0" />
                                  )}
                                  <span>Registrarse con Google</span>
                                </Button>
                                <div className="grid grid-cols-2 gap-2">
                                    <Button asChild className="w-full" variant="outline">
                                        <Link href="/login" onClick={handleLinkClick}>Ingresar</Link>
                                    </Button>
                                    <Button asChild className="w-full">
                                        <Link href="/signup" onClick={handleLinkClick}>Hazte Miembro</Link>
                                    </Button>
                                </div>
                            </div>
                        )}
                        </>
                    )}
                </div>
                </div>
            </ScrollArea>
        </SheetContent>
        </Sheet>
    )
};
