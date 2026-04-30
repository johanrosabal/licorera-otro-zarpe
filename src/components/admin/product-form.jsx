

'use client'

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm, Controller, useFieldArray } from "react-hook-form"
import * as z from "zod"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { useToast } from "@/hooks/use-toast"
import React, { useEffect, useState, useMemo } from "react"
import { addProduct, updateProduct, cleanupUndefinedFields } from "@/lib/products-service"
import { Loader2, Upload, X, Percent, Search, Trash2, PlusCircle } from "lucide-react"
import Image from "next/image"
import { collection, onSnapshot, query, where, orderBy } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { Switch } from "../ui/switch"
import { useAuth } from "@/hooks/use-auth"
import { formatCurrencyInput, parseFormattedCurrency } from "@/lib/utils"
import { Separator } from "../ui/separator"
import { Label } from "../ui/label"

const bundleItemSchema = z.object({
    productId: z.string().min(1, 'Debes seleccionar un producto.'),
    quantity: z.coerce.number().int().min(1, 'La cantidad debe ser al menos 1.'),
    name: z.string().optional(), // Not for validation, just for display
    image: z.string().optional(), // Not for validation, just for display
});


const productFormSchema = z.object({
  name: z.string().min(3, "El nombre debe tener al menos 3 caracteres."),
  description: z.string().min(10, "La descripción corta debe tener al menos 10 caracteres."),
  costPrice: z.coerce.number({invalid_type_error: "Debe ser un número"}).min(0, "El precio de costo no puede ser negativo.").optional(),
  sellingPrice: z.coerce.number({invalid_type_error: "Debe ser un número"}).min(0, "El precio de venta no puede ser negativo."),
  stock: z.coerce.number().int().min(0, "El stock no puede ser negativo.").optional(),
  category: z.string({ required_error: "Por favor selecciona una categoría." }),
  brand: z.string().optional(),
  unitOfMeasure: z.string().optional(),
  ribbon: z.string().optional(),
  hasAlcohol: z.boolean().default(false),
  alcoholGrade: z.coerce.number().min(0).max(100).optional(),
  hasPromotion: z.boolean().default(false),
  promotionPercentage: z.coerce.number().int().min(0).max(100).optional(),
  taxPercentage: z.coerce.number().min(0).max(100).optional(),
  image: z.any().optional(),
  aiHint: z.string().optional(),
  active: z.boolean().default(true),
  featured: z.boolean().default(false),
  internalOnly: z.boolean().default(false),
  isTestProduct: z.boolean().default(false),
  isBundle: z.boolean().default(false),
  bundleItems: z.array(bundleItemSchema).optional(),
}).refine(data => {
    if (data.hasAlcohol) {
        return data.alcoholGrade !== undefined && data.alcoholGrade !== null;
    }
    return true;
}, {
    message: "Debe seleccionar un grado alcohólico.",
    path: ["alcoholGrade"],
}).refine(data => {
    if (data.hasPromotion) {
        return data.promotionPercentage !== undefined && data.promotionPercentage !== null && data.promotionPercentage > 0;
    }
    return true;
}, {
    message: "Debe ingresar un porcentaje de promoción válido.",
    path: ["promotionPercentage"],
}).refine(data => {
    if (data.isBundle) {
        return data.bundleItems && data.bundleItems.length > 0;
    }
    return true;
}, {
    message: "Un combo debe tener al menos un producto.",
    path: ["bundleItems"],
});

const ribbonOptions = ["Ninguno", "Nuevo", "Edición Limitada", "Exclusivo", "Oferta"];

