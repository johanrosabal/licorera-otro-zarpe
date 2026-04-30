
'use client'

import Image from 'next/image'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ShoppingCart, Percent, Heart } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { useCart } from '@/hooks/use-cart'
import { useToast } from '@/hooks/use-toast'
import { useFavorites } from '@/hooks/use-favorites'
import { cn } from '@/lib/utils'

export function ProductCard({ product, onProductClick, priority = false }) {
  const { user } = useAuth();
  const { addToCart } = useCart();
  const { toast } = useToast();
  const { toggleFavorite, isFavorite } = useFavorites();

  const handleAddToCart = (e) => {
    e.preventDefault();
    e.stopPropagation();
    addToCart(product);
    toast({
      title: "Producto añadido",
      description: `${product.name} se ha añadido a tu carrito.`,
    });
  };

  const handleToggleFavorite = (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggleFavorite(product);
  }

  const CardContentWrapper = onProductClick ? 'div' : Link;
  const props = onProductClick 
    ? { onClick: onProductClick, className: "block group" } 
    : { href: `/products/${product.id}`, className: "block group" };

  const isProductFavorite = isFavorite(product.id);


  return (
    <Card className="overflow-hidden transition-all duration-300 ease-in-out hover:shadow-lg hover:shadow-primary/20 border-border/50 hover:border-primary/50 cursor-pointer">
      <CardContentWrapper {...props}>
        <div className="relative w-full aspect-[4/5] bg-white">
          <Image
            src={product.image}
            alt={product.name}
            fill
            data-ai-hint={product.aiHint}
            className="object-contain transition-transform duration-300 group-hover:scale-105"
            unoptimized
            priority={priority}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
          
          <div className="absolute top-2 left-2 flex flex-col items-start gap-2">
            {product.ribbon && product.ribbon !== 'Ninguno' && <Badge variant="default">{product.ribbon}</Badge>}
            {user && (
              <Button variant="ghost" size="icon" className="text-white hover:bg-white/20 hover:text-red-500 rounded-full h-10 w-10 backdrop-blur-sm bg-black/10" onClick={handleToggleFavorite}>
                  <Heart className={cn("transition-all", isProductFavorite ? 'fill-red-500 text-red-500' : 'text-white')} />
              </Button>
            )}
          </div>
          
          {product.hasPromotion && product.promotionPercentage && <Badge variant="destructive" className="absolute top-2 right-2">{product.promotionPercentage}% OFF</Badge>}

          <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
             <div className="flex items-start justify-between gap-2 mb-1">
                <CardTitle className="font-headline text-xl line-clamp-2 leading-tight">{product.name}</CardTitle>
                <Badge variant="outline" className="whitespace-nowrap rounded-none bg-orange-500 text-white">{product.category}</Badge>
             </div>
             
             <div className="flex items-center justify-between text-sm text-white/80">
                {product.unitOfMeasure && (
                    <span>{product.unitOfMeasure}</span>
                )}
                {product.hasAlcohol && product.alcoholGrade && (
                    <div className="flex items-center gap-1">
                        <Percent className="h-4 w-4" />
                        <span>{product.alcoholGrade}% Alc.</span>
                    </div>
                )}
            </div>

            <div className="mt-4">
                <p className="text-2xl font-bold">{formatCurrency(product.sellingPrice)}</p>
                 <div className="mt-4">
                    {user ? (
                    <Button className="w-full" onClick={handleAddToCart} disabled={product.stock === 0}>
                        <ShoppingCart className="mr-2 h-4 w-4" />
                        {product.stock === 0 ? 'Agotado' : 'Agregar al Carrito'}
                    </Button>
                    ) : (
                    <Button asChild className="w-full">
                        <Link href="/signup">Hazte Miembro</Link>
                    </Button>
                    )}
                </div>
            </div>
          </div>
        </div>
      </CardContentWrapper>
    </Card>
  )
}
