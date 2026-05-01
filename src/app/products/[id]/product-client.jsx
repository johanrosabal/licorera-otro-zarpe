

'use client'

import { useParams, notFound, useRouter } from 'next/navigation';
import Link from 'next/link';
import { getProductById, getProducts } from '@/lib/products-service';
import { Button } from '@/components/ui/button';
import { ChevronLeft, Star, MessageSquare, Loader2 } from 'lucide-react';
import { useEffect, useState, useMemo } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/use-auth';
import { ProductDetail } from '@/components/product/product-details';
import { getReviewsForProduct, addReview, hasUserPurchasedProduct } from '@/lib/reviews-service';
import { onSnapshot, collection, query, orderBy, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';

// --- Sub-components for Reviews ---

const ReviewList = ({ reviews }) => (
     <div className="mt-12">
        <h3 className="text-2xl font-headline mb-6 flex items-center gap-2">
            <MessageSquare />
            Opiniones de Clientes ({reviews.length})
        </h3>
        {reviews.length > 0 ? (
            <div className="space-y-6">
                {reviews.map(review => (
                    <div key={review.id} className="border-b pb-4">
                        <div className="flex items-center justify-between">
                            <p className="font-semibold">{review.userName}</p>
                            <span className="text-xs text-muted-foreground">{review.createdAt ? format(review.createdAt.toDate(), "dd MMM yyyy", { locale: es }) : ''}</span>
                        </div>
                         <div className="flex items-center my-1">
                            {[...Array(5)].map((_, i) => (
                                <Star key={i} className={`h-4 w-4 ${i < review.rating ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground'}`} />
                            ))}
                        </div>
                        <p className="text-muted-foreground">{review.comment}</p>
                    </div>
                ))}
            </div>
        ) : (
            <p className="text-muted-foreground">Aún no hay reseñas para este producto. ¡Sé el primero!</p>
        )}
    </div>
);

const ReviewForm = ({ productId, product, user, hasPurchased, loadingPurchaseCheck }) => {
    const [rating, setRating] = useState(0);
    const [comment, setComment] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const { toast } = useToast();

    if (loadingPurchaseCheck) {
        return (
            <Card className="mt-8 mb-12">
                <CardContent className="p-6 flex items-center justify-center text-muted-foreground">
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    <span>Verificando tu historial de compras...</span>
                </CardContent>
            </Card>
        );
    }

    if (!hasPurchased) {
        return (
            <Card className="mt-8 mb-12 bg-muted/50">
                <CardHeader>
                    <CardTitle>Escribe tu reseña</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground">Solo los clientes que han comprado este producto pueden dejar una reseña. Una vez que tu orden esté marcada como "Completado", podrás compartir tu opinión aquí.</p>
                </CardContent>
            </Card>
        );
    }

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (rating === 0) {
            toast({ title: 'Error', description: 'Por favor selecciona una calificación.', variant: 'destructive'});
            return;
        }
        if (!comment.trim()) {
            toast({ title: 'Error', description: 'Por favor escribe un comentario.', variant: 'destructive'});
            return;
        }

        setSubmitting(true);
        try {
            await addReview(productId, {
                userId: user.uid,
                userName: user.name || user.email,
                rating,
                comment,
                productName: product.name,
                productId: product.id,
            });
            toast({ title: '¡Gracias por tu opinión!', description: 'Tu reseña ha sido enviada y será publicada después de ser aprobada.'});
            setRating(0);
            setComment('');
        } catch (error) {
            toast({ title: 'Error', description: 'No se pudo publicar tu reseña.', variant: 'destructive'});
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Card className="mt-8 mb-12">
            <CardHeader>
                <CardTitle>Escribe tu reseña</CardTitle>
                <CardDescription>Comparte tu opinión sobre este producto.</CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <Label>Calificación</Label>
                        <div className="flex items-center gap-1 mt-2">
                             {[...Array(5)].map((_, i) => (
                                <button type="button" key={i} onClick={() => setRating(i + 1)} disabled={submitting}>
                                    <Star className={`h-6 w-6 cursor-pointer transition-colors ${i < rating ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground hover:text-amber-300'}`} />
                                </button>
                            ))}
                        </div>
                    </div>
                     <div>
                        <Label htmlFor="comment">Comentario</Label>
                        <Textarea 
                            id="comment" 
                            placeholder="¿Qué te pareció el producto?" 
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                            disabled={submitting}
                        />
                    </div>
                    <Button type="submit" disabled={submitting}>
                        {submitting && <Loader2 className="animate-spin mr-2"/>}
                        Publicar Reseña
                    </Button>
                </form>
            </CardContent>
        </Card>
    );
};


export default function ProductClient() {
  const params = useParams();
  const id = params.id;
  const router = useRouter();
  const [product, setProduct] = useState(null);
  const [allProducts, setAllProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const [reviews, setReviews] = useState([]);
  const [loadingReviews, setLoadingReviews] = useState(true);
  const [hasPurchased, setHasPurchased] = useState(false);
  const [loadingPurchaseCheck, setLoadingPurchaseCheck] = useState(true);


  useEffect(() => {
    if (!id) return;
    async function fetchData() {
      try {
        setLoading(true);
        const [fetchedProduct, fetchedAllProducts] = await Promise.all([
          getProductById(id),
          getProducts({ activeOnly: true })
        ]);
        
        if (fetchedProduct && fetchedProduct.isTestProduct && user?.role !== 'ADMIN') {
            setProduct(null);
            return;
        }
        
        if (!fetchedProduct || (!fetchedProduct.active && user?.role !== 'ADMIN')) {
          setProduct(null);
          return;
        }
        
        let finalProduct = { ...fetchedProduct };
        if (finalProduct.isBundle) {
            const productsMap = new Map(fetchedAllProducts.map(p => [p.id, p]));
            let calculatedStock = Infinity;
            if (finalProduct.bundleItems && finalProduct.bundleItems.length > 0) {
                for (const bundleItem of finalProduct.bundleItems) {
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
                finalProduct.stock = calculatedStock === Infinity ? 0 : calculatedStock;
            } else {
                 finalProduct.stock = 0;
            }
        }
        
        setProduct(finalProduct);
        setAllProducts(fetchedAllProducts);

      } catch (error) {
        console.error("Failed to fetch product data", error);
        setProduct(null);
      } finally {
        setLoading(false);
      }
    }
    fetchData();

  }, [id, user]);
  
  useEffect(() => {
    if (!id) return;
    
    setLoadingReviews(true);
    const reviewsQuery = query(collection(db, 'products', id, 'reviews'), where("isApproved", "==", true), orderBy('createdAt', 'desc'));
    const unsubscribeReviews = onSnapshot(reviewsQuery, (snapshot) => {
        setReviews(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        setLoadingReviews(false);
    }, (error) => {
        console.error("Error fetching reviews:", error);
        setLoadingReviews(false);
    });

    if (user) {
        setLoadingPurchaseCheck(true);
        hasUserPurchasedProduct(user.uid, id).then(purchased => {
            setHasPurchased(purchased);
            setLoadingPurchaseCheck(false);
        });
    } else {
        setHasPurchased(false);
        setLoadingPurchaseCheck(false);
    }
    
    return () => unsubscribeReviews();

  }, [id, user]);

  const averageRating = useMemo(() => {
    if (reviews.length === 0) return 0;
    const total = reviews.reduce((acc, review) => acc + review.rating, 0);
    return total / reviews.length;
  }, [reviews]);


  if (loading) {
    return <ProductPageSkeleton />;
  }
  
  if (!product) {
      return notFound();
  }

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
         <div className="mb-6">
            <Button asChild variant="outline" className="text-muted-foreground">
            <Link href="/products">
                <ChevronLeft className="mr-2 h-4 w-4" />
                Volver a Productos
            </Link>
            </Button>
        </div>
        <ProductDetail product={product} allProducts={allProducts} averageRating={averageRating} totalReviews={reviews.length} />
         <div className="mt-12 border-t pt-12">
            {user && (
                <ReviewForm 
                    productId={id} 
                    product={product}
                    user={user} 
                    hasPurchased={hasPurchased} 
                    loadingPurchaseCheck={loadingPurchaseCheck}
                />
            )}
            <ReviewList reviews={reviews} />
        </div>
    </div>
  )
}


function ProductPageSkeleton() {
    return (
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12">
            <Skeleton className="h-10 w-40" />
            <div className="grid md:grid-cols-2 gap-8 md:gap-12">
                <Skeleton className="aspect-[4/5] rounded-lg" />
                <div className="flex flex-col justify-center space-y-4">
                    <Skeleton className="h-6 w-24" />
                    <Skeleton className="h-12 w-3/4" />
                    <Skeleton className="h-20 w-full" />
                    <Skeleton className="h-12 w-1/3" />
                    <Skeleton className="h-12 w-1/2" />
                </div>
            </div>
             <div className="space-y-8">
                <Skeleton className="h-10 w-1/3 mx-auto" />
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    <Skeleton className="h-[500px]" />
                    <Skeleton className="h-[500px]" />
                    <Skeleton className="h-[500px]" />
                    <Skeleton className="h-[500px]" />
                </div>
             </div>
        </div>
    )
}
