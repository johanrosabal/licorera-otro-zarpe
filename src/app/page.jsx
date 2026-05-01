'use client'

import Image from 'next/image'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowRight, Search, Construction, Wine, Clock } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { useEffect, useState, useMemo } from 'react'
import { db } from '@/lib/firebase'
import { collection, onSnapshot, query, where, orderBy, doc } from 'firebase/firestore'
import { CategoriesCarousel } from '@/components/categories-carousel'
import { ProductCard } from '@/components/product-card'
import { ProductDetailModal } from '@/components/product/product-details'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/hooks/use-auth'

export default function Home() {
  const [allProducts, setAllProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [featuredSearchTerm, setFeaturedSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const handleProductClick = (product) => {
    setSelectedProduct(product);
    setIsModalOpen(true);
  };
  
  useEffect(() => {
    const productsQuery = query(
      collection(db, 'products'),
      where("active", "==", true)
    );
    
    setLoading(true);
    const allProductsUnsubscribe = onSnapshot(productsQuery, (snapshot) => {
        setAllProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        setLoading(false);
    }, (err) => {
        console.error(err);
        setLoading(false);
    });

    // Listener for active categories
    const categoriesQuery = query(collection(db, 'categories'), where("active", "==", true), orderBy("name"));
    const categoriesUnsubscribe = onSnapshot(categoriesQuery, (snapshot) => {
       setCategories(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
        allProductsUnsubscribe();
        categoriesUnsubscribe();
    }
  }, []);
  
  const productsWithCalculatedStock = useMemo(() => {
    const productsMap = new Map(allProducts.map(p => [p.id, p]));
    return allProducts.map(p => {
        if (!p.isBundle || !p.bundleItems || p.bundleItems.length === 0) {
            return p;
        }

        let calculatedStock = Infinity;
        for (const bundleItem of p.bundleItems) {
            const component = productsMap.get(bundleItem.productId);
            if (!component || component.stock === 0) {
                calculatedStock = 0;
                break;
            }
            const possibleCombos = Math.floor(component.stock / bundleItem.quantity);
            if (possibleCombos < calculatedStock) {
                calculatedStock = possibleCombos;
            }
        }

        return { ...p, stock: calculatedStock === Infinity ? 0 : calculatedStock };
    });
  }, [allProducts]);

  const visibleProducts = useMemo(() => {
    // If user is not an admin, filter out test products.
    if (user?.role !== 'ADMIN') {
        return productsWithCalculatedStock.filter(p => !p.isTestProduct);
    }
    return productsWithCalculatedStock;
  }, [productsWithCalculatedStock, user]);
  
  const featuredProducts = useMemo(() => {
    return visibleProducts.filter(p => p.featured && p.stock > 0);
  }, [visibleProducts]);

  const filteredGridProducts = useMemo(() => {
    return featuredProducts.filter(p => p.name.toLowerCase().includes(featuredSearchTerm.toLowerCase()));
  }, [featuredProducts, featuredSearchTerm]);


  const promotionalProducts = useMemo(() => {
    return visibleProducts.filter(p => p.hasPromotion && p.promotionPercentage && p.stock > 0);
  }, [visibleProducts]);

  const categoriesWithCounts = useMemo(() => {
    const productCounts = visibleProducts.reduce((acc, product) => {
      if (product.stock > 0) {
        const categoryName = product.category;
        if (categoryName) {
            acc[categoryName] = (acc[categoryName] || 0) + 1;
        }
      }
      return acc;
    }, {});

    return categories.map(category => ({
      ...category,
      productCount: productCounts[category.name] || 0
    })).filter(category => category.productCount > 0);
  }, [categories, visibleProducts]);


  return (
    <main className="animate-blur-in">
      <ProductDetailModal 
          product={selectedProduct} 
          allProducts={allProducts} 
          open={isModalOpen} 
          onOpenChange={setIsModalOpen}
      />
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-16">
        {categoriesWithCounts.length > 0 && (
          <section>
            <div className="flex justify-between items-baseline mb-6">
              <h2 className="font-headline text-3xl md:text-4xl">Explorar Categorías</h2>
              <Button asChild variant="link" className="text-primary uppercase text-lg font-bold">
                  <Link href="/products">Ver todos los productos <ArrowRight className="ml-1 h-4 w-4" /></Link>
              </Button>
            </div>
            <CategoriesCarousel categories={categoriesWithCounts} />
          </section>
        )}

        {featuredProducts.length > 0 && (
          <section>
              <div className="flex flex-col md:flex-row md:justify-between md:items-baseline mb-6 gap-4">
                  <div className="w-full">
                    <div className="relative w-full">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                        <Input
                            placeholder="Filtrar productos..."
                            className="pl-10 w-full"
                            value={featuredSearchTerm}
                            onChange={(e) => setFeaturedSearchTerm(e.target.value)}
                        />
                    </div>
                    <p className="text-sm text-muted-foreground mt-2">Puedes escribir para filtrar encontrar un producto rapidamente</p>
                  </div>
              </div>
              {filteredGridProducts.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  {filteredGridProducts.map((product, index) => (
                      <ProductCard key={product.id} product={product} onProductClick={() => handleProductClick(product)} priority={index < 4} />
                  ))}
                  </div>
              ) : (
                  <div className="text-center py-16 text-muted-foreground">
                      <Search className="mx-auto h-16 w-16 mb-4 opacity-50" />
                      <h3 className="text-xl font-semibold">No se encontraron resultados</h3>
                      <p>Intenta con un término de búsqueda diferente.</p>
                  </div>
              )}
          </section>
        )}


        {promotionalProducts.length > 0 && (
          <section>
            <h2 className="font-headline text-3xl md:text-4xl text-primary text-center mb-6">Promociones Especiales</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {promotionalProducts.map((product) => (
                <div key={product.id} onClick={() => handleProductClick(product)} className="group relative overflow-hidden rounded-lg block cursor-pointer">
                  <Image
                    src={product.image}
                    alt={product.name}
                    width={600}
                    height={400}
                    data-ai-hint={product.aiHint}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    unoptimized
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                  <div className="absolute bottom-0 left-0 p-6 text-white">
                    <h3 className="font-headline text-2xl">{product.name}</h3>
                    {product.hasPromotion && product.promotionPercentage && (
                      <p className="text-lg font-bold text-accent">{product.promotionPercentage}% OFF</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {!loading && visibleProducts.length === 0 && (
          <section className="flex flex-col items-center justify-center py-20 text-center space-y-6 animate-in fade-in zoom-in duration-500">
            <div className="relative">
                <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full" />
                <Construction className="h-24 w-24 text-primary relative z-10 animate-pulse" />
            </div>
            <div className="space-y-2 relative z-10">
                <h2 className="text-4xl md:text-6xl font-headline bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                    Próximamente
                </h2>
                <p className="text-xl text-muted-foreground max-w-lg mx-auto">
                    Estamos preparando nuestra mejor selección para ti. <br />
                    Vuelve pronto para descubrir experiencias exclusivas.
                </p>
            </div>
            <div className="flex gap-4 pt-4">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground bg-muted/50 px-4 py-2 rounded-full border border-primary/10">
                    <Clock className="h-4 w-4" />
                    Apertura Inminente
                </div>
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground bg-muted/50 px-4 py-2 rounded-full border border-primary/10">
                    <Wine className="h-4 w-4" />
                    Selección Premium
                </div>
            </div>
          </section>
        )}
      </div>
    </main>
  )
}
