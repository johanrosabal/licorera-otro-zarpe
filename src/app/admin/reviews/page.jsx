'use client';

import React, { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Loader2, MessageSquare, Check, X, Star } from 'lucide-react';
import { AuthorizedOnly } from '@/components/auth/authorized-only';
import { Button } from '@/components/ui/button';
import { collectionGroup, onSnapshot, query, where, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import Link from 'next/link';
import { updateReview, deleteReview } from '@/lib/reviews-service';


export default function AdminReviewsPage() {
    const [reviews, setReviews] = useState([]);
    const [loading, setLoading] = useState(true);
    const { toast } = useToast();

    useEffect(() => {
        setLoading(true);
        const q = query(
            collectionGroup(db, 'reviews'),
            where('isApproved', '==', false),
            orderBy('createdAt', 'desc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedReviews = snapshot.docs.map(doc => ({
                id: doc.id,
                productId: doc.ref.parent.parent.id, // Get product ID from path
                ...doc.data()
            }));
            setReviews(fetchedReviews);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching pending reviews:", error);
            toast({ title: "Error", description: "No se pudieron cargar las reseñas pendientes.", variant: "destructive" });
            setLoading(false);
        });

        return () => unsubscribe();
    }, [toast]);

    const handleApprove = async (review) => {
        try {
            await updateReview(review.productId, review.id, { isApproved: true });
            toast({ title: "Reseña Aprobada", description: "La reseña ahora es pública." });
        } catch (error) {
            toast({ title: "Error", description: "No se pudo aprobar la reseña.", variant: "destructive" });
        }
    };

    const handleReject = async (review) => {
        try {
            await deleteReview(review.productId, review.id);
            toast({ title: "Reseña Rechazada", description: "La reseña ha sido eliminada.", variant: "destructive" });
        } catch (error) {
            toast({ title: "Error", description: "No se pudo rechazar la reseña.", variant: "destructive" });
        }
    };
    
    if (loading) {
        return (
            <div className="flex justify-center items-center h-[60vh]">
                <Loader2 className="h-16 w-16 animate-spin text-primary" />
            </div>
        );
    }
    
    return (
        <AuthorizedOnly allowedRoles={['ADMIN']}>
            <div className="space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Reseñas Pendientes de Aprobación</CardTitle>
                        <CardDescription>
                            Aquí puedes aprobar o rechazar las nuevas reseñas de los clientes antes de que sean públicas.
                        </CardDescription>
                    </CardHeader>
                </Card>

                {reviews.length > 0 ? (
                    <div className="space-y-4">
                        {reviews.map(review => (
                            <Card key={review.id}>
                                <CardHeader>
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <CardTitle className="text-lg font-semibold">{review.userName}</CardTitle>
                                            <CardDescription>
                                                Para el producto: <Link href={`/products/${review.productId}`} className="text-primary hover:underline">{review.productName}</Link>
                                            </CardDescription>
                                            <div className="text-xs text-muted-foreground mt-1">
                                                {review.createdAt ? formatDistanceToNow(review.createdAt.toDate(), { locale: es, addSuffix: true }) : ''}
                                            </div>
                                        </div>
                                        <div className="flex items-center">
                                            {[...Array(5)].map((_, i) => (
                                                <Star key={i} className={`h-5 w-5 ${i < review.rating ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground/30'}`} />
                                            ))}
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-muted-foreground italic">"{review.comment}"</p>
                                </CardContent>
                                <CardFooter className="flex justify-end gap-2">
                                     <Button variant="outline" size="sm" onClick={() => handleReject(review)}>
                                        <X className="mr-2 h-4 w-4" />
                                        Rechazar
                                    </Button>
                                    <Button size="sm" onClick={() => handleApprove(review)}>
                                        <Check className="mr-2 h-4 w-4" />
                                        Aprobar
                                    </Button>
                                </CardFooter>
                            </Card>
                        ))}
                    </div>
                ) : (
                    <Card>
                        <CardContent className="py-16 text-center text-muted-foreground">
                            <MessageSquare className="mx-auto h-12 w-12 mb-4 opacity-50" />
                            <h3 className="text-xl font-semibold">¡Todo al día!</h3>
                            <p>No hay reseñas pendientes de moderación.</p>
                        </CardContent>
                    </Card>
                )}
            </div>
        </AuthorizedOnly>
    );
}
