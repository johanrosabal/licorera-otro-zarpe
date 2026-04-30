

'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { updateOrderStatus, assignDeliveryUser } from '@/lib/orders-service';
import { getUsers } from '@/lib/users-service';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Loader2, PackageCheck, Truck, User, Clock, FileText, Search, MapPin, CheckCircle, XCircle, UserCheck } from 'lucide-react';
import { AuthorizedOnly } from '@/components/auth/authorized-only';
import { format, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { collection, onSnapshot, query, where, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Image from 'next/image';
import { Input } from '@/components/ui/input';
import { extractCoordsFromUrl } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';


function WhatsAppIcon(props) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
        </svg>
    )
}

const statusConfig = {
    'Pendiente de Confirmacion de Pago': { icon: Clock, color: 'bg-yellow-400 text-black dark:bg-yellow-400 dark:text-black' },
    'Pagado': { icon: CheckCircle, color: 'bg-green-500/20 text-green-700 dark:text-green-400' },
    'En Preparación': { icon: PackageCheck, color: 'bg-cyan-500/20 text-cyan-700 dark:text-cyan-400' },
    'Enviado': { icon: Truck, color: 'bg-blue-500/20 text-blue-700 dark:text-blue-400' },
    'Completado': { icon: CheckCircle, color: 'bg-primary/20 text-primary' },
    'Cancelado': { icon: XCircle, color: 'bg-red-500/20 text-red-700 dark:text-red-400' }
};


function StatusBadge({ status }) {
    const config = statusConfig[status] || { icon: Clock, color: 'bg-gray-500' };
    const Icon = config.icon;
    return (
        <Badge className={`gap-2 ${config.color}`}>
            <Icon className="h-3 w-3" />
            <span>{status}</span>
        </Badge>
    );
}

function NavigationButtons({ locationUrl }) {
    const coords = extractCoordsFromUrl(locationUrl);

    if (!coords) {
        return <Button variant="outline" size="sm" disabled><MapPin className="mr-2 h-4 w-4" /> Sin Ubicación</Button>;
    }

    return (
        <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm">
                <a href={`https://www.google.com/maps?q=${coords.lat},${coords.lng}`} target="_blank" rel="noopener noreferrer">
                    Google Maps
                </a>
            </Button>
            <Button asChild variant="outline" size="sm">
                 <a href={`https://waze.com/ul?ll=${coords.lat},${coords.lng}&navigate=yes`} target="_blank" rel="noopener noreferrer">
                    Waze
                </a>
            </Button>
        </div>
    );
}


