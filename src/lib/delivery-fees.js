
import { collection, getDocs, addDoc, deleteDoc, doc, updateDoc, query, orderBy, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { logError } from './errors';

const deliveryFeesCollection = collection(db, 'deliveryFees');

export const getDeliveryFees = async () => {
  try {
    const q = query(deliveryFeesCollection, orderBy('fromKm'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    logError(error, 'getDeliveryFees');
    throw error;
  }
}

export const addDeliveryFee = async (data) => {
  try {
    const docRef = await addDoc(deliveryFeesCollection, { 
      ...data,
      createdAt: serverTimestamp() 
    });
    return docRef.id;
  } catch (error) {
    logError(error, 'addDeliveryFee');
    throw error;
  }
}

export const updateDeliveryFee = async (id, data) => {
  try {
    await updateDoc(doc(db, 'deliveryFees', id), data);
  } catch (error) {
    logError(error, 'updateDeliveryFee', { id });
    throw error;
  }
}

export const deleteDeliveryFee = async (id) => {
  try {
    await deleteDoc(doc(db, 'deliveryFees', id));
  } catch (error) {
    logError(error, 'deleteDeliveryFee', { id });
    throw error;
  }
}
