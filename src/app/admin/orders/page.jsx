
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/use-auth';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getHomepageSettings } from '@/lib/settings';


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
    'Pendiente': { icon: Clock, color: 'bg-orange-500 text-white dark:bg-orange-600 dark:text-white', textColor: 'text-orange-900' },
    'Pagado': { icon: CheckCircle, color: 'bg-green-500/20', textColor: 'text-green-700 dark:text-green-400' },
    'En Preparación': { icon: PackageCheck, color: 'bg-cyan-500/20', textColor: 'text-cyan-700 dark:text-cyan-400' },
    'Enviado': { icon: Truck, color: 'bg-blue-500/20', textColor: 'text-blue-700 dark:text-blue-400' },
    'Completado': { icon: CheckCircle, color: 'bg-primary/20', textColor: 'text-primary' },
    'Cancelado': { icon: XCircle, color: 'bg-red-500/20', textColor: 'text-red-700 dark:text-red-400' },
    // Legacy support (to be treated as Pendiente in UI if needed, but keeping for data compatibility)
    'Verificar Pago': { icon: Clock, color: 'bg-orange-500 text-white', textColor: 'text-orange-900' },
    'Pendiente de Pago': { icon: Clock, color: 'bg-orange-500 text-white', textColor: 'text-orange-900' },
    'Pendiente de Confirmacion de Pago': { icon: Clock, color: 'bg-orange-500 text-white', textColor: 'text-orange-900' },
    'En verificación': { icon: Clock, color: 'bg-orange-500 text-white', textColor: 'text-orange-900' },
};

const ALLOWED_MANUAL_STATUSES = ['Pendiente', 'Pagado', 'En Preparación', 'Enviado', 'Completado', 'Cancelado'];

