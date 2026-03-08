'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, Filter, ShoppingBag } from 'lucide-react';

import Navigation from '@/components/ecommerce/Navigation';
import CartSidebar from '@/components/ecommerce/cart/CartSidebar';
import { useCart } from '@/app/e-commerce/CartContext';
import catalogService, {
  CatalogCategory,
  GetProductsParams,
  PaginationMeta,
  Product,
  SimpleProduct,
} from '@/services/catalogService';
import SlugStyleProductCard from '@/components/ecommerce/ui/SlugStyleProductCard';
import { groupProductsByMother } from '@/lib/ecommerceProductGrouping';

type ProductSort = NonNullable<GetProductsParams['sort_by']>;

const UI_CARDS_PER_PAGE = 20;
const API_PER_PAGE = 60;
const MAX_API_PAGES = 50;

const normalizeKey = (value: string) =>
  decodeURIComponent(value || '')
    .toLowerCase()
    .trim()
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ');

const flattenCategories = (cats: CatalogCategory[]): CatalogCategory[] => {
  const result: CatalogCategory[] = [];

  const walk = (items: CatalogCategory[]) => {
    items.forEach((cat) => {
      result.push(cat);
      if (Array.isArray(cat.children) && cat.children.length > 0) {
        walk(cat.children);
      }
    });
  };

  walk(cats);
  return result;
};

const getDescendantCategoryNodes = (category: CatalogCategory | null | undefined): CatalogCategory[] => {
  if (!category) return [];
  const nodes: CatalogCategory[] = [];
  const walk = (node: CatalogCategory) => {
    nodes.push(node);
    if (Array.isArray(node.children)) node.children.forEach(walk);
  };
  walk(category);
  return nodes;
};

const buildAllowedCategoryKeys = (category: CatalogCategory | null) => {
  const ids = new Set<number>();
  const keys = new Set<string>();

  const addKey = (v: string | undefined | null) => {
    const k = normalizeKey(String(v || ''));
    if (k) keys.add(k);
  };

  if (category) {
    for (const node of getDescendantCategoryNodes(category)) {
      const id = Number((node as any)?.id || 0);
      if (id > 0) ids.add(id);
      addKey(node.name);
      addKey(node.slug);
    }
  }

  return { ids, keys };
};

const productMatchesAllowedCategory = (
  product: Product | SimpleProduct,
  allowed: { ids: Set<number>; keys: Set<string> }
) => {
  if ((!allowed.ids || allowed.ids.size === 0) && (!allowed.keys || allowed.keys.size === 0)) return true;

  const cat: any = (product as any)?.category;
  const catId = Number(cat?.id || 0);
  if (catId > 0 && allowed.ids.has(catId)) return true;

  const candidateKeys = [
    cat?.slug,
    cat?.name,
    (product as any)?.category_slug,
    (product as any)?.category_name,
  ]
    .map((v) => normalizeKey(String(v || '')))
    .filter(Boolean);

  return candidateKeys.some((k) => allowed.keys.has(k));
};

const buildCardProductsFromFlatCatalog = (rawProducts: (Product | SimpleProduct)[]): SimpleProduct[] => {
  const grouped = groupProductsByMother(rawProducts as any[], {
    useCategoryInKey: true,
    preferSkuGrouping: true,
  });

  return grouped.map((group) => {
    const rawVariants = (group.variants || [])
      .map((variant) => variant.raw)
      .filter(Boolean) as SimpleProduct[];

    const uniqueVariants = new Map<number, SimpleProduct>();
    rawVariants.forEach((variant) => {
      const id = Number((variant as any)?.id) || 0;
      if (!id) return;
      if (!uniqueVariants.has(id)) uniqueVariants.set(id, variant);
    });

    const all = Array.from(uniqueVariants.values());

    const fallbackImages =
      all.find((v) => (v as any).images?.some((img: any) => img?.is_primary))?.images ||
      all.find((v) => Array.isArray((v as any).images) && (v as any).images.length > 0)?.images ||
      [];

    const allWithImages = fallbackImages.length
      ? all.map((v) =>
          Array.isArray((v as any).images) && (v as any).images.length > 0
            ? v
            : { ...(v as any), images: fallbackImages }
        )
      : all;

    const representative =
      (allWithImages.find((v) => Number(v.id) === Number((group.representative as any)?.id)) as SimpleProduct) ||
      (group.representative as SimpleProduct) ||
      allWithImages.find((variant) => Number(variant.stock_quantity || 0) > 0) ||
      allWithImages[0];

    if (!representative) {
      return {
        id: Number(group.representativeId || 0),
        name: group.baseName || 'Product',
        display_name: group.baseName || 'Product',
        base_name: group.baseName || 'Product',
        sku: '',
        selling_price: 0,
        stock_quantity: 0,
        images: [],
        in_stock: false,
        has_variants: false,
        total_variants: 0,
        variants: [],
      } as SimpleProduct;
    }

    const variantsWithoutRepresentative = allWithImages.filter(
      (variant) => Number(variant.id) !== Number(representative.id)
    );

    return {
      ...representative,
      name: group.baseName || (representative as any).base_name || representative.name,
      display_name:
        group.baseName ||
        (representative as any).display_name ||
        (representative as any).base_name ||
        representative.name,
      base_name: group.baseName || (representative as any).base_name || representative.name,
      has_variants: all.length > 1,
      total_variants: all.length,
      variants: variantsWithoutRepresentative,
    } as SimpleProduct;
  });
};

const getProductsSilent = (params: GetProductsParams) =>
  catalogService.getProducts({ ...(params as any), _suppressErrorLog: true } as GetProductsParams);

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const getCacheKey = (input: {
  categoryId: string;
  searchTerm: string;
  sortBy: ProductSort;
}) => {
  return [
    'products',
    input.categoryId || 'all',
    normalizeKey(input.searchTerm || ''),
    input.sortBy,
  ].join('::');
};

