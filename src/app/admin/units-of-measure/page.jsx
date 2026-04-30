
'use client'

import { useState, useEffect, FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { addUnitOfMeasure, deleteUnitOfMeasure, updateUnitOfMeasure } from '@/lib/unitsOfMeasure';
import { PlusCircle, Trash2, Loader2, Edit, Scaling } from 'lucide-react';
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


export default function AdminUnitsOfMeasurePage() {
  const [units, setUnits] = useState([]);
  const [newUnitName, setNewUnitName] = useState('');
  const [editingUnit, setEditingUnit] = useState(null);
  const [editingUnitName, setEditingUnitName] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();
  
  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, 'unitsOfMeasure'), orderBy('name'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
        setUnits(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        setLoading(false);
    }, (error) => {
        console.error("Error fetching units of measure:", error);
        toast({ title: "Error", description: "No se pudieron cargar las unidades de medida.", variant: "destructive" });
        setLoading(false);
    });

    return () => unsubscribe();
  }, [toast]);


  const handleAddUnit = async (e) => {
    e.preventDefault();
    if (!newUnitName.trim()) {
        toast({ title: "Error", description: "El nombre de la unidad no puede estar vacío.", variant: "destructive" });
        return;
    }
    setSubmitting(true);
    try {
      await addUnitOfMeasure(newUnitName);
      setNewUnitName('');
      toast({ title: "Éxito", description: "Unidad de medida añadida correctamente." });
      setIsAddDialogOpen(false);
    } catch (error) {
      toast({ title: "Error", description: "No se pudo añadir la unidad de medida.", variant: "destructive" });
    } finally {
        setSubmitting(false);
    }
  };

  const handleDeleteUnit = async (id) => {
    try {
      await deleteUnitOfMeasure(id);
      toast({ title: "Éxito", description: "Unidad de medida eliminada correctamente." });
    } catch (error) {
      toast({ title: "Error", description: "No se pudo eliminar la unidad de medida.", variant: "destructive" });
    }
  };

  const handleToggleActive = async (unit) => {
    try {
        await updateUnitOfMeasure(unit.id, { active: !unit.active });
        toast({ title: "Éxito", description: `Unidad ${unit.active ? 'desactivada' : 'activada'}.` });
    } catch (error) {
        toast({ title: "Error", description: "No se pudo actualizar el estado.", variant: "destructive" });
    }
  }

  const handleEditUnit = async (e) => {
    e.preventDefault();
    if (!editingUnit || !editingUnitName.trim()) return;

    try {
        await updateUnitOfMeasure(editingUnit.id, { name: editingUnitName });
        toast({ title: "Éxito", description: "Unidad de medida actualizada correctamente." });
        setIsEditDialogOpen(false);
        setEditingUnit(null);
    } catch (error) {
        toast({ title: "Error", description: "No se pudo actualizar la unidad de medida.", variant: "destructive" });
    }
  }
  
  const openEditDialog = (unit) => {
    setEditingUnit(unit);
    setEditingUnitName(unit.name);
    setIsEditDialogOpen(true);
  }

  return (
    <AuthorizedOnly allowedRoles={['ADMIN']}>
      <div className="w-full">
            <Card>
                <CardHeader>
                    <div className="flex justify-between items-start gap-4">
                        <div>
                            <CardTitle>Unidades de Medida</CardTitle>
                            <CardDescription>Gestiona las unidades de medida para tus productos (ej: Botella, Caja, Litro).</CardDescription>
                        </div>
                        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                            <DialogTrigger asChild>
                                <Button>
                                    <PlusCircle className="mr-2 h-4 w-4" />
                                    Añadir Unidad
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <form onSubmit={handleAddUnit}>
                                    <DialogHeader>
                                        <DialogTitle>Añadir Nueva Unidad</DialogTitle>
                                        <DialogDescription>
                                            Crea una nueva unidad de medida.
                                        </DialogDescription>
                                    </DialogHeader>
                                    <div className="py-4 space-y-2">
                                        <Label htmlFor="unitName">Nombre de la Unidad</Label>
                                        <Input
                                            id="unitName"
                                            value={newUnitName}
                                            onChange={(e) => setNewUnitName(e.target.value)}
                                            placeholder="Ej: Botella 750ml"
                                            disabled={submitting}
                                        />
                                    </div>
                                    <DialogFooter>
                                        <Button type="button" variant="secondary" onClick={() => setIsAddDialogOpen(false)}>Cancelar</Button>
                                        <Button type="submit" disabled={submitting}>
                                            {submitting ? <Loader2 className="animate-spin mr-2" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                                            Añadir Unidad
                                        </Button>
                                    </DialogFooter>
                                </form>
                            </DialogContent>
                        </Dialog>
                    </div>
                </CardHeader>
                <CardContent>
                    <Table>
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
                                <TableCell colSpan={3} className="text-center h-48">
                                    <Loader2 className="mx-auto animate-spin text-primary h-10 w-10" />
                                </TableCell>
                            </TableRow>
                        ) : units.length > 0 ? (
                            units.map((unit) => (
                            <TableRow key={unit.id}>
                                <TableCell className="font-medium">{unit.name}</TableCell>
                                <TableCell>
                                    <div className="flex items-center space-x-2">
                                        <Switch
                                            id={`active-switch-${unit.id}`}
                                            checked={unit.active}
                                            onCheckedChange={() => handleToggleActive(unit)}
                                        />
                                        <Label htmlFor={`active-switch-${unit.id}`}>{unit.active ? 'Activa' : 'Inactiva'}</Label>
                                    </div>
                                </TableCell>
                                <TableCell className="text-right">
                                  <Dialog open={isEditDialogOpen && editingUnit?.id === unit.id} onOpenChange={(isOpen) => {
                                        if (!isOpen) {
                                            setEditingUnit(null);
                                            setIsEditDialogOpen(false);
                                        } else {
                                          openEditDialog(unit)
                                        }
                                    }}>
                                    <DialogTrigger asChild>
                                        <Button variant="ghost" size="icon">
                                            <Edit className="h-4 w-4" />
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent>
                                    <form onSubmit={handleEditUnit}>
                                        <DialogHeader>
                                            <DialogTitle>Editar Unidad de Medida</DialogTitle>
                                            <DialogDescription>
                                                Cambia el nombre de la unidad de medida.
                                            </DialogDescription>
                                        </DialogHeader>
                                        <div className="py-4">
                                            <Label htmlFor="edit-unit-name">Nombre</Label>
                                            <Input id="edit-unit-name" value={editingUnitName} onChange={(e) => setEditingUnitName(e.target.value)} />
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
                                          Esta acción no se puede deshacer. Esto eliminará permanentemente la unidad de medida.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => handleDeleteUnit(unit.id)}>Eliminar</AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                </TableCell>
                            </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={3} className="text-center text-muted-foreground h-48">
                                    No hay unidades de medida.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                    </Table>
                </CardContent>
            </Card>
      </div>
    </AuthorizedOnly>
  );
}
