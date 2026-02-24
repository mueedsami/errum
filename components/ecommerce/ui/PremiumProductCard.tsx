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
  product,
  imageErrored = false,
  onImageError,
  onOpen,
  onAddToCart,
  compact = false,
}) => {
  const primaryImage    = product.images?.[0]?.url || '';
  const shouldFallback  = imageErrored || !primaryImage;
  const imageUrl        = shouldFallback ? '/images/placeholder-product.jpg' : primaryImage;
  const extraVariants   = getAdditionalVariantCount(product);
  const stockLabel      = getCardStockLabel(product);
  const hasStock        = stockLabel !== 'Out of Stock';
  const categoryName    = typeof product.category === 'object' && product.category
    ? product.category.name : '';

  return (
    <article
      onClick={() => onOpen(product)}
      className="ec-card ec-card-hover group cursor-pointer overflow-hidden"
      style={{ borderRadius: '16px' }}
    >
      {/* ── Image ── */}
      <div className={`relative overflow-hidden bg-neutral-50 ${compact ? 'aspect-[3/4]' : 'aspect-[3/4]'}`}>
        <Image
          src={imageUrl}
          alt={product.display_name || product.base_name || product.name}
          fill
          className="object-cover transition-transform duration-700 group-hover:scale-[1.06]"
          onError={shouldFallback || !onImageError ? undefined : () => onImageError(product.id)}
        />

        {/* Gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

        {/* Variant badge */}
        {extraVariants > 0 && (
          <div className="absolute left-2.5 top-2.5">
            <span className="rounded-full px-2.5 py-1 text-[10px] font-semibold text-white backdrop-blur"
                  style={{ background: 'rgba(13,13,13,0.55)', border: '1px solid rgba(255,255,255,0.15)', letterSpacing: '0.04em' }}>
              {extraVariants + 1} options
            </span>
          </div>
        )}

        {/* Stock badge — only "In Stock" shown cleanly */}
        {hasStock && (
          <div className="absolute right-2.5 top-2.5">
            <span className="rounded-full px-2 py-1 text-[9px] font-medium"
                  style={{ background: 'rgba(255,255,255,0.9)', color: '#16a34a', letterSpacing: '0.06em', fontFamily: "'DM Mono', monospace" }}>
              IN STOCK
            </span>
          </div>
        )}

        {/* Hover action row */}
        <div className="absolute inset-x-0 bottom-0 translate-y-full transition-transform duration-300 group-hover:translate-y-0">
          <div className="flex items-center gap-1.5 p-2.5">
            <button
              onClick={e => onAddToCart(product, e)}
              className="flex-1 rounded-xl py-2.5 text-[11px] font-semibold text-white transition-all"
              style={{ background: 'var(--ink)', letterSpacing: '0.08em', textTransform: 'uppercase' }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--gold)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--ink)'; }}
            >
              {product.has_variants ? 'Select Options' : 'Add to Cart'}
            </button>
            <button
              onClick={e => { e.stopPropagation(); }}
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl text-white transition-all"
              style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.2)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.25)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.15)'; }}
            >
              <Heart className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Info ── */}
      <div className={compact ? 'p-3 sm:p-3.5' : 'p-4'}>
        {categoryName && (
          <p className="mb-1 text-[9px] font-semibold tracking-[0.2em] text-neutral-400 uppercase truncate"
             style={{ fontFamily: "'DM Mono', monospace" }}>
            {categoryName}
          </p>
        )}
        <h3
          className="line-clamp-3 text-neutral-900 font-medium leading-snug"
          style={{
            fontFamily: "'Jost', sans-serif",
            fontSize: compact ? '13px' : '14px',
            minHeight: compact ? '3.5rem' : '3.75rem',
          }}
        >
          {product.display_name || product.base_name || product.name}
        </h3>
        <div className="mt-2.5 flex items-center justify-between gap-2">
          <span className="text-base font-bold" style={{ color: 'var(--gold)', fontFamily: "'Jost', sans-serif" }}>
            {getCardPriceText(product)}
          </span>
          <span className="flex items-center gap-1 text-[10px] text-neutral-400 transition-colors group-hover:text-neutral-600"
                style={{ fontFamily: "'DM Mono', monospace", letterSpacing: '0.06em' }}>
            {product.has_variants ? 'CHOOSE' : 'VIEW'} <ArrowRight className="h-2.5 w-2.5" />
          </span>
        </div>
      </div>
    </article>
  );
};

export default PremiumProductCard;
