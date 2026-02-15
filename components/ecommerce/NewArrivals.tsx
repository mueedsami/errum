'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { ShoppingCart, Heart, Eye } from 'lucide-react';
import { useRouter } from 'next/navigation';
import catalogService, { SimpleProduct } from '@/services/catalogService';
import { useCart } from '@/app/e-commerce/CartContext';
import CartSidebar from './cart/CartSidebar';
import { wishlistUtils } from '@/lib/wishlistUtils';
import {
  formatGroupedPrice,
  groupProductsByMother,
  GroupedProduct,
} from '@/lib/ecommerceProductGrouping';

export default function NewArrivals() {
  const router = useRouter();
  const { addToCart } = useCart();

  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [rawProducts, setRawProducts] = useState<SimpleProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingGroupKey, setAddingGroupKey] = useState<string | null>(null);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [wishlistIds, setWishlistIds] = useState<Set<number>>(new Set());

  const arrivalGroups = useMemo(
    () => groupProductsByMother(rawProducts, { useCategoryInKey: false }).slice(0, 8),
    [rawProducts]
  );

  useEffect(() => {
    const updateWishlistIds = () => {
      const items = wishlistUtils.getAll();
      setWishlistIds(new Set(items.map((i) => Number(i.id))));
    };

    updateWishlistIds();
    window.addEventListener('wishlist-updated', updateWishlistIds);
    return () => window.removeEventListener('wishlist-updated', updateWishlistIds);
  }, []);

  useEffect(() => {
    const fetchNewArrivals = async () => {
      try {
        setLoading(true);

        const response = await catalogService.getProducts({
          per_page: 40,
          sort_by: 'created_at',
          sort_order: 'desc',
          in_stock: true,
        });

        setRawProducts(response.products as any);
      } catch (error) {
        console.error('Error fetching new arrivals:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchNewArrivals();
  }, []);

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

  const handleAddToCart = (group: GroupedProduct, e: React.MouseEvent) => {
    e.stopPropagation();

    const representative = group.variants.find((v) => v.in_stock) || group.variants[0];
    if (!representative) return;

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
    }, 1200);
  };

  if (loading) {
    return (
      <section className="py-20 bg-gradient-to-b from-white to-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <p className="text-gray-600">Loading new arrivals...</p>
          </div>
        </div>
      </section>
    );
  }

  if (arrivalGroups.length === 0) {
    return null;
  }

  return (
    <>
      <section className="py-20 bg-gradient-to-b from-white to-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">New Arrivals</h2>
            <p className="text-lg text-gray-600">Fresh styles just landed</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {arrivalGroups.map((group) => {
              const representative = group.variants.find((v) => v.in_stock) || group.variants[0];
              if (!representative) return null;

              const isInWishlist = wishlistIds.has(representative.id);

              return (
                <div
                  key={group.key}
                  className="group bg-white rounded-lg overflow-hidden hover:shadow-xl transition-all duration-300 border border-gray-200"
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

                    <span className="absolute top-3 left-3 bg-green-600 text-white px-3 py-1.5 text-xs font-bold rounded-full shadow-lg">
                      New
                    </span>

                    {group.totalVariants > 1 && (
                      <span className="absolute top-12 left-3 bg-blue-600 text-white px-2 py-1 text-[10px] font-semibold rounded-full shadow-lg">
                        {group.totalVariants} options
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
                      <p className="text-xs text-gray-500 mt-1">{group.totalVariants} variations available</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <CartSidebar isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
    </>
  );
}
