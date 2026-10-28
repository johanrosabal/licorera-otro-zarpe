
'use client'

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { getDeliveryFees, addDeliveryFee, updateDeliveryFee, deleteDeliveryFee } from '@/lib/delivery-fees';
import { PlusCircle, Trash2, Loader2, Edit, MoreVertical, Route, ArrowRight, MapPin, Save, Truck, Tag, Info, CheckCircle2, Link2, Compass, AlertCircle, AlertTriangle, ExternalLink } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { AuthorizedOnly } from '@/components/auth/authorized-only';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { collection, onSnapshot, query, orderBy, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { formatCurrency, formatCurrencyInput, parseFormattedCurrency, extractCoordsFromUrl } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { getHomepageSettings, updateHomepageSettings } from '@/lib/settings';
import { Label } from '@/components/ui/label';

const feeSchema = z.object({
  fromKm: z.coerce.number().min(0, 'La distancia mínima debe ser 0 o mayor.'),
  toKm: z.coerce.number().min(0, 'La distancia máxima debe ser 0 o mayor.'),
  fee: z.coerce.number().min(0, 'La tarifa no puede ser negativa.'),
}).refine(data => data.toKm > data.fromKm, {
    message: 'La distancia "hasta" debe ser mayor que la distancia "desde".',
    path: ['toKm'],
});


function FeeForm({ fee, allFees, onFinished }) {
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();
  
  const form = useForm({
    resolver: zodResolver(feeSchema),
    defaultValues: fee || {
      fromKm: 0,
      toKm: 5,
      fee: 2000,
    },
  });

  const onSubmit = async (data) => {
    // Check for overlapping ranges
    const overlaps = allFees.some(existingFee => {
        // Skip check against the fee being edited
        if (fee && fee.id === existingFee.id) return false;
        
        return (
            Math.max(data.fromKm, existingFee.fromKm) < Math.min(data.toKm, existingFee.toKm)
        );
    });

    if (overlaps) {
        toast({ title: "Error de Rango", description: "El rango de distancia se superpone con una tarifa existente.", variant: "destructive" });
        return;
    }

    setSubmitting(true);
    try {
      if (fee) {
        await updateDeliveryFee(fee.id, data);
        toast({ title: "Éxito", description: "Tarifa actualizada correctamente." });
      } else {
        await addDeliveryFee(data);
        toast({ title: "Éxito", description: "Tarifa añadida correctamente." });
      }
      onFinished?.(true);
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "No se pudo guardar la tarifa.", variant: "destructive" });
      onFinished?.(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <DialogHeader>
          <DialogTitle>{fee ? 'Editar Tarifa' : 'Añadir Nueva Tarifa de Envío'}</DialogTitle>
          <DialogDescription>
            Define una tarifa para un rango de distancia específico en kilómetros.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid grid-cols-2 gap-4">
            <FormField control={form.control} name="fromKm" render={({ field }) => (
                <FormItem>
                    <FormLabel>Desde (Km)</FormLabel>
                    <FormControl><Input type="number" step="0.1" placeholder="0" {...field} /></FormControl>
                    <FormMessage />
                </FormItem>
            )} />
            <FormField control={form.control} name="toKm" render={({ field }) => (
                <FormItem>
                    <FormLabel>Hasta (Km)</FormLabel>
                    <FormControl><Input type="number" step="0.1" placeholder="5" {...field} /></FormControl>
                    <FormMessage />
                </FormItem>
            )} />
        </div>

        <FormField
          control={form.control}
          name="fee"
          render={({ field }) => (
            <FormItem>
                <FormLabel>Costo de la Tarifa (CRC)</FormLabel>
                 <FormControl>
                    <Input
                        type="text"
                        className="text-right"
                        value={formatCurrencyInput(field.value ?? '')}
                        onChange={(e) => {
                            const rawValue = e.target.value;
                            const parsedValue = parseFormattedCurrency(rawValue);
                            field.onChange(parsedValue);
                        }}
                    />
                </FormControl>
                <FormMessage />
            </FormItem>
        )} />
        
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => onFinished?.(false)}>Cancelar</Button>
          <Button type="submit" disabled={submitting}>
            {submitting && <Loader2 className="animate-spin mr-2" />}
            {fee ? 'Guardar Cambios' : 'Añadir Tarifa'}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}

function DeliveryFeeModeCard() {
    const [feeType, setFeeType] = useState('distance'); // 'fixed' | 'distance'
    const [fixedFee, setFixedFee] = useState(3000);
    const [isSaving, setIsSaving] = useState(false);
    const [initialLoaded, setInitialLoaded] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        const unsub = onSnapshot(doc(db, 'settings', 'homepage'), (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setFeeType(data.deliveryFeeType || 'distance');
                setFixedFee(Number(data.fixedDeliveryFee ?? 3000));
            }
            setInitialLoaded(true);
        });
        return () => unsub();
    }, []);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await updateHomepageSettings({
                deliveryFeeType: feeType,
                fixedDeliveryFee: Number(fixedFee) || 0,
            });
            toast({ 
                title: 'Modalidad Guardada', 
                description: feeType === 'fixed' 
                    ? `Tarifa fija activada (${formatCurrency(fixedFee)} por envío).` 
                    : 'Modo de cálculo por distancia activado.' 
            });
        } catch (error) {
            toast({ title: 'Error', description: 'No se pudo guardar la configuración.', variant: 'destructive' });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Card className="border-primary/20 shadow-lg overflow-hidden">
            <CardHeader className="bg-primary/5 border-b border-primary/10">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                        <CardTitle className="flex items-center gap-2 text-xl font-headline">
                            <Truck className="h-6 w-6 text-primary" /> Modalidad de Cobro de Envíos
                        </CardTitle>
                        <CardDescription className="text-sm">
                            Elige si deseas cobrar una tarifa fija para todos los pedidos o calcular el costo automáticamente según la distancia en kilómetros.
                        </CardDescription>
                    </div>
                    {initialLoaded && (
                        <Badge 
                            variant={feeType === 'fixed' ? 'default' : 'secondary'} 
                            className="w-fit text-xs font-bold uppercase tracking-wider py-1.5 px-3 flex items-center gap-1.5"
                        >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            {feeType === 'fixed' 
                                ? `Tarifa Fija: ${formatCurrency(fixedFee)}` 
                                : 'Por Distancia (Tabla)'}
                        </Badge>
                    )}
                </div>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
                <RadioGroup 
                    value={feeType} 
                    onValueChange={setFeeType} 
                    className="grid grid-cols-1 md:grid-cols-2 gap-4"
                >
                    {/* Opción 1: Tarifa Fija */}
                    <div 
                        onClick={() => setFeeType('fixed')}
                        className={`cursor-pointer rounded-xl border-2 p-5 transition-all flex flex-col justify-between gap-4 ${
                            feeType === 'fixed' 
                                ? 'border-primary bg-primary/5 shadow-md ring-1 ring-primary/30' 
                                : 'border-border/60 hover:border-primary/40 bg-card'
                        }`}
                    >
                        <div className="flex items-start gap-3">
                            <RadioGroupItem value="fixed" id="mode-fixed" className="mt-1" />
                            <div className="space-y-1">
                                <Label htmlFor="mode-fixed" className="font-black text-base cursor-pointer flex items-center gap-2">
                                    <Tag className="h-4 w-4 text-primary" /> Tarifa Fija de Envío
                                </Label>
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                    Se cobra un monto fijo único a todos los pedidos a domicilio, sin importar la distancia ni la ubicación del cliente.
                                </p>
                            </div>
                        </div>

                        {feeType === 'fixed' && (
                            <div className="pt-3 border-t border-primary/20 space-y-2 animate-in fade-in slide-in-from-top-2">
                                <Label htmlFor="fixed-fee-input" className="text-xs font-bold uppercase text-muted-foreground">
                                    Costo de Tarifa Fija (CRC)
                                </Label>
                                <Input
                                    id="fixed-fee-input"
                                    type="text"
                                    className="text-right text-xl font-black h-12"
                                    value={formatCurrencyInput(fixedFee ?? '')}
                                    onChange={(e) => {
                                        const parsed = parseFormattedCurrency(e.target.value);
                                        setFixedFee(parsed);
                                    }}
                                    placeholder="₡ 3,000"
                                />
                                <p className="text-[11px] text-muted-foreground">
                                    Este es el costo que pagarán los clientes en el checkout como tarifa de entrega.
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Opción 2: Tarifa por Distancia */}
                    <div 
                        onClick={() => setFeeType('distance')}
                        className={`cursor-pointer rounded-xl border-2 p-5 transition-all flex flex-col justify-between gap-4 ${
                            feeType === 'distance' 
                                ? 'border-primary bg-primary/5 shadow-md ring-1 ring-primary/30' 
                                : 'border-border/60 hover:border-primary/40 bg-card'
                        }`}
                    >
                        <div className="flex items-start gap-3">
                            <RadioGroupItem value="distance" id="mode-distance" className="mt-1" />
                            <div className="space-y-1">
                                <Label htmlFor="mode-distance" className="font-black text-base cursor-pointer flex items-center gap-2">
                                    <Route className="h-4 w-4 text-primary" /> Tabla de Tarifas por Distancia
                                </Label>
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                    El costo se calcula en tiempo real según los kilómetros entre el Punto de Partida y el GPS del cliente, usando los rangos de la tabla inferior.
                                </p>
                            </div>
                        </div>

                        {feeType === 'distance' && (
                            <div className="pt-3 border-t border-primary/20 space-y-2 animate-in fade-in slide-in-from-top-2">
                                <Alert className="bg-primary/5 border-primary/20 py-2.5">
                                    <Info className="h-4 w-4 text-primary shrink-0" />
                                    <AlertDescription className="text-xs">
                                        Requiere configurar el <strong>Punto de Partida</strong> y al menos un rango en la <strong>Tabla de Tarifas</strong> abajo.
                                    </AlertDescription>
                                </Alert>
                            </div>
                        )}
                    </div>
                </RadioGroup>
            </CardContent>
            <CardFooter className="bg-muted/20 border-t border-border/40 flex flex-col sm:flex-row justify-between items-center gap-3 py-4 px-6">
                <p className="text-xs text-muted-foreground">
                    El modo seleccionado se aplicará de inmediato al finalizar compras.
                </p>
                <Button 
                    onClick={handleSave} 
                    disabled={isSaving} 
                    size="lg"
                    className="font-bold w-full sm:w-auto"
                >
                    {isSaving ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Save className="mr-2 h-4 w-4" />}
                    Guardar Modalidad de Envío
                </Button>
            </CardFooter>
        </Card>
    );
}

