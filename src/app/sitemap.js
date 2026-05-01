import { getProducts } from '@/lib/products-service';

export default async function sitemap() {
  const baseUrl = 'https://licorera-otro-zarpe.web.app';

  // Base routes
  const routes = [
    '',
    '/products',
    '/login',
    '/signup',
  ].map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: 'daily',
    priority: route === '' ? 1 : 0.8,
  }));

  try {
    // Dynamic product routes
    // Note: We use try-catch because getProducts might fail in some server environments 
    // if Firebase is not fully configured for Node.js
    const products = await getProducts({ activeOnly: true, isTest: false });
    
    const productRoutes = products.map((product) => ({
      url: `${baseUrl}/products/${product.id}`,
      lastModified: product.updatedAt?.toDate() || new Date(),
      changeFrequency: 'weekly',
      priority: 0.6,
    }));

    return [...routes, ...productRoutes];
  } catch (error) {
    console.error('Sitemap generation error:', error);
    return routes;
  }
}
