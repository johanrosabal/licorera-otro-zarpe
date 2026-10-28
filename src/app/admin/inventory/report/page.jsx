

'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useToast } from '@/hooks/use-toast';
import { addInventoryMovement } from '@/lib/inventory-service';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Package, Eye, PlusCircle, PackagePlus, PackageMinus, PackageSearch, FilterX, Calendar as CalendarIcon, FileText, ArrowUpDown, ArrowUp, ArrowDown, DollarSign, Box, CheckCircle, XCircle, Star, Edit } from 'lucide-react';
import { AuthorizedOnly } from '@/components/auth/authorized-only';
import { updateProduct } from '@/lib/products-service';
import { Separator } from '@/components/ui/separator';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/hooks/use-auth';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn, formatCurrency } from '@/lib/utils';
import Image from 'next/image';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Skeleton } from '@/components/ui/skeleton';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getHomepageSettings } from '@/lib/settings';


const movementSchema = z.object({
  productId: z.string().min(1, 'Debes seleccionar un producto.'),
  type: z.enum(['ENTRADA', 'SALIDA', 'AJUSTE'], { required_error: 'Debes seleccionar un tipo de movimiento.' }),
  quantity: z.coerce.number().int().min(1, 'La cantidad debe ser al menos 1.'),
  reason: z.string().min(3, 'La razón debe tener al menos 3 caracteres.').max(100, 'La razón no puede exceder los 100 caracteres.'),
});

function MovementForm({ products, onFinished, submitting, user }) {
  const { toast } = useToast();
  const form = useForm({
    resolver: zodResolver(movementSchema),
    defaultValues: {
      productId: '',
      type: 'ENTRADA',
      quantity: '',
      reason: '',
    },
  });

  const onSubmit = async (data) => {
    if (!user) {
        toast({
            title: 'Error de Autenticación',
            description: 'No se pudo identificar al usuario. Por favor, inicia sesión de nuevo.',
            variant: 'destructive',
        });
        return;
    }
    try {
      await addInventoryMovement({ ...data, user: { uid: user.uid, email: user.email }});
      toast({
        title: 'Éxito',
        description: 'Movimiento de inventario registrado correctamente.',
      });
      form.reset();
      onFinished?.(true); 
    } catch (error) {
      console.error(error);
      toast({
        title: 'Error al registrar movimiento',
        description: error.message || 'No se pudo completar la operación.',
        variant: 'destructive',
      });
      onFinished?.(false);
    }
  };

  const getIconForType = (type) => {
    switch (type) {
        case 'ENTRADA': return <PackagePlus className="mr-2 h-4 w-4" />;
        case 'SALIDA': return <PackageMinus className="mr-2 h-4 w-4" />;
        case 'AJUSTE': return <PackageSearch className="mr-2 h-4 w-4" />;
        default: return <PackagePlus className="mr-2 h-4 w-4" />;
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="productId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Producto</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder={'Selecciona un producto'} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {products.map((product) => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.name} (Stock actual: {product.stock})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tipo de Movimiento</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona un tipo" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="ENTRADA">Entrada (Añadir a stock)</SelectItem>
                  <SelectItem value="SALIDA">Salida (Restar de stock)</SelectItem>
                  <SelectItem value="AJUSTE">Ajuste (Corregir stock)</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="quantity"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Cantidad</FormLabel>
              <FormControl>
                <Input type="number" placeholder="Ej: 12" {...field} onChange={e => field.onChange(e.target.valueAsNumber)} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="reason"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Razón del Movimiento</FormLabel>
              <FormControl>
                <Textarea placeholder="Ej: Recepción de pedido #123, Venta directa, etc." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onFinished?.(false)}>Cancelar</Button>
            <Button type="submit" disabled={submitting}>
                {submitting ? (
                <Loader2 className="animate-spin mr-2" />
                ) : (
                getIconForType(form.watch('type'))
                )}
                {submitting ? 'Procesando...' : 'Registrar Movimiento'}
            </Button>
        </DialogFooter>
      </form>
    </Form>
  )
}

