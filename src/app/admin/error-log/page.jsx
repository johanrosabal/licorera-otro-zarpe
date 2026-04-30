
'use client';

import React, { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, AlertTriangle, Code, Clock, Trash2 } from 'lucide-react';
import { AuthorizedOnly } from '@/components/auth/authorized-only';
import { format, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { collection, onSnapshot, query, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Badge } from '@/components/ui/badge';
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

export default function ErrorLogPage() {
    const [errors, setErrors] = useState([]);
    const [loading, setLoading] = useState(true);
    const [deletingError, setDeletingError] = useState(null);
    const { toast } = useToast();

    useEffect(() => {
        setLoading(true);
        const q = query(collection(db, 'appErrors'), orderBy('timestamp', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedErrors = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setErrors(fetchedErrors);
            setLoading(false);
        }, (error) => {
            console.error(error);
            toast({ title: "Error", description: "No se pudo cargar el registro de errores.", variant: "destructive" });
            setLoading(false);
        });
        return () => unsubscribe();
    }, [toast]);
    
    const handleDelete = async (id) => {
        if (!id) return;
        try {
            await deleteDoc(doc(db, 'appErrors', id));
            toast({ title: 'Éxito', description: 'Registro de error eliminado.' });
        } catch (error) {
             toast({ title: 'Error', description: 'No se pudo eliminar el registro.', variant: 'destructive' });
        } finally {
            setDeletingError(null);
        }
    };


    const renderEmptyState = () => (
        <div className="text-center py-16 text-muted-foreground">
            <AlertTriangle className="mx-auto h-16 w-16 mb-4 opacity-50" />
            <h3 className="text-xl font-semibold">¡Todo en orden!</h3>
            <p>No se han registrado errores en la aplicación.</p>
        </div>
    );

    const renderLoadingState = () => (
        <div className="flex justify-center items-center py-16">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
    );

    return (
        <AuthorizedOnly allowedRoles={['ADMIN']}>
             <AlertDialog open={!!deletingError} onOpenChange={(open) => !open && setDeletingError(null)}>
                <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                    <AlertDialogDescription>
                    Esta acción no se puede deshacer. Se eliminará permanentemente el registro de error.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setDeletingError(null)}>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={() => handleDelete(deletingError.id)}>Eliminar</AlertDialogAction>
                </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <div className="space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Log de Errores de la Aplicación</CardTitle>
                        <CardDescription>
                            Aquí se registran los errores inesperados que ocurren en la aplicación.
                        </CardDescription>
                    </CardHeader>
                </Card>

                {loading ? renderLoadingState() : (
                    errors.length > 0 ? (
                        <div className="space-y-4">
                            {errors.map(error => (
                                <Card key={error.id} className="border-destructive/50">
                                    <CardHeader>
                                        <div className="flex justify-between items-start">
                                            <div>
                                                 <CardTitle className="text-lg text-destructive flex items-center gap-2">
                                                    <AlertTriangle className="h-5 w-5" />
                                                    {error.message || 'Error Desconocido'}
                                                </CardTitle>
                                                <div className="text-xs text-muted-foreground mt-2 flex items-center gap-4">
                                                     <div className="flex items-center gap-2">
                                                        <Clock className="h-4 w-4" />
                                                        <span>
                                                            {error.timestamp ? `${format(error.timestamp.toDate(), "dd MMM yyyy, HH:mm:ss", { locale: es })} (${formatDistanceToNow(error.timestamp.toDate(), { locale: es, addSuffix: true })})` : 'N/A'}
                                                        </span>
                                                     </div>
                                                     {error.context && <Badge variant="secondary">{error.context}</Badge>}
                                                </div>
                                            </div>
                                            <Button variant="ghost" size="icon" onClick={() => setDeletingError(error)}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </CardHeader>
                                    <CardContent>
                                         <Accordion type="single" collapsible className="w-full">
                                            <AccordionItem value="stack">
                                                <AccordionTrigger>
                                                    <div className="flex items-center gap-2">
                                                        <Code className="h-4 w-4" />
                                                        Ver Stack Trace
                                                    </div>
                                                </AccordionTrigger>
                                                <AccordionContent>
                                                    <pre className="bg-muted/50 p-4 rounded-md text-xs overflow-x-auto">
                                                        <code>
                                                            {error.stack || 'No hay stack trace disponible.'}
                                                        </code>
                                                    </pre>
                                                </AccordionContent>
                                            </AccordionItem>
                                             {error.metadata && (
                                                <AccordionItem value="metadata">
                                                    <AccordionTrigger>
                                                        <div className="flex items-center gap-2">
                                                            <Code className="h-4 w-4" />
                                                            Ver Metadatos Adicionales
                                                        </div>
                                                    </AccordionTrigger>
                                                    <AccordionContent>
                                                        <pre className="bg-muted/50 p-4 rounded-md text-xs overflow-x-auto">
                                                            <code>
                                                                {JSON.stringify(error.metadata, null, 2)}
                                                            </code>
                                                        </pre>
                                                    </AccordionContent>
                                                </AccordionItem>
                                             )}
                                        </Accordion>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    ) : renderEmptyState()
                )}
            </div>
        </AuthorizedOnly>
    );
}
