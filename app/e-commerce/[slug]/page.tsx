'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import catalogService, { Product, PaginationMeta, CatalogCategory } from '@/services/catalogService';
import { ArrowLeft } from 'lucide-react';
import CategorySidebar from '@/components/ecommerce/category/CategorySidebar';
import Navigation from '@/components/ecommerce/Navigation';
import { adaptCatalogGroupedProducts, groupProductsByMother } from '@/lib/ecommerceProductGrouping';

// Types for product grouping
interface ProductVariant {
  id: number;
  name: string;
  sku: string;
  color?: string;
  size?: string;
  image: string | null;
  selling_price: string;
  in_stock: boolean;
  stock_quantity: number;
}

interface ProductGroup {
  sku: string;
  baseName: string;
  totalVariants: number;
  variants: ProductVariant[];
  primaryImage: string | null;
  category?: {
    id: number;
    name: string;
  };
  hasVariations: boolean;
  lowestPrice: number;
  highestPrice: number;
}

const slugify = (value: string): string =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');

const normalizeForMatch = (value: string): string => slugify(decodeURIComponent(String(value || '')));

const flattenCategories = (cats: CatalogCategory[] = []): CatalogCategory[] => {
  const out: CatalogCategory[] = [];

  const walk = (items: CatalogCategory[]) => {
    items.forEach((cat) => {
      out.push(cat);
      if (Array.isArray(cat.children) && cat.children.length > 0) {
        walk(cat.children);
      }
    });
  };

  walk(cats);
  return out;
};

