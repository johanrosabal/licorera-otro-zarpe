'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './use-auth';
import { addFavorite as addFavoriteToDb, removeFavorite as removeFavoriteFromDb, onFavoritesChange } from '@/lib/favorites-service';
import { useToast } from './use-toast';

const FavoritesContext = createContext(null);

export const useFavorites = () => {
    const context = useContext(FavoritesContext);
    if (!context) {
        throw new Error('useFavorites must be used within a FavoritesProvider');
    }
    return context;
};

export const FavoritesProvider = ({ children }) => {
    const { user } = useAuth();
    const { toast } = useToast();
    const [favoriteIds, setFavoriteIds] = useState([]);
    const [isInitialized, setIsInitialized] = useState(false);

    useEffect(() => {
        if (user?.uid) {
            setIsInitialized(false);
            const unsubscribe = onFavoritesChange(user.uid, (ids) => {
                setFavoriteIds(ids);
                setIsInitialized(true);
            });
            return () => unsubscribe();
        } else {
            // Guest users don't have favorites
            setFavoriteIds([]);
            setIsInitialized(true);
        }
    }, [user]);

    const isFavorite = useCallback((productId) => {
        return favoriteIds.includes(productId);
    }, [favoriteIds]);

    const toggleFavorite = useCallback(async (product) => {
        if (!user) {
            toast({
                title: "Inicia sesión",
                description: "Debes iniciar sesión para añadir productos a favoritos.",
                variant: "destructive"
            });
            return;
        }

        const currentlyFavorite = isFavorite(product.id);
        
        if (currentlyFavorite) {
            // Optimistically update UI
            setFavoriteIds(prev => prev.filter(id => id !== product.id));
            try {
                await removeFavoriteFromDb(user.uid, product.id);
                toast({
                    title: "Eliminado de Favoritos",
                    description: `${product.name} ha sido eliminado de tus favoritos.`,
                });
            } catch (error) {
                // Revert UI on error
                setFavoriteIds(prev => [...prev, product.id]);
                toast({ title: "Error", description: "No se pudo eliminar de favoritos.", variant: "destructive" });
            }
        } else {
            // Optimistically update UI
            setFavoriteIds(prev => [...prev, product.id]);
            try {
                await addFavoriteToDb(user.uid, product.id);
                 toast({
                    title: "Añadido a Favoritos",
                    description: `${product.name} ha sido añadido a tus favoritos.`,
                });
            } catch (error) {
                // Revert UI on error
                setFavoriteIds(prev => prev.filter(id => id !== product.id));
                toast({ title: "Error", description: "No se pudo añadir a favoritos.", variant: "destructive" });
            }
        }
    }, [user, favoriteIds, isFavorite, toast]);

    const value = {
        favoriteIds,
        toggleFavorite,
        isFavorite,
        isInitialized,
    };

    return (
        <FavoritesContext.Provider value={value}>
            {children}
        </FavoritesContext.Provider>
    );
};
