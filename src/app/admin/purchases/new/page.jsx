

'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CalendarIcon, PlusCircle, Trash2, Loader2, Save, Upload, X, Search } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { cn, formatCurrency, formatCurrencyInput, parseFormattedCurrency } from '@/lib/utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { AuthorizedOnly } from '@/components/auth/authorized-only';
import { useAuth } from '@/hooks/use-auth';
import { getSuppliers } from '@/lib/suppliers';
import { getProducts } from '@/lib/products-service';
import { addPurchase } from '@/lib/purchases-service';
import { useRouter } from 'next/navigation';
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
  taxesIncluded: z.boolean().default(false),
  items: z.array(purchaseItemSchema).min(1, 'Debes agregar al menos un producto a la compra.'),
  invoiceImage: z.any().optional(),
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
                onKeyDown={(e) => e.stopPropagation()}
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

/**
 * CurrencyInput: maintains a raw local string while the user types,
 * only formats (adds thousand commas) on blur.
 * This prevents the period from being swallowed when typing decimals.
 */
function CurrencyInput({ value, onChange, className }) {
  const [display, setDisplay] = React.useState('');
  const isFocused = React.useRef(false);

  // Sync external value changes (e.g. when a product is auto-selected) only when not focused
  React.useEffect(() => {
    if (!isFocused.current) {
      setDisplay(value !== undefined && value !== null && value !== 0 ? formatCurrencyInput(value) : '');
    }
  }, [value]);

  const handleChange = (e) => {
    // Allow only digits, commas and ONE period
    const raw = e.target.value.replace(/[^0-9.,]/g, '');
    setDisplay(raw);
    // Remove commas before parsing so "1,234.56" → 1234.56
    const parsed = parseFloat(raw.replace(/,/g, '')) || 0;
    onChange(parsed);
  };

  const handleFocus = () => {
    isFocused.current = true;
    // Show raw number (strip commas) so the user can edit it directly
    const raw = String(value ?? '').replace(/,/g, '');
    setDisplay(raw === '0' ? '' : raw);
  };

  const handleBlur = () => {
    isFocused.current = false;
    const parsed = parseFloat(display.replace(/,/g, '')) || 0;
    setDisplay(formatCurrencyInput(parsed));
    onChange(parsed);
  };

  return (
    <Input
      type="text"
      inputMode="decimal"
      className={cn('text-right', className)}
      value={display}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
    />
  );
}


