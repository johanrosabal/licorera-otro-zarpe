import { collection, addDoc, doc, runTransaction, serverTimestamp, getDocs, query, orderBy, getDoc, where, updateDoc, collectionGroup, limit, arrayUnion } from 'firebase/firestore';
import { db, storage } from './firebase';
import { getPaymentMethodsWithAccounts } from './payment-methods';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { logError } from './errors';

const ordersCollection = collection(db, 'orders');
const inventoryMovementsCollection = collection(db, 'inventoryMovements');
const productsCollectionRef = collection(db, 'products');


async function uploadPaymentReceipt(imageFile) {
    const storageRef = ref(storage, `paymentReceipts/${Date.now()}-${imageFile.name}`);
    await uploadBytes(storageRef, imageFile);
    const downloadURL = await getDownloadURL(storageRef);
    return downloadURL;
}

export const getOrderById = async (orderId) => {
    try {
        const orderRef = doc(db, 'orders', orderId);
        const orderSnap = await getDoc(orderRef);

        if (orderSnap.exists()) {
            const orderData = orderSnap.data();
            if (orderData.paymentMethod?.id) {
                 const methods = await getPaymentMethodsWithAccounts();
                 const fullMethod = methods.find(m => m.id === orderData.paymentMethod.id);
                 if (fullMethod) {
                    orderData.paymentMethod = fullMethod;
                 }
            }
            return { id: orderSnap.id, ...orderData };
        }
        return null;
    } catch (error) {
        logError(error, 'getOrderById', { orderId });
        throw error;
    }
}

