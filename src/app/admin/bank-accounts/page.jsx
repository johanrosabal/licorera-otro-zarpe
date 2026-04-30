
'use client'

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { getBankAccounts, addBankAccount, updateBankAccount, deleteBankAccount } from '@/lib/bank-accounts';
import { getBanks } from '@/lib/banks';
import { PlusCircle, Trash2, Loader2, Edit, MoreVertical, Search, Wallet, CircleDollarSign, Hash, ShieldCheck, Banknote } from 'lucide-react';
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
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { formatCurrency, formatCurrencyInput, parseFormattedCurrency } from '@/lib/utils';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

const accountSchema = z.object({
  bankId: z.string().min(1, 'Debes seleccionar un banco.'),
  accountHolder: z.string().min(3, 'El nombre del titular es requerido.'),
  accountType: z.enum(['AHORROS', 'CORRIENTE'], { required_error: 'Debes seleccionar un tipo de cuenta.' }),
  accountNumber: z.string().min(5, 'El número de cuenta es requerido.'),
  iban: z.string().optional(),
  sinpeMovil: z.string().optional(),
  currency: z.enum(['CRC', 'USD'], { required_error: 'Debes seleccionar una moneda.' }),
  balance: z.coerce.number().optional().default(0),
  limit: z.coerce.number().optional().default(0),
  active: z.boolean().default(true),
});

