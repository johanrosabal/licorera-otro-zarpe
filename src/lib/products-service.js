
'use client'

import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, query, orderBy, getDoc, where, serverTimestamp } from 'firebase/firestore';
import { db, storage } from './firebase';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { logError } from './errors';

const productsCollection = collection(db, 'products');

export async function getProducts(options = {}) {
    try {
        let q = query(productsCollection, orderBy("name", "asc"));
        if (options.activeOnly) {
            q = query(q, where("active", "==", true));
        }
        if(options.isTest === false){
            q = query(q, where("isTestProduct", "!=", true));
        }
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        logError(error, 'getProducts');
        throw error;
    }
}

export async function getProductById(id) {
    try {
        const docRef = doc(db, 'products', id);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            return { id: docSnap.id, ...docSnap.data() };
        } else {
            return undefined;
        }
    } catch (error) {
        logError(error, 'getProductById', { id });
        throw error;
    }
}

async function uploadImage(imageFile) {
    const storageRef = ref(storage, `products/${Date.now()}-${imageFile.name}`);
    await uploadBytes(storageRef, imageFile);
    const downloadURL = await getDownloadURL(storageRef);
    return downloadURL;
}

export const cleanupUndefinedFields = (data) => {
    const cleanedData = { ...data };
    Object.keys(cleanedData).forEach(key => {
        if (cleanedData[key] === undefined) {
            delete cleanedData[key];
        }
        if (key === 'ribbon' && cleanedData[key] === 'Ninguno') {
            delete cleanedData[key];
        }
    });
    return cleanedData;
};

export async function addProduct(productData, user) {
    try {
        if (!user) throw new Error("User is required to add a product.");
        
        let imageUrl = "https://picsum.photos/400/500"; 

        if (productData.image instanceof File) {
            imageUrl = await uploadImage(productData.image);
        }
        
        const rawProductData = {
            ...productData,
            image: imageUrl,
            costPrice: productData.costPrice || 0,
            sellingPrice: productData.sellingPrice || 0,
            createdAt: serverTimestamp(),
            createdBy: {
                uid: user.uid,
                email: user.email,
            },
            updatedAt: serverTimestamp(),
            updatedBy: {
                uid: user.uid,
                email: user.email,
            },
        };

        if (productData.isBundle) {
            rawProductData.stock = 0;
        } else {
            rawProductData.stock = productData.stock || 0;
        }

        const productToSave = cleanupUndefinedFields(rawProductData);

        const docRef = await addDoc(productsCollection, productToSave);
        return docRef.id;
    } catch (error) {
        logError(error, 'addProduct');
        throw error;
    }
}


export async function updateProduct(id, productData, user) {
    try {
        if (!user) throw new Error("User is required to update a product.");
        const rawDataToUpdate = { ...productData };

        if (productData.image instanceof File) {
            const imageUrl = await uploadImage(productData.image);
            rawDataToUpdate.image = imageUrl;
        } else {
            delete rawDataToUpdate.image;
        }

        rawDataToUpdate.updatedAt = serverTimestamp();
        rawDataToUpdate.updatedBy = {
            uid: user.uid,
            email: user.email,
        };

        if (productData.isBundle) {
            rawDataToUpdate.stock = 0;
        }

        const dataToUpdate = cleanupUndefinedFields(rawDataToUpdate);

        await updateDoc(doc(db, 'products', id), dataToUpdate);
    } catch (error) {
        logError(error, 'updateProduct', { id });
        throw error;
    }
}


export async function deleteProduct(id) {
    try {
        const product = await getProductById(id);
        if (product && product.image) {
            if (product.image.includes('firebasestorage.googleapis.com')) {
                try {
                    const imageRef = ref(storage, product.image);
                    await deleteObject(imageRef);
                } catch (error) {
                    if (error.code !== 'storage/object-not-found') {
                        console.error("Error deleting image from storage:", error);
                    }
                }
            }
        }
        await deleteDoc(doc(db, 'products', id));
    } catch (error) {
        logError(error, 'deleteProduct', { id });
        throw error;
    }
}