function ProductMovementsDetail({ movements, product }) {
  const getMovementTypeStyle = (type) => {
    switch (type) {
        case 'ENTRADA':
            return <Badge variant="default" className="bg-green-500/20 text-green-700 hover:bg-green-500/30">Entrada</Badge>;
        case 'SALIDA':
            return <Badge variant="destructive">Salida</Badge>;
        case 'AJUSTE':
            return <Badge variant="secondary">Ajuste</Badge>;
        default:
            return <Badge>{type}</Badge>;
    }
  }

  const renderNoMovements = () => (
    <div className="text-center h-24 flex flex-col justify-center items-center text-muted-foreground">
        <PackageSearch className="h-10 w-10 mb-2" />
        <p>No hay movimientos registrados para este producto.</p>
    </div>
  )

  const sortedMovements = (movements || []).sort((a, b) => b.createdAt.toDate() - a.createdAt.toDate());

  return (
    <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
            <DialogTitle>Detalle de Movimientos: {product?.name}</DialogTitle>
            <DialogDescription>
                Historial completo de entradas, salidas y ajustes para este producto.
            </DialogDescription>
        </DialogHeader>
        <div className="p-1 sm:p-4 bg-muted/50 rounded-md">
            {/* Desktop Table View */}
            <Table className="hidden md:table">
                <TableHeader>
                    <TableRow>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead className="text-center">Cantidad</TableHead>
                        <TableHead>Factura / Razón</TableHead>
                        <TableHead>Usuario</TableHead>
                        <TableHead className="text-right">Stock Ant.</TableHead>
                        <TableHead className="text-right">Stock Res.</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {sortedMovements.length > 0 ? sortedMovements.map(m => (
                        <TableRow key={m.id}>
                            <TableCell className="text-xs">
                            {m.createdAt ? format(m.createdAt.toDate(), "dd MMM yyyy, HH:mm", { locale: es }) : 'N/A'}
                            </TableCell>
                            <TableCell>{getMovementTypeStyle(m.type)}</TableCell>
                            <TableCell className={`text-center font-bold ${m.quantity > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                                {m.invoiceNumber ? (
                                    <div className="flex items-center gap-2">
                                        <FileText className="h-3 w-3" />
                                        <span>Fact: {m.invoiceNumber}</span>
                                    </div>
                                ) : m.reason}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">{m.userEmail}</TableCell>
                            <TableCell className="text-right text-xs">{m.previousStock}</TableCell>
                            <TableCell className="text-right text-xs font-semibold">{m.newStock}</TableCell>
                        </TableRow>
                    )) : (
                       <TableRow>
                           <TableCell colSpan={7} className="h-24">
                               {renderNoMovements()}
                           </TableCell>
                       </TableRow>
                    )}
                </TableBody>
            </Table>
             {/* Mobile Card View */}
             <div className="space-y-4 md:hidden">
                {sortedMovements.length > 0 ? sortedMovements.map(m => (
                     <Card key={m.id}>
                        <CardHeader className="p-4">
                            <div className="flex justify-between items-center">
                                {getMovementTypeStyle(m.type)}
                                <p className="text-xs text-muted-foreground">
                                    {m.createdAt ? format(m.createdAt.toDate(), "dd MMM yyyy, HH:mm", { locale: es }) : 'N/A'}
                                </p>
                            </div>
                        </CardHeader>
                        <CardContent className="p-4 space-y-3">
                             <div className="flex justify-between items-baseline">
                                <p className="text-sm text-muted-foreground">Cantidad:</p>
                                <p className={`font-bold text-lg ${m.quantity > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                                </p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-sm text-muted-foreground">Razón:</p>
                                 <p className="text-sm font-medium">
                                    {m.invoiceNumber ? (
                                        <span className="flex items-center gap-2">
                                            <FileText className="h-4 w-4" />
                                            <span>Factura: {m.invoiceNumber}</span>
                                        </span>
                                    ) : m.reason}
                                </p>
                            </div>
                             <div className="flex justify-between items-center text-xs text-muted-foreground pt-2 border-t">
                               <span>Stock: {m.previousStock} ➔ {m.newStock}</span>
                               <span>Por: {m.userEmail}</span>
                            </div>
                        </CardContent>
                    </Card>
                )) : renderNoMovements()}
            </div>
        </div>
         <DialogFooter>
             <Button variant="outline" onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))}>Cerrar</Button>
        </DialogFooter>
    </DialogContent>
  )
}

function DetailItem({ icon: Icon, label, value, valueClassName }) {
    if (value === null || value === undefined) return null;
    return (
        <div className="flex items-start gap-2">
            <Icon className="h-4 w-4 mt-1 text-muted-foreground shrink-0" />
            <div>
                <p className="text-sm text-muted-foreground">{label}</p>
                <p className={cn("font-medium", valueClassName)}>{value}</p>
            </div>
        </div>
    );
}

function DetailBoolean({ label, value }) {
    return (
        <div className="flex items-center gap-2">
            {value ? <CheckCircle className="h-4 w-4 text-green-500 shrink-0" /> : <XCircle className="h-4 w-4 text-muted-foreground shrink-0" />}
            <span className={value ? 'font-semibold' : 'text-muted-foreground'}>{label}</span>
        </div>
    );
}

