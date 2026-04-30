

import { collection, getDocs, addDoc, deleteDoc, doc, updateDoc, query, where, serverTimestamp, getDoc } from 'firebase/firestore';
import { db, storage } from './firebase';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { logError } from './errors';


async function uploadCategoryImage(imageFile) {
    if (!(imageFile instanceof File)) {
        throw new Error("Invalid file provided for upload.");
    }
    const storageRef = ref(storage, `categories/${Date.now()}-${imageFile.name}`);
    await uploadBytes(storageRef, imageFile);
    const downloadURL = await getDownloadURL(storageRef);
    return downloadURL;
}

export const getCategories = async (options = {}) => {
  try {
    let q = query(categoriesCollection);
    if (options.activeOnly) {
      q = query(categoriesCollection, where("active", "==", true));
    }
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    logError(error, 'getCategories');
    throw error;
  }
}

const categoriesCollection = collection(db, 'categories');

export const addCategory = async (data) => {
  try {
    const { name, image } = data;
    let imageUrl = null;
    if (image instanceof File) {
      imageUrl = await uploadCategoryImage(image);
    }
    
    const docRef = await addDoc(categoriesCollection, { 
      name, 
      active: true,
      imageUrl: imageUrl,
      createdAt: serverTimestamp(),
    });
    return docRef.id;
  } catch (error) {
    logError(error, 'addCategory');
    throw error;
  }
}

export const updateCategory = async (id, data) => {
    try {
        const { name, image } = data;
        const updateData = { name };

        const docRef = doc(db, 'categories', id);

        if (image instanceof File) {
            const newImageUrl = await uploadCategoryImage(image);
            updateData.imageUrl = newImageUrl;
            
            const oldDocSnap = await getDoc(docRef);
            const oldImageUrl = oldDocSnap.data()?.imageUrl;
            if (oldImageUrl) {
                try {
                    const oldImageRef = ref(storage, oldImageUrl);
                    await deleteObject(oldImageRef);
                } catch(error) {
                    if (error.code !== 'storage/object-not-found') {
                        console.error("Failed to delete old category image:", error);
                    }
                }
            }
        } else if (image === null) {
            updateData.imageUrl = null;
            const oldDocSnap = await getDoc(docRef);
            const oldImageUrl = oldDocSnap.data()?.imageUrl;
            if (oldImageUrl) {
                 try {
                    const oldImageRef = ref(storage, oldImageUrl);
                    await deleteObject(oldImageRef);
                } catch(error) {
                    if (error.code !== 'storage/object-not-found') {
                        console.error("Failed to delete old category image:", error);
                    }
                }
            }
        }

        await updateDoc(docRef, updateData);
    } catch (error) {
        logError(error, 'updateCategory', { id });
        throw error;
    }
}

export const deleteCategory = async (id) => {
    try {
        const docRef = doc(db, 'categories', id);
        const docSnap = await getDoc(docRef);
        const imageUrl = docSnap.data()?.imageUrl;

        if (imageUrl) {
            try {
                const imageRef = ref(storage, imageUrl);
                await deleteObject(imageRef);
            } catch(error) {
                 if (error.code !== 'storage/object-not-found') {
                    console.error("Failed to delete category image:", error);
                }
            }
        }
        await deleteDoc(docRef);
    } catch (error) {
        logError(error, 'deleteCategory', { id });
        throw error;
    }
}
