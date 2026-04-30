
'use client'

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { getDeliveryFees, addDeliveryFee, updateDeliveryFee, deleteDeliveryFee } from '@/lib/delivery-fees';
import { PlusCircle, Trash2, Loader2, Edit, MoreVertical, Route, ArrowRight, MapPin, Save } from 'lucide-react';
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
import { formatCurrency, formatCurrencyInput, parseFormattedCurrency } from '@/lib/utils';
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
  )
}

function OriginPointCard() {
    const [settings, setSettings] = useState({ lat: null, lng: null });
    const [isLocating, setIsLocating] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        const unsub = onSnapshot(doc(db, 'settings', 'homepage'), (doc) => {
            if (doc.exists()) {
                const data = doc.data();
                setSettings({
                    lat: data.deliveryOriginLat || null,
                    lng: data.deliveryOriginLng || null,
                });
            }
        });
        return () => unsub();
    }, []);

    const handleGetLocation = () => {
        setIsLocating(true);
        navigator.geolocation.getCurrentPosition(
            (position) => {
                setSettings({
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                });
                setIsLocating(false);
                toast({ title: 'Ubicación Obtenida', description: 'No olvides guardar los cambios.' });
            },
            (error) => {
                setIsLocating(false);
                toast({ title: 'Error de Ubicación', description: 'No se pudo obtener la ubicación.', variant: 'destructive' });
            }
        );
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await updateHomepageSettings({
                deliveryOriginLat: settings.lat,
                deliveryOriginLng: settings.lng,
            });
            toast({ title: 'Éxito', description: 'Punto de partida guardado.' });
        } catch (error) {
            toast({ title: 'Error', description: 'No se pudo guardar el punto de partida.', variant: 'destructive' });
        } finally {
            setIsSaving(false);
        }
    };
    
    const handleCoordChange = (coord, value) => {
        setSettings(prev => ({ ...prev, [coord]: value === '' ? null : parseFloat(value) }));
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Punto de Partida para Envíos</CardTitle>
                <CardDescription>Establece la ubicación desde donde se originan tus entregas para calcular las distancias.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <Button onClick={handleGetLocation} disabled={isLocating}>
                    <MapPin className="mr-2 h-4 w-4" />
                    {isLocating ? <Loader2 className="animate-spin" /> : 'Obtener Ubicación Actual con GPS'}
                </Button>
                 <div className="grid sm:grid-cols-2 gap-4">
                     <div>
                        <Label htmlFor="lat-input">Latitud</Label>
                        <Input 
                            id="lat-input"
                            type="number"
                            step="any"
                            value={settings.lat ?? ''} 
                            onChange={(e) => handleCoordChange('lat', e.target.value)}
                            placeholder="Ej: 9.9333"
                        />
                     </div>
                     <div>
                        <Label htmlFor="lng-input">Longitud</Label>
                        <Input 
                            id="lng-input"
                            type="number"
                            step="any"
                            value={settings.lng ?? ''}
                            onChange={(e) => handleCoordChange('lng', e.target.value)}
                            placeholder="Ej: -84.0833"
                        />
                     </div>
                 </div>
                 {settings.lat && settings.lng && (
                    <div className="flex items-center gap-2">
                         <p className="text-sm text-muted-foreground">Verificar:</p>
                         <Button asChild variant="outline" size="sm">
                             <a href={`https://www.google.com/maps?q=${settings.lat},${settings.lng}`} target="_blank" rel="noopener noreferrer">Google Maps</a>
                         </Button>
                         <Button asChild variant="outline" size="sm">
                             <a href={`https://waze.com/ul?ll=${settings.lat},${settings.lng}&navigate=yes`} target="_blank" rel="noopener noreferrer">Waze</a>
                         </Button>
                    </div>
                 )}
            </CardContent>
             <CardFooter className="flex justify-end">
                <Button onClick={handleSave} disabled={isSaving || !settings.lat}>
                    <Save className="mr-2 h-4 w-4" />
                    {isSaving ? <Loader2 className="animate-spin" /> : 'Guardar Punto de Partida'}
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
  const { toast } = useToast();

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
