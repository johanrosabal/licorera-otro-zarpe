import { collection, getDocs, addDoc, deleteDoc, doc, updateDoc, query, where, orderBy, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { logError } from './errors';

const notificationsCollection = collection(db, 'notifications');

export const getNotifications = async (options = {}) => {
  try {
    let q = query(notificationsCollection, orderBy('createdAt', 'desc'));
    
    if (options.type) {
      q = query(q, where("type", "==", options.type));
    }
    
    if (options.activeOnly) {
      q = query(q, where("active", "==", true));
    }

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    logError(error, 'getNotifications');
    throw error;
  }
}

export const addNotification = async (data) => {
  try {
    const docRef = await addDoc(notificationsCollection, {
      ...data,
      createdAt: serverTimestamp()
    });
    return docRef.id;
  } catch (error) {
    logError(error, 'addNotification');
    throw error;
  }
}

export const updateNotification = async (id, data) => {
  try {
    await updateDoc(doc(db, 'notifications', id), {
        ...data,
        updatedAt: serverTimestamp()
    });
  } catch (error) {
    logError(error, 'updateNotification', { id });
    throw error;
  }
}

export const deleteNotification = async (id) => {
  try {
    await deleteDoc(doc(db, 'notifications', id));
  } catch (error) {
    logError(error, 'deleteNotification', { id });
    throw error;
  }
}
