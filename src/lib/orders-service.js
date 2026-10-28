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
    if (!paymentReceipt) {
        throw new Error('El comprobante de pago es obligatorio para procesar el pedido.');
    }
    
    const orderDocRef = doc(collection(db, 'orders'));

    try {
        let paymentReceiptUrl = null;
        if (paymentReceipt instanceof File) {
            paymentReceiptUrl = await uploadPaymentReceipt(paymentReceipt);
        } else {
            throw new Error('El archivo del comprobante de pago no es válido.');
        }

        let formattedInvoiceNumber = '000001';

        await runTransaction(db, async (transaction) => {
            // ── PHASE 1: ALL READS ──────────────────────────────────────────
            const counterDocRef = doc(db, 'settings', 'orderCounter');
            const counterDoc = await transaction.get(counterDocRef);

            const userDocRef = doc(db, 'users', userId);
            const userDoc = await transaction.get(userDocRef);

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

            finalProductDocs.forEach(docSnap => {
                if (docSnap.exists()) productSnapshots.set(docSnap.id, docSnap);
            });

            // ── PHASE 2: CALCULATIONS & VALIDATIONS (IN-MEMORY) ─────────────
            let nextInvoiceNumber = 1;
            if (counterDoc.exists() && counterDoc.data().lastInvoiceNumber) {
                nextInvoiceNumber = (counterDoc.data().lastInvoiceNumber || 0) + 1;
            }
            formattedInvoiceNumber = String(nextInvoiceNumber).padStart(6, '0');

            const userData = userDoc.exists() ? userDoc.data() : {};
            const finalUserName = userData.name || userName || userEmail || 'Cliente';
            const finalUserEmail = userEmail || userData.email || '';
            const finalPaymentReceiptUrl = paymentReceiptUrl || null;
            const finalPaymentRef = paymentReference || null;

            const stockUpdates = [];
            const movementWrites = [];
            const orderItems = [];

            for (const cartItem of items) {
                const productDoc = productSnapshots.get(cartItem.id);
                if (!productDoc || !productDoc.exists()) {
                    throw new Error(`El producto "${cartItem.name}" ya no está disponible.`);
                }
                const productData = productDoc.data();
                
                orderItems.push({
                    id: productDoc.id,
                    name: productData.name || cartItem.name || 'Producto',
                    quantity: Number(cartItem.quantity) || 1,
                    price: Number(productData.sellingPrice) || Number(cartItem.sellingPrice) || 0,
                    image: productData.image || cartItem.image || '',
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
                        const currentCompStock = Number(componentData.stock) || 0;
                        const requiredStock = (Number(bundleComponent.quantity) || 1) * (Number(cartItem.quantity) || 1);

                        if (currentCompStock < requiredStock) {
                            throw new Error(`Stock insuficiente para "${componentData.name}" en el combo. Disponible: ${currentCompStock}, Requerido: ${requiredStock}.`);
                        }
                        
                        const newStock = currentCompStock - requiredStock;
                        stockUpdates.push({ ref: componentDoc.ref, stock: newStock });

                        const movementDocRef = doc(inventoryMovementsCollection);
                        movementWrites.push({
                            ref: movementDocRef,
                            data: {
                                orderId: orderDocRef.id,
                                invoiceNumber: formattedInvoiceNumber,
                                productId: bundleComponent.productId,
                                type: 'SALIDA',
                                quantity: -requiredStock,
                                reason: `Venta Combo: ${productData.name} (#${formattedInvoiceNumber})`,
                                previousStock: currentCompStock,
                                newStock,
                                createdAt: serverTimestamp(),
                                userId, 
                                userEmail: finalUserEmail,
                            }
                        });
                    }
                } else {
                    const currentProdStock = Number(productData.stock) || 0;
                    const requestedQty = Number(cartItem.quantity) || 1;
                    if (currentProdStock < requestedQty) {
                        throw new Error(`No hay suficiente stock para "${cartItem.name}". Disponible: ${currentProdStock}, Solicitado: ${requestedQty}`);
                    }
                    const newStock = currentProdStock - requestedQty;
                    stockUpdates.push({ ref: productDoc.ref, stock: newStock });

                    const movementDocRef = doc(inventoryMovementsCollection);
                    movementWrites.push({
                        ref: movementDocRef,
                        data: {
                            orderId: orderDocRef.id,
                            invoiceNumber: formattedInvoiceNumber,
                            productId: productDoc.id,
                            type: 'SALIDA',
                            quantity: -requestedQty,
                            reason: `Venta - Orden #${formattedInvoiceNumber}`,
                            previousStock: currentProdStock,
                            newStock,
                            createdAt: serverTimestamp(),
                            userId, 
                            userEmail: finalUserEmail,
                        }
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
                userName: finalUserName,
                userEmail: finalUserEmail,
                whatsapp: userData.whatsapp || '',
                locationUrl: userData.locationUrl || '',
                items: orderItems,
                subtotal: Number(subtotal) || 0,
                deliveryFee: Number(deliveryFee) || 0,
                total: Number(total) || 0,
                paymentMethod: paymentMethodToStore,
                paymentReceiptUrl: finalPaymentReceiptUrl,
                paymentReference: finalPaymentRef,
                status: finalPaymentReceiptUrl ? 'Verificar Pago' : 'Pendiente de Pago',
                createdAt: serverTimestamp(),
                repartidorAsignadoId: null,
            };

            // ── PHASE 3: ALL WRITES ─────────────────────────────────────────
            transaction.set(counterDocRef, { 
                lastInvoiceNumber: nextInvoiceNumber,
                updatedAt: serverTimestamp() 
            }, { merge: true });

            for (const update of stockUpdates) {
                transaction.update(update.ref, { stock: update.stock });
            }

            for (const movement of movementWrites) {
                transaction.set(movement.ref, movement.data);
            }

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
