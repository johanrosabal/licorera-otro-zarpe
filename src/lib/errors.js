
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

const errorsCollection = collection(db, 'appErrors');

/**
 * Logs an error to the Firestore 'appErrors' collection.
 * @param {Error} error - The error object to log.
 * @param {string} [context] - A string describing the context where the error occurred (e.g., 'creating-order').
 * @param {object} [metadata] - An object containing any additional metadata to log with the error.
 */
export const logError = async (error, context = 'general', metadata = {}) => {
  try {
    const errorData = {
      message: error.message,
      stack: error.stack,
      context: context,
      metadata: metadata,
      timestamp: serverTimestamp(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'server-side',
    };
    await addDoc(errorsCollection, errorData);
    console.error(`Logged error in context [${context}]:`, error);
  } catch (loggingError) {
    console.error("Fatal: Failed to log error to Firestore.", loggingError);
    console.error("Original error was:", error);
  }
};
