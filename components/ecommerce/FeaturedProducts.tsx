'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ShoppingCart, Star, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import catalogService, { SimpleProduct } from '@/services/catalogService';
import { useCart } from '@/app/e-commerce/CartContext';
import {
  buildCardProductsFromResponse,
  getAdditionalVariantCount,
  getCardPriceText,
  getCardStockLabel,
} from '@/lib/ecommerceCardUtils';

const toast = {
  success: (message: string) => {
    if (typeof window !== 'undefined') console.log(message);
  },
  error: (message: string) => {
    if (typeof window !== 'undefined') console.error(message);
  },
};

interface FeaturedProductsProps {
  categoryId?: number;
  limit?: number;
}

export default function FeaturedProducts({ categoryId, limit = 8 }: FeaturedProductsProps) {
  const router = useRouter();
  const [products, setProducts] = useState<SimpleProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingProductIds, setLoadingProductIds] = useState<Set<number>>(new Set());
  const [isNavigating, setIsNavigating] = useState(false);
  const { addToCart } = useCart();

  useEffect(() => {
    fetchFeaturedProducts();
  }, [categoryId, limit]);

  const fetchFeaturedProducts = async () => {
    try {
      setIsLoading(true);
      let displayProducts: SimpleProduct[] = [];

      if (categoryId) {
        // Category-specific widget usage: ask catalog API for featured entries in this category.
        const response = await catalogService.getProducts({
          category_id: categoryId,
          per_page: Math.max(limit, 20),
          sort_by: 'newest',
          featured: true,
        });
        displayProducts = buildCardProductsFromResponse(response);
      } else {
        // Home widget usage: use dedicated featured endpoint first so this section
        // is not identical to New Arrivals.
        const featured = await catalogService.getFeaturedProducts(Math.max(limit, 20));
        displayProducts = Array.isArray(featured) ? featured : [];

        // Fallback for backends that don't expose featured endpoint/data yet.
        if (displayProducts.length === 0) {
          const fallback = await catalogService.getProducts({
            per_page: Math.max(limit, 20),
            sort_by: 'price_desc',
            featured: true,
          });
          displayProducts = buildCardProductsFromResponse(fallback);
        }
      }

      setProducts(displayProducts.slice(0, limit));
    } catch (error) {
      console.error('Error fetching featured products:', error);
      toast.error('Failed to load featured products');
      setProducts([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddToCart = async (e: React.MouseEvent, product: SimpleProduct) => {
    e.preventDefault();
    e.stopPropagation();

    if (product.has_variants) {
      router.push(`/e-commerce/product/${product.id}`);
      return;
    }

    if (loadingProductIds.has(product.id)) {
      return;
    }

    setLoadingProductIds((prev) => new Set(prev).add(product.id));

    try {
      await addToCart(product, 1);
      toast.success(`${product.display_name || product.name} added to cart!`);
    } catch (error: any) {
      console.error('Error adding to cart:', error);
      toast.error(error.message || 'Failed to add item to cart');
    } finally {
      setLoadingProductIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(product.id);
        return newSet;
      });
    }
  };

  const handleBuyNow = async (e: React.MouseEvent, product: SimpleProduct) => {
    e.preventDefault();
    e.stopPropagation();

    if (product.has_variants) {
      router.push(`/e-commerce/product/${product.id}`);
      return;
    }

    if (loadingProductIds.has(product.id)) {
      return;
    }

    setLoadingProductIds((prev) => new Set(prev).add(product.id));

    try {
      await addToCart(product, 1);
      toast.success('Proceeding to checkout...');
      setIsNavigating(true);
      router.push('/e-commerce/checkout');
    } catch (error: any) {
      console.error('Error in buy now:', error);
      toast.error(error.message || 'Failed to proceed');
    } finally {
      setLoadingProductIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(product.id);
        return newSet;
      });
      setIsNavigating(false);
    }
  };

  if (isLoading) {
    return (
      <section className="py-16 bg-gradient-to-br from-white to-slate-50">
        <div className="container mx-auto px-6 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-orange-100 to-red-100 rounded-full mb-4">
            <Loader2 className="h-8 w-8 text-orange-600 animate-spin" />
          </div>
          <p className="text-gray-600 text-lg">Loading featured products...</p>
        </div>
      </section>
    );
  }

  if (products.length === 0) {
    return null;
  }

  return (
    <section className="py-16 bg-gradient-to-br from-white to-slate-50">
      <div className="container mx-auto px-6">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-gradient-to-r from-orange-100 to-red-100 px-4 py-2 rounded-full mb-4">
            <Star className="h-4 w-4 text-orange-600" fill="currentColor" />
            <span className="text-sm font-semibold text-orange-800">Featured Collection</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent mb-4">
            Featured Products
          </h2>
          <p className="text-gray-600 text-lg max-w-2xl mx-auto">
            Discover our handpicked selection of premium products
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
          {products.map((product, index) => {
            const imageUrl = product.images?.[0]?.url || '/images/placeholder-product.jpg';
            const productName = product.display_name || product.base_name || product.name;
            const additionalVariants = getAdditionalVariantCount(product);
            const stockLabel = getCardStockLabel(product);
            const isMainInStock = stockLabel === 'In Stock';
            const hasAnyStock = stockLabel !== 'Out of Stock';

            return (
              <Link
                key={`${product.id}-${index}`}
                href={`/e-commerce/product/${product.id}`}
                className="group bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-2xl hover:-translate-y-2 transition-all duration-500"
              >
                <div className="relative aspect-[4/5] overflow-hidden bg-gradient-to-br from-gray-50 to-gray-100">
                  <Image
                    src={imageUrl}
                    alt={productName}
                    fill
                    className="object-cover group-hover:scale-110 transition-transform duration-700"
                  />

                  <div className="absolute top-3 left-3 flex flex-col gap-2">
                    {additionalVariants > 0 && (
                      <span className="bg-purple-500 text-white text-xs px-3 py-1 rounded-full font-medium shadow-lg">
                        +{additionalVariants} variants available
                      </span>
                    )}

                    <span
                      className={`text-xs px-3 py-1 rounded-full font-medium shadow-lg ${
                        isMainInStock
                          ? 'bg-green-500 text-white'
                          : hasAnyStock
                          ? 'bg-amber-500 text-white'
                          : 'bg-red-500 text-white'
                      }`}
                    >
                      {stockLabel}
                    </span>
                  </div>
                </div>

                <div className="p-6">
                  <h3 className="font-bold text-gray-900 mb-2 line-clamp-2 min-h-[3.5rem] group-hover:text-orange-600 transition-colors text-lg leading-tight">
                    {productName}
                  </h3>

                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-2xl font-bold text-orange-600">{getCardPriceText(product)}</span>
                  </div>

                  <div className="space-y-3">
                    <button
                      onClick={(e) => handleAddToCart(e, product)}
                      disabled={loadingProductIds.has(product.id)}
                      className="w-full bg-gradient-to-r from-orange-500 to-red-500 text-white px-4 py-3 rounded-xl text-sm font-semibold hover:from-orange-600 hover:to-red-600 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg hover:shadow-xl"
                    >
                      {loadingProductIds.has(product.id) ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Loading...
                        </>
                      ) : product.has_variants ? (
                        'Select Option'
                      ) : (
                        <>
                          <ShoppingCart className="h-4 w-4" />
                          Add to Cart
                        </>
                      )}
                    </button>

                    <button
                      onClick={(e) => handleBuyNow(e, product)}
                      disabled={loadingProductIds.has(product.id) || isNavigating}
                      className="w-full border-2 border-orange-500 text-orange-600 px-4 py-3 rounded-xl text-sm font-semibold hover:bg-orange-500 hover:text-white transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isNavigating ? 'Loading...' : product.has_variants ? 'Select Variant' : 'Buy Now'}
                    </button>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
