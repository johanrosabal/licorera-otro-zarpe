
import { collection, getDocs, addDoc, deleteDoc, doc, updateDoc, query, where } from 'firebase/firestore';
import { db } from './firebase';
import { logError } from './errors';

const unitsOfMeasureCollection = collection(db, 'unitsOfMeasure');

export const getUnitsOfMeasure = async (options = {}) => {
  try {
    let q = query(unitsOfMeasureCollection);
    if (options.activeOnly) {
      q = query(unitsOfMeasureCollection, where("active", "==", true));
    }
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    logError(error, 'getUnitsOfMeasure');
    throw error;
  }
}

export const addUnitOfMeasure = async (name) => {
  try {
    const docRef = await addDoc(unitsOfMeasureCollection, { name, active: true });
    return docRef.id;
  } catch (error) {
    logError(error, 'addUnitOfMeasure');
    throw error;
  }
}

export const updateUnitOfMeasure = async (id, data) => {
  try {
    await updateDoc(doc(db, 'unitsOfMeasure', id), data);
  } catch (error) {
    logError(error, 'updateUnitOfMeasure', { id });
    throw error;
  }
}

export const deleteUnitOfMeasure = async (id) => {
  try {
    await deleteDoc(doc(db, 'unitsOfMeasure', id));
  } catch (error) {
    logError(error, 'deleteUnitOfMeasure', { id });
    throw error;
  }
}
