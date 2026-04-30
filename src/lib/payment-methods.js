
import { collection, getDocs, addDoc, deleteDoc, doc, updateDoc, query, serverTimestamp, orderBy, where, getDoc } from 'firebase/firestore';
import { db } from './firebase';
import { getBankAccounts } from './bank-accounts';
import { logError } from './errors';

const paymentMethodsCollection = collection(db, 'paymentMethods');

export const getPaymentMethods = async (options = {}) => {
  try {
    const q = query(paymentMethodsCollection, orderBy('order'));
    const snapshot = await getDocs(q);
    let allMethods = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    if (options.activeOnly) {
      allMethods = allMethods.filter(method => method.active === true);
    }
    
    return allMethods;
  } catch (error) {
    logError(error, 'getPaymentMethods');
    throw error;
  }
}

export const getPaymentMethodsWithAccounts = async (options = {}) => {
    try {
        const methods = await getPaymentMethods(options);

        if (methods.length === 0) {
            return [];
        }

        const allBankAccounts = await getBankAccounts();
        const bankAccountsMap = new Map(
            allBankAccounts.map(account => [account.id, account])
        );
        
        const enrichedMethods = methods.map(method => {
            const bankAccount = method.bankAccountId 
                ? bankAccountsMap.get(method.bankAccountId) || null 
                : null;
            return { ...method, bankAccount };
        });

        return enrichedMethods;
    } catch (error) {
        logError(error, 'getPaymentMethodsWithAccounts');
        throw error;
    }
}

export const addPaymentMethod = async (data) => {
  try {
    const docRef = await addDoc(paymentMethodsCollection, { 
      ...data,
      createdAt: serverTimestamp() 
    });
    return docRef.id;
  } catch (error) {
    logError(error, 'addPaymentMethod');
    throw error;
  }
}

export const updatePaymentMethod = async (id, data) => {
  try {
    await updateDoc(doc(db, 'paymentMethods', id), data);
  } catch (error) {
    logError(error, 'updatePaymentMethod', { id });
    throw error;
  }
}

export const deletePaymentMethod = async (id) => {
  try {
    await deleteDoc(doc(db, 'paymentMethods', id));
  } catch (error) {
    logError(error, 'deletePaymentMethod', { id });
    throw error;
  }
}
