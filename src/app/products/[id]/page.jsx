import ProductClient from './product-client';
import { getProductById } from '@/lib/products-service';

export async function generateMetadata({ params }) {
  const { id } = await params;
  const product = await getProductById(id);

  if (!product) {
    return {
      title: 'Producto no encontrado',
    };
  }

  const siteName = process.env.NEXT_PUBLIC_APP_NAME || 'MI TIENDA';
  return {
    title: product.name,
    description: product.description || `Compra ${product.name} en ${siteName}. La mejor selección de licores con entrega a domicilio.`,
    openGraph: {
      title: product.name,
      description: product.description,
      images: [
        {
          url: product.image,
          alt: product.name,
        },
      ],
    },
  };
}

export default function Page() {
  return <ProductClient />;
}
