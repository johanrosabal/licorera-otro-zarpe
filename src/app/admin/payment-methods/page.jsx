
'use client'

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { getPaymentMethods, addPaymentMethod, updatePaymentMethod, deletePaymentMethod, getPaymentMethodsWithAccounts } from '@/lib/payment-methods';
import { getBankAccounts } from '@/lib/bank-accounts';
import { PlusCircle, Trash2, Loader2, Edit, MoreVertical, CheckCircle2, XCircle, CreditCard, Link2, Link2Off } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { AuthorizedOnly } from '@/components/auth/authorized-only';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from '@/components/ui/badge';

const paymentMethodSchema = z.object({
  name: z.string().min(3, 'El nombre debe tener al menos 3 caracteres.'),
  type: z.enum(['Manual', 'Automatico'], { required_error: 'Debes seleccionar un tipo.' }),
  order: z.coerce.number().int().min(1, 'El orden debe ser al menos 1.'),
  instructions: z.string().optional(),
  bankAccountId: z.string().optional().nullable(),
  active: z.boolean().default(true),
});

function PaymentMethodForm({ method, bankAccounts, onFinished }) {
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();
  
  const form = useForm({
    resolver: zodResolver(paymentMethodSchema),
    defaultValues: method || {
      name: '',
      type: 'Manual',
      order: 1,
      instructions: '',
      bankAccountId: null,
      active: true,
    },
  });

  useEffect(() => {
    if(method) {
        form.reset(method)
    }
  }, [method, form])

  const onSubmit = async (data) => {
    setSubmitting(true);
    try {
      const dataToSave = {
          ...data,
          bankAccountId: data.bankAccountId === '_none_' ? null : data.bankAccountId,
      }
      if (method) {
        await updatePaymentMethod(method.id, dataToSave);
        toast({ title: "Éxito", description: "Método de pago actualizado." });
      } else {
        await addPaymentMethod(dataToSave);
        toast({ title: "Éxito", description: "Método de pago añadido." });
      }
      onFinished?.(true);
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "No se pudo guardar el método de pago.", variant: "destructive" });
      onFinished?.(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <DialogHeader>
          <DialogTitle>{method ? 'Editar Método de Pago' : 'Añadir Nuevo Método de Pago'}</DialogTitle>
        </DialogHeader>
        
        <FormField control={form.control} name="name" render={({ field }) => (
            <FormItem>
                <FormLabel>Nombre del Método</FormLabel>
                <FormControl><Input placeholder="Ej: Transferencia Bancaria" {...field} /></FormControl>
                <FormMessage />
            </FormItem>
        )} />

        <div className="grid grid-cols-2 gap-4">
          <FormField control={form.control} name="type" render={({ field }) => (
              <FormItem>
                  <FormLabel>Tipo</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger></FormControl>
                      <SelectContent>
                          <SelectItem value="Manual">Manual</SelectItem>
                          <SelectItem value="Automatico">Automático</SelectItem>
                      </SelectContent>
                  </Select>
                  <FormMessage />
              </FormItem>
          )} />
          <FormField control={form.control} name="order" render={({ field }) => (
              <FormItem>
                  <FormLabel>Orden de Visualización</FormLabel>
                  <FormControl><Input type="number" placeholder="1" {...field} /></FormControl>
                  <FormMessage />
              </FormItem>
          )} />
        </div>
        
        <FormField control={form.control} name="bankAccountId" render={({ field }) => (
          <FormItem>
            <FormLabel>Cuenta Bancaria Asociada (Opcional)</FormLabel>
             <Select onValueChange={field.onChange} value={field.value || '_none_'}>
                <FormControl><SelectTrigger><SelectValue placeholder="Selecciona una cuenta" /></SelectTrigger></FormControl>
                <SelectContent>
                  <SelectItem value="_none_">Ninguna</SelectItem>
                  {bankAccounts.map(ba => (
                    <SelectItem key={ba.id} value={ba.id}>
                      {ba.accountHolder} - {ba.accountNumber} ({ba.currency})
                    </SelectItem>
                  ))}
                </SelectContent>
            </Select>
             <FormMessage />
          </FormItem>
        )} />


        <FormField control={form.control} name="instructions" render={({ field }) => (
            <FormItem>
                <FormLabel>Instrucciones Adicionales</FormLabel>
                <FormControl><Textarea placeholder="Instrucciones adicionales para el cliente. Si se asocia una cuenta, sus detalles se mostrarán automáticamente." {...field} /></FormControl>
                <FormMessage />
            </FormItem>
        )} />
        
        <FormField control={form.control} name="active" render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                <FormLabel className="text-base mb-0">Activo</FormLabel>
                <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
            </FormItem>
        )} />

        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => onFinished?.(false)}>Cancelar</Button>
          <Button type="submit" disabled={submitting}>
            {submitting && <Loader2 className="animate-spin mr-2" />}
            {method ? 'Guardar Cambios' : 'Añadir Método'}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  )
}

