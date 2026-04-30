'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useFavorites } from '@/hooks/use-favorites';
import { getProducts } from '@/lib/products-service';
import { Loader2, HeartCrack } from 'lucide-react';
import { ProductCard } from '@/components/product-card';
import { ProductDetailModal } from '@/components/product/product-details';
import { AuthorizedOnly } from '@/components/auth/authorized-only';
import { useCart } from '@/hooks/use-cart';

export default function FavoritesPage() {
    const { user } = useAuth();
    const { favoriteIds, isInitialized: favoritesInitialized } = useFavorites();
    const { isInitialized: cartInitialized } = useCart();
    
    const [allProducts, setAllProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    useEffect(() => {
        if (favoritesInitialized) {
            getProducts()
                .then(products => {
                    setAllProducts(products);
                })
                .catch(err => {
                    console.error("Failed to fetch products for favorites page", err);
                })
                .finally(() => setLoading(false));
        }
    }, [favoritesInitialized]);

    const favoriteProducts = useMemo(() => {
        if (!favoritesInitialized || allProducts.length === 0) {
            return [];
        }
        return allProducts.filter(product => favoriteIds.includes(product.id));
    }, [favoriteIds, allProducts, favoritesInitialized]);

    const handleProductClick = (product) => {
        setSelectedProduct(product);
        setIsModalOpen(true);
    };

    if (!favoritesInitialized || loading || !cartInitialized) {
        return (
            <div className="flex justify-center items-center h-[60vh]">
                <Loader2 className="h-16 w-16 animate-spin text-primary" />
            </div>
        );
    }
    
    return (
        <AuthorizedOnly allowedRoles={['ADMIN', 'DELIVERY', 'CLIENT']}>
            <ProductDetailModal
                product={selectedProduct}
                allProducts={allProducts}
                open={isModalOpen}
                onOpenChange={setIsModalOpen}
            />
            <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="space-y-8">
                    <div>
                        <h1 className="font-headline text-4xl md:text-5xl text-center mb-2">Mis Productos Favoritos</h1>
                        <p className="text-lg text-muted-foreground text-center max-w-2xl mx-auto">
                            Aquí están todos los productos que has guardado.
                        </p>
                    </div>

                    {favoriteProducts.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                            {favoriteProducts.map((product) => (
                                <ProductCard key={product.id} product={product} onProductClick={() => handleProductClick(product)} />
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-16 text-muted-foreground border-2 border-dashed rounded-lg">
                            <HeartCrack className="mx-auto h-16 w-16 mb-4 opacity-50" />
                            <h3 className="text-2xl font-headline">Aún no tienes favoritos</h3>
                            <p className="mt-2">Explora nuestros productos y haz clic en el corazón para guardarlos aquí.</p>
                        </div>
                    )}
                </div>
            </div>
        </AuthorizedOnly>
    );
}
