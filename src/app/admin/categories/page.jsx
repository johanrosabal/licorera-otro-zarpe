

'use client'

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { addCategory, deleteCategory, updateCategory } from '@/lib/categories';
import { PlusCircle, Trash2, Loader2, Edit, Search, Upload, X, Tag, Download } from 'lucide-react';
import { exportToJSON, importFromJSON } from '@/lib/data-utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
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
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Image from 'next/image';

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState([]);
  const [editingCategory, setEditingCategory] = useState(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, 'categories'), orderBy('name'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
        setCategories(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        setLoading(false);
    }, (error) => {
        console.error("Error fetching categories:", error);
        toast({ title: "Error", description: "No se pudieron cargar las categorías.", variant: "destructive" });
        setLoading(false);
    });

    return () => unsubscribe();
  }, [toast]);
  
  const filteredCategories = useMemo(() => {
    if (!searchTerm) {
        return categories;
    }
    return categories.filter(category =>
        category.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [categories, searchTerm]);

  const handleDeleteCategory = async (id) => {
    try {
      await deleteCategory(id);
      toast({ title: "Éxito", description: "Categoría eliminada correctamente." });
    } catch (error) {
      toast({ title: "Error", description: "No se pudo eliminar la categoría.", variant: "destructive" });
    }
  };

  const handleToggleActive = async (category) => {
    try {
        await updateCategory(category.id, { name: category.name, active: !category.active });
        toast({ title: "Éxito", description: `Categoría ${category.active ? 'desactivada' : 'activada'}.` });
    } catch (error) {
        toast({ title: "Error", description: "No se pudo actualizar el estado.", variant: "destructive" });
    }
  }
  
  const handleExport = () => {
    exportToJSON(categories, 'categorias');
    toast({ title: "Éxito", description: "Datos exportados correctamente." });
  };

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
        const data = await importFromJSON(file);
        if (!Array.isArray(data)) throw new Error("El formato del archivo debe ser un array de objetos.");
        
        setLoading(true);
        let importedCount = 0;
        
        for (const item of data) {
            // Basic validation
            if (!item.name) continue;
            
            // Clean data for Firestore (remove ID if we want to create new ones, or keep it if we want to sync)
            const { id, ...cleanItem } = item;
            
            // Default active if not present
            if (cleanItem.active === undefined) cleanItem.active = true;
            
            await addCategory(cleanItem);
            importedCount++;
        }
        
        toast({ title: "Importación completa", description: `Se han importado ${importedCount} categorías.` });
    } catch (error) {
        toast({ title: "Error de importación", description: error.message, variant: "destructive" });
    } finally {
        setLoading(false);
        // Reset input
        e.target.value = '';
    }
  };

  const openEditDialog = (category) => {
    setEditingCategory(category);
    setIsEditDialogOpen(true);
  }

  const CategoryForm = ({ category, onFinished }) => {
    const [name, setName] = useState(category ? category.name : '');
    const [image, setImage] = useState(null);
    const [imagePreview, setImagePreview] = useState(category ? category.imageUrl : null);
    
    useEffect(() => {
        if (image instanceof File) {
          const reader = new FileReader()
          reader.onloadend = () => {
            setImagePreview(reader.result)
          }
          reader.readAsDataURL(image)
        } else if(image === null) {
          setImagePreview(null);
        } else if (category?.imageUrl) {
          setImagePreview(category.imageUrl);
        }
      }, [image, category])

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!name.trim()) {
            toast({ title: "Error", description: "El nombre no puede estar vacío.", variant: "destructive" });
            return;
        }
        setSubmitting(true);
        try {
            const data = { name };
            if (image) {
                data.image = image;
            } else if (image === null) {
                data.image = null;
            }

            if (category) {
                await updateCategory(category.id, data);
                toast({ title: "Éxito", description: "Categoría actualizada." });
            } else {
                await addCategory(data);
                toast({ title: "Éxito", description: "Categoría añadida." });
            }
            onFinished(true);
        } catch(error) {
            toast({ title: "Error", description: "No se pudo guardar la categoría.", variant: "destructive" });
            console.error(error);
            onFinished(false);
        } finally {
            setSubmitting(false);
        }
    };
    
    return (
        <form onSubmit={handleSubmit}>
            <DialogHeader>
                <DialogTitle>{category ? 'Editar' : 'Añadir Nueva'} Categoría</DialogTitle>
            </DialogHeader>
            <div className="py-4 space-y-4">
                 <div className="space-y-2">
                    <Label htmlFor="image-upload">Imagen de la Categoría</Label>
                    <Input
                        type="file"
                        className="hidden"
                        id="image-upload"
                        accept="image/*"
                        onChange={(e) => setImage(e.target.files ? e.target.files[0] : null)}
                        disabled={submitting}
                    />
                    <label htmlFor="image-upload" className="group w-full h-48 border-2 border-dashed rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-primary relative overflow-hidden bg-muted/20">
                         {imagePreview ? (
                            <>
                                <Image src={imagePreview} alt="Vista previa" fill className="object-cover" unoptimized/>
                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <p className="text-white">Cambiar imagen</p>
                                </div>
                                <Button 
                                    type="button" 
                                    variant="destructive" 
                                    size="icon" 
                                    className="absolute top-2 right-2 z-10 h-6 w-6"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        setImage(null);
                                        const input = document.getElementById('image-upload');
                                        if(input) input.value = '';
                                    }}
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            </>
                        ) : (
                            <div className="text-center text-muted-foreground">
                                <Upload className="mx-auto h-10 w-10 mb-2"/>
                                <p>Haz clic para subir una imagen</p>
                            </div>
                        )}
                    </label>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="categoryName">Nombre</Label>
                    <Input
                        id="categoryName"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Ej: Vino Tinto"
                        disabled={submitting}
                    />
                </div>
            </div>
            <DialogFooter>
                <Button type="button" variant="secondary" onClick={() => onFinished(false)}>Cancelar</Button>
                <Button type="submit" disabled={submitting}>
                    {submitting ? <Loader2 className="animate-spin mr-2" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                    Guardar
                </Button>
            </DialogFooter>
        </form>
    );
  }

  return (
    <AuthorizedOnly allowedRoles={['ADMIN']}>
      <div className="w-full">
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogContent>
                <CategoryForm onFinished={() => setIsAddDialogOpen(false)} />
            </DialogContent>
        </Dialog>
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
            <DialogContent>
                <CategoryForm category={editingCategory} onFinished={() => setIsEditDialogOpen(false)} />
            </DialogContent>
        </Dialog>

        <Card>
            <CardHeader>
                <div className="flex justify-between items-start gap-4">
                  <div>
                    <CardTitle>Categorías Existentes</CardTitle>
                    <CardDescription>Edita, activa/desactiva y elimina las categorías de tu tienda.</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={handleExport}>
                        <Download className="mr-2 h-4 w-4" />
                        Exportar
                    </Button>
                    <div className="relative">
                        <Input 
                            type="file" 
                            id="import-categories" 
                            className="hidden" 
                            accept=".json" 
                            onChange={handleImport}
                        />
                        <Button variant="outline" size="sm" asChild>
                            <label htmlFor="import-categories" className="cursor-pointer">
                                <Upload className="mr-2 h-4 w-4" />
                                Importar
                            </label>
                        </Button>
                    </div>
                    <Button onClick={() => setIsAddDialogOpen(true)} size="sm">
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Añadir
                    </Button>
                  </div>
                </div>
                <div className="relative mt-4">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input
                        placeholder="Buscar categoría..."
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
                        <TableHead>Imagen</TableHead>
                        <TableHead>Nombre</TableHead>
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
                        ) : filteredCategories.length > 0 ? (
                            filteredCategories.map((category) => (
                            <TableRow key={category.id}>
                                <TableCell>
                                    {category.imageUrl ? (
                                        <Image src={category.imageUrl} alt={category.name} width={40} height={40} className="rounded-md object-cover" unoptimized/>
                                    ) : (
                                        <div className="w-10 h-10 bg-muted rounded-md" />
                                    )}
                                </TableCell>
                                <TableCell className="font-medium">{category.name}</TableCell>
                                <TableCell>
                                    <div className="flex items-center space-x-2">
                                        <Switch
                                            id={`active-switch-desktop-${category.id}`}
                                            checked={category.active}
                                            onCheckedChange={() => handleToggleActive(category)}
                                        />
                                        <Label htmlFor={`active-switch-desktop-${category.id}`}>{category.active ? 'Activa' : 'Inactiva'}</Label>
                                    </div>
                                </TableCell>
                                <TableCell className="text-right">
                                    <Button variant="ghost" size="icon" onClick={() => openEditDialog(category)}>
                                        <Edit className="h-4 w-4" />
                                    </Button>
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="icon">
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                        Esta acción no se puede deshacer. Esto eliminará permanentemente la categoría.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => handleDeleteCategory(category.id)}>Eliminar</AlertDialogAction>
                                    </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                                </TableCell>
                            </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={4} className="text-center text-muted-foreground h-48">
                                    {searchTerm ? `No se encontraron categorías para "${searchTerm}".` : 'No hay categorías.'}
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>

                {/* Mobile Card View */}
                <div className="space-y-4 md:hidden">
                    {loading ? (
                         <div className="text-center h-48 flex justify-center items-center">
                            <Loader2 className="mx-auto animate-spin text-primary h-10 w-10" />
                        </div>
                    ) : filteredCategories.length > 0 ? (
                        filteredCategories.map(category => (
                            <Card key={category.id} className="p-4 flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                     {category.imageUrl ? (
                                        <Image src={category.imageUrl} alt={category.name} width={48} height={48} className="rounded-md object-cover" unoptimized/>
                                    ) : (
                                        <div className="w-12 h-12 bg-muted rounded-md" />
                                    )}
                                    <span className="font-medium">{category.name}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Switch
                                        id={`active-switch-mobile-${category.id}`}
                                        checked={category.active}
                                        onCheckedChange={() => handleToggleActive(category)}
                                    />
                                    <Button variant="ghost" size="icon" onClick={() => openEditDialog(category)}>
                                        <Edit className="h-4 w-4" />
                                    </Button>
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                        <Button variant="ghost" size="icon">
                                            <Trash2 className="h-4 w-4 text-destructive" />
                                        </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                                                <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                <AlertDialogAction onClick={() => handleDeleteCategory(category.id)}>Eliminar</AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                </div>
                            </Card>
                        ))
                    ) : (
                         <div className="text-center text-muted-foreground h-48 flex flex-col justify-center items-center">
                            <Tag className="h-10 w-10 mb-4 text-muted-foreground/50" />
                            <p>{searchTerm ? `No se encontraron categorías para "${searchTerm}".` : 'No hay categorías.'}</p>
                         </div>
                    )}
                </div>
            </CardContent>
        </Card>
      </div>
    </AuthorizedOnly>
  );
}
