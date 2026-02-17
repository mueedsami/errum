'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

import { useCart } from '@/app/e-commerce/CartContext';
import catalogService, { SimpleProduct } from '@/services/catalogService';
import {
  buildCardProductsFromResponse,
  getAdditionalVariantCount,
  getCardPriceText,
  getCardStockLabel,
} from '@/lib/ecommerceCardUtils';

interface NewArrivalsProps {
  categoryId?: number;
  limit?: number;
}

const NewArrivals: React.FC<NewArrivalsProps> = ({ categoryId, limit = 8 }) => {
  const router = useRouter();
  const [products, setProducts] = useState<SimpleProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [imageErrors, setImageErrors] = useState<Set<number>>(new Set());
  const { addToCart } = useCart();

  useEffect(() => {
    fetchNewArrivals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryId, limit]);

  const fetchNewArrivals = async () => {
    setIsLoading(true);
    try {
      const response = await catalogService.getProducts({
        page: 1,
        per_page: Math.max(limit * 2, 16), // fetch extra to ensure deduped cards can still fill limit
        category_id: categoryId,
        sort_by: 'newest',
      });

      const cardProducts = buildCardProductsFromResponse(response).slice(0, limit);
      setProducts(cardProducts);
    } catch (error) {
      console.error('Error fetching new arrivals:', error);
      setProducts([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleImageError = (productId: number) => {
    setImageErrors((prev) => new Set([...prev, productId]));
  };

  const handleProductClick = (product: SimpleProduct) => {
    router.push(`/e-commerce/product/${product.id}`);
  };

  const handleAddToCart = async (product: SimpleProduct, e: React.MouseEvent) => {
    e.stopPropagation();

    if (product.has_variants) {
      router.push(`/e-commerce/product/${product.id}`);
      return;
    }

    try {
      await addToCart(product.id, 1);
      router.push('/e-commerce/checkout');
    } catch (error) {
      console.error('Error adding to cart:', error);
    }
  };

  if (isLoading) {
    return (
      <section className="py-8 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">New Arrivals</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {[...Array(limit)].map((_, i) => (
              <div key={i} className="bg-white rounded-lg shadow-sm border border-gray-100 animate-pulse">
                <div className="aspect-[3/4] bg-gray-200 rounded-t-lg"></div>
                <div className="p-4 space-y-2">
                  <div className="h-4 bg-gray-200 rounded"></div>
                  <div className="h-4 bg-gray-200 rounded w-2/3"></div>
                  <div className="h-6 bg-gray-200 rounded w-1/2"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (products.length === 0) {
    return null;
  }

  return (
    <section className="py-8 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900">New Arrivals</h2>
          <button
            onClick={() => router.push('/e-commerce/products')}
            className="text-red-700 hover:text-red-800 font-medium text-sm"
          >
            View All →
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {products.map((product) => {
            const imageUrl = !imageErrors.has(product.id) && product.images?.[0]?.url
              ? product.images[0].url
              : '/images/placeholder-product.jpg';

            const additionalVariants = getAdditionalVariantCount(product);
            const stockLabel = getCardStockLabel(product);
            const hasStock = stockLabel !== 'Out of Stock';

            return (
              <div
                key={product.id}
                onClick={() => handleProductClick(product)}
                className="group cursor-pointer"
              >
                <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow duration-300">
                  <div className="relative aspect-[3/4] bg-gray-100">
                    <Image
                      src={imageUrl}
                      alt={product.display_name || product.base_name || product.name}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                      onError={() => handleImageError(product.id)}
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

                  <div className="p-4">
                    <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2 text-sm">
                      {product.display_name || product.base_name || product.name}
                    </h3>

                    <div className="mb-3">
                      <span className="text-lg font-bold text-red-700">{getCardPriceText(product)}</span>
                    </div>

                    <button
                      onClick={(e) => handleAddToCart(product, e)}
                      className="w-full bg-red-700 hover:bg-red-800 text-white py-2 px-4 rounded-md text-sm font-medium transition-colors"
                    >
                      {product.has_variants ? 'Select Variation' : 'Add to Cart'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default NewArrivals;
