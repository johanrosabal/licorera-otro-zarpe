
'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCurrency, cn } from '@/lib/utils';
import { PlusCircle, MoreHorizontal, Loader2, Edit, Trash2, Search, FilterX, Eye, Package, DollarSign, Star, Calendar, Box, CheckCircle, XCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import Image from 'next/image';
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
} from "@/components/ui/alert-dialog";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';

import { useEffect, useState, useMemo } from 'react';
import { useToast } from '@/hooks/use-toast';
import { AuthorizedOnly } from '@/components/auth/authorized-only';
import { collection, onSnapshot, query, orderBy, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Badge } from '@/components/ui/badge';
import { updateProduct, deleteProduct } from '@/lib/products-service';
import { getProductCostHistory } from '@/lib/purchases-service';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ProductForm } from '@/components/admin/product-form';
import { useAuth } from '@/hooks/use-auth';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

function DetailItem({ icon: Icon, label, value, valueClassName }) {
    if (value === null || value === undefined) return null;
    return (
        <div className="flex items-start gap-2">
            <Icon className="h-4 w-4 mt-1 text-muted-foreground" />
            <div>
                <p className="text-sm text-muted-foreground">{label}</p>
                <p className={cn("font-medium", valueClassName)}>{value}</p>
            </div>
        </div>
    );
}

function DetailBoolean({ icon: Icon, label, value }) {
    return (
        <div className="flex items-center gap-2">
            {value ? <CheckCircle className="h-4 w-4 text-green-500" /> : <XCircle className="h-4 w-4 text-muted-foreground" />}
            <span className={value ? 'font-semibold' : 'text-muted-foreground'}>{label}</span>
        </div>
    );
}


