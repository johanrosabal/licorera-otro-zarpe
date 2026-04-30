
import { collection, getDocs, addDoc, deleteDoc, doc, updateDoc, query, where } from 'firebase/firestore';
import { db } from './firebase';
import { logError } from './errors';

const brandsCollection = collection(db, 'brands');

export const getBrands = async (options = {}) => {
  try {
    let q = query(brandsCollection);
    if (options.activeOnly) {
      q = query(brandsCollection, where("active", "==", true));
    }
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    logError(error, 'getBrands');
    throw error;
  }
}

export const addBrand = async (name) => {
  try {
    const docRef = await addDoc(brandsCollection, { name, active: true });
    return docRef.id;
  } catch (error) {
    logError(error, 'addBrand');
    throw error;
  }
}

export const updateBrand = async (id, data) => {
  try {
    await updateDoc(doc(db, 'brands', id), data);
  } catch (error) {
    logError(error, 'updateBrand');
    throw error;
  }
}

export const deleteBrand = async (id) => {
  try {
    await deleteDoc(doc(db, 'brands', id));
  } catch (error) {
    logError(error, 'deleteBrand');
    throw error;
  }
}
