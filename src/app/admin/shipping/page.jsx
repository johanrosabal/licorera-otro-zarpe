

'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useToast } from '@/hooks/use-toast';
import { updateOrderStatus } from '@/lib/orders-service';
import { getUsers } from '@/lib/users-service';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Loader2, PackageCheck, Truck, User, Clock, FileText, Search, CheckCircle, MapPin, Hourglass, UserCheck } from 'lucide-react';
import { AuthorizedOnly } from '@/components/auth/authorized-only';
import { format, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { collection, onSnapshot, query, where, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Image from 'next/image';
import { Input } from '@/components/ui/input';
import { extractCoordsFromUrl } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

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

export default function ShippingPage() {
    const [orders, setOrders] = useState([]);
    const [deliveryUsers, setDeliveryUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const { toast } = useToast();
    
    useEffect(() => {
        const q = query(
            collection(db, 'orders'),
            where('status', '==', 'Enviado'),
            orderBy('createdAt', 'asc')
        );
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedOrders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setOrders(fetchedOrders);
            setLoading(false);
        }, (error) => {
            console.error(error);
            toast({ title: 'Error', description: 'No se pudieron cargar las órdenes en camino.', variant: 'destructive' });
            setLoading(false);
        });
        
        getUsers({ roles: ['ADMIN', 'DELIVERY'] })
            .then(setDeliveryUsers)
            .catch(err => {
                console.error(err);
                toast({ title: 'Error', description: 'No se pudieron cargar los repartidores.', variant: 'destructive' });
            });


        return () => unsubscribe();
    }, [toast]);

    const userMap = useMemo(() => new Map(deliveryUsers.map(user => [user.id, user.name])), [deliveryUsers]);
    
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

    const getWhatsAppLink = (phone) => {
        if (!phone) return '#';
        // Remove non-digit characters and prepend Costa Rica country code if it's 8 digits long
        const digits = phone.replace(/\D/g, '');
        if (digits.length === 8) {
            return `https://wa.me/506${digits}`;
        }
        return `https://wa.me/${digits}`; // Assume it's already in a valid format
    };
    
    const renderEmptyState = () => (
        <div className="text-center py-16 text-muted-foreground">
            <Truck className="mx-auto h-16 w-16 mb-4 opacity-50" />
            <h3 className="text-xl font-semibold">¡No hay pedidos en camino!</h3>
            <p>Cuando un pedido sea marcado como enviado, aparecerá aquí.</p>
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
                                <CardTitle>Pedidos en Camino</CardTitle>
                                <CardDescription>Órdenes que han sido enviadas y están pendientes de entrega.</CardDescription>
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
                                <CardHeader className="bg-muted/30 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                    <div className="flex flex-col gap-3 flex-grow">
                                        <div className="flex justify-between items-center">
                                            <p className="text-sm font-semibold text-primary">#{order.invoiceNumber}</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <User className="h-4 w-4 text-muted-foreground" />
                                            <span className="font-semibold">{order.userName}</span>
                                        </div>
                                         <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                            <Clock className="h-4 w-4" />
                                            <span>{format(order.createdAt.toDate(), "dd MMM, HH:mm", { locale: es })}</span>
                                        </div>
                                        {order.repartidorAsignadoId && userMap.has(order.repartidorAsignadoId) && (
                                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                <UserCheck className="h-4 w-4 text-blue-500" />
                                                <span className="font-medium">Asignado a: {userMap.get(order.repartidorAsignadoId)}</span>
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex flex-col items-center gap-2 w-full sm:w-auto">
                                        <div className="flex items-center gap-2 text-xl font-bold text-amber-400 my-2">
                                            <Hourglass className="h-5 w-5" />
                                            <span>{formatDistanceToNow(order.createdAt.toDate(), { locale: es, addSuffix: true })}</span>
                                        </div>
                                        <Button onClick={() => handleStatusChange(order.id, 'Completado')} className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white" variant="default" size="lg">
                                            <CheckCircle className="mr-2 h-5 w-5"/>
                                            Marcar como Entregado
                                        </Button>
                                        <div className="flex items-center gap-2 pt-1">
                                             {order.whatsapp && (
                                                <Button asChild variant="outline" size="sm">
                                                    <a href={getWhatsAppLink(order.whatsapp)} target="_blank" rel="noopener noreferrer">
                                                        <WhatsAppIcon className="mr-2 h-4 w-4"/>
                                                        Chatear
                                                    </a>
                                                </Button>
                                            )}
                                            <NavigationButtons locationUrl={order.locationUrl} />
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-6">
                                    <h4 className="font-semibold mb-4 text-muted-foreground">Productos a entregar:</h4>
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
