
import { collection, getDocs, addDoc, deleteDoc, doc, updateDoc, query, where, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { logError } from './errors';

const suppliersCollection = collection(db, 'suppliers');

export const getSuppliers = async (options = {}) => {
  try {
    let q = query(suppliersCollection);
    if (options.activeOnly) {
      q = query(suppliersCollection, where("active", "==", true));
    }
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    logError(error, 'getSuppliers');
    throw error;
  }
}

export const addSupplier = async (data) => {
  try {
    const docRef = await addDoc(suppliersCollection, { 
      ...data,
      createdAt: serverTimestamp() 
    });
    return docRef.id;
  } catch (error) {
    logError(error, 'addSupplier');
    throw error;
  }
}

export const updateSupplier = async (id, data) => {
  try {
    await updateDoc(doc(db, 'suppliers', id), data);
  } catch (error) {
    logError(error, 'updateSupplier', { id });
    throw error;
  }
}

export const deleteSupplier = async (id) => {
  try {
    await deleteDoc(doc(db, 'suppliers', id));
  } catch (error) {
    logError(error, 'deleteSupplier', { id });
    throw error;
  }
}
