'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { ChevronDown, Filter, ShoppingBag } from 'lucide-react';

import Navigation from '@/components/ecommerce/Navigation';
import Footer from '@/components/ecommerce/Footer';
import CartSidebar from '@/components/ecommerce/cart/CartSidebar';
import { useCart } from '@/app/e-commerce/CartContext';
import catalogService, {
  CatalogCategory,
  GetProductsParams,
  PaginationMeta,
  SimpleProduct,
} from '@/services/catalogService';
import {
  buildCardProductsFromResponse,
  getAdditionalVariantCount,
  getCardPriceText,
  getCardStockLabel,
} from '@/lib/ecommerceCardUtils';

type ProductSort = NonNullable<GetProductsParams['sort_by']>;


const getNewestKey = (product: SimpleProduct): number => {
  const variantIds = Array.isArray((product as any).variants)
    ? ((product as any).variants as any[]).map((v) => Number(v?.id) || 0)
    : [];
  const selfId = Number(product?.id) || 0;
  return Math.max(selfId, ...variantIds);
};

export default function ProductsPage() {
  const router = useRouter();

  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<ProductSort>('newest');
  const [isLoading, setIsLoading] = useState(false);

  const [products, setProducts] = useState<SimpleProduct[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);

  const [isCartOpen, setIsCartOpen] = useState(false);
  const { addToCart } = useCart();

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [selectedCategory, searchTerm, sortBy]);

  const fetchCategories = async () => {
    try {
      const categoryData = await catalogService.getCategories();
      setCategories(categoryData);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const fetchProducts = async () => {
    setIsLoading(true);
    try {
      const params: GetProductsParams = {
        page: 1,
        per_page: 20,
      };

      if (selectedCategory !== 'all') {
        params.category_id = Number(selectedCategory);
        const cat = categories.find((c) => String(c.id) === String(selectedCategory));
        if (cat) {
          params.category = cat.slug || cat.name;
        }
      }

      if (searchTerm.trim()) {
        params.search = searchTerm.trim();
      }

      params.sort_by = sortBy;

      const response = await catalogService.getProducts(params);
      let cardProducts = buildCardProductsFromResponse(response);
      if (sortBy === 'newest') {
        cardProducts = [...cardProducts].sort((a, b) => getNewestKey(b) - getNewestKey(a));
      }

      setProducts(cardProducts);
      setPagination(response.pagination);
    } catch (error) {
      console.error('Error fetching products:', error);
      setProducts([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddToCart = async (product: SimpleProduct) => {
    if (product.has_variants) {
      router.push(`/e-commerce/product/${product.id}`);
      return;
    }

    try {
      await addToCart(product.id, 1);
      setIsCartOpen(true);
    } catch (error) {
      console.error('Error adding to cart:', error);
    }
  };

  const navigateToProduct = (identifier: number | string) => {
    router.push(`/e-commerce/product/${identifier}`);
  };

  return (
    <>
      <div className="min-h-screen bg-white">
        <Navigation />

        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">All Products</h1>
            <p className="text-gray-600">Browse our complete collection</p>
          </div>

          <div className="bg-gray-50 rounded-lg p-4 mb-8">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-2">
                <input
                  type="text"
                  placeholder="Search products..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div className="relative">
                <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full pl-10 pr-8 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 appearance-none bg-white"
                >
                  <option value="all">All Categories</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id.toString()}>
                      {category.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              </div>

              <div className="relative">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as ProductSort)}
                  className="w-full pl-4 pr-8 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 appearance-none bg-white"
                >
                  <option value="newest">Newest</option>
                  <option value="name">Name</option>
                  <option value="price_asc">Price: Low to High</option>
                  <option value="price_desc">Price: High to Low</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              </div>
            </div>
          </div>

          {isLoading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-red-700" />
              <p className="mt-4 text-gray-600">Loading products...</p>
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-12">
              <ShoppingBag className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No products found</h3>
              <p className="text-gray-600">Try adjusting your search or filters</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {products.map((product) => {
                const imageUrl = product.images?.[0]?.url || '/images/placeholder-product.jpg';
                const additionalVariants = getAdditionalVariantCount(product);
                const stockLabel = getCardStockLabel(product);
                const hasStock = stockLabel !== 'Out of Stock';

                return (
                  <div
                    key={product.id}
                    className="group bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg transition-all duration-300"
                  >
                    <div className="relative aspect-[3/4] bg-gray-100 overflow-hidden">
                      <Image
                        src={imageUrl}
                        alt={product.display_name || product.base_name || product.name}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                      />

                      {additionalVariants > 0 && (
                        <span className="absolute top-2 left-2 bg-purple-600 text-white text-xs px-2 py-1 rounded-full">
                          +{additionalVariants} variation options
                        </span>
                      )}

                      <span
                        className={`absolute top-2 right-2 text-xs px-2 py-1 rounded-full ${
                          stockLabel === 'In Stock'
                            ? 'bg-green-100 text-green-700'
                            : hasStock
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {stockLabel}
                      </span>
                    </div>

                    <div className="p-4 text-center">
                      <h3
                        onClick={() => navigateToProduct(product.id)}
                        className="text-sm font-semibold text-gray-900 mb-2 line-clamp-2 group-hover:text-red-600 transition-colors cursor-pointer"
                      >
                        {product.display_name || product.base_name || product.name}
                      </h3>

                      <span className="text-lg font-bold text-red-700">{getCardPriceText(product)}</span>

                      <button
                        onClick={() => handleAddToCart(product)}
                        className="mt-3 w-full bg-red-600 text-white py-2 rounded-md text-sm font-medium hover:bg-red-700 transition-colors"
                      >
                        {product.has_variants ? 'Select Variation' : 'Add to Cart'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {pagination && pagination.last_page > 1 && (
            <div className="mt-8 text-center text-sm text-gray-600">
              Page {pagination.current_page} of {pagination.last_page}
            </div>
          )}
        </div>

        <Footer />
      </div>

      <CartSidebar isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
    </>
  );
}
