"use client";

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Navigation from '@/components/ecommerce/Navigation';
import CartSidebar from '@/components/ecommerce/cart/CartSidebar';
import CategorySidebar from '@/components/ecommerce/category/CategorySidebar';
import { useCart } from '@/app/e-commerce/CartContext';
import catalogService, {
  CatalogCategory,
  Product,
  SimpleProduct,
  GetProductsParams,
} from '@/services/catalogService';
import { getCardPriceText, getCardStockLabel } from '@/lib/ecommerceCardUtils';
import { groupProductsByMother } from '@/lib/ecommerceProductGrouping';

interface CategoryPageParams {
  slug: string;
}

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


const UI_CARDS_PER_PAGE = 20;
const MAX_API_PAGES = 50;

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const getProductsSilent = (params: GetProductsParams) =>
  catalogService.getProducts({ ...(params as any), _suppressErrorLog: true } as GetProductsParams);

const getPageSizeFromResponse = (response: Awaited<ReturnType<typeof catalogService.getProducts>> | null | undefined) => {
  const p = Number(response?.pagination?.per_page || 0);
  if (Number.isFinite(p) && p > 0) return p;
  const len = Array.isArray(response?.products) ? response!.products.length : 0;
  return Math.max(1, len || 20);
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
    const representative =
      (group.representative as SimpleProduct) ||
      all.find((variant) => Number(variant.stock_quantity || 0) > 0) ||
      all[0];

    if (!representative) {
      return {
        id: Number(group.representativeId || 0),
        name: group.baseName || 'Product',
        display_name: group.baseName || 'Product',
        base_name: group.baseName || 'Product',
        sku: '',
        selling_price: 0,
        stock_quantity: 0,
        description: '',
        images: [],
        in_stock: false,
        has_variants: false,
        total_variants: 0,
        variants: [],
      } as SimpleProduct;
    }

    const variantsWithoutRepresentative = all.filter(
      (variant) => Number(variant.id) !== Number(representative.id)
    );

    return {
      ...representative,
      name: group.baseName || (representative as any).base_name || representative.name,
      display_name: group.baseName || (representative as any).display_name || (representative as any).base_name || representative.name,
      base_name: group.baseName || (representative as any).base_name || representative.name,
      has_variants: all.length > 1,
      total_variants: all.length,
      variants: variantsWithoutRepresentative,
    } as SimpleProduct;
  });
};

