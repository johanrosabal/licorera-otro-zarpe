

'use client'

import React, { useState, useEffect, useMemo } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, DollarSign, ShoppingCart, Percent, Calendar as CalendarIcon } from 'lucide-react';
import { AuthorizedOnly } from '@/components/auth/authorized-only';
import { formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format, subDays, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from 'date-fns';
import { es } from 'date-fns/locale';
import Image from 'next/image';
import { collection, onSnapshot, query, where, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from "recharts";

const dateRanges = [
    { label: 'Hoy', value: 'today', getRange: () => ({ from: new Date(), to: new Date() }) },
    { label: 'Ayer', value: 'yesterday', getRange: () => ({ from: subDays(new Date(), 1), to: subDays(new Date(), 1) }) },
    { label: 'Últimos 7 días', value: 'last7', getRange: () => ({ from: subDays(new Date(), 6), to: new Date() }) },
    { label: 'Esta semana', value: 'thisWeek', getRange: () => ({ from: startOfWeek(new Date(), { locale: es }), to: endOfWeek(new Date(), { locale: es }) }) },
    { label: 'Este mes', value: 'thisMonth', getRange: () => ({ from: startOfMonth(new Date()), to: endOfMonth(new Date()) }) },
    { label: 'Mes pasado', value: 'lastMonth', getRange: () => ({ from: startOfMonth(subDays(new Date(), new Date().getDate())), to: endOfMonth(subDays(new Date(), new Date().getDate())) }) },
];


export default function SalesReportPage() {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const { toast } = useToast();

    // Filter states
    const [dateRange, setDateRange] = useState(dateRanges.find(r => r.value === 'thisMonth').getRange());
    const [activeDateRange, setActiveDateRange] = useState('thisMonth');

    useEffect(() => {
        setLoading(true);
        const q = query(
            collection(db, 'orders'),
            where('status', '==', 'Completado'),
            orderBy('createdAt', 'desc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedOrders = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                createdAt: doc.data().createdAt.toDate() // Convert Firestore Timestamp to JS Date
            }));
            setOrders(fetchedOrders);
            setLoading(false);
        }, (error) => {
            console.error(error);
            toast({ title: 'Error', description: 'No se pudieron cargar las órdenes.', variant: 'destructive' });
            setLoading(false);
        });

        return () => unsubscribe();
    }, [toast]);
    
    const filteredOrders = useMemo(() => {
        if (!dateRange || !dateRange.from) return orders;
        
        const fromDate = new Date(dateRange.from.setHours(0, 0, 0, 0));
        const toDate = dateRange.to ? new Date(dateRange.to.setHours(23, 59, 59, 999)) : fromDate;

        return orders.filter(order => {
            const orderDate = order.createdAt;
            return orderDate >= fromDate && orderDate <= toDate;
        });
    }, [orders, dateRange]);


    const salesMetrics = useMemo(() => {
        return filteredOrders.reduce((acc, order) => {
            acc.totalRevenue += order.total;
            acc.totalOrders += 1;
            acc.totalItemsSold += order.items.reduce((itemSum, item) => itemSum + item.quantity, 0);
            return acc;
        }, { totalRevenue: 0, totalOrders: 0, totalItemsSold: 0 });
    }, [filteredOrders]);

    const topProducts = useMemo(() => {
        const productMap = new Map();
        filteredOrders.forEach(order => {
            order.items.forEach(item => {
                if (productMap.has(item.id)) {
                    const existing = productMap.get(item.id);
                    existing.quantitySold += item.quantity;
                    existing.totalRevenue += item.price * item.quantity;
                } else {
                    productMap.set(item.id, {
                        id: item.id,
                        name: item.name,
                        image: item.image,
                        quantitySold: item.quantity,
                        totalRevenue: item.price * item.quantity
                    });
                }
            });
        });
        return Array.from(productMap.values()).sort((a, b) => b.quantitySold - a.quantitySold);
    }, [filteredOrders]);
    
    const chartData = useMemo(() => {
        const data = filteredOrders.reduce((acc, order) => {
            const date = format(order.createdAt, 'dd MMM');
            if (!acc[date]) {
                acc[date] = { date, total: 0 };
            }
            acc[date].total += order.total;
            return acc;
        }, {});
        return Object.values(data).sort((a, b) => new Date(a.date) - new Date(b.date));
    }, [filteredOrders]);

    const handleDateRangePreset = (value) => {
        setActiveDateRange(value);
        const range = dateRanges.find(r => r.value === value);
        if (range) {
            setDateRange(range.getRange());
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
            </div>
        );
    }
    

    return (
        <AuthorizedOnly allowedRoles={['ADMIN']}>
            <div className="space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Reporte de Ventas</CardTitle>
                        <CardDescription>
                            Análisis de las órdenes completadas en el período seleccionado.
                        </CardDescription>
                    </CardHeader>
                     <CardContent>
                        <div className="flex flex-wrap gap-2 items-center">
                             {dateRanges.map(range => (
                                <Button 
                                    key={range.value} 
                                    variant={activeDateRange === range.value ? 'default' : 'outline'}
                                    onClick={() => handleDateRangePreset(range.value)}
                                >
                                    {range.label}
                                </Button>
                            ))}
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        id="date"
                                        variant={"outline"}
                                        className={cn(
                                            "w-[300px] justify-start text-left font-normal",
                                            !dateRange && "text-muted-foreground",
                                            !dateRanges.some(r => r.value === activeDateRange) && "border-primary"
                                        )}
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
                                            <span>Selecciona una fecha</span>
                                        )}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar
                                        initialFocus
                                        mode="range"
                                        defaultMonth={dateRange?.from}
                                        selected={dateRange}
                                        onSelect={(range) => { setDateRange(range); setActiveDateRange('custom'); }}
                                        numberOfMonths={2}
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>
                    </CardContent>
                </Card>

                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Ventas Totales</CardTitle>
                            <DollarSign className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{formatCurrency(salesMetrics.totalRevenue)}</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Órdenes Completadas</CardTitle>
                            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{salesMetrics.totalOrders}</div>
                        </CardContent>
                    </Card>
                     <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Valor Promedio por Orden</CardTitle>
                             <DollarSign className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">
                                {formatCurrency(salesMetrics.totalOrders > 0 ? salesMetrics.totalRevenue / salesMetrics.totalOrders : 0)}
                            </div>
                        </CardContent>
                    </Card>
                     <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total de Productos Vendidos</CardTitle>
                            <Percent className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{salesMetrics.totalItemsSold}</div>
                        </CardContent>
                    </Card>
                </div>

                 <Card>
                    <CardHeader>
                        <CardTitle>Ventas por Día</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={350}>
                             <BarChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="date" />
                                <YAxis tickFormatter={(value) => formatCurrency(value, false)} />
                                <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }} labelStyle={{ color: 'hsl(var(--foreground))' }} formatter={(value) => [formatCurrency(value), 'Ventas']} />
                                <Legend />
                                <Bar dataKey="total" fill="hsl(var(--primary))" name="Ventas" />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Productos Más Vendidos</CardTitle>
                        <CardDescription>Productos con más unidades vendidas en el período seleccionado.</CardDescription>
                    </CardHeader>
                    <CardContent>
                         <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[80px]">#</TableHead>
                                    <TableHead>Producto</TableHead>
                                    <TableHead className="text-right">Unidades Vendidas</TableHead>
                                    <TableHead className="text-right">Ingresos Generados</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {topProducts.length > 0 ? (
                                    topProducts.map((product, index) => (
                                        <TableRow key={product.id}>
                                             <TableCell>{index + 1}</TableCell>
                                             <TableCell>
                                                <div className="flex items-center gap-3">
                                                    <Image src={product.image} alt={product.name} width={40} height={40} className="rounded-md object-cover" unoptimized/>
                                                    <span className="font-medium">{product.name}</span>
                                                </div>
                                            </TableCell>
                                             <TableCell className="text-right font-semibold text-lg">{product.quantitySold}</TableCell>
                                             <TableCell className="text-right">{formatCurrency(product.totalRevenue)}</TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={4} className="h-24 text-center">
                                            No hay datos de ventas para el período seleccionado.
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

