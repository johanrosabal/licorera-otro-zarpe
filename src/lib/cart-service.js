
import { doc, getDoc, setDoc, updateDoc, serverTimestamp, arrayUnion } from 'firebase/firestore';
import { db } from './firebase';
import { logError } from './errors';

/**
 * Retrieves the user's cart from Firestore.
 * @param {string} userId The user's UID.
 * @returns {Promise<Array>} A promise that resolves to the array of cart items.
 */
export const getCart = async (userId) => {
    try {
        if (!userId) return [];
        const cartRef = doc(db, 'carts', userId);
        const cartSnap = await getDoc(cartRef);
        if (cartSnap.exists()) {
            return cartSnap.data().items || [];
        }
        return [];
    } catch (error) {
        logError(error, 'getCart', { userId });
        throw error;
    }
};

/**
 * Overwrites the user's cart with a new set of items.
 * @param {string} userId The user's UID.
 * @param {Array<object>} items The new array of cart items.
 */
export const updateCart = async (userId, items) => {
    try {
        if (!userId) return;
        const cartRef = doc(db, 'carts', userId);
        await setDoc(cartRef, {
            items: items,
            updatedAt: serverTimestamp()
        }, { merge: true });
    } catch (error) {
        logError(error, 'updateCart', { userId });
        throw error;
    }
};

/**
 * Clears all items from a user's cart in Firestore.
 * @param {string} userId The user's UID.
 */
export const clearCart = async (userId) => {
    try {
        if (!userId) return;
        const cartRef = doc(db, 'carts', userId);
        await setDoc(cartRef, {
            items: [],
            updatedAt: serverTimestamp()
        });
    } catch (error) {
        logError(error, 'clearCart', { userId });
        throw error;
    }
};

/**
 * Merges a local cart (from localStorage) with the user's Firestore cart upon login.
 * @param {string} userId The user's UID.
 * @param {Array<object>} localItems The array of items from the local cart.
 */
export const mergeLocalCartWithFirestore = async (userId, localItems) => {
    try {
        if (!userId || !localItems || localItems.length === 0) return;

        const cartRef = doc(db, 'carts', userId);
        const cartSnap = await getDoc(cartRef);

        if (cartSnap.exists()) {
            const firestoreItems = cartSnap.data().items || [];
            const mergedItems = [...firestoreItems];

            localItems.forEach(localItem => {
                const existingItemIndex = mergedItems.findIndex(item => item.id === localItem.id);
                if (existingItemIndex > -1) {
                    // If item exists, update its quantity
                    mergedItems[existingItemIndex].quantity += localItem.quantity;
                } else {
                    // If item doesn't exist, add it
                    mergedItems.push(localItem);
                }
            });

            await updateDoc(cartRef, {
                items: mergedItems,
                updatedAt: serverTimestamp(),
            });

        } else {
            // If no Firestore cart exists, just set it with the local items
            await setDoc(cartRef, {
                items: localItems,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });
        }
    } catch (error) {
        logError(error, 'mergeLocalCartWithFirestore', { userId });
        throw error;
    }
};