export default function CategoryPage() {
  const params = useParams() as CategoryPageParams;
  const router = useRouter();
  const { addToCart } = useCart();

  const categorySlug = params.slug || '';

  const [products, setProducts] = useState<(Product | SimpleProduct)[]>([]);
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [activeCategoryName, setActiveCategoryName] = useState('');
  const [loading, setLoading] = useState(true);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [partialLoadWarning, setPartialLoadWarning] = useState<string | null>(null);

  const [selectedSort, setSelectedSort] = useState('newest');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalResults, setTotalResults] = useState(0);
  const [isCartOpen, setIsCartOpen] = useState(false);

  const [selectedPriceRange, setSelectedPriceRange] = useState<string>('all');
  const [selectedStock, setSelectedStock] = useState<string>('all');

  const [imageErrors, setImageErrors] = useState<Set<number>>(new Set());

  const normalizedSlug = useMemo(() => normalizeKey(categorySlug), [categorySlug]);
  const flatCategories = useMemo(() => flattenCategories(categories), [categories]);

  const activeCategory = useMemo(() => {
    return (
      flatCategories.find((cat) => {
        const slugKey = normalizeKey(cat.slug || '');
        const nameKey = normalizeKey(cat.name || '');
        return slugKey === normalizedSlug || nameKey === normalizedSlug;
      }) || null
    );
  }, [flatCategories, normalizedSlug]);

  const fetchCategories = async () => {
    try {
      setCategoriesLoading(true);
      const categoryData = await catalogService.getCategories();
      setCategories(Array.isArray(categoryData) ? categoryData : []);
      setError(null);
    } catch (err) {
      console.error('Error fetching categories:', err);
      setError('Failed to load categories');
    } finally {
      setCategoriesLoading(false);
    }
  };


  const recoverFailedApiPageRange = async (
    attemptParams: Record<string, any>,
    failedApiPage: number,
    rawPageSize: number
  ): Promise<{ recovered: (Product | SimpleProduct)[]; unrecoverableItemSlots: number; perPageOverrideSupported: boolean }> => {
    const recovered: (Product | SimpleProduct)[] = [];
    const divisors = [100, 50, 20, 10, 5, 1]
      .filter((size) => rawPageSize % size === 0 && size < rawPageSize)
      .sort((a, b) => b - a);

    if (divisors.length === 0) {
      return { recovered, unrecoverableItemSlots: rawPageSize, perPageOverrideSupported: false };
    }

    const startIndex = (failedApiPage - 1) * rawPageSize;
    const endIndexExclusive = startIndex + rawPageSize;
    let perPageOverrideSupported: boolean | null = null;

    const fetchChunkRecursive = async (
      chunkStart: number,
      chunkEndExclusive: number,
      divisorIndex: number
    ): Promise<number> => {
      const chunkSize = divisors[Math.min(divisorIndex, divisors.length - 1)] || 1;
      let unrecoverableSlots = 0;

      for (let cursor = chunkStart; cursor < chunkEndExclusive; cursor += chunkSize) {
        const page = Math.floor(cursor / chunkSize) + 1;
        try {
          const response = await getProductsSilent({
            ...(attemptParams as any),
            page,
            per_page: chunkSize,
          } as GetProductsParams);

          if (perPageOverrideSupported === null) {
            const returnedPageSize = getPageSizeFromResponse(response);
            perPageOverrideSupported = returnedPageSize === chunkSize || (chunkSize === 1 && returnedPageSize === 1);
          }

          if (perPageOverrideSupported === false) {
            // Backend is ignoring per_page overrides, so chunk-based recovery is impossible.
            return chunkEndExclusive - chunkStart;
          }

          if (Array.isArray(response?.products) && response.products.length > 0) {
            recovered.push(...(response.products as any[]));
          }
        } catch (chunkErr) {
          if (perPageOverrideSupported === false) {
            return chunkEndExclusive - chunkStart;
          }

          if (chunkSize === 1) {
            unrecoverableSlots += 1;
            console.warn(`Skipping malformed product item at raw index ${cursor} (api page ${failedApiPage})`);
          } else {
            unrecoverableSlots += await fetchChunkRecursive(
              cursor,
              Math.min(cursor + chunkSize, chunkEndExclusive),
              divisorIndex + 1
            );
          }
        }
      }

      return unrecoverableSlots;
    };

    const unrecoverableItemSlots = await fetchChunkRecursive(startIndex, endIndexExclusive, 0);
    return {
      recovered,
      unrecoverableItemSlots,
      perPageOverrideSupported: perPageOverrideSupported !== false,
    };
  };



  const fetchProducts = async (uiPage = 1) => {
    if (categoriesLoading) return;

    setLoading(true);
    setPartialLoadWarning(null);
    try {
      const baseParams: GetProductsParams = {
        page: 1,
        per_page: 200,
        sort_by: selectedSort as GetProductsParams['sort_by'],
      };

      if (selectedStock === 'in_stock') {
        baseParams.in_stock = true;
      } else if (selectedStock === 'out_of_stock') {
        baseParams.in_stock = false;
      }

      if (selectedPriceRange !== 'all') {
        const [min, max] = selectedPriceRange.split('-').map(Number);
        if (!Number.isNaN(min)) baseParams.min_price = min;
        if (!Number.isNaN(max)) baseParams.max_price = max;
      }

      const decodedSlugName = decodeURIComponent(categorySlug || '').replace(/-/g, ' ').trim();

      const attempts: Array<Record<string, any>> = [];
      const seenAttemptKeys = new Set<string>();
      const pushAttempt = (candidate: Record<string, any>) => {
        const key = JSON.stringify(candidate);
        if (seenAttemptKeys.has(key)) return;
        seenAttemptKeys.add(key);
        attempts.push(candidate);
      };

      if (activeCategory?.id) {
        setActiveCategoryName(activeCategory.name);
        pushAttempt({ ...baseParams, category_id: activeCategory.id });
        pushAttempt({ ...baseParams, category_id: activeCategory.id, category: activeCategory.name });
        if (activeCategory.slug) {
          pushAttempt({ ...baseParams, category_id: activeCategory.id, category: activeCategory.slug });
          pushAttempt({ ...baseParams, category: activeCategory.slug });
        }
        pushAttempt({ ...baseParams, category: activeCategory.name });
      } else {
        setActiveCategoryName(decodedSlugName || '');
        if (decodedSlugName) pushAttempt({ ...baseParams, category: decodedSlugName });
        if (categorySlug) pushAttempt({ ...baseParams, category: categorySlug });
      }

      if (attempts.length === 0) {
        pushAttempt({ ...baseParams });
      }

      let matched = false;
      let hadRecoverableFailures = false;
      let lastFatalError: unknown = null;

      for (const attempt of attempts) {
        const aggregatedRaw: (Product | SimpleProduct)[] = [];
        const failedApiPages = new Set<number>();

        let initialResponse: Awaited<ReturnType<typeof catalogService.getProducts>> | null = null;
        try {
          initialResponse = await getProductsSilent({ ...(attempt as any), page: 1 } as GetProductsParams);
        } catch (pageErr) {
          console.error('Error fetching products page 1 for attempt:', attempt, pageErr);
          lastFatalError = pageErr;
          continue;
        }

        if (Array.isArray(initialResponse?.products) && initialResponse.products.length > 0) {
          aggregatedRaw.push(...(initialResponse.products as any[]));
        }

        const rawPageSize = getPageSizeFromResponse(initialResponse);
        const apiLastPage = Math.max(1, Number(initialResponse?.pagination?.last_page || 1));
        if (apiLastPage > 1) {
          const safeLastPage = Math.min(apiLastPage, MAX_API_PAGES);
          for (let apiPage = 2; apiPage <= safeLastPage; apiPage += 1) {
            try {
              const nextResponse = await getProductsSilent({ ...(attempt as any), page: apiPage } as GetProductsParams);
              const nextProducts = Array.isArray(nextResponse?.products) ? (nextResponse.products as any[]) : [];
              if (nextProducts.length > 0) {
                aggregatedRaw.push(...nextProducts);
              }

              // Some backends return incorrect pagination metadata (e.g. global last_page for every category).
              // Stop early when the page is empty or clearly partial, even if has_more_pages/last_page says otherwise.
              const nextPerPage = getPageSizeFromResponse(nextResponse);
              if (nextProducts.length === 0 || nextProducts.length < nextPerPage) break;
              if (!nextResponse?.pagination?.has_more_pages) break;
            } catch (pageErr) {
              console.warn(`Backend page ${apiPage} returned an error. Attempting recovery...`);
              hadRecoverableFailures = true;

              try {
                const recovery = await recoverFailedApiPageRange(attempt, apiPage, rawPageSize);
                if (Array.isArray(recovery.recovered) && recovery.recovered.length > 0) {
                  aggregatedRaw.push(...(recovery.recovered as any[]));
                }

                if (!recovery.perPageOverrideSupported) {
                  console.warn(`Backend ignored per_page override, so frontend could not isolate bad item(s) on backend page ${apiPage}. Skipping that page.`);
                  failedApiPages.add(apiPage);
                } else if (recovery.unrecoverableItemSlots > 0) {
                  failedApiPages.add(apiPage);
                } else {
                  console.info(`Recovered backend page ${apiPage} using smaller chunk retries`);
                }
              } catch (recoveryErr) {
                console.error(`Recovery failed for products page ${apiPage}:`, recoveryErr);
                failedApiPages.add(apiPage);
              }

              continue;
            }
          }
        }

        const cards = buildCardProductsFromFlatCatalog(aggregatedRaw);

        if (cards.length > 0) {
          const computedTotalPages = Math.max(1, Math.ceil(cards.length / UI_CARDS_PER_PAGE));
          const safeUiPage = clamp(uiPage, 1, computedTotalPages);
          const startIndex = (safeUiPage - 1) * UI_CARDS_PER_PAGE;
          const pageCards = cards.slice(startIndex, startIndex + UI_CARDS_PER_PAGE);

          setProducts(pageCards);
          setTotalResults(cards.length);
          setCurrentPage(safeUiPage);
          setTotalPages(computedTotalPages);
          setError(null);

          if (failedApiPages.size > 0) {
            const sortedFailedPages = Array.from(failedApiPages).sort((a, b) => a - b);
            setPartialLoadWarning(
              `Some products were skipped due to a server data issue. We recovered what we could, but backend page${sortedFailedPages.length > 1 ? 's' : ''} ${sortedFailedPages.join(', ')} still has invalid item data.`
            );
          } else if (hadRecoverableFailures) {
            setPartialLoadWarning('Some backend pages had data issues, but products were recovered automatically.');
          } else {
            setPartialLoadWarning(null);
          }

          matched = true;
          break;
        }
      }

      if (!matched) {
        if (hadRecoverableFailures) {
          setError('Some products could not be loaded because of a server data issue.');
          setPartialLoadWarning('Try changing sort order or filters to continue browsing other products.');
        } else if (lastFatalError) {
          throw lastFatalError;
        } else {
          setError(null);
          setPartialLoadWarning(null);
        }

        setProducts([]);
        setTotalResults(0);
        setCurrentPage(1);
        setTotalPages(1);
      }
    } catch (err) {
      console.error('Error fetching products:', err);
      setError('Failed to load products');
      setPartialLoadWarning(null);
      setProducts([]);
      setTotalResults(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
    setImageErrors(new Set());
    fetchProducts(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCategory?.id, categoriesLoading, selectedSort, selectedPriceRange, selectedStock]);

  const handleImageError = (productId: number) => {
    setImageErrors((prev) => {
      if (prev.has(productId)) return prev;
      const next = new Set(prev);
      next.add(productId);
      return next;
    });
  };

  const handleAddToCart = async (product: Product | SimpleProduct) => {
    try {
      if ((product as any).has_variants) {
        router.push(`/e-commerce/product/${product.id}`);
        return;
      }
      await addToCart(product.id, 1);
      setIsCartOpen(true);
    } catch (err) {
      console.error('Error adding to cart:', err);
    }
  };

  const handleProductClick = (productId: number | string) => {
    router.push(`/e-commerce/product/${productId}`);
  };

  const handleCategoryChange = (categoryNameOrSlug: string) => {
    if (categoryNameOrSlug === 'all') {
      router.push('/e-commerce/products');
      return;
    }
    router.push(`/e-commerce/${encodeURIComponent(categoryNameOrSlug)}`);
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      fetchProducts(newPage);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  if (loading && products.length === 0) {
    return (
      <>
        <Navigation />
        <div className="min-h-screen bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="animate-pulse">
              <div className="h-8 bg-gray-200 rounded w-1/4 mb-8"></div>
              <div className="flex gap-8">
                <div className="w-64 h-96 bg-gray-200 rounded-lg"></div>
                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className="bg-white rounded-lg shadow-sm">
                      <div className="h-64 bg-gray-200 rounded-t-lg"></div>
                      <div className="p-4 space-y-2">
                        <div className="h-4 bg-gray-200 rounded"></div>
                        <div className="h-4 bg-gray-200 rounded w-2/3"></div>
                        <div className="h-6 bg-gray-200 rounded w-1/2"></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div></>
    );
  }

  return (
    <>
      <Navigation />

      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">{activeCategoryName || 'Products'}</h1>
            <p className="text-gray-600">
              {totalResults} {totalResults === 1 ? 'product' : 'products'} found
            </p>
          </div>

          <div className="flex flex-col lg:flex-row gap-8">
            <aside className="w-full lg:w-64 flex-shrink-0">
              <CategorySidebar
                categories={categories}
                activeCategory={categorySlug}
                onCategoryChange={handleCategoryChange}
                selectedPriceRange={selectedPriceRange}
                onPriceRangeChange={setSelectedPriceRange}
                selectedStock={selectedStock}
                onStockChange={setSelectedStock}
              />
            </aside>

            <main className="flex-1">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                <div className="text-sm text-gray-600">Showing {products.length} of {totalResults} products</div>
                <select
                  value={selectedSort}
                  onChange={(e) => setSelectedSort(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-200"
                >
                  <option value="newest">Newest First</option>
                  <option value="price_asc">Price: Low to High</option>
                  <option value="price_desc">Price: High to Low</option>
                  <option value="name">Name A-Z</option>
                </select>
              </div>

              {partialLoadWarning && !error && (
                <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  {partialLoadWarning}
                </div>
              )}

              {error ? (
                <div className="text-center py-12">
                  <p className="text-rose-600 mb-4">{error}</p>
                  <button
                    onClick={() => fetchProducts(currentPage)}
                    className="px-6 py-2 bg-neutral-900 text-white rounded-lg hover:bg-neutral-800"
                  >
                    Try Again
                  </button>
                </div>
              ) : products.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-500 text-lg">No products found in this category</p>
                  <p className="text-gray-400 mt-2">Try adjusting your filters or browse other categories</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {products.map((product) => {
                      const primaryImage = product.images?.[0]?.url || '';
                      const shouldUseFallback = imageErrors.has(product.id) || !primaryImage;
                      const imageUrl = shouldUseFallback
                        ? '/images/placeholder-product.jpg'
                        : primaryImage;

                      const stockLabel = getCardStockLabel(product);
                      const hasStock = stockLabel !== 'Out of Stock';

                      return (
                        <div
                          key={product.id}
                          className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow duration-300 overflow-hidden group"
                        >
                          <div
                            className="relative h-64 bg-gray-100 cursor-pointer"
                            onClick={() => handleProductClick(product.id)}
                          >
                            <Image
                              src={imageUrl}
                              alt={(product as any).display_name || (product as any).base_name || product.name}
                              fill
                              className="object-cover group-hover:scale-105 transition-transform duration-300"
                              onError={shouldUseFallback ? undefined : () => handleImageError(product.id)}
                            />

                            <span
                              className={`absolute top-2 right-2 text-xs px-2 py-1 rounded-full ${
                                stockLabel === 'In Stock'
                                  ? 'bg-green-100 text-green-700'
                                  : hasStock
                                  ? 'bg-amber-100 text-amber-700'
                                  : 'bg-rose-50 text-neutral-900'
                              }`}
                            >
                              {stockLabel}
                            </span>
                          </div>

                          <div className="p-4">
                            <h3
                              className="font-semibold text-gray-900 mb-2 line-clamp-2 cursor-pointer hover:text-neutral-900"
                              onClick={() => handleProductClick(product.id)}
                            >
                              {(product as any).display_name || (product as any).base_name || product.name}
                            </h3>

                            <div className="mb-3">
                              <span className="text-lg font-bold text-neutral-900">{getCardPriceText(product)}</span>
                            </div>

                            <button
                              onClick={() => handleAddToCart(product)}
                              className="w-full bg-neutral-900 text-white py-2 px-4 rounded-lg hover:bg-neutral-800 transition-colors"
                            >
                              {(product as any).has_variants ? 'Select Variation' : 'Add to Cart'}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {totalPages > 1 && (
                    <div className="flex justify-center items-center mt-8 gap-2">
                      <button
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage === 1}
                        className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                      >
                        Previous
                      </button>

                      {[...Array(Math.min(totalPages, 5))].map((_, i) => {
                        const pageNum = i + 1;
                        return (
                          <button
                            key={pageNum}
                            onClick={() => handlePageChange(pageNum)}
                            className={`px-4 py-2 rounded-lg ${
                              currentPage === pageNum ? 'bg-neutral-900 text-white' : 'border border-gray-300 hover:bg-gray-50'
                            }`}
                          >
                            {pageNum}
                          </button>
                        );
                      })}

                      <button
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                      >
                        Next
                      </button>
                    </div>
                  )}
                </>
              )}
            </main>
          </div>
        </div>
      </div><CartSidebar isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
    </>
  );
}