function AccountForm({ account, banks, onFinished, onCancel }) {
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();
  
  const form = useForm({
    resolver: zodResolver(accountSchema),
    defaultValues: account || {
      bankId: '',
      accountHolder: '',
      accountType: 'AHORROS',
      accountNumber: '',
      iban: '',
      sinpeMovil: '',
      currency: 'CRC',
      balance: 0,
      limit: 0,
      active: true,
    },
  });

  useEffect(() => {
      form.reset(account || {
        bankId: '',
        accountHolder: '',
        accountType: 'AHORROS',
        accountNumber: '',
        iban: '',
        sinpeMovil: '',
        currency: 'CRC',
        balance: 0,
        limit: 0,
        active: true,
    });
  }, [account, form])

  const onSubmit = async (data) => {
    setSubmitting(true);
    try {
      if (account) {
        await updateBankAccount(account.id, data);
        toast({ title: "Éxito", description: "Cuenta actualizada correctamente." });
      } else {
        await addBankAccount(data);
        toast({ title: "Éxito", description: "Cuenta añadida correctamente." });
        form.reset();
      }
      onFinished?.(true);
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "No se pudo guardar la cuenta.", variant: "destructive" });
      onFinished?.(false);
    } finally {
      setSubmitting(false);
    }
  };
  

  return (
    <Card>
        <CardHeader>
            <CardTitle>{account ? 'Editar Cuenta Bancaria' : 'Añadir Nueva Cuenta Bancaria'}</CardTitle>
            <CardDescription>
            {account ? 'Actualiza los detalles de la cuenta.' : 'Introduce los detalles de la nueva cuenta bancaria.'}
            </CardDescription>
        </CardHeader>
        <CardContent>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <FormField control={form.control} name="bankId" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Banco</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl><SelectTrigger><SelectValue placeholder="Selecciona un banco" /></SelectTrigger></FormControl>
                                    <SelectContent>
                                        {banks.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="accountHolder" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Nombre del Titular</FormLabel>
                                <FormControl><Input placeholder="Ej: Juan Mora" {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="accountType" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Tipo de Cuenta</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl><SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger></FormControl>
                                    <SelectContent>
                                        <SelectItem value="AHORROS">Ahorros</SelectItem>
                                        <SelectItem value="CORRIENTE">Corriente</SelectItem>
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )} />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <FormField control={form.control} name="accountNumber" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Número de Cuenta</FormLabel>
                                <FormControl><Input placeholder="Número de cuenta" {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="iban" render={({ field }) => (
                            <FormItem>
                                <FormLabel>IBAN (Opcional)</FormLabel>
                                <FormControl><Input placeholder="CR..." {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="sinpeMovil" render={({ field }) => (
                            <FormItem>
                                <FormLabel>SINPE Móvil (Opcional)</FormLabel>
                                <FormControl>
                                    <Input 
                                        type="tel" 
                                        placeholder="88888888" 
                                        {...field}
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                    </div>

                     <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <FormField control={form.control} name="currency" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Moneda</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl><SelectTrigger><SelectValue placeholder="Moneda" /></SelectTrigger></FormControl>
                                    <SelectContent>
                                        <SelectItem value="CRC">Colones (CRC)</SelectItem>
                                        <SelectItem value="USD">Dólares (USD)</SelectItem>
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="balance" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Saldo</FormLabel>
                                <FormControl>
                                   <Input type="text" value={formatCurrencyInput(field.value)} onChange={e => field.onChange(parseFormattedCurrency(e.target.value))} className="text-right" />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                         <FormField control={form.control} name="limit" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Monto Límite</FormLabel>
                                <FormControl>
                                   <Input type="text" value={formatCurrencyInput(field.value)} onChange={e => field.onChange(parseFormattedCurrency(e.target.value))} className="text-right" />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                    </div>
                    
                    <FormField control={form.control} name="active" render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                            <FormLabel className="text-base">Activa</FormLabel>
                            <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                        </FormItem>
                    )} />

                    <div className="flex justify-end gap-2">
                        <Button type="button" variant="secondary" onClick={onCancel}>Cancelar</Button>
                        <Button type="submit" disabled={submitting}>
                            {submitting ? <Loader2 className="animate-spin mr-2" /> : null}
                            {account ? 'Guardar Cambios' : 'Añadir Cuenta'}
                        </Button>
                    </div>
                </form>
            </Form>
        </CardContent>
    </Card>
  )
}

export default function AdminBankAccountsPage() {
  const [accounts, setAccounts] = useState([]);
  const [banks, setBanks] = useState([]);
  const [bankMap, setBankMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);
  const [deletingAccount, setDeletingAccount] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, 'bankAccounts'), orderBy('accountHolder'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setAccounts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (error) => {
      console.error(error);
      toast({ title: "Error", description: "No se pudieron cargar las cuentas.", variant: "destructive" });
      setLoading(false);
    });

    getBanks().then(fetchedBanks => {
        setBanks(fetchedBanks)
        setBankMap(fetchedBanks.reduce((acc, bank) => {
            acc[bank.id] = bank.name;
            return acc;
        }, {}));
    }).catch(err => {
        toast({ title: "Error", description: "No se pudieron cargar los bancos.", variant: "destructive" });
    })

    return () => unsubscribe();
  }, [toast]);
  
  const filteredAccounts = useMemo(() => {
    const lowercasedFilter = searchTerm.toLowerCase();
    return accounts.filter((account) => {
      return (
        account.accountHolder?.toLowerCase().includes(lowercasedFilter) ||
        account.accountNumber?.toLowerCase().includes(lowercasedFilter) ||
        account.iban?.toLowerCase().includes(lowercasedFilter) ||
        account.sinpeMovil?.toLowerCase().includes(lowercasedFilter) ||
        bankMap[account.bankId]?.toLowerCase().includes(lowercasedFilter)
      );
    });
  }, [accounts, searchTerm, bankMap]);

  const handleToggleActive = async (account) => {
    try {
        await updateBankAccount(account.id, { active: !account.active });
        toast({ title: "Éxito", description: `Cuenta ${account.active ? 'desactivada' : 'activada'}.` });
    } catch (error) {
        toast({ title: "Error", description: "No se pudo actualizar el estado.", variant: "destructive" });
    }
  }

  const handleDelete = async (id) => {
    try {
      await deleteBankAccount(id);
      toast({ title: "Éxito", description: "Cuenta eliminada correctamente." });
      setDeletingAccount(null);
    } catch (error) {
      toast({ title: "Error", description: "No se pudo eliminar la cuenta.", variant: "destructive" });
    }
  }
  
  const handleFormFinished = (success) => {
    if (success) {
      setIsFormOpen(false);
      setEditingAccount(null);
    }
  }
  
  const handleFormCancel = () => {
    setIsFormOpen(false);
    setEditingAccount(null);
  }

  const openForm = (account = null) => {
    setEditingAccount(account);
    setIsFormOpen(true);
  }

  return (
    <AuthorizedOnly allowedRoles={['ADMIN']}>
      <div className="space-y-6">
        <Collapsible open={isFormOpen} onOpenChange={setIsFormOpen}>
            <CollapsibleContent>
                <div className="mb-6">
                    <AccountForm account={editingAccount} banks={banks} onFinished={handleFormFinished} onCancel={handleFormCancel} />
                </div>
            </CollapsibleContent>
        </Collapsible>
      
        <AlertDialog open={!!deletingAccount} onOpenChange={(open) => !open && setDeletingAccount(null)}>
            <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                <AlertDialogDescription>
                Esta acción no se puede deshacer. Se eliminará permanentemente la cuenta bancaria.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setDeletingAccount(null)}>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={() => handleDelete(deletingAccount?.id)}>Eliminar</AlertDialogAction>
            </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>

        <Card>
            <CardHeader>
                <div className="flex justify-between items-start gap-4">
                <div>
                    <CardTitle>Lista de Cuentas Bancarias</CardTitle>
                    <CardDescription>Una lista de todas las cuentas bancarias registradas.</CardDescription>
                </div>
                <Button onClick={() => openForm()} disabled={isFormOpen && !editingAccount}>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Añadir Cuenta
                </Button>
                </div>
                <div className="relative mt-4">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input
                        placeholder="Filtrar por titular, cuenta, banco..."
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
                        <TableHead>Banco</TableHead>
                        <TableHead>Titular</TableHead>
                        <TableHead>Número de Cuenta</TableHead>
                        <TableHead>Saldo</TableHead>
                        <TableHead>Límite</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                        <TableRow>
                            <TableCell colSpan={7} className="text-center h-48">
                            <Loader2 className="mx-auto animate-spin text-primary h-10 w-10" />
                            </TableCell>
                        </TableRow>
                        ) : filteredAccounts.length > 0 ? (
                        filteredAccounts.map((account) => (
                            <TableRow key={account.id}>
                                <TableCell className="font-medium">{bankMap[account.bankId] || 'N/A'}</TableCell>
                                <TableCell>{account.accountHolder}</TableCell>
                                <TableCell>
                                    <div className="text-sm">
                                        <p>{account.accountNumber}</p>
                                        {account.iban && <p className="text-xs text-muted-foreground">IBAN: {account.iban}</p>}
                                        {account.sinpeMovil && <p className="text-xs text-muted-foreground">SINPE: {account.sinpeMovil}</p>}
                                    </div>
                                </TableCell>
                                <TableCell className="text-right">{formatCurrency(account.balance, account.currency === 'CRC')}</TableCell>
                                <TableCell className="text-right">{formatCurrency(account.limit, account.currency === 'CRC')}</TableCell>
                                <TableCell>
                                    <Switch
                                        checked={account.active}
                                        onCheckedChange={() => handleToggleActive(account)}
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
                                        <DropdownMenuItem onClick={() => openForm(account)}>
                                            <Edit className="mr-2 h-4 w-4" />
                                            <span>Editar</span>
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setDeletingAccount(account); }} className="text-destructive">
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
                            <TableCell colSpan={7} className="text-center text-muted-foreground h-48">
                            {searchTerm ? `No se encontraron cuentas para "${searchTerm}".` : "No hay cuentas. Añade una para empezar."}
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
                    ) : filteredAccounts.length > 0 ? (
                        filteredAccounts.map(account => (
                            <Card key={account.id}>
                                <CardHeader>
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <CardTitle className="text-base">{account.accountHolder}</CardTitle>
                                            <CardDescription>{bankMap[account.bankId] || 'N/A'}</CardDescription>
                                        </div>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button aria-haspopup="true" size="icon" variant="ghost">
                                                    <MoreVertical className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem onClick={() => openForm(account)}>
                                                    <Edit className="mr-2 h-4 w-4" /><span>Editar</span>
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setDeletingAccount(account); }} className="text-destructive">
                                                    <Trash2 className="mr-2 h-4 w-4" /><span>Eliminar</span>
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-4 text-sm">
                                    <div className="flex justify-between items-center">
                                        <span className="text-muted-foreground">Cuenta</span>
                                        <span>{account.accountNumber}</span>
                                    </div>
                                    {account.iban && (
                                        <div className="flex justify-between items-center">
                                            <span className="text-muted-foreground">IBAN</span>
                                            <span>{account.iban}</span>
                                        </div>
                                    )}
                                    {account.sinpeMovil && (
                                        <div className="flex justify-between items-center">
                                            <span className="text-muted-foreground">SINPE</span>
                                            <span>{account.sinpeMovil}</span>
                                        </div>
                                    )}
                                     <div className="flex justify-between items-center">
                                        <span className="text-muted-foreground">Saldo</span>
                                        <span className="font-semibold">{formatCurrency(account.balance, account.currency === 'CRC')}</span>
                                    </div>
                                     <div className="flex justify-between items-center">
                                        <span className="text-muted-foreground">Límite</span>
                                        <span>{formatCurrency(account.limit, account.currency === 'CRC')}</span>
                                    </div>
                                </CardContent>
                                <CardFooter>
                                    <div className="flex items-center justify-between w-full">
                                        <span className="text-sm text-muted-foreground">{account.active ? 'Activa' : 'Inactiva'}</span>
                                        <Switch checked={account.active} onCheckedChange={() => handleToggleActive(account)} />
                                    </div>
                                </CardFooter>
                            </Card>
                        ))
                    ) : (
                         <div className="text-center text-muted-foreground h-48 flex flex-col justify-center items-center">
                            <Banknote className="h-10 w-10 mb-4 text-muted-foreground/50"/>
                            <p>{searchTerm ? `No se encontraron cuentas para "${searchTerm}".` : "No hay cuentas. Añade una para empezar."}</p>
                         </div>
                    )}
                </div>
            </CardContent>
        </Card>
      </div>
    </AuthorizedOnly>
  );
}
