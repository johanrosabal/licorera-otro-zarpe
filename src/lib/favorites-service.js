
import { collection, doc, setDoc, deleteDoc, serverTimestamp, onSnapshot, getDocs } from 'firebase/firestore';
import { db } from './firebase';
import { logError } from './errors';

// Get a reference to the favorites subcollection for a user
const getFavoritesCollectionRef = (userId) => collection(db, 'users', userId, 'favorites');

/**
 * Adds a product to a user's favorites.
 * @param {string} userId The user's ID.
 * @param {string} productId The product's ID.
 */
export const addFavorite = async (userId, productId) => {
    try {
        if (!userId || !productId) return;
        const favoriteRef = doc(getFavoritesCollectionRef(userId), productId);
        await setDoc(favoriteRef, {
            productId,
            createdAt: serverTimestamp(),
        });
    } catch (error) {
        logError(error, 'addFavorite', { userId, productId });
        throw error;
    }
};

/**
 * Removes a product from a user's favorites.
 * @param {string} userId The user's ID.
 * @param {string} productId The product's ID.
 */
export const removeFavorite = async (userId, productId) => {
    try {
        if (!userId || !productId) return;
        const favoriteRef = doc(getFavoritesCollectionRef(userId), productId);
        await deleteDoc(favoriteRef);
    } catch (error) {
        logError(error, 'removeFavorite', { userId, productId });
        throw error;
    }
};

/**
 * Fetches all favorite product IDs for a user.
 * @param {string} userId The user's ID.
 * @returns {Promise<string[]>} A list of favorite product IDs.
 */
export const getFavoriteIds = async (userId) => {
    try {
        if (!userId) return [];
        const favoritesCollection = getFavoritesCollectionRef(userId);
        const snapshot = await getDocs(favoritesCollection);
        return snapshot.docs.map(doc => doc.id);
    } catch (error) {
        logError(error, 'getFavoriteIds', { userId });
        throw error;
    }
}

/**
 * Sets up a real-time listener for a user's favorites.
 * @param {string} userId The user's ID.
 * @param {function(string[]): void} callback Function to call with the list of favorite IDs.
 * @returns {import('firebase/firestore').Unsubscribe} The unsubscribe function for the listener.
 */
export const onFavoritesChange = (userId, callback) => {
    if (!userId) return () => {};
    const favoritesCollection = getFavoritesCollectionRef(userId);
    return onSnapshot(favoritesCollection, (snapshot) => {
        const favoriteIds = snapshot.docs.map(doc => doc.id);
        callback(favoriteIds);
    }, (error) => {
        logError(error, 'onFavoritesChange', { userId });
    });
};
