'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, AlertCircle, ShoppingBag, ChevronLeft, ChevronRight } from 'lucide-react';

import Navigation from '@/components/ecommerce/Navigation';
import Footer from '@/components/ecommerce/Footer';
import catalogService from '@/services/catalogService';
import cartService from '@/services/cartService';
import { getBaseProductName, getColorLabel, getSizeLabel } from '@/lib/productNameUtils';

// Types for grouped products
interface ProductVariant {
  id: number;
  sku: string;
  color?: string;
  size?: string;
  selling_price: number;
  in_stock: boolean;
  stock_quantity: number;
  images: any[];
}

interface GroupedProduct {
  id: number;
  name: string; // Base name
  sku: string;
  images: any[];
  variants: ProductVariant[];
  min_price: number;
  max_price: number;
  in_stock: boolean;
}

function ProductCard({ product }: { product: GroupedProduct }) {
  const [selectedVariant, setSelectedVariant] = useState(product.variants[0]);
  
  // Get unique colors and sizes
  const colors = [...new Set(product.variants.map(v => v.color).filter(Boolean))];
  const sizes = [...new Set(product.variants.map(v => v.size).filter(Boolean))].sort((a, b) => {
    const sizeOrder = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
    const aIdx = sizeOrder.indexOf(a?.toUpperCase() || '');
    const bIdx = sizeOrder.indexOf(b?.toUpperCase() || '');
    if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
    const aNum = parseInt(a || '0');
    const bNum = parseInt(b || '0');
    if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum;
    return (a || '').localeCompare(b || '');
  });

  const primary = selectedVariant.images?.find((i: any) => i.is_primary) || selectedVariant.images?.[0] || product.images[0];
  const imageUrl = primary?.url || primary?.image_url;

  const add = async () => {
    try {
      await cartService.addToCart({ product_id: selectedVariant.id, quantity: 1 });
      window.dispatchEvent(new Event('cart-updated'));
      alert('Added to cart!');
    } catch (err) {
      console.error('Add to cart failed:', err);
      alert('Failed to add to cart');
    }
  };

  const priceDisplay = product.min_price === product.max_price
    ? `৳${product.min_price.toFixed(0)}`
    : `৳${product.min_price.toFixed(0)} - ৳${product.max_price.toFixed(0)}`;

  return (
    <div className="bg-white border rounded-xl overflow-hidden hover:shadow-lg transition group">
      <Link href={`/e-commerce/product/${selectedVariant.id}`} className="block">
        <div className="aspect-square bg-gray-100 relative overflow-hidden">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400">
              <ShoppingBag />
            </div>
          )}
          {!selectedVariant.in_stock && (
            <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center">
              <span className="text-white font-semibold text-sm">Out of Stock</span>
            </div>
          )}
        </div>
        <div className="p-4">
          <p className="font-semibold text-gray-900 line-clamp-2 min-h-[2.5rem]">{product.name}</p>
          <p className="text-red-700 font-bold mt-2">{priceDisplay}</p>
          
          {/* Show variation count if there are multiple variants */}
          {product.variants.length > 1 && (
            <p className="text-xs text-gray-500 mt-1">
              {colors.length > 0 && `${colors.length} color${colors.length > 1 ? 's' : ''}`}
              {colors.length > 0 && sizes.length > 0 && ', '}
              {sizes.length > 0 && `${sizes.length} size${sizes.length > 1 ? 's' : ''}`}
            </p>
          )}
        </div>
      </Link>
      
      {/* Size/Color Options */}
      {(colors.length > 1 || sizes.length > 1) && (
        <div className="px-4 pb-2">
          {/* Colors */}
          {colors.length > 1 && (
            <div className="mb-2">
              <p className="text-xs text-gray-600 mb-1">Colors:</p>
              <div className="flex gap-1 flex-wrap">
                {colors.slice(0, 5).map(color => {
                  const variant = product.variants.find(v => v.color === color && (sizes.length === 0 || v.size === selectedVariant.size));
                  if (!variant) return null;
                  return (
                    <button
                      key={color}
                      onClick={(e) => {
                        e.preventDefault();
                        setSelectedVariant(variant);
                      }}
                      className={`px-2 py-1 text-xs border rounded transition-all ${
                        selectedVariant.color === color
                          ? 'bg-red-700 text-white border-red-700'
                          : 'bg-white text-gray-700 border-gray-300 hover:border-red-700'
                      }`}
                      title={color}
                    >
                      {color}
                    </button>
                  );
                })}
                {colors.length > 5 && <span className="text-xs text-gray-500 self-center">+{colors.length - 5}</span>}
              </div>
            </div>
          )}
          
          {/* Sizes */}
          {sizes.length > 1 && (
            <div className="mb-2">
              <p className="text-xs text-gray-600 mb-1">Sizes:</p>
              <div className="flex gap-1 flex-wrap">
                {sizes.slice(0, 6).map(size => {
                  const variant = product.variants.find(v => v.size === size && (colors.length === 0 || v.color === selectedVariant.color));
                  if (!variant) return null;
                  return (
                    <button
                      key={size}
                      onClick={(e) => {
                        e.preventDefault();
                        setSelectedVariant(variant);
                      }}
                      disabled={!variant.in_stock}
                      className={`px-2 py-1 text-xs border rounded transition-all ${
                        selectedVariant.size === size
                          ? 'bg-red-700 text-white border-red-700'
                          : variant.in_stock
                          ? 'bg-white text-gray-700 border-gray-300 hover:border-red-700'
                          : 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                      }`}
                    >
                      {size}
                    </button>
                  );
                })}
                {sizes.length > 6 && <span className="text-xs text-gray-500 self-center">+{sizes.length - 6}</span>}
              </div>
            </div>
          )}
        </div>
      )}
      
      <div className="p-4 pt-0">
        <button 
          onClick={add} 
          disabled={!selectedVariant.in_stock}
          className={`w-full font-semibold py-2.5 rounded-lg transition ${
            selectedVariant.in_stock
              ? 'bg-red-700 hover:bg-red-800 text-white'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
        >
          {selectedVariant.in_stock ? 'Add to Cart' : 'Out of Stock'}
        </button>
      </div>
    </div>
  );
}

export default function ProductsPage() {
  const [products, setProducts] = useState<GroupedProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<any>(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const data: any = await catalogService.getProducts({ page, per_page: 100 });
        
        // Group products by base name
        const grouped = groupProducts(data.products || []);
        setProducts(grouped);
        setPagination(data.pagination || null);
      } catch (err: any) {
        console.error('Failed to fetch products:', err);
        setError('Failed to load products. Please try again.');
      } finally {
        setLoading(false);
      }
    })();
  }, [page]);

  const canPrev = page > 1;
  const canNext = pagination?.has_next_page ?? false;

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex items-start justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">All Products</h1>
            <p className="text-gray-600 mt-1">Browse our full catalog</p>
          </div>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        {loading ? (
          <div className="text-center py-20">
            <Loader2 className="animate-spin h-10 w-10 text-red-700 mx-auto mb-3" />
            <p className="text-gray-600">Loading products...</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {products.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>

            {products.length === 0 && !loading && (
              <div className="text-center py-20">
                <ShoppingBag className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <p className="text-gray-600">No products found</p>
              </div>
            )}

            <div className="flex items-center justify-between mt-8">
              <button
                disabled={!canPrev}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition"
              >
                <ChevronLeft size={18} /> Prev
              </button>
              <div className="text-sm text-gray-600">Page {page} {pagination?.total ? `of ${pagination.last_page || '?'}` : ''}</div>
              <button
                disabled={!canNext}
                onClick={() => setPage((p) => p + 1)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition"
              >
                Next <ChevronRight size={18} />
              </button>
            </div>
          </>
        )}
      </div>

      <Footer />
    </div>
  );
}

/**
 * Group products by base name
 * Converts individual product records into grouped products with variants
 */
function groupProducts(products: any[]): GroupedProduct[] {
  const grouped = new Map<string, GroupedProduct>();

  products.forEach(product => {
    const baseName = getBaseProductName(product.name);
    const color = getColorLabel(product.name);
    const size = getSizeLabel(product.name);

    if (!grouped.has(baseName)) {
      // Create new grouped product
      grouped.set(baseName, {
        id: product.id,
        name: baseName,
        sku: extractBaseSku(product.sku),
        images: product.images || [],
        variants: [],
        min_price: product.selling_price,
        max_price: product.selling_price,
        in_stock: product.in_stock
      });
    }

    const group = grouped.get(baseName)!;

    // Add variant
    group.variants.push({
      id: product.id,
      sku: product.sku,
      color,
      size,
      selling_price: product.selling_price,
      in_stock: product.in_stock,
      stock_quantity: product.stock_quantity,
      images: product.images || []
    });

    // Update price range
    group.min_price = Math.min(group.min_price, product.selling_price);
    group.max_price = Math.max(group.max_price, product.selling_price);

    // Update stock status
    if (product.in_stock) {
      group.in_stock = true;
    }

    // Use images from in-stock variant if available
    if (product.in_stock && product.images?.length > 0) {
      group.images = product.images;
    }
  });

  return Array.from(grouped.values());
}

/**
 * Extract base SKU from variant SKU
 */
function extractBaseSku(sku: string): string {
  const parts = sku.split('-');
  return parts.slice(0, -2).join('-') || sku;
}