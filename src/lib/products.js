
import { getProducts as getProductsFromDb, getProductById as getProductByIdFromDb } from './products-service';

const serializeProduct = (product) => {
    if (!product) return product;
    
    const plainProduct = JSON.parse(JSON.stringify(product));
    
    // Firestore Timestamps are not automatically converted for nested objects.
    if (product.createdAt) {
        plainProduct.createdAt = product.createdAt.toDate().toISOString();
    }
    if (product.updatedAt) {
        plainProduct.updatedAt = product.updatedAt.toDate().toISOString();
    }

    return plainProduct;
}

const serializeProducts = (products) => {
    return products.map(serializeProduct);
}