export const getOrdersByUserId = async (userId) => {
    try {
        const q = query(ordersCollection, where('userId', '==', userId), orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        logError(error, 'getOrdersByUserId', { userId });
        throw error;
    }
};

export const getAllOrders = async () => {
    try {
        const q = query(ordersCollection, orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        logError(error, 'getAllOrders');
        throw error;
    }
}


export const createOrder = async ({ userId, userName, userEmail, items, subtotal, total, deliveryFee, paymentMethod, paymentReceipt, paymentReference }) => {
    if (!userId || !items || items.length === 0 || !paymentMethod) {
        throw new Error('Faltan datos para crear la orden.');
    }
    
    const orderDocRef = doc(collection(db, 'orders'));

    try {
        const lastOrderQuery = query(ordersCollection, orderBy('invoiceNumber', 'desc'), limit(1));
        const lastOrderSnapshot = await getDocs(lastOrderQuery);
        
        let nextInvoiceNumber = 1;
        if (!lastOrderSnapshot.empty) {
            const lastInvoiceStr = lastOrderSnapshot.docs[0].data().invoiceNumber;
            if(lastInvoiceStr) {
              const lastInvoiceNum = parseInt(lastInvoiceStr, 10);
              if(!isNaN(lastInvoiceNum)) {
                 nextInvoiceNumber = lastInvoiceNum + 1;
              }
            }
        }
        const formattedInvoiceNumber = String(nextInvoiceNumber).padStart(6, '0');

        await runTransaction(db, async (transaction) => {
            const userDocRef = doc(db, 'users', userId);
            const userDoc = await transaction.get(userDocRef);
            const userData = userDoc.exists() ? userDoc.data() : {};

            let paymentReceiptUrl = null;
            if (paymentReceipt instanceof File) {
                paymentReceiptUrl = await uploadPaymentReceipt(paymentReceipt);
            }

            const productSnapshots = new Map();
            const allProductIdsToFetch = new Set();
            items.forEach(item => allProductIdsToFetch.add(item.id));
            
            const initialProductDocs = await Promise.all(
              Array.from(allProductIdsToFetch).map(id => transaction.get(doc(db, 'products', id)))
            );

            for (const productDoc of initialProductDocs) {
                if (productDoc.exists()) {
                    productSnapshots.set(productDoc.id, productDoc);
                    const productData = productDoc.data();
                    if (productData.isBundle && productData.bundleItems) {
                        productData.bundleItems.forEach(bundleItem => allProductIdsToFetch.add(bundleItem.productId));
                    }
                }
            }

            const finalProductDocs = await Promise.all(
              Array.from(allProductIdsToFetch).map(id => 
                productSnapshots.has(id) ? Promise.resolve(productSnapshots.get(id)) : transaction.get(doc(db, 'products', id))
              )
            );

            finalProductDocs.forEach(doc => {
                if (doc.exists()) productSnapshots.set(doc.id, doc);
            });

            const orderItems = [];
            for (const cartItem of items) {
                const productDoc = productSnapshots.get(cartItem.id);
                 if (!productDoc || !productDoc.exists()) {
                    throw new Error(`El producto ${cartItem.name} ya no está disponible.`);
                }
                const productData = productDoc.data();
                
                orderItems.push({
                    id: productDoc.id,
                    name: productData.name,
                    quantity: cartItem.quantity,
                    price: productData.sellingPrice,
                    image: productData.image,
                });
                
                if (productData.isBundle) {
                    if (!productData.bundleItems || productData.bundleItems.length === 0) {
                        throw new Error(`El combo "${productData.name}" no tiene artículos configurados.`);
                    }
                    for (const bundleComponent of productData.bundleItems) {
                        const componentDoc = productSnapshots.get(bundleComponent.productId);
                        if (!componentDoc || !componentDoc.exists()) {
                            throw new Error(`Un artículo del combo "${productData.name}" ya no está disponible.`);
                        }
                        const componentData = componentDoc.data();
                        const requiredStock = bundleComponent.quantity * cartItem.quantity;

                        if (componentData.stock < requiredStock) {
                            throw new Error(`Stock insuficiente para "${componentData.name}" en el combo. Disponible: ${componentData.stock}, Requerido: ${requiredStock}.`);
                        }
                        
                        const newStock = componentData.stock - requiredStock;
                        transaction.update(componentDoc.ref, { stock: newStock });
                        
                        const movementDocRef = doc(inventoryMovementsCollection);
                        transaction.set(movementDocRef, {
                            orderId: orderDocRef.id,
                            invoiceNumber: formattedInvoiceNumber,
                            productId: bundleComponent.productId,
                            type: 'SALIDA',
                            quantity: -requiredStock,
                            reason: `Venta Combo: ${productData.name} (#${formattedInvoiceNumber})`,
                            previousStock: componentData.stock,
                            newStock,
                            createdAt: serverTimestamp(),
                            userId, 
                            userEmail: userEmail,
                        });
                    }
                } else {
                    if (productData.stock < cartItem.quantity) {
                        throw new Error(`No hay suficiente stock para ${cartItem.name}. Disponible: ${productData.stock}, Solicitado: ${cartItem.quantity}`);
                    }
                    const newStock = productData.stock - cartItem.quantity;
                    transaction.update(productDoc.ref, { stock: newStock });

                    const movementDocRef = doc(inventoryMovementsCollection);
                    transaction.set(movementDocRef, {
                        orderId: orderDocRef.id,
                        invoiceNumber: formattedInvoiceNumber,
                        productId: productDoc.id,
                        type: 'SALIDA',
                        quantity: -cartItem.quantity,
                        reason: `Venta - Orden #${formattedInvoiceNumber}`,
                        previousStock: productData.stock,
                        newStock,
                        createdAt: serverTimestamp(),
                        userId, 
                        userEmail: userEmail,
                    });
                }
            }
            
            const paymentMethodToStore = {
                id: paymentMethod.id,
                name: paymentMethod.name,
                bankAccountId: paymentMethod.bankAccountId || null,
            };

            const orderData = {
                invoiceNumber: formattedInvoiceNumber,
                userId,
                userName: userData.name || userName,
                userEmail,
                whatsapp: userData.whatsapp || '',
                locationUrl: userData.locationUrl || '',
                items: orderItems,
                subtotal,
                deliveryFee: deliveryFee || 0,
                total,
                paymentMethod: paymentMethodToStore,
                paymentReceiptUrl,
                paymentReference: paymentReference || null, // Store the payment reference
                status: paymentReceiptUrl ? 'Verificar Pago' : 'Pendiente de Pago',
                createdAt: serverTimestamp(),
                repartidorAsignadoId: null,
            };

            transaction.set(orderDocRef, orderData);
        });
        
        return { orderId: orderDocRef.id, invoiceNumber: formattedInvoiceNumber };
    } catch (error) {
        logError(error, 'createOrder', { userId });
        throw error;
    }
};

export const updateOrderStatus = async (orderId, newStatus) => {
    const orderRef = doc(db, 'orders', orderId);
    const VERIFIED_STATUSES = ['Pagado', 'En Preparación', 'Enviado', 'Completado'];
    
    try {
        await runTransaction(db, async (transaction) => {
            const orderDoc = await transaction.get(orderRef);
            if (!orderDoc.exists()) throw new Error("La orden no existe.");
            
            const orderData = orderDoc.data();
            const oldStatus = orderData.status;
            
            if (oldStatus === newStatus) return;

            // 1. Handle Inventory Reversion if Cancelling
            if (newStatus === 'Cancelado' && oldStatus !== 'Cancelado') {
                const stockToRevert = new Map();
                const allProductIdsToFetch = new Set();
                orderData.items.forEach(item => allProductIdsToFetch.add(item.id));
                
                const productDocs = await Promise.all(Array.from(allProductIdsToFetch).map(id => transaction.get(doc(db, 'products', id))));
                const productDataMap = new Map();
                for (const docSnap of productDocs) {
                    if (docSnap.exists()) productDataMap.set(docSnap.id, docSnap.data());
                }
                
                for (const item of orderData.items) {
                    const productData = productDataMap.get(item.id);
                    if (productData?.isBundle) {
                        for (const bundleItem of productData.bundleItems) {
                             if (!productDataMap.has(bundleItem.productId)) {
                                const componentDoc = await transaction.get(doc(db, 'products', bundleItem.productId));
                                if (componentDoc.exists()) productDataMap.set(componentDoc.id, componentDoc.data());
                             }
                        }
                    }
                }

                for (const item of orderData.items) {
                    const productData = productDataMap.get(item.id);
                    if (!productData) continue;
                    if (productData.isBundle) {
                        productData.bundleItems.forEach(bundleItem => {
                            const quantityToRevert = bundleItem.quantity * item.quantity;
                            stockToRevert.set(bundleItem.productId, (stockToRevert.get(bundleItem.productId) || 0) + quantityToRevert);
                        });
                    } else {
                        stockToRevert.set(item.id, (stockToRevert.get(item.id) || 0) + item.quantity);
                    }
                }
                
                for (const [productId, quantity] of stockToRevert.entries()) {
                    const productRef = doc(db, 'products', productId);
                    const productData = productDataMap.get(productId);
                    if (!productData) continue;
                    const currentStock = productData.stock || 0;
                    const newStock = currentStock + quantity;
                    transaction.update(productRef, { stock: newStock });
                    
                    transaction.set(doc(collection(db, 'inventoryMovements')), {
                        orderId,
                        invoiceNumber: orderData.invoiceNumber,
                        productId,
                        type: 'ENTRADA',
                        quantity,
                        reason: `Cancelación - Orden #${orderData.invoiceNumber}`,
                        previousStock: currentStock,
                        newStock,
                        createdAt: serverTimestamp(),
                        userId: orderData.userId,
                        userEmail: orderData.userEmail,
                    });
                }
            }

            // 2. Handle Bank Balance Update
            const bankAccountId = orderData.paymentMethod?.bankAccountId;
            if (bankAccountId) {
                const isOldVerified = VERIFIED_STATUSES.includes(oldStatus);
                const isNewVerified = VERIFIED_STATUSES.includes(newStatus);
                
                if (!isOldVerified && isNewVerified) {
                    // Payment confirmed -> Increase balance
                    const bankAccountRef = doc(db, 'bankAccounts', bankAccountId);
                    const bankAccountSnap = await transaction.get(bankAccountRef);
                    if (bankAccountSnap.exists()) {
                        const accountData = bankAccountSnap.data();
                        const currentBalance = accountData.balance || 0;
                        const newBalance = currentBalance + orderData.total;
                        const limit = accountData.limit || 0;
                        
                        transaction.update(bankAccountRef, { balance: newBalance });

                        // Check if limit exceeded
                        if (limit > 0 && newBalance >= limit) {
                            // Deactivate current account
                            transaction.update(bankAccountRef, { active: false });
                            
                            // Find next available account to activate
                            const allAccountsSnap = await transaction.get(query(collection(db, 'bankAccounts'), orderBy('accountHolder')));
                            const otherAccounts = allAccountsSnap.docs
                                .filter(d => d.id !== bankAccountId)
                                .map(d => ({ id: d.id, ...d.data() }));
                            
                            const nextAccount = otherAccounts.find(acc => {
                                const accLimit = acc.limit || 0;
                                const accBalance = acc.balance || 0;
                                return accLimit === 0 || accBalance < accLimit;
                            });

                            if (nextAccount) {
                                transaction.update(doc(db, 'bankAccounts', nextAccount.id), { active: true });
                            }
                        }
                    }
                } else if (isOldVerified && !isNewVerified) {
                    // Payment reverted (cancelled or moved back) -> Decrease balance
                    const bankAccountRef = doc(db, 'bankAccounts', bankAccountId);
                    const bankAccountSnap = await transaction.get(bankAccountRef);
                    if (bankAccountSnap.exists()) {
                        const currentBalance = bankAccountSnap.data().balance || 0;
                        transaction.update(bankAccountRef, { balance: Math.max(0, currentBalance - orderData.total) });
                    }
                }
            }

            // 3. Update Order Status
            transaction.update(orderRef, { status: newStatus });
        });
    } catch (error) {
        logError(error, 'updateOrderStatus', { orderId, newStatus });
        throw error;
    }
};

export const assignDeliveryUser = async (orderId, userId) => {
    try {
        const orderRef = doc(db, 'orders', orderId);
        await updateDoc(orderRef, {
            repartidorAsignadoId: userId
        });
    } catch (error) {
        logError(error, 'assignDeliveryUser', { orderId, userId });
        throw error;
    }
};
