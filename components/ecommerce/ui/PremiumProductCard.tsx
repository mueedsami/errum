'use client';

import React from 'react';
import Image from 'next/image';
import { Heart, ArrowRight } from 'lucide-react';
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
  product, imageErrored = false, onImageError, onOpen, onAddToCart, compact = false,
}) => {
  const primaryImage   = product.images?.[0]?.url || '';
  const shouldFallback = imageErrored || !primaryImage;
  const imageUrl       = shouldFallback ? '/images/placeholder-product.jpg' : primaryImage;
  const extraVariants  = getAdditionalVariantCount(product);
  const stockLabel     = getCardStockLabel(product);
  const hasStock       = stockLabel !== 'Out of Stock';
  const categoryName   = typeof product.category === 'object' && product.category ? product.category.name : '';

  return (
    <article
      onClick={() => onOpen(product)}
      className="ec-card ec-card-hover group cursor-pointer overflow-hidden"
      style={{ borderRadius: '16px' }}
    >
      {/* Image */}
      <div className="relative overflow-hidden aspect-[3/4]" style={{ background: 'rgba(255,255,255,0.03)' }}>
        <Image
          src={imageUrl}
          alt={product.display_name || product.base_name || product.name}
          fill
          className="object-cover transition-transform duration-700 group-hover:scale-[1.06]"
          onError={shouldFallback || !onImageError ? undefined : () => onImageError(product.id)}
        />

        {/* Gradient on hover */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

        {/* Variant count */}
        {extraVariants > 0 && (
          <div className="absolute left-2.5 top-2.5">
            <span className="rounded-full px-2.5 py-1 text-[9px] font-semibold text-white"
                  style={{ background: 'rgba(13,13,13,0.65)', border: '1px solid rgba(255,255,255,0.15)', backdropFilter: 'blur(4px)', fontFamily: "'DM Mono', monospace", letterSpacing: '0.06em' }}>
              {extraVariants + 1} options
            </span>
          </div>
        )}

        {/* Stock badge */}
        {hasStock && (
          <div className="absolute right-2.5 top-2.5">
            <span className="rounded-full px-2 py-1 text-[9px] font-medium"
                  style={{ background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)', color: '#4ade80', fontFamily: "'DM Mono', monospace", letterSpacing: '0.06em' }}>
              IN STOCK
            </span>
          </div>
        )}

        {/* Slide-up action bar */}
        <div className="absolute inset-x-0 bottom-0 translate-y-full transition-transform duration-300 group-hover:translate-y-0">
          <div className="flex items-center gap-1.5 p-2.5">
            <button
              onClick={e => onAddToCart(product, e)}
              className="flex-1 rounded-xl py-2.5 text-[11px] font-semibold text-white transition-all"
              style={{ background: 'var(--gold)', letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: "'Jost', sans-serif" }}
              onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.background = '#9a6b2e')}
              onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.background = 'var(--gold)')}
            >
              {product.has_variants ? 'Select Options' : 'Add to Cart'}
            </button>
            <button
              onClick={e => e.stopPropagation()}
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl text-white transition-all"
              style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)' }}
              onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.22)')}
              onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.12)')}
            >
              <Heart className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Info */}
      <div className={compact ? 'p-3 sm:p-3.5' : 'p-4'}>
        {categoryName && (
          <p className="mb-1 truncate text-[9px] font-semibold tracking-[0.2em] uppercase"
             style={{ color: 'rgba(255,255,255,0.3)', fontFamily: "'DM Mono', monospace" }}>
            {categoryName}
          </p>
        )}
        <h3 className="line-clamp-3 font-medium leading-snug"
            style={{ fontFamily: "'Jost', sans-serif", fontSize: compact ? '13px' : '14px', color: 'rgba(255,255,255,0.9)', minHeight: compact ? '3.5rem' : '3.75rem' }}>
          {product.display_name || product.base_name || product.name}
        </h3>
        <div className="mt-2.5 flex items-center justify-between gap-2">
          <span className="text-base font-bold" style={{ color: 'var(--gold)', fontFamily: "'Jost', sans-serif" }}>
            {getCardPriceText(product)}
          </span>
          <span className="flex items-center gap-1 text-[10px] transition-colors group-hover:text-white"
                style={{ color: 'rgba(255,255,255,0.25)', fontFamily: "'DM Mono', monospace", letterSpacing: '0.06em' }}>
            {product.has_variants ? 'CHOOSE' : 'VIEW'} <ArrowRight className="h-2.5 w-2.5" />
          </span>
        </div>
      </div>
    </article>
  );
};

export default PremiumProductCard;
