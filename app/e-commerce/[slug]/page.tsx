"use client";

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Navigation from '@/components/ecommerce/Navigation';
import Footer from '@/components/ecommerce/Footer';
import CartSidebar from '@/components/ecommerce/cart/CartSidebar';
import CategorySidebar from '@/components/ecommerce/category/CategorySidebar';
import { useCart } from '@/app/e-commerce/CartContext';
import catalogService, {
  CatalogCategory,
  Product,
  SimpleProduct,
  GetProductsParams,
} from '@/services/catalogService';
import { buildCardProductsFromResponse, getCardPriceText, getCardStockLabel } from '@/lib/ecommerceCardUtils';

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

  const [selectedSort, setSelectedSort] = useState('newest');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
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

  const fetchProducts = async (page = 1) => {
    if (categoriesLoading) return;

    setLoading(true);
    try {
      const params: GetProductsParams = {
        page,
        per_page: 24,
        sort_by: selectedSort as GetProductsParams['sort_by'],
      };

      if (!activeCategory?.id) {
        // Category might be missing from the tree (or slug mismatch). Try a graceful fallback
        // using the raw slug/name so the page doesn't go empty.
        const fallbackCategory = decodeURIComponent(categorySlug || '').replace(/-/g, ' ').trim();
        setActiveCategoryName(fallbackCategory || '');
        setError(null);

        const fallbackParams: any = {
          ...params,
          category: categorySlug || fallbackCategory,
        };
        delete fallbackParams.category_id;

        const fallbackResponse = await catalogService.getProducts(fallbackParams);
        const fallbackCards = buildCardProductsFromResponse(fallbackResponse);
        setProducts(fallbackCards);

        setCurrentPage(fallbackResponse.pagination.current_page);
        setTotalPages(fallbackResponse.pagination.last_page);
        return;
      }

      params.category_id = activeCategory.id;
      params.category = activeCategory.slug || activeCategory.name;

      if (selectedStock === 'in_stock') {
        params.in_stock = true;
      }

      if (selectedPriceRange !== 'all') {
        const [min, max] = selectedPriceRange.split('-').map(Number);
        if (!Number.isNaN(min)) params.min_price = min;
        if (!Number.isNaN(max)) params.max_price = max;
      }

      let response = await catalogService.getProducts(params);
      let cardProducts = buildCardProductsFromResponse(response);

      // Fallback for older API versions: try slug/name based filtering if id-based filtering returns empty.
      if (cardProducts.length === 0 && (activeCategory?.slug || activeCategory?.name)) {
        const fallbackParams: any = { ...params };
        delete fallbackParams.category_id;
        fallbackParams.category = activeCategory.slug || activeCategory.name;
        response = await catalogService.getProducts(fallbackParams);
        cardProducts = buildCardProductsFromResponse(response);
      }

      setProducts(cardProducts);
      setCurrentPage(response.pagination.current_page);
      setTotalPages(response.pagination.last_page);
      setActiveCategoryName(activeCategory.name);
      setError(null);
    } catch (err) {
      console.error('Error fetching products:', err);
      setError('Failed to load products');
      setProducts([]);
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
        </div>
        <Footer />
      </>
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
              {products.length} {products.length === 1 ? 'product' : 'products'} found
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
                <div className="text-sm text-gray-600">Showing {products.length} products</div>
                <select
                  value={selectedSort}
                  onChange={(e) => setSelectedSort(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                >
                  <option value="newest">Newest First</option>
                  <option value="price_asc">Price: Low to High</option>
                  <option value="price_desc">Price: High to Low</option>
                  <option value="name">Name A-Z</option>
                </select>
              </div>

              {error ? (
                <div className="text-center py-12">
                  <p className="text-red-600 mb-4">{error}</p>
                  <button
                    onClick={() => fetchProducts(currentPage)}
                    className="px-6 py-2 bg-red-700 text-white rounded-lg hover:bg-red-800"
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
                                  : 'bg-red-100 text-red-700'
                              }`}
                            >
                              {stockLabel}
                            </span>
                          </div>

                          <div className="p-4">
                            <h3
                              className="font-semibold text-gray-900 mb-2 line-clamp-2 cursor-pointer hover:text-red-700"
                              onClick={() => handleProductClick(product.id)}
                            >
                              {(product as any).display_name || (product as any).base_name || product.name}
                            </h3>

                            <div className="mb-3">
                              <span className="text-lg font-bold text-red-700">{getCardPriceText(product)}</span>
                            </div>

                            <button
                              onClick={() => handleAddToCart(product)}
                              className="w-full bg-red-700 text-white py-2 px-4 rounded-lg hover:bg-red-800 transition-colors"
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
                              currentPage === pageNum ? 'bg-red-700 text-white' : 'border border-gray-300 hover:bg-gray-50'
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
      </div>

      <Footer />
      <CartSidebar isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
    </>
  );
}