export default function NewPurchasePage() {
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);
  const { toast } = useToast();
  const { user } = useAuth();
  const router = useRouter();

  const form = useForm({
    resolver: zodResolver(purchaseSchema),
    defaultValues: {
      supplierId: '',
      invoiceNumber: '',
      invoiceDate: new Date(),
      taxesIncluded: false,
      items: [{ productId: '', quantity: 1, costPrice: 0, taxPercentage: 0 }],
      invoiceImage: undefined,
    },
  });

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
    } else {
      setImagePreview(null);
    }
  }, [imageValue]);

  useEffect(() => {
    async function fetchData() {
      try {
        const [fetchedSuppliers, fetchedProducts] = await Promise.all([
          getSuppliers({ activeOnly: true }),
          getProducts(), // We get all products, not just active ones for purchases
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
      await addPurchase(purchaseDataWithTotals, user);
      toast({ title: 'Éxito', description: 'Factura de compra registrada correctamente.' });
      router.push('/admin/purchases');
    } catch (error) {
      console.error(error);
      toast({ title: 'Error', description: error.message || 'No se pudo registrar la compra.', variant: 'destructive' });
    } finally {
        setSubmitting(false);
    }
  };

  const calculateTotals = (items, taxesIncluded) => {
    if (taxesIncluded) {
      // Prices include tax: extract tax from gross price
      // Net = gross / (1 + tax%), Tax = gross - net
      const totalGross = items.reduce((acc, item) => acc + ((item.quantity || 0) * (item.costPrice || 0)), 0);
      const taxAmount = items.reduce((acc, item) => {
        const gross = (item.quantity || 0) * (item.costPrice || 0);
        const taxRate = (item.taxPercentage || 0) / 100;
        return acc + (taxRate > 0 ? gross * taxRate / (1 + taxRate) : 0);
      }, 0);
      const subtotal = totalGross - taxAmount;
      return { subtotalAmount: subtotal, taxAmount, totalAmount: totalGross };
    } else {
      // Prices are net: add tax on top
      const subtotal = items.reduce((acc, item) => acc + ((item.quantity || 0) * (item.costPrice || 0)), 0);
      const taxAmount = items.reduce((acc, item) => {
        const itemSubtotal = (item.quantity || 0) * (item.costPrice || 0);
        return acc + itemSubtotal * ((item.taxPercentage || 0) / 100);
      }, 0);
      return { subtotalAmount: subtotal, taxAmount, totalAmount: subtotal + taxAmount };
    }
  }
  
  const watchedItems = form.watch('items');
  const watchedTaxesIncluded = form.watch('taxesIncluded');
  const { subtotalAmount, taxAmount, totalAmount } = calculateTotals(watchedItems, watchedTaxesIncluded);

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
              <CardTitle>Registrar Factura de Compra</CardTitle>
              <CardDescription>
                Ingresa los detalles de la factura de compra para actualizar el inventario y registrar el costo.
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

              {/* Taxes Included Switch */}
              <FormField
                control={form.control}
                name="taxesIncluded"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 bg-muted/30">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base font-semibold">Impuestos incluidos en el precio unitario</FormLabel>
                      <p className="text-sm text-muted-foreground">
                        {field.value
                          ? '✔ El costo unitario ya incluye el IVA. Se extraerá automáticamente del precio.'
                          : 'El costo unitario es precio neto. El IVA se sumará encima del subtotal.'}
                      </p>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />

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
              {/* Desktop Table View */}
              <div className="overflow-x-auto hidden md:block border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[30%]">Producto</TableHead>
                      <TableHead>Cantidad</TableHead>
                      <TableHead>
                        Costo Unitario
                        <span className="ml-1 text-xs font-normal text-muted-foreground">
                          {watchedTaxesIncluded ? '(IVA incluido)' : '(sin IVA)'}
                        </span>
                      </TableHead>
                      <TableHead>Subtotal Neto</TableHead>
                      <TableHead className="text-center">Imp. (%)</TableHead>
                      <TableHead className="text-right">Impuesto (Monto)</TableHead>
                      <TableHead className="text-right font-semibold">Subtotal Bruto</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fields.map((item, index) => {
                      const itemValues = watchedItems[index] || {};
                      const gross = (itemValues.quantity || 0) * (itemValues.costPrice || 0);
                      const taxRate = (itemValues.taxPercentage || 0) / 100;
                      const itemTaxAmount = watchedTaxesIncluded
                        ? (taxRate > 0 ? gross * taxRate / (1 + taxRate) : 0)
                        : gross * taxRate;
                      const itemSubtotal = watchedTaxesIncluded ? gross - itemTaxAmount : gross;
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
                                render={({ field }) => (
                                    <FormItem><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                                )}
                            />
                        </TableCell>
                        <TableCell>
                          <FormField
                            control={form.control}
                            name={`items.${index}.costPrice`}
                            render={({ field }) => (
                                <FormItem>
                                <FormControl>
                                  <CurrencyInput value={field.value} onChange={field.onChange} />
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
                        <TableCell className="text-right font-semibold">
                            {formatCurrency(itemSubtotal + itemTaxAmount)}
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

               {/* Mobile Card View */}
                <div className="space-y-4 md:hidden">
                    {fields.map((item, index) => {
                        const itemValues = watchedItems[index] || {};
                        const gross = (itemValues.quantity || 0) * (itemValues.costPrice || 0);
                        const taxRate = (itemValues.taxPercentage || 0) / 100;
                        const itemTaxAmountMobile = watchedTaxesIncluded
                          ? (taxRate > 0 ? gross * taxRate / (1 + taxRate) : 0)
                          : gross * taxRate;
                        const itemSubtotalMobile = watchedTaxesIncluded ? gross - itemTaxAmountMobile : gross;
                        const itemGrossMobile = itemSubtotalMobile + itemTaxAmountMobile;
                        return (
                            <Card key={item.id} className="relative">
                                <Button type="button" variant="ghost" size="icon" className="absolute top-2 right-2 z-10" onClick={() => remove(index)} disabled={fields.length <= 1}>
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                                <CardContent className="p-4 space-y-4">
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
                                    <div className="grid grid-cols-2 gap-4">
                                        <FormField
                                            control={form.control}
                                            name={`items.${index}.quantity`}
                                            render={({ field }) => <FormItem><FormLabel>Cantidad</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>}
                                        />
                                        <FormField
                                            control={form.control}
                                            name={`items.${index}.costPrice`}
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Costo Unit.</FormLabel>
                                                    <FormControl>
                                                      <CurrencyInput value={field.value} onChange={field.onChange} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>
                                    <div className="text-right font-semibold">
                                        Subtotal Bruto: {formatCurrency(itemGrossMobile)}
                                    </div>
                                </CardContent>
                            </Card>
                        )
                    })}
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
                              Guardar Factura
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

    
