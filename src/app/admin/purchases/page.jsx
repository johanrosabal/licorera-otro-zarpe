

'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { getSuppliers } from '@/lib/suppliers';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, PlusCircle, FileText, MoreHorizontal, Edit, Trash2, Search, FilterX, Calendar as CalendarIcon, Eye, Image as ImageIcon } from 'lucide-react';
import { AuthorizedOnly } from '@/components/auth/authorized-only';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatCurrency, cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import { collection, onSnapshot, query, orderBy, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Separator } from '@/components/ui/separator';
import Image from 'next/image';
import Link from 'next/link';
import { PurchaseForm } from '@/components/admin/purchase-form';
import { useAuth } from '@/hooks/use-auth';

function PurchaseDetailModal({ purchase, supplierName, onClose }) {
    if (!purchase) return null;

    return (
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
                <DialogTitle>Detalle de Compra #{purchase.invoiceNumber}</DialogTitle>
                <DialogDescription>
                    Factura a {supplierName} del {purchase.invoiceDate ? format(purchase.invoiceDate.toDate(), "dd MMM yyyy", { locale: es }) : 'N/A'}.
                </DialogDescription>
            </DialogHeader>
            <div className="space-y-6">
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                     <div>
                        <h4 className="font-semibold mb-2">Productos</h4>
                        <div className="space-y-3 rounded-md border p-4 max-h-80 overflow-y-auto">
                            {purchase.items.map((item, index) => (
                                <div key={`${item.productId}-${index}`} className="flex justify-between items-center text-sm">
                                    <div>
                                        <p className="font-medium">{item.name || `ID: ${item.productId}`}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {item.quantity} x {formatCurrency(item.costPrice)} c/u
                                        </p>
                                    </div>
                                    <p className="font-medium">{formatCurrency(item.costPrice * item.quantity)}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                    {purchase.invoiceImageUrl ? (
                        <div>
                            <h4 className="font-semibold mb-2">Imagen de Factura</h4>
                            <Link href={purchase.invoiceImageUrl} target="_blank" className="block relative aspect-video w-full overflow-hidden rounded-md border group">
                                <Image src={purchase.invoiceImageUrl} alt="Comprobante de pago" fill className="object-contain cursor-pointer transition-transform group-hover:scale-105" unoptimized />
                            </Link>
                        </div>
                    ) : (
                         <div>
                            <h4 className="font-semibold mb-2">Imagen de Factura</h4>
                            <div className="flex items-center justify-center h-full border rounded-md bg-muted/50">
                                <p className="text-muted-foreground text-sm">No se adjuntó imagen.</p>
                            </div>
                        </div>
                    )}
                </div>

                <Separator />

                <div className="flex justify-end">
                    <div className="w-full max-w-xs space-y-1">
                        <div className="flex justify-between text-sm">
                            <p className="text-muted-foreground">Subtotal:</p>
                            <p>{formatCurrency(purchase.subtotalAmount)}</p>
                        </div>
                         <div className="flex justify-between text-sm">
                            <p className="text-muted-foreground">Impuestos:</p>
                            <p>{formatCurrency(purchase.taxAmount)}</p>
                        </div>
                        <div className="flex justify-between text-lg font-bold pt-2 border-t">
                            <p>Total:</p>
                            <p>{formatCurrency(purchase.totalAmount)}</p>
                        </div>
                    </div>
                </div>

            </div>
            <DialogFooter>
                <Button variant="outline" onClick={onClose}>Cerrar</Button>
            </DialogFooter>
        </DialogContent>
    );
}

export default function PurchasesListPage() {
  const [purchases, setPurchases] = useState([]);
  const [suppliers, setSuppliers] = useState({});
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingPurchase, setDeletingPurchase] = useState(null);
  const [detailingPurchase, setDetailingPurchase] = useState(null);
  const [editingPurchase, setEditingPurchase] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  // Filter states
  const [users, setUsers] = useState([]);
  const [selectedSupplier, setSelectedSupplier] = useState('all');
  const [invoiceSearchTerm, setInvoiceSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState('all');
  const [dateRange, setDateRange] = useState(undefined);

  useEffect(() => {
    setLoading(true);
    const qPurchases = query(collection(db, 'purchases'), orderBy('createdAt', 'desc'));
    const qProducts = query(collection(db, 'products'));


    const unsubscribePurchases = onSnapshot(qPurchases, (snapshot) => {
        const fetchedPurchases = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const usersMap = new Map();
        fetchedPurchases.forEach(p => {
            if(p.createdBy?.uid && p.createdBy?.email) {
                usersMap.set(p.createdBy.uid, { uid: p.createdBy.uid, email: p.createdBy.email });
            }
        });

        setUsers(Array.from(usersMap.values()).sort((a,b) => a.email.localeCompare(b.email)));
        setPurchases(fetchedPurchases);
        setLoading(false);
    }, (error) => {
        console.error(error);
        toast({ title: 'Error', description: 'No se pudieron cargar las compras.', variant: 'destructive' });
        setLoading(false);
    });

    const unsubscribeProducts = onSnapshot(qProducts, (snapshot) => {
        setProducts(snapshot.docs.map(doc => ({ id: doc.id, name: doc.data().name })));
    });

    // Fetch suppliers once, as they are less likely to change frequently
    getSuppliers().then(fetchedSuppliers => {
        const supplierMap = fetchedSuppliers.reduce((acc, supplier) => {
          acc[supplier.id] = { id: supplier.id, name: supplier.name };
          return acc;
        }, {});
        setSuppliers(supplierMap);
    }).catch(error => {
        toast({ title: 'Error', description: 'No se pudieron cargar los proveedores.', variant: 'destructive' });
    })


    return () => {
      unsubscribePurchases();
      unsubscribeProducts();
    }
  }, [toast]);
  
  const productMap = useMemo(() => new Map(products.map(p => [p.id, p.name])), [products]);

  const purchasesWithProductNames = useMemo(() => {
      return purchases.map(purchase => ({
          ...purchase,
          items: purchase.items.map(item => ({
              ...item,
              name: item.name || productMap.get(item.productId) || 'Producto no encontrado'
          }))
      }));
  }, [purchases, productMap]);

  const filteredPurchases = useMemo(() => {
    return purchasesWithProductNames.filter(p => {
        const supplierMatch = selectedSupplier === 'all' || p.supplierId === selectedSupplier;
        const invoiceMatch = p.invoiceNumber.toLowerCase().includes(invoiceSearchTerm.toLowerCase());
        const userMatch = selectedUser === 'all' || p.createdBy?.uid === selectedUser;
        
        let dateMatch = true;
        if (dateRange?.from) {
            const purchaseDate = p.invoiceDate.toDate();
            const fromDate = new Date(dateRange.from.setHours(0, 0, 0, 0));
            const toDate = dateRange.to ? new Date(dateRange.to.setHours(23, 59, 59, 999)) : fromDate;
            
            dateMatch = purchaseDate >= fromDate && purchaseDate <= (dateRange.to ? toDate : new Date(fromDate.getTime() + 24*60*60*1000 -1));
        }
        
        return supplierMatch && invoiceMatch && userMatch && dateMatch;
    })
  }, [purchasesWithProductNames, selectedSupplier, invoiceSearchTerm, selectedUser, dateRange]);


  const totalPurchasesAmount = useMemo(() => {
    return filteredPurchases.reduce((total, purchase) => total + purchase.totalAmount, 0);
  }, [filteredPurchases]);
  
  const resetFilters = () => {
    setSelectedSupplier('all');
    setInvoiceSearchTerm('');
    setSelectedUser('all');
    setDateRange(undefined);
  }

  const handleDelete = (id) => {
      // Implement delete purchase logic here if needed
      console.log("Delete purchase", id);
      setDeletingPurchase(null);
      toast({title: "Función no implementada", description: "La eliminación de facturas aún no está disponible."})
  }

  const handleEdit = (purchase) => {
    setEditingPurchase(purchase);
    setIsFormOpen(true);
  }

  const handleFormFinished = () => {
    setIsFormOpen(false);
    setEditingPurchase(null);
  }

  return (
    <AuthorizedOnly allowedRoles={['ADMIN']}>
      <Dialog open={!!detailingPurchase} onOpenChange={(open) => !open && setDetailingPurchase(null)}>
        <PurchaseDetailModal 
            purchase={detailingPurchase}
            supplierName={detailingPurchase ? suppliers[detailingPurchase.supplierId]?.name : ''}
            onClose={() => setDetailingPurchase(null)}
        />
      </Dialog>
      
      <Dialog open={isFormOpen} onOpenChange={(open) => { if(!open) handleFormFinished() }}>
        <DialogContent className="sm:max-w-[80vw] max-h-[90vh] overflow-y-auto">
             <DialogHeader>
                <DialogTitle>Editar Factura de Compra</DialogTitle>
                <DialogDescription>
                    Actualiza los detalles de la factura de compra.
                </DialogDescription>
            </DialogHeader>
            {editingPurchase ? (
                <PurchaseForm initialPurchaseData={editingPurchase} onFinished={handleFormFinished} />
            ) : null}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingPurchase} onOpenChange={(open) => !open && setDeletingPurchase(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará la factura y se revertirán los movimientos de inventario asociados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeletingPurchase(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => handleDelete(deletingPurchase.id)}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
            <div>
              <CardTitle>Historial de Compras</CardTitle>
              <CardDescription>
                Registro de todas las facturas de compra ingresadas al sistema.
              </CardDescription>
              <div className="mt-4">
                  <p className="text-sm text-muted-foreground">Total de Compras (Filtrado)</p>
                  <p className="text-2xl font-bold text-primary">{formatCurrency(totalPurchasesAmount)}</p>
              </div>
            </div>
            <Button onClick={() => router.push('/admin/purchases/new')}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Registrar Nueva Compra
            </Button>
          </div>
          <div className="mt-6 border-t pt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                  <Select value={selectedSupplier} onValueChange={setSelectedSupplier}>
                      <SelectTrigger><SelectValue placeholder="Filtrar por proveedor..." /></SelectTrigger>
                      <SelectContent>
                          <SelectItem value="all">Todos los proveedores</SelectItem>
                          {Object.values(suppliers).sort((a,b) => a.name.localeCompare(b.name)).map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                      </SelectContent>
                  </Select>
                   <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                        <Input
                            placeholder="Buscar por N° Factura..."
                            className="pl-10 w-full"
                            value={invoiceSearchTerm}
                            onChange={(e) => setInvoiceSearchTerm(e.target.value)}
                        />
                    </div>
                  <Select value={selectedUser} onValueChange={setSelectedUser}>
                      <SelectTrigger><SelectValue placeholder="Filtrar por usuario..." /></SelectTrigger>
                      <SelectContent>
                          <SelectItem value="all">Todos los usuarios</SelectItem>
                          {users.map(u => <SelectItem key={u.uid} value={u.uid}>{u.email}</SelectItem>)}
                      </SelectContent>
                  </Select>
                  <Popover>
                      <PopoverTrigger asChild>
                          <Button
                              id="date"
                              variant={"outline"}
                              className={cn("justify-start text-left font-normal", !dateRange && "text-muted-foreground")}
                          >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {dateRange?.from ? (
                                  dateRange.to ? (
                                      <>
                                          {format(dateRange.from, "LLL dd, y")} -{" "}
                                          {format(dateRange.to, "LLL dd, y")}
                                      </>
                                  ) : (
                                      format(dateRange.from, "LLL dd, y")
                                  )
                              ) : (
                                  <span>Filtrar por fecha</span>
                              )}
                          </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                              initialFocus
                              mode="range"
                              defaultMonth={dateRange?.from}
                              selected={dateRange}
                              onSelect={setDateRange}
                              numberOfMonths={2}
                          />
                      </PopoverContent>
                  </Popover>
                  <Button variant="ghost" onClick={resetFilters}>
                      <FilterX className="mr-2 h-4 w-4" />
                      Limpiar Filtros
                  </Button>
              </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Desktop Table View */}
          <Table className="hidden md:table">
            <TableHeader>
              <TableRow>
                <TableHead>Proveedor</TableHead>
                <TableHead>N° Factura</TableHead>
                <TableHead>Fecha Factura</TableHead>
                <TableHead>Registrado por</TableHead>
                <TableHead className="text-right">Monto Total</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center h-48">
                    <Loader2 className="mx-auto animate-spin text-primary h-10 w-10" />
                    <p className="mt-2 text-muted-foreground">Cargando historial...</p>
                  </TableCell>
                </TableRow>
              ) : filteredPurchases.length > 0 ? (
                filteredPurchases.map((purchase) => {
                  return (
                    <TableRow key={purchase.id}>
                      <TableCell className="font-medium">{suppliers[purchase.supplierId]?.name || 'Proveedor no encontrado'}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{purchase.invoiceNumber}</Badge>
                      </TableCell>
                       <TableCell>
                        {purchase.invoiceDate ? format(purchase.invoiceDate.toDate(), "dd MMM yyyy", { locale: es }) : 'N/A'}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        <p>{purchase.createdBy?.email || 'N/A'}</p>
                        {purchase.createdAt && (
                          <p>{format(purchase.createdAt.toDate(), "dd MMM yyyy, HH:mm", { locale: es })}</p>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-semibold">{formatCurrency(purchase.totalAmount)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon">
                                        <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent>
                                    <DropdownMenuItem onClick={() => setDetailingPurchase(purchase)}>
                                        <Eye className="mr-2 h-4 w-4" />
                                        Ver Detalles
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleEdit(purchase)}>
                                        <Edit className="mr-2 h-4 w-4" />
                                        Editar
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setDeletingPurchase(purchase); }} className="text-destructive">
                                        <Trash2 className="mr-2 h-4 w-4" />
                                        Eliminar
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground h-48">
                    <FileText className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
                    <p className="font-semibold">No se encontraron facturas.</p>
                    <p>Intenta ajustar o limpiar los filtros.</p>
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
            ) : filteredPurchases.length > 0 ? (
                filteredPurchases.map((purchase) => (
                    <Card key={purchase.id}>
                        <CardHeader className="p-4">
                            <div className="flex justify-between items-start">
                                <div>
                                    <CardTitle className="text-base">{suppliers[purchase.supplierId]?.name || 'N/A'}</CardTitle>
                                    <CardDescription>Factura #{purchase.invoiceNumber}</CardDescription>
                                </div>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="-mt-2 -mr-2">
                                            <MoreHorizontal className="h-4 w-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent>
                                        <DropdownMenuItem onClick={() => setDetailingPurchase(purchase)}>
                                            <Eye className="mr-2 h-4 w-4" />
                                            Ver Detalles
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleEdit(purchase)}>
                                            <Edit className="mr-2 h-4 w-4" />
                                            Editar
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setDeletingPurchase(purchase); }} className="text-destructive">
                                            <Trash2 className="mr-2 h-4 w-4" />
                                            Eliminar
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        </CardHeader>
                        <CardContent className="text-sm space-y-3 p-4 pt-0">
                            <div className="flex justify-between items-center">
                                <span className="text-muted-foreground">Monto Total</span>
                                <span className="font-semibold text-lg">{formatCurrency(purchase.totalAmount)}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-muted-foreground">Fecha</span>
                                <span>{purchase.invoiceDate ? format(purchase.invoiceDate.toDate(), "dd MMM yyyy", { locale: es }) : 'N/A'}</span>
                            </div>
                        </CardContent>
                        <CardFooter className="p-4 pt-0 text-xs text-muted-foreground">
                            Registrado por: {purchase.createdBy?.email || 'N/A'}
                        </CardFooter>
                    </Card>
                ))
            ) : (
                 <div className="text-center text-muted-foreground h-48 flex flex-col justify-center items-center">
                    <FileText className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
                    <p className="font-semibold">No se encontraron facturas.</p>
                    <p>Intenta ajustar o limpiar los filtros.</p>
                </div>
            )}
          </div>
        </CardContent>
      </Card>
    </AuthorizedOnly>
  );
}
