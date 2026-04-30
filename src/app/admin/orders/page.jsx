
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useToast } from '@/hooks/use-toast';
import { updateOrderStatus } from '@/lib/orders-service';
import { getUsers } from '@/lib/users-service';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, FileText, MoreHorizontal, Eye, CheckCircle, Clock, XCircle, Truck, PackageCheck, Image as ImageIcon, ChevronDown, Search, FilterX, Calendar as CalendarIcon, Hourglass, Phone, UserCheck, Tag } from 'lucide-react';
import { AuthorizedOnly } from '@/components/auth/authorized-only';
import { format, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatCurrency, cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import Image from 'next/image';
import { Separator } from '@/components/ui/separator';
import Link from 'next/link';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/tabs';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/use-auth';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';


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
    'Pendiente de Confirmacion de Pago': { icon: Clock, color: 'bg-yellow-400 text-black dark:bg-yellow-400 dark:text-black', textColor: 'text-yellow-800' },
    'Pagado': { icon: CheckCircle, color: 'bg-green-500/20', textColor: 'text-green-700 dark:text-green-400' },
    'En Preparación': { icon: PackageCheck, color: 'bg-cyan-500/20', textColor: 'text-cyan-700 dark:text-cyan-400' },
    'Enviado': { icon: Truck, color: 'bg-blue-500/20', textColor: 'text-blue-700 dark:text-blue-400' },
    'Completado': { icon: CheckCircle, color: 'bg-primary/20', textColor: 'text-primary' },
    'Cancelado': { icon: XCircle, color: 'bg-red-500/20', textColor: 'text-red-700 dark:text-red-400' }
};

const ALLOWED_MANUAL_STATUSES = Object.keys(statusConfig).filter(status => status !== 'Pagado');

