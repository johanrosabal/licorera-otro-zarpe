
'use client'

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { getUsers, updateUserProfile } from '@/lib/users-service';
import { Loader2, MoreHorizontal, Search, Check, Shield, User, Truck, Edit } from 'lucide-react';
import { AuthorizedOnly } from '@/components/auth/authorized-only';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuPortal,
  DropdownMenuSubContent
} from "@/components/ui/dropdown-menu";
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const ROLES = ['ADMIN', 'DELIVERY', 'CLIENT'];

const roleConfig = {
    ADMIN: { icon: Shield, color: 'bg-destructive text-destructive-foreground' },
    DELIVERY: { icon: Truck, color: 'bg-blue-500/20 text-blue-700' },
    CLIENT: { icon: User, color: 'bg-muted text-muted-foreground' }
};

const userSchema = z.object({
  name: z.string().min(3, 'El nombre debe tener al menos 3 caracteres.'),
  role: z.enum(ROLES, { required_error: 'Debes seleccionar un rol.' }),
});

function RoleBadge({ role }) {
    const config = roleConfig[role] || roleConfig.CLIENT;
    const Icon = config.icon;
    return (
        <Badge className={`gap-2 ${config.color}`}>
            <Icon className="h-3 w-3" />
            <span>{role}</span>
        </Badge>
    );
}

