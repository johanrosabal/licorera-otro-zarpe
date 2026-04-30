'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, FileText, Eye, CheckCircle, Clock, XCircle, Truck, PackageCheck, UserCheck, Tag } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { onSnapshot, query, where, collection, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import Image from 'next/image';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getUsers } from '@/lib/users-service';

const statusConfig = {
    'Pendiente de Confirmacion de Pago': { icon: Clock, color: 'bg-yellow-400 text-black dark:bg-yellow-400 dark:text-black' },
    'Pagado': { icon: CheckCircle, color: 'bg-green-500/20 text-green-700 dark:text-green-400' },
    'En Preparación': { icon: PackageCheck, color: 'bg-cyan-500/20 text-cyan-700 dark:text-cyan-400' },
    'Enviado': { icon: Truck, color: 'bg-blue-500/20 text-blue-700 dark:text-blue-400' },
    'Completado': { icon: CheckCircle, color: 'bg-primary/20 text-primary' },
    'Cancelado': { icon: XCircle, color: 'bg-red-500/20 text-red-700 dark:text-red-400' }
};


function StatusBadge({ status }) {
    const currentStatus = status === 'Pendiente de Pago' ? 'Pendiente de Confirmacion de Pago' : status;
    const config = statusConfig[currentStatus] || { icon: Clock, color: 'bg-gray-500/20 text-gray-700' };
    const Icon = config.icon;
    return (
        <Badge className={`gap-2 ${config.color}`}>
            <Icon className="h-3 w-3" />
            <span>{currentStatus}</span>
        </Badge>
    );
}

function OrderDetailModal({ order, onClose, userMap }) {
    if (!order) return null;
    const assignedRepartidor = order.repartidorAsignadoId ? userMap.get(order.repartidorAsignadoId) : null;

    return (
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
                <DialogTitle>Detalle de la Orden #{order.invoiceNumber}</DialogTitle>
                <DialogDescription>
                    {`Cliente: ${order.userName} (${order.userEmail})`}
                </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                        <p className="text-muted-foreground">Fecha:</p>
                        <p className="font-semibold">{order.createdAt ? format(order.createdAt, "dd MMM yyyy, HH:mm", { locale: es }) : 'N/A'}</p>
                    </div>
                     <div className="text-right">
                        <p className="text-muted-foreground">Estado:</p>
                        <StatusBadge status={order.status} />
                    </div>
                </div>

                {order.paymentReference && (
                    <div className="bg-primary/5 p-3 rounded-lg border border-primary/20 flex items-center justify-between">
                         <div className="flex items-center gap-2">
                             <Tag className="h-4 w-4 text-primary" />
                             <span className="text-sm font-bold text-primary">Referencia de Pago:</span>
                         </div>
                         <span className="font-mono font-black text-lg">{order.paymentReference}</span>
                    </div>
                )}

                 <Separator />
                <div>
                    <h4 className="font-semibold mb-2">Productos</h4>
                    <div className="space-y-3">
                        {order.items.map(item => (
                            <div key={item.id} className="flex justify-between items-center">
                                <div className="flex items-center gap-3">
                                    <Image src={item.image} alt={item.name} width={40} height={40} className="rounded-md border object-cover" unoptimized/>
                                    <div>
                                        <p className="font-medium">{item.name}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {item.quantity} x {formatCurrency(item.price)}
                                        </p>
                                    </div>
                                </div>
                                <p className="font-medium">{formatCurrency(item.price * item.quantity)}</p>
                            </div>
                        ))}
                    </div>
                </div>

                <Separator />
                
                {assignedRepartidor && (
                    <>
                        <div>
                            <h4 className="font-semibold mb-2">Información de Envío</h4>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Truck className="h-4 w-4 text-primary" />
                                <span>En camino con: <span className="font-semibold text-foreground">{assignedRepartidor}</span></span>
                            </div>
                        </div>
                        <Separator />
                    </>
                )}


                <div className="flex justify-end">
                    <div className="w-full max-w-xs space-y-1">
                        <div className="flex justify-between text-sm">
                            <p className="text-muted-foreground">Subtotal:</p>
                            <p>{formatCurrency(order.subtotal)}</p>
                        </div>
                         <div className="flex justify-between text-sm">
                            <p className="text-muted-foreground">Envío:</p>
                            <p>{formatCurrency(order.deliveryFee)}</p>
                        </div>
                        <div className="flex justify-between text-lg font-bold">
                            <p>Total:</p>
                            <p>{formatCurrency(order.total)}</p>
                        </div>
                    </div>
                </div>

            </div>
            <DialogFooter>
                <Button variant="outline" onClick={onClose}>Cerrar</Button>
            </DialogFooter>
        </DialogContent>
    );
}

