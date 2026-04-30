

import { collection, getDocs, doc, updateDoc, query, orderBy, where } from 'firebase/firestore';
import { db } from './firebase';
import { logError } from './errors';

const usersCollection = collection(db, 'users');

/**
 * Fetches users from the Firestore database.
 * @param {object} [options] - Optional filters.
 * @param {Array<string>} [options.roles] - An array of roles to filter by.
 * @returns {Promise<Array<object>>} A promise that resolves to an array of user objects.
 */
export const getUsers = async (options = {}) => {
  try {
    let q;
    if (options.roles && options.roles.length > 0) {
      q = query(usersCollection, where('role', 'in', options.roles), orderBy('name', 'asc'));
    } else {
      q = query(usersCollection, orderBy('name', 'asc'));
    }
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    logError(error, 'getUsers');
    throw error;
  }
}

/**
 * Updates the profile data of a specific user in the Firestore database.
 * This can be used to update name, role, etc.
 * @param {string} userId - The ID of the user to update.
 * @param {object} data - An object containing the fields to update (e.g., { name: 'New Name', role: 'ADMIN' }).
 * @returns {Promise<void>} A promise that resolves when the update is complete.
 */
export const updateUserProfile = async (userId, data) => {
  try {
    if (!userId) {
      throw new Error('User ID is required.');
    }
    const userRef = doc(db, 'users', userId);
    const dataToUpdate = { ...data };
    if(dataToUpdate.locationUrl === undefined) {
      dataToUpdate.locationUrl = '';
    }
    await updateDoc(userRef, dataToUpdate);
  } catch (error) {
    logError(error, 'updateUserProfile', { userId });
    throw error;
  }
};


/**
 * Updates the role of a specific user in the Firestore database.
 * @param {string} userId - The ID of the user to update.
 * @param {string} newRole - The new role to assign to the user.
 * @returns {Promise<void>} A promise that resolves when the update is complete.
 */
export const updateUserRole = async (userId, newRole) => {
  if (!userId || !newRole) {
    throw new Error('User ID and new role are required.');
  }
  await updateUserProfile(userId, { role: newRole });
}
