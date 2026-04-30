
'use client'

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { getBanks, addBank, updateBank, deleteBank } from '@/lib/banks';
import { PlusCircle, Trash2, Loader2, Edit, MoreVertical, Phone, Mail, User, MapPin, Search, Globe, Landmark } from 'lucide-react';
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
  DialogTrigger,
} from "@/components/ui/dialog"
import { AuthorizedOnly } from '@/components/auth/authorized-only';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const bankSchema = z.object({
  name: z.string().min(3, 'El nombre debe tener al menos 3 caracteres.'),
  country: z.string().min(3, 'El país es requerido.'),
  swiftBic: z.string().optional(),
  routingNumber: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email('Debe ser un correo electrónico válido.').optional().or(z.literal('')),
  website: z.string().url('Debe ser una URL válida.').optional().or(z.literal('')),
  contactPerson: z.string().optional(),
  contactEmail: z.string().email('Debe ser un correo electrónico válido.').optional().or(z.literal('')),
  bankUser: z.string().optional(),
  active: z.boolean().default(true),
});


function BankForm({ bank, onFinished }) {
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();
  
  const form = useForm({
    resolver: zodResolver(bankSchema),
    defaultValues: bank || {
      name: '',
      country: 'Costa Rica',
      swiftBic: '',
      routingNumber: '',
      address: '',
      phone: '',
      email: '',
      website: '',
      contactPerson: '',
      contactEmail: '',
      bankUser: '',
      active: true,
    },
  });

  const onSubmit = async (data) => {
    setSubmitting(true);
    try {
      if (bank) {
        await updateBank(bank.id, data);
        toast({ title: "Éxito", description: "Banco actualizado correctamente." });
      } else {
        await addBank(data);
        toast({ title: "Éxito", description: "Banco añadido correctamente." });
      }
      onFinished?.(true);
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "No se pudo guardar el banco.", variant: "destructive" });
      onFinished?.(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <DialogHeader>
                <DialogTitle>{bank ? 'Editar Banco' : 'Añadir Nuevo Banco'}</DialogTitle>
                <DialogDescription>
                    {bank ? 'Actualiza la información del banco.' : 'Completa el formulario para agregar un nuevo banco.'}
                </DialogDescription>
            </DialogHeader>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={form.control} name="name" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Nombre del Banco</FormLabel>
                        <FormControl><Input placeholder="Ej: Banco Nacional" {...field} /></FormControl>
                        <FormMessage />
                    </FormItem>
                )} />
                <FormField control={form.control} name="country" render={({ field }) => (
                    <FormItem>
                        <FormLabel>País</FormLabel>
                        <FormControl><Input placeholder="Ej: Costa Rica" {...field} /></FormControl>
                        <FormMessage />
                    </FormItem>
                )} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={form.control} name="swiftBic" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Código SWIFT/BIC</FormLabel>
                        <FormControl><Input placeholder="Ej: BNCRCRSJ" {...field} /></FormControl>
                        <FormMessage />
                    </FormItem>
                )} />
                <FormField control={form.control} name="routingNumber" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Número de Ruta (Opcional)</FormLabel>
                        <FormControl><Input {...field} /></FormControl>
                        <FormMessage />
                    </FormItem>
                )} />
            </div>
            
            <FormField control={form.control} name="address" render={({ field }) => (
                <FormItem>
                    <FormLabel>Dirección del Banco</FormLabel>
                    <FormControl><Textarea placeholder="Ej: San José, Calles 2 y 4, Avenida 1" {...field} /></FormControl>
                    <FormMessage />
                </FormItem>
            )} />

             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={form.control} name="phone" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Teléfono del Banco</FormLabel>
                        <FormControl>
                            <Input 
                                type="tel" 
                                placeholder="Ej: 22122000" 
                                {...field} 
                            />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )} />
                <FormField control={form.control} name="email" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Correo del Banco</FormLabel>
                        <FormControl><Input type="email" placeholder="Ej: info@bncr.fi.cr" {...field} /></FormControl>
                        <FormMessage />
                    </FormItem>
                )} />
            </div>

            <FormField control={form.control} name="website" render={({ field }) => (
                <FormItem>
                    <FormLabel>Sitio Web</FormLabel>
                    <FormControl><Input placeholder="https://www.bncr.fi.cr" {...field} /></FormControl>
                    <FormMessage />
                </FormItem>
            )} />

            <div className="border-t pt-4">
                <h3 className="text-lg font-medium">Información de Contacto</h3>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                    <FormField control={form.control} name="contactPerson" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Persona de Contacto</FormLabel>
                            <FormControl><Input placeholder="Ej: Ana Rodríguez" {...field} /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                    <FormField control={form.control} name="contactEmail" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Correo de Contacto</FormLabel>
                            <FormControl><Input type="email" placeholder="Ej: ana.rodriguez@banco.com" {...field} /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                 </div>
                 <FormField control={form.control} name="bankUser" render={({ field }) => (
                    <FormItem className="mt-4">
                        <FormLabel>Usuario del Banco</FormLabel>
                        <FormControl><Input placeholder="Ej: Usuario de la plataforma del banco" {...field} /></FormControl>
                        <FormMessage />
                    </FormItem>
                )} />
            </div>
            
            <FormField control={form.control} name="active" render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                        <FormLabel className="text-base">Activo</FormLabel>
                        <FormDescription>
                            Los bancos inactivos no se podrán seleccionar en otras partes del sistema.
                        </FormDescription>
                    </div>
                    <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                </FormItem>
            )} />

            <DialogFooter>
                <Button type="button" variant="secondary" onClick={() => onFinished?.(false)}>Cancelar</Button>
                <Button type="submit" disabled={submitting}>
                    {submitting ? <Loader2 className="animate-spin mr-2" /> : null}
                    Guardar Banco
                </Button>
            </DialogFooter>
        </form>
    </Form>
  )
}

