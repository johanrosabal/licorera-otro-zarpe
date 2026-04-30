'use client'

import Image from 'next/image';
import Link from 'next/link';
import { formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ShoppingCart, Percent, Heart, Star } from 'lucide-react';
import { useCart } from '@/hooks/use-cart';
import { useToast } from '@/hooks/use-toast';
import { useFavorites } from '@/hooks/use-favorites';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog"
import React, { useEffect, useMemo, useState } from 'react';
import { onSnapshot, collection, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const StarRating = ({ rating, totalReviews }) => {
    if (totalReviews === 0) return null;
    return (
        <div className="flex items-center gap-2 mb-4">
            <div className="flex items-center">
                {[...Array(5)].map((_, i) => (
                    <Star key={i} className={`h-5 w-5 ${i < Math.round(rating) ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground/50'}`} />
                ))}
            </div>
            <span className="text-sm text-muted-foreground">({totalReviews} {totalReviews === 1 ? 'reseña' : 'reseñas'})</span>
        </div>
    );
};


export function ProductDetail({ product, allProducts, averageRating, totalReviews }) {
  const { user } = useAuth();
  const { addToCart } = useCart();
  const { toast } = useToast();

  const productWithCalculatedStock = useMemo(() => {
    if (!product || !product.isBundle) {
        return product;
    }
    
    const productsMap = new Map(allProducts.map(p => [p.id, p]));
    let calculatedStock = Infinity;

    for (const bundleItem of product.bundleItems) {
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
    
    return { ...product, stock: calculatedStock === Infinity ? 0 : calculatedStock };
  }, [product, allProducts]);
  
  const { toggleFavorite, isFavorite } = useFavorites();
  const isProductFavorite = isFavorite(product?.id);
  
  const handleAddToCart = () => {
    if (productWithCalculatedStock) {
        addToCart(productWithCalculatedStock);
        toast({
            title: "Producto añadido",
            description: `${productWithCalculatedStock.name} se ha añadido a tu carrito.`,
        });
    }
  };

  const handleToggleFavorite = () => {
    if (product) {
        toggleFavorite(product);
    }
  };

  if (!productWithCalculatedStock) {
    return null;
  }

  return (
    <div>
       <div className="grid md:grid-cols-2 gap-8 md:gap-12">
        <div className="relative aspect-[4/5] overflow-hidden rounded-lg shadow-lg bg-white">
          <Image
            src={productWithCalculatedStock.image}
            alt={productWithCalculatedStock.name}
            fill
            className="object-contain"
            data-ai-hint={productWithCalculatedStock.aiHint}
            unoptimized
          />
          {productWithCalculatedStock.ribbon && (
            <Badge variant="default" className="absolute top-4 left-4 text-lg">
              {productWithCalculatedStock.ribbon}
            </Badge>
          )}
          {productWithCalculatedStock.hasPromotion && productWithCalculatedStock.promotionPercentage && (
            <Badge variant="destructive" className="absolute top-4 right-4 text-lg">
              {productWithCalculatedStock.promotionPercentage}% OFF
            </Badge>
          )}
        </div>
        <div className="flex flex-col justify-center">
          <div className="flex justify-between items-center mb-2">
            <Badge variant="secondary" className="w-fit">
              {productWithCalculatedStock.category}
            </Badge>
            {productWithCalculatedStock.alcoholGrade && (
              <div className="flex items-center text-sm text-muted-foreground">
                <Percent className="h-4 w-4 mr-1" />
                <span>{productWithCalculatedStock.alcoholGrade}% Alc.</span>
              </div>
            )}
          </div>
          <p className="text-lg mb-4">{productWithCalculatedStock.description}</p>
          <StarRating rating={averageRating} totalReviews={totalReviews} />
          <div className="text-4xl font-bold text-primary mb-6">
            {formatCurrency(productWithCalculatedStock.sellingPrice)}
          </div>
          <div className="flex items-center gap-2">
            <Button size="lg" className="w-full" onClick={handleAddToCart} disabled={productWithCalculatedStock.stock === 0}>
              <ShoppingCart className="mr-2 h-5 w-5" />
              {productWithCalculatedStock.stock === 0 ? "Agotado" : "Agregar al Carrito"}
            </Button>
            {user && (
              <Button size="lg" variant="outline" className="px-3" onClick={handleToggleFavorite}>
                  <Heart className={cn("h-6 w-6 transition-all", isProductFavorite ? "fill-red-500 text-red-500" : "text-muted-foreground")} />
              </Button>
            )}
          </div>
           <Button asChild variant="link" className="mt-4">
              <Link href={`/products/${product.id}`}>
                Ver página completa del producto
              </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}


export function ProductDetailModal({ product, allProducts, open, onOpenChange }) {
    const [isClient, setIsClient] = useState(false);

    useEffect(() => {
        setIsClient(true);
    }, []);
    
    const [reviews, setReviews] = useState([]);
    const [loadingReviews, setLoadingReviews] = useState(true);

    useEffect(() => {
        if (!open || !product) return;
        setLoadingReviews(true);
        const reviewsQuery = query(collection(db, 'products', product.id, 'reviews'), orderBy('createdAt', 'desc'));
        const unsubscribe = onSnapshot(reviewsQuery, (snapshot) => {
            setReviews(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            setLoadingReviews(false);
        }, (error) => {
            console.error("Error fetching reviews:", error);
            setLoadingReviews(false);
        });

        return () => unsubscribe();
    }, [open, product]);

    const averageRating = useMemo(() => {
        if (reviews.length === 0) return 0;
        const total = reviews.reduce((acc, review) => acc + review.rating, 0);
        return total / reviews.length;
    }, [reviews]);

    if (!isClient || !product) {
        return null;
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogTitle className="font-headline text-3xl md:text-4xl text-left">{product.name}</DialogTitle>
                <ProductDetail product={product} allProducts={allProducts} averageRating={averageRating} totalReviews={reviews.length}/>
            </DialogContent>
        </Dialog>
    );
}