function OriginPointCard() {
    const [settings, setSettings] = useState({ lat: null, lng: null });
    const [urlInput, setUrlInput] = useState('');
    const [isLocating, setIsLocating] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [inputError, setInputError] = useState(null);
    const [detectedMessage, setDetectedMessage] = useState(null);
    const { toast } = useToast();

    useEffect(() => {
        const unsub = onSnapshot(doc(db, 'settings', 'homepage'), (doc) => {
            if (doc.exists()) {
                const data = doc.data();
                setSettings({
                    lat: data.deliveryOriginLat ?? null,
                    lng: data.deliveryOriginLng ?? null,
                });
                if (data.storeLocationUrl) {
                    setUrlInput(data.storeLocationUrl);
                }
            }
        });
        return () => unsub();
    }, []);

    const processInput = (text, showToast = true) => {
        if (!text || !text.trim()) {
            setInputError('Por favor ingresa un link de Google Maps, WhatsApp o coordenadas.');
            setDetectedMessage(null);
            return false;
        }

        const coords = extractCoordsFromUrl(text);
        if (coords) {
            setSettings({ lat: coords.lat, lng: coords.lng });
            setInputError(null);
            setDetectedMessage(`Coordenadas detectadas: Lat ${coords.lat}, Lng ${coords.lng}`);
            if (showToast) {
                toast({ 
                    title: '¡Ubicación Detectada!', 
                    description: `Latitud: ${coords.lat}, Longitud: ${coords.lng}. Recuerda guardar los cambios.` 
                });
            }
            return true;
        } else {
            setDetectedMessage(null);
            setInputError('No se pudieron extraer coordenadas de este texto. Asegúrate de que sea un enlace válido de Google Maps, WhatsApp o coordenadas (ej: 10.008148, -84.122924).');
            return false;
        }
    };

    const handleUrlChange = (e) => {
        const val = e.target.value;
        setUrlInput(val);
        setInputError(null);
        setDetectedMessage(null);

        // Auto-extract if user pastes a URL or coordinate pattern
        if (val && (val.includes('http') || val.includes('maps') || val.includes(',') || val.includes('!3d') || val.includes('@') || val.includes('°'))) {
            processInput(val, false);
        }
    };

    const handleGetLocation = () => {
        setIsLocating(true);
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const lat = parseFloat(position.coords.latitude.toFixed(6));
                const lng = parseFloat(position.coords.longitude.toFixed(6));
                setSettings({ lat, lng });
                setUrlInput(`https://www.google.com/maps?q=${lat},${lng}`);
                setDetectedMessage(`GPS detectado: Lat ${lat}, Lng ${lng}`);
                setInputError(null);
                setIsLocating(false);
                toast({ title: 'Ubicación Obtenida', description: 'Coordenadas GPS actualizadas. No olvides guardar los cambios.' });
            },
            (error) => {
                setIsLocating(false);
                toast({ title: 'Error de Ubicación', description: 'No se pudo obtener la ubicación GPS.', variant: 'destructive' });
            }
        );
    };

    // Auto-fix suggestions for coordinates typed without decimal points (e.g. -84122928 or 10008151)
    const lngFix = useMemo(() => {
        if (!settings.lng) return null;
        const val = settings.lng;
        if (Math.abs(val) > 180) {
            const str = String(val).trim();
            if (str.startsWith('-84') && str.length >= 5) {
                return parseFloat(`-84.${str.slice(3)}`);
            }
            if (str.startsWith('-8') && str.length >= 4) {
                return parseFloat(`-8${str.slice(2, 3)}.${str.slice(3)}`);
            }
        }
        return null;
    }, [settings.lng]);

    const latFix = useMemo(() => {
        if (!settings.lat) return null;
        const val = settings.lat;
        if (Math.abs(val) > 90) {
            const str = String(val).trim();
            if (str.startsWith('10') && str.length >= 4) {
                return parseFloat(`10.${str.slice(2)}`);
            }
            if (str.startsWith('9') && str.length >= 3) {
                return parseFloat(`9.${str.slice(1)}`);
            }
        }
        return null;
    }, [settings.lat]);

    const handleCoordChange = (coord, value) => {
        setSettings(prev => ({ ...prev, [coord]: value === '' ? null : parseFloat(value) }));
    };

    const handleSave = async () => {
        if (!settings.lat || !settings.lng) {
            toast({ title: 'Faltan coordenadas', description: 'Por favor ingresa o extrae la latitud y longitud.', variant: 'destructive' });
            return;
        }

        if (Math.abs(settings.lat) > 90 || Math.abs(settings.lng) > 180) {
            toast({ 
                title: 'Coordenadas Fuera de Rango', 
                description: 'La latitud debe estar entre -90 y 90, y la longitud entre -180 y 180. Revisa que lleven el punto decimal (ej: -84.122924).', 
                variant: 'destructive' 
            });
            return;
        }

        setIsSaving(true);
        try {
            const updatePayload = {
                deliveryOriginLat: Number(settings.lat),
                deliveryOriginLng: Number(settings.lng),
            };
            if (urlInput && urlInput.trim().startsWith('http')) {
                updatePayload.storeLocationUrl = urlInput.trim();
            }
            await updateHomepageSettings(updatePayload);
            toast({ title: 'Éxito', description: 'Punto de partida guardado correctamente.' });
        } catch (error) {
            toast({ title: 'Error', description: 'No se pudo guardar el punto de partida.', variant: 'destructive' });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Card className="border-primary/20 shadow-lg">
            <CardHeader className="bg-primary/5 border-b border-primary/10">
                <CardTitle className="flex items-center gap-2 text-xl font-headline">
                    <MapPin className="h-6 w-6 text-primary" /> Punto de Partida para Envíos
                </CardTitle>
                <CardDescription className="text-sm">
                    Establece la ubicación desde donde se originan tus entregas para calcular las distancias en tiempo real.
                </CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
                {/* Opción 1: Pegar link de Google Maps, WhatsApp o texto con coordenadas */}
                <div className="space-y-3 bg-muted/40 p-4 rounded-xl border border-border/60">
                    <Label htmlFor="url-input" className="font-bold flex items-center gap-2 text-sm text-foreground">
                        <Link2 className="h-4 w-4 text-primary" />
                        Pegar Link de Google Maps, Enlace de WhatsApp o Coordenadas
                    </Label>
                    <div className="flex flex-col sm:flex-row gap-2">
                        <div className="relative flex-1">
                            <Input
                                id="url-input"
                                type="text"
                                value={urlInput}
                                onChange={handleUrlChange}
                                placeholder="Pega aquí el enlace de Google Maps, WhatsApp o coordenadas (ej: 10.008148, -84.122924)"
                                className="pr-10 text-xs sm:text-sm font-mono"
                            />
                            {urlInput && (
                                <button
                                    type="button"
                                    onClick={() => { setUrlInput(''); setInputError(null); setDetectedMessage(null); }}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs font-bold"
                                    title="Limpiar"
                                >
                                    ✕
                                </button>
                            )}
                        </div>
                        <Button 
                            type="button" 
                            variant="secondary" 
                            onClick={() => processInput(urlInput, true)}
                            className="font-bold shrink-0"
                        >
                            <Compass className="mr-2 h-4 w-4 text-primary" />
                            Extraer Coordenadas
                        </Button>
                    </div>

                    {detectedMessage && (
                        <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 p-2.5 rounded-lg animate-in fade-in">
                            <CheckCircle2 className="h-4 w-4 shrink-0" />
                            <span>{detectedMessage}</span>
                        </div>
                    )}

                    {inputError && (
                        <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 border border-destructive/20 p-2.5 rounded-lg">
                            <AlertCircle className="h-4 w-4 shrink-0" />
                            <span>{inputError}</span>
                        </div>
                    )}
                </div>

                <div className="relative flex py-1 items-center">
                    <div className="flex-grow border-t border-border/60"></div>
                    <span className="flex-shrink mx-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">O Ingresa Manualmente / Usa GPS</span>
                    <div className="flex-grow border-t border-border/60"></div>
                </div>

                {/* Opción 2: Latitud y Longitud Manuales */}
                <div className="space-y-3">
                    <div className="grid sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <Label htmlFor="lat-input" className="font-bold text-xs uppercase text-muted-foreground">Latitud</Label>
                            <Input 
                                id="lat-input"
                                type="number"
                                step="any"
                                value={settings.lat ?? ''} 
                                onChange={(e) => handleCoordChange('lat', e.target.value)}
                                placeholder="Ej: 10.008148"
                                className="font-mono text-sm"
                            />
                            {latFix && (
                                <button
                                    type="button"
                                    onClick={() => handleCoordChange('lat', latFix)}
                                    className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold underline flex items-center gap-1 hover:opacity-80"
                                >
                                    <AlertTriangle className="h-3 w-3" /> ¿Falta punto decimal? Corregir a {latFix}
                                </button>
                            )}
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="lng-input" className="font-bold text-xs uppercase text-muted-foreground">Longitud</Label>
                            <Input 
                                id="lng-input"
                                type="number"
                                step="any"
                                value={settings.lng ?? ''}
                                onChange={(e) => handleCoordChange('lng', e.target.value)}
                                placeholder="Ej: -84.122924"
                                className="font-mono text-sm"
                            />
                            {lngFix && (
                                <button
                                    type="button"
                                    onClick={() => handleCoordChange('lng', lngFix)}
                                    className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold underline flex items-center gap-1 hover:opacity-80"
                                >
                                    <AlertTriangle className="h-3 w-3" /> ¿Falta punto decimal? Corregir a {lngFix}
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Opción 3: Obtener con GPS y Botones de Verificación */}
                <div className="flex flex-col sm:flex-row gap-3 items-center justify-between pt-2">
                    <Button 
                        type="button"
                        onClick={handleGetLocation} 
                        disabled={isLocating}
                        variant="outline"
                        className="w-full sm:w-auto font-bold border-primary/30 hover:bg-primary/5"
                    >
                        <MapPin className="mr-2 h-4 w-4 text-primary" />
                        {isLocating ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : null}
                        {isLocating ? 'Detectando GPS...' : 'Obtener Ubicación Actual con GPS'}
                    </Button>

                    {settings.lat && settings.lng && Math.abs(settings.lat) <= 90 && Math.abs(settings.lng) <= 180 && (
                        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                            <span className="text-xs text-muted-foreground font-semibold">Verificar punto:</span>
                            <Button asChild variant="secondary" size="sm" className="h-8 text-xs font-bold gap-1">
                                <a href={`https://www.google.com/maps?q=${settings.lat},${settings.lng}`} target="_blank" rel="noopener noreferrer">
                                    Google Maps <ExternalLink className="h-3 w-3" />
                                </a>
                            </Button>
                            <Button asChild variant="secondary" size="sm" className="h-8 text-xs font-bold gap-1">
                                <a href={`https://waze.com/ul?ll=${settings.lat},${settings.lng}&navigate=yes`} target="_blank" rel="noopener noreferrer">
                                    Waze <ExternalLink className="h-3 w-3" />
                                </a>
                            </Button>
                        </div>
                    )}
                </div>
            </CardContent>
            <CardFooter className="bg-muted/20 border-t border-border/40 flex justify-end py-4 px-6">
                <Button 
                    onClick={handleSave} 
                    disabled={isSaving || !settings.lat || !settings.lng || Math.abs(settings.lat) > 90 || Math.abs(settings.lng) > 180}
                    size="lg"
                    className="font-bold"
                >
                    {isSaving ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Save className="mr-2 h-4 w-4" />}
                    Guardar Punto de Partida
                </Button>
            </CardFooter>
        </Card>
    );
}

export default function AdminDeliveryFeesPage() {
  const [fees, setFees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingFee, setEditingFee] = useState(null);
  const [deletingFee, setDeletingFee] = useState(null);
  const [activeFeeType, setActiveFeeType] = useState('distance');
  const { toast } = useToast();

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'homepage'), (docSnap) => {
      if (docSnap.exists()) {
        setActiveFeeType(docSnap.data().deliveryFeeType || 'distance');
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, 'deliveryFees'), orderBy('fromKm'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setFees(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (error) => {
      console.error(error);
      toast({ title: "Error", description: "No se pudieron cargar las tarifas de envío.", variant: "destructive" });
      setLoading(false);
    });

    return () => unsubscribe();
  }, [toast]);

  const handleDelete = async (id) => {
    try {
      await deleteDeliveryFee(id);
      toast({ title: "Éxito", description: "Tarifa eliminada correctamente." });
    } catch (error) {
      toast({ title: "Error", description: "No se pudo eliminar la tarifa.", variant: "destructive" });
    } finally {
      setDeletingFee(null);
    }
  }
  
  const handleFormFinished = (success) => {
    if (success) {
      setIsFormOpen(false);
      setEditingFee(null);
    }
  }

  const openFormModal = (fee = null) => {
    setEditingFee(fee);
    setIsFormOpen(true);
  }

  return (
    <AuthorizedOnly allowedRoles={['ADMIN']}>
      <div className="space-y-6">
        <Dialog open={isFormOpen} onOpenChange={(isOpen) => {
            if(!isOpen) {
                setIsFormOpen(false);
                setEditingFee(null);
            } else {
                setIsFormOpen(isOpen);
            }
        }}>
            <DialogContent>
                <FeeForm fee={editingFee} allFees={fees} onFinished={handleFormFinished} />
            </DialogContent>
        </Dialog>
        
        <AlertDialog open={!!deletingFee} onOpenChange={(open) => !open && setDeletingFee(null)}>
            <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                <AlertDialogDescription>Esta acción no se puede deshacer. Se eliminará permanentemente la tarifa de envío.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setDeletingFee(null)}>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={() => handleDelete(deletingFee.id)}>Eliminar</AlertDialogAction>
            </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>

        <DeliveryFeeModeCard />

        <OriginPointCard />

        <Card>
            <CardHeader>
            <div className="flex justify-between items-start gap-4">
                <div>
                <CardTitle>Tarifas de Envío por Distancia</CardTitle>
                <CardDescription>Gestiona los costos de envío basados en la distancia en kilómetros.</CardDescription>
                </div>
                <Button onClick={() => openFormModal()}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Añadir Tarifa
                </Button>
            </div>
            </CardHeader>
            <CardContent>
                {activeFeeType === 'fixed' && (
                    <Alert className="mb-6 bg-blue-50/60 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900 text-blue-900 dark:text-blue-200">
                        <Info className="h-4 w-4 text-blue-600 shrink-0" />
                        <AlertDescription className="text-xs">
                            <strong>Tarifa Fija actualmente activa:</strong> Los clientes pagarán el monto fijo configurado arriba. Los rangos de esta tabla se aplicarán cuando selecciones la modalidad por distancia.
                        </AlertDescription>
                    </Alert>
                )}

                {/* Desktop Table View */}
                <Table className="hidden md:table">
                    <TableHeader>
                    <TableRow>
                        <TableHead>Rango de Distancia (Km)</TableHead>
                        <TableHead className="text-right">Tarifa</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                    </TableHeader>
                    <TableBody>
                    {loading ? (
                        <TableRow>
                        <TableCell colSpan={3} className="text-center h-48">
                            <Loader2 className="mx-auto animate-spin text-primary h-10 w-10" />
                        </TableCell>
                        </TableRow>
                    ) : fees.length > 0 ? (
                        fees.map((fee) => (
                            <TableRow key={fee.id}>
                                <TableCell>
                                    <div className="flex items-center gap-2 font-medium">
                                        <span>{fee.fromKm} Km</span>
                                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                                        <span>{fee.toKm} Km</span>
                                    </div>
                                </TableCell>
                                <TableCell className="text-right font-semibold">{formatCurrency(fee.fee)}</TableCell>
                                <TableCell className="text-right">
                                <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button aria-haspopup="true" size="icon" variant="ghost">
                                    <MoreVertical className="h-4 w-4" />
                                    <span className="sr-only">Menú</span>
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => openFormModal(fee)}>
                                    <Edit className="mr-2 h-4 w-4" />
                                    <span>Editar</span>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onSelect={() => setDeletingFee(fee)} className="text-destructive">
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    <span>Eliminar</span>
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                                </DropdownMenu>
                            </TableCell>
                            </TableRow>
                        ))
                    ) : (
                        <TableRow>
                        <TableCell colSpan={3} className="text-center text-muted-foreground h-48">
                            <Route className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
                            No hay tarifas de envío definidas.
                        </TableCell>
                        </TableRow>
                    )}
                    </TableBody>
                </Table>

                {/* Mobile Card View */}
                <div className="space-y-4 md:hidden">
                    {loading ? (
                        <div className="flex justify-center items-center h-48">
                            <Loader2 className="mx-auto animate-spin text-primary h-10 w-10" />
                        </div>
                    ) : fees.length > 0 ? (
                        fees.map((fee) => (
                            <Card key={fee.id} className="p-4">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="font-semibold text-lg">{formatCurrency(fee.fee)}</p>
                                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                            <span>{fee.fromKm} km</span>
                                            <ArrowRight className="h-4 w-4" />
                                            <span>{fee.toKm} km</span>
                                        </div>
                                    </div>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button aria-haspopup="true" size="icon" variant="ghost" className="-mt-2 -mr-2">
                                                <MoreVertical className="h-4 w-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem onClick={() => openFormModal(fee)}>
                                                <Edit className="mr-2 h-4 w-4" />
                                                <span>Editar</span>
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onSelect={() => setDeletingFee(fee)} className="text-destructive">
                                                <Trash2 className="mr-2 h-4 w-4" />
                                                <span>Eliminar</span>
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            </Card>
                        ))
                    ) : (
                        <div className="text-center text-muted-foreground h-48 flex flex-col justify-center items-center">
                            <Route className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
                            <p>No hay tarifas de envío definidas.</p>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
      </div>
    </AuthorizedOnly>
  );
}
