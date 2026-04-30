
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, DollarSign, ShoppingCart, Package, AlertTriangle, ArrowRight, TrendingUp, Clock, UserCheck, BarChart2 } from 'lucide-react';
import { AuthorizedOnly } from '@/components/auth/authorized-only';
import { formatCurrency, cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { format, subDays, startOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import Image from 'next/image';
import { InternalNotificationBanner } from '@/components/admin/internal-notification-banner';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';


export default function AdminDashboardPage() {
    const [stats, setStats] = useState({ revenue: 0, orders: 0 });
    const [lowStockProducts, setLowStockProducts] = useState([]);
    const [recentOrders, setRecentOrders] = useState([]);
    const [salesData, setSalesData] = useState([]);
    const [topProducts, setTopProducts] = useState([]);
    const [salesByCategory, setSalesByCategory] = useState([]);
    const [loading, setLoading] = useState(true);
    const { toast } = useToast();

    useEffect(() => {
        setLoading(true);
        let orders = [];
        let products = [];
        let ordersLoaded = false;
        let productsLoaded = false;

        const checkAndProcessData = () => {
            if (!ordersLoaded || !productsLoaded) return;

            const productsMap = new Map(products.map(p => [p.id, p]));
            const thisMonthStart = startOfMonth(new Date());
            const monthlyOrders = orders.filter(o => o.createdAt >= thisMonthStart && o.status === 'Completado');

            // 1. Monthly stats
            const totalRevenue = monthlyOrders.reduce((sum, o) => sum + o.total, 0);
            setStats({ revenue: totalRevenue, orders: monthlyOrders.length });
            
            // 2. Recent orders
            setRecentOrders(orders.slice(0, 5));

            // 3. Sales data for chart
            const last7DaysStart = subDays(new Date(), 6);
            last7DaysStart.setHours(0, 0, 0, 0);
            
            const dailySales = Array.from({ length: 7 }, (_, i) => {
                const day = subDays(new Date(), 6 - i);
                return { date: format(day, 'dd MMM', { locale: es }), total: 0 };
            });

            orders.filter(o => o.createdAt >= last7DaysStart && o.status === 'Completado').forEach(o => {
                const dayStr = format(o.createdAt, 'dd MMM', { locale: es });
                const dayData = dailySales.find(d => d.date === dayStr);
                if (dayData) {
                    dayData.total += o.total;
                }
            });
            setSalesData(dailySales);
            
            // 4. Low stock products
            const lowStock = [...products].filter(p => !p.isBundle).sort((a, b) => a.stock - b.stock).slice(0, 5);
            setLowStockProducts(lowStock);
            
            // 5. Top selling products (this month)
            const productSales = new Map();
            monthlyOrders.forEach(order => {
                order.items.forEach(item => {
                    const existing = productSales.get(item.id) || { ...item, quantitySold: 0 };
                    existing.quantitySold += item.quantity;
                    productSales.set(item.id, existing);
                });
            });
            const sortedTopProducts = Array.from(productSales.values()).sort((a, b) => b.quantitySold - a.quantitySold).slice(0, 5);
            setTopProducts(sortedTopProducts);

            // 6. Sales by category (this month)
            const categorySales = new Map();
            monthlyOrders.forEach(order => {
                order.items.forEach(item => {
                    const product = productsMap.get(item.id);
                    if (product && product.category) {
                        const category = product.category;
                        const existing = categorySales.get(category) || { name: category, total: 0 };
                        existing.total += item.price * item.quantity;
                        categorySales.set(category, existing);
                    }
                });
            });
            setSalesByCategory(Array.from(categorySales.values()));

            setLoading(false);
        };

        const ordersCol = collection(db, 'orders');
        const unsubOrders = onSnapshot(query(ordersCol, orderBy('createdAt', 'desc')), (snapshot) => {
            orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), createdAt: doc.data().createdAt.toDate() }));
            ordersLoaded = true;
            checkAndProcessData();
        }, async (error) => {
            const permissionError = new FirestorePermissionError({
                path: ordersCol.path,
                operation: 'list',
            });
            errorEmitter.emit('permission-error', permissionError);
        });

        const productsCol = collection(db, 'products');
        const unsubProducts = onSnapshot(query(productsCol), (snapshot) => {
            products = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            productsLoaded = true;
            checkAndProcessData();
        }, async (error) => {
            const permissionError = new FirestorePermissionError({
                path: productsCol.path,
                operation: 'list',
            });
            errorEmitter.emit('permission-error', permissionError);
        });

        return () => {
            unsubOrders();
            unsubProducts();
        };
    }, [toast]);
    
    
    if (loading) {
        return (
            <div className="flex justify-center items-center h-[calc(100vh-10rem)]">
                <Loader2 className="h-16 w-16 animate-spin text-primary" />
            </div>
        );
    }
    
    return (
        <AuthorizedOnly allowedRoles={['ADMIN']}>
            <InternalNotificationBanner />
            <div className="space-y-6">
                 <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-bold">Dashboard</h1>
                        <p className="text-muted-foreground">Una vista general de la actividad de tu tienda.</p>
                    </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Ventas (Este Mes)</CardTitle>
                            <DollarSign className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{formatCurrency(stats.revenue)}</div>
                        </CardContent>
                    </Card>
                     <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Órdenes (Este Mes)</CardTitle>
                            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">+{stats.orders}</div>
                        </CardContent>
                    </Card>
                     <Card>
                        <CardHeader>
                            <CardTitle className="text-sm font-medium flex justify-between items-center">
                                <span>Bajo Stock</span>
                                <AlertTriangle className="h-4 w-4 text-destructive" />
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{lowStockProducts.length}</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Ticket Promedio (Mes)</CardTitle>
                            <TrendingUp className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{formatCurrency(stats.orders > 0 ? stats.revenue / stats.orders : 0)}</div>
                        </CardContent>
                    </Card>
                </div>
                
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                    <Card className="col-span-4">
                        <CardHeader>
                            <CardTitle>Ventas de los Últimos 7 Días</CardTitle>
                        </CardHeader>
                         <CardContent className="pl-2">
                            <ResponsiveContainer width="100%" height={350}>
                                <BarChart data={salesData}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="date" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                                    <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${formatCurrency(value, false)}`} />
                                    <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }} />
                                    <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Ventas"/>
                                </BarChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                     <Card className="col-span-4 lg:col-span-3">
                        <CardHeader className="flex items-center justify-between">
                            <div>
                                <CardTitle>Órdenes Recientes</CardTitle>
                                <CardDescription>Las 5 órdenes más recientes.</CardDescription>
                            </div>
                             <Button asChild variant="outline" size="sm">
                                <Link href="/admin/orders">Ver Todas</Link>
                            </Button>
                        </CardHeader>
                        <CardContent>
                           <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Cliente</TableHead>
                                        <TableHead className="text-right">Monto</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {recentOrders.map(order => (
                                        <TableRow key={order.id}>
                                            <TableCell>
                                                <div className="font-medium">{order.userName}</div>
                                                <div className="text-sm text-muted-foreground">{order.userEmail}</div>
                                            </TableCell>
                                            <TableCell className="text-right">{formatCurrency(order.total)}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                           </Table>
                        </CardContent>
                    </Card>
                </div>
                 <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
                     <Card>
                        <CardHeader>
                            <CardTitle>Productos Más Vendidos (Este Mes)</CardTitle>
                            <CardDescription>Top 5 productos por unidades vendidas.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Producto</TableHead>
                                        <TableHead className="text-right">Unidades Vendidas</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {topProducts.length > 0 ? topProducts.map(product => (
                                        <TableRow key={product.id}>
                                            <TableCell>
                                                <div className="flex items-center gap-3">
                                                    <Image src={product.image} alt={product.name} width={40} height={40} className="rounded-md border" unoptimized />
                                                    <span className="font-medium">{product.name}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right font-bold text-lg">{product.quantitySold}</TableCell>
                                        </TableRow>
                                    )) : (
                                        <TableRow>
                                            <TableCell colSpan={2} className="h-24 text-center">No hay datos de ventas para este mes.</TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader>
                            <CardTitle>Ventas por Categoría (Este Mes)</CardTitle>
                        </CardHeader>
                        <CardContent>
                             <ResponsiveContainer width="100%" height={300}>
                                <BarChart data={salesByCategory} layout="vertical">
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis type="number" tickFormatter={(value) => formatCurrency(value, false)} />
                                    <YAxis dataKey="name" type="category" width={80} />
                                    <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }} formatter={(value) => [formatCurrency(value), 'Ventas']}/>
                                    <Bar dataKey="total" fill="hsl(var(--chart-2))" name="Ventas" radius={[0, 4, 4, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                 </div>
                 <Card>
                    <CardHeader className="flex items-center justify-between">
                        <div>
                            <CardTitle>Productos con Bajo Stock</CardTitle>
                            <CardDescription>Productos (no combos) con las existencias más bajas.</CardDescription>
                        </div>
                        <Button asChild variant="outline" size="sm">
                            <Link href="/admin/inventory/report">Ir a Inventario</Link>
                        </Button>
                    </CardHeader>
                    <CardContent>
                         <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Producto</TableHead>
                                    <TableHead className="text-right">Stock Actual</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {lowStockProducts.map(product => (
                                    <TableRow key={product.id}>
                                        <TableCell>
                                            <div className="font-medium">{product.name}</div>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Badge variant={product.stock <= 5 ? 'destructive' : 'default'}>{product.stock}</Badge>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                         </Table>
                    </CardContent>
                </Card>
            </div>
        </AuthorizedOnly>
    )
}
