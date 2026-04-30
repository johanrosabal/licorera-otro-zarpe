

'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CalendarIcon, PlusCircle, Trash2, Loader2, Save, Upload, X, Edit, Search } from 'lucide-react';
import { cn, formatCurrency, formatCurrencyInput, parseFormattedCurrency } from '@/lib/utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { AuthorizedOnly } from '@/components/auth/authorized-only';
import { useAuth } from '@/hooks/use-auth';
import { getSuppliers } from '@/lib/suppliers';
import { getProducts } from '@/lib/products-service';
import { getPurchaseById, updatePurchase } from '@/lib/purchases-service';
import { useRouter, useParams } from 'next/navigation';
import Image from 'next/image';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';

const purchaseItemSchema = z.object({
  productId: z.string().min(1, 'Debes seleccionar un producto.'),
  quantity: z.coerce.number().int().min(1, 'La cantidad debe ser al menos 1.'),
  costPrice: z.coerce.number().min(0, 'El costo no puede ser negativo.'),
  taxPercentage: z.coerce.number().min(0).optional().default(0),
});

const purchaseSchema = z.object({
  supplierId: z.string().min(1, 'Debes seleccionar un proveedor.'),
  invoiceNumber: z.string().min(1, 'El número de factura es requerido.'),
  invoiceDate: z.date({ required_error: 'La fecha de la factura es requerida.' }),
  items: z.array(purchaseItemSchema).min(1, 'Debes agregar al menos un producto a la compra.'),
  invoiceImage: z.any().optional(),
  existingImageUrl: z.string().optional(),
});


