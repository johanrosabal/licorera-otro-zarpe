'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { LayoutDashboard, Menu, LogOut, User as UserIcon, Shield, ListTree, ShoppingBag, Scaling, Bookmark, Warehouse, FileText, Truck, Receipt, Settings, Landmark, Wallet, CreditCard, ChevronDown, Package, PackageCheck, Users, MapPin, Navigation, TrendingUp, Share2, BookOpen, BarChart, Route, AlertTriangle, Heart, MessageSquare, Megaphone } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/use-auth'
import { signOut } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { useToast } from '@/hooks/use-toast'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuPortal,
  DropdownMenuSubContent
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar'
import React from 'react'
import { useCart } from '@/hooks/use-cart'
import { CartSheet } from '../cart/cart-sheet'
import { ScrollArea } from '../ui/scroll-area'
import Image from 'next/image'
import { ThemeToggle } from '../theme-toggle'

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
        roles: ['ADMIN', 'DELIVERY'],
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
      toast({
        title: 'Sesión cerrada',
        description: 'Has cerrado sesión exitosamente.',
      })
      router.push('/')
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo cerrar la sesión.',
        variant: 'destructive',
      })
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


  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <CartSheet open={isCartOpen} onOpenChange={setIsCartOpen} />
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        
        {/* Centered Logo */}
        <div className="flex h-20 items-center justify-center">
            <Link href="/" className="flex items-center gap-2">
                <Image
                    src="https://firebasestorage.googleapis.com/v0/b/licorera-otro-zarpe.firebasestorage.app/o/settings%2FOtro_Zarpe_Logo.png?alt=media&token=7d496c2b-533a-4651-8ffa-3e4ce3ca598e"
                    alt="Otro Zarpe Logo"
                    width={250}
                    height={42}
                    priority
                    unoptimized
                    className="hidden dark:block"
                />
                 <Image
                    src="https://firebasestorage.googleapis.com/v0/b/licorera-otro-zarpe.firebasestorage.app/o/settings%2FLogoTemaClaro.png?alt=media&token=df823679-246c-43b3-890c-68b9a612e2d1"
                    alt="Otro Zarpe Logo"
                    width={250}
                    height={42}
                    priority
                    unoptimized
                    className="block dark:hidden"
                />
            </Link>
        </div>

        {/* Navigation and Actions Bar */}
        <div className="flex h-14 items-center justify-between border-t border-border/40">
            {/* Left side: Mobile menu trigger */}
            <div className="flex flex-1 items-center justify-start">
                <div className="md:hidden">
                    <MobileMenu
                        user={user}
                        loading={loading}
                        handleLogout={handleLogout}
                        visibleAdminLinks={visibleAdminLinks}
                        isOpen={isMobileMenuOpen}
                        setIsOpen={setIsMobileMenuOpen}
                        onCartClick={() => setIsCartOpen(true)}
                    />
                </div>
            </div>

            {/* Center: Desktop navigation */}
            <nav className="hidden md:flex flex-1 items-center justify-center gap-4 text-sm">
                {navLinks.map((link) => (
                    <Link
                    key={link.href}
                    href={link.href}
                    className={cn(
                        'transition-colors hover:text-primary',
                        pathname === link.href ? 'text-primary font-semibold' : 'text-foreground/60'
                    )}
                    >
                    {link.label}
                    </Link>
                ))}
                {user && user.role !== 'CLIENT' && (
                    <>
                    <div className="h-6 w-px bg-border/40 mx-2" />
                        {visibleAdminLinks.map((link) => {
                        const isAdmin = user.role === 'ADMIN';
                        if (link.isDropdown) {
                            const isSublinkActive = link.subLinks.some(sublink => pathname.startsWith(sublink.href));
                            return (
                                <DropdownMenu key={link.label}>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" className={cn(
                                        'px-3 py-2 h-auto text-sm transition-colors hover:text-primary',
                                        isSublinkActive ? 'text-primary font-semibold' : 'text-foreground/60',
                                        isAdmin && 'bg-secondary'
                                    )}>
                                        <link.icon className="mr-2 h-4 w-4" />
                                        {link.label} <ChevronDown className="ml-1 h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent>
                                    {link.subLinks.map(sublink => (
                                    <DropdownMenuItem key={sublink.href} asChild>
                                        <Link href={sublink.href}>
                                            <sublink.icon className="mr-2 h-4 w-4" />
                                            {sublink.label}
                                        </Link>
                                    </DropdownMenuItem>
                                    ))}
                                </DropdownMenuContent>
                                </DropdownMenu>
                            );
                        }
                        return (
                        <Link
                            key={link.href}
                            href={link.href}
                            className={cn(
                            'transition-colors hover:text-primary px-3 py-2 rounded-md flex items-center',
                            pathname.startsWith(link.href) ? 'text-primary font-semibold' : 'text-foreground/60',
                            isAdmin && 'bg-secondary'
                            )}
                            >
                            <link.icon className="mr-2 h-4 w-4" />
                            {link.label}
                        </Link>
                        );
                    })}
                    </>
                )}
            </nav>

            {/* Right side: Auth and Cart */}
            <div className="flex flex-1 items-center justify-end gap-2">
                <AuthButtons user={user} loading={loading} handleLogout={handleLogout} getInitials={getInitials} onCartClick={() => setIsCartOpen(true)} />
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
                        <p className="text-sm font-medium leading-none">
                        {user.name || user.email}
                        </p>
                        <p className="text-xs leading-none text-muted-foreground">
                        {user.email}
                        </p>
                    </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                     <DropdownMenuItem asChild>
                        <Link href="/favorites">
                          <Heart className="mr-2 h-4 w-4" />
                          <span>Mis Favoritos</span>
                        </Link>
                    </DropdownMenuItem>
                     <DropdownMenuItem asChild>
                        <Link href="/profile">
                          <UserIcon className="mr-2 h-4 w-4" />
                          <span>Mi Perfil</span>
                        </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                        <Link href="/share">
                          <Share2 className="mr-2 h-4 w-4" />
                          <span>Compartir Catálogo</span>
                        </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleLogout}>
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Cerrar sesión</span>
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
          </>
      ) : (
        <>
            <ThemeToggle />
            <Button asChild variant="ghost" size="sm">
              <Link href="/login">Ingresar</Link>
            </Button>
            <Button asChild size="sm">
                <Link href="/signup">Hazte Miembro</Link>
            </Button>
        </>
      )}
    </div>
  );
}

