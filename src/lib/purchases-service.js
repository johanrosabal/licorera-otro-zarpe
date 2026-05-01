

import { collection, addDoc, doc, runTransaction, serverTimestamp, getDocs, query, orderBy, getDoc, writeBatch, where } from 'firebase/firestore';
import { db, storage } from './firebase';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { logError } from './errors';

const purchasesCollection = collection(db, 'purchases');
const productsCollectionRef = collection(db, 'products');
const inventoryMovementsCollection = collection(db, 'inventoryMovements');
const productCostHistoryCollection = collection(db, 'productCostHistory');

async function uploadInvoiceImage(imageFile) {
    const storageRef = ref(storage, `invoices/${Date.now()}-${imageFile.name}`);
    await uploadBytes(storageRef, imageFile);
    const downloadURL = await getDownloadURL(storageRef);
    return downloadURL;
}

export const getPurchaseById = async (id) => {
    try {
        const docRef = doc(db, 'purchases', id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            return { id: docSnap.id, ...docSnap.data() };
        }
        return null;
    } catch (error) {
        logError(error, 'getPurchaseById', { id });
        throw error;
    }
};

/**
 * Registers a new purchase and updates the inventory for each item.
 * This function is transactional to ensure data consistency.
 *
 * @param {object} purchaseData - The data for the purchase.
 * @param {object} user - The user performing the action.
 * @returns {Promise<string>} The ID of the newly created purchase document.
 */
export const addPurchase = async (purchaseData, user) => {
  if (!user) throw new Error("User is required to add a purchase.");

  const purchaseDocRef = doc(collection(db, 'purchases'));

  try {
    let imageUrl = null;
    if (purchaseData.invoiceImage instanceof File) {
        imageUrl = await uploadInvoiceImage(purchaseData.invoiceImage);
    }
  
    await runTransaction(db, async (transaction) => {
      const productDocs = await Promise.all(
        purchaseData.items.map(item => {
          if (!item.productId) throw new Error("Cada item debe tener un ID de producto.");
          const productRef = doc(productsCollectionRef, item.productId);
          return transaction.get(productRef);
        })
      );
      
      const itemsWithNames = purchaseData.items.map((item, index) => {
          const productDoc = productDocs[index];
          if (!productDoc.exists()) {
            throw new Error(`Uno de los productos seleccionados no fue encontrado (ID: ${item.productId}).`);
          }
          return {
              ...item,
              name: productDoc.data().name, 
          };
      });

      const purchaseToSave = {
        ...purchaseData,
        items: itemsWithNames,
        invoiceImageUrl: imageUrl,
        createdAt: serverTimestamp(),
        createdBy: { uid: user.uid, email: user.email },
      };
      delete purchaseToSave.invoiceImage; 

      transaction.set(purchaseDocRef, purchaseToSave);

      itemsWithNames.forEach((item, index) => {
        const productDoc = productDocs[index];
        const productRef = doc(productsCollectionRef, item.productId);
        
        const currentStock = productDoc.data().stock || 0;
        const newStock = currentStock + (item.quantity || 0);
        const previousCostPrice = productDoc.data().costPrice || 0;
        const newCostPrice = item.costPrice || 0;

        transaction.update(productRef, { 
            stock: newStock,
            costPrice: newCostPrice,
            taxPercentage: item.taxPercentage 
        });

        // Record cost history if price changed
        if (Math.abs(previousCostPrice - newCostPrice) > 0.01) {
          const costHistoryRef = doc(productCostHistoryCollection);
          transaction.set(costHistoryRef, {
            productId: item.productId,
            productName: productDoc.data().name,
            previousCostPrice,
            newCostPrice,
            difference: newCostPrice - previousCostPrice,
            differencePercentage: previousCostPrice > 0
              ? ((newCostPrice - previousCostPrice) / previousCostPrice) * 100
              : 0,
            purchaseId: purchaseDocRef.id,
            invoiceNumber: purchaseData.invoiceNumber,
            supplierId: purchaseData.supplierId,
            taxesIncluded: purchaseData.taxesIncluded ?? false,
            createdAt: serverTimestamp(),
            createdBy: { uid: user.uid, email: user.email },
          });
        }

        const movementDocRef = doc(inventoryMovementsCollection);
        const movementData = {
          purchaseId: purchaseDocRef.id,
          productId: item.productId,
          type: 'ENTRADA',
          quantity: item.quantity,
          reason: `Compra #${purchaseData.invoiceNumber}`,
          invoiceNumber: purchaseData.invoiceNumber,
          previousStock: currentStock,
          newStock: newStock,
          createdAt: serverTimestamp(),
          userId: user.uid,
          userEmail: user.email,
        };
        transaction.set(movementDocRef, movementData);
      });
    });

    return purchaseDocRef.id;
  } catch (error) {
    logError(error, 'addPurchase');
    throw new Error("La transacción de compra falló. No se realizaron cambios.");
  }
};