function ProductSelector({ products, field, onProductChange, index }) {
  const [searchTerm, setSearchTerm] = useState("");
  
  const filteredProducts = useMemo(() => {
    return products.filter(p =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [products, searchTerm]);

  return (
    <FormItem>
      <Select
        onValueChange={(value) => {
          field.onChange(value);
          onProductChange(index, value);
        }}
        value={field.value}
      >
        <FormControl>
          <SelectTrigger>
            <SelectValue placeholder="Seleccionar producto" />
          </SelectTrigger>
        </FormControl>
        <SelectContent>
          <div className="p-2">
            <div className="relative" onMouseDown={(e) => e.preventDefault()}>
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar producto..."
                className="pl-9 h-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          {filteredProducts.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              {p.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <FormMessage />
    </FormItem>
  );
}


function PurchaseForm({ initialPurchaseData, onFinished }) {
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [imagePreview, setImagePreview] = useState(initialPurchaseData?.invoiceImageUrl || null);
  const { toast } = useToast();
  const { user } = useAuth();
  const router = useRouter();

  const isEditing = !!initialPurchaseData;

  const form = useForm({
    resolver: zodResolver(purchaseSchema),
    defaultValues: {
      supplierId: '',
      invoiceNumber: '',
      invoiceDate: new Date(),
      items: [{ productId: '', quantity: 1, costPrice: 0, taxPercentage: 0 }],
      invoiceImage: undefined,
    },
  });
  
  useEffect(() => {
    if (isEditing && initialPurchaseData) {
        form.reset({
            ...initialPurchaseData,
            invoiceDate: initialPurchaseData.invoiceDate.toDate(),
            existingImageUrl: initialPurchaseData.invoiceImageUrl,
        });
        setImagePreview(initialPurchaseData.invoiceImageUrl)
    }
  }, [initialPurchaseData, isEditing, form]);

  const { fields, append, remove, update } = useFieldArray({
    control: form.control,
    name: 'items',
  });
  
  const imageValue = form.watch('invoiceImage');
  
  useEffect(() => {
    if (imageValue instanceof File) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(imageValue);
    } else if (typeof imageValue === 'string') {
        setImagePreview(imageValue)
    } else if (imageValue === undefined) {
      setImagePreview(initialPurchaseData?.invoiceImageUrl || null);
      if (form.getValues('existingImageUrl')) {
        setImagePreview(form.getValues('existingImageUrl'));
      } else {
        setImagePreview(null);
      }
    }
  }, [imageValue, initialPurchaseData, form]);

  useEffect(() => {
    async function fetchData() {
      try {
        const [fetchedSuppliers, fetchedProducts] = await Promise.all([
          getSuppliers({ activeOnly: true }),
          getProducts(),
        ]);
        setSuppliers(fetchedSuppliers);
        setProducts(fetchedProducts);
      } catch (error) {
        toast({ title: 'Error', description: 'No se pudieron cargar proveedores o productos.', variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [toast]);

  const onProductChange = (index, productId) => {
    const product = products.find(p => p.id === productId);
    if (product) {
      update(index, {
        productId: product.id,
        quantity: 1,
        costPrice: product.costPrice || 0,
        taxPercentage: product.taxPercentage || 0,
      });
    }
  };
  
  const onSubmit = async (data) => {
    if (!user) {
        toast({ title: "Error", description: "Debes iniciar sesión.", variant: "destructive" });
        return;
    }
    setSubmitting(true);
    try {
      const totals = calculateTotals(data.items);
      const purchaseDataWithTotals = {
          ...data,
          ...totals,
      };

      if (isEditing) {
        await updatePurchase(initialPurchaseData.id, initialPurchaseData, purchaseDataWithTotals, user);
        toast({ title: 'Éxito', description: 'Factura de compra actualizada correctamente.' });
      }
      onFinished ? onFinished() : router.push('/admin/purchases');

    } catch (error) {
      console.error(error);
      toast({ title: 'Error', description: error.message || 'No se pudo guardar la compra.', variant: 'destructive' });
    } finally {
        setSubmitting(false);
    }
  };

  const calculateTotals = (items = []) => {
    const subtotal = items.reduce((acc, item) => acc + (item.quantity * item.costPrice || 0), 0);
    const taxAmount = items.reduce((acc, item) => {
        const itemSubtotal = (item.quantity * item.costPrice || 0);
        const itemTax = itemSubtotal * ((item.taxPercentage || 0) / 100);
        return acc + itemTax;
    }, 0);
    const totalAmount = subtotal + taxAmount;
    return { subtotalAmount: subtotal, taxAmount, totalAmount };
  }
  
  const watchedItems = form.watch('items');
  const { subtotalAmount, taxAmount, totalAmount } = calculateTotals(watchedItems);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <AuthorizedOnly allowedRoles={['ADMIN']}>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>{isEditing ? 'Editar Factura de Compra' : 'Registrar Factura de Compra'}</CardTitle>
              <CardDescription>
                {isEditing ? 'Actualiza los detalles de la factura de compra.' : 'Ingresa los detalles de la factura para actualizar el inventario.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid md:grid-cols-3 gap-6">
                <FormField
                  control={form.control}
                  name="supplierId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Proveedor</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger id="supplierId">
                          <SelectValue placeholder="Selecciona un proveedor" />
                        </SelectTrigger>
                      </FormControl>
                        <SelectContent>
                          {suppliers.map((s) => (
                            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                    control={form.control}
                    name="invoiceNumber"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Número de Factura</FormLabel>
                            <FormControl><Input {...field} /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                  control={form.control}
                  name="invoiceDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Fecha de Factura</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                           <FormControl>
                            <Button
                                variant="outline"
                                className={cn('w-full justify-start text-left font-normal', !field.value && 'text-muted-foreground')}
                            >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {field.value ? format(field.value, 'PPP', { locale: es }) : <span>Selecciona una fecha</span>}
                            </Button>
                           </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

               <FormField
                control={form.control}
                name="invoiceImage"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Imagen de la Factura (Opcional)</FormLabel>
                    <FormControl>
                        <div className="w-full">
                            <Input
                                type="file"
                                className="hidden"
                                id="image-upload"
                                accept="image/*"
                                onChange={(e) => field.onChange(e.target.files ? e.target.files[0] : null)}
                                disabled={submitting}
                            />
                            <label
                                htmlFor="image-upload"
                                className="group w-full h-64 border-2 border-dashed border-muted-foreground/50 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-primary transition-colors relative overflow-hidden"
                            >
                                {imagePreview ? (
                                    <>
                                        <Image src={imagePreview} alt="Vista previa de factura" fill className="object-contain" unoptimized />
                                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                            <p className="text-white text-center">Cambiar imagen</p>
                                        </div>
                                        <Button 
                                            type="button" 
                                            variant="destructive" 
                                            size="icon" 
                                            className="absolute top-2 right-2 z-10 h-6 w-6"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                form.setValue('invoiceImage', undefined);
                                                form.setValue('existingImageUrl', undefined);
                                                setImagePreview(null);
                                            }}
                                        >
                                            <X className="h-4 w-4" />
                                        </Button>
                                    </>

                                ) : (
                                    <div className="text-center text-muted-foreground">
                                        <Upload className="mx-auto h-12 w-12 mb-2"/>
                                        <p>Haz clic para subir una imagen de la factura</p>
                                        <p className="text-xs">PNG, JPG, etc.</p>
                                    </div>
                                )}
                            </label>
                        </div>
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />

            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Productos en la Factura</CardTitle>
              <CardDescription>Añade los productos que se incluyeron en esta compra.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[30%]">Producto</TableHead>
                      <TableHead>Cantidad</TableHead>
                      <TableHead>Costo Unitario</TableHead>
                      <TableHead>Subtotal</TableHead>
                      <TableHead className="text-center">Imp. (%)</TableHead>
                      <TableHead>Monto Impuesto</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fields.map((item, index) => {
                      const itemValues = watchedItems[index] || {};
                      const itemSubtotal = (itemValues.quantity || 0) * (itemValues.costPrice || 0);
                      const itemTaxAmount = itemSubtotal * ((itemValues.taxPercentage || 0) / 100);
                      return (
                      <TableRow key={item.id}>
                        <TableCell>
                            <FormField
                              control={form.control}
                              name={`items.${index}.productId`}
                              render={({ field }) => (
                                <ProductSelector
                                    products={products}
                                    field={field}
                                    onProductChange={onProductChange}
                                    index={index}
                                />
                              )}
                            />
                        </TableCell>
                        <TableCell>
                          <FormField
                            control={form.control}
                            name={`items.${index}.quantity`}
                            render={({ field }) => <FormItem><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>}
                          />
                        </TableCell>
                        <TableCell>
                           <FormField
                            control={form.control}
                            name={`items.${index}.costPrice`}
                            render={({ field }) => (
                                <FormItem>
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
                            )}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                            {formatCurrency(itemSubtotal)}
                        </TableCell>
                        <TableCell className="text-center">
                            {watchedItems[index]?.taxPercentage ?? 0}%
                        </TableCell>
                        <TableCell className="text-right">
                            {formatCurrency(itemTaxAmount)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} disabled={fields.length <= 1}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    )})}
                  </TableBody>
                </Table>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => append({ productId: '', quantity: 1, costPrice: 0, taxPercentage: 0 })}
              >
                <PlusCircle className="mr-2 h-4 w-4" />
                Añadir Producto
              </Button>
              {form.formState.errors.items && typeof form.formState.errors.items === 'object' && !Array.isArray(form.formState.errors.items) && <p className="text-sm text-destructive mt-2">{form.formState.errors.items.message}</p>}
            </CardContent>
          </Card>
          
          <div className="flex flex-col items-end gap-4">
              <div className="w-full md:w-1/3 text-right space-y-2">
                  <div className="flex justify-between">
                      <p className="text-muted-foreground">Subtotal</p>
                      <p className="text-lg font-medium">{formatCurrency(subtotalAmount)}</p>
                  </div>
                  <div className="flex justify-between">
                      <p className="text-muted-foreground">Total Impuestos</p>
                      <p className="text-lg font-medium">{formatCurrency(taxAmount)}</p>
                  </div>
                  <div className="border-t pt-2 mt-2 flex justify-between">
                      <p className="text-muted-foreground text-lg">Total de la Factura</p>
                      <p className="text-2xl font-bold">{formatCurrency(totalAmount)}</p>
                  </div>
              </div>
              <div className="flex gap-2">
                  <Button type="button" variant="outline" size="lg" onClick={() => router.push('/admin/purchases')} disabled={submitting}>
                      Cancelar
                  </Button>
                  <Button type="submit" size="lg" disabled={submitting}>
                      {submitting ? (
                          <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Guardando...
                          </>
                      ) : (
                          <>
                              <Save className="mr-2 h-4 w-4" />
                              Guardar Cambios
                          </>
                      )}
                  </Button>
              </div>
          </div>
        </form>
      </Form>
    </AuthorizedOnly>
  );
}


export default function EditPurchasePage() {
    const [purchase, setPurchase] = useState(null);
    const [loading, setLoading] = useState(true);
    const params = useParams();
    const id = params.id;
    const { toast } = useToast();
    const router = useRouter();

    useEffect(() => {
        if (id) {
            getPurchaseById(id)
                .then(data => {
                    if (data) {
                        setPurchase(data);
                    } else {
                        toast({ title: "Error", description: "Factura no encontrada.", variant: "destructive" });
                        router.push('/admin/purchases');
                    }
                })
                .catch(err => {
                    toast({ title: "Error", description: "No se pudo cargar la factura.", variant: "destructive" });
                    console.error(err);
                })
                .finally(() => setLoading(false));
        }
    }, [id, router, toast]);

    if (loading) {
        return <div className="flex justify-center items-center h-64"><Loader2 className="animate-spin h-10 w-10" /></div>;
    }

    if (!purchase) {
        return null; // Or a not found component
    }

    return <PurchaseForm initialPurchaseData={purchase} onFinished={() => router.push('/admin/purchases')} />;
}
