
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, FileText, Eye, CheckCircle, Clock, XCircle, Truck, PackageCheck, Image as ImageIcon } from 'lucide-react';
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

function OrderDetailModal({ order, onClose }) {
    if (!order) return null;

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
                
                {order.paymentReceiptUrl && (
                    <>
                        <div>
                            <h4 className="font-semibold mb-2">Comprobante de Pago</h4>
                            <div className="relative aspect-video w-full max-w-sm mx-auto overflow-hidden rounded-md border">
                                <Link href={order.paymentReceiptUrl} target="_blank">
                                    <Image src={order.paymentReceiptUrl} alt="Comprobante de pago" fill className="object-contain cursor-pointer" unoptimized />
                                </Link>
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

export default function MyOrdersPage() {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedOrder, setSelectedOrder] = useState(null);
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

        return () => unsubscribe();
    }, [user, authLoading, router, toast]);

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
                <OrderDetailModal order={selectedOrder} onClose={closeDetailModal} />
            </Dialog>

            <Card>
                <CardHeader>
                    <CardTitle>Mis Órdenes</CardTitle>
                    <CardDescription>Aquí puedes ver el historial de todas tus órdenes.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Factura</TableHead>
                                <TableHead>Fecha</TableHead>
                                <TableHead>Estado</TableHead>
                                <TableHead className="text-right">Total</TableHead>
                                <TableHead className="text-right">Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {orders.length > 0 ? (
                                orders.map((order) => (
                                    <TableRow key={order.id}>
                                        <TableCell className="font-medium">#{order.invoiceNumber}</TableCell>
                                        <TableCell>{order.createdAt ? format(order.createdAt, "dd MMM yyyy", { locale: es }) : 'N/A'}</TableCell>
                                        <TableCell><StatusBadge status={order.status} /></TableCell>
                                        <TableCell className="text-right font-semibold">{formatCurrency(order.total)}</TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="outline" size="sm" onClick={() => openDetailModal(order)}>
                                                <Eye className="mr-2 h-4 w-4" /> Ver Detalle
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center h-48 text-muted-foreground">
                                        <FileText className="mx-auto h-12 w-12 mb-4 opacity-50" />
                                        No has realizado ninguna orden todavía.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