function StatusSelector({ order, onStatusChange }) {
    // Determine the active display status (handling legacy ones)
    const displayStatus = ['Pendiente de Pago', 'Pendiente de Confirmacion de Pago', 'En verificación', 'Verificar Pago'].includes(order.status) 
        ? 'Pendiente' 
        : order.status;

    const config = statusConfig[displayStatus] || { icon: Clock, color: 'bg-gray-500' };
    const Icon = config.icon;

    return (
        <Select value={order.status} onValueChange={(newStatus) => onStatusChange(order.id, newStatus)}>
            <SelectTrigger className={`w-[220px] text-left font-semibold ${config.textColor} ${config.color} border-none focus:ring-0`}>
                <SelectValue>
                    <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4" />
                        <span>{displayStatus}</span>
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
                        <Badge className={`gap-2 whitespace-nowrap ${(statusConfig[order.status] || statusConfig['Verificar Pago']).color} ${(statusConfig[order.status] || statusConfig['Verificar Pago']).textColor}`}>
                            {React.createElement((statusConfig[order.status] || statusConfig['Verificar Pago']).icon, { className: 'h-3 w-3' })}
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

function OrdersList({ orders, userMap, onOpenDetail, onStatusChange, onViewReceipt }) {
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
            <div className="hidden lg:block overflow-hidden rounded-md border border-border">
                <div className="max-h-[70vh] overflow-y-auto custom-scrollbar">
                    <Table>
                        <TableHeader className="sticky top-0 bg-background z-10 shadow-sm">
                            <TableRow className="hover:bg-transparent">
                                <TableHead className="w-[50px]">#</TableHead>
                                <TableHead className="w-[180px]">Orden / Fecha</TableHead>
                                <TableHead className="w-[220px]">Cliente</TableHead>
                                <TableHead className="w-[150px]">Pago / Ref.</TableHead>
                                <TableHead className="w-[180px]">Seguimiento</TableHead>
                                <TableHead className="w-[200px]">Estado</TableHead>
                                <TableHead className="text-right">Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                        {orders.map((order, index) => (
                            <TableRow key={order.id} className="group hover:bg-muted/30 transition-colors">
                                <TableCell className="text-xs text-muted-foreground font-mono">
                                    {(index + 1).toString().padStart(2, '0')}
                                </TableCell>
                                <TableCell>
                                    <div className="flex flex-col gap-1">
                                        <div className="flex items-center gap-2">
                                            <span className="font-black text-primary text-lg">#{order.invoiceNumber}</span>
                                            {order.paymentReceiptUrl && (
                                                <Link href={order.paymentReceiptUrl} target="_blank" className="text-blue-500 hover:text-blue-600 transition-colors">
                                                    <ImageIcon className="h-4 w-4" />
                                                </Link>
                                            )}
                                        </div>
                                        <p className="text-[10px] text-muted-foreground uppercase tracking-tighter">
                                            {order.createdAt ? format(order.createdAt.toDate(), "dd MMM, HH:mm", { locale: es }) : 'N/A'}
                                        </p>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <div className="flex flex-col gap-0.5">
                                        <div className="flex items-center gap-1.5">
                                            <span className="font-bold text-sm truncate max-w-[140px]">{order.userName}</span>
                                            {order.whatsapp && (
                                                <a href={getWhatsAppLink(order.whatsapp)} target="_blank" rel="noopener noreferrer" className="text-green-500 hover:scale-110 transition-transform">
                                                    <WhatsAppIcon className="h-3.5 w-3.5" />
                                                </a>
                                            )}
                                        </div>
                                        <p className="text-[11px] text-muted-foreground truncate max-w-[180px]">{order.userEmail}</p>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-3">
                                        {order.paymentReceiptUrl ? (
                                            <div 
                                                className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md border-2 border-primary/20 bg-muted shadow-sm hover:border-primary/50 transition-all group/receipt cursor-zoom-in"
                                                onClick={() => onViewReceipt(order.paymentReceiptUrl)}
                                            >
                                                <Image 
                                                    src={order.paymentReceiptUrl} 
                                                    alt="Comprobante" 
                                                    fill 
                                                    className="object-cover hover:scale-125 transition-transform" 
                                                    unoptimized 
                                                />
                                            </div>
                                        ) : (
                                            <div className="h-12 w-12 shrink-0 rounded-md border-2 border-dashed border-muted flex items-center justify-center bg-muted/30">
                                                <ImageIcon className="h-5 w-5 text-muted-foreground/30" />
                                            </div>
                                        )}
                                        <div className="flex flex-col gap-1 min-w-[120px]">
                                            <p className="font-black text-base text-primary leading-none">{formatCurrency(order.total)}</p>
                                            <div className="flex flex-col gap-0.5 mt-1">
                                                {order.paymentReference && (
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-tight">Ref:</span>
                                                        <span className="text-[10px] font-mono font-black">{order.paymentReference}</span>
                                                    </div>
                                                )}
                                                {order.whatsapp && (
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-tight">SINPE al:</span>
                                                        <span className="text-[10px] font-black text-green-600">{order.whatsapp}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    {order.repartidorAsignadoId && userMap.has(order.repartidorAsignadoId) ? (
                                        <div className="flex items-center gap-2 text-xs bg-blue-500/10 text-blue-600 px-2 py-1 rounded-full w-fit border border-blue-200">
                                            <UserCheck className="h-3.5 w-3.5" />
                                            <span className="font-medium">{userMap.get(order.repartidorAsignadoId)}</span>
                                        </div>
                                    ) : (
                                        <span className="text-xs text-muted-foreground italic">No asignado</span>
                                    )}
                                </TableCell>
                                <TableCell>
                                    <StatusSelector order={order} onStatusChange={onStatusChange} />
                                </TableCell>
                                <TableCell className="text-right">
                                    <Button variant="ghost" size="icon" onClick={() => onOpenDetail(order)} className="hover:text-primary hover:bg-primary/10">
                                        <Eye className="h-4 w-4" />
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
                </div>
            </div>
            
            {/* Mobile/Tablet Card View */}
            <div className="space-y-4 lg:hidden">
                {orders.map((order) => (
                    <Card key={order.id} className="p-4 border-2">
                        <div className="flex justify-between items-start gap-4 mb-4">
                            <div className="flex-1">
                                <div className="flex justify-between items-start">
                                    <p className="font-black text-2xl text-primary leading-none">#{order.invoiceNumber}</p>
                                </div>
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
                            <div className="grid grid-cols-2 gap-3">
                                <div className="flex flex-col justify-center items-center gap-2 bg-primary/5 p-3 rounded-lg border-2 border-primary/20 shadow-inner">
                                    <span className="text-[10px] font-black uppercase text-primary/60 tracking-widest">Referencia:</span>
                                    <span className="font-mono font-black text-lg text-primary">{order.paymentReference || 'PENDIENTE'}</span>
                                </div>
                                <div className="flex flex-col justify-center items-center gap-2 bg-green-500/5 p-3 rounded-lg border-2 border-green-500/20 shadow-inner">
                                    <span className="text-[10px] font-black uppercase text-green-600/60 tracking-widest">SINPE al:</span>
                                    <span className="font-black text-lg text-green-700">{order.whatsapp || '-'}</span>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <StatusSelector order={order} onStatusChange={onStatusChange} />
                            </div>
                             
                             <div className="flex justify-between items-center pt-3 border-t">
                                <div className="flex items-center gap-2">
                                    {order.paymentReceiptUrl ? (
                                        <div 
                                            className="relative h-12 w-12 rounded border shadow-sm cursor-zoom-in hover:border-primary transition-colors overflow-hidden group"
                                            onClick={() => onViewReceipt(order.paymentReceiptUrl)}
                                        >
                                            <Image src={order.paymentReceiptUrl} alt="Comprobante" fill className="object-cover rounded group-hover:scale-110 transition-transform" unoptimized />
                                        </div>
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
    const [receiptModalUrl, setReceiptModalUrl] = useState(null);
    const { toast } = useToast();
    const { user } = useAuth();
    const [deliveryUsers, setDeliveryUsers] = useState([]);

    // Filter states
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedStatus, setSelectedStatus] = useState('all');
    const [dateRange, setDateRange] = useState(undefined);
    const [siteName, setSiteName] = useState('OTRO ZARPE');

    useEffect(() => {
        getHomepageSettings().then(settings => {
            if (settings?.siteName) setSiteName(settings.siteName);
        });
    }, []);


    useEffect(() => {
        const ordersCol = collection(db, 'orders');
        const q = query(ordersCol, orderBy('createdAt', 'desc'));
        
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedOrders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setOrders(fetchedOrders);
            setLoading(false);
        }, async (error) => {
            if (error.code === 'permission-denied') {
                setLoading(false);
                return;
            }
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

    const generatePDF = (ordersToExport, title) => {
        try {
            const doc = new jsPDF('l', 'mm', 'a4'); // Landscape for more columns
            const dateStr = format(new Date(), 'dd/MM/yyyy HH:mm', { locale: es });
            const pdfFormatCurrency = (amount) => formatCurrency(amount).replace(/₡|C\./g, '').trim();

            // Header
            const parts = siteName.split(' ');
            doc.setFontSize(22);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(0, 0, 0);
            doc.text(parts[0], 20, 20);
            
            if (parts.length > 1) {
                doc.setTextColor(220, 38, 38);
                doc.setFont('helvetica', 'bolditalic');
                doc.text(parts.slice(1).join(' '), 20 + doc.getTextWidth(parts[0]) + 2, 20);
            }

            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(100, 100, 100);
            doc.text(`REPORTE DE PEDIDOS - ${title.toUpperCase()}`, 20, 28);
            doc.text(`Generado el: ${dateStr}`, 20, 34);

            const tableData = ordersToExport.map(o => [
                `#${o.invoiceNumber}`,
                o.createdAt ? format(o.createdAt.toDate(), "dd/MM/yyyy HH:mm") : 'N/A',
                o.userName,
                o.whatsapp || '-',
                o.paymentReference || '-',
                o.repartidorAsignadoId ? (userMap.get(o.repartidorAsignadoId) || 'Asignado') : 'No asignado',
                o.status,
                pdfFormatCurrency(o.total)
            ]);

            const totalAmount = ordersToExport.reduce((acc, o) => acc + o.total, 0);

            autoTable(doc, {
                startY: 40,
                head: [['N° Orden', 'Fecha', 'Cliente', 'WhatsApp', 'Referencia', 'Repartidor', 'Estado', 'Total']],
                body: tableData,
                theme: 'striped',
                headStyles: { fillColor: [31, 41, 55] },
                styles: { fontSize: 7 }, // Smaller font to fit more columns
                columnStyles: {
                    7: { halign: 'right' }
                },
                foot: [[
                    'TOTAL',
                    '',
                    '',
                    '',
                    `${ordersToExport.length} pedidos`,
                    pdfFormatCurrency(totalAmount)
                ]],
                footStyles: { fillColor: [243, 244, 246], textColor: [0, 0, 0], fontStyle: 'bold' }
            });

            // Pagination
            const pageCount = doc.internal.getNumberOfPages();
            for (let i = 1; i <= pageCount; i++) {
                doc.setPage(i);
                const pageWidth = doc.internal.pageSize.getWidth();
                const pageHeight = doc.internal.pageSize.getHeight();
                doc.setFontSize(10);
                doc.setTextColor(150, 150, 150);
                doc.line(20, pageHeight - 15, pageWidth - 20, pageHeight - 15);
                doc.text(`Página ${i} de ${pageCount}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
                doc.text(siteName, 20, pageHeight - 10);
            }

            doc.save(`Reporte_Pedidos_${title.replace(' ', '_')}_${format(new Date(), 'yyyyMMdd')}.pdf`);
            toast({ title: "PDF Generado", description: "El reporte se ha descargado correctamente." });
        } catch (error) {
            console.error(error);
            toast({ title: "Error", description: "No se pudo generar el reporte PDF.", variant: "destructive" });
        }
    };

    return (
        <AuthorizedOnly allowedRoles={['ADMIN']}>
            <Dialog open={isDetailModalOpen} onOpenChange={setIsDetailModalOpen}>
                <OrderDetailModal order={selectedOrder} onClose={() => setIsDetailModalOpen(false)} />
            </Dialog>

            <Dialog open={!!receiptModalUrl} onOpenChange={(open) => !open && setReceiptModalUrl(null)}>
                <DialogContent className="max-w-3xl p-0 overflow-hidden border-2 border-primary/10 bg-background shadow-2xl rounded-xl">
                    <DialogHeader className="p-6 border-b bg-muted/20">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
                                <ImageIcon className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                                <DialogTitle className="text-xl font-black text-primary">Comprobante de Pago</DialogTitle>
                                <DialogDescription className="text-xs font-bold uppercase tracking-tighter opacity-70">Revisión de verificación de SINPE / Transferencia</DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>
                    
                    <div className="relative w-full bg-slate-50 dark:bg-slate-900/50 p-4 flex items-center justify-center min-h-[50vh] max-h-[75vh]">
                        {receiptModalUrl && (
                            <div className="relative w-full h-full min-h-[60vh] rounded-lg overflow-hidden border-2 border-white dark:border-slate-800 shadow-2xl bg-white dark:bg-slate-950">
                                <Image 
                                    src={receiptModalUrl} 
                                    alt="Comprobante de Pago Full" 
                                    fill 
                                    className="object-contain" 
                                    unoptimized 
                                />
                            </div>
                        )}
                    </div>

                    <DialogFooter className="p-4 border-t bg-muted/10 flex sm:justify-between items-center gap-3">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase hidden sm:block">
                            Verifique el monto y la referencia antes de confirmar
                        </p>
                        <div className="flex gap-3 w-full sm:w-auto">
                            <Button 
                                variant="outline" 
                                onClick={() => setReceiptModalUrl(null)}
                                className="flex-1 sm:flex-none font-bold"
                            >
                                CERRAR
                            </Button>
                            <Button 
                                onClick={() => window.open(receiptModalUrl, '_blank')}
                                className="flex-1 sm:flex-none font-black shadow-lg"
                            >
                                <Eye className="mr-2 h-4 w-4" /> VER ORIGINAL
                            </Button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Card>
                <CardHeader>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div>
                            <CardTitle>Gestión de Pedidos</CardTitle>
                            <CardDescription>Registro completo de ventas y estados de envío.</CardDescription>
                        </div>
                        <div className="flex gap-2">
                             <Button 
                                variant="outline" 
                                onClick={() => {
                                    const activeTab = document.querySelector('[data-state="active"][role="tab"]')?.getAttribute('value');
                                    const ordersToExport = activeTab === 'active' ? filteredActiveOrders : filteredHistoricalOrders;
                                    const title = activeTab === 'active' ? 'Órdenes Activas' : 'Historial de Órdenes';
                                    generatePDF(ordersToExport, title);
                                }}
                                disabled={loading}
                             >
                                <FileText className="mr-2 h-4 w-4" />
                                Exportar PDF
                            </Button>
                        </div>
                    </div>
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
                                    {ALLOWED_MANUAL_STATUSES.map(status => (
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
                                    onViewReceipt={setReceiptModalUrl}
                                />
                            </TabsContent>
                             <TabsContent value="history" className="mt-4">
                                <OrdersList 
                                    orders={filteredHistoricalOrders}
                                    userMap={userMap}
                                    onOpenDetail={openDetailModal}
                                    onStatusChange={handleStatusChange}
                                    onViewReceipt={setReceiptModalUrl}
                                />
                            </TabsContent>
                        </Tabs>
                    )}
                </CardContent>
            </Card>
        </AuthorizedOnly>
    );
}
