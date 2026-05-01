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

  return {
    title: product.name,
    description: product.description || `Compra ${product.name} en Licorera Otro Zarpe. La mejor selección de licores con entrega a domicilio.`,
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
