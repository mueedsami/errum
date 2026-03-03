'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, Filter, ShoppingBag } from 'lucide-react';

import Navigation from '@/components/ecommerce/Navigation';
import CartSidebar from '@/components/ecommerce/cart/CartSidebar';
import { useCart } from '@/app/e-commerce/CartContext';
import catalogService, {
  CatalogCategory,
  GetProductsParams,
  PaginationMeta,
  SimpleProduct,
} from '@/services/catalogService';
import PremiumProductCard from '@/components/ecommerce/ui/PremiumProductCard';

import {
  buildCardProductsFromResponse,
} from '@/lib/ecommerceCardUtils';

type ProductSort = NonNullable<GetProductsParams['sort_by']>;


const getNewestKey = (product: SimpleProduct): number => {
  const variantIds = Array.isArray((product as any).variants)
    ? ((product as any).variants as any[]).map((v) => Number(v?.id) || 0)
    : [];
  const selfId = Number(product?.id) || 0;
  return Math.max(selfId, ...variantIds);
};

export default function ProductsPage() {
  const router = useRouter();

  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<ProductSort>('newest');
  const [isLoading, setIsLoading] = useState(false);

  const [products, setProducts] = useState<SimpleProduct[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);

  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [imageErrors, setImageErrors] = useState<Set<number>>(new Set());
  const { addToCart } = useCart();

  useEffect(() => {
    fetchCategories();
  }, []);

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedCategory, searchTerm, sortBy]);

  useEffect(() => {
    fetchProducts();
  }, [selectedCategory, searchTerm, sortBy, currentPage]);

  const fetchCategories = async () => {
    try {
      const categoryData = await catalogService.getCategories();
      setCategories(categoryData);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const fetchProducts = async () => {
    setIsLoading(true);
    try {
      const params: GetProductsParams = {
        page: currentPage,
        // Keep page sizes reasonable so backend pagination works and UI stays fast.
        per_page: 100,
      };

      if (selectedCategory !== 'all') {
        params.category_id = Number(selectedCategory);
        const cat = categories.find((c) => String(c.id) === String(selectedCategory));
        if (cat) {
          params.category = cat.slug || cat.name;
        }
      }

      if (searchTerm.trim()) {
        params.search = searchTerm.trim();
      }

      params.sort_by = sortBy;

      const response = await catalogService.getProducts(params);
      let cardProducts = buildCardProductsFromResponse(response);
      if (sortBy === 'newest') {
        cardProducts = [...cardProducts].sort((a, b) => getNewestKey(b) - getNewestKey(a));
      }

      setProducts(cardProducts);
      setPagination(response.pagination);
    } catch (error) {
      console.error('Error fetching products:', error);
      setProducts([]);
    } finally {
      setIsLoading(false);
    }
  };

  const getPageWindow = (current: number, last: number) => {
    // Returns a compact page list with ellipses.
    // Example: [1, '…', 7, 8, 9, '…', 22]
    const pages: Array<number | '…'> = [];
    if (last <= 7) {
      for (let i = 1; i <= last; i++) pages.push(i);
      return pages;
    }

    const push = (v: number | '…') => pages.push(v);
    push(1);

    const left = Math.max(2, current - 1);
    const right = Math.min(last - 1, current + 1);

    if (left > 2) push('…');
    for (let i = left; i <= right; i++) push(i);
    if (right < last - 1) push('…');

    push(last);
    return pages;
  };

  
  const markImageError = (id: number) => {
    setImageErrors(prev => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };
const handleAddToCart = async (product: SimpleProduct) => {
    if (product.has_variants) {
      router.push(`/e-commerce/product/${product.id}`);
      return;
    }

    try {
      await addToCart(product.id, 1);
      setIsCartOpen(true);
    } catch (error) {
      console.error('Error adding to cart:', error);
    }
  };

  const navigateToProduct = (identifier: number | string) => {
    router.push(`/e-commerce/product/${identifier}`);
  };

  return (
    <>
      <div className="ec-root ec-darkify min-h-screen">
        <Navigation />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">All Products</h1>
            <p className="text-white/70">Browse our complete collection</p>
          </div>

          
          {/* Filters */}
          <div className="mb-8">
            {/* Mobile: compact bar + drawer */}
            <div className="md:hidden flex gap-3">
              <input
                type="text"
                placeholder="Search products..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1 px-4 py-3 rounded-xl border border-white/10 bg-white/5 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-white/15"
              />

              <button
                type="button"
                onClick={() => setIsFiltersOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-3 rounded-xl border border-white/10 bg-[rgba(255,255,255,0.08)] hover:bg-[rgba(255,255,255,0.12)] text-white"
              >
                <Filter className="h-4 w-4" />
                Filters
              </button>
            </div>

            {/* Desktop: inline filters */}
            <div className="hidden md:block ec-dark-card p-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="md:col-span-2">
                  <input
                    type="text"
                    placeholder="Search products..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full px-4 py-2 rounded-lg border border-white/10 bg-white/5 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-white/15"
                  />
                </div>

                <div className="relative">
                  <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/50" />
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="ecom-select w-full pl-10 pr-9 py-2 rounded-lg border border-white/10 bg-white/5 text-white focus:outline-none focus:ring-2 focus:ring-white/15 appearance-none"
                  >
                    <option value="all">All Categories</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id.toString()}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/50 pointer-events-none" />
                </div>

                <div className="relative">
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as ProductSort)}
                    className="w-full pl-4 pr-9 py-2 rounded-lg border border-white/10 bg-white/5 text-white focus:outline-none focus:ring-2 focus:ring-white/15 appearance-none"
                  >
                    <option value="newest">Newest</option>
                    <option value="name">Name</option>
                    <option value="price_asc">Price: Low to High</option>
                    <option value="price_desc">Price: High to Low</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/50 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Mobile Drawer */}
            {isFiltersOpen && (
              <div className="fixed inset-0 z-[60]">
                <button
                  type="button"
                  aria-label="Close filters"
                  onClick={() => setIsFiltersOpen(false)}
                  className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                />
                <div className="absolute right-0 top-0 h-full w-[86%] max-w-sm ec-dark-card border-l border-white/10 p-5 overflow-y-auto">
                  <div className="flex items-center justify-between mb-4">
                    <div className="text-white font-semibold text-lg">Filters</div>
                    <button
                      type="button"
                      onClick={() => setIsFiltersOpen(false)}
                      className="px-3 py-2 rounded-lg border border-white/10 bg-[rgba(255,255,255,0.06)] hover:bg-[rgba(255,255,255,0.10)] text-white"
                    >
                      Close
                    </button>
                  </div>

                  <div className="space-y-5">
                    <div>
                      <div className="text-sm text-white/70 mb-2">Category</div>
                      <select
                        value={selectedCategory}
                        onChange={(e) => setSelectedCategory(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-white/10 bg-white/5 text-white focus:outline-none focus:ring-2 focus:ring-white/15"
                      >
                        <option value="all">All Categories</option>
                        {categories.map((category) => (
                          <option key={category.id} value={category.id.toString()}>
                            {category.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <div className="text-sm text-white/70 mb-2">Sort</div>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { v: 'newest', label: 'Newest' },
                          { v: 'name', label: 'Name' },
                          { v: 'price_asc', label: 'Low → High' },
                          { v: 'price_desc', label: 'High → Low' },
                        ].map((opt) => (
                          <button
                            key={opt.v}
                            type="button"
                            onClick={() => setSortBy(opt.v as ProductSort)}
                            className={[
                              'px-3 py-3 rounded-xl border text-sm',
                              sortBy === opt.v ? 'border-white/30 bg-white/10 text-white' : 'border-white/10 bg-white/5 text-white/80',
                            ].join(' ')}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setIsFiltersOpen(false)}
                      className="w-full px-4 py-3 rounded-xl border border-white/10 bg-[rgba(255,255,255,0.08)] hover:bg-[rgba(255,255,255,0.12)] text-white font-medium"
                    >
                      Show Products
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {isLoading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-neutral-900" />
              <p className="mt-4 text-white/70">Loading products...</p>
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-12">
              <ShoppingBag className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">No products found</h3>
              <p className="text-white/70">Try adjusting your search or filters</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
              {products.map((product) => (
                <PremiumProductCard
                  key={product.id}
                  product={product}
                  imageErrored={imageErrors.has(Number(product.id))}
                  onImageError={(id) => markImageError(id)}
                  onOpen={(p) => router.push(`/e-commerce/product/${p.id}`)}
                  onAddToCart={(p, e) => {
                    e.stopPropagation();
                    handleAddToCart(p);
                  }}
                />
              ))}
            </div>
          )}

          {pagination && pagination.last_page > 1 && (
            <div className="mt-8">
              <div className="text-center text-sm text-white/70 mb-3">
                Page {pagination.current_page} of {pagination.last_page}
              </div>

              <div className="flex items-center justify-center gap-2 flex-wrap">
                <button
                  type="button"
                  disabled={pagination.current_page <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-white/90 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white/10"
                >
                  Prev
                </button>

                {getPageWindow(pagination.current_page, pagination.last_page).map((p, idx) =>
                  p === '…' ? (
                    <span key={`dots-${idx}`} className="px-2 text-white/50">
                      …
                    </span>
                  ) : (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setCurrentPage(p)}
                      className={[
                        'min-w-10 px-3 py-2 rounded-lg border text-sm',
                        p === pagination.current_page
                          ? 'border-white/30 bg-white/10 text-white'
                          : 'border-white/10 bg-white/5 text-white/85 hover:bg-white/10',
                      ].join(' ')}
                    >
                      {p}
                    </button>
                  )
                )}

                <button
                  type="button"
                  disabled={pagination.current_page >= pagination.last_page}
                  onClick={() => setCurrentPage((p) => Math.min(pagination.last_page, p + 1))}
                  className="px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-white/90 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white/10"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div></div>

      <CartSidebar isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
    </>
  );
}