export default function CategoryProductsPage() {
  const router = useRouter();
  const pathname = usePathname();
  
  // Extract category from pathname (e.g., /category/electronics -> electronics)
  const categorySlug = pathname?.split('/').pop() || '';
  const categoryName = decodeURIComponent(categorySlug);
  
  const [products, setProducts] = useState<Product[]>([]);
  const [apiGroupedProducts, setApiGroupedProducts] = useState<any[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [categoriesLoaded, setCategoriesLoaded] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filter states
  const [sortBy, setSortBy] = useState<string>('newest');
  const [currentPage, setCurrentPage] = useState(1);

  const normalizedSlug = useMemo(() => normalizeForMatch(categorySlug), [categorySlug]);

  const allCategories = useMemo(() => flattenCategories(categories), [categories]);

  const matchedCategory = useMemo(() => {
    return allCategories.find((c) => {
      const bySlug = c.slug ? normalizeForMatch(c.slug) : '';
      const byName = normalizeForMatch(c.name || '');
      return normalizedSlug === bySlug || normalizedSlug === byName;
    });
  }, [allCategories, normalizedSlug]);

  const activeCategoryDisplayName = matchedCategory?.name || categoryName;

  const matchesCurrentCategory = (category: any): boolean => {
    if (!category) return false;

    const incomingId = Number(category?.id || 0);
    if (matchedCategory?.id && incomingId && incomingId === Number(matchedCategory.id)) {
      return true;
    }

    const incomingSlug = normalizeForMatch(
      category?.slug || category?.name || (typeof category === 'string' ? category : '')
    );

    if (!incomingSlug) return false;

    return incomingSlug === normalizedSlug;
  };

  // Fetch categories on mount
  useEffect(() => {
    fetchCategories();
  }, []);

  // Fetch products when category or filters change
  useEffect(() => {
    if (categoryName && categoriesLoaded) {
      fetchProducts();
    }
  }, [categoryName, sortBy, currentPage, categoriesLoaded, matchedCategory?.id, normalizedSlug]);

  const fetchCategories = async () => {
    try {
      const categoriesData = await catalogService.getCategories();
      setCategories(categoriesData);
    } catch (err: any) {
      console.error('Failed to fetch categories:', err);
    } finally {
      setCategoriesLoaded(true);
    }
  };

  const fetchProducts = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await catalogService.getProducts({
        category_id: matchedCategory?.id,
        sort_by: sortBy as any,
        page: currentPage,
        per_page: 20,
      });

      const groupedProducts = Array.isArray(response.grouped_products) ? response.grouped_products : [];
      const flatProducts = Array.isArray(response.products) ? response.products : [];

      // Safety net: if backend ignores category_id for some payload shapes,
      // enforce category filtering on client using id/slug/name.
      const filteredGrouped = groupedProducts.filter((group: any) => matchesCurrentCategory(group?.category));
      const filteredFlat = flatProducts.filter((product: any) => matchesCurrentCategory(product?.category));

      const shouldUseFiltered = filteredGrouped.length > 0 || filteredFlat.length > 0;

      setApiGroupedProducts(shouldUseFiltered ? filteredGrouped : groupedProducts);
      setProducts(shouldUseFiltered ? filteredFlat : flatProducts);
      setPagination(response.pagination);
      
    } catch (err: any) {
      console.error('❌ Error fetching products:', err);
      setError(err.message || 'Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  // Group variant rows under one base product name
  const productGroups = useMemo((): ProductGroup[] => {
    const grouped = (apiGroupedProducts.length > 0)
      ? adaptCatalogGroupedProducts(apiGroupedProducts as any)
      : groupProductsByMother(products);

    return grouped.map((group) => ({
      sku: group.key,
      baseName: group.baseName,
      totalVariants: group.totalVariants,
      variants: group.variants.map((variant) => ({
        id: variant.id,
        name: variant.name,
        sku: variant.sku || `product-${variant.id}`,
        color: variant.color,
        size: variant.size,
        image: variant.image,
        selling_price: String(variant.price || 0),
        in_stock: variant.in_stock,
        stock_quantity: variant.stock_quantity,
      })),
      primaryImage: group.primaryImage || null,
      category: group.category
        ? {
            id: group.category.id,
            name: group.category.name,
          }
        : undefined,
      hasVariations: group.hasVariations,
      lowestPrice: group.lowestPrice,
      highestPrice: group.highestPrice,
    }));
  }, [products, apiGroupedProducts]);

  const handleToggleCategory = (categoryId: number) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSortBy(e.target.value);
    setCurrentPage(1);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    }
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;

      requestAnimationFrame(() => {
        window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      });
    }
  };

  const handleProductClick = (productId: number) => {
    router.push(`/e-commerce/product/${productId}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-800 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading products...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <p className="text-red-600">Error: {error}</p>
            <button
              onClick={() => router.back()}
              className="mt-4 text-red-800 hover:text-red-1000"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (    
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <button
            onClick={() => router.push('/')}
            className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="h-5 w-5 mr-2" />
            Back to Home
          </button>
          
          <div className="flex flex-col md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {activeCategoryDisplayName}
              </h1>
              <p className="mt-2 text-gray-600">
                {productGroups.length} product {productGroups.length === 1 ? 'group' : 'groups'} found
                {products.length !== productGroups.length && ` (${products.length} total variants)`}
              </p>
            </div>

            {/* Sort Dropdown */}
            <div className="mt-4 md:mt-0">
              <label htmlFor="sort" className="mr-2 text-sm text-gray-600">
                Sort by:
              </label>
              <select
                id="sort"
                value={sortBy}
                onChange={handleSortChange}
                className="border border-gray-300 rounded-md px-4 py-2 focus:outline-none focus:ring-2 focus:ring-red-800"
              >
                <option value="newest">Newest First</option>
                <option value="name">Name: A to Z</option>
                <option value="price_asc">Price: Low to High</option>
                <option value="price_desc">Price: High to Low</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content with Sidebar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex gap-8">
          {/* Sidebar */}
          <CategorySidebar
            categories={categories}
            expandedCategories={expandedCategories}
            onToggleCategory={handleToggleCategory}
            activeCategoryName={activeCategoryDisplayName}
          />

          {/* Products Grid */}
          <div className="flex-1">
            {productGroups.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-600 text-lg mb-2">No products found in this category</p>
                <p className="text-sm text-gray-500 mb-4">
                  Category searched: "{activeCategoryDisplayName}"
                </p>
                <button
                  onClick={() => router.push('/')}
                  className="mt-4 text-red-800 hover:text-red-900 font-medium"
                >
                  Browse All Categories
                </button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {productGroups.map((group) => {
                    // Get the first variant for display
                    const firstVariant = group.variants[0];
                    
                    return (
                      <div
                        key={`${group.sku}-${firstVariant.id}`}
                        className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-xl transition-shadow duration-300 cursor-pointer group"
                        onClick={() => {
                          // Find first variant that's in stock, or fall back to first variant
                          const availableVariant = group.variants.find(v => v.in_stock) || firstVariant;
                          handleProductClick(availableVariant.id);
                        }}
                      >
                        {/* Product Image */}
                        <div className="relative aspect-square overflow-hidden bg-gray-100">
                          <img
                            src={group.primaryImage || '/placeholder-product.png'}
                            alt={group.baseName}
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                          />

                          {/* Variant & stock badges */}
                          {group.hasVariations && group.variants.length > 1 && (
                            <span className="absolute top-2 left-2 bg-purple-600 text-white text-xs px-2 py-1 rounded-full font-medium shadow">
                              +{group.variants.length - 1} variants available
                            </span>
                          )}

                          {(() => {
                            const mainStock = Number(firstVariant.stock_quantity || 0);
                            const hasOtherStock = group.variants.slice(1).some((v) => Number(v.stock_quantity || 0) > 0);
                            const stockLabel = mainStock > 0 ? 'In Stock' : hasOtherStock ? 'Available in other variants' : 'Out of Stock';
                            const stockClass =
                              stockLabel === 'In Stock'
                                ? 'bg-green-100 text-green-700'
                                : stockLabel === 'Available in other variants'
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-red-100 text-red-700';

                            return (
                              <span className={`absolute top-2 right-2 text-xs px-2 py-1 rounded-full font-medium ${stockClass}`}>
                                {stockLabel}
                              </span>
                            );
                          })()}
                        </div>

                  {/* Product Info */}
                  <div className="p-4">
                    {/* Product Title */}
                    <h3 className="text-sm font-semibold text-gray-900 mb-2 line-clamp-2 min-h-[1rem]">
                      {group.baseName}
                    </h3>
                    
                    {/* Category */}
                    {group.category && (
                      <p className="text-xs text-gray-500 mb-2">
                        {group.category.name}
                      </p>
                    )}
                    
                    {/* Price */}
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center space-x-3">
                        {group.hasVariations && group.lowestPrice !== group.highestPrice ? (
                          <span className="text-lg font-bold text-gray-900">
                            ৳{group.lowestPrice.toFixed(2)} - ৳{group.highestPrice.toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-lg font-bold text-gray-900">
                            ৳{Number(firstVariant.selling_price).toFixed(2)}
                          </span>
                        )}

                      </div>

                      <span className={`text-xs font-medium ${
                        Number(firstVariant.stock_quantity || 0) > 0
                          ? 'text-green-600'
                          : group.variants.slice(1).some((v) => Number(v.stock_quantity || 0) > 0)
                          ? 'text-amber-700'
                          : 'text-red-600'
                      }`}>
                        {Number(firstVariant.stock_quantity || 0) > 0
                          ? 'In Stock'
                          : group.variants.slice(1).some((v) => Number(v.stock_quantity || 0) > 0)
                          ? 'Available in other variants'
                          : 'Out of Stock'}
                      </span>
                    </div>
                    {/* View Details Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        // Find first variant that's in stock, or fall back to first variant
                        const availableVariant = group.variants.find(v => v.in_stock) || firstVariant;
                        handleProductClick(availableVariant.id);
                      }}
                      disabled={group.variants.every(v => !v.in_stock)}
                      className={`w-full text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors duration-200 ${
                        group.variants.every(v => !v.in_stock)
                          ? 'bg-gray-400 cursor-not-allowed'
                          : 'bg-red-800 hover:bg-red-900'
                      }`}
                    >
                      {group.variants.every(v => !v.in_stock) ? 'Out of Stock' : 'Go To Product Details'}
                    </button>
                  </div>
                      </div>
                    );
                  })}
                </div>

                {/* Pagination */}
                {pagination && pagination.last_page > 1 && (
                  <div className="mt-12 flex justify-center">
                    <nav className="flex items-center space-x-2">
                      <button
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage === 1}
                        className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Previous
                      </button>

                      {Array.from({ length: Math.min(pagination.last_page, 5) }, (_, i) => {
                        let page;
                        if (pagination.last_page <= 5) {
                          page = i + 1;
                        } else if (currentPage <= 3) {
                          page = i + 1;
                        } else if (currentPage >= pagination.last_page - 2) {
                          page = pagination.last_page - 4 + i;
                        } else {
                          page = currentPage - 2 + i;
                        }
                        
                        return (
                          <button
                            key={page}
                            onClick={() => handlePageChange(page)}
                            className={`px-4 py-2 border rounded-md text-sm font-medium ${
                              currentPage === page
                                ? 'bg-red-800 text-white border-red-1000'
                                : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                            }`}
                          >
                            {page}
                          </button>
                        );
                      })}

                      <button
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={currentPage === pagination.last_page}
                        className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Next
                      </button>
                    </nav>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}