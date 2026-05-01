'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { LayoutDashboard, Menu, LogOut, User as UserIcon, Shield, ListTree, ShoppingBag, Scaling, Bookmark, Warehouse, FileText, Truck, Receipt, Settings, Landmark, Wallet, CreditCard, ChevronDown, Package, PackageCheck, Users, TrendingUp, Share2, BookOpen, BarChart, Route, AlertTriangle, Heart, MessageSquare, Megaphone } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/use-auth'
import { signOut } from 'firebase/auth'
import { auth, db } from '@/lib/firebase'
import { useToast } from '@/hooks/use-toast'
import { onSnapshot, doc } from 'firebase/firestore'
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
        roles: ['ADMIN', 'REPARTIDOR'],
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
  const [siteName, setSiteName] = React.useState('OTRO ZARPE');
  const [siteSlogan, setSiteSlogan] = React.useState('PREMIUM SELECTION');

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
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

        {/* ── Logo ── */}
        <div className="flex h-20 items-center justify-center">
            <Link href="/" className="flex items-center gap-2">
                <BrandLogo siteName={siteName} siteSlogan={siteSlogan} />
            </Link>
        </div>

        {/* ── PUBLIC Navigation Bar ── */}
        <div className="flex h-14 items-center justify-between border-t border-border/40">
            {/* Mobile menu */}
            <div className="flex flex-1 items-center justify-start">
                <div className="md:hidden">
                    <MobileMenu
                        user={user} loading={loading} handleLogout={handleLogout}
                        visibleAdminLinks={processedAdminLinks}
                        isOpen={isMobileMenuOpen} setIsOpen={setIsMobileMenuOpen}
                        onCartClick={() => setIsCartOpen(true)}
                        storeLocationUrl={storeLocationUrl}
                        siteName={siteName}
                        siteSlogan={siteSlogan}
                    />
                </div>
            </div>

            {/* Center: public links only */}
            <nav className="hidden md:flex flex-1 items-center justify-center gap-8 text-sm">
                {navLinks.map((link) => (
                    <Link key={link.href} href={link.href}
                        className={cn('transition-colors hover:text-primary font-medium',
                            pathname === link.href ? 'text-primary font-semibold' : 'text-foreground/60'
                        )}
                    >
                        {link.label}
                    </Link>
                ))}
            </nav>

            {/* Right: auth + cart */}
            <div className="flex flex-1 items-center justify-end gap-2">
                {storeLocationUrl && (
                    <Button asChild variant="ghost" size="sm" className="hidden lg:flex gap-2 text-primary font-bold">
                        <a href={storeLocationUrl} target="_blank" rel="noopener noreferrer">
                            <Route className="h-4 w-4" />
                            <span>Tienda Física</span>
                        </a>
                    </Button>
                )}
                <AuthButtons user={user} loading={loading} handleLogout={handleLogout}
                    getInitials={getInitials} onCartClick={() => setIsCartOpen(true)} />
                <div className="md:hidden flex items-center gap-2">
                    <ThemeToggle />
                    {user ? (
                        <Button variant="ghost" onClick={() => setIsCartOpen(true)}>
                            <ShoppingBag className="h-5 w-5" />
                            {totalItems > 0 && (
                                <span className="ml-2 inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-primary rounded-full">
                                    {totalItems}
                                </span>
                            )}
                        </Button>
                    ) : (
                        <Button asChild variant="ghost">
                            <Link href="/login">Ingresar</Link>
                        </Button>
                    )}
                </div>
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
    </header>
  )
}


const AuthButtons = ({ user, loading, handleLogout, getInitials, onCartClick }) => {
  const { totalItems } = useCart();
  if (loading) return null;
  return (
    <div className="hidden md:flex items-center gap-2">
      {user ? (
        <>
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
          <Button asChild size="sm"><Link href="/signup">Hazte Miembro</Link></Button>
        </>
      )}
    </div>
  );
}

const MobileMenu = ({ user, loading, handleLogout, visibleAdminLinks, isOpen, setIsOpen, onCartClick, storeLocationUrl, siteName, siteSlogan }) => {
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
                    {storeLocationUrl && (
                        <Button asChild variant="secondary" className="w-full justify-start mt-2">
                            <a href={storeLocationUrl} target="_blank" rel="noopener noreferrer" onClick={handleLinkClick}>
                                <Route className="mr-2 h-4 w-4 text-primary" />
                                Localización de Tienda
                            </a>
                        </Button>
                    )}
                </nav>
                <div className="border-t pt-4 mt-4 space-y-2">
                    {!loading && (
                        <>
                        {user ? (
                            <>
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
                            <div className="grid grid-cols-2 gap-2">
                                <Button asChild className="w-full" variant="outline">
                                    <Link href="/login" onClick={handleLinkClick}>Ingresar</Link>
                                </Button>
                                <Button asChild className="w-full">
                                    <Link href="/signup" onClick={handleLinkClick}>Registrarse</Link>
                                </Button>
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
