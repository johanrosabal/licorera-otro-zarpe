
'use client';

import React, { useState, useEffect } from 'react';
import { useCart } from '@/hooks/use-cart';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { getPaymentMethodsWithAccounts } from '@/lib/payment-methods';
import { createOrder } from '@/lib/orders-service';
import { getDeliveryFees } from '@/lib/delivery-fees';
import { getHomepageSettings } from '@/lib/settings';
import { 
    Loader2, 
    CreditCard, 
    MapPin, 
    Upload, 
    X, 
    CheckCircle2, 
    Truck, 
    Phone, 
    ArrowRight, 
    FileText, 
    Copy, 
    Check, 
    Tag, 
    AlertTriangle, 
    Map, 
    Info,
    MessageCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { formatCurrency, formatSinpeMovil, extractCoordsFromUrl, calculateHaversineDistance } from '@/lib/utils';
import Image from 'next/image';
import { Separator } from '@/components/ui/separator';
import { updateUserProfile } from '@/lib/users-service';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import dynamic from 'next/dynamic';

// Dynamically import map component for SSR compatibility
const LocationPicker = dynamic(
  () => import('@/components/location-picker'),
  { 
    ssr: false,
    loading: () => <div className="h-[400px] w-full bg-muted animate-pulse flex items-center justify-center font-bold text-muted-foreground uppercase tracking-widest">CARGANDO MAPA...</div>
  }
);

export default function CheckoutPage() {
    const { cartItems, subtotal, clearCart, isInitialized: isCartInitialized } = useCart();
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const { toast } = useToast();
    
    const [paymentMethods, setPaymentMethods] = useState([]);
    const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState(null);
    const [paymentReceipt, setPaymentReceipt] = useState(null);
    const [receiptPreview, setReceiptPreview] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isLocating, setIsLocating] = useState(false);
    const [currentUser, setCurrentUser] = useState(null);
    const [deliveryFee, setDeliveryFee] = useState(null);
    const [deliveryFeeType, setDeliveryFeeType] = useState('distance');
    const [distance, setDistance] = useState(null);
    const [orderPlaced, setOrderPlaced] = useState(false);
    const [completedOrderNumber, setCompletedOrderNumber] = useState(null);
    const [completedOrderTotal, setCompletedOrderTotal] = useState(0);
    const [whatsappUrl, setWhatsappUrl] = useState('');
    const [stockErrors, setStockErrors] = useState([]);
    const [checkingStock, setCheckingStock] = useState(false);
    const [deliveriesEnabled, setDeliveriesEnabled] = useState(true);
    const [referenceCopied, setReferenceCopied] = useState(false);
    const [ibanCopied, setIbanCopied] = useState(false);
    const [sinpeCopied, setSinpeCopied] = useState(false);

    const [paymentReference] = useState(() => Math.random().toString(36).substring(2, 7).toUpperCase());

    useEffect(() => {
        if (user) setCurrentUser(user);
    }, [user]);
    
    useEffect(() => {
        if (!authLoading && isCartInitialized && !orderPlaced) {
            if (!user) {
                router.replace('/login?redirect=/checkout/');
                return;
            }
            if (cartItems.length === 0) {
                // If there's a guest cart currently being merged from localStorage, do not redirect
                const storedCart = typeof window !== 'undefined' ? localStorage.getItem('cart') : null;
                if (storedCart) {
                    try {
                        const parsed = JSON.parse(storedCart);
                        if (Array.isArray(parsed) && parsed.length > 0) {
                            return;
                        }
                    } catch (e) {}
                }
                // Short safety timer to allow Firestore snapshot to settle without jarring bounce
                const timer = setTimeout(() => {
                    if (cartItems.length === 0) {
                        toast({ title: "Tu carrito está vacío" });
                        router.replace('/products');
                    }
                }, 800);
                return () => clearTimeout(timer);
            }
        }
    }, [user, authLoading, cartItems.length, router, toast, isCartInitialized, orderPlaced]);

    // Live stock verification for cart items
    useEffect(() => {
        if (!cartItems || cartItems.length === 0) {
            setStockErrors([]);
            return;
        }

        let isCancelled = false;
        async function validateCartStock() {
            setCheckingStock(true);
            try {
                const errors = [];
                for (const item of cartItems) {
                    if (!item || !item.id) continue;
                    const productSnap = await getDoc(doc(db, 'products', String(item.id)));
                    if (!productSnap.exists()) {
                        errors.push({ id: item.id, message: `"${item.name || 'Producto'}" ya no existe en el catálogo.` });
                    } else {
                        const productData = productSnap.data();
                        if (productData.isBundle && productData.bundleItems && productData.bundleItems.length > 0) {
                            for (const bundleComponent of productData.bundleItems) {
                                const compSnap = await getDoc(doc(db, 'products', bundleComponent.productId));
                                if (!compSnap.exists()) {
                                    errors.push({ id: item.id, message: `Un artículo del combo "${item.name}" ya no existe.` });
                                    break;
                                }
                                const compData = compSnap.data();
                                const compStock = Number(compData.stock) || 0;
                                const required = (Number(bundleComponent.quantity) || 1) * (Number(item.quantity) || 1);
                                if (compStock < required) {
                                    errors.push({ id: item.id, message: `"${item.name}": falta stock de "${compData.name}". Disponible: ${compStock}, Requerido: ${required}.` });
                                    break;
                                }
                            }
                        } else {
                            const currentStock = Number(productData.stock) || 0;
                            if (currentStock <= 0) {
                                errors.push({ id: item.id, message: `"${item.name}" está agotado (0 disponibles).` });
                            } else if (currentStock < item.quantity) {
                                errors.push({ id: item.id, message: `"${item.name}": solo quedan ${currentStock} unidades disponibles (tienes ${item.quantity} en el carrito).` });
                            }
                        }
                    }
                }
                if (!isCancelled) {
                    setStockErrors(errors);
                }
            } catch (err) {
                console.error("Error validating cart stock:", err);
            } finally {
                if (!isCancelled) setCheckingStock(false);
            }
        }

        validateCartStock();
        return () => { isCancelled = true; };
    }, [cartItems]);

    useEffect(() => {
        let isMounted = true;
        async function fetchInitialData() {
            if (!isCartInitialized || authLoading) return;

            if (!user || cartItems.length === 0) {
                if (isMounted) setLoading(false);
                return;
            }

            try {
                const [methodsResult, feesResult, settingsResult] = await Promise.allSettled([
                    getPaymentMethodsWithAccounts({ activeOnly: true }),
                    getDeliveryFees(),
                    getHomepageSettings(),
                ]);

                if (!isMounted) return;

                const methods = methodsResult.status === 'fulfilled' && Array.isArray(methodsResult.value) 
                    ? methodsResult.value 
                    : [];
                const fees = feesResult.status === 'fulfilled' && Array.isArray(feesResult.value) 
                    ? feesResult.value 
                    : [];
                const settings = settingsResult.status === 'fulfilled' && settingsResult.value 
                    ? settingsResult.value 
                    : {};

                setPaymentMethods(methods);
                if (methods.length > 0) {
                    setSelectedPaymentMethodId(prev => prev || methods[0].id);
                }

                if (settings?.whatsappUrl) {
                    setWhatsappUrl(settings.whatsappUrl);
                }

                const isDeliveryOn = settings?.deliveriesEnabled !== false;
                setDeliveriesEnabled(isDeliveryOn);

                const feeType = settings?.deliveryFeeType || 'distance';
                const fixedAmount = Number(settings?.fixedDeliveryFee ?? 3000);
                setDeliveryFeeType(feeType);

                const userCoords = extractCoordsFromUrl(currentUser?.locationUrl);
                const storeCoords = settings?.deliveryOriginLat && settings?.deliveryOriginLng 
                    ? { lat: Number(settings.deliveryOriginLat), lng: Number(settings.deliveryOriginLng) } 
                    : null;

                if (!isDeliveryOn) {
                    setDeliveryFee(0);
                    setDistance(null);
                } else if (feeType === 'fixed') {
                    setDeliveryFee(fixedAmount);
                    setDistance(null);
                } else {
                    if (userCoords && storeCoords) {
                        const calculatedDistance = calculateHaversineDistance(storeCoords.lat, storeCoords.lng, userCoords.lat, userCoords.lng);
                        setDistance(calculatedDistance);
                        const applicableFee = fees.find(fee => calculatedDistance >= fee.fromKm && calculatedDistance < fee.toKm);
                        setDeliveryFee(applicableFee ? applicableFee.fee : fixedAmount);
                    } else {
                        setDeliveryFee(fixedAmount);
                        setDistance(null);
                    }
                }
            } catch (error) {
                console.error("Fetch data error:", error);
            } finally {
                if (isMounted) setLoading(false);
            }
        }
        fetchInitialData();
        return () => { isMounted = false; };
    }, [user, isCartInitialized, cartItems.length, currentUser, authLoading]);
    
    useEffect(() => {
        if (paymentReceipt instanceof File) {
            const reader = new FileReader();
            reader.onloadend = () => setReceiptPreview(reader.result);
            reader.readAsDataURL(paymentReceipt);
        } else {
            setReceiptPreview(null);
        }
    }, [paymentReceipt]);

    const handleCopyReference = () => {
        navigator.clipboard.writeText(paymentReference);
        setReferenceCopied(true);
        setTimeout(() => setReferenceCopied(false), 2000);
        toast({ title: "Copiado", description: "Referencia copiada al portapapeles." });
    };

    const handleCopyIban = (iban) => {
        navigator.clipboard.writeText(iban);
        setIbanCopied(true);
        setTimeout(() => setIbanCopied(false), 2000);
        toast({ title: "Copiado", description: "IBAN copiado al portapapeles." });
    };

    const handleCopySinpe = (number) => {
        navigator.clipboard.writeText(number);
        setSinpeCopied(true);
        setTimeout(() => setSinpeCopied(false), 2000);
        toast({ title: "Copiado", description: "Número SINPE copiado al portapapeles." });
    };

    const handleUpdateLocation = () => {
        setIsLocating(true);
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const url = `https://www.google.com/maps?q=${position.coords.latitude},${position.coords.longitude}`;
                await updateUserProfile(user.uid, { locationUrl: url });
                setCurrentUser(prev => ({ ...prev, locationUrl: url }));
                setIsLocating(false);
                toast({ title: "Éxito", description: "Ubicación actualizada correctamente."});
            },
            (error) => {
                toast({ title: "Error", description: "No se pudo obtener la ubicación. Por favor, permita el acceso al GPS.", variant: "destructive"});
                setIsLocating(false);
            }
        );
    }

    const handleMapLocationConfirm = async (coords) => {
        const url = `https://www.google.com/maps?q=${coords.lat},${coords.lng}`;
        await updateUserProfile(user.uid, { locationUrl: url });
        setCurrentUser(prev => ({ ...prev, locationUrl: url }));
        setShowMapMode(false);
        toast({ title: "Éxito", description: "Ubicación guardada desde el mapa."});
    }

    const handleCreateOrder = async () => {
        if (!selectedPaymentMethodId) {
            toast({ title: "Selecciona un método de pago", variant: "destructive" });
            return;
        }

        if (!paymentReceipt) {
            toast({
                title: "Comprobante de pago obligatorio",
                description: "Por favor sube la foto o captura de pantalla de tu comprobante de pago para procesar la orden.",
                variant: "destructive"
            });
            const receiptEl = document.getElementById('receipt-upload-container');
            if (receiptEl) {
                receiptEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            return;
        }

        if (stockErrors.length > 0) {
            toast({
                title: "Inventario insuficiente",
                description: "Por favor revisa y ajusta los productos con falta de stock en el resumen antes de continuar.",
                variant: "destructive"
            });
            return;
        }

        setIsProcessing(true);
        try {
            const selectedMethod = paymentMethods.find(m => m.id === selectedPaymentMethodId);
            const orderTotal = subtotal + (deliveryFee || 0);
            const result = await createOrder({
                userId: user.uid,
                userName: user.name || user.email || 'Cliente',
                userEmail: user.email || '',
                items: cartItems,
                subtotal: subtotal,
                deliveryFee: deliveryFee || 0,
                total: orderTotal,
                paymentMethod: selectedMethod,
                paymentReceipt,
                paymentReference, 
            });
            
            setCompletedOrderNumber(result.invoiceNumber);
            setCompletedOrderTotal(orderTotal);
            setOrderPlaced(true);
            await clearCart();

        } catch (error) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
            setIsProcessing(false);
        }
    };
    
    if (authLoading || (loading && !orderPlaced) || !isCartInitialized) {
      return <div className="flex justify-center items-center h-[60vh]"><Loader2 className="h-16 w-16 animate-spin text-primary" /></div>;
    }

    if (orderPlaced) {
        const orderTotal = completedOrderTotal || (subtotal + (deliveryFee || 0));
        const formattedTotal = formatCurrency(orderTotal);
        const waMessage = encodeURIComponent(`Hola, acabo de realizar la orden #${completedOrderNumber} por un total de ${formattedTotal}. Adjunto mi comprobante de pago.`);
        const waLink = whatsappUrl 
            ? `${whatsappUrl.split('?')[0].replace(/\/+$/, '')}?text=${waMessage}`
            : `https://wa.me/?text=${waMessage}`;

        return (
            <div className="container mx-auto py-16 px-4 flex flex-col items-center justify-center min-h-[60vh] animate-in fade-in zoom-in duration-500">
                <Card className="max-w-md w-full text-center shadow-2xl border-primary/20">
                    <CardHeader className="pb-4">
                        <div className="mx-auto bg-green-100 dark:bg-green-900/30 rounded-full p-4 w-fit mb-3">
                            <CheckCircle2 className="h-14 w-14 text-green-600 dark:text-green-400" />
                        </div>
                        <CardTitle className="text-3xl font-headline">¡Pedido Realizado!</CardTitle>
                        <CardDescription className="text-base">Tu orden ha sido registrada exitosamente.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="bg-muted/60 p-5 rounded-xl border-2 border-dashed border-primary/30">
                            <p className="text-xs text-muted-foreground uppercase tracking-wider font-bold mb-1">Número de Orden</p>
                            <p className="text-4xl font-black text-primary">#{completedOrderNumber}</p>
                            <p className="text-sm font-semibold text-muted-foreground mt-2">
                                Total: <span className="text-foreground font-black text-base">{formattedTotal}</span>
                            </p>
                        </div>

                        <div className="space-y-3">
                            <Button 
                                asChild 
                                size="lg" 
                                className="w-full bg-[#25D366] hover:bg-[#20bd5a] text-white font-black h-14 shadow-lg hover:scale-[1.02] transition-all flex items-center justify-center gap-2 text-base"
                            >
                                <a href={waLink} target="_blank" rel="noopener noreferrer">
                                    <MessageCircle className="h-5 w-5 fill-current" />
                                    Enviar Comprobante por WhatsApp
                                </a>
                            </Button>
                            <p className="text-xs text-muted-foreground">
                                Envíanos tu comprobante directamente por WhatsApp para agilizar la preparación de tu pedido.
                            </p>
                        </div>
                    </CardContent>
                    <CardFooter className="pt-0">
                        <Button asChild variant="outline" size="lg" className="w-full font-bold h-12">
                            <Link href="/my-orders">
                                Ver Mis Órdenes <ArrowRight className="ml-2 h-5 w-5" />
                            </Link>
                        </Button>
                    </CardFooter>
                </Card>
            </div>
        );
    }

    const locationCoords = extractCoordsFromUrl(currentUser?.locationUrl);

    return (
        <div className="container mx-auto py-6 sm:py-12 px-3 sm:px-4">
            {isProcessing && <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center z-50"><Loader2 className="h-16 w-16 animate-spin text-primary mb-4" /><p className="font-bold">Procesando orden...</p></div>}
            <h1 className="text-2xl sm:text-3xl font-headline text-center mb-6 sm:mb-8">Finalizar Compra</h1>
            <div className="flex flex-col lg:flex-row gap-6 sm:gap-8">
                <div className="lg:w-2/3 space-y-6 sm:space-y-8">
                    <Card className="border-primary/20 shadow-lg overflow-hidden">
                        <CardHeader className="bg-primary/5 border-b border-primary/10 p-4 sm:p-6">
                            <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                                <MapPin className="text-primary h-5 w-5" />
                                Ubicación de Entrega
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-3.5 sm:p-6 space-y-4 sm:space-y-6">
                            {!deliveriesEnabled && (
                                <Alert className="bg-blue-50 border-blue-200 text-blue-800">
                                    <Truck className="h-4 w-4 text-blue-600" />
                                    <AlertDescription>
                                        <strong>Nota:</strong> Las entregas están deshabilitadas temporalmente. El envío será coordinado externamente o retiro en tienda.
                                    </AlertDescription>
                                </Alert>
                            )}

                            <div className="flex flex-col gap-4 sm:gap-6">
                                <Alert className="bg-blue-50 border-blue-300 text-blue-900 shadow-sm p-3 sm:p-4">
                                    <AlertTriangle className="h-5 w-5 text-blue-600 shrink-0" />
                                    <AlertTitle className="font-black text-sm sm:text-base">¡IMPORTANTE!</AlertTitle>
                                    <AlertDescription className="text-xs sm:text-sm">
                                        {deliveryFeeType === 'fixed'
                                            ? 'Para garantizar que su pedido llegue correctamente a su destino, verifique su ubicación en el mapa de abajo. Use el botón de GPS para centrarlo.'
                                            : 'Para garantizar que su pedido llegue correctamente y calcular su costo de envío, es VITAL que verifique su ubicación exacta en el mapa de abajo. Use el botón de GPS para centrarlo.'}
                                    </AlertDescription>
                                </Alert>

                                <div className="space-y-3 sm:space-y-4">
                                    <Button 
                                        onClick={handleUpdateLocation} 
                                        disabled={isLocating} 
                                        size="lg" 
                                        className="w-full text-sm sm:text-lg h-12 sm:h-14 font-black shadow-xl bg-primary hover:bg-primary/90 transition-all hover:scale-[1.01] active:scale-95"
                                    >
                                        {isLocating ? <Loader2 className="animate-spin mr-2 sm:mr-3 h-5 w-5 sm:h-6 sm:w-6" /> : <MapPin className="mr-2 sm:mr-3 h-5 w-5 sm:h-6 sm:w-6" />}
                                        {isLocating ? 'OBTENIENDO GPS...' : 'CENTRAR MAPA CON MI GPS'}
                                    </Button>

                                    <div className="rounded-xl overflow-hidden border border-primary/20 shadow-md">
                                        <div className="bg-primary/5 p-2.5 sm:p-3 border-b border-primary/10 flex justify-between items-center">
                                            <h3 className="font-black text-xs sm:text-sm uppercase tracking-wider flex items-center gap-2">
                                                <Map className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> Selector de Ubicación
                                            </h3>
                                            {locationCoords ? (
                                                <Badge className="bg-green-100 text-green-700 border-green-200 gap-1 text-[10px]">
                                                    <CheckCircle2 className="h-3 w-3" /> LISTO
                                                </Badge>
                                            ) : (
                                                <Badge variant="outline" className="text-orange-600 border-orange-200 bg-orange-50 gap-1 text-[10px]">
                                                    <Info className="h-3 w-3" /> SELECCIONE EN MAPA
                                                </Badge>
                                            )}
                                        </div>
                                        <div>
                                            <LocationPicker 
                                                initialCoords={locationCoords} 
                                                onConfirm={handleMapLocationConfirm}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <Separator />
                            <div className="grid grid-cols-2 gap-3 sm:gap-4 text-sm">
                                <div><Label className="text-muted-foreground font-bold uppercase text-[10px]">Cliente</Label><p className="font-black text-sm sm:text-lg truncate">{currentUser?.name}</p></div>
                                <div><Label className="text-muted-foreground font-bold uppercase text-[10px]">WhatsApp</Label><p className="font-black text-sm sm:text-lg truncate">{currentUser?.whatsapp || '-'}</p></div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-primary/20 shadow-lg overflow-hidden">
                        <CardHeader className="p-4 sm:p-6 pb-2 sm:pb-4">
                            <CardTitle className="flex items-center gap-2 text-lg sm:text-xl"><CreditCard className="text-primary h-5 w-5" /> Método de Pago</CardTitle>
                        </CardHeader>
                        <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
                            {paymentMethods.length === 0 ? (
                                <div className="p-4 sm:p-6 text-center border-2 border-dashed rounded-xl bg-muted/40 space-y-2">
                                    <CreditCard className="h-8 w-8 sm:h-10 sm:w-10 mx-auto text-muted-foreground/60" />
                                    <p className="font-bold text-foreground text-sm sm:text-base">No hay métodos de pago activos disponibles.</p>
                                    <p className="text-xs text-muted-foreground">Por favor contacta a la tienda por WhatsApp para coordinar tu pago.</p>
                                </div>
                            ) : (
                                <Tabs value={selectedPaymentMethodId} onValueChange={setSelectedPaymentMethodId} className="w-full">
                                    <TabsList className="grid w-full grid-cols-2 mb-3 sm:mb-4 h-auto p-1">
                                        {paymentMethods.map(method => (
                                            <TabsTrigger key={method.id} value={method.id} className="font-bold text-xs sm:text-sm py-2">
                                                {method.name}
                                            </TabsTrigger>
                                        ))}
                                    </TabsList>
                                    {paymentMethods.map(method => (
                                        <TabsContent key={method.id} value={method.id} className="bg-muted/30 p-3 sm:p-6 rounded-xl border border-primary/10 space-y-4 sm:space-y-6">
                                        
                                        <div className="bg-muted p-3 sm:p-4 rounded-xl text-center relative border border-border">
                                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">REFERENCIA ÚNICA PARA ESTE PAGO:</p>
                                            <div className="flex flex-col items-center justify-center gap-2 sm:gap-3">
                                                <p className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-foreground">{paymentReference}</p>
                                                <Button 
                                                    variant="secondary" 
                                                    size="sm" 
                                                    className="flex items-center gap-2 font-bold h-8 sm:h-9 text-xs sm:text-sm" 
                                                    onClick={handleCopyReference}
                                                >
                                                    {referenceCopied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                                                    {referenceCopied ? '¡Copiado!' : 'Copiar Código'}
                                                </Button>
                                            </div>
                                            <p className="text-[10px] text-muted-foreground mt-2">Por favor, escriba este código en el <span className="font-bold">detalle o concepto</span> de su pago.</p>
                                        </div>

                                        {method.bankAccount ? (
                                            <div className="text-center space-y-3 sm:space-y-4 pt-2 sm:pt-4">
                                                <div>
                                                    <p className="text-[10px] uppercase text-muted-foreground font-bold mb-1">TITULAR DE LA CUENTA</p>
                                                    <p className="text-lg sm:text-2xl font-black uppercase tracking-tight break-words px-2">{method.bankAccount.accountHolder}</p>
                                                </div>
                                                
                                                <Separator className="my-3 sm:my-4 opacity-50" />

                                                {(method.name || '').toLowerCase().includes('sinpe') ? (
                                                  method.bankAccount.sinpeMovil && (
                                                    <div className="py-2 px-1">
                                                        <p className="text-[10px] uppercase text-muted-foreground font-bold mb-1">NÚMERO SINPE MÓVIL</p>
                                                        <p className="text-3xl sm:text-4xl md:text-5xl font-mono font-black text-primary my-2 leading-none tracking-tight sm:tracking-tighter whitespace-nowrap overflow-x-auto select-all">
                                                            {formatSinpeMovil(method.bankAccount.sinpeMovil)}
                                                        </p>
                                                        <Button 
                                                            variant="outline" 
                                                            size="sm" 
                                                            className="flex items-center gap-2 mx-auto font-bold mt-2 h-9 text-xs sm:text-sm" 
                                                            onClick={() => handleCopySinpe(method.bankAccount.sinpeMovil)}
                                                        >
                                                            {sinpeCopied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                                                            {sinpeCopied ? '¡Copiado!' : 'Copiar Número'}
                                                        </Button>
                                                    </div>
                                                  )
                                                ) : (
                                                  method.bankAccount.iban && (
                                                    <div className="space-y-3 sm:space-y-4">
                                                        <div>
                                                            <p className="text-[10px] uppercase text-muted-foreground font-bold mb-1">CUENTA IBAN</p>
                                                            <p className="text-sm sm:text-lg md:text-xl font-mono break-all font-black tracking-tight text-foreground mb-3 px-1">
                                                                {method.bankAccount.iban}
                                                            </p>
                                                            <Button 
                                                                variant="outline" 
                                                                size="sm" 
                                                                className="flex items-center gap-2 mx-auto font-bold h-9 text-xs sm:text-sm" 
                                                                onClick={() => handleCopyIban(method.bankAccount.iban)}
                                                            >
                                                                {ibanCopied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                                                                {ibanCopied ? '¡Copiado!' : 'Copiar IBAN'}
                                                            </Button>
                                                        </div>
                                                    </div>
                                                  )
                                                )}
                                                
                                                <div className="pt-2 sm:pt-4">
                                                    <p className="text-xs sm:text-sm font-bold text-muted-foreground uppercase tracking-wider">
                                                        {method.bankAccount.bankName} ({method.bankAccount.currency})
                                                    </p>
                                                </div>
                                            </div>
                                        ) : <div className="text-center p-4"><p className="font-medium text-xs sm:text-sm">{method.instructions}</p></div>}
                                    </TabsContent>
                                ))}
                            </Tabs>
                            )}
                            <div className="mt-6 sm:mt-8" id="receipt-upload-container">
                                <div className="flex items-center justify-between mb-2">
                                    <Label className="text-lg font-bold flex items-center gap-2">
                                        <Upload className="h-5 w-5 text-primary" /> Subir Comprobante
                                        <span className="text-destructive font-black text-sm">* Obligatorio</span>
                                    </Label>
                                    {paymentReceipt ? (
                                        <Badge className="bg-green-100 text-green-700 border-green-200 text-xs gap-1 font-bold">
                                            <CheckCircle2 className="h-3.5 w-3.5" /> Comprobante Listo
                                        </Badge>
                                    ) : (
                                        <Badge variant="outline" className="text-destructive border-destructive/50 bg-destructive/10 text-xs font-bold animate-pulse">
                                            Obligatorio
                                        </Badge>
                                    )}
                                </div>
                                <p className="text-xs text-muted-foreground mb-3">
                                    Adjunta la foto o captura de pantalla de tu comprobante de pago (SINPE Móvil o Transferencia) para validar tu orden.
                                </p>
                                <Input 
                                    type="file" 
                                    className="hidden" 
                                    id="receipt-upload" 
                                    accept="image/*" 
                                    onChange={(e) => {
                                        if (e.target.files?.[0]) {
                                            setPaymentReceipt(e.target.files[0]);
                                        }
                                    }} 
                                />
                                <label 
                                    htmlFor="receipt-upload" 
                                    className={`mt-2 block w-full h-44 border-2 border-dashed rounded-xl flex items-center justify-center cursor-pointer transition-all relative overflow-hidden group ${
                                        paymentReceipt 
                                            ? 'border-green-500 bg-green-50/40 dark:bg-green-950/20 shadow-md' 
                                            : 'border-destructive/40 bg-destructive/5 hover:border-destructive hover:bg-destructive/10'
                                    }`}
                                >
                                    {receiptPreview ? (
                                        <>
                                            <Image src={receiptPreview} alt="Comprobante" fill className="object-contain p-2" unoptimized />
                                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 p-4">
                                                <p className="text-white font-bold text-sm">Clic para cambiar imagen</p>
                                                <Button 
                                                    type="button" 
                                                    variant="destructive" 
                                                    size="sm" 
                                                    className="h-8 text-xs font-bold"
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        setPaymentReceipt(null);
                                                        setReceiptPreview(null);
                                                    }}
                                                >
                                                    <X className="h-3.5 w-3.5 mr-1" /> Quitar Comprobante
                                                </Button>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="text-center p-4 space-y-1">
                                            <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-1 group-hover:scale-110 transition-transform">
                                                <Upload className="h-6 w-6 text-destructive"/>
                                            </div>
                                            <p className="font-bold text-foreground">Clic para subir comprobante</p>
                                            <p className="text-xs text-muted-foreground">Formatos aceptados: JPG, PNG, WEBP</p>
                                        </div>
                                    )}
                                </label>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <div className="lg:w-1/3">
                    <Card className="sticky top-24 shadow-xl border-primary/10">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5 text-primary" /> Resumen</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                           {cartItems.map(item => (
                                <div key={item.id} className="flex justify-between text-sm items-center">
                                    <div className="flex flex-col">
                                        <span className="font-bold line-clamp-1">{item.name}</span>
                                        <span className="text-xs text-muted-foreground">{item.quantity} x {formatCurrency(item.sellingPrice)}</span>
                                    </div>
                                    <span className="font-semibold">{formatCurrency(item.sellingPrice * item.quantity)}</span>
                                </div>
                           ))}
                           <Separator />
                           <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span className="font-medium text-foreground">{formatCurrency(subtotal)}</span></div>
                           {deliveriesEnabled && (
                               <div className="flex justify-between text-muted-foreground">
                                    <span>Envío {deliveryFeeType === 'fixed' ? '(Tarifa Fija)' : distance ? `(${distance.toFixed(1)} km)` : ''}</span>
                                    <span className="font-medium text-foreground">{formatCurrency(deliveryFee)}</span>
                               </div>
                           )}
                           <Separator />
                           <div className="flex justify-between font-black text-3xl text-primary pt-2">
                               <span>TOTAL</span>
                               <span>{formatCurrency(subtotal + (deliveryFee || 0))}</span>
                           </div>

                           {!paymentReceipt && (
                               <Alert className="border-amber-300 bg-amber-50 dark:bg-amber-950/20 text-amber-900 dark:text-amber-200 py-2.5">
                                   <Info className="h-4 w-4 text-amber-600 shrink-0" />
                                   <AlertDescription className="text-xs font-medium">
                                       Para confirmar tu pedido debes adjuntar el comprobante de pago arriba.
                                   </AlertDescription>
                               </Alert>
                           )}

                           {stockErrors.length > 0 && (
                               <Alert variant="destructive" className="border-2 border-destructive bg-destructive/10 animate-in fade-in">
                                   <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                                   <div>
                                       <AlertTitle className="font-bold text-destructive">Disponibilidad de Inventario</AlertTitle>
                                       <AlertDescription className="text-xs space-y-1 mt-1 text-destructive font-medium">
                                           {stockErrors.map(err => (
                                               <p key={err.id}>• {err.message}</p>
                                           ))}
                                           <p className="pt-1 font-bold underline">
                                               <Link href="/products">Regresar a la tienda para ajustar tu carrito</Link>
                                           </p>
                                       </AlertDescription>
                                   </div>
                               </Alert>
                           )}
                        </CardContent>
                        <CardFooter>
                            <Button 
                                className="w-full text-xl font-black h-16 shadow-lg hover:scale-[1.02] transition-all" 
                                size="lg" 
                                onClick={handleCreateOrder} 
                                disabled={isProcessing || stockErrors.length > 0 || checkingStock}
                                variant={stockErrors.length > 0 ? "destructive" : !paymentReceipt ? "outline" : "default"}
                            >
                                {isProcessing || checkingStock ? (
                                    <Loader2 className="animate-spin mr-2 h-6 w-6"/>
                                ) : stockErrors.length > 0 ? (
                                    <AlertTriangle className="mr-2 h-6 w-6" />
                                ) : !paymentReceipt ? (
                                    <Upload className="mr-2 h-6 w-6 text-primary" />
                                ) : (
                                    <CheckCircle2 className="mr-2 h-6 w-6" />
                                )}
                                {checkingStock 
                                    ? "VERIFICANDO STOCK..." 
                                    : stockErrors.length > 0 
                                        ? "AJUSTA TU CARRITO" 
                                        : !paymentReceipt
                                            ? "SUBE TU COMPROBANTE"
                                            : "CONFIRMAR PEDIDO"}
                            </Button>
                        </CardFooter>
                    </Card>
                </div>
            </div>
        </div>
    );
}
