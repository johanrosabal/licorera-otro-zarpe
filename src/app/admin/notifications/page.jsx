
'use client'

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { getNotifications, addNotification, updateNotification, deleteNotification } from '@/lib/notifications';
import { PlusCircle, Trash2, Loader2, Edit, MoreVertical, Megaphone, Info, Calendar as CalendarIcon } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { AuthorizedOnly } from '@/components/auth/authorized-only';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { InternalNotificationBanner } from '@/components/admin/internal-notification-banner';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from '@/lib/utils';

const notificationSchema = z.object({
  title: z.string().min(5, 'El título debe tener al menos 5 caracteres.'),
  message: z.string().min(10, 'El mensaje debe tener al menos 10 caracteres.'),
  type: z.enum(['Public', 'Internal'], { required_error: 'Debes seleccionar un tipo de notificación.' }),
  active: z.boolean().default(true),
  startDate: z.date().optional().nullable(),
  endDate: z.date().optional().nullable(),
}).refine(data => !data.endDate || !data.startDate || data.endDate > data.startDate, {
    message: "La fecha de fin debe ser posterior a la fecha de inicio.",
    path: ["endDate"],
});

function DateTimePicker({ value, onChange }) {
    // Note: No more useEffect here to avoid infinite loops
    const dateValue = value ? new Date(value) : null;
    
    const handleDateChange = (selectedDate) => {
        if (!selectedDate) {
            onChange(null);
            return;
        }
        const newDate = new Date(selectedDate);
        if (dateValue) {
            newDate.setHours(dateValue.getHours(), dateValue.getMinutes(), 0, 0);
        } else {
            newDate.setHours(0, 0, 0, 0);
        }
        onChange(newDate);
    };
    
    const handleTimeChange = (e) => {
        if (!dateValue) return;
        const [hours, minutes] = e.target.value.split(':').map(Number);
        const newDate = new Date(dateValue);
        newDate.setHours(hours, minutes, 0, 0);
        onChange(newDate);
    };

    return (
      <div className="space-y-2">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant={"outline"}
              className={cn(
                "w-full justify-start text-left font-normal",
                !dateValue && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dateValue ? format(dateValue, "PPP", { locale: es }) : <span>Selecciona fecha</span>}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={dateValue}
              onSelect={handleDateChange}
              initialFocus
            />
          </PopoverContent>
        </Popover>
        <Input
          type="time"
          value={dateValue ? format(dateValue, 'HH:mm') : ''}
          onChange={handleTimeChange}
          disabled={!dateValue}
          className="w-full"
        />
      </div>
    );
}

function NotificationForm({ notification, onFinished }) {
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();
  
  const form = useForm({
    resolver: zodResolver(notificationSchema),
    defaultValues: {
      title: notification?.title || '',
      message: notification?.message || '',
      type: notification?.type || 'Public',
      active: notification?.active ?? true,
      startDate: notification?.startDate ? (notification.startDate.toDate ? notification.startDate.toDate() : notification.startDate) : null,
      endDate: notification?.endDate ? (notification.endDate.toDate ? notification.endDate.toDate() : notification.endDate) : null,
    },
  });

  const onSubmit = async (data) => {
    setSubmitting(true);
    try {
      if (notification) {
        await updateNotification(notification.id, data);
        toast({ title: "Éxito", description: "Notificación actualizada correctamente." });
      } else {
        await addNotification(data);
        toast({ title: "Éxito", description: "Notificación creada correctamente." });
      }
      onFinished?.(true);
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "No se pudo guardar la notificación.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <DialogHeader>
          <DialogTitle>{notification ? 'Editar Notificación' : 'Crear Nueva Notificación'}</DialogTitle>
          <DialogDescription>
            Configura el mensaje y el periodo de visibilidad.
          </DialogDescription>
        </DialogHeader>
        
        <FormField control={form.control} name="title" render={({ field }) => (
          <FormItem>
            <FormLabel>Título</FormLabel>
            <FormControl><Input placeholder="Ej: ¡Oferta de Verano!" {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />

        <FormField control={form.control} name="message" render={({ field }) => (
          <FormItem>
            <FormLabel>Mensaje</FormLabel>
            <FormControl><Textarea placeholder="Describe el anuncio..." {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />

         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                    <FormItem className="flex flex-col">
                        <FormLabel>Fecha y Hora de Inicio (Opcional)</FormLabel>
                        <DateTimePicker value={field.value} onChange={field.onChange} />
                        <FormMessage />
                    </FormItem>
                )}
            />
            <FormField
                control={form.control}
                name="endDate"
                render={({ field }) => (
                    <FormItem className="flex flex-col">
                        <FormLabel>Fecha y Hora de Fin (Opcional)</FormLabel>
                        <DateTimePicker value={field.value} onChange={field.onChange} />
                        <FormMessage />
                    </FormItem>
                )}
            />
        </div>

        <div className="grid grid-cols-2 gap-4">
            <FormField control={form.control} name="type" render={({ field }) => (
              <FormItem>
                <FormLabel>Tipo</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value="Public">Pública</SelectItem>
                    <SelectItem value="Internal">Interna</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="active" render={({ field }) => (
              <FormItem className="flex flex-col justify-end">
                <div className="flex flex-row items-center justify-between rounded-lg border p-4 h-10">
                  <FormLabel className="text-base mb-0">Activa</FormLabel>
                  <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                </div>
              </FormItem>
            )} />
        </div>

        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => onFinished?.(false)}>Cancelar</Button>
          <Button type="submit" disabled={submitting}>
            {submitting && <Loader2 className="animate-spin mr-2 h-4 w-4" />}
            {notification ? 'Guardar Cambios' : 'Crear Notificación'}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  )
}

export default function AdminNotificationsPage() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingNotification, setEditingNotification] = useState(null);
  const [deletingNotification, setDeletingNotification] = useState(null);
  const { toast } = useToast();

  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, 'notifications'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setNotifications(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (error) => {
      console.error(error);
      toast({ title: "Error", description: "No se pudieron cargar las notificaciones.", variant: "destructive" });
      setLoading(false);
    });

    return () => unsubscribe();
  }, [toast]);

  const handleToggleActive = async (notification) => {
    try {
        await updateNotification(notification.id, { active: !notification.active });
        toast({ title: "Éxito", description: `Notificación ${notification.active ? 'desactivada' : 'activada'}.` });
    } catch (error) {
        toast({ title: "Error", description: "No se pudo actualizar el estado.", variant: "destructive" });
    }
  }

  const handleDelete = async (id) => {
    try {
      await deleteNotification(id);
      toast({ title: "Éxito", description: "Notificación eliminada correctamente." });
    } catch (error) {
      toast({ title: "Error", description: "No se pudo eliminar la notificación.", variant: "destructive" });
    } finally {
      setDeletingNotification(null);
    }
  }
  
  const handleFormFinished = (success) => {
    setIsFormOpen(false);
    setEditingNotification(null);
  }

  const openFormModal = (notification = null) => {
    setEditingNotification(notification);
    setIsFormOpen(true);
  }

  return (
    <AuthorizedOnly allowedRoles={['ADMIN']}>
        <InternalNotificationBanner />
        <Dialog open={isFormOpen} onOpenChange={(isOpen) => {
            if (!isOpen) {
                setEditingNotification(null);
                setIsFormOpen(false);
            } else {
                setIsFormOpen(isOpen);
            }
        }}>
            <DialogContent className="sm:max-w-3xl">
                <NotificationForm notification={editingNotification} onFinished={handleFormFinished} />
            </DialogContent>
        </Dialog>
      
      <AlertDialog open={!!deletingNotification} onOpenChange={(open) => !open && setDeletingNotification(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará permanentemente la notificación.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeletingNotification(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => handleDelete(deletingNotification.id)}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Card>
          <CardHeader>
            <div className="flex justify-between items-start gap-4">
              <div>
                <CardTitle>Gestión de Notificaciones</CardTitle>
                <CardDescription>Crea anuncios programados para clientes y personal.</CardDescription>
              </div>
              <Button onClick={() => openFormModal()}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Crear Notificación
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Table className="hidden md:table">
              <TableHeader>
                <TableRow>
                  <TableHead>Título</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Desde</TableHead>
                  <TableHead>Hasta</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center h-48">
                      <Loader2 className="mx-auto animate-spin text-primary h-10 w-10" />
                    </TableCell>
                  </TableRow>
                ) : notifications.length > 0 ? (
                  notifications.map((notification) => (
                    <TableRow key={notification.id}>
                      <TableCell className="font-medium">{notification.title}</TableCell>
                      <TableCell><Badge variant={notification.type === 'Public' ? 'default' : 'secondary'}>{notification.type}</Badge></TableCell>
                       <TableCell className="text-xs">{notification.startDate ? format(notification.startDate.toDate ? notification.startDate.toDate() : notification.startDate, "dd MMM, HH:mm", { locale: es }) : '-'}</TableCell>
                      <TableCell className="text-xs">{notification.endDate ? format(notification.endDate.toDate ? notification.endDate.toDate() : notification.endDate, "dd MMM, HH:mm", { locale: es }) : '-'}</TableCell>
                      <TableCell>
                        <Switch
                            checked={notification.active}
                            onCheckedChange={() => handleToggleActive(notification)}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openFormModal(notification)}>
                                <Edit className="mr-2 h-4 w-4" />
                                <span>Editar</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => setDeletingNotification(notification)} className="text-destructive">
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
                    <TableCell colSpan={6} className="text-center text-muted-foreground h-48">
                      No hay notificaciones creadas.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            
            <div className="space-y-4 md:hidden">
                {notifications.map(notification => (
                    <Card key={notification.id}>
                        <CardHeader className="p-4">
                            <div className="flex justify-between items-start">
                                <div>
                                    <CardTitle className="text-base">{notification.title}</CardTitle>
                                    <Badge variant={notification.type === 'Public' ? 'default' : 'secondary'}>{notification.type}</Badge>
                                </div>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon">
                                            <MoreVertical className="h-4 w-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuItem onClick={() => openFormModal(notification)}>
                                            <Edit className="mr-2 h-4 w-4" /><span>Editar</span>
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onSelect={() => setDeletingNotification(notification)} className="text-destructive">
                                            <Trash2 className="mr-2 h-4 w-4" /><span>Eliminar</span>
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        </CardHeader>
                        <CardContent className="p-4 pt-0 text-sm space-y-2">
                            <p className="text-muted-foreground line-clamp-2">{notification.message}</p>
                            <div className="text-xs text-muted-foreground border-t pt-2 mt-2 space-y-1">
                                <p>{notification.startDate ? `Desde: ${format(notification.startDate.toDate ? notification.startDate.toDate() : notification.startDate, "dd MMM, HH:mm", { locale: es })}` : ''}</p>
                                <p>{notification.endDate ? `Hasta: ${format(notification.endDate.toDate ? notification.endDate.toDate() : notification.endDate, "dd MMM, HH:mm", { locale: es })}` : ''}</p>
                            </div>
                            <div className="flex items-center justify-between mt-2">
                                <span className="text-xs">{notification.active ? "Activa" : "Inactiva"}</span>
                                <Switch checked={notification.active} onCheckedChange={() => handleToggleActive(notification)} />
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
          </CardContent>
      </Card>
    </AuthorizedOnly>
  );
}