export function ProductForm({ product, onFinished }) {
    const { toast } = useToast()
    const { user } = useAuth();
    const [categories, setCategories] = useState([])
    const [units, setUnits] = useState([]);
    const [brands, setBrands] = useState([]);
    const [allProducts, setAllProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [imagePreview, setImagePreview] = useState(product?.image || null);
    const [categorySearchTerm, setCategorySearchTerm] = useState("");
    const [brandSearchTerm, setBrandSearchTerm] = useState("");
    const [bundleProductSearch, setBundleProductSearch] = useState('');
    
    const isEditing = !!product;

    const form = useForm({
        resolver: zodResolver(productFormSchema),
        defaultValues: isEditing ? { ...product } : {
            name: "",
            description: "",
            costPrice: 0,
            sellingPrice: 0,
            stock: 0,
            category: "",
            brand: "",
            unitOfMeasure: "",
            ribbon: "Ninguno",
            hasAlcohol: false,
            alcoholGrade: undefined,
            hasPromotion: false,
            promotionPercentage: undefined,
            taxPercentage: 13,
            image: undefined,
            aiHint: "",
            active: true,
            featured: false,
            internalOnly: false,
            isTestProduct: false,
            isBundle: false,
            bundleItems: [],
        }
    });
    
    const { fields: bundleItemsFields, append: appendBundleItem, remove: removeBundleItem } = useFieldArray({
        control: form.control,
        name: "bundleItems"
    });

    useEffect(() => {
        if (isEditing && product) {
            form.reset(cleanupUndefinedFields({
                ...product,
                ribbon: product.ribbon || "Ninguno",
                taxPercentage: product.taxPercentage ?? 13,
                isBundle: product.isBundle || false,
                isTestProduct: product.isTestProduct || false,
                bundleItems: product.bundleItems || [],
            }));
            setImagePreview(product.image || null);
        }
    }, [product, isEditing, form]);


    const hasAlcoholValue = form.watch('hasAlcohol');
    const hasPromotionValue = form.watch('hasPromotion');
    const imageValue = form.watch('image');
    const internalOnlyValue = form.watch('internalOnly');
    const isBundleValue = form.watch('isBundle');

    useEffect(() => {
        if (internalOnlyValue) {
            form.setValue('active', false);
        }
    }, [internalOnlyValue, form]);

    useEffect(() => {
        if (isBundleValue) {
            form.setValue('stock', undefined);
        }
    }, [isBundleValue, form]);
    
    useEffect(() => {
        setLoading(true);
        const qCategories = query(collection(db, 'categories'), where("active", "==", true));
        const qUnits = query(collection(db, 'unitsOfMeasure'), where("active", "==", true));
        const qBrands = query(collection(db, 'brands'), where("active", "==", true));
        const qProducts = query(collection(db, 'products'));

        const unsubCategories = onSnapshot(qCategories, (snapshot) => setCategories(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
        const unsubUnits = onSnapshot(qUnits, (snapshot) => setUnits(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
        const unsubBrands = onSnapshot(qBrands, (snapshot) => setBrands(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
        const unsubProducts = onSnapshot(qProducts, (snapshot) => setAllProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
        
        setLoading(false);

        return () => {
            unsubCategories();
            unsubUnits();
            unsubBrands();
            unsubProducts();
        };
    }, []);
    
    useEffect(() => {
        if (imageValue instanceof File) {
          const reader = new FileReader()
          reader.onloadend = () => setImagePreview(reader.result)
          reader.readAsDataURL(imageValue)
        } else if (typeof imageValue === 'string') {
          setImagePreview(imageValue)
        } else {
          setImagePreview(null)
        }
      }, [imageValue])
    
    async function onSubmit(data) {
        if (!user) {
            toast({ title: "Error de autenticación", description: "No se pudo identificar al usuario.", variant: "destructive" });
            return;
        }
        setSubmitting(true);
        
        // Clean bundleItems before saving, remove display-only fields
        const productToSave = { ...data };
        if (productToSave.isBundle && productToSave.bundleItems) {
            productToSave.bundleItems = productToSave.bundleItems.map(({ productId, quantity }) => ({ productId, quantity }));
        } else {
            delete productToSave.bundleItems;
        }


        try {
            if (isEditing && product.id) {
                await updateProduct(product.id, productToSave, user);
                 toast({ title: "¡Éxito!", description: "El producto se ha actualizado correctamente." })
            } else {
                 await addProduct(productToSave, user);
                toast({ title: "¡Éxito!", description: "El producto se ha añadido correctamente a tu catálogo."})
            }
            onFinished?.();
        } catch (error) {
            console.error("Error saving product:", error)
            toast({ title: "Error", description: "No se pudo guardar el producto. Por favor, inténtalo de nuevo.", variant: "destructive" })
        } finally {
            setSubmitting(false);
        }
    }
    
    const alcoholGrades = Array.from({ length: 101 }, (_, i) => i);
    
    const filteredCategories = categories.filter(category => category.name.toLowerCase().includes(categorySearchTerm.toLowerCase()));
    const filteredBrands = brands.filter(brand => brand.name.toLowerCase().includes(brandSearchTerm.toLowerCase()));
    const filteredBundleProducts = useMemo(() => {
        return allProducts.filter(p => p.name.toLowerCase().includes(bundleProductSearch.toLowerCase()) && p.isBundle !== true);
    }, [allProducts, bundleProductSearch]);

    const handleAddBundleItem = (productToAdd) => {
        appendBundleItem({ 
            productId: productToAdd.id, 
            quantity: 1, 
            name: productToAdd.name, 
            image: productToAdd.image 
        });
    }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        
        <FormField
            control={form.control}
            name="image"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Imagen del Producto</FormLabel>
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
                            className="group w-full h-96 border-2 border-dashed border-muted-foreground/50 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-primary transition-colors relative overflow-hidden"
                        >
                            {imagePreview ? (
                                <>
                                    <Image src={imagePreview} alt="Vista previa" fill className="object-contain" unoptimized />
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
                                            form.setValue('image', undefined);
                                            setImagePreview(null);
                                        }}
                                    >
                                        <X className="h-4 w-4" />
                                    </Button>
                                </>

                            ) : (
                                <div className="text-center text-muted-foreground">
                                    <Upload className="mx-auto h-12 w-12 mb-2"/>
                                    <p>Haz clic aquí para subir una imagen</p>
                                    <p className="text-xs">PNG, JPG, GIF hasta 10MB</p>
                                </div>
                            )}
                        </label>
                    </div>
                </FormControl>
                <FormMessage />
                </FormItem>
            )}
            />

        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nombre del Producto</FormLabel>
              <FormControl>
                <Input placeholder="Ron Centenario 25 Años" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Descripción</FormLabel>
              <FormControl>
                <Textarea placeholder="Un ron ultra premium de Costa Rica..." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <FormField
                control={form.control}
                name="costPrice"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Precio de Costo (CRC)</FormLabel>
                    <FormControl>
                        <Input
                            type="text"
                            placeholder="30,000.00"
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
            <FormField
                control={form.control}
                name="sellingPrice"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Precio de Venta (CRC)</FormLabel>
                    <FormControl>
                        <Input
                           type="text"
                           placeholder="45,000.00"
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
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <FormField
                control={form.control}
                name="stock"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Unidades en Stock</FormLabel>
                    <FormControl>
                         <Input 
                            type="number" 
                            placeholder="50" 
                            {...field} 
                            value={field.value ?? ''}
                            onChange={e => field.onChange(e.target.value === '' ? undefined : Math.max(0, parseInt(e.target.value, 10)))}
                            disabled={isBundleValue}
                         />
                    </FormControl>
                    <FormDescription>El stock de los combos se calcula automáticamente.</FormDescription>
                    <FormMessage />
                    </FormItem>
                )}
            />
            <FormField
              control={form.control}
              name="unitOfMeasure"
              render={({ field }) => (
                  <FormItem>
                  <FormLabel>Unidad de Medida</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || ''} disabled={loading}>
                      <FormControl>
                      <SelectTrigger>
                          <SelectValue placeholder={loading ? "Cargando..." : "Selecciona una unidad"} />
                      </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                          {units.map(unit => (
                            <SelectItem key={unit.id} value={unit.name}>
                                {unit.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                  </Select>
                  <FormMessage />
                  </FormItem>
              )}
            />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Categoría</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || ''} disabled={loading}>
                            <FormControl>
                                <SelectTrigger>
                                    <SelectValue placeholder={loading ? "Cargando..." : "Selecciona una categoría"} />
                                </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                <div className="p-2">
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            placeholder="Buscar categoría..."
                                            className="pl-9 h-9"
                                            value={categorySearchTerm}
                                            onChange={(e) => setCategorySearchTerm(e.target.value)}
                                        />
                                    </div>
                                </div>
                                {filteredCategories.map(category => (
                                    <SelectItem key={category.id} value={category.name}>
                                        {category.name}
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
                name="brand"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Marca</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || ''} disabled={loading}>
                            <FormControl>
                                <SelectTrigger>
                                    <SelectValue placeholder={loading ? "Cargando..." : "Selecciona una marca"} />
                                </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                <div className="p-2">
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            placeholder="Buscar marca..."
                                            className="pl-9 h-9"
                                            value={brandSearchTerm}
                                            onChange={(e) => setBrandSearchTerm(e.target.value)}
                                        />
                                    </div>
                                </div>
                                {filteredBrands.map(brand => (
                                    <SelectItem key={brand.id} value={brand.name}>
                                        {brand.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <FormMessage />
                    </FormItem>
                )}
            />
        </div>

        <FormField
            control={form.control}
            name="ribbon"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Listón</FormLabel>
                <Select onValueChange={field.onChange} value={field.value || 'Ninguno'}>
                    <FormControl>
                    <SelectTrigger>
                        <SelectValue placeholder="Selecciona un listón para el producto" />
                    </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                        {ribbonOptions.map((option, index) => (
                        <SelectItem key={`${option}-${index}`} value={option}>
                            {option}
                        </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <FormDescription>
                    Un listón especial para destacar el producto en la tienda.
                </FormDescription>
                <FormMessage />
                </FormItem>
            )}
        />


        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
            <div className="space-y-2">
                 <FormField
                    control={form.control}
                    name="hasAlcohol"
                    render={({ field }) => (
                        <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                            <FormControl>
                                <Checkbox
                                checked={field.value}
                                onCheckedChange={(checked) => {
                                    field.onChange(checked);
                                    if (!checked) {
                                        form.setValue('alcoholGrade', undefined, { shouldValidate: true });
                                    }
                                }}
                                />
                            </FormControl>
                            <FormLabel className="font-normal mb-0 mt-0!">¿Este producto tiene graduación alcohólica?</FormLabel>
                        </FormItem>
                    )}
                />
                 <FormField
                    control={form.control}
                    name="alcoholGrade"
                    render={({ field }) => (
                        <FormItem>
                        <FormControl>
                            <Input
                                type="number"
                                placeholder="40.5"
                                step="0.1"
                                {...field}
                                value={field.value ?? ''}
                                onChange={e => field.onChange(e.target.value === '' ? undefined : parseFloat(e.target.value))}
                                disabled={!hasAlcoholValue}
                            />
                        </FormControl>
                       
                        <FormMessage />
                        </FormItem>
                    )}
                />
            </div>
             <div className="space-y-2">
                <FormField
                    control={form.control}
                    name="taxPercentage"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Porcentaje de Impuesto</FormLabel>
                        <FormControl>
                            <div className="relative">
                                <Input
                                    type="number"
                                    placeholder="13"
                                    {...field}
                                    value={field.value ?? ''}
                                    className="pl-8"
                                    onChange={e => field.onChange(e.target.value === '' ? undefined : parseFloat(e.target.value))}
                                />
                                <Percent className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            </div>
                        </FormControl>
                        <FormDescription>
                            El porcentaje de impuesto aplicado a este producto (ej. 13 para 13%).
                        </FormDescription>
                        <FormMessage />
                        </FormItem>
                    )}
                />
            </div>
        </div>


        <div className="space-y-2">
            <FormField
                control={form.control}
                name="hasPromotion"
                render={({ field }) => (
                    <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                        <FormControl>
                            <Checkbox
                            checked={field.value}
                            onCheckedChange={(checked) => {
                                field.onChange(checked);
                                if (!checked) {
                                    form.setValue('promotionPercentage', undefined, { shouldValidate: true });
                                }
                            }}
                            />
                        </FormControl>
                        <FormLabel className="font-normal mb-0 mt-0!">¿Este producto tiene promoción?</FormLabel>
                    </FormItem>
                )}
            />
            <FormField
                control={form.control}
                name="promotionPercentage"
                render={({ field }) => (
                    <FormItem>
                    <FormControl>
                        <div className="relative">
                            <Input
                                type="number"
                                placeholder="15"
                                {...field}
                                value={field.value ?? ''}
                                disabled={!hasPromotionValue}
                                className="pl-8"
                                onChange={e => field.onChange(e.target.value === '' ? undefined : Math.max(0, parseInt(e.target.value, 10)))}
                            />
                            <Percent className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        </div>
                    </FormControl>
                    <FormDescription>
                        Si el producto está en promoción, ingresa el porcentaje de descuento.
                    </FormDescription>
                    <FormMessage />
                    </FormItem>
                )}
            />
        </div>

        <Separator />
        
        <div className="space-y-4">
             <FormField
                control={form.control}
                name="isBundle"
                render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-1">
                            <FormLabel className="text-base">¿Es un combo o paquete?</FormLabel>
                            <FormDescription>
                                Marca esta opción si este producto agrupa varios artículos. El stock se descontará de los artículos individuales.
                            </FormDescription>
                        </div>
                        <FormControl>
                            <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                            />
                        </FormControl>
                    </FormItem>
                )}
            />
             {isBundleValue && (
                <div className="p-4 border rounded-md space-y-4">
                    <h3 className="font-medium text-lg">Artículos del Combo</h3>
                    <div className="space-y-2">
                        {bundleItemsFields.map((item, index) => (
                           <div key={item.id} className="flex items-end gap-2 p-2 rounded-md bg-muted/50">
                               <Image src={item.image || "https://picsum.photos/100/100"} alt={item.name || 'Imagen de producto'} width={40} height={40} className="rounded aspect-square object-cover" unoptimized/>
                               <div className="flex-1">
                                   <p className="font-semibold">{item.name}</p>
                                    <FormField
                                        control={form.control}
                                        name={`bundleItems.${index}.quantity`}
                                        render={({ field }) => (
                                            <FormItem>
                                            <FormLabel className="text-xs">Cantidad</FormLabel>
                                            <FormControl>
                                                <Input type="number" {...field} className="h-8"/>
                                            </FormControl>
                                            <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                               </div>
                               <Button type="button" variant="ghost" size="icon" onClick={() => removeBundleItem(index)}>
                                    <Trash2 className="h-4 w-4 text-destructive" />
                               </Button>
                           </div>
                        ))}
                    </div>
                     {form.formState.errors.bundleItems && <p className="text-sm text-destructive">{form.formState.errors.bundleItems.message}</p>}

                    <div className="space-y-2">
                        <Label>Añadir producto al combo</Label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input 
                                placeholder="Buscar producto para añadir..." 
                                value={bundleProductSearch} 
                                onChange={e => setBundleProductSearch(e.target.value)}
                                className="pl-9"
                            />
                        </div>
                         {bundleProductSearch && (
                            <div className="max-h-48 overflow-y-auto border rounded-md">
                                {filteredBundleProducts.map(p => (
                                    <div key={p.id} className="p-2 hover:bg-accent flex items-center justify-between cursor-pointer" onClick={() => handleAddBundleItem(p)}>
                                        <div className="flex items-center gap-2">
                                            <Image src={p.image || "https://picsum.photos/100/100"} alt={p.name} width={32} height={32} className="rounded aspect-square object-cover" unoptimized/>
                                            <span>{p.name}</span>
                                        </div>
                                        <PlusCircle className="h-5 w-5 text-primary" />
                                    </div>
                                ))}
                                {filteredBundleProducts.length === 0 && <p className="p-2 text-sm text-muted-foreground">No se encontraron productos.</p>}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
        
        <Separator />


        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <FormField
                control={form.control}
                name="featured"
                render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                    <FormControl>
                        <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                        <FormLabel>¿Producto Destacado?</FormLabel>
                        <FormDescription>
                        Los productos destacados se mostrarán en la página principal.
                        </FormDescription>
                    </div>
                    </FormItem>
                )}
            />
             <FormField
                control={form.control}
                name="active"
                render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                    <FormControl>
                        <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            disabled={internalOnlyValue}
                        />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                        <FormLabel>¿Producto Activo?</FormLabel>
                        <FormDescription>
                         Los productos inactivos no se mostrarán en la tienda.
                        </FormDescription>
                    </div>
                    </FormItem>
                )}
            />
             <FormField
                control={form.control}
                name="internalOnly"
                render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                    <FormControl>
                        <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                        />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                        <FormLabel>¿Solo para uso interno?</FormLabel>
                        <FormDescription>
                         Márcalo si es un gasto operativo y no un producto para la venta.
                        </FormDescription>
                    </div>
                    </FormItem>
                )}
            />
             <FormField
                control={form.control}
                name="isTestProduct"
                render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 bg-amber-500/10">
                    <FormControl>
                        <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                        />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                        <FormLabel>¿Es un producto de prueba?</FormLabel>
                        <FormDescription>
                         Los productos de prueba solo son visibles para administradores.
                        </FormDescription>
                    </div>
                    </FormItem>
                )}
            />
        </div>
       

        <div className="flex items-center gap-4">
            <Button type="submit" disabled={submitting}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEditing ? 'Guardar Cambios' : 'Crear Producto'}
            </Button>
            <Button type="button" variant="outline" onClick={onFinished} disabled={submitting}>
                Cancelar
            </Button>
        </div>
      </form>
    </Form>
  )
}
