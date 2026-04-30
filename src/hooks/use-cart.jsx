
'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './use-auth';
import { getCart, updateCart, clearCart as clearFirestoreCart, mergeLocalCartWithFirestore } from '@/lib/cart-service';
import { onSnapshot, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const CartContext = createContext(null);

export const useCart = () => {
    const context = useContext(CartContext);
    if (!context) {
        throw new Error('useCart must be used within a CartProvider');
    }
    return context;
};

export const CartProvider = ({ children }) => {
    const { user } = useAuth();
    const [cartItems, setCartItems] = useState([]);
    const [isInitialized, setIsInitialized] = useState(false);
    const [cartId, setCartId] = useState(null);

    // Effect for handling real-time updates from Firestore for logged-in users
    useEffect(() => {
        if (user?.uid) {
            const cartRef = doc(db, 'carts', user.uid);
            const unsubscribe = onSnapshot(cartRef, (doc) => {
                if (doc.exists()) {
                    const cartData = doc.data();
                    setCartItems(cartData.items || []);
                    setCartId(doc.id);
                } else {
                    setCartItems([]);
                    setCartId(user.uid);
                }
                setIsInitialized(true);
            });
            return () => unsubscribe();
        } else {
            // Handle guest user cart from localStorage
            try {
                const storedCart = localStorage.getItem('cart');
                if (storedCart) {
                    setCartItems(JSON.parse(storedCart));
                }
            } catch (error) {
                console.error("Failed to parse cart from localStorage", error);
                localStorage.removeItem('cart');
            } finally {
                setIsInitialized(true);
            }
        }
    }, [user]);

    // Effect for merging local cart to Firestore on login
    useEffect(() => {
        async function mergeCarts() {
            if (user && isInitialized) {
                const localCartRaw = localStorage.getItem('cart');
                if (localCartRaw) {
                    const localCartItems = JSON.parse(localCartRaw);
                    if (localCartItems.length > 0) {
                        await mergeLocalCartWithFirestore(user.uid, localCartItems);
                        localStorage.removeItem('cart');
                    }
                }
            }
        }
        mergeCarts();
    }, [user, isInitialized]);


    // Update localStorage for guest users
    useEffect(() => {
        if (!user && isInitialized) {
            localStorage.setItem('cart', JSON.stringify(cartItems));
        }
    }, [cartItems, user, isInitialized]);

    const addToCart = useCallback(async (product, quantity = 1) => {
        let newItems;
        const existingItem = cartItems.find(item => item.id === product.id);

        if (existingItem) {
            newItems = cartItems.map(item =>
                item.id === product.id ? { ...item, quantity: item.quantity + quantity } : item
            );
        } else {
            newItems = [...cartItems, { ...product, quantity }];
        }

        if (user) {
            await updateCart(user.uid, newItems);
        } else {
            setCartItems(newItems);
        }
    }, [cartItems, user]);

    const removeFromCart = useCallback(async (productId) => {
        const newItems = cartItems.filter(item => item.id !== productId);
        if (user) {
            await updateCart(user.uid, newItems);
        } else {
            setCartItems(newItems);
        }
    }, [cartItems, user]);
    
    const updateQuantity = useCallback(async (productId, quantity) => {
        const newQuantity = Math.max(1, quantity);
        const newItems = cartItems.map(item =>
            item.id === productId ? { ...item, quantity: newQuantity } : item
        );
         if (user) {
            await updateCart(user.uid, newItems);
        } else {
            setCartItems(newItems);
        }
    }, [cartItems, user]);

    const clearCart = useCallback(async () => {
        if (user) {
            await clearFirestoreCart(user.uid);
        } else {
            setCartItems([]);
        }
    }, [user]);

    const totalItems = cartItems.reduce((total, item) => total + item.quantity, 0);
    const subtotal = cartItems.reduce((total, item) => total + item.sellingPrice * item.quantity, 0);

    const value = {
        cartItems,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        totalItems,
        subtotal,
        isInitialized,
    };

    return (
        <CartContext.Provider value={value}>
            {children}
        </CartContext.Provider>
    );
};