export const updatePurchase = async (purchaseId, oldPurchaseData, newPurchaseData, user) => {
    if (!user) throw new Error("User is required to update a purchase.");

    try {
        let newImageUrl = oldPurchaseData.invoiceImageUrl || null;

        if (newPurchaseData.invoiceImage instanceof File) {
            newImageUrl = await uploadInvoiceImage(newPurchaseData.invoiceImage);
            if (oldPurchaseData.invoiceImageUrl && oldPurchaseData.invoiceImageUrl !== newImageUrl) {
                const oldImageRef = ref(storage, oldPurchaseData.invoiceImageUrl);
                await deleteObject(oldImageRef).catch(err => console.warn("Old image deletion failed, continuing...", err));
            }
        } else if (newPurchaseData.invoiceImage === undefined && oldPurchaseData.invoiceImageUrl) {
             try {
                const oldImageRef = ref(storage, oldPurchaseData.invoiceImageUrl);
                await deleteObject(oldImageRef);
                newImageUrl = null;
             } catch (error) {
                 console.warn("Old image deletion failed, continuing...", err)
             }
        }

        await runTransaction(db, async (transaction) => {
            const allProductIds = Array.from(new Set([
                ...oldPurchaseData.items.map(item => item.productId),
                ...newPurchaseData.items.map(item => item.productId)
            ]));
            
            const productRefs = allProductIds.map(id => doc(productsCollectionRef, id));
            const productDocsSnapshots = await Promise.all(productRefs.map(pRef => transaction.get(pRef)));

            const productDataMap = new Map();
            productDocsSnapshots.forEach(docSnap => {
                if (docSnap.exists()) {
                    productDataMap.set(docSnap.id, docSnap.data());
                } else {
                    console.warn(`Product with ID ${docSnap.id} not found during purchase update.`);
                }
            });

            const movementsQuery = query(inventoryMovementsCollection, where("purchaseId", "==", purchaseId));
            const oldMovementsSnapshot = await getDocs(movementsQuery);

            oldMovementsSnapshot.forEach(movementDoc => {
                transaction.delete(movementDoc.ref);
            });

            for (const item of oldPurchaseData.items) {
                const productData = productDataMap.get(item.productId);
                if (productData) {
                    const productRef = doc(productsCollectionRef, item.productId);
                    const currentStock = productData.stock || 0;
                    const revertedStock = currentStock - item.quantity;
                    transaction.update(productRef, { stock: revertedStock });
                    productDataMap.set(item.productId, { ...productData, stock: revertedStock });
                }
            }
            
            const newItemsWithNames = newPurchaseData.items.map(item => {
                const productData = productDataMap.get(item.productId);
                return {
                    ...item,
                    name: productData ? productData.name : 'Producto no encontrado'
                };
            });

            for (const item of newItemsWithNames) {
                 const productData = productDataMap.get(item.productId);
                 if (productData) {
                    const productRef = doc(productsCollectionRef, item.productId);
                    const currentStock = productData.stock || 0;
                    const newStock = currentStock + item.quantity;
                    const previousCostPrice = productData.costPrice || 0;
                    const newCostPrice = item.costPrice || 0;
                    
                    transaction.update(productRef, { 
                        stock: newStock,
                        costPrice: newCostPrice,
                        taxPercentage: item.taxPercentage 
                    });

                    // Record cost history if price changed
                    if (Math.abs(previousCostPrice - newCostPrice) > 0.01) {
                      const costHistoryRef = doc(productCostHistoryCollection);
                      transaction.set(costHistoryRef, {
                        productId: item.productId,
                        productName: productData.name,
                        previousCostPrice,
                        newCostPrice,
                        difference: newCostPrice - previousCostPrice,
                        differencePercentage: previousCostPrice > 0
                          ? ((newCostPrice - previousCostPrice) / previousCostPrice) * 100
                          : 0,
                        purchaseId,
                        invoiceNumber: newPurchaseData.invoiceNumber,
                        supplierId: newPurchaseData.supplierId,
                        taxesIncluded: newPurchaseData.taxesIncluded ?? false,
                        createdAt: serverTimestamp(),
                        createdBy: { uid: user.uid, email: user.email },
                      });
                    }

                    const movementDocRef = doc(inventoryMovementsCollection);
                    transaction.set(movementDocRef, {
                        purchaseId: purchaseId,
                        productId: item.productId,
                        type: 'ENTRADA',
                        quantity: item.quantity,
                        reason: `MODIFICACIÓN - Compra #${newPurchaseData.invoiceNumber}`,
                        invoiceNumber: newPurchaseData.invoiceNumber,
                        previousStock: currentStock,
                        newStock: newStock,
                        createdAt: serverTimestamp(),
                        userId: user.uid,
                        userEmail: user.email,
                    });
                 }
            }
            
            const purchaseRef = doc(purchasesCollection, purchaseId);
            const purchaseToUpdate = {
                ...newPurchaseData,
                items: newItemsWithNames,
                invoiceImageUrl: newImageUrl,
                updatedAt: serverTimestamp(),
                updatedBy: { uid: user.uid, email: user.email },
            };
            
            delete purchaseToUpdate.id;
            delete purchaseToUpdate.invoiceImage;
            delete purchaseToUpdate.existingImageUrl;
            
            transaction.update(purchaseRef, purchaseToUpdate);
        });

    } catch (error) {
        logError(error, 'updatePurchase', { purchaseId });
        throw new Error("La transacción de actualización de compra falló: " + error.message);
    }
};


export const getPurchases = async () => {
    try {
        const q = query(purchasesCollection, orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        logError(error, 'getPurchases');
        throw error;
    }
};

/**
 * Returns the cost price change history for a specific product.
 * @param {string} productId
 * @returns {Promise<Array>}
 */
export const getProductCostHistory = async (productId) => {
    try {
        const q = query(
            productCostHistoryCollection,
            where('productId', '==', productId),
            orderBy('createdAt', 'desc')
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (error) {
        logError(error, 'getProductCostHistory', { productId });
        throw error;
    }
};
