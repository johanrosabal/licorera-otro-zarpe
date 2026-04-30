
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
    Info 
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
import dynamic from 'next/dynamic';

// Dynamically import map component for SSR compatibility
const LocationPicker = dynamic(
  () => import('@/components/location-picker').then((mod) => mod.LocationPicker),
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
    const [distance, setDistance] = useState(null);
    const [orderPlaced, setOrderPlaced] = useState(false);
    const [completedOrderNumber, setCompletedOrderNumber] = useState(null);
    const [deliveriesEnabled, setDeliveriesEnabled] = useState(true);
    const [referenceCopied, setReferenceCopied] = useState(false);
    const [ibanCopied, setIbanCopied] = useState(false);
    const [sinpeCopied, setSinpeCopied] = useState(false);
    const [showMapMode, setShowMapMode] = useState(false);

    const [paymentReference] = useState(() => Math.random().toString(36).substring(2, 7).toUpperCase());

    useEffect(() => {
        if (user) setCurrentUser(user);
    }, [user]);
    
    useEffect(() => {
        if (!authLoading && isCartInitialized && !orderPlaced) {
            if (!user) {
                router.replace('/login?redirect=/checkout');
            } else if (cartItems.length === 0) {
                toast({ title: "Tu carrito está vacío" });
                router.replace('/products');
            }
        }
    }, [user, authLoading, cartItems.length, router, toast, isCartInitialized, orderPlaced]);

    useEffect(() => {
        async function fetchInitialData() {
            if(user && isCartInitialized && cartItems.length > 0) {
                try {
                    const [methods, fees, settings] = await Promise.all([
                        getPaymentMethodsWithAccounts({ activeOnly: true }),
                        getDeliveryFees(),
                        getHomepageSettings(),
                    ]);

                    setPaymentMethods(methods);
                    if (methods.length > 0) setSelectedPaymentMethodId(methods[0].id);

                    const isDeliveryOn = settings?.deliveriesEnabled !== false;
                    setDeliveriesEnabled(isDeliveryOn);

                    const userCoords = extractCoordsFromUrl(currentUser?.locationUrl);
                    const storeCoords = settings?.deliveryOriginLat && settings?.deliveryOriginLng ? { lat: settings.deliveryOriginLat, lng: settings.deliveryOriginLng } : null;

                    if (!isDeliveryOn) {
                        setDeliveryFee(0);
                        setDistance(null);
                    } else {
                        if(userCoords && storeCoords) {
                            const calculatedDistance = calculateHaversineDistance(storeCoords.lat, storeCoords.lng, userCoords.lat, userCoords.lng);
                            setDistance(calculatedDistance);
                            const applicableFee = fees.find(fee => calculatedDistance >= fee.fromKm && calculatedDistance < fee.toKm);
                            setDeliveryFee(applicableFee ? applicableFee.fee : 3000);
                        } else {
                            setDeliveryFee(3000);
                            setDistance(null);
                        }
                    }
                } catch (error) {
                    console.error("Fetch data error:", error);
                } finally {
                    setLoading(false);
                }
            }
        }
        fetchInitialData();
    }, [user, isCartInitialized, cartItems.length, currentUser]);
    
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
        setIsProcessing(true);
        try {
            const selectedMethod = paymentMethods.find(m => m.id === selectedPaymentMethodId);
            const result = await createOrder({
                userId: user.uid,
                userName: user.name || user.email,
                userEmail: user.email,
                items: cartItems,
                subtotal: subtotal,
                deliveryFee: deliveryFee || 0,
                total: subtotal + (deliveryFee || 0),
                paymentMethod: selectedMethod,
                paymentReceipt,
                paymentReference, 
            });
            
            setCompletedOrderNumber(result.invoiceNumber);
            setOrderPlaced(true);
            await clearCart();
            
            setTimeout(() => {
                router.push('/my-orders');
            }, 3000);

        } catch (error) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
            setIsProcessing(false);
        }
    };
    
    if (authLoading || (loading && !orderPlaced) || !isCartInitialized) {
      return <div className="flex justify-center items-center h-[60vh]"><Loader2 className="h-16 w-16 animate-spin text-primary" /></div>;
    }

    if (orderPlaced) {
        return (
            <div className="container mx-auto py-20 px-4 flex flex-col items-center justify-center min-h-[60vh] animate-in fade-in zoom-in duration-500">
                <Card className="max-w-md w-full text-center shadow-2xl border-primary/20">
                    <CardHeader>
                        <div className="mx-auto bg-green-100 dark:bg-green-900/30 rounded-full p-4 w-fit mb-4">
                            <CheckCircle2 className="h-16 w-16 text-green-600 dark:text-green-400" />
                        </div>
                        <CardTitle className="text-3xl font-headline">¡Pedido Realizado!</CardTitle>
                        <CardDescription className="text-lg">Tu orden ha sido procesada con éxito.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="bg-muted p-6 rounded-xl border-2 border-dashed border-primary/30">
                            <p className="text-sm text-muted-foreground uppercase tracking-wider font-bold mb-1">Número de Orden</p>
                            <p className="text-5xl font-black text-primary">#{completedOrderNumber}</p>
                        </div>
                        <p className="text-muted-foreground">
                            Redirigiendo a tu historial de órdenes...
                        </p>
                    </CardContent>
                    <CardFooter>
                        <Button asChild size="lg" className="w-full font-bold h-12">
                            <Link href="/my-orders">
                                Ir a Mis Órdenes <ArrowRight className="ml-2 h-5 w-5" />
                            </Link>
                        </Button>
                    </CardFooter>
                </Card>
            </div>
        );
    }

    const locationCoords = extractCoordsFromUrl(currentUser?.locationUrl);

    return (
        <div className="container mx-auto py-12 px-4">
            {isProcessing && <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center z-50"><Loader2 className="h-16 w-16 animate-spin text-primary mb-4" /><p className="font-bold">Procesando orden...</p></div>}
            <h1 className="text-3xl font-headline text-center mb-8">Finalizar Compra</h1>
            <div className="flex flex-col lg:flex-row gap-8">
                <div className="lg:w-2/3 space-y-8">
                    <Card className="border-primary/20 shadow-lg overflow-hidden">
                        <CardHeader className="bg-primary/5 border-b border-primary/10">
                            <CardTitle className="flex items-center gap-2">
                                <MapPin className="text-primary" />
                                Ubicación de Entrega
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-6 space-y-6">
                            {!deliveriesEnabled && (
                                <Alert className="bg-blue-50 border-blue-200 text-blue-800">
                                    <Truck className="h-4 w-4 text-blue-600" />
                                    <AlertDescription>
                                        <strong>Nota:</strong> Las entregas están deshabilitadas temporalmente. El envío será coordinado externamente o retiro en tienda.
                                    </AlertDescription>
                                </Alert>
                            )}

                            <div className="flex flex-col gap-6">
                                <Alert className="bg-blue-50 border-blue-300 text-blue-900 shadow-sm">
                                    <AlertTriangle className="h-5 w-5 text-blue-600" />
                                    <AlertTitle className="font-black text-lg">¡IMPORTANTE!</AlertTitle>
                                    <AlertDescription className="text-base">
                                        Para garantizar que su pedido llegue correctamente, es **VITAL** que actualice su ubicación exacta usando el botón de abajo desde su celular o seleccionando en el mapa.
                                    </AlertDescription>
                                </Alert>

                                {!showMapMode ? (
                                    <div className="space-y-4">
                                        <Button 
                                            onClick={handleUpdateLocation} 
                                            disabled={isLocating} 
                                            size="lg" 
                                            className="w-full text-xl h-20 font-black shadow-2xl bg-primary hover:bg-primary/90 transition-all hover:scale-[1.01] active:scale-95 ring-4 ring-primary/10"
                                        >
                                            {isLocating ? <Loader2 className="animate-spin mr-3 h-6 w-6" /> : <MapPin className="mr-3 h-8 w-8" />}
                                            {isLocating ? 'OBTENIENDO GPS...' : 'ACTUALIZAR UBICACIÓN CON GPS'}
                                        </Button>
                                        
                                        <div className="text-center">
                                            <span className="text-xs text-muted-foreground font-bold uppercase tracking-widest">O TAMBIÉN</span>
                                        </div>

                                        <Button 
                                            variant="outline" 
                                            size="lg" 
                                            className="w-full h-14 border-2 border-primary text-primary font-black text-lg shadow-md hover:bg-primary/5"
                                            onClick={() => setShowMapMode(true)}
                                        >
                                            <Map className="mr-2 h-6 w-6" />
                                            BUSCAR UBICACIÓN POR MAPA
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="animate-in fade-in slide-in-from-top-4 duration-500">
                                        <div className="flex items-center justify-between mb-4">
                                            <h3 className="font-black text-lg">Selector de Mapa</h3>
                                            <Button variant="ghost" size="sm" onClick={() => setShowMapMode(false)} className="font-bold text-destructive">
                                                <X className="mr-1 h-4 w-4" /> VOLVER A GPS
                                            </Button>
                                        </div>
                                        <LocationPicker 
                                            initialCoords={locationCoords} 
                                            onConfirm={handleMapLocationConfirm}
                                            onCancel={() => setShowMapMode(false)}
                                        />
                                    </div>
                                )}

                                <div className="flex justify-center">
                                    {locationCoords ? (
                                        <Badge className="bg-green-100 text-green-700 border-green-200 px-4 py-1 text-sm gap-2">
                                            <CheckCircle2 className="h-4 w-4" /> Ubicación GPS Configurada
                                        </Badge>
                                    ) : (
                                        <Badge variant="outline" className="text-orange-600 border-orange-200 bg-orange-50 px-4 py-1 text-sm gap-2">
                                            <Info className="h-4 w-4" /> GPS Pendiente de Actualizar
                                        </Badge>
                                    )}
                                </div>

                                {!locationCoords && !showMapMode && (
                                    <Alert className="bg-orange-50 border-orange-200 text-orange-800">
                                        <AlertTriangle className="h-4 w-4" />
                                        <AlertDescription>No has configurado tu ubicación exacta. Por favor usa los botones de arriba.</AlertDescription>
                                    </Alert>
                                )}
                            </div>

                           <Separator />
                           <div className="grid grid-cols-2 gap-4 text-sm">
                               <div><Label className="text-muted-foreground font-bold uppercase text-[10px]">Cliente</Label><p className="font-black text-lg">{currentUser?.name}</p></div>
                               <div><Label className="text-muted-foreground font-bold uppercase text-[10px]">WhatsApp</Label><p className="font-black text-lg">{currentUser?.whatsapp || '-'}</p></div>
                           </div>
                        </CardContent>
                    </Card>

                    <Card className="border-primary/20 shadow-lg">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><CreditCard className="text-primary" /> Método de Pago</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Tabs value={selectedPaymentMethodId} onValueChange={setSelectedPaymentMethodId} className="w-full">
                                <TabsList className="grid w-full grid-cols-2 mb-4">
                                    {paymentMethods.map(method => <TabsTrigger key={method.id} value={method.id} className="font-bold">{method.name}</TabsTrigger>)}
                                </TabsList>
                                {paymentMethods.map(method => (
                                    <TabsContent key={method.id} value={method.id} className="bg-muted/30 p-6 rounded-xl border-2 border-primary/5 space-y-6">
                                        
                                        <div className="bg-muted p-4 rounded-xl text-center relative border border-border">
                                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">REFERENCIA ÚNICA PARA ESTE PAGO:</p>
                                            <div className="flex flex-col items-center justify-center gap-3">
                                                <p className="text-5xl font-black tracking-tight text-foreground">{paymentReference}</p>
                                                <Button 
                                                    variant="secondary" 
                                                    size="sm" 
                                                    className="flex items-center gap-2 font-bold h-9" 
                                                    onClick={handleCopyReference}
                                                >
                                                    {referenceCopied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                                                    {referenceCopied ? '¡Copiado!' : 'Copiar Código'}
                                                </Button>
                                            </div>
                                            <p className="text-[10px] text-muted-foreground mt-2">Por favor, escriba este código en el <span className="font-bold">detalle o concepto</span> de su pago.</p>
                                        </div>

                                        {method.bankAccount ? (
                                            <div className="text-center space-y-4 pt-4">
                                                <div>
                                                    <p className="text-[10px] uppercase text-muted-foreground font-bold mb-1">TITULAR DE LA CUENTA</p>
                                                    <p className="text-2xl font-black uppercase tracking-tight">{method.bankAccount.accountHolder}</p>
                                                </div>
                                                
                                                <Separator className="my-4 opacity-50" />

                                                {method.name.toLowerCase().includes('sinpe') ? (
                                                  method.bankAccount.sinpeMovil && (
                                                    <div className="py-2">
                                                        <p className="text-[10px] uppercase text-muted-foreground font-bold">NÚMERO SINPE MÓVIL</p>
                                                        <p className="text-6xl font-mono font-black text-primary my-2 leading-none tracking-tighter">
                                                            {formatSinpeMovil(method.bankAccount.sinpeMovil)}
                                                        </p>
                                                        <Button 
                                                            variant="outline" 
                                                            size="sm" 
                                                            className="flex items-center gap-2 mx-auto font-bold mt-2" 
                                                            onClick={() => handleCopySinpe(method.bankAccount.sinpeMovil)}
                                                        >
                                                            {sinpeCopied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                                                            {sinpeCopied ? '¡Copiado!' : 'Copiar Número'}
                                                        </Button>
                                                    </div>
                                                  )
                                                ) : (
                                                  method.bankAccount.iban && (
                                                    <div className="space-y-4">
                                                        <div>
                                                            <p className="text-[10px] uppercase text-muted-foreground font-bold mb-1">CUENTA IBAN</p>
                                                            <p className="text-xl font-mono break-all font-black tracking-tighter text-foreground mb-3">
                                                                {method.bankAccount.iban}
                                                            </p>
                                                            <Button 
                                                                variant="outline" 
                                                                size="sm" 
                                                                className="flex items-center gap-2 mx-auto font-bold" 
                                                                onClick={() => handleCopyIban(method.bankAccount.iban)}
                                                            >
                                                                {ibanCopied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                                                                {ibanCopied ? '¡Copiado!' : 'Copiar IBAN'}
                                                            </Button>
                                                        </div>
                                                    </div>
                                                  )
                                                )}
                                                
                                                <div className="pt-4">
                                                    <p className="text-sm font-bold text-muted-foreground uppercase tracking-wider">
                                                        {method.bankAccount.bankName} ({method.bankAccount.currency})
                                                    </p>
                                                </div>
                                            </div>
                                        ) : <div className="text-center p-4"><p className="font-medium">{method.instructions}</p></div>}
                                    </TabsContent>
                                ))}
                            </Tabs>
                            <div className="mt-8">
                                <Label className="text-lg font-bold flex items-center gap-2 mb-2"><Upload className="h-5 w-5 text-primary" /> Subir Comprobante (Opcional)</Label>
                                <Input type="file" className="hidden" id="receipt-upload" accept="image/*" onChange={(e) => setPaymentReceipt(e.target.files?.[0])} />
                                <label htmlFor="receipt-upload" className="mt-2 block w-full h-40 border-2 border-dashed border-primary/20 rounded-xl flex items-center justify-center cursor-pointer bg-muted/20 hover:bg-muted/40 hover:border-primary transition-all relative overflow-hidden group">
                                    {receiptPreview ? (
                                        <>
                                            <Image src={receiptPreview} alt="Comprobante" fill className="object-contain p-2" unoptimized />
                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                <p className="text-white font-bold">Cambiar imagen</p>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="text-center text-muted-foreground">
                                            <Upload className="mx-auto h-10 w-10 mb-2 opacity-50"/>
                                            <p className="font-medium">Clic para subir comprobante</p>
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
                                    <span>Envío {distance ? `(${distance.toFixed(1)} km)` : ''}</span>
                                    <span className="font-medium text-foreground">{formatCurrency(deliveryFee)}</span>
                               </div>
                           )}
                           <Separator />
                           <div className="flex justify-between font-black text-3xl text-primary pt-2">
                               <span>TOTAL</span>
                               <span>{formatCurrency(subtotal + (deliveryFee || 0))}</span>
                           </div>
                        </CardContent>
                        <CardFooter>
                            <Button className="w-full text-xl font-black h-16 shadow-lg hover:scale-[1.02] transition-all" size="lg" onClick={handleCreateOrder} disabled={isProcessing}>
                                {isProcessing ? <Loader2 className="animate-spin mr-2 h-6 w-6"/> : <CheckCircle2 className="mr-2 h-6 w-6" />}
                                CONFIRMAR PEDIDO
                            </Button>
                        </CardFooter>
                    </Card>
                </div>
            </div>
        </div>
    );
}
