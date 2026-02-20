'use client';

import React from 'react';
import Image from 'next/image';
import { Eye, Heart } from 'lucide-react';
import { SimpleProduct } from '@/services/catalogService';
import { getAdditionalVariantCount, getCardPriceText, getCardStockLabel } from '@/lib/ecommerceCardUtils';

interface PremiumProductCardProps {
  product: SimpleProduct;
  imageErrored?: boolean;
  onImageError?: (id: number) => void;
  onOpen: (product: SimpleProduct) => void;
  onAddToCart: (product: SimpleProduct, e: React.MouseEvent) => void | Promise<void>;
  compact?: boolean;
}

const PremiumProductCard: React.FC<PremiumProductCardProps> = ({
  product,
  imageErrored = false,
  onImageError,
  onOpen,
  onAddToCart,
  compact = false,
}) => {
  const primaryImage = product.images?.[0]?.url || '';
  const shouldUseFallback = imageErrored || !primaryImage;
  const imageUrl = shouldUseFallback ? '/images/placeholder-product.jpg' : primaryImage;

  const additionalVariants = getAdditionalVariantCount(product);
  const stockLabel = getCardStockLabel(product);
  const hasStock = stockLabel !== 'Out of Stock';
  const categoryName = typeof product.category === 'object' && product.category ? product.category.name : 'Category';

  return (
    <article
      onClick={() => onOpen(product)}
      className="ec-card ec-card-hover group cursor-pointer overflow-hidden rounded-2xl"
    >
      <div className={`relative overflow-hidden bg-neutral-100 ${compact ? 'aspect-[4/5]' : 'aspect-[4/5]'}`}>
        <Image
          src={imageUrl}
          alt={product.display_name || product.base_name || product.name}
          fill
          className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          onError={shouldUseFallback || !onImageError ? undefined : () => onImageError(product.id)}
        />

        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/10 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

        <div className="absolute left-2 top-2 flex flex-wrap gap-1.5">
          {additionalVariants > 0 && (
            <span className="rounded-full border border-white/70 bg-white/90 px-2 py-1 text-[10px] font-medium text-neutral-800 shadow-sm backdrop-blur">
              {additionalVariants + 1} options
            </span>
          )}
        </div>

        <div className="absolute right-2 top-2 flex items-center gap-1.5">
          <span
            className={`rounded-full border px-2 py-1 text-[10px] font-medium shadow-sm ${
              stockLabel === 'In Stock'
                ? 'border-green-200 bg-green-50/95 text-green-700'
                : hasStock
                  ? 'border-amber-200 bg-amber-50/95 text-amber-700'
                  : 'border-neutral-200 bg-white/90 text-neutral-700'
            }`}
          >
            {stockLabel}
          </span>
        </div>

        <div className="absolute right-2 top-10 flex translate-x-2 flex-col gap-1.5 opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100">
          <span className="flex h-8 w-8 items-center justify-center rounded-full border border-neutral-200 bg-white/95 text-neutral-700 shadow-sm backdrop-blur">
            <Heart className="h-3.5 w-3.5" />
          </span>
          <span className="flex h-8 w-8 items-center justify-center rounded-full border border-neutral-200 bg-white/95 text-neutral-700 shadow-sm backdrop-blur">
            <Eye className="h-3.5 w-3.5" />
          </span>
        </div>

        <div className="absolute inset-x-3 bottom-3 translate-y-2 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
          <button
            onClick={(e) => onAddToCart(product, e)}
            className="w-full rounded-xl border border-neutral-200 bg-white/95 px-3 py-2 text-xs font-semibold text-neutral-900 shadow-sm backdrop-blur hover:bg-white"
          >
            {product.has_variants ? 'Select options' : 'Add to cart'}
          </button>
        </div>
      </div>

      <div className={compact ? 'p-3 sm:p-4' : 'p-4'}>
        <p className="mb-1 line-clamp-1 text-[10px] font-medium uppercase tracking-[0.18em] text-neutral-500">
          {categoryName}
        </p>
        <h3 className={`line-clamp-2 text-neutral-900 ${compact ? 'min-h-[2.5rem] text-sm font-semibold' : 'min-h-[2.75rem] text-sm font-semibold sm:text-[15px]'}`}>
          {product.display_name || product.base_name || product.name}
        </h3>
        <div className="mt-2 flex items-end justify-between gap-2">
          <div className="text-base font-bold text-amber-600">{getCardPriceText(product)}</div>
          <span className="text-[11px] text-neutral-500">{product.has_variants ? 'Choose' : 'Ready'}</span>
        </div>
      </div>
    </article>
  );
};

export default PremiumProductCard;
