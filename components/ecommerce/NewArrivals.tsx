'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { useCart } from '@/app/e-commerce/CartContext';
import catalogService, { SimpleProduct } from '@/services/catalogService';
import { buildCardProductsFromResponse, getCardNewestSortKey } from '@/lib/ecommerceCardUtils';
import PremiumProductCard from '@/components/ecommerce/ui/PremiumProductCard';
import SectionHeader from '@/components/ecommerce/ui/SectionHeader';

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
        per_page: Math.max(limit * 8, 60),
        category_id: categoryId,
        sort_by: 'newest',
        sort: 'created_at',
        order: 'desc',
        sort_order: 'desc',
        new_arrivals: true,
      });

      const rawCards = buildCardProductsFromResponse(response);
      const sortedCards = [...rawCards]
        .sort((a, b) => getCardNewestSortKey(b) - getCardNewestSortKey(a))
        .slice(0, limit);
      setProducts(sortedCards);
    } catch (error) {
      console.error('Error fetching new arrivals:', error);
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
      <section className="ec-section">
        <div className="ec-container">
          <div className="ec-surface p-4 sm:p-6 lg:p-7">
            <div className="h-3 w-32 rounded bg-neutral-200" />
            <div className="mt-3 h-8 w-48 rounded bg-neutral-200" />
            <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
              {Array.from({ length: limit }).map((_, i) => (
                <div key={i} className="ec-card overflow-hidden rounded-2xl animate-pulse">
                  <div className="aspect-[4/5] bg-neutral-100" />
                  <div className="p-4 space-y-2">
                    <div className="h-3 rounded bg-neutral-100" />
                    <div className="h-4 rounded bg-neutral-100" />
                    <div className="h-4 w-1/2 rounded bg-neutral-100" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (products.length === 0) return null;

  return (
    <section className="ec-section">
      <div className="ec-container">
        <div className="ec-surface p-4 sm:p-6 lg:p-7">
          <SectionHeader
            eyebrow="Fresh drop"
            title="New Arrivals"
            subtitle="Newest catalog items surfaced first"
            actionLabel="View all products"
            onAction={() => router.push('/e-commerce/products')}
          />

          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {products.map((product) => (
              <PremiumProductCard
                key={product.id}
                product={product}
                imageErrored={imageErrors.has(product.id)}
                onImageError={handleImageError}
                onOpen={handleProductClick}
                onAddToCart={handleAddToCart}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default NewArrivals;