function OrderAssignment({ order, deliveryUsers, onAssign }) {
    const [selectedUserId, setSelectedUserId] = useState(order.repartidorAsignadoId || 'unassigned');
    const { toast } = useToast();

    const handleAssign = async (userId) => {
        const finalUserId = userId === 'unassigned' ? null : userId;
        try {
            await onAssign(order.id, finalUserId);
            setSelectedUserId(userId);
             toast({ title: "Éxito", description: `Orden asignada a ${finalUserId ? deliveryUsers.find(u => u.id === finalUserId)?.name : 'nadie'}.` });
        } catch (error) {
            toast({ title: "Error", description: "No se pudo asignar la orden.", variant: "destructive" });
        }
    };

    return (
        <div className="flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-muted-foreground" />
            <Select onValueChange={handleAssign} value={selectedUserId}>
                <SelectTrigger className="w-[250px]">
                    <SelectValue placeholder="Asignar repartidor..." />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="unassigned">Sin Asignar</SelectItem>
                    {deliveryUsers.map(user => (
                        <SelectItem key={user.id} value={user.id}>{user.name} ({user.role})</SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
}

export default function PickingPage() {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const { toast } = useToast();
    const [deliveryUsers, setDeliveryUsers] = useState([]);
    
    useEffect(() => {
        const q = query(
            collection(db, 'orders'),
            where('status', 'in', ['Pagado', 'En Preparación']),
            orderBy('createdAt', 'asc')
        );
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedOrders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setOrders(fetchedOrders);
            setLoading(false);
        }, (error) => {
            console.error(error);
            toast({ title: 'Error', description: 'No se pudieron cargar las órdenes para preparación.', variant: 'destructive' });
            setLoading(false);
        });

        getUsers({ roles: ['DELIVERY', 'ADMIN'] }).then(users => {
            setDeliveryUsers(users);
        }).catch(err => {
            console.error('Error fetching users:', err);
            toast({ title: 'Error', description: 'No se pudieron cargar los repartidores.', variant: 'destructive' });
        });

        return () => unsubscribe();
    }, [toast]);
    
    const filteredOrders = useMemo(() => {
      const lowercasedFilter = searchTerm.toLowerCase();
      return orders.filter((order) => {
        return (
          order.invoiceNumber?.toLowerCase().includes(lowercasedFilter) ||
          order.userName?.toLowerCase().includes(lowercasedFilter) ||
          order.items.some(item => item.name.toLowerCase().includes(lowercasedFilter))
        );
      });
    }, [orders, searchTerm]);


    const handleStatusChange = async (orderId, newStatus) => {
        await updateOrderStatus(orderId, newStatus);
        toast({ title: 'Éxito', description: `Orden #${orders.find(o=>o.id === orderId)?.invoiceNumber} marcada como ${newStatus}.` });
    };

    const handleAssignRepartidor = async (orderId, userId) => {
        try {
            await assignDeliveryUser(orderId, userId);
        } catch (error) {
            console.error("Error assigning user:", error);
            throw error; // Re-throw to be caught in the component
        }
    };
    
    const getWhatsAppLink = (phone) => {
        if (!phone) return '#';
        const digits = phone.replace(/\D/g, '');
        if (digits.length === 8) {
            return `https://wa.me/506${digits}`;
        }
        return `https://wa.me/${digits}`;
    };

    const startPreparation = async (order) => {
        if (order.status === 'Pagado') {
            await handleStatusChange(order.id, 'En Preparación');
        }
    };
    

    const renderEmptyState = () => (
        <div className="text-center py-16 text-muted-foreground">
            <PackageCheck className="mx-auto h-16 w-16 mb-4 opacity-50" />
            <h3 className="text-xl font-semibold">¡Todo al día!</h3>
            <p>No hay órdenes pendientes de preparación.</p>
        </div>
    );
    
     const renderLoadingState = () => (
        <div className="flex justify-center items-center py-16">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
    );

    return (
        <AuthorizedOnly allowedRoles={['ADMIN', 'DELIVERY']}>
            <div className="space-y-6">
                <Card>
                    <CardHeader>
                        <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                            <div>
                                <CardTitle>Preparación de Pedidos (Picking)</CardTitle>
                                <CardDescription>Órdenes pagadas y listas para ser preparadas y enviadas.</CardDescription>
                            </div>
                            <div className="relative w-full sm:w-64">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                                <Input
                                    placeholder="Buscar por #, cliente, producto..."
                                    className="pl-10 w-full"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                        </div>
                    </CardHeader>
                </Card>
                
                {loading ? renderLoadingState() : (
                    filteredOrders.length > 0 ? (
                    <div className="space-y-4">
                        {filteredOrders.map(order => (
                            <Card key={order.id} className="overflow-hidden">
                                <CardHeader 
                                    className="bg-muted/30 p-4 flex-col sm:flex-row items-start sm:items-center justify-between gap-4 cursor-pointer"
                                    onClick={() => startPreparation(order)}
                                >
                                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-sm w-full">
                                        <Badge variant="secondary" className="text-base w-fit">#{order.invoiceNumber}</Badge>
                                        <div className="flex items-center gap-2 text-muted-foreground">
                                            <User className="h-4 w-4" />
                                            <span>{order.userName}</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-muted-foreground">
                                            <Clock className="h-4 w-4" />
                                            <span>{format(order.createdAt.toDate(), "dd MMM, HH:mm", { locale: es })}</span>
                                        </div>
                                        <div className="sm:ml-auto flex items-center gap-2">
                                            <StatusBadge status={order.status} />
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-6">
                                    <div className="grid md:grid-cols-2 gap-6">
                                        <div>
                                            <h4 className="font-semibold mb-4">Lista de Productos a Preparar:</h4>
                                            <ul className="space-y-3">
                                                {order.items.map(item => (
                                                    <li key={item.id} className="flex items-center gap-4">
                                                        <Image src={item.image} alt={item.name} width={50} height={50} className="rounded-md border aspect-square object-cover" unoptimized/>
                                                        <div className="flex-1">
                                                            <p className="font-medium">{item.name}</p>
                                                            <p className="text-sm text-muted-foreground">SKU/ID: {item.id}</p>
                                                        </div>
                                                        <div className="bg-primary text-primary-foreground rounded-full h-8 w-8 flex items-center justify-center font-bold text-lg">
                                                            {item.quantity}
                                                        </div>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                         <div className="space-y-4">
                                            <h4 className="font-semibold mb-4">Información de Entrega:</h4>
                                             <div className="space-y-2">
                                                <p className="text-sm font-semibold">Contacto:</p>
                                                 {order.whatsapp ? (
                                                    <Button asChild variant="outline" size="sm">
                                                        <a href={getWhatsAppLink(order.whatsapp)} target="_blank" rel="noopener noreferrer">
                                                            <WhatsAppIcon className="mr-2 h-4 w-4"/>
                                                            Chatear ({order.whatsapp})
                                                        </a>
                                                    </Button>
                                                ) : <p className="text-sm text-muted-foreground">No proporcionado</p>}
                                             </div>

                                            <div className="space-y-2">
                                                <p className="text-sm font-semibold">Ubicación:</p>
                                                <NavigationButtons locationUrl={order.locationUrl} />
                                            </div>

                                            <div className="space-y-2">
                                                <p className="text-sm font-semibold">Asignar Repartidor:</p>
                                                <OrderAssignment order={order} deliveryUsers={deliveryUsers} onAssign={handleAssignRepartidor} />
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                                <CardFooter className="bg-muted/30 p-4 flex justify-end">
                                    <Button onClick={() => handleStatusChange(order.id, 'Enviado')} disabled={!order.repartidorAsignadoId}>
                                        <Truck className="mr-2 h-4 w-4"/>
                                        Marcar como Enviado
                                    </Button>
                                </CardFooter>
                            </Card>
                        ))}
                    </div>
                    ) : renderEmptyState()
                )}

            </div>
        </AuthorizedOnly>
    );
}