export default function AdminBanksPage() {
  const [banks, setBanks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingBank, setEditingBank] = useState(null);
  const [deletingBank, setDeletingBank] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, 'banks'), orderBy('name'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setBanks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (error) => {
      console.error(error);
      toast({ title: "Error", description: "No se pudieron cargar los bancos.", variant: "destructive" });
      setLoading(false);
    });
    return () => unsubscribe();
  }, [toast]);
  
  const filteredBanks = useMemo(() => {
    const lowercasedFilter = searchTerm.toLowerCase();
    return banks.filter((bank) => {
      return (
        bank.name?.toLowerCase().includes(lowercasedFilter) ||
        bank.country?.toLowerCase().includes(lowercasedFilter) ||
        bank.swiftBic?.toLowerCase().includes(lowercasedFilter)
      );
    });
  }, [banks, searchTerm]);

  const handleToggleActive = async (bank) => {
    try {
        await updateBank(bank.id, { active: !bank.active });
        toast({ title: "Éxito", description: `Banco ${bank.active ? 'desactivado' : 'activado'}.` });
    } catch (error) {
        toast({ title: "Error", description: "No se pudo actualizar el estado.", variant: "destructive" });
    }
  }

  const handleDelete = async (id) => {
    try {
      await deleteBank(id);
      toast({ title: "Éxito", description: "Banco eliminado correctamente." });
      setDeletingBank(null);
    } catch (error) {
      toast({ title: "Error", description: "No se pudo eliminar el banco.", variant: "destructive" });
    }
  }
  
  const handleFormFinished = (success) => {
    if (success) {
      // Data will refresh automatically due to onSnapshot
    }
    setIsFormOpen(false);
    setEditingBank(null);
  }

  const openFormModal = (bank = null) => {
    setEditingBank(bank);
    setIsFormOpen(true);
  }

  return (
    <AuthorizedOnly allowedRoles={['ADMIN']}>
      <div className="w-full">
        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
            <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
                <BankForm bank={editingBank} onFinished={handleFormFinished} />
            </DialogContent>
        </Dialog>
        
        <AlertDialog open={!!deletingBank} onOpenChange={(open) => !open && setDeletingBank(null)}>
            <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                <AlertDialogDescription>
                Esta acción no se puede deshacer. Se eliminará permanentemente el banco.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setDeletingBank(null)}>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={() => handleDelete(deletingBank?.id)}>Eliminar</AlertDialogAction>
            </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>

        <Card>
            <CardHeader>
                <div className="flex justify-between items-start gap-4">
                <div>
                    <CardTitle>Gestión de Bancos</CardTitle>
                    <CardDescription>Añade, edita o elimina bancos de tu lista.</CardDescription>
                </div>
                <Button onClick={() => openFormModal()}>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Añadir Banco
                </Button>
                </div>
                <div className="relative mt-4">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input
                        placeholder="Filtrar por nombre, país o SWIFT..."
                        className="pl-10 w-full md:w-1/2"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </CardHeader>
            <CardContent>
                {/* Desktop Table View */}
                <Table className="hidden md:table">
                <TableHeader>
                    <TableRow>
                    <TableHead>Nombre del Banco</TableHead>
                    <TableHead>País</TableHead>
                    <TableHead>SWIFT/BIC</TableHead>
                    <TableHead>Teléfono</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {loading ? (
                    <TableRow>
                        <TableCell colSpan={6} className="text-center h-48">
                        <Loader2 className="mx-auto animate-spin text-primary h-10 w-10" />
                        </TableCell>
                    </TableRow>
                    ) : filteredBanks.length > 0 ? (
                    filteredBanks.map((bank) => (
                        <TableRow key={bank.id}>
                        <TableCell className="font-medium">{bank.name}</TableCell>
                        <TableCell>{bank.country}</TableCell>
                        <TableCell>{bank.swiftBic || '-'}</TableCell>
                        <TableCell>{bank.phone || '-'}</TableCell>
                        <TableCell>
                            <Switch
                                id={`active-switch-${bank.id}`}
                                checked={bank.active}
                                onCheckedChange={() => handleToggleActive(bank)}
                            />
                        </TableCell>
                        <TableCell className="text-right">
                            <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button aria-haspopup="true" size="icon" variant="ghost">
                                <MoreVertical className="h-4 w-4" />
                                <span className="sr-only">Toggle menu</span>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => openFormModal(bank)}>
                                    <Edit className="mr-2 h-4 w-4" />
                                    <span>Editar</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setDeletingBank(bank); }} className="text-destructive">
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
                        <TableCell colSpan={6} className="text-center text-muted-foreground h-48">
                        {searchTerm ? `No se encontraron bancos para "${searchTerm}".` : "No hay bancos. Añade uno para empezar."}
                        </TableCell>
                    </TableRow>
                    )}
                </TableBody>
                </Table>
                
                {/* Mobile Card View */}
                <div className="space-y-4 md:hidden">
                    {loading ? (
                        <div className="text-center h-48 flex justify-center items-center">
                            <Loader2 className="mx-auto animate-spin text-primary h-10 w-10" />
                        </div>
                    ) : filteredBanks.length > 0 ? (
                        filteredBanks.map(bank => (
                            <Card key={bank.id}>
                                <CardHeader>
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <CardTitle className="text-lg">{bank.name}</CardTitle>
                                            <CardDescription>{bank.country}</CardDescription>
                                        </div>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button aria-haspopup="true" size="icon" variant="ghost">
                                                    <MoreVertical className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem onClick={() => openFormModal(bank)}>
                                                    <Edit className="mr-2 h-4 w-4" /><span>Editar</span>
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setDeletingBank(bank); }} className="text-destructive">
                                                    <Trash2 className="mr-2 h-4 w-4" /><span>Eliminar</span>
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                </CardHeader>
                                <CardContent className="text-sm space-y-2">
                                    <p><span className="font-semibold">SWIFT/BIC:</span> {bank.swiftBic || '-'}</p>
                                    <p><span className="font-semibold">Teléfono:</span> {bank.phone || '-'}</p>
                                </CardContent>
                                <CardFooter>
                                    <div className="flex items-center justify-between w-full">
                                        <span className="text-sm text-muted-foreground">{bank.active ? "Activo" : "Inactivo"}</span>
                                        <Switch checked={bank.active} onCheckedChange={() => handleToggleActive(bank)} />
                                    </div>
                                </CardFooter>
                            </Card>
                        ))
                    ) : (
                        <div className="text-center text-muted-foreground h-48 flex flex-col justify-center items-center">
                            <Landmark className="h-10 w-10 mb-4 text-muted-foreground/50"/>
                            <p>{searchTerm ? `No se encontraron bancos para "${searchTerm}".` : "No hay bancos. Añade uno para empezar."}</p>
                        </div>
                    )}
                </div>
            </CardContent>
            </Card>
        </div>
    </AuthorizedOnly>
  );
}