function OrdersList({ orders, onOpenDetail, userMap }) {
     if (orders.length === 0) {
        return (
            <div className="text-center h-48 flex flex-col justify-center items-center text-muted-foreground">
                <FileText className="mx-auto h-12 w-12 mb-4 opacity-50" />
                <p>No hay órdenes en esta categoría.</p>
            </div>
        )
    }

    return (
        <>
            {/* Desktop View */}
            <Table className="hidden md:table">
                <TableHeader>
                    <TableRow>
                        <TableHead>N° Pedido</TableHead>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Referencia</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {orders.map((order) => (
                        <TableRow key={order.id}>
                            <TableCell className="font-black text-primary text-xl">#{order.invoiceNumber}</TableCell>
                            <TableCell className="text-xs">{order.createdAt ? format(order.createdAt, "dd MMM yyyy", { locale: es }) : 'N/A'}</TableCell>
                            <TableCell><StatusBadge status={order.status} /></TableCell>
                            <TableCell>
                                {order.paymentReference ? (
                                    <Badge variant="outline" className="font-mono">{order.paymentReference}</Badge>
                                ) : '-'}
                            </TableCell>
                            <TableCell className="text-right font-bold">{formatCurrency(order.total)}</TableCell>
                            <TableCell className="text-right">
                                <Button variant="outline" size="sm" onClick={() => onOpenDetail(order)}>
                                    <Eye className="mr-2 h-4 w-4" /> Ver Detalle
                                </Button>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
            {/* Mobile View */}
            <div className="space-y-4 md:hidden">
                {orders.map(order => (
                    <Card key={order.id} className="p-4 flex flex-col gap-3 border-2 hover:border-primary/50 transition-colors">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="font-black text-3xl text-primary leading-none">#{order.invoiceNumber}</p>
                                <p className="text-xs text-muted-foreground mt-1">
                                    {order.createdAt ? format(order.createdAt, "dd MMM yyyy", { locale: es }) : 'N/A'}
                                </p>
                            </div>
                            <StatusBadge status={order.status} />
                        </div>
                        {order.paymentReference && (
                            <div className="bg-primary/5 p-2 rounded border border-primary/10 flex justify-between items-center text-xs">
                                <span className="font-bold text-primary">REF: {order.paymentReference}</span>
                                {order.repartidorAsignadoId && userMap.has(order.repartidorAsignadoId) && (
                                    <span className="text-blue-500 font-medium">Asignado: {userMap.get(order.repartidorAsignadoId)}</span>
                                )}
                            </div>
                        )}
                        <div className="flex justify-between items-center pt-2">
                            <div>
                                <p className="text-xs text-muted-foreground">Total</p>
                                <p className="font-bold text-xl">{formatCurrency(order.total)}</p>
                            </div>
                            <Button variant="outline" size="sm" onClick={() => onOpenDetail(order)}>
                                <Eye className="mr-2 h-4 w-4" /> Ver
                            </Button>
                        </div>
                    </Card>
                ))}
            </div>
        </>
    );
}

export default function MyOrdersPage() {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [deliveryUsers, setDeliveryUsers] = useState([]);
    const { user, loading: authLoading } = useAuth();
    const { toast } = useToast();
    const router = useRouter();

    useEffect(() => {
        if (authLoading) return;
        if (!user) {
            router.push('/login?redirect=/my-orders');
            return;
        }

        const q = query(
            collection(db, 'orders'),
            where('userId', '==', user.uid),
            orderBy('createdAt', 'desc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedOrders = snapshot.docs.map(doc => {
                const data = doc.data();
                return { 
                    id: doc.id, 
                    ...data,
                    // Convert Firestore Timestamp to JS Date object
                    createdAt: data.createdAt ? data.createdAt.toDate() : null
                };
            });
            setOrders(fetchedOrders);
            setLoading(false);
        }, (error) => {
            console.error(error);
            toast({ title: 'Error', description: 'No se pudieron cargar tus órdenes.', variant: 'destructive' });
            setLoading(false);
        });

        getUsers({ roles: ['DELIVERY', 'ADMIN'] })
            .then(setDeliveryUsers)
            .catch(err => console.error("Could not fetch delivery users", err));

        return () => unsubscribe();
    }, [user, authLoading, router, toast]);

    const userMap = useMemo(() => new Map(deliveryUsers.map(u => [u.id, u.name])), [deliveryUsers]);
    
    const activeOrders = useMemo(() => 
        orders.filter(o => o.status !== 'Completado' && o.status !== 'Cancelado'), 
        [orders]
    );

    const completedOrders = useMemo(() => 
        orders.filter(o => o.status === 'Completado' || o.status === 'Cancelado'),
        [orders]
    );


    const openDetailModal = (order) => {
        setSelectedOrder(order);
    }
    
    const closeDetailModal = () => {
        setSelectedOrder(null);
    }

    if (loading || authLoading) {
        return <div className="flex justify-center items-center h-[60vh]"><Loader2 className="h-16 w-16 animate-spin text-primary" /></div>;
    }

    return (
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <Dialog open={!!selectedOrder} onOpenChange={(isOpen) => !isOpen && closeDetailModal()}>
                <OrderDetailModal order={selectedOrder} onClose={closeDetailModal} userMap={userMap} />
            </Dialog>

            <Card>
                <CardHeader>
                    <CardTitle>Mis Órdenes</CardTitle>
                    <CardDescription>Aquí puedes ver el historial de todas tus órdenes y su estado actual.</CardDescription>
                </CardHeader>
                <CardContent>
                   <Tabs defaultValue="active" className="w-full">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="active" className="text-base font-bold">Órdenes Activas ({activeOrders.length})</TabsTrigger>
                            <TabsTrigger value="completed" className="text-base font-bold">Historial ({completedOrders.length})</TabsTrigger>
                        </TabsList>
                        <TabsContent value="active" className="mt-6">
                            <OrdersList orders={activeOrders} onOpenDetail={openDetailModal} userMap={userMap} />
                        </TabsContent>
                        <TabsContent value="completed" className="mt-6">
                             <OrdersList orders={completedOrders} onOpenDetail={openDetailModal} userMap={userMap} />
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>
        </div>
    );
}
