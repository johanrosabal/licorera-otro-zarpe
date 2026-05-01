

'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Search, FilterX, TrendingUp, DollarSign, Package, BadgePercent } from 'lucide-react';
import { AuthorizedOnly } from '@/components/auth/authorized-only';
import { formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { collection, onSnapshot, query, where, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getHomepageSettings } from '@/lib/settings';
import { FileDown } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function SalesProjectionPage() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedBrand, setSelectedBrand] = useState('all');
  const [siteName, setSiteName] = useState('OTRO ZARPE');

  useEffect(() => {
    getHomepageSettings().then(settings => {
      if (settings?.siteName) setSiteName(settings.siteName);
    });
  }, []);

  useEffect(() => {
    setLoading(true);

    const productsQuery = query(collection(db, 'products'), orderBy('name'));
    const categoriesQuery = query(collection(db, 'categories'), where("active", "==", true), orderBy("name"));
    const brandsQuery = query(collection(db, 'brands'), where("active", "==", true), orderBy("name"));

    const unsubProducts = onSnapshot(productsQuery, (snapshot) => {
        setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        setLoading(false);
    }, (error) => {
        toast({ title: 'Error', description: 'No se pudieron cargar los productos.', variant: 'destructive' });
        console.error(error);
        setLoading(false);
    });
    
    const unsubCategories = onSnapshot(categoriesQuery, (snapshot) => {
        setCategories(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubBrands = onSnapshot(brandsQuery, (snapshot) => {
        setBrands(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubProducts();
      unsubCategories();
      unsubBrands();
    };
  }, [toast]);
  
  const saleableProducts = useMemo(() => {
    return products.filter(p => p.active && !p.internalOnly && p.stock > 0);
  }, [products]);


  const filteredProducts = useMemo(() => {
    return products.filter(product => {
      const searchTermLower = searchTerm.toLowerCase();
      
      const searchMatch = searchTerm === '' ||
        product.name.toLowerCase().includes(searchTermLower);
        
      const categoryMatch = selectedCategory === 'all' || product.category === selectedCategory;
      const brandMatch = selectedBrand === 'all' || product.brand === selectedBrand;

      return searchMatch && categoryMatch && brandMatch;
    });
  }, [products, searchTerm, selectedCategory, selectedBrand]);

  const totals = useMemo(() => {
    return saleableProducts.reduce((acc, product) => {
        const costPrice = product.costPrice || 0;
        const sellingPrice = product.sellingPrice || 0;
        const stock = product.stock || 0;

        acc.totalCost += costPrice * stock;
        acc.totalProjectedSales += sellingPrice * stock;
        return acc;
    }, { totalCost: 0, totalProjectedSales: 0 });
  }, [saleableProducts]);
  
  const projectedProfit = totals.totalProjectedSales - totals.totalCost;


  const resetFilters = () => {
    setSearchTerm('');
    setSelectedCategory('all');
    setSelectedBrand('all');
  };

  const generatePDF = () => {
    const doc = new jsPDF();
    const dateStr = format(new Date(), 'dd/MM/yyyy HH:mm', { locale: es });
    
    // Helper to fix the CRC symbol issue in PDF by removing it entirely
    const pdfFormatCurrency = (amount) => formatCurrency(amount, false);

    // Header
    const parts = siteName.split(' ');
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text(parts[0], 20, 20);
    
    if (parts.length > 1) {
      doc.setTextColor(220, 38, 38); // Red-600
      doc.setFont('helvetica', 'bolditalic');
      doc.text(parts.slice(1).join(' '), 20 + doc.getTextWidth(parts[0]) + 2, 20);
    }

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text('REPORTE DE PROYECCIÓN DE VENTAS Y GANANCIAS', 20, 28);
    doc.text(`Fecha: ${dateStr}`, 20, 34);

    // Summary Section
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text('Resumen General', 20, 45);

    autoTable(doc, {
      startY: 50,
      head: [['Concepto', 'Monto Total']],
      body: [
        ['Proyección de Ventas (Stock Total)', pdfFormatCurrency(totals.totalProjectedSales)],
        ['Costo de Inventario (Stock Total)', pdfFormatCurrency(totals.totalCost)],
        ['Ganancia Bruta Proyectada', pdfFormatCurrency(projectedProfit)],
        ['Margen Bruto Promedio', `${((projectedProfit / totals.totalProjectedSales) * 100).toFixed(2)}%`]
      ],
      theme: 'grid',
      headStyles: { fillStyle: 'red', fillColor: [220, 38, 38] },
      styles: { fontSize: 10, cellPadding: 3 }
    });

    // Details Section
    doc.setFontSize(14);
    doc.text('Detalle por Producto', 20, doc.lastAutoTable.finalY + 15);

    const tableData = filteredProducts.map(p => {
        const cost = p.costPrice || 0;
        const sell = p.sellingPrice || 0;
        const stock = p.stock || 0;
        const profit = (sell - cost) * stock;
        const margin = sell > 0 ? ((sell - cost) / sell) * 100 : 0;
        return [
            p.name,
            stock,
            pdfFormatCurrency(cost),
            pdfFormatCurrency(sell),
            pdfFormatCurrency(sell * stock),
            pdfFormatCurrency(profit),
            `${margin.toFixed(1)}%`
        ];
    });

    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 20,
      head: [['Producto', 'Stock', 'Costo U.', 'Venta U.', 'Venta T.', 'Ganancia', 'Margen']],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: [31, 41, 55] }, // Slate-800
      styles: { fontSize: 8 },
      columnStyles: {
        1: { halign: 'right' },
        2: { halign: 'right' },
        3: { halign: 'right' },
        4: { halign: 'right' },
        5: { halign: 'right' },
        6: { halign: 'right' }
      }
    });

    // Add Pagination Footer
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(10);
        doc.setTextColor(150, 150, 150);
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        
        // Horizontal line
        doc.setDrawColor(200, 200, 200);
        doc.line(20, pageHeight - 15, pageWidth - 20, pageHeight - 15);
        
        // Page info
        doc.text(`Página ${i} de ${pageCount}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
        doc.text(siteName, 20, pageHeight - 10);
        doc.text(dateStr, pageWidth - 20, pageHeight - 10, { align: 'right' });
    }

    doc.save(`Proyeccion_Ventas_${format(new Date(), 'yyyyMMdd')}.pdf`);
  };

  return (
    <AuthorizedOnly allowedRoles={['ADMIN']}>
      <div className="space-y-6">
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Proyección de Ventas y Ganancias</CardTitle>
                    <CardDescription>
                        Una estimación del valor del inventario actual a precio de venta y costo.
                    </CardDescription>
                </div>
                <Button onClick={generatePDF} className="bg-red-600 hover:bg-red-700 shadow-md transition-all">
                    <FileDown className="mr-2 h-4 w-4" />
                    Exportar PDF
                </Button>
            </CardHeader>
            <CardContent>
                <div className="grid gap-4 md:grid-cols-3">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Proyección de Ventas</CardTitle>
                            <TrendingUp className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{formatCurrency(totals.totalProjectedSales)}</div>
                            <p className="text-xs text-muted-foreground">Valor total del stock a precio de venta.</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Costo de Inventario</CardTitle>
                            <Package className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{formatCurrency(totals.totalCost)}</div>
                             <p className="text-xs text-muted-foreground">Valor total del stock a precio de costo.</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Ganancia Proyectada</CardTitle>
                            <DollarSign className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{formatCurrency(projectedProfit)}</div>
                             <p className="text-xs text-muted-foreground">Diferencia entre venta y costo.</p>
                        </CardContent>
                    </Card>
                </div>
            </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Desglose de Inventario</CardTitle>
            <CardDescription>Análisis detallado de cada producto en el inventario.</CardDescription>
            <div className="mt-6 border-t pt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="relative lg:col-span-2">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                      <Input
                          placeholder="Buscar por nombre..."
                          className="pl-10 w-full"
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                      />
                    </div>
                    <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                      <SelectTrigger><SelectValue placeholder="Categoría" /></SelectTrigger>
                      <SelectContent>
                          <SelectItem value="all">Todas las categorías</SelectItem>
                          {categories.map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <div className="flex gap-2">
                        <Select value={selectedBrand} onValueChange={setSelectedBrand}>
                        <SelectTrigger><SelectValue placeholder="Marca" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todas las marcas</SelectItem>
                            {brands.map(b => <SelectItem key={b.id} value={b.name}>{b.name}</SelectItem>)}
                        </SelectContent>
                        </Select>
                        <Button variant="ghost" onClick={resetFilters} className="h-10">
                            <FilterX className="h-5 w-5" />
                        </Button>
                    </div>
                </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Desktop Table View */}
            <Table className="hidden md:table">
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead className="text-right">Stock</TableHead>
                  <TableHead className="text-right">Costo Unit.</TableHead>
                  <TableHead className="text-right">Venta Unit.</TableHead>
                  <TableHead className="text-right">Valor Costo Total</TableHead>
                  <TableHead className="text-right">Valor Venta Total</TableHead>
                  <TableHead className="text-right">Ganancia Proyectada</TableHead>
                   <TableHead className="text-right">Margen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center h-64">
                      <Loader2 className="mx-auto animate-spin h-10 w-10" />
                    </TableCell>
                  </TableRow>
                ) : filteredProducts.length > 0 ? (
                  filteredProducts.map((product) => {
                    const costPrice = product.costPrice || 0;
                    const sellingPrice = product.sellingPrice || 0;
                    const stock = product.stock || 0;
                    const totalCostValue = costPrice * stock;
                    const totalSellValue = sellingPrice * stock;
                    const profit = totalSellValue - totalCostValue;
                    const margin = sellingPrice > 0 ? ((sellingPrice - costPrice) / sellingPrice) * 100 : 0;
                    
                    const rowClass = product.internalOnly ? "bg-muted/30 text-muted-foreground" : (product.active ? "" : "opacity-50");

                    return (
                        <TableRow key={product.id} className={rowClass}>
                        <TableCell>
                            <div className="flex items-center gap-3">
                                <Image
                                    alt={product.name}
                                    className="aspect-square rounded-md object-cover"
                                    height="40"
                                    src={product.image || "https://picsum.photos/100/100"}
                                    width="40"
                                    unoptimized
                                />
                                <div>
                                    <p className="font-medium">{product.name}</p>
                                    <div className="flex gap-2 mt-1">
                                    {product.internalOnly && <Badge variant="secondary">Interno</Badge>}
                                    {!product.active && !product.internalOnly && <Badge variant="destructive">Inactivo</Badge>}
                                    </div>
                                </div>
                            </div>
                        </TableCell>
                        <TableCell className="text-right font-semibold">{stock}</TableCell>
                        <TableCell className="text-right">{formatCurrency(costPrice)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(sellingPrice)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(totalCostValue)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(totalSellValue)}</TableCell>
                        <TableCell className="text-right font-bold text-green-500">{formatCurrency(profit)}</TableCell>
                        <TableCell className="text-right">
                           <Badge variant={margin > 0 ? "default" : "destructive"} className={margin > 0 ? 'bg-green-500/20 text-green-700' : ''}>
                                {margin.toFixed(1)}%
                            </Badge>
                        </TableCell>
                        </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground h-48">
                      No hay productos que coincidan con los filtros.
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
              ) : filteredProducts.length > 0 ? (
                filteredProducts.map((product) => {
                  const costPrice = product.costPrice || 0;
                  const sellingPrice = product.sellingPrice || 0;
                  const stock = product.stock || 0;
                  const totalCostValue = costPrice * stock;
                  const totalSellValue = sellingPrice * stock;
                  const profit = totalSellValue - totalCostValue;
                  const margin = sellingPrice > 0 ? ((sellingPrice - costPrice) / sellingPrice) * 100 : 0;
                  
                  const cardClass = product.internalOnly ? "bg-muted/30 text-muted-foreground" : (product.active ? "" : "opacity-50");

                  return (
                    <Card key={product.id} className={cardClass}>
                      <CardHeader className="p-4 flex flex-row items-center gap-4">
                        <Image
                          alt={product.name}
                          className="aspect-square rounded-md object-cover"
                          height="48"
                          src={product.image || "https://picsum.photos/100/100"}
                          width="48"
                          unoptimized
                        />
                        <div>
                          <CardTitle className="text-base">{product.name}</CardTitle>
                          <div className="flex gap-2 mt-1">
                            {product.internalOnly && <Badge variant="secondary">Interno</Badge>}
                            {!product.active && !product.internalOnly && <Badge variant="destructive">Inactivo</Badge>}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="p-4 pt-0 text-sm space-y-2">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Ganancia Proyectada</span>
                            <span className="font-bold text-lg text-green-500">{formatCurrency(profit)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Margen</span>
                             <Badge variant={margin > 0 ? "default" : "destructive"} className={margin > 0 ? 'bg-green-500/20 text-green-700' : ''}>
                                {margin.toFixed(1)}%
                            </Badge>
                          </div>
                           <div className="flex justify-between">
                            <span className="text-muted-foreground">Stock</span>
                            <span className="font-semibold">{stock}</span>
                          </div>
                      </CardContent>
                       <CardFooter className="p-4 pt-0 grid grid-cols-2 gap-2 text-xs">
                          <div className="text-muted-foreground">Costo Total: <p className="font-semibold text-foreground">{formatCurrency(totalCostValue)}</p></div>
                          <div className="text-muted-foreground">Venta Total: <p className="font-semibold text-foreground">{formatCurrency(totalSellValue)}</p></div>
                       </CardFooter>
                    </Card>
                  )
                })
              ) : (
                <div className="text-center py-16 text-muted-foreground">
                  <p>No hay productos que coincidan con los filtros.</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </AuthorizedOnly>
  );
}
