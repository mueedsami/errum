'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShoppingCart, Heart, Eye, Loader2 } from 'lucide-react';

import Navigation from '@/components/ecommerce/Navigation';
import Footer from '@/components/ecommerce/Footer';
import catalogService, { Product, PaginationMeta } from '@/services/catalogService';
import { useCart } from '../CartContext';
import CartSidebar from '@/components/ecommerce/cart/CartSidebar';
import { wishlistUtils } from '@/lib/wishlistUtils';
import {
  adaptCatalogGroupedProducts,
  formatGroupedPrice,
  groupProductsByMother,
  GroupedProduct,
} from '@/lib/ecommerceProductGrouping';

export default function ProductsPage() {
  const router = useRouter();
  const { addToCart } = useCart();

  const [rawProducts, setRawProducts] = useState<Product[]>([]);
  const [apiGroupedProducts, setApiGroupedProducts] = useState<any[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [addingGroupKey, setAddingGroupKey] = useState<string | null>(null);
  const [isCartOpen, setIsCartOpen] = useState(false);

  const [wishlistIds, setWishlistIds] = useState<Set<number>>(new Set());

  const groupedProducts = useMemo(() => {
    if (apiGroupedProducts.length > 0) {
      return adaptCatalogGroupedProducts(apiGroupedProducts as any);
    }
    return groupProductsByMother(rawProducts);
  }, [apiGroupedProducts, rawProducts]);

  useEffect(() => {
    fetchProducts();
  }, []);

  useEffect(() => {
    const updateWishlistIds = () => {
      const items = wishlistUtils.getAll();
      setWishlistIds(new Set(items.map((i) => Number(i.id))));
    };

    updateWishlistIds();
    window.addEventListener('wishlist-updated', updateWishlistIds);
    return () => window.removeEventListener('wishlist-updated', updateWishlistIds);
  }, []);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await catalogService.getProducts({
        per_page: 100,
        sort_by: 'newest',
      });

      setApiGroupedProducts(response.grouped_products || []);
      setRawProducts(response.products);
      setPagination(response.pagination);
    } catch (err: any) {
      console.error('Error fetching products:', err);
      setError('Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  const navigateToProduct = (productId: number) => {
    router.push(`/e-commerce/product/${productId}`);
  };

  const toggleWishlist = (group: GroupedProduct, e: React.MouseEvent) => {
    e.stopPropagation();

    const representative = group.variants.find((v) => v.in_stock) || group.variants[0];
    if (!representative) return;

    const productId = representative.id;

    if (wishlistIds.has(productId)) {
      wishlistUtils.remove(productId);
    } else {
      wishlistUtils.add({
        id: productId,
        name: group.baseName,
        image: representative.image,
        price: representative.price,
        sku: representative.sku,
      });
    }
  };

  const handleAddToCart = async (group: GroupedProduct, e: React.MouseEvent) => {
    e.stopPropagation();

    const representative = group.variants.find((v) => v.in_stock) || group.variants[0];
    if (!representative) return;

    // If there are variations, open product details for variation selection.
    if (group.totalVariants > 1) {
      navigateToProduct(representative.id);
      return;
    }

    setAddingGroupKey(group.key);

    addToCart(
      {
        id: representative.id,
        name: group.baseName,
        image: representative.image,
        price: representative.price,
        sku: representative.sku || '',
        quantity: 1,
      } as any,
      1
    );

    setTimeout(() => {
      setAddingGroupKey(null);
      setIsCartOpen(true);
    }, 1000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <div className="flex items-center justify-center py-32">
          <div className="text-center">
            <Loader2 className="h-10 w-10 animate-spin text-red-700 mx-auto mb-3" />
            <p className="text-gray-600">Loading products...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <div className="flex items-center justify-center py-32">
          <div className="text-center">
            <p className="text-red-600 mb-4">{error}</p>
            <button
              onClick={fetchProducts}
              className="bg-red-800 text-white px-6 py-2 rounded-lg hover:bg-red-900"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-gray-50">
        <Navigation />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">All Products</h1>
            <p className="text-gray-600">
              {groupedProducts.length} mother products available
              {pagination && ` (from ${pagination.total} total variants)`}
            </p>
          </div>

          {/* Products Grid */}
          {groupedProducts.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-gray-500 text-lg">No products available</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {groupedProducts.map((group) => {
                const representative = group.variants.find((v) => v.in_stock) || group.variants[0];
                if (!representative) return null;

                const isInWishlist = wishlistIds.has(representative.id);

                return (
                  <div
                    key={group.key}
                    className="group bg-white rounded-xl overflow-hidden hover:shadow-xl transition-all duration-300 border border-gray-200"
                    onMouseEnter={() => setHoveredId(group.key)}
                    onMouseLeave={() => setHoveredId(null)}
                  >
                    <div
                      onClick={() => navigateToProduct(representative.id)}
                      className="relative aspect-square overflow-hidden bg-gray-50 cursor-pointer"
                    >
                      <img
                        src={group.primaryImage}
                        alt={group.baseName}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                        onError={(e) => {
                          e.currentTarget.src = '/placeholder-product.png';
                        }}
                      />

                      {group.totalVariants > 1 && (
                        <span className="absolute top-3 left-3 bg-blue-600 text-white px-3 py-1.5 text-xs font-bold rounded-full shadow-lg">
                          {group.totalVariants} OPTIONS
                        </span>
                      )}

                      {!group.inStock && (
                        <span className="absolute top-3 left-3 bg-red-600 text-white px-3 py-1.5 text-xs font-bold rounded-full shadow-lg">
                          OUT OF STOCK
                        </span>
                      )}

                      <div
                        className={`absolute top-2 right-2 flex flex-col gap-2 transition-all duration-300 ${
                          hoveredId === group.key ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-4'
                        }`}
                      >
                        <button
                          onClick={(e) => toggleWishlist(group, e)}
                          className={`p-2 rounded-full shadow-lg transition-all duration-300 ${
                            isInWishlist ? 'bg-red-600 text-white scale-110' : 'bg-white hover:bg-red-50'
                          }`}
                        >
                          <Heart size={16} className={isInWishlist ? 'fill-white' : 'text-gray-700'} />
                        </button>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigateToProduct(representative.id);
                          }}
                          className="p-2 bg-white rounded-full shadow-lg hover:bg-blue-50 transition-colors"
                        >
                          <Eye size={16} className="text-gray-700" />
                        </button>
                      </div>

                      <button
                        onClick={(e) => handleAddToCart(group, e)}
                        disabled={!group.inStock || addingGroupKey === group.key}
                        className={`absolute bottom-0 left-0 right-0 text-white py-3 text-sm font-bold transition-transform duration-300 flex items-center justify-center gap-2 ${
                          hoveredId === group.key ? 'translate-y-0' : 'translate-y-full'
                        } ${
                          !group.inStock
                            ? 'bg-gray-400 cursor-not-allowed'
                            : addingGroupKey === group.key
                            ? 'bg-green-600'
                            : group.totalVariants > 1
                            ? 'bg-indigo-700 hover:bg-indigo-800'
                            : 'bg-red-700 hover:bg-red-800'
                        }`}
                      >
                        {addingGroupKey === group.key ? (
                          <>✓ ADDED</>
                        ) : group.totalVariants > 1 ? (
                          'SELECT OPTION'
                        ) : (
                          <>
                            <ShoppingCart size={16} />
                            ADD TO CART
                          </>
                        )}
                      </button>
                    </div>

                    <div className="p-4 text-center">
                      <h3
                        onClick={() => navigateToProduct(representative.id)}
                        className="text-sm font-semibold text-gray-900 mb-2 line-clamp-2 group-hover:text-red-600 transition-colors cursor-pointer"
                      >
                        {group.baseName}
                      </h3>

                      <span className="text-lg font-bold text-red-700">{formatGroupedPrice(group)}</span>

                      {group.totalVariants > 1 && (
                        <p className="text-xs text-gray-500 mt-1">
                          {group.totalVariants} variations available
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination Info */}
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