export default function AdminPaymentMethodsPage() {
  const [methods, setMethods] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingMethod, setEditingMethod] = useState(null);
  const [deletingMethod, setDeletingMethod] = useState(null);
  const { toast } = useToast();

  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, 'paymentMethods'), orderBy('order')), (snapshot) => {
        getPaymentMethodsWithAccounts().then(fetchedMethods => {
            setMethods(fetchedMethods);
            setLoading(false);
        }).catch(error => {
             console.error("Error fetching payment methods:", error);
             toast({ title: "Error", description: "No se pudieron cargar los métodos de pago.", variant: "destructive" });
             setLoading(false);
        });
    });

    getBankAccounts({ activeOnly: true }).then(accounts => {
        setBankAccounts(accounts);
    }).catch(err => {
        toast({ title: "Error", description: "No se pudieron cargar las cuentas bancarias.", variant: "destructive" });
    });

    return () => unsub();
  }, [toast]);

  const handleToggleActive = async (method) => {
    try {
      await updatePaymentMethod(method.id, { active: !method.active });
      toast({ title: "Éxito", description: `Método ${method.active ? 'desactivado' : 'activado'}.` });
    } catch (error) {
      toast({ title: "Error", description: "No se pudo actualizar el estado.", variant: "destructive" });
    }
  }

  const handleDelete = async (id) => {
    try {
      await deletePaymentMethod(id);
      toast({ title: "Éxito", description: "Método de pago eliminado correctamente." });
    } catch (error) {
      toast({ title: "Error", description: "No se pudo eliminar el método de pago.", variant: "destructive" });
    } finally {
      setDeletingMethod(null);
    }
  }
  
  const handleFormFinished = (success) => {
    setIsFormOpen(false);
    setEditingMethod(null);
  }

  const openFormModal = (method = null) => {
    setEditingMethod(method);
    setIsFormOpen(true);
  }

  return (
    <AuthorizedOnly allowedRoles={['ADMIN']}>
      <Dialog open={isFormOpen} onOpenChange={(isOpen) => {
        if(!isOpen) handleFormFinished(false)
        else setIsFormOpen(isOpen)
      }}>
        <DialogContent>
            <PaymentMethodForm method={editingMethod} bankAccounts={bankAccounts} onFinished={handleFormFinished} />
        </DialogContent>
      </Dialog>
      
      <AlertDialog open={!!deletingMethod} onOpenChange={(open) => !open && setDeletingMethod(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription>Esta acción no se puede deshacer. Se eliminará permanentemente el método de pago.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeletingMethod(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => handleDelete(deletingMethod.id)}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-start gap-4">
            <div>
              <CardTitle>Métodos de Pago</CardTitle>
              <CardDescription>Gestiona los métodos de pago disponibles para tu tienda.</CardDescription>
            </div>
            <Button onClick={() => openFormModal()}>
              <PlusCircle className="mr-2 h-4 w-4" />
              Añadir Método
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Desktop Table View */}
          <Table className="hidden md:table">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[80px]">Orden</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Cuenta Vinculada</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center h-48">
                    <Loader2 className="mx-auto animate-spin text-primary h-10 w-10" />
                  </TableCell>
                </TableRow>
              ) : methods.length > 0 ? (
                methods.map((method) => {
                  const linkedAccount = method.bankAccount;
                  return (
                    <TableRow key={method.id}>
                      <TableCell className="font-medium text-center">{method.order}</TableCell>
                      <TableCell>
                          <p className="font-medium">{method.name}</p>
                          <p className="text-xs text-muted-foreground">{method.type}</p>
                      </TableCell>
                      <TableCell>
                        {linkedAccount ? (
                           <div className="flex items-start gap-2 text-xs">
                                <Link2 className="h-4 w-4 mt-0.5 text-green-500 shrink-0"/>
                                <div className="text-muted-foreground">
                                    <p className="font-semibold text-foreground">{linkedAccount.accountHolder}</p>
                                    <p>{linkedAccount.bankName}</p>
                                    <p>{linkedAccount.accountNumber} ({linkedAccount.currency})</p>
                                </div>
                           </div>
                        ) : (
                           <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Link2Off className="h-4 w-4" />
                                <span>No vinculada</span>
                           </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={method.active}
                          onCheckedChange={() => handleToggleActive(method)}
                          aria-label={method.active ? 'Activo' : 'Inactivo'}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button aria-haspopup="true" size="icon" variant="ghost">
                              <MoreVertical className="h-4 w-4" />
                              <span className="sr-only">Menú</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openFormModal(method)}>
                              <Edit className="mr-2 h-4 w-4" />
                              <span>Editar</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => setDeletingMethod(method)} className="text-destructive">
                              <Trash2 className="mr-2 h-4 w-4" />
                              <span>Eliminar</span>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  )
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground h-48">
                    <CreditCard className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
                    No hay métodos de pago definidos.
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
            ) : methods.length > 0 ? (
                methods.map((method) => {
                    const linkedAccount = method.bankAccount;
                    return (
                        <Card key={method.id} className="p-4">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <div className="font-semibold flex items-center gap-1">{method.name} <Badge variant="secondary" className="ml-2">{method.type}</Badge></div>
                                    <p className="text-sm text-muted-foreground">Orden: {method.order}</p>
                                </div>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button aria-haspopup="true" size="icon" variant="ghost" className="-mt-2 -mr-2">
                                            <MoreVertical className="h-4 w-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuItem onClick={() => openFormModal(method)}>
                                            <Edit className="mr-2 h-4 w-4" />
                                            Editar
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onSelect={() => setDeletingMethod(method)} className="text-destructive">
                                            <Trash2 className="mr-2 h-4 w-4" />
                                            Eliminar
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>

                            {linkedAccount && (
                                <div className="text-sm space-y-1 mb-4 p-3 border rounded-md">
                                    <p className="font-medium text-muted-foreground">Cuenta Vinculada</p>
                                    <p>{linkedAccount.accountHolder}</p>
                                    <p>{linkedAccount.bankName}</p>
                                    <p>{linkedAccount.accountNumber} ({linkedAccount.currency})</p>
                                </div>
                            )}

                            <div className="flex items-center justify-between border-t pt-3">
                                <span className="text-sm text-muted-foreground">{method.active ? "Activo" : "Inactivo"}</span>
                                <Switch checked={method.active} onCheckedChange={() => handleToggleActive(method)} />
                            </div>
                        </Card>
                    )
                })
            ) : (
                <div className="text-center text-muted-foreground h-48 flex flex-col justify-center items-center">
                    <CreditCard className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
                    <p>No hay métodos de pago.</p>
                </div>
            )}
          </div>
        </CardContent>
      </Card>
    </AuthorizedOnly>
  );
}