function AdminProductDetailModal({ product, onClose }) {
    if (!product) return null;

    const formatDate = (timestamp) => {
        if (!timestamp) return 'N/A';
        const dateObj = timestamp.toDate ? timestamp.toDate() : (timestamp.seconds ? new Date(timestamp.seconds * 1000) : new Date(timestamp));
        return isNaN(dateObj.getTime()) ? 'N/A' : format(dateObj, "dd MMM yyyy, HH:mm", { locale: es });
    };

    return (
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
                <DialogTitle>{product.name}</DialogTitle>
                <DialogDescription>{product.category || 'Sin categoría'} / {product.brand || 'Sin marca'}</DialogDescription>
            </DialogHeader>
            <div className="grid md:grid-cols-2 gap-8 py-4">
                <div className="flex flex-col gap-4">
                    <div className="relative aspect-square w-full max-w-sm mx-auto overflow-hidden rounded-lg border">
                        <Image src={product.image || "https://picsum.photos/400/500"} alt={product.name} fill className="object-cover" unoptimized/>
                    </div>
                    <p className="text-muted-foreground text-sm">{product.description || 'Sin descripción'}</p>
                </div>
                <div className="space-y-6">
                    <div>
                        <h3 className="text-lg font-semibold mb-2">Precios y Stock</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <DetailItem icon={DollarSign} label="Precio de Costo" value={formatCurrency(product.costPrice)} />
                            <DetailItem icon={DollarSign} label="Precio de Venta" value={formatCurrency(product.sellingPrice)} />
                            <DetailItem icon={Package} label="Stock Actual" value={product.stock} />
                            <DetailItem icon={Box} label="Unidad de Medida" value={product.unitOfMeasure || 'Unidad'} />
                        </div>
                    </div>
                    <Separator />
                    <div>
                        <h3 className="text-lg font-semibold mb-2">Propiedades</h3>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                           <DetailBoolean label="Activo" value={product.active !== false} />
                           <DetailBoolean label="Destacado" value={product.featured} />
                           <DetailBoolean label="Uso Interno" value={product.internalOnly} />
                           <DetailBoolean label="En Promoción" value={product.hasPromotion} />
                           {product.hasPromotion && <DetailItem icon={DollarSign} label="Descuento" value={`${product.promotionPercentage}%`} />}
                           <DetailBoolean label="Es un Combo" value={product.isBundle} />
                           <DetailBoolean label="Tiene Alcohol" value={product.hasAlcohol} />
                           {product.hasAlcohol && <DetailItem icon={Package} label="Grado Alc." value={`${product.alcoholGrade}%`} />}
                        </div>
                    </div>
                    <Separator />
                    <div>
                        <h3 className="text-lg font-semibold mb-2">Información Adicional</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <DetailItem icon={CalendarIcon} label="Creado" value={formatDate(product.createdAt)} />
                            <DetailItem icon={Edit} label="Última Modificación" value={formatDate(product.updatedAt)} />
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

function ReportSkeleton() {
    const SkeletonRow = () => (
        <TableRow>
            <TableCell><Skeleton className="h-10 w-10 rounded-md" /></TableCell>
            <TableCell><Skeleton className="h-5 w-40" /></TableCell>
            <TableCell><Skeleton className="h-4 w-24" /></TableCell>
            <TableCell><Skeleton className="h-6 w-16" /></TableCell>
            <TableCell className="text-right"><Skeleton className="h-6 w-10 ml-auto" /></TableCell>
            <TableCell className="text-right"><Skeleton className="h-5 w-20 ml-auto" /></TableCell>
            <TableCell className="text-right"><Skeleton className="h-5 w-24 ml-auto" /></TableCell>
            <TableCell><Skeleton className="h-4 w-32" /></TableCell>
            <TableCell className="text-right"><Skeleton className="h-8 w-8 ml-auto rounded-md" /></TableCell>
        </TableRow>
    );

    const SkeletonCard = () => (
        <Card>
            <CardHeader className="flex flex-row items-start gap-4 p-4">
                <Skeleton className="h-16 w-16 rounded-md" />
                <div className="flex-1 space-y-2">
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                </div>
            </CardHeader>
            <CardContent className="p-4 pt-0 grid grid-cols-2 gap-4">
                <div className="space-y-1"><Skeleton className="h-4 w-16" /><Skeleton className="h-6 w-8" /></div>
                <div className="space-y-1 text-right"><Skeleton className="h-4 w-20 ml-auto" /><Skeleton className="h-5 w-24 ml-auto" /></div>
            </CardContent>
            <CardFooter className="p-4 pt-0">
                <Skeleton className="h-9 w-full" />
            </CardFooter>
        </Card>
    );
    
    return (
        <>
            <div className="hidden md:block">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[80px]">Imagen</TableHead>
                            <TableHead>Producto</TableHead>
                            <TableHead>Categoría</TableHead>
                            <TableHead>Estado</TableHead>
                            <TableHead className="text-right">Stock Actual</TableHead>
                            <TableHead className="text-right">Costo</TableHead>
                            <TableHead className="text-right">Valor Inventario</TableHead>
                            <TableHead>Último Movimiento</TableHead>
                            <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}
                    </TableBody>
                </Table>
            </div>
            <div className="space-y-4 md:hidden">
                {Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
        </>
    )
}


export default function InventoryReportPage() {
  const [movements, setMovements] = useState([]);
  const [products, setProducts] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedProductForDetail, setSelectedProductForDetail] = useState(null);
  const [selectedProductForInfo, setSelectedProductForInfo] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [siteName, setSiteName] = useState('OTRO ZARPE');
  const { user } = useAuth();

  const handleToggleActive = async (product) => {
    if (!user) {
        toast({ title: "Error", description: "Debes iniciar sesión para realizar esta acción.", variant: "destructive" });
        return;
    }
    try {
        await updateProduct(product.id, { active: !product.active }, user);
        toast({ title: "Éxito", description: `Producto ${product.active ? 'desactivado' : 'activado'}.` });
    } catch (error) {
        toast({ title: "Error", description: "No se pudo actualizar el estado del producto.", variant: "destructive" });
    }
  };

  useEffect(() => {
    getHomepageSettings().then(settings => {
      if (settings?.siteName) setSiteName(settings.siteName);
    });
  }, []);

  // Filter states
  const [selectedProduct, setSelectedProduct] = useState('all');
  const [selectedType, setSelectedType] = useState('all');
  const [selectedUser, setSelectedUser] = useState('all');
  const [dateRange, setDateRange] = useState(undefined);
  const [filterOutOfStock, setFilterOutOfStock] = useState(false);
  const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' });

  const handleSort = (key) => {
    setSortConfig(prev => {
      if (prev.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { key, direction: 'asc' };
    });
  };

  const renderSortIcon = (key) => {
    if (sortConfig.key === key) {
      return sortConfig.direction === 'asc' ? (
        <ArrowUp className="h-4 w-4 ml-1 text-primary shrink-0 transition-transform" />
      ) : (
        <ArrowDown className="h-4 w-4 ml-1 text-primary shrink-0 transition-transform" />
      );
    }
    return (
      <ArrowUpDown className="h-3.5 w-3.5 ml-1 text-muted-foreground/40 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
    );
  };

  useEffect(() => {
    setLoading(true);

    const productsQuery = query(collection(db, 'products'), orderBy('name'));
    const movementsQuery = query(collection(db, 'inventoryMovements'), orderBy('createdAt', 'desc'));

    const unsubProducts = onSnapshot(productsQuery, (snapshot) => {
        setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
        toast({ title: 'Error', description: 'No se pudieron cargar los productos.', variant: 'destructive' });
        console.error(error);
    });

    const unsubMovements = onSnapshot(movementsQuery, (snapshot) => {
        const fetchedMovements = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setMovements(fetchedMovements);

        const usersMap = new Map();
        fetchedMovements.forEach(m => {
            if(m.userId && m.userEmail) {
                usersMap.set(m.userId, { uid: m.userId, email: m.userEmail });
            }
        });
        setUsers(Array.from(usersMap.values()).sort((a,b) => a.email.localeCompare(b.email)));

        setLoading(false);
    }, (error) => {
        toast({ title: 'Error', description: 'No se pudieron cargar los movimientos.', variant: 'destructive' });
        console.error(error);
        setLoading(false);
    });

    return () => {
        unsubProducts();
        unsubMovements();
    };
  }, [toast]);
  
  const productsWithMovements = useMemo(() => {
    return products.map(p => {
        const productMovements = movements
            .filter(m => m.productId === p.id)
            .sort((a, b) => b.createdAt.toDate() - a.createdAt.toDate());
        return { ...p, movements: productMovements };
    });
}, [products, movements]);

  const filteredProductList = useMemo(() => {
      if (!productsWithMovements) return [];
      
      const filtered = productsWithMovements.filter(product => {
          const productFilterMatch = selectedProduct === 'all' || product.id === selectedProduct;
          const outOfStockFilterMatch = !filterOutOfStock || product.stock === 0;

          if (!productFilterMatch || !outOfStockFilterMatch) {
              return false;
          }

          const hasMovementFilters = selectedType !== 'all' || selectedUser !== 'all' || dateRange;

          if (hasMovementFilters) {
              return product.movements.some(m => {
                  const typeMatch = selectedType === 'all' || m.type === selectedType;
                  const userMatch = selectedUser === 'all' || m.userId === selectedUser;

                  let dateMatch = true;
                  if (dateRange?.from) {
                      const movementDate = m.createdAt.toDate();
                      const fromDate = new Date(dateRange.from.setHours(0, 0, 0, 0));
                      const toDate = dateRange.to ? new Date(dateRange.to.setHours(23, 59, 59, 999)) : fromDate;
                      dateMatch = movementDate >= fromDate && movementDate <= (dateRange.to ? toDate : new Date(fromDate.getTime() + 24 * 60 * 60 * 1000 - 1));
                  }
                  
                  return typeMatch && userMatch && dateMatch;
              });
          }
          
          return true;
      });

      if (!sortConfig.key) return filtered;

      return [...filtered].sort((a, b) => {
        let comparison = 0;
        const stockA = a.stock || 0;
        const stockB = b.stock || 0;
        const costA = a.costPrice || 0;
        const costB = b.costPrice || 0;
        const valueA = stockA * costA;
        const valueB = stockB * costB;

        switch (sortConfig.key) {
          case 'name':
            comparison = (a.name || '').localeCompare(b.name || '', 'es', { sensitivity: 'base', numeric: true });
            break;
          case 'category':
            comparison = (a.category || '').localeCompare(b.category || '', 'es', { sensitivity: 'base' });
            break;
          case 'active': {
            const activeA = a.active !== false ? 1 : 0;
            const activeB = b.active !== false ? 1 : 0;
            comparison = activeB - activeA;
            break;
          }
          case 'stock':
            comparison = stockA - stockB;
            break;
          case 'costPrice':
            comparison = costA - costB;
            break;
          case 'inventoryValue':
            comparison = valueA - valueB;
            break;
          case 'lastMovement': {
            const timeA = a.movements?.[0]?.createdAt?.toDate ? a.movements[0].createdAt.toDate().getTime() : (a.movements?.[0]?.createdAt?.seconds ? a.movements[0].createdAt.seconds * 1000 : 0);
            const timeB = b.movements?.[0]?.createdAt?.toDate ? b.movements[0].createdAt.toDate().getTime() : (b.movements?.[0]?.createdAt?.seconds ? b.movements[0].createdAt.seconds * 1000 : 0);
            comparison = timeA - timeB;
            break;
          }
          default:
            comparison = 0;
        }

        return sortConfig.direction === 'asc' ? comparison : -comparison;
      });
  }, [productsWithMovements, selectedProduct, selectedType, selectedUser, dateRange, filterOutOfStock, sortConfig]);


  
  const resetFilters = () => {
    setSelectedProduct('all');
    setSelectedType('all');
    setSelectedUser('all');
    setDateRange(undefined);
    setFilterOutOfStock(false);
  }

  const handleFormFinished = (success) => {
    setSubmitting(false);
    setIsAddModalOpen(false);
    // Data will refresh automatically due to onSnapshot
  }

  const openDetailModal = (product) => {
      setSelectedProductForDetail(product);
      setIsDetailModalOpen(true);
  }

  const generatePDF = () => {
    try {
        const doc = new jsPDF();
        const dateStr = format(new Date(), 'dd/MM/yyyy HH:mm', { locale: es });
        const pdfFormatCurrency = (amount) => formatCurrency(amount).replace(/₡|C\./g, '').trim();

        // Header
        const parts = siteName.split(' ');
        doc.setFontSize(22);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 0, 0);
        doc.text(parts[0], 20, 20);
        
        if (parts.length > 1) {
            doc.setTextColor(220, 38, 38);
            doc.setFont('helvetica', 'bolditalic');
            doc.text(parts.slice(1).join(' '), 20 + doc.getTextWidth(parts[0]) + 2, 20);
        }

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 100, 100);
        doc.text('REPORTE DE INVENTARIO Y STOCK', 20, 28);
        doc.text(`Generado el: ${dateStr}`, 20, 34);

        // Filters info
        let filterText = "Filtros aplicados: Ninguno";
        if (selectedProduct !== 'all' || selectedType !== 'all' || selectedUser !== 'all' || dateRange || filterOutOfStock) {
            filterText = "Filtros activos: ";
            if (selectedProduct !== 'all') filterText += "Producto específico, ";
            if (selectedType !== 'all') filterText += `Tipo: ${selectedType}, `;
            if (filterOutOfStock) filterText += "Solo agotados, ";
            if (dateRange) filterText += "Rango de fechas, ";
            filterText = filterText.replace(/, $/, "");
        }
        doc.setFontSize(8);
        doc.text(filterText, 20, 40);

        // Table Data
        const tableData = filteredProductList.map(p => [
            p.name,
            p.category || 'N/A',
            p.stock,
            pdfFormatCurrency(p.costPrice || 0),
            pdfFormatCurrency(p.stock * (p.costPrice || 0))
        ]);

        const totalStock = filteredProductList.reduce((acc, p) => acc + p.stock, 0);
        const totalValue = filteredProductList.reduce((acc, p) => acc + (p.stock * (p.costPrice || 0)), 0);

        autoTable(doc, {
            startY: 45,
            head: [['Producto', 'Categoría', 'Stock', 'Costo Unit.', 'Valor Total']],
            body: tableData,
            theme: 'striped',
            headStyles: { fillColor: [31, 41, 55] },
            styles: { fontSize: 8 },
            columnStyles: {
                2: { halign: 'center' },
                3: { halign: 'right' },
                4: { halign: 'right' }
            },
            foot: [[
                'TOTAL GENERAL',
                '',
                totalStock,
                '',
                pdfFormatCurrency(totalValue)
            ]],
            footStyles: { fillColor: [243, 244, 246], textColor: [0, 0, 0], fontStyle: 'bold' }
        });

        // Pagination
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            const pageWidth = doc.internal.pageSize.getWidth();
            const pageHeight = doc.internal.pageSize.getHeight();
            doc.setFontSize(10);
            doc.setTextColor(150, 150, 150);
            doc.line(20, pageHeight - 15, pageWidth - 20, pageHeight - 15);
            doc.text(`Página ${i} de ${pageCount}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
            doc.text(siteName, 20, pageHeight - 10);
        }

        doc.save(`Reporte_Inventario_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`);
        toast({ title: "PDF Generado", description: "El reporte se ha descargado correctamente." });
    } catch (error) {
        console.error(error);
        toast({ title: "Error", description: "No se pudo generar el reporte PDF.", variant: "destructive" });
    }
  }

  return (
    <AuthorizedOnly allowedRoles={['ADMIN']}>
       <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Movimiento de Inventario</DialogTitle>
            <DialogDescription>
              Registra una entrada, salida o ajuste de stock para un producto.
            </DialogDescription>
          </DialogHeader>
          <MovementForm products={products} onFinished={handleFormFinished} submitting={submitting} user={user} />
        </DialogContent>
      </Dialog>

      <Dialog open={isDetailModalOpen} onOpenChange={setIsDetailModalOpen}>
        {selectedProductForDetail && (
            <ProductMovementsDetail movements={selectedProductForDetail.movements} product={selectedProductForDetail} />
        )}
      </Dialog>

      <Dialog open={!!selectedProductForInfo} onOpenChange={(open) => !open && setSelectedProductForInfo(null)}>
        {selectedProductForInfo && (
            <AdminProductDetailModal 
              product={products.find(p => p.id === selectedProductForInfo.id) || selectedProductForInfo} 
              onClose={() => setSelectedProductForInfo(null)} 
            />
        )}
      </Dialog>
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div>
                <CardTitle>Reporte de Inventario</CardTitle>
                <CardDescription>
                  Resumen de stock por producto. Haz clic en "Ver Movimientos" para ver el detalle.
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={generatePDF}>
                      <FileText className="mr-2 h-4 w-4" />
                      Exportar PDF
                  </Button>
                  <Button onClick={() => setIsAddModalOpen(true)}>
                      <PlusCircle className="mr-2 h-4 w-4" />
                      Registrar Movimiento
                  </Button>
              </div>
          </div>
          <div className="mt-6 border-t pt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4 items-center">
                  <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                      <SelectTrigger><SelectValue placeholder="Filtrar por producto..." /></SelectTrigger>
                      <SelectContent>
                          <SelectItem value="all">Todos los productos</SelectItem>
                          {products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                      </SelectContent>
                  </Select>
                  <Select value={selectedType} onValueChange={setSelectedType}>
                      <SelectTrigger><SelectValue placeholder="Filtrar por tipo..." /></SelectTrigger>
                      <SelectContent>
                          <SelectItem value="all">Todos los tipos</SelectItem>
                          <SelectItem value="ENTRADA">Entrada</SelectItem>
                          <SelectItem value="SALIDA">Salida</SelectItem>
                          <SelectItem value="AJUSTE">Ajuste</SelectItem>
                      </SelectContent>
                  </Select>
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
              <div className="flex items-center space-x-2 mt-4">
                <Switch 
                  id="out-of-stock-filter"
                  checked={filterOutOfStock}
                  onCheckedChange={setFilterOutOfStock}
                />
                <Label htmlFor="out-of-stock-filter">Mostrar solo agotados</Label>
              </div>
          </div>
        </CardHeader>
        <CardContent>
            {loading ? <ReportSkeleton /> : (
            <>
              {/* Desktop Table View */}
              <Table className="hidden md:table">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[80px]">Imagen</TableHead>
                    <TableHead 
                      className={cn(
                        "cursor-pointer select-none group transition-colors",
                        sortConfig.key === 'name' ? "text-primary font-bold" : "hover:text-foreground"
                      )}
                      onClick={() => handleSort('name')}
                      title="Ordenar por Producto"
                    >
                      <div className="flex items-center gap-1">
                        <span>Producto</span>
                        {renderSortIcon('name')}
                      </div>
                    </TableHead>
                    <TableHead 
                      className={cn(
                        "cursor-pointer select-none group transition-colors",
                        sortConfig.key === 'category' ? "text-primary font-bold" : "hover:text-foreground"
                      )}
                      onClick={() => handleSort('category')}
                      title="Ordenar por Categoría"
                    >
                      <div className="flex items-center gap-1">
                        <span>Categoría</span>
                        {renderSortIcon('category')}
                      </div>
                    </TableHead>
                    <TableHead 
                      className={cn(
                        "cursor-pointer select-none group transition-colors",
                        sortConfig.key === 'active' ? "text-primary font-bold" : "hover:text-foreground"
                      )}
                      onClick={() => handleSort('active')}
                      title="Ordenar por Estado"
                    >
                      <div className="flex items-center gap-1">
                        <span>Estado</span>
                        {renderSortIcon('active')}
                      </div>
                    </TableHead>
                    <TableHead 
                      className={cn(
                        "cursor-pointer select-none group transition-colors text-right",
                        sortConfig.key === 'stock' ? "text-primary font-bold" : "hover:text-foreground"
                      )}
                      onClick={() => handleSort('stock')}
                      title="Ordenar por Stock Actual"
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>Stock Actual</span>
                        {renderSortIcon('stock')}
                      </div>
                    </TableHead>
                    <TableHead 
                      className={cn(
                        "cursor-pointer select-none group transition-colors text-right",
                        sortConfig.key === 'costPrice' ? "text-primary font-bold" : "hover:text-foreground"
                      )}
                      onClick={() => handleSort('costPrice')}
                      title="Ordenar por Costo"
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>Costo</span>
                        {renderSortIcon('costPrice')}
                      </div>
                    </TableHead>
                    <TableHead 
                      className={cn(
                        "cursor-pointer select-none group transition-colors text-right",
                        sortConfig.key === 'inventoryValue' ? "text-primary font-bold" : "hover:text-foreground"
                      )}
                      onClick={() => handleSort('inventoryValue')}
                      title="Ordenar por Valor Inventario"
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>Valor Inventario</span>
                        {renderSortIcon('inventoryValue')}
                      </div>
                    </TableHead>
                    <TableHead 
                      className={cn(
                        "cursor-pointer select-none group transition-colors",
                        sortConfig.key === 'lastMovement' ? "text-primary font-bold" : "hover:text-foreground"
                      )}
                      onClick={() => handleSort('lastMovement')}
                      title="Ordenar por Último Movimiento"
                    >
                      <div className="flex items-center gap-1">
                        <span>Último Movimiento</span>
                        {renderSortIcon('lastMovement')}
                      </div>
                    </TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProductList.length > 0 ? (
                    filteredProductList.map((product) => (
                      <TableRow key={product.id}>
                        <TableCell>
                          <button
                            type="button"
                            onClick={() => setSelectedProductForInfo(product)}
                            className="cursor-pointer block rounded-md overflow-hidden hover:opacity-80 transition-opacity"
                            title="Ver detalles del producto"
                          >
                            <Image src={product.image || "https://picsum.photos/100/100"} alt={product.name} width={40} height={40} className="rounded-md object-cover" unoptimized/>
                          </button>
                        </TableCell>
                        <TableCell>
                          <button 
                            type="button"
                            onClick={() => setSelectedProductForInfo(product)}
                            className="font-medium text-left hover:text-primary hover:underline transition-colors cursor-pointer group flex items-center gap-1.5"
                            title="Ver detalles del producto"
                          >
                            <span>{product.name}</span>
                            <Eye className="h-3.5 w-3.5 text-muted-foreground/60 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                          </button>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{product.category}</TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <Switch
                              id={`active-switch-${product.id}`}
                              checked={product.active !== false}
                              onCheckedChange={() => handleToggleActive(product)}
                              aria-label={`Activar o desactivar ${product.name}`}
                            />
                            <Label htmlFor={`active-switch-${product.id}`} className="text-xs cursor-pointer select-none">
                              {product.active !== false ? 'Activo' : 'Inactivo'}
                            </Label>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-bold text-lg">{product.stock}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{formatCurrency(product.costPrice)}</TableCell>
                        <TableCell className="text-right font-semibold">{formatCurrency(product.stock * (product.costPrice || 0))}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {product.movements.length > 0 && product.movements[0].createdAt ? format(product.movements[0].createdAt.toDate(), "dd MMM yyyy, HH:mm", { locale: es }) : 'N/A'}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button 
                                variant="outline" 
                                size="icon" 
                                onClick={() => openDetailModal(product)}
                                title={product.stock === 0 ? "Ver Movimientos (Agotado)" : "Ver Movimientos"}
                                aria-label={product.stock === 0 ? "Ver Movimientos (Agotado)" : "Ver Movimientos"}
                                className={cn("h-8 w-8 ml-auto", product.stock === 0 && 'text-destructive border-destructive hover:bg-destructive/10 hover:text-destructive')}
                            >
                                <Eye className="h-4 w-4" />
                            </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center text-muted-foreground h-48">
                        <PackageSearch className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
                        <p className="font-semibold">No se encontraron productos.</p>
                        <p>Intenta ajustar o limpiar los filtros.</p>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>

              {/* Mobile Card View */}
              <div className="space-y-4 md:hidden">
                {filteredProductList.length > 0 ? (
                    filteredProductList.map((product) => (
                        <Card key={product.id}>
                            <CardHeader className="flex flex-row items-start gap-4 p-4">
                                <button
                                  type="button"
                                  onClick={() => setSelectedProductForInfo(product)}
                                  className="cursor-pointer block rounded-md overflow-hidden hover:opacity-80 transition-opacity"
                                  title="Ver detalles del producto"
                                >
                                  <Image src={product.image || "https://picsum.photos/100/100"} alt={product.name} width={64} height={64} className="rounded-md object-cover border" unoptimized/>
                                </button>
                                <div className="flex-1">
                                    <button
                                      type="button"
                                      onClick={() => setSelectedProductForInfo(product)}
                                      className="font-semibold text-left hover:text-primary hover:underline transition-colors block"
                                      title="Ver detalles del producto"
                                    >
                                      {product.name}
                                    </button>
                                    <p className="text-sm text-muted-foreground">{product.category}</p>
                                    <div className="flex items-center space-x-2 mt-2">
                                        <Switch
                                          id={`mobile-active-${product.id}`}
                                          checked={product.active !== false}
                                          onCheckedChange={() => handleToggleActive(product)}
                                        />
                                        <Label htmlFor={`mobile-active-${product.id}`} className="text-xs cursor-pointer select-none">
                                          {product.active !== false ? 'Activo' : 'Inactivo'}
                                        </Label>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="p-4 pt-0 grid grid-cols-2 gap-4 text-sm">
                                <div className="space-y-1">
                                    <p className="text-muted-foreground">Stock Actual</p>
                                    <p className="font-bold text-base">{product.stock}</p>
                                </div>
                                <div className="space-y-1 text-right">
                                    <p className="text-muted-foreground">Valor Inventario</p>
                                    <p className="font-semibold">{formatCurrency(product.stock * (product.costPrice || 0))}</p>
                                </div>
                                <div className="col-span-2 text-xs text-muted-foreground">
                                    <p>Último Movimiento:</p>
                                    <p>{product.movements.length > 0 && product.movements[0].createdAt ? format(product.movements[0].createdAt.toDate(), "dd MMM yyyy, HH:mm", { locale: es }) : 'N/A'}</p>
                                </div>
                            </CardContent>
                            <CardFooter className="p-4 pt-0">
                                <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className={cn("w-full", product.stock === 0 && 'text-destructive border-destructive hover:bg-destructive/10 hover:text-destructive')}
                                    onClick={() => openDetailModal(product)}
                                >
                                    <Eye className="mr-2 h-4 w-4" />
                                    {product.stock === 0 ? "Ver Movimientos (Agotado)" : "Ver Movimientos"}
                                </Button>
                            </CardFooter>
                        </Card>
                    ))
                ) : (
                    <div className="text-center text-muted-foreground py-16">
                        <PackageSearch className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
                        <p className="font-semibold">No se encontraron productos.</p>
                        <p>Intenta ajustar o limpiar los filtros.</p>
                    </div>
                )}
              </div>
              </>
            )}
        </CardContent>
      </Card>
    </AuthorizedOnly>
  );
}