function UserForm({ user, onFinished }) {
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();
  
  const form = useForm({
    resolver: zodResolver(userSchema),
    defaultValues: user || {
      name: '',
      role: 'CLIENT',
    },
  });

  useEffect(() => {
    if(user) {
        form.reset({
            name: user.name || '',
            role: user.role || 'CLIENT',
        })
    }
  }, [user, form])

  const onSubmit = async (data) => {
    setSubmitting(true);
    try {
        await updateUserProfile(user.id, data);
        toast({ title: "Éxito", description: "Perfil de usuario actualizado." });
        onFinished?.(true);
    } catch (error) {
        console.error(error);
        toast({ title: "Error", description: "No se pudo guardar el perfil.", variant: "destructive" });
        onFinished?.(false);
    } finally {
        setSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <DialogHeader>
            <DialogTitle>Editar Perfil de Usuario</DialogTitle>
            <DialogDescription>
                Actualiza el nombre y el rol para {user?.email}.
            </DialogDescription>
        </DialogHeader>
        
        <FormField control={form.control} name="name" render={({ field }) => (
            <FormItem>
                <FormLabel>Nombre Completo</FormLabel>
                <FormControl><Input placeholder="Nombre del usuario" {...field} /></FormControl>
                <FormMessage />
            </FormItem>
        )} />

        <FormField control={form.control} name="role" render={({ field }) => (
            <FormItem>
                <FormLabel>Rol</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Selecciona un rol" /></SelectTrigger></FormControl>
                    <SelectContent>
                        {ROLES.map(role => (
                            <SelectItem key={role} value={role}>{role}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <FormMessage />
            </FormItem>
        )} />
       
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => onFinished?.(false)}>Cancelar</Button>
          <Button type="submit" disabled={submitting}>
            {submitting && <Loader2 className="animate-spin mr-2" />}
            Guardar Cambios
          </Button>
        </DialogFooter>
      </form>
    </Form>
  )
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const { toast } = useToast();
  
  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
        setUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        setLoading(false);
    }, (error) => {
        toast({ title: 'Error', description: 'No se pudieron cargar los usuarios.', variant: 'destructive' });
        console.error(error);
        setLoading(false);
    });

    return () => unsubscribe();
  }, [toast]);

  const filteredUsers = useMemo(() => {
    const lowercasedFilter = searchTerm.toLowerCase();
    return users.filter((user) => {
      return (
        user.name?.toLowerCase().includes(lowercasedFilter) ||
        user.email?.toLowerCase().includes(lowercasedFilter)
      );
    });
  }, [users, searchTerm]);
  
  const getInitials = (nameOrEmail) => {
    if (!nameOrEmail) return 'U';
    const names = nameOrEmail.split(' ');
    if (names.length > 1 && names[0].length > 0 && names[1].length > 0) {
        return `${names[0][0]}${names[1][0]}`.toUpperCase();
    }
    return nameOrEmail.charAt(0).toUpperCase();
  }
  
  const handleRoleChange = async (userId, newRole) => {
    try {
        await updateUserProfile(userId, { role: newRole });
        toast({ title: 'Éxito', description: 'Rol de usuario actualizado.' });
    } catch(err) {
        toast({ title: 'Error', description: 'No se pudo actualizar el rol.', variant: 'destructive' });
        console.error(err);
    }
  }

  const openEditModal = (user) => {
    setEditingUser(user);
    setIsFormOpen(true);
  }

  const handleFormFinished = (success) => {
    setIsFormOpen(false);
    setEditingUser(null);
    // Data will refresh automatically from onSnapshot
  }

  return (
    <AuthorizedOnly allowedRoles={['ADMIN']}>
        <Dialog open={isFormOpen} onOpenChange={(isOpen) => {
            if(!isOpen) handleFormFinished(false)
            else setIsFormOpen(isOpen)
        }}>
            <DialogContent>
                <UserForm user={editingUser} onFinished={handleFormFinished} />
            </DialogContent>
        </Dialog>

        <Card>
          <CardHeader>
            <div className="flex justify-between items-start gap-4">
              <div>
                <CardTitle>Gestión de Usuarios</CardTitle>
                <CardDescription>Visualiza y gestiona los roles de los usuarios del sistema.</CardDescription>
              </div>
            </div>
            <div className="relative mt-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                    placeholder="Filtrar por nombre o correo..."
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
                  <TableHead>Usuario</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Fecha de Creación</TableHead>
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
                ) : filteredUsers.length > 0 ? (
                  filteredUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar>
                                <AvatarImage src={user.photoURL ?? ''} alt={user.name ?? ''} />
                                <AvatarFallback>{getInitials(user.name || user.email)}</AvatarFallback>
                            </Avatar>
                            <div>
                                <p className="font-medium">{user.name || 'Sin Nombre'}</p>
                                <p className="text-sm text-muted-foreground">{user.email}</p>
                            </div>
                          </div>
                      </TableCell>
                      <TableCell>
                         <RoleBadge role={user.role} />
                      </TableCell>
                      <TableCell>
                        {user.createdAt ? format(user.createdAt.toDate(), "dd MMM yyyy", { locale: es }) : 'N/A'}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button aria-haspopup="true" size="icon" variant="ghost">
                              <MoreHorizontal className="h-4 w-4" />
                              <span className="sr-only">Toggle menu</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                             <DropdownMenuItem onClick={() => openEditModal(user)}>
                                <Edit className="mr-2 h-4 w-4" />
                                <span>Editar Perfil</span>
                            </DropdownMenuItem>
                            <DropdownMenuSub>
                                <DropdownMenuSubTrigger>
                                    <Shield className="mr-2 h-4 w-4" />
                                    <span>Cambiar Rol</span>
                                </DropdownMenuSubTrigger>
                                <DropdownMenuPortal>
                                    <DropdownMenuSubContent>
                                        {ROLES.map(role => (
                                            <DropdownMenuItem key={role} onSelect={() => handleRoleChange(user.id, role)} disabled={user.role === role}>
                                                {user.role === role && <Check className="mr-2 h-4 w-4" />}
                                                {role}
                                            </DropdownMenuItem>
                                        ))}
                                    </DropdownMenuSubContent>
                                </DropdownMenuPortal>
                            </DropdownMenuSub>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground h-48">
                      {searchTerm ? `No se encontraron usuarios para "${searchTerm}".` : "No hay usuarios registrados."}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            
             {/* Mobile Card View */}
            <div className="space-y-4 md:hidden">
              {loading ? (
                <div className="flex justify-center items-center h-48">
                  <Loader2 className="mx-auto animate-spin text-primary h-10 w-10" />
                </div>
              ) : filteredUsers.length > 0 ? (
                filteredUsers.map((user) => (
                  <Card key={user.id} className="p-4">
                    <div className="flex items-start justify-between">
                       <div className="flex items-center gap-3">
                          <Avatar>
                              <AvatarImage src={user.photoURL ?? ''} alt={user.name ?? ''} />
                              <AvatarFallback>{getInitials(user.name || user.email)}</AvatarFallback>
                          </Avatar>
                          <div>
                              <p className="font-medium">{user.name || 'Sin Nombre'}</p>
                              <p className="text-sm text-muted-foreground">{user.email}</p>
                          </div>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button aria-haspopup="true" size="icon" variant="ghost" className="-mt-2 -mr-2">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                           <DropdownMenuContent align="end">
                             <DropdownMenuItem onClick={() => openEditModal(user)}>
                                <Edit className="mr-2 h-4 w-4" />
                                <span>Editar Perfil</span>
                            </DropdownMenuItem>
                            <DropdownMenuSub>
                                <DropdownMenuSubTrigger>
                                    <Shield className="mr-2 h-4 w-4" />
                                    <span>Cambiar Rol</span>
                                </DropdownMenuSubTrigger>
                                <DropdownMenuPortal>
                                    <DropdownMenuSubContent>
                                        {ROLES.map(role => (
                                            <DropdownMenuItem key={role} onSelect={() => handleRoleChange(user.id, role)} disabled={user.role === role}>
                                                {user.role === role && <Check className="mr-2 h-4 w-4" />}
                                                {role}
                                            </DropdownMenuItem>
                                        ))}
                                    </DropdownMenuSubContent>
                                </DropdownMenuPortal>
                            </DropdownMenuSub>
                          </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                    <CardFooter className="px-0 pb-0 pt-4 mt-4 border-t flex justify-between items-center">
                        <RoleBadge role={user.role} />
                        <p className="text-xs text-muted-foreground">
                            {user.createdAt ? format(user.createdAt.toDate(), "dd MMM yyyy", { locale: es }) : 'N/A'}
                        </p>
                    </CardFooter>
                  </Card>
                ))
              ) : (
                <div className="text-center py-16 text-muted-foreground">
                  <p>{searchTerm ? `No se encontraron usuarios para "${searchTerm}".` : "No hay usuarios."}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
    </AuthorizedOnly>
  );
}
