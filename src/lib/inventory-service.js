
import { collection, addDoc, doc, runTransaction, serverTimestamp, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from './firebase';
import { logError } from './errors';

const inventoryMovementsCollection = collection(db, 'inventoryMovements');
const productsCollectionRef = collection(db, 'products');

export const addInventoryMovement = async ({ productId, type, quantity, reason, user }) => {
  if (!productId || !type || !quantity || !reason) {
    throw new Error('Todos los campos son requeridos para el movimiento de inventario.');
  }
  if (!user || !user.uid || !user.email) {
    throw new Error('Se requiere información del usuario para registrar el movimiento.');
  }

  const productRef = doc(productsCollectionRef, productId);

  try {
    await runTransaction(db, async (transaction) => {
      const productDoc = await transaction.get(productRef);
      if (!productDoc.exists()) {
        throw new Error('El producto no existe.');
      }

      const currentStock = productDoc.data().stock || 0;
      let newStock;

      let movementQuantity = quantity;

      if (type === 'ENTRADA') {
        newStock = currentStock + quantity;
      } else if (type === 'SALIDA') {
        newStock = currentStock - quantity;
        movementQuantity = -quantity; // Store as negative for salidas
        if (newStock < 0) {
          throw new Error('La cantidad de salida excede el stock actual.');
        }
      } else if (type === 'AJUSTE') {
        // For adjustments, the quantity is the new total stock.
        newStock = quantity;
        movementQuantity = newStock - currentStock; // The actual change
      } else {
        throw new Error('Tipo de movimiento no válido.');
      }
      
      // Update product stock
      transaction.update(productRef, { stock: newStock });

      // Create inventory movement record
      const movementData = {
        productId,
        type,
        quantity: movementQuantity,
        reason,
        previousStock: currentStock,
        newStock,
        createdAt: serverTimestamp(),
        userId: user.uid,
        userEmail: user.email,
      };
      transaction.set(doc(inventoryMovementsCollection), movementData);
    });
  } catch (error) {
    console.error('Error en la transacción de inventario:', error);
    logError(error, 'addInventoryMovement', { productId, type, quantity });
    // Re-throw the error to be caught by the calling function
    throw error;
  }
};


export const getInventoryMovements = async () => {
    try {
        const q = query(inventoryMovementsCollection, orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);
        const movements = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        const usersMap = new Map();
        movements.forEach(m => {
            if(m.userId && m.userEmail) {
                usersMap.set(m.userId, { uid: m.userId, email: m.userEmail });
            }
        });

        const users = Array.from(usersMap.values()).sort((a,b) => a.email.localeCompare(b.email));

        return { movements, users };
    } catch (error) {
        logError(error, 'getInventoryMovements');
        throw error;
    }
};