export default function ProductsPage() {
  const router = useRouter();

  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<ProductSort>('newest');
  const [isLoading, setIsLoading] = useState(false);
  const [categoriesLoading, setCategoriesLoading] = useState(true);

  const [products, setProducts] = useState<SimpleProduct[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);

  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [imageErrors, setImageErrors] = useState<Set<number>>(new Set());
  const { addToCart } = useCart();

  const flatCategories = useMemo(() => flattenCategories(categories), [categories]);
  const activeCategory = useMemo(() => {
    if (selectedCategory === 'all') return null;
    return flatCategories.find((c) => String(c.id) === String(selectedCategory)) || null;
  }, [flatCategories, selectedCategory]);

  type CacheEntry = {
    key: string;
    attemptParams: Record<string, any>;
    fetchedApiPages: number;
    apiLastPage: number | null;
    hasMore: boolean;
    rawById: Map<number, Product | SimpleProduct>;
    rawOrdered: Array<Product | SimpleProduct>;
    cards: SimpleProduct[];
  };

  const cacheRef = useRef<Record<string, CacheEntry>>({});

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
    setImageErrors(new Set());
    cacheRef.current = {};
  }, [selectedCategory, searchTerm, sortBy]);

  useEffect(() => {
    if (categoriesLoading) return;
    fetchProducts(currentPage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoriesLoading, selectedCategory, searchTerm, sortBy, currentPage]);

  const fetchCategories = async () => {
    try {
      setCategoriesLoading(true);
      const categoryData = await catalogService.getCategories();
      setCategories(Array.isArray(categoryData) ? categoryData : []);
    } catch (error) {
      console.error('Error fetching categories:', error);
      setCategories([]);
    } finally {
      setCategoriesLoading(false);
    }
  };

  const ensureCardsForUiPage = async (entry: CacheEntry, uiPage: number) => {
    const targetCards = uiPage * UI_CARDS_PER_PAGE;
    const allowedCategory = buildAllowedCategoryKeys(activeCategory || null);
    const serverSideCategoryFiltered = Boolean(
      (entry.attemptParams as any)?.category_slug || (entry.attemptParams as any)?.category_id
    );

    const appendFilteredUniqueProducts = (items: (Product | SimpleProduct)[] | undefined | null) => {
      if (!Array.isArray(items) || items.length === 0) return 0;
      let added = 0;

      for (const rawItem of items) {
        if (!rawItem) continue;

        if (activeCategory && !serverSideCategoryFiltered) {
          if (!productMatchesAllowedCategory(rawItem, allowedCategory)) continue;
        }

        const itemId = Number((rawItem as any).id || 0);
        if (itemId > 0) {
          if (entry.rawById.has(itemId)) continue;
          entry.rawById.set(itemId, rawItem);
        }

        entry.rawOrdered.push(rawItem);
        added += 1;
      }

      return added;
    };

    while (entry.cards.length < targetCards && entry.hasMore && entry.fetchedApiPages < MAX_API_PAGES) {
      const nextApiPage = entry.fetchedApiPages + 1;

      try {
        const res = await getProductsSilent({ ...(entry.attemptParams as any), page: nextApiPage } as GetProductsParams);
        entry.fetchedApiPages = nextApiPage;

        const nextProducts = Array.isArray(res?.products) ? (res.products as any[]) : [];
        const lastPage = Number(res?.pagination?.last_page || 0);
        if (Number.isFinite(lastPage) && lastPage > 0) entry.apiLastPage = lastPage;

        appendFilteredUniqueProducts(nextProducts);

        if (nextProducts.length === 0) {
          entry.hasMore = false;
        } else if (res?.pagination?.has_more_pages === false) {
          entry.hasMore = false;
        } else if (entry.apiLastPage && entry.fetchedApiPages >= entry.apiLastPage) {
          entry.hasMore = false;
        }

        entry.cards = buildCardProductsFromFlatCatalog(entry.rawOrdered);
      } catch (error) {
        console.warn(`Error fetching products api page ${nextApiPage}`, error);
        entry.hasMore = false;
        break;
      }
    }
  };

  const fetchProducts = async (uiPage = 1) => {
    setIsLoading(true);
    try {
      const params: GetProductsParams & Record<string, any> = {
        page: 1,
        per_page: API_PER_PAGE,
        sort_by: sortBy,
      };

      if (activeCategory) {
        params.category_id = activeCategory.id;
        params.category_slug = activeCategory.slug;
        params.category = activeCategory.slug || activeCategory.name;
      }

      if (searchTerm.trim()) {
        params.search = searchTerm.trim();
      }

      const cacheKey = getCacheKey({
        categoryId: selectedCategory,
        searchTerm,
        sortBy,
      });

      let entry = cacheRef.current[cacheKey];
      if (!entry) {
        entry = {
          key: cacheKey,
          attemptParams: params,
          fetchedApiPages: 0,
          apiLastPage: null,
          hasMore: true,
          rawById: new Map(),
          rawOrdered: [],
          cards: [],
        };
        cacheRef.current[cacheKey] = entry;
      }

      await ensureCardsForUiPage(entry, uiPage);

      const computedTotalPages = Math.max(1, Math.ceil(entry.cards.length / UI_CARDS_PER_PAGE));
      const safeUiPage = clamp(uiPage, 1, Math.max(computedTotalPages, entry.hasMore ? uiPage : computedTotalPages));
      const startIndex = (safeUiPage - 1) * UI_CARDS_PER_PAGE;
      const pageCards = entry.cards.slice(startIndex, startIndex + UI_CARDS_PER_PAGE);

      setProducts(pageCards);
      setCurrentPage(safeUiPage);
      setPagination({
        current_page: safeUiPage,
        per_page: UI_CARDS_PER_PAGE,
        total: entry.cards.length,
        last_page: entry.hasMore ? Math.max(computedTotalPages, safeUiPage + 1) : computedTotalPages,
        has_more_pages: entry.hasMore || safeUiPage < computedTotalPages,
      });
    } catch (error) {
      console.error('Error fetching products:', error);
      setProducts([]);
      setPagination({
        current_page: 1,
        per_page: UI_CARDS_PER_PAGE,
        total: 0,
        last_page: 1,
        has_more_pages: false,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getPageWindow = (current: number, last: number) => {
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

          <div className="mb-8">
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
                <SlugStyleProductCard
                  key={product.id}
                  product={product}
                  imageErrored={imageErrors.has(Number(product.id))}
                  onImageError={(id) => markImageError(Number(id))}
                  onViewProduct={(id) => router.push(`/e-commerce/product/${id}`)}
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
