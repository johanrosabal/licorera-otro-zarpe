import { collection, addDoc, query, where, getDocs, orderBy, serverTimestamp, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from './firebase';
import { logError } from './errors';

// Get a reference to the reviews subcollection for a product
const getReviewsCollectionRef = (productId) => collection(db, 'products', productId, 'reviews');

/**
 * Adds a review to a product.
 * @param {string} productId The product's ID.
 * @param {object} reviewData The review data (userId, userName, rating, comment).
 */
export const addReview = async (productId, reviewData) => {
    try {
        const reviewsCollection = getReviewsCollectionRef(productId);
        await addDoc(reviewsCollection, {
            ...reviewData,
            isApproved: false,
            createdAt: serverTimestamp(),
        });
    } catch (error) {
        logError(error, 'addReview', { productId });
        throw error;
    }
};

/**
 * Fetches all reviews for a specific product.
 * @param {string} productId The product's ID.
 * @returns {Promise<Array<object>>} A list of review objects.
 */
export const getReviewsForProduct = async (productId, options = { approvedOnly: true }) => {
    try {
        const reviewsCollection = getReviewsCollectionRef(productId);
        let q = query(reviewsCollection, orderBy('createdAt', 'desc'));
        if (options.approvedOnly) {
            q = query(q, where('isApproved', '==', true));
        }
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        logError(error, 'getReviewsForProduct', { productId });
        throw error;
    }
}

/**
 * Updates a review document.
 * @param {string} productId The product's ID.
 * @param {string} reviewId The review's ID.
 * @param {object} data The data to update.
 */
export const updateReview = async (productId, reviewId, data) => {
    try {
        const reviewRef = doc(db, 'products', productId, 'reviews', reviewId);
        await updateDoc(reviewRef, data);
    } catch (error) {
        logError(error, 'updateReview', { productId, reviewId });
        throw error;
    }
};

/**
 * Deletes a review document.
 * @param {string} productId The product's ID.
 * @param {string} reviewId The review's ID.
 */
export const deleteReview = async (productId, reviewId) => {
    try {
        const reviewRef = doc(db, 'products', productId, 'reviews', reviewId);
        await deleteDoc(reviewRef);
    } catch (error) {
        logError(error, 'deleteReview', { productId, reviewId });
        throw error;
    }
};

/**
 * Checks if a user has purchased a specific product.
 * @param {string} userId The user's ID.
 * @param {string} productId The product's ID.
 * @returns {Promise<boolean>} True if the user has purchased the product, false otherwise.
 */
export const hasUserPurchasedProduct = async (userId, productId) => {
    try {
        if (!userId || !productId) return false;

        const ordersQuery = query(
            collection(db, 'orders'),
            where('userId', '==', userId),
            where('status', '==', 'Completado')
        );

        const snapshot = await getDocs(ordersQuery);
        if (snapshot.empty) {
            return false;
        }

        for (const orderDoc of snapshot.docs) {
            const order = orderDoc.data();
            if (order.items && order.items.some(item => item.id === productId)) {
                return true; // Found it
            }
        }
        
        return false; // Did not find it in any completed order
    } catch (error) {
        logError(error, 'hasUserPurchasedProduct', { userId, productId });
        // Don't throw, just return false so the UI doesn't break
        return false;
    }
}
