
import { collection, getDocs, addDoc, deleteDoc, doc, updateDoc, query, where, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { logError } from './errors';

const banksCollection = collection(db, 'banks');

export const getBanks = async (options = {}) => {
  try {
    let q = query(banksCollection);
    if (options.activeOnly) {
      q = query(banksCollection, where("active", "==", true));
    }
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    logError(error, 'getBanks');
    throw error;
  }
}

export const addBank = async (data) => {
  try {
    const docRef = await addDoc(banksCollection, { 
      ...data,
      createdAt: serverTimestamp() 
    });
    return docRef.id;
  } catch (error) {
    logError(error, 'addBank');
    throw error;
  }
}

export const updateBank = async (id, data) => {
  try {
    await updateDoc(doc(db, 'banks', id), data);
  } catch (error) {
    logError(error, 'updateBank');
    throw error;
  }
}

export const deleteBank = async (id) => {
  try {
    await deleteDoc(doc(db, 'banks', id));
  } catch (error) {
    logError(error, 'deleteBank');
    throw error;
  }
}