function ProductCostHistoryModal({ product, onClose }) {
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!product) return;
        async function fetchHistory() {
            try {
                const data = await getProductCostHistory(product.id);
                setHistory(data);
            } catch (error) {
                console.error("Error fetching cost history:", error);
            } finally {
                setLoading(false);
            }
        }
        fetchHistory();
    }, [product]);

    if (!product) return null;

    return (
        <DialogContent className="sm:max-w-4xl max-h-[80vh] flex flex-col">
            <DialogHeader>
                <DialogTitle>Historial de Costos: {product.name}</DialogTitle>
                <DialogDescription>
                    Registro de variaciones en el costo unitario detectadas durante las compras.
                </DialogDescription>
            </DialogHeader>
            
            <div className="flex-1 overflow-y-auto py-4">
                {loading ? (
                    <div className="flex justify-center py-8"><Loader2 className="animate-spin h-8 w-8" /></div>
                ) : history.length > 0 ? (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Fecha</TableHead>
                                <TableHead>Factura</TableHead>
                                <TableHead className="text-right">Costo Anterior</TableHead>
                                <TableHead className="text-right">Costo Nuevo</TableHead>
                                <TableHead className="text-right">Variación</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {history.map((entry) => {
                                const isIncrease = entry.difference > 0;
                                return (
                                    <TableRow key={entry.id}>
                                        <TableCell className="text-sm">
                                            {entry.createdAt ? format(entry.createdAt.toDate(), "dd/MM/yy HH:mm", { locale: es }) : 'N/A'}
                                        </TableCell>
                                        <TableCell>
                                            <div className="text-sm">
                                                <p className="font-medium">#{entry.invoiceNumber}</p>
                                                <p className="text-xs text-muted-foreground">ID Prov: {entry.supplierId}</p>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right text-muted-foreground">
                                            {formatCurrency(entry.previousCostPrice)}
                                        </TableCell>
                                        <TableCell className="text-right font-semibold">
                                            {formatCurrency(entry.newCostPrice)}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className={cn(
                                                "flex flex-col items-end text-xs font-bold",
                                                isIncrease ? "text-destructive" : entry.difference < 0 ? "text-green-600" : "text-muted-foreground"
                                            )}>
                                                <span>{isIncrease ? '▲' : '▼'} {formatCurrency(Math.abs(entry.difference))}</span>
                                                <span>({entry.differencePercentage.toFixed(1)}%)</span>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                ) : (
                    <div className="text-center py-12 border-2 border-dashed rounded-lg">
                        <DollarSign className="h-12 w-12 mx-auto text-muted-foreground mb-2 opacity-20" />
                        <p className="text-muted-foreground">No se han registrado variaciones de costo para este producto.</p>
                    </div>
                )}
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={onClose}>Cerrar</Button>
            </DialogFooter>
        </DialogContent>
    );
}

function ProductDetailModal({ product, onClose }) {
    if (!product) return null;

    const formatDate = (timestamp) => {
        if (!timestamp) return 'N/A';
        return format(timestamp.toDate(), "dd MMM yyyy, HH:mm", { locale: es });
    }

    return (
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
                <DialogTitle>{product.name}</DialogTitle>
                <DialogDescription>{product.category} / {product.brand || 'Sin marca'}</DialogDescription>
            </DialogHeader>
            <div className="grid md:grid-cols-2 gap-8 py-4">
                <div className="flex flex-col gap-4">
                     <div className="relative aspect-square w-full max-w-sm mx-auto overflow-hidden rounded-lg border">
                        <Image src={product.image || "https://picsum.photos/400/500"} alt={product.name} fill className="object-cover" unoptimized/>
                    </div>
                     <p className="text-muted-foreground text-sm">{product.description}</p>
                </div>
                <div className="space-y-6">
                    <div>
                        <h3 className="text-lg font-semibold mb-2">Precios y Stock</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <DetailItem icon={DollarSign} label="Precio de Costo" value={formatCurrency(product.costPrice)} />
                            <DetailItem icon={DollarSign} label="Precio de Venta" value={formatCurrency(product.sellingPrice)} />
                            <DetailItem icon={Package} label="Stock Actual" value={product.stock} />
                            <DetailItem icon={Box} label="Unidad de Medida" value={product.unitOfMeasure} />
                        </div>
                    </div>
                     <Separator />
                    <div>
                        <h3 className="text-lg font-semibold mb-2">Propiedades</h3>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                           <DetailBoolean icon={CheckCircle} label="Activo" value={product.active} />
                           <DetailBoolean icon={Star} label="Destacado" value={product.featured} />
                           <DetailBoolean icon={Box} label="Uso Interno" value={product.internalOnly} />
                           <DetailBoolean icon={DollarSign} label="En Promoción" value={product.hasPromotion} />
                           {product.hasPromotion && <DetailItem icon={DollarSign} label="Descuento" value={`${product.promotionPercentage}%`} />}
                           <DetailBoolean icon={Package} label="Es un Combo" value={product.isBundle} />
                           <DetailBoolean icon={Package} label="Tiene Alcohol" value={product.hasAlcohol} />
                           {product.hasAlcohol && <DetailItem icon={Package} label="Grado Alc." value={`${product.alcoholGrade}%`} />}
                        </div>
                    </div>
                     <Separator />
                     <div>
                        <h3 className="text-lg font-semibold mb-2">Información Adicional</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <DetailItem icon={Calendar} label="Creado" value={formatDate(product.createdAt)} />
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


export default function AdminProductsPage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [deletingProduct, setDeletingProduct] = useState(null);
  const [detailProduct, setDetailProduct] = useState(null);
  const [historyProduct, setHistoryProduct] = useState(null);
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const { toast } = useToast();
  const { user } = useAuth();
  
  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedBrand, setSelectedBrand] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');

  // Pagination
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);


  useEffect(() => {
    const productsCol = collection(db, "products");
    const q = query(productsCol, orderBy("name", "asc"));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedProducts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setProducts(fetchedProducts);
      setLoading(false);
    }, async (error) => {
      const permissionError = new FirestorePermissionError({
        path: productsCol.path,
        operation: 'list',
      });
      errorEmitter.emit('permission-error', permissionError);
      setLoading(false);
    });
    
    // Listen to categories and brands in real-time
    const qCategories = query(collection(db, 'categories'), where("active", "==", true), orderBy("name"));
    const unsubCategories = onSnapshot(qCategories, (snapshot) => {
        setCategories(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const qBrands = query(collection(db, 'brands'), where("active", "==", true), orderBy("name"));
    const unsubBrands = onSnapshot(qBrands, (snapshot) => {
        setBrands(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });


    return () => {
      unsubscribe();
      unsubCategories();
      unsubBrands();
    };
  }, [toast]);
  
  const filteredProducts = useMemo(() => {
    return products.filter(product => {
      const searchTermLower = searchTerm.toLowerCase();
      
      const searchMatch = searchTerm === '' ||
        product.name.toLowerCase().includes(searchTermLower) ||
        (product.description && product.description.toLowerCase().includes(searchTermLower));
        
      const categoryMatch = selectedCategory === 'all' || product.category === selectedCategory;
      const brandMatch = selectedBrand === 'all' || product.brand === selectedBrand;
      const statusMatch = selectedStatus === 'all' || (selectedStatus === 'active' && product.active) || (selectedStatus === 'inactive' && !product.active);

      return searchMatch && categoryMatch && brandMatch && statusMatch;
    });
  }, [products, searchTerm, selectedCategory, selectedBrand, selectedStatus]);

  // Reset to page 1 whenever filters or page size change
  useEffect(() => { setCurrentPage(1); }, [searchTerm, selectedCategory, selectedBrand, selectedStatus, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / pageSize));
  const paginatedProducts = filteredProducts.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const resetFilters = () => {
    setSearchTerm('');
    setSelectedCategory('all');
    setSelectedBrand('all');
    setSelectedStatus('all');
  };

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
  }

  const handleToggleFeatured = async (product) => {
    if (!user) {
        toast({ title: "Error", description: "Debes iniciar sesión para realizar esta acción.", variant: "destructive" });
        return;
    }
    try {
        await updateProduct(product.id, { featured: !product.featured }, user);
        toast({ title: "Éxito", description: `Producto ${!product.featured ? 'marcado como destacado' : 'quitado de destacados'}.` });
    } catch (error) {
        toast({ title: "Error", description: "No se pudo actualizar el estado de destacado.", variant: "destructive" });
    }
  }

  const handleDelete = async (id) => {
    try {
      await deleteProduct(id);
      toast({ title: "Éxito", description: "Producto eliminado correctamente." });
    } catch (error) {
      toast({ title: "Error", description: "No se pudo eliminar el producto.", variant: "destructive" });
    }
  }

  const handleAddNew = () => {
    setEditingProduct(null);
    setIsFormOpen(true);
  }

  const handleEdit = (product) => {
    setEditingProduct(product);
    setIsFormOpen(true);
  }
  
  const handleViewDetails = (product) => {
    setDetailProduct(product);
  }

  const handleFormClose = () => {
    setIsFormOpen(false);
    setEditingProduct(null);
  }


  return (
    <AuthorizedOnly allowedRoles={['ADMIN']}>
      <div className="w-full">
        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
            <DialogContent className="sm:max-w-[80vw] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{editingProduct ? 'Editar Producto' : 'Añadir Nuevo Producto'}</DialogTitle>
                    <DialogDescription>
                        {editingProduct ? 'Actualiza la información del producto.' : 'Completa el formulario para agregar un nuevo producto a tu tienda.'}
                    </DialogDescription>
                </DialogHeader>
                <ProductForm product={editingProduct ?? undefined} onFinished={handleFormClose} />
            </DialogContent>
        </Dialog>
        
        <Dialog open={!!detailProduct} onOpenChange={(isOpen) => !isOpen && setDetailProduct(null)}>
            <ProductDetailModal product={detailProduct} onClose={() => setDetailProduct(null)} />
        </Dialog>

        <Dialog open={!!historyProduct} onOpenChange={(isOpen) => !isOpen && setHistoryProduct(null)}>
            <ProductCostHistoryModal product={historyProduct} onClose={() => setHistoryProduct(null)} />
        </Dialog>

        <AlertDialog open={!!deletingProduct} onOpenChange={(isOpen) => !isOpen && setDeletingProduct(null)}>
             <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta acción no se puede deshacer. Se eliminará permanentemente el producto y su imagen asociada.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setDeletingProduct(null)}>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={() => { handleDelete(deletingProduct.id); setDeletingProduct(null); }}>Eliminar</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>


        <Card>
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle>Gestión de Productos</CardTitle>
                <CardDescription>Añade, edita o elimina productos de tu catálogo.</CardDescription>
              </div>
              <Button onClick={handleAddNew}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Añadir Producto
              </Button>
            </div>
             <div className="mt-6 border-t pt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                    <div className="relative lg:col-span-2">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                      <Input
                          placeholder="Buscar por nombre o descripción..."
                          className="pl-10 w-full"
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                      />
                    </div>
                    <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                      <SelectTrigger><SelectValue placeholder="Categoría" /></SelectTrigger>
                      <SelectContent>
                          <SelectItem value="all">Todas las categorías</SelectItem>
                          {categories.map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Select value={selectedBrand} onValueChange={setSelectedBrand}>
                      <SelectTrigger><SelectValue placeholder="Marca" /></SelectTrigger>
                      <SelectContent>
                          <SelectItem value="all">Todas las marcas</SelectItem>
                          {brands.map(b => <SelectItem key={b.id} value={b.name}>{b.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <div className="flex gap-2">
                      <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                        <SelectTrigger><SelectValue placeholder="Estado" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todos los estados</SelectItem>
                            <SelectItem value="active">Activo</SelectItem>
                            <SelectItem value="inactive">Inactivo</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button variant="ghost" onClick={resetFilters} className="h-10">
                          <FilterX className="h-5 w-5" />
                      </Button>
                    </div>
                </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Desktop Table View */}
            <Table className="hidden md:table">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px] sticky top-0 z-10 bg-background border-b shadow-sm">#</TableHead>
                  <TableHead className="hidden w-[100px] sm:table-cell sticky top-0 z-10 bg-background border-b shadow-sm">
                    Imagen
                  </TableHead>
                  <TableHead className="sticky top-0 z-10 bg-background border-b shadow-sm">Nombre</TableHead>
                  <TableHead className="sticky top-0 z-10 bg-background border-b shadow-sm">Estado</TableHead>
                  <TableHead className="sticky top-0 z-10 bg-background border-b shadow-sm">Destacado</TableHead>
                  <TableHead className="sticky top-0 z-10 bg-background border-b shadow-sm">Categoría/Marca</TableHead>
                  <TableHead className="text-right sticky top-0 z-10 bg-background border-b shadow-sm">P. Costo</TableHead>
                  <TableHead className="text-right sticky top-0 z-10 bg-background border-b shadow-sm">P. Venta</TableHead>
                  <TableHead className="text-right sticky top-0 z-10 bg-background border-b shadow-sm">Stock</TableHead>
                  <TableHead className="text-right sticky top-0 z-10 bg-background border-b shadow-sm">
                    <span className="sr-only">Acciones</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center h-64">
                      <Loader2 className="mx-auto animate-spin h-10 w-10" />
                    </TableCell>
                  </TableRow>
                ) : paginatedProducts.length > 0 ? (
                  paginatedProducts.map((product, index) => (
                    <TableRow key={product.id}>
                      <TableCell className="text-muted-foreground font-medium">
                        {(currentPage - 1) * pageSize + index + 1}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        {product.image ? (
                          <Image
                            alt={product.name}
                            className="aspect-square rounded-md object-cover"
                            height="64"
                            src={product.image}
                            width="64"
                            data-ai-hint="product image"
                            unoptimized
                          />
                        ) : (
                          <div className="aspect-square rounded-md bg-muted flex items-center justify-center">
                            <span className="text-xs text-muted-foreground">Sin imagen</span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="font-medium">{product.name}</TableCell>
                      <TableCell>
                         <Switch
                            id={`active-switch-desktop-${product.id}`}
                            checked={product.active}
                            onCheckedChange={() => handleToggleActive(product)}
                         />
                      </TableCell>
                      <TableCell>
                         <Switch
                            id={`featured-switch-desktop-${product.id}`}
                            checked={product.featured}
                            onCheckedChange={() => handleToggleFeatured(product)}
                        />
                      </TableCell>
                       <TableCell>
                        <div className="text-xs text-muted-foreground">
                            <p>{product.category}</p>
                            <p className="font-semibold">{product.brand || '-'}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">{formatCurrency(product.costPrice)}</TableCell>
                      <TableCell className="text-right font-semibold">{formatCurrency(product.sellingPrice)}</TableCell>
                      <TableCell className="text-right font-bold">{product.stock}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button aria-haspopup="true" size="icon" variant="ghost">
                              <MoreHorizontal className="h-4 w-4" />
                              <span className="sr-only">Toggle menu</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                             <DropdownMenuItem onClick={() => handleViewDetails(product)}>
                                <Eye className="mr-2 h-4 w-4" />
                                <span>Ver Detalles</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleEdit(product)}>
                                <Edit className="mr-2 h-4 w-4" />
                                <span>Editar</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setHistoryProduct(product)}>
                                <DollarSign className="mr-2 h-4 w-4" />
                                <span>Historial de Costos</span>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onSelect={(e) => {e.preventDefault(); setDeletingProduct(product);}} className="text-destructive">
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
                    <TableCell colSpan={10} className="text-center text-muted-foreground h-48">
                      {searchTerm ? `No se encontraron productos para "${searchTerm}".` : 'No hay productos que coincidan con los filtros.'}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            
            {/* Mobile Card View */}
            <div className="space-y-4 md:hidden">
              {loading ? (
                <div className="flex justify-center items-center py-16">
                  <Loader2 className="mx-auto animate-spin text-primary h-10 w-10" />
                </div>
              ) : paginatedProducts.length > 0 ? (
                paginatedProducts.map(product => (
                  <Card key={product.id}>
                    <CardHeader className="flex flex-row items-start gap-4 p-4">
                      <Image
                        src={product.image || "https://picsum.photos/100/100"}
                        alt={product.name}
                        width={80}
                        height={80}
                        className="rounded-md object-cover border"
                        unoptimized
                      />
                      <div className="flex-1">
                        <CardTitle className="text-lg leading-tight mb-1">{product.name}</CardTitle>
                        <CardDescription>{product.category} / {product.brand || 'Sin marca'}</CardDescription>
                      </div>
                      <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button aria-haspopup="true" size="icon" variant="ghost" className="-mt-2 -mr-2">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleViewDetails(product)}>
                                <Eye className="mr-2 h-4 w-4" />
                                Ver Detalles
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleEdit(product)}>
                                <Edit className="mr-2 h-4 w-4" />
                                Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setHistoryProduct(product)}>
                                <DollarSign className="mr-2 h-4 w-4" />
                                Historial de Costos
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setDeletingProduct(product);}} className="text-destructive">
                                <Trash2 className="mr-2 h-4 w-4" />
                                Eliminar
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                    </CardHeader>
                    <CardContent className="p-4 pt-0 grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <p className="text-sm text-muted-foreground">Precio Costo</p>
                            <p className="font-medium text-muted-foreground">{formatCurrency(product.costPrice)}</p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-sm text-muted-foreground">Precio Venta</p>
                            <p className="font-bold">{formatCurrency(product.sellingPrice)}</p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-sm text-muted-foreground">Stock</p>
                            <p className="font-bold text-lg">{product.stock}</p>
                        </div>
                        <div className="flex items-center justify-between p-3 border rounded-md">
                           <Label htmlFor={`active-switch-mobile-${product.id}`}>Activo</Label>
                           <Switch id={`active-switch-mobile-${product.id}`} checked={product.active} onCheckedChange={() => handleToggleActive(product)} />
                        </div>
                         <div className="flex items-center justify-between p-3 border rounded-md">
                           <Label htmlFor={`featured-switch-mobile-${product.id}`}>Destacado</Label>
                           <Switch id={`featured-switch-mobile-${product.id}`} checked={product.featured} onCheckedChange={() => handleToggleFeatured(product)} />
                        </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <div className="text-center py-16 text-muted-foreground">
                  <p>No se encontraron productos.</p>
                </div>
              )}
            </div>
          </CardContent>
          {/* Pagination controls */}
          {!loading && (filteredProducts.length > pageSize || pageSize !== 20) && (
            <CardFooter className="flex flex-col md:flex-row items-center justify-between gap-4 border-t px-6 py-4">
              <div className="flex items-center gap-4">
                <p className="text-sm text-muted-foreground whitespace-nowrap">
                  Mostrando <span className="font-medium">{(currentPage - 1) * pageSize + 1}</span>–<span className="font-medium">{Math.min(currentPage * pageSize, filteredProducts.length)}</span> de <span className="font-medium">{filteredProducts.length}</span>
                </p>
                <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground whitespace-nowrap">Filas:</span>
                    <Select value={pageSize.toString()} onValueChange={(v) => setPageSize(parseInt(v))}>
                        <SelectTrigger className="h-8 w-[70px]">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="10">10</SelectItem>
                            <SelectItem value="20">20</SelectItem>
                            <SelectItem value="50">50</SelectItem>
                            <SelectItem value="100">100</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <Button
                  variant="outline" size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Anterior
                </Button>
                <span className="text-sm font-medium px-2">
                  Página {currentPage} de {totalPages}
                </span>
                <Button
                  variant="outline" size="sm"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  Siguiente
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </CardFooter>
          )}
        </Card>
      </div>
    </AuthorizedOnly>
  );
}
