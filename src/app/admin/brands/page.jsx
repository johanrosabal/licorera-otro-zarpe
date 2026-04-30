
'use client'

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { getBrands, addBrand, deleteBrand, updateBrand } from '@/lib/brands';
import { PlusCircle, Trash2, Loader2, Edit, Bookmark, Search } from 'lucide-react';
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
import { onSnapshot, query, collection, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export default function AdminBrandsPage() {
  const [brands, setBrands] = useState([]);
  const [newBrandName, setNewBrandName] = useState('');
  const [editingBrand, setEditingBrand] = useState(null);
  const [editingBrandName, setEditingBrandName] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    const q = query(collection(db, 'brands'), orderBy('name'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedBrands = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setBrands(fetchedBrands);
      setLoading(false);
    }, (error) => {
      toast({ title: "Error", description: "No se pudieron cargar las marcas.", variant: "destructive" });
      setLoading(false);
    });

    return () => unsubscribe();
  }, [toast]);
  
  const filteredBrands = useMemo(() => {
    if (!searchTerm) {
        return brands;
    }
    return brands.filter(brand =>
        brand.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [brands, searchTerm]);


  const handleAddBrand = async (e) => {
    e.preventDefault();
    if (!newBrandName.trim()) {
        toast({ title: "Error", description: "El nombre de la marca no puede estar vacío.", variant: "destructive" });
        return;
    }
    setSubmitting(true);
    try {
      await addBrand(newBrandName);
      setNewBrandName('');
      toast({ title: "Éxito", description: "Marca añadida correctamente." });
      setIsAddDialogOpen(false);
    } catch (error) {
      toast({ title: "Error", description: "No se pudo añadir la marca.", variant: "destructive" });
    } finally {
        setSubmitting(false);
    }
  };

  const handleDeleteBrand = async (id) => {
    try {
      await deleteBrand(id);
      toast({ title: "Éxito", description: "Marca eliminada correctamente." });
    } catch (error) {
      toast({ title: "Error", description: "No se pudo eliminar la marca.", variant: "destructive" });
    }
  };

  const handleToggleActive = async (brand) => {
    try {
        await updateBrand(brand.id, { active: !brand.active });
        toast({ title: "Éxito", description: `Marca ${brand.active ? 'desactivada' : 'activada'}.` });
    } catch (error) {
        toast({ title: "Error", description: "No se pudo actualizar el estado.", variant: "destructive" });
    }
  }

  const handleEditBrand = async (e) => {
    e.preventDefault();
    if (!editingBrand || !editingBrandName.trim()) return;

    try {
        await updateBrand(editingBrand.id, { name: editingBrandName });
        toast({ title: "Éxito", description: "Marca actualizada correctamente." });
        setIsEditDialogOpen(false);
        setEditingBrand(null);
    } catch (error) {
        toast({ title: "Error", description: "No se pudo actualizar la marca.", variant: "destructive" });
    }
  }
  
  const openEditDialog = (brand) => {
    setEditingBrand(brand);
    setEditingBrandName(brand.name);
    setIsEditDialogOpen(true);
  }

  return (
    <AuthorizedOnly allowedRoles={['ADMIN']}>
      <div className="w-full">
            <Card>
                <CardHeader>
                    <div className="flex justify-between items-start gap-4">
                        <div>
                            <CardTitle>Marcas de Productos</CardTitle>
                            <CardDescription>Edita, activa/desactiva y elimina las marcas de tu tienda.</CardDescription>
                        </div>
                         <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                            <DialogTrigger asChild>
                                <Button>
                                    <PlusCircle className="mr-2 h-4 w-4" />
                                    Añadir Marca
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <form onSubmit={handleAddBrand}>
                                    <DialogHeader>
                                        <DialogTitle>Añadir Nueva Marca</DialogTitle>
                                        <DialogDescription>
                                        Crea una nueva marca para tus productos.
                                        </DialogDescription>
                                    </DialogHeader>
                                    <div className="py-4 space-y-2">
                                        <Label htmlFor="brandName">Nombre de la Marca</Label>
                                        <Input
                                            id="brandName"
                                            value={newBrandName}
                                            onChange={(e) => setNewBrandName(e.target.value)}
                                            placeholder="Ej: Centenario"
                                            disabled={submitting}
                                        />
                                    </div>
                                    <DialogFooter>
                                        <Button type="button" variant="secondary" onClick={() => setIsAddDialogOpen(false)}>Cancelar</Button>
                                        <Button type="submit" disabled={submitting}>
                                            {submitting ? <Loader2 className="animate-spin mr-2" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                                            Añadir Marca
                                        </Button>
                                    </DialogFooter>
                                </form>
                            </DialogContent>
                        </Dialog>
                    </div>
                    <div className="relative mt-4">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                        <Input
                            placeholder="Buscar marca..."
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
                            <TableHead>Nombre</TableHead>
                            <TableHead>Estado</TableHead>
                            <TableHead className="text-right">Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={3} className="text-center">
                                        <Loader2 className="mx-auto animate-spin" />
                                    </TableCell>
                                </TableRow>
                            ) : filteredBrands.length > 0 ? (
                                filteredBrands.map((brand) => (
                                <TableRow key={brand.id}>
                                    <TableCell className="font-medium">{brand.name}</TableCell>
                                    <TableCell>
                                        <div className="flex items-center space-x-2">
                                            <Switch
                                                id={`active-switch-desktop-${brand.id}`}
                                                checked={brand.active}
                                                onCheckedChange={() => handleToggleActive(brand)}
                                            />
                                            <Label htmlFor={`active-switch-desktop-${brand.id}`}>{brand.active ? 'Activa' : 'Inactiva'}</Label>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right">
                                    <Dialog open={isEditDialogOpen && editingBrand?.id === brand.id} onOpenChange={(isOpen) => {
                                            if (!isOpen) {
                                                setEditingBrand(null);
                                                setIsEditDialogOpen(false);
                                            } else {
                                                openEditDialog(brand);
                                            }
                                        }}>
                                        <DialogTrigger asChild>
                                            <Button variant="ghost" size="icon">
                                                <Edit className="h-4 w-4" />
                                            </Button>
                                        </DialogTrigger>
                                        <DialogContent>
                                        <form onSubmit={handleEditBrand}>
                                            <DialogHeader>
                                                <DialogTitle>Editar Marca</DialogTitle>
                                                <DialogDescription>
                                                    Cambia el nombre de la marca.
                                                </DialogDescription>
                                            </DialogHeader>
                                            <div className="py-4">
                                                <Label htmlFor="edit-brand-name">Nombre</Label>
                                                <Input id="edit-brand-name" value={editingBrandName} onChange={(e) => setEditingBrandName(e.target.value)} />
                                            </div>
                                            <DialogFooter>
                                                <Button type="button" variant="secondary" onClick={() => setIsEditDialogOpen(false)}>Cancelar</Button>
                                                <Button type="submit">Guardar Cambios</Button>
                                            </DialogFooter>
                                        </form>
                                    </DialogContent>
                                    </Dialog>
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
                                            Esta acción no se puede deshacer. Esto eliminará permanentemente la marca.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                            <AlertDialogAction onClick={() => handleDeleteBrand(brand.id)}>Eliminar</AlertDialogAction>
                                        </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                    </TableCell>
                                </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={3} className="text-center text-muted-foreground">
                                        {searchTerm ? `No se encontraron marcas para "${searchTerm}".` : 'No hay marcas.'}
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                    
                    {/* Mobile Card View */}
                    <div className="space-y-4 md:hidden">
                        {loading ? (
                             <div className="text-center h-48 flex justify-center items-center">
                                <Loader2 className="mx-auto animate-spin" />
                            </div>
                        ) : filteredBrands.length > 0 ? (
                           filteredBrands.map(brand => (
                               <Card key={brand.id} className="p-4 flex justify-between items-center">
                                   <p className="font-medium">{brand.name}</p>
                                   <div className="flex items-center gap-2">
                                       <Switch
                                            id={`active-switch-mobile-${brand.id}`}
                                            checked={brand.active}
                                            onCheckedChange={() => handleToggleActive(brand)}
                                        />
                                        <Button variant="ghost" size="icon" onClick={() => openEditDialog(brand)}>
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
                                                Esta acción no se puede deshacer. Esto eliminará permanentemente la marca.
                                                </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                <AlertDialogAction onClick={() => handleDeleteBrand(brand.id)}>Eliminar</AlertDialogAction>
                                            </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                   </div>
                               </Card>
                           ))
                        ) : (
                            <div className="text-center text-muted-foreground h-48 flex flex-col justify-center items-center">
                                <Bookmark className="h-10 w-10 mb-4 text-muted-foreground/50" />
                                <p>{searchTerm ? `No se encontraron marcas para "${searchTerm}".` : 'No hay marcas.'}</p>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    </AuthorizedOnly>
  );
}
