

'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useToast } from '@/hooks/use-toast';
import { addInventoryMovement } from '@/lib/inventory-service';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Package, Eye, PlusCircle, PackagePlus, PackageMinus, PackageSearch, FilterX, Calendar as CalendarIcon, FileText } from 'lucide-react';
import { AuthorizedOnly } from '@/components/auth/authorized-only';
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

function ReportSkeleton() {
    const SkeletonRow = () => (
        <TableRow>
            <TableCell><Skeleton className="h-10 w-10 rounded-md" /></TableCell>
            <TableCell><Skeleton className="h-5 w-40" /></TableCell>
            <TableCell><Skeleton className="h-4 w-24" /></TableCell>
            <TableCell className="text-right"><Skeleton className="h-6 w-10 ml-auto" /></TableCell>
            <TableCell className="text-right"><Skeleton className="h-5 w-20 ml-auto" /></TableCell>
            <TableCell className="text-right"><Skeleton className="h-5 w-24 ml-auto" /></TableCell>
            <TableCell><Skeleton className="h-4 w-32" /></TableCell>
            <TableCell className="text-right"><Skeleton className="h-8 w-32 ml-auto" /></TableCell>
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
  const [submitting, setSubmitting] = useState(false);
  const [siteName, setSiteName] = useState('OTRO ZARPE');
  const { user } = useAuth();

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
      
      return productsWithMovements.filter(product => {
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
      }).sort((a, b) => a.name.localeCompare(b.name));
  }, [productsWithMovements, selectedProduct, selectedType, selectedUser, dateRange, filterOutOfStock]);


  
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
                    <TableHead>Producto</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead className="text-right">Stock Actual</TableHead>
                    <TableHead className="text-right">Costo</TableHead>
                    <TableHead className="text-right">Valor Inventario</TableHead>
                    <TableHead>Último Movimiento</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProductList.length > 0 ? (
                    filteredProductList.map((product) => (
                      <TableRow key={product.id}>
                        <TableCell>
                          <Image src={product.image || "https://picsum.photos/100/100"} alt={product.name} width={40} height={40} className="rounded-md object-cover" unoptimized/>
                        </TableCell>
                        <TableCell className="font-medium">{product.name}</TableCell>
                        <TableCell className="text-muted-foreground">{product.category}</TableCell>
                        <TableCell className="text-right font-bold text-lg">{product.stock}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{formatCurrency(product.costPrice)}</TableCell>
                        <TableCell className="text-right font-semibold">{formatCurrency(product.stock * (product.costPrice || 0))}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {product.movements.length > 0 && product.movements[0].createdAt ? format(product.movements[0].createdAt.toDate(), "dd MMM yyyy, HH:mm", { locale: es }) : 'N/A'}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => openDetailModal(product)}
                                className={cn(product.stock === 0 && 'text-destructive border-destructive hover:bg-destructive/10 hover:text-destructive')}
                            >
                                <Eye className="mr-2 h-4 w-4" />
                                {product.stock === 0 ? "Ver Movimientos (Agotado)" : "Ver Movimientos"}
                            </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground h-48">
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
                                <Image src={product.image || "https://picsum.photos/100/100"} alt={product.name} width={64} height={64} className="rounded-md object-cover border" unoptimized/>
                                <div className="flex-1">
                                    <p className="font-semibold">{product.name}</p>
                                    <p className="text-sm text-muted-foreground">{product.category}</p>
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