function StatusSelector({ order, onStatusChange }) {
    const config = statusConfig[order.status] || { icon: Clock, color: 'bg-gray-500' };
    const Icon = config.icon;

    return (
        <Select value={order.status} onValueChange={(newStatus) => onStatusChange(order.id, newStatus)}>
            <SelectTrigger className={`w-[220px] text-left font-semibold ${config.textColor} ${config.color} border-none focus:ring-0`}>
                <SelectValue>
                    <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4" />
                        <span>{order.status}</span>
                    </div>
                </SelectValue>
            </SelectTrigger>
            <SelectContent>
                {ALLOWED_MANUAL_STATUSES.map(statusOption => {
                    const optionConfig = statusConfig[statusOption];
                    const OptionIcon = optionConfig.icon;
                    return (
                        <SelectItem 
                            key={statusOption} 
                            value={statusOption} 
                            className={cn(statusOption === 'Cancelado' && 'text-destructive focus:text-destructive')}
                        >
                            <div className="flex items-center gap-2">
                                <OptionIcon className="h-4 w-4" />
                                <span>{statusOption}</span>
                            </div>
                        </SelectItem>
                    );
                })}
            </SelectContent>
        </Select>
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
                        <p className="font-semibold">{order.createdAt ? format(order.createdAt.toDate(), "dd MMM yyyy, HH:mm", { locale: es }) : 'N/A'}</p>
                    </div>
                     <div className="text-right">
                        <p className="text-muted-foreground">Estado:</p>
                        <Badge className={`gap-2 whitespace-nowrap ${statusConfig[order.status]?.color} ${statusConfig[order.status]?.textColor}`}>
                            {React.createElement(statusConfig[order.status]?.icon, { className: 'h-3 w-3' })}
                            <span>{order.status}</span>
                        </Badge>
                    </div>
                </div>

                {order.paymentReference && (
                    <div className="bg-muted p-3 rounded-lg border flex items-center justify-between">
                         <div className="flex items-center gap-2">
                             <Tag className="h-4 w-4 text-muted-foreground" />
                             <span className="text-sm font-bold">Referencia de Pago:</span>
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

function OrdersList({ orders, userMap, onOpenDetail, onStatusChange }) {
     if (orders.length === 0) {
        return (
             <div className="text-center h-48 flex flex-col justify-center items-center text-muted-foreground">
                <FileText className="mx-auto h-12 w-12 mb-4 opacity-50" />
                <p>No hay órdenes que coincidan con los filtros.</p>
            </div>
        )
    }

    const getWhatsAppLink = (phone) => {
        if (!phone) return '#';
        const digits = phone.replace(/\D/g, '');
        if (digits.length === 8) {
            return `https://wa.me/506${digits}`;
        }
        return `https://wa.me/${digits}`;
    };

    return (
        <>
            {/* Desktop Table View */}
            <Table className="hidden md:table">
                <TableHeader>
                    <TableRow>
                        <TableHead>Factura</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Referencia Pago</TableHead>
                        <TableHead>Repartidor</TableHead>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Comprobante</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                     {orders.map((order) => (
                        <TableRow key={order.id}>
                            <TableCell className="font-black text-primary text-lg">#{order.invoiceNumber}</TableCell>
                            <TableCell>
                                <div className="flex items-start gap-2">
                                    <div>
                                        <p className="font-semibold">{order.userName}</p>
                                        <p className="text-xs text-muted-foreground">{order.userEmail}</p>
                                    </div>
                                    {order.whatsapp && (
                                        <Button asChild variant="ghost" size="icon" className="h-7 w-7 shrink-0">
                                            <a href={getWhatsAppLink(order.whatsapp)} target="_blank" rel="noopener noreferrer">
                                                <Phone className="h-4 w-4 text-green-500" />
                                            </a>
                                        </Button>
                                    )}
                                </div>
                            </TableCell>
                            <TableCell>
                                {order.paymentReference ? (
                                    <Badge variant="outline" className="font-mono font-bold text-sm">{order.paymentReference}</Badge>
                                ) : <span className="text-muted-foreground">-</span>}
                            </TableCell>
                             <TableCell>
                                {order.repartidorAsignadoId && userMap.has(order.repartidorAsignadoId) ? (
                                    <div className="flex items-center gap-2 text-xs">
                                        <UserCheck className="h-4 w-4 text-blue-500" />
                                        <span>{userMap.get(order.repartidorAsignadoId)}</span>
                                    </div>
                                ) : (
                                    <span className="text-xs text-muted-foreground">-</span>
                                )}
                            </TableCell>
                            <TableCell>
                                {order.createdAt ? (
                                    <div className="text-xs">
                                        <p>{format(order.createdAt.toDate(), "dd MMM yyyy, HH:mm", { locale: es })}</p>
                                        <p className="text-muted-foreground flex items-center gap-1">
                                            <Hourglass className="h-3 w-3" />
                                            {formatDistanceToNow(order.createdAt.toDate(), { locale: es, addSuffix: true })}
                                        </p>
                                    </div>
                                ) : 'N/A'}
                            </TableCell>
                            <TableCell>
                                {order.paymentReceiptUrl ? (
                                        <Button asChild variant="ghost" size="icon">
                                            <Link href={order.paymentReceiptUrl} target="_blank">
                                                <ImageIcon className="h-5 w-5 text-blue-500" />
                                            </Link>
                                        </Button>
                                ) : (
                                    <span className="text-muted-foreground">-</span>
                                )}
                            </TableCell>
                            <TableCell className="text-right font-bold">{formatCurrency(order.total)}</TableCell>
                            <TableCell>
                               <StatusSelector order={order} onStatusChange={onStatusChange} />
                            </TableCell>
                            <TableCell className="text-right">
                                <Button variant="outline" size="sm" onClick={() => onOpenDetail(order)}>
                                    <Eye className="mr-2 h-4 w-4" /> Ver
                                </Button>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
            
            {/* Mobile Card View */}
            <div className="space-y-4 md:hidden">
                {orders.map((order) => (
                    <Card key={order.id} className="p-4 border-2">
                        <div className="flex justify-between items-start gap-4 mb-4">
                            <div>
                                <p className="font-black text-2xl text-primary leading-none">#{order.invoiceNumber}</p>
                                <div className="flex items-center gap-2 mt-1">
                                  <p className="text-sm font-semibold">{order.userName}</p>
                                  {order.whatsapp && (
                                      <a href={getWhatsAppLink(order.whatsapp)} target="_blank" rel="noopener noreferrer">
                                          <Phone className="h-4 w-4 text-green-500" />
                                      </a>
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    {order.createdAt ? format(order.createdAt.toDate(), "dd MMM yyyy, HH:mm", { locale: es }) : 'N/A'}
                                </p>
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => onOpenDetail(order)}>
                                <Eye className="h-5 w-5" />
                            </Button>
                        </div>
                        
                        <div className="space-y-3">
                            <div className="flex justify-between items-center gap-2 bg-muted/50 p-2 rounded">
                                <span className="text-xs font-bold uppercase text-muted-foreground">Ref Pago:</span>
                                <span className="font-mono font-black">{order.paymentReference || 'N/A'}</span>
                            </div>

                            <StatusSelector order={order} onStatusChange={onStatusChange} />
                             
                             <div className="flex justify-between items-center pt-3 border-t">
                                <div className="flex items-center gap-2">
                                    {order.paymentReceiptUrl ? (
                                        <Button asChild variant="outline" size="sm">
                                            <Link href={order.paymentReceiptUrl} target="_blank">
                                                <ImageIcon className="mr-2 h-4 w-4" /> Comprobante
                                            </Link>
                                        </Button>
                                    ) : <Badge variant="outline" className="text-xs">Sin Comprobante</Badge>}
                                </div>
                                <div className="text-right">
                                    <p className="text-xs text-muted-foreground">Total</p>
                                    <p className="font-black text-xl text-primary">{formatCurrency(order.total)}</p>
                                </div>
                            </div>
                        </div>
                    </Card>
                ))}
            </div>
        </>
    );
}


export default function AdminOrdersPage() {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState(null);
    const { toast } = useToast();
    const { user } = useAuth();
    const [deliveryUsers, setDeliveryUsers] = useState([]);

    // Filter states
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedStatus, setSelectedStatus] = useState('all');
    const [dateRange, setDateRange] = useState(undefined);


    useEffect(() => {
        const ordersCol = collection(db, 'orders');
        const q = query(ordersCol, orderBy('createdAt', 'desc'));
        
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedOrders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setOrders(fetchedOrders);
            setLoading(false);
        }, async (error) => {
            const permissionError = new FirestorePermissionError({
                path: ordersCol.path,
                operation: 'list',
            });
            errorEmitter.emit('permission-error', permissionError);
            setLoading(false);
        });

        getUsers({ roles: ['DELIVERY', 'ADMIN'] })
            .then(setDeliveryUsers)
            .catch(err => {
                console.error(err);
                toast({ title: 'Error', description: 'No se pudieron cargar los repartidores.', variant: 'destructive' });
            });

        return () => unsubscribe();
    }, [toast]);
    
    const userMap = useMemo(() => new Map(deliveryUsers.map(u => [u.id, u.name])), [deliveryUsers]);

    const handleStatusChange = async (orderId, newStatus) => {
        if (!user) {
            toast({ title: 'Error', description: 'Debes iniciar sesión para realizar esta acción.', variant: 'destructive' });
            return;
        }
        try {
            await updateOrderStatus(orderId, newStatus, user);
            toast({ title: 'Éxito', description: 'Estado de la orden actualizado.' });
        } catch (error) {
             toast({ title: 'Error', description: 'No se pudo actualizar el estado.', variant: 'destructive' });
        }
    }

    const openDetailModal = (order) => {
        setSelectedOrder(order);
        setIsDetailModalOpen(true);
    }
    
     const applyFilters = (ordersList) => {
        return ordersList.filter(order => {
            const searchTermLower = searchTerm.toLowerCase();
            const searchMatch = searchTerm === '' ||
                order.invoiceNumber?.toLowerCase().includes(searchTermLower) ||
                order.userName?.toLowerCase().includes(searchTermLower) ||
                order.userEmail?.toLowerCase().includes(searchTermLower) ||
                order.paymentReference?.toLowerCase().includes(searchTermLower);

            const statusMatch = selectedStatus === 'all' || order.status === selectedStatus;

            let dateMatch = true;
            if (dateRange?.from) {
                const orderDate = order.createdAt.toDate();
                const fromDate = new Date(dateRange.from.setHours(0, 0, 0, 0));
                const toDate = dateRange.to ? new Date(dateRange.to.setHours(23, 59, 59, 999)) : fromDate;
                dateMatch = orderDate >= fromDate && orderDate <= (dateRange.to ? toDate : new Date(fromDate.getTime() + 24 * 60 * 60 * 1000 - 1));
            }

            return searchMatch && statusMatch && dateMatch;
        });
    };

    const activeOrders = useMemo(() => orders.filter(o => o.status !== 'Completado' && o.status !== 'Cancelado'), [orders]);
    const historicalOrders = useMemo(() => orders.filter(o => o.status === 'Completado' || o.status === 'Cancelado'), [orders]);
    
    const filteredActiveOrders = useMemo(() => applyFilters(activeOrders), [activeOrders, searchTerm, selectedStatus, dateRange]);
    const filteredHistoricalOrders = useMemo(() => applyFilters(historicalOrders), [historicalOrders, searchTerm, selectedStatus, dateRange]);

    const resetFilters = () => {
        setSearchTerm('');
        setSelectedStatus('all');
        setDateRange(undefined);
    };

    return (
        <AuthorizedOnly allowedRoles={['ADMIN']}>
            <Dialog open={isDetailModalOpen} onOpenChange={setIsDetailModalOpen}>
                <OrderDetailModal order={selectedOrder} onClose={() => setIsDetailModalOpen(false)} />
            </Dialog>

            <Card>
                <CardHeader>
                    <CardTitle>Gestión de Pedidos</CardTitle>
                    <CardDescription>Registro completo de ventas y estados de envío.</CardDescription>
                     <div className="mt-6 border-t pt-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-center">
                            <div className="relative lg:col-span-2">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                                <Input
                                    placeholder="Buscar por #, cliente, correo o ref. pago..."
                                    className="pl-10 w-full"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                                <SelectTrigger><SelectValue placeholder="Filtrar por estado" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todos los estados</SelectItem>
                                    {Object.keys(statusConfig).map(status => (
                                        <SelectItem key={status} value={status}>{status}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                             <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        id="date"
                                        variant={"outline"}
                                        className={cn("justify-start text-left font-normal", !dateRange && "text-muted-foreground")}
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {dateRange?.from ? (
                                            dateRange.to ? (
                                                <>
                                                    {format(dateRange.from, "LLL dd, y")} -{" "}
                                                    {format(dateRange.to, "LLL dd, y")}
                                                </>
                                            ) : (
                                                format(dateRange.from, "LLL dd, y")
                                            )
                                        ) : (
                                            <span>Filtrar por fecha</span>
                                        )}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar
                                        initialFocus
                                        mode="range"
                                        defaultMonth={dateRange?.from}
                                        selected={dateRange}
                                        onSelect={setDateRange}
                                        numberOfMonths={2}
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>
                        <div className="mt-4 flex justify-end">
                             <Button variant="ghost" onClick={resetFilters}>
                                <FilterX className="mr-2 h-4 w-4" />
                                Limpiar Filtros
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {loading ? (
                         <div className="text-center h-48 flex justify-center items-center">
                            <Loader2 className="mx-auto animate-spin text-primary h-10 w-10" />
                        </div>
                    ) : (
                        <Tabs defaultValue="active" className="w-full">
                            <TabsList className="grid w-full grid-cols-2">
                                <TabsTrigger value="active" className="font-bold">Órdenes Activas ({filteredActiveOrders.length})</TabsTrigger>
                                <TabsTrigger value="history" className="font-bold">Historial ({filteredHistoricalOrders.length})</TabsTrigger>
                            </TabsList>
                            <TabsContent value="active" className="mt-4">
                                <OrdersList 
                                    orders={filteredActiveOrders}
                                    userMap={userMap}
                                    onOpenDetail={openDetailModal}
                                    onStatusChange={handleStatusChange}
                                />
                            </TabsContent>
                             <TabsContent value="history" className="mt-4">
                                <OrdersList 
                                    orders={filteredHistoricalOrders}
                                    userMap={userMap}
                                    onOpenDetail={openDetailModal}
                                    onStatusChange={handleStatusChange}
                                />
                            </TabsContent>
                        </Tabs>
                    )}
                </CardContent>
            </Card>
        </AuthorizedOnly>
    );
}
