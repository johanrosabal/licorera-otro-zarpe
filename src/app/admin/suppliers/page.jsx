
'use client'

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { getSuppliers, addSupplier, updateSupplier, deleteSupplier } from '@/lib/suppliers';
import { PlusCircle, Trash2, Loader2, Edit, MoreVertical, Phone, Mail, User, MapPin, Search } from 'lucide-react';
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

const supplierSchema = z.object({
  name: z.string().min(3, 'El nombre debe tener al menos 3 caracteres.'),
  contactPerson: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email('Debe ser un correo electrónico válido.').optional().or(z.literal('')),
  address: z.string().optional(),
  active: z.boolean().default(true),
});


function SupplierForm({ supplier, onFinished }) {
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();
  
  const form = useForm({
    resolver: zodResolver(supplierSchema),
    defaultValues: supplier || {
      name: '',
      contactPerson: '',
      phone: '',
      email: '',
      address: '',
      active: true,
    },
  });

  const onSubmit = async (data) => {
    setSubmitting(true);
    try {
      if (supplier) {
        await updateSupplier(supplier.id, data);
        toast({ title: "Éxito", description: "Proveedor actualizado correctamente." });
      } else {
        await addSupplier(data);
        toast({ title: "Éxito", description: "Proveedor añadido correctamente." });
      }
      onFinished?.(true);
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "No se pudo guardar el proveedor.", variant: "destructive" });
      onFinished?.(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <DialogHeader>
                <DialogTitle>{supplier ? 'Editar Proveedor' : 'Añadir Nuevo Proveedor'}</DialogTitle>
                <DialogDescription>
                    {supplier ? 'Actualiza la información del proveedor.' : 'Completa el formulario para agregar un nuevo proveedor.'}
                </DialogDescription>
            </DialogHeader>

            <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                    <FormLabel>Nombre del Proveedor</FormLabel>
                    <FormControl><Input placeholder="Ej: Distribuidora de Licores S.A." {...field} /></FormControl>
                    <FormMessage />
                </FormItem>
            )} />

            <FormField control={form.control} name="contactPerson" render={({ field }) => (
                <FormItem>
                    <FormLabel>Persona de Contacto</FormLabel>
                    <FormControl><Input placeholder="Ej: Juan Pérez" {...field} /></FormControl>
                    <FormMessage />
                </FormItem>
            )} />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={form.control} name="phone" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Teléfono</FormLabel>
                        <FormControl>
                            <Input 
                                type="tel" 
                                placeholder="Ej: 88888888" 
                                {...field} 
                            />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )} />
                <FormField control={form.control} name="email" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl><Input type="email" placeholder="Ej: contacto@distribuidora.com" {...field} /></FormControl>
                        <FormMessage />
                    </FormItem>
                )} />
            </div>

            <FormField control={form.control} name="address" render={({ field }) => (
                <FormItem>
                    <FormLabel>Dirección</FormLabel>
                    <FormControl><Textarea placeholder="Ej: San José, Santa Ana, 100mts sur de la iglesia" {...field} /></FormControl>
                    <FormMessage />
                </FormItem>
            )} />
            
            <FormField control={form.control} name="active" render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                        <FormLabel className="text-base">Activo</FormLabel>
                        <FormDescription>
                            Los proveedores inactivos no se mostrarán en otras partes del sistema.
                        </FormDescription>
                    </div>
                    <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                </FormItem>
            )} />

            <DialogFooter>
                <Button type="button" variant="secondary" onClick={() => onFinished?.(false)}>Cancelar</Button>
                <Button type="submit" disabled={submitting}>
                    {submitting ? <Loader2 className="animate-spin mr-2" /> : null}
                    Guardar
                </Button>
            </DialogFooter>
        </form>
    </Form>
  )
}

