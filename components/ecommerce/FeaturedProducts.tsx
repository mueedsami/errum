'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

import { useCart } from '@/app/e-commerce/CartContext';
import catalogService, { SimpleProduct } from '@/services/catalogService';
import {
  getAdditionalVariantCount,
  getCardPriceText,
  getCardStockLabel,
} from '@/lib/ecommerceCardUtils';
import { getBaseProductName } from '@/lib/productNameUtils';

interface FeaturedProductsProps {
  categoryId?: number;
  limit?: number;
}

const getNewestKey = (product: SimpleProduct): number => {
  const variantIds = Array.isArray((product as any).variants)
    ? ((product as any).variants as any[]).map((v) => Number(v?.id) || 0)
    : [];
  const selfId = Number(product?.id) || 0;
  return Math.max(selfId, ...variantIds);
};

const pickMainVariant = (variants: SimpleProduct[]): SimpleProduct => {
  const sorted = [...variants].sort((a, b) => {
    const aStock = Number(a.stock_quantity || 0) > 0 ? 1 : 0;
    const bStock = Number(b.stock_quantity || 0) > 0 ? 1 : 0;
    if (bStock !== aStock) return bStock - aStock;

    const aPrice = Number(a.selling_price || 0);
    const bPrice = Number(b.selling_price || 0);
    if (aPrice !== bPrice) return aPrice - bPrice;

    return a.id - b.id;
  });

  return sorted[0];
};

const groupFeaturedVariants = (items: SimpleProduct[]): SimpleProduct[] => {
  const buckets = new Map<string, SimpleProduct[]>();

  items.forEach((product) => {
    const baseName = (product.base_name || getBaseProductName(product.name) || product.name || '').trim();
    const categoryKey = typeof product.category === 'object' && product.category ? product.category.id || product.category.name : String(product.category || '');
    const key = `${baseName.toLowerCase()}|${String(categoryKey).toLowerCase()}`;

    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push({ ...product, base_name: baseName });
  });

  const cards: SimpleProduct[] = [];
  buckets.forEach((variants) => {
    if (!variants.length) return;

    const main = pickMainVariant(variants);
    cards.push({
      ...main,
      display_name: main.base_name || main.display_name || main.name,
      has_variants: variants.length > 1,
      total_variants: variants.length,
      variants,
    });
  });

  return cards;
};

const FeaturedProducts: React.FC<FeaturedProductsProps> = ({ categoryId, limit = 8 }) => {
  const router = useRouter();
  const [products, setProducts] = useState<SimpleProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [imageErrors, setImageErrors] = useState<Set<number>>(new Set());
  const { addToCart } = useCart();

  useEffect(() => {
    fetchFeaturedProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryId, limit]);

  const fetchFeaturedProducts = async () => {
    setIsLoading(true);
    try {
      const featuredRawUnsorted = await catalogService.getFeaturedProducts(Math.max(limit * 5, 30));
      const featuredRaw = [...featuredRawUnsorted].sort((a, b) => Number(b?.id || 0) - Number(a?.id || 0));

      const filteredByCategory = categoryId
        ? featuredRaw.filter((p) => {
            if (!p.category) return false;
            if (typeof p.category === 'string') return false;
            return Number(p.category.id) === Number(categoryId);
          })
        : featuredRaw;

      const groupedCardsRaw = groupFeaturedVariants(filteredByCategory);
      const groupedCards = [...groupedCardsRaw].sort((a, b) => getNewestKey(b) - getNewestKey(a));
      setProducts(groupedCards.slice(0, limit));
    } catch (error) {
      console.error('Error fetching featured products:', error);
      setProducts([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleImageError = (productId: number) => {
    setImageErrors((prev) => {
      if (prev.has(productId)) return prev;
      const next = new Set(prev);
      next.add(productId);
      return next;
    });
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
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Featured Products</h2>
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
          <h2 className="text-2xl font-bold text-gray-900">Featured Products</h2>
          <button
            onClick={() => router.push('/e-commerce/products')}
            className="text-neutral-900 hover:text-neutral-700 font-medium text-sm"
          >
            View All →
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {products.map((product) => {
            const primaryImage = product.images?.[0]?.url || '';
            const shouldUseFallback = imageErrors.has(product.id) || !primaryImage;
            const imageUrl = shouldUseFallback
              ? '/images/placeholder-product.jpg'
              : primaryImage;

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
                      onError={shouldUseFallback ? undefined : () => handleImageError(product.id)}
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

export default FeaturedProducts;