const MobileMenu = ({ user, loading, handleLogout, visibleAdminLinks, isOpen, setIsOpen, onCartClick }) => {
    const pathname = usePathname();

    const handleLinkClick = () => {
        setIsOpen(false);
    };

    const handleActionClick = (action) => {
        action();
        setIsOpen(false);
    };
    
    const renderAdminLink = (link) => {
        const Icon = link.icon;
        const isActive = pathname.startsWith(link.href);
        return (
             <Button 
                asChild 
                variant={isActive ? "secondary" : "outline"} 
                className="w-full justify-start" 
                key={link.href}
            >
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
                       <Image
                            src="https://firebasestorage.googleapis.com/v0/b/licorera-otro-zarpe.firebasestorage.app/o/settings%2FOtro_Zarpe_Logo.png?alt=media&token=7d496c2b-533a-4651-8ffa-3e4ce3ca598e"
                            alt="Otro Zarpe Logo"
                            width={150}
                            height={25}
                            unoptimized
                            className="hidden dark:block"
                        />
                         <Image
                            src="https://firebasestorage.googleapis.com/v0/b/licorera-otro-zarpe.firebasestorage.app/o/settings%2FLogoTemaClaro.png?alt=media&token=df823679-246c-43b3-890c-68b9a612e2d1"
                            alt="Otro Zarpe Logo"
                            width={150}
                            height={25}
                            unoptimized
                            className="block dark:hidden"
                        />
                    </Link>
                </SheetTitle>
            </SheetHeader>
            <ScrollArea className="flex-1">
                <div className="flex flex-col gap-4 p-4">
                
                <nav className="flex flex-col gap-4">
                    {navLinks.map((link) => (
                    <Link
                        key={link.href}
                        href={link.href}
                        onClick={handleLinkClick}
                        className={cn(
                        'text-lg',
                        pathname === link.href ? 'text-primary font-bold' : 'text-foreground'
                        )}
                    >
                        {link.label}
                    </Link>
                    ))}
                </nav>
                <div className="border-t pt-4 mt-4 space-y-2">
                    {!loading && (
                        <>
                        {user ? (
                            <>
                                <div className="px-2 py-1 text-sm text-muted-foreground">
                                    Hola, {user.name || 'Usuario'}
                                </div>
                                <Button asChild variant={pathname === '/my-orders' ? "secondary" : "outline"} className="w-full justify-start">
                                    <Link href="/my-orders" onClick={handleLinkClick}>
                                        <FileText className="mr-2 h-4 w-4" />
                                        <span>Mis Órdenes</span>
                                    </Link>
                                </Button>
                                <Button asChild variant={pathname === '/favorites' ? "secondary" : "outline"} className="w-full justify-start">
                                    <Link href="/favorites" onClick={handleLinkClick}>
                                        <Heart className="mr-2 h-4 w-4" />
                                        <span>Mis Favoritos</span>
                                    </Link>
                                </Button>
                                <Button asChild variant={pathname === '/profile' ? "secondary" : "outline"} className="w-full justify-start">
                                    <Link href="/profile" onClick={handleLinkClick}>
                                        <UserIcon className="mr-2 h-4 w-4" />
                                        <span>Mi Perfil</span>
                                    </Link>
                                </Button>
                                 <Button asChild variant={pathname === '/share' ? "secondary" : "outline"} className="w-full justify-start">
                                    <Link href="/share" onClick={handleLinkClick}>
                                        <Share2 className="mr-2 h-4 w-4" />
                                        <span>Compartir Catálogo</span>
                                    </Link>
                                </Button>

                                {user.role !== 'CLIENT' && (
                                    <div className="space-y-2 pt-4 border-t">
                                        <p className="text-sm font-medium text-muted-foreground px-2">Portal</p>
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
                                    <Link href="/login" onClick={handleLinkClick}>
                                        Ingresar
                                    </Link>
                                </Button>
                                <Button asChild className="w-full">
                                    <Link href="/signup" onClick={handleLinkClick}>
                                        Registrarse
                                    </Link>
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