export default function AdminSuppliersPage() {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [deletingSupplier, setDeletingSupplier] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, 'suppliers'), orderBy('name'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setSuppliers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (error) => {
      console.error(error);
      toast({ title: "Error", description: "No se pudieron cargar los proveedores.", variant: "destructive" });
      setLoading(false);
    });
    return () => unsubscribe();
  }, [toast]);
  
  const filteredSuppliers = useMemo(() => {
    const lowercasedFilter = searchTerm.toLowerCase();
    return suppliers.filter((supplier) => {
      return (
        supplier.name?.toLowerCase().includes(lowercasedFilter) ||
        supplier.contactPerson?.toLowerCase().includes(lowercasedFilter) ||
        supplier.address?.toLowerCase().includes(lowercasedFilter)
      );
    });
  }, [suppliers, searchTerm]);

  const handleToggleActive = async (supplier) => {
    try {
        await updateSupplier(supplier.id, { active: !supplier.active });
        toast({ title: "Éxito", description: `Proveedor ${supplier.active ? 'desactivado' : 'activada'}.` });
    } catch (error) {
        toast({ title: "Error", description: "No se pudo actualizar el estado.", variant: "destructive" });
    }
  }

  const handleDelete = async (id) => {
    try {
      await deleteSupplier(id);
      toast({ title: "Éxito", description: "Proveedor eliminado correctamente." });
      setDeletingSupplier(null);
    } catch (error) {
      toast({ title: "Error", description: "No se pudo eliminar el proveedor.", variant: "destructive" });
    }
  }
  
  const handleFormFinished = (success) => {
    if (success) {
      // Data will refresh automatically due to onSnapshot
    }
    setIsFormOpen(false);
    setEditingSupplier(null);
  }

  const openFormModal = (supplier = null) => {
    setEditingSupplier(supplier);
    setIsFormOpen(true);
  }

  return (
    <AuthorizedOnly allowedRoles={['ADMIN']}>
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent>
            <SupplierForm supplier={editingSupplier} onFinished={handleFormFinished} />
        </DialogContent>
      </Dialog>
      
      <AlertDialog open={!!deletingSupplier} onOpenChange={(open) => !open && setDeletingSupplier(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará permanentemente el proveedor.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeletingSupplier(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => handleDelete(deletingSupplier?.id)}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Card>
          <CardHeader>
            <div className="flex justify-between items-start gap-4">
              <div>
                <CardTitle>Gestión de Proveedores</CardTitle>
                <CardDescription>Añade, edita o elimina proveedores de tu lista.</CardDescription>
              </div>
              <Button onClick={() => openFormModal()}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Añadir Proveedor
              </Button>
            </div>
            <div className="relative mt-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                    placeholder="Filtrar por nombre, contacto o dirección..."
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
                  <TableHead>Nombre</TableHead>
                  <TableHead>Contacto</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center h-48">
                      <Loader2 className="mx-auto animate-spin text-primary h-10 w-10" />
                    </TableCell>
                  </TableRow>
                ) : filteredSuppliers.length > 0 ? (
                  filteredSuppliers.map((supplier) => (
                    <TableRow key={supplier.id}>
                      <TableCell className="font-medium">{supplier.name}</TableCell>
                      <TableCell>
                        <div className="space-y-1 text-sm text-muted-foreground">
                            {supplier.contactPerson && <p className="flex items-center gap-2"><User className="h-4 w-4" /> {supplier.contactPerson}</p>}
                            {supplier.phone && <p className="flex items-center gap-2"><Phone className="h-4 w-4" /> {supplier.phone}</p>}
                            {supplier.email && <p className="flex items-center gap-2"><Mail className="h-4 w-4" /> {supplier.email}</p>}
                            {supplier.address && <p className="flex items-center gap-2"><MapPin className="h-4 w-4" /> {supplier.address}</p>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Switch
                            id={`active-switch-${supplier.id}`}
                            checked={supplier.active}
                            onCheckedChange={() => handleToggleActive(supplier)}
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
                            <DropdownMenuItem onClick={() => openFormModal(supplier)}>
                                <Edit className="mr-2 h-4 w-4" />
                                <span>Editar</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setDeletingSupplier(supplier); }} className="text-destructive">
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
                    <TableCell colSpan={4} className="text-center text-muted-foreground h-48">
                      {searchTerm ? `No se encontraron proveedores para "${searchTerm}".` : "No hay proveedores. Añade uno para empezar."}
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
              ) : filteredSuppliers.length > 0 ? (
                filteredSuppliers.map((supplier) => (
                  <Card key={supplier.id} className="p-4">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <p className="font-semibold">{supplier.name}</p>
                           <p className="text-sm text-muted-foreground">{supplier.contactPerson}</p>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button aria-haspopup="true" size="icon" variant="ghost" className="-mt-2 -mr-2">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openFormModal(supplier)}>
                                <Edit className="mr-2 h-4 w-4" />
                                <span>Editar</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setDeletingSupplier(supplier); }} className="text-destructive">
                              <Trash2 className="mr-2 h-4 w-4" />
                              <span>Eliminar</span>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      <div className="space-y-2 text-sm text-muted-foreground mb-4">
                          {supplier.phone && <p className="flex items-center gap-2"><Phone className="h-4 w-4" /> {supplier.phone}</p>}
                          {supplier.email && <p className="flex items-center gap-2"><Mail className="h-4 w-4" /> {supplier.email}</p>}
                          {supplier.address && <p className="flex items-center gap-2"><MapPin className="h-4 w-4" /> {supplier.address}</p>}
                      </div>
                      <div className="flex items-center justify-between border-t pt-3">
                          <span className="text-sm text-muted-foreground">{supplier.active ? "Activo" : "Inactivo"}</span>
                          <Switch checked={supplier.active} onCheckedChange={() => handleToggleActive(supplier)} />
                      </div>
                  </Card>
                ))
              ) : (
                <div className="text-center py-16 text-muted-foreground">
                  <p>{searchTerm ? `No se encontraron proveedores para "${searchTerm}".` : "No hay proveedores."}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
    </AuthorizedOnly>
  );
}
