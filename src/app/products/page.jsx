

'use client'

import { useState, useMemo, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { ProductCard } from '@/components/product-card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, Search } from 'lucide-react'
import { getCategories } from '@/lib/categories'
import { getBrands } from '@/lib/brands'
import { collection, onSnapshot, query, where, orderBy } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { ProductDetailModal } from '@/components/product/product-details'
import { useAuth } from '@/hooks/use-auth'


export default function ProductsPage() {
  const searchParams = useSearchParams()
  const initialCategory = searchParams.get('category') || 'Todos'

  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState(initialCategory)
  const [selectedBrand, setSelectedBrand] = useState('Todos');
  const [sortBy, setSortBy] = useState('name-asc');
  const [categories, setCategories] = useState([])
  const [brands, setBrands] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { user } = useAuth();

  const handleProductClick = (product) => {
    setSelectedProduct(product);
    setIsModalOpen(true);
  };

  useEffect(() => {
    setLoading(true);
    const productsQuery = query(
      collection(db, 'products'),
      where("active", "==", true),
      orderBy("name", "asc")
    );

    const productsUnsubscribe = onSnapshot(productsQuery, (snapshot) => {
      const fetchedProducts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setProducts(fetchedProducts);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching products:", error);
      setLoading(false);
    });

    // Fetch active categories
    const categoriesQuery = query(collection(db, 'categories'), where("active", "==", true), orderBy("name"));
    const categoriesUnsubscribe = onSnapshot(categoriesQuery, (snapshot) => {
       setCategories(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    
    // Fetch active brands
    const brandsQuery = query(collection(db, 'brands'), where("active", "==", true), orderBy("name"));
    const brandsUnsubscribe = onSnapshot(brandsQuery, (snapshot) => {
       setBrands(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });


    return () => {
      productsUnsubscribe();
      categoriesUnsubscribe();
      brandsUnsubscribe();
    };
  }, [])

  const productsWithCalculatedStock = useMemo(() => {
    const productsMap = new Map(products.map(p => [p.id, p]));
    return products.map(p => {
        if (!p.isBundle || !p.bundleItems || p.bundleItems.length === 0) {
            return p;
        }

        let calculatedStock = Infinity;
        for (const bundleItem of p.bundleItems) {
            const component = productsMap.get(bundleItem.productId);
            if (!component || component.stock === 0) {
                calculatedStock = 0;
                break;
            }
            const possibleCombos = Math.floor(component.stock / bundleItem.quantity);
            if (possibleCombos < calculatedStock) {
                calculatedStock = possibleCombos;
            }
        }

        return { ...p, stock: calculatedStock === Infinity ? 0 : calculatedStock };
    });
  }, [products]);

  const visibleProducts = useMemo(() => {
    if (user?.role === 'ADMIN') {
        return productsWithCalculatedStock;
    }
    return productsWithCalculatedStock.filter(p => !p.isTestProduct);
  }, [productsWithCalculatedStock, user]);


  const filteredProducts = useMemo(() => {
    return visibleProducts
      .filter(product =>
        product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.description.toLowerCase().includes(searchTerm.toLowerCase())
      )
      .filter(product =>
        selectedCategory === 'Todos' ? true : product.category === selectedCategory
      )
      .filter(product =>
        selectedBrand === 'Todos' ? true : product.brand === selectedBrand
      )
      .sort((a, b) => {
          switch (sortBy) {
              case 'price-asc':
                  return a.sellingPrice - b.sellingPrice;
              case 'price-desc':
                  return b.sellingPrice - a.sellingPrice;
              case 'name-asc':
              default:
                  return a.name.localeCompare(b.name);
          }
      });
  }, [searchTerm, selectedCategory, selectedBrand, sortBy, visibleProducts])

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <ProductDetailModal 
          product={selectedProduct} 
          allProducts={products} 
          open={isModalOpen} 
          onOpenChange={setIsModalOpen}
      />
      <div className="space-y-8">
        <div>
          <h1 className="font-headline text-4xl md:text-5xl text-center mb-2">Nuestro Catálogo</h1>
          <p className="text-lg text-muted-foreground text-center max-w-2xl mx-auto">
            Explora nuestra completa selección. Usa los filtros para encontrar exactamente lo que buscas.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 sticky top-16 bg-background/95 backdrop-blur-sm z-40 py-4 -mx-4 px-4 border-b">
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Buscar por nombre o descripción..."
              className="pl-10 w-full"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger>
              <SelectValue placeholder="Categoría" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Todos">Todas las categorías</SelectItem>
              {categories.map(category => (
                <SelectItem key={category.id} value={category.name}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedBrand} onValueChange={setSelectedBrand}>
            <SelectTrigger>
              <SelectValue placeholder="Marca" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Todos">Todas las marcas</SelectItem>
              {brands.map(brand => (
                <SelectItem key={brand.id} value={brand.name}>
                  {brand.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
           <div className="md:col-span-4 flex justify-end">
                <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger className="w-full md:w-[200px]">
                        <SelectValue placeholder="Ordenar por" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="name-asc">Nombre (A-Z)</SelectItem>
                        <SelectItem value="price-asc">Precio (Menor a Mayor)</SelectItem>
                        <SelectItem value="price-desc">Precio (Mayor a Menor)</SelectItem>
                    </SelectContent>
                </Select>
           </div>
        </div>
        
        {loading ? (
          <div className="flex justify-center items-center py-16">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
          </div>
        ) : filteredProducts.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {filteredProducts.map((product) => (
              <ProductCard key={product.id} product={product} onProductClick={() => handleProductClick(product)} />
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <p className="text-2xl font-headline text-muted-foreground">No se encontraron productos</p>
            <p className="text-muted-foreground mt-2">Intenta cambiar tu búsqueda o filtros.</p>
          </div>
        )}
      </div>
    </div>
  )
}
