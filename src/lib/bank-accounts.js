
import { collection, getDocs, addDoc, deleteDoc, doc, updateDoc, query, where, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { getBanks } from './banks';
import { logError } from './errors';

const bankAccountsCollection = collection(db, 'bankAccounts');

export const getBankAccounts = async (options = {}) => {
  try {
    let q = query(bankAccountsCollection);
    if (options.activeOnly) {
      q = query(bankAccountsCollection, where("active", "==", true));
    }
    const snapshot = await getDocs(q);
    const accounts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    if (accounts.length === 0) {
        return [];
    }

    const allBanks = await getBanks();
    const bankMap = new Map(allBanks.map(bank => [bank.id, bank.name]));

    const enrichedAccounts = accounts.map(account => ({
        ...account,
        bankName: bankMap.get(account.bankId) || 'Banco Desconocido'
    }));
    
    return enrichedAccounts.sort((a, b) => a.accountHolder.localeCompare(b.accountHolder));
  } catch (error) {
    logError(error, 'getBankAccounts');
    throw error;
  }
}

export const addBankAccount = async (data) => {
  try {
    const docRef = await addDoc(bankAccountsCollection, { 
      ...data,
      createdAt: serverTimestamp() 
    });
    return docRef.id;
  } catch (error) {
    logError(error, 'addBankAccount');
    throw error;
  }
}

export const updateBankAccount = async (id, data) => {
  try {
    await updateDoc(doc(db, 'bankAccounts', id), data);
  } catch (error) {
    logError(error, 'updateBankAccount');
    throw error;
  }
}

export const deleteBankAccount = async (id) => {
  try {
    await deleteDoc(doc(db, 'bankAccounts', id));
  } catch (error) {
    logError(error, 'deleteBankAccount');
    throw error;
  }
}
