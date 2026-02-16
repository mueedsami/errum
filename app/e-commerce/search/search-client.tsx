'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search as SearchIcon, Loader2, AlertCircle } from 'lucide-react';

import Navigation from '@/components/ecommerce/Navigation';
import Footer from '@/components/ecommerce/Footer';
import catalogService from '@/services/catalogService';
import { adaptCatalogGroupedProducts, formatGroupedPrice, groupProductsByMother } from '@/lib/ecommerceProductGrouping';

type SearchProduct = {
  id: number;
  name: string;
  sku: string;
  selling_price: number;
  images: { url: string; is_primary?: boolean }[];
  in_stock?: boolean;
  base_name?: string;
  category?: { id: number; name: string } | string | null;
};

export default function SearchClient({ initialQuery }: { initialQuery: string }) {
  const router = useRouter();

  const [query, setQuery] = useState(initialQuery || '');
  const [submittedQuery, setSubmittedQuery] = useState(initialQuery || '');
  const [products, setProducts] = useState<SearchProduct[]>([]);
  const [apiGroupedProducts, setApiGroupedProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const groupedProducts = useMemo(
    () => (apiGroupedProducts.length > 0
      ? adaptCatalogGroupedProducts(apiGroupedProducts as any)
      : groupProductsByMother(products as any)),
    [apiGroupedProducts, products]
  );

  useEffect(() => {
    const q = (initialQuery || '').trim();
    if (!q) return;

    (async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await catalogService.searchProducts({ q, per_page: 60, page: 1 });
        setApiGroupedProducts(data.grouped_products || []);
        setProducts((data.products || []) as SearchProduct[]);
      } catch (err: any) {
        console.error('Search failed:', err);
        setError('Failed to search products. Please try again.');
      } finally {
        setLoading(false);
      }
    })();
  }, [initialQuery]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;

    router.replace(`/e-commerce/search?q=${encodeURIComponent(q)}`);
    setSubmittedQuery(q);

    try {
      setLoading(true);
      setError(null);
      const data = await catalogService.searchProducts({ q, per_page: 60, page: 1 });
      setApiGroupedProducts(data.grouped_products || []);
      setProducts((data.products || []) as SearchProduct[]);
    } catch (err: any) {
      console.error('Search failed:', err);
      setError('Failed to search products. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Search</h1>
          <p className="text-gray-600 mt-1">Find products quickly</p>
        </div>

        <form onSubmit={onSubmit} className="mb-8">
          <div className="relative max-w-3xl">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search products..."
              className="w-full rounded-xl border border-gray-300 bg-white py-3 pl-12 pr-28 text-sm outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
            />
            <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <button
              type="submit"
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-red-700 hover:bg-red-800 text-white text-sm font-medium px-4 py-2 rounded-lg"
            >
              Search
            </button>
          </div>
        </form>

        {submittedQuery && !loading && !error && (
          <p className="text-sm text-gray-600 mb-4">
            Results for <span className="font-medium text-gray-900">“{submittedQuery}”</span> — {groupedProducts.length}{' '}
            grouped product{groupedProducts.length === 1 ? '' : 's'}
          </p>
        )}

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        {loading ? (
          <div className="text-center py-20">
            <Loader2 className="animate-spin h-10 w-10 text-red-700 mx-auto mb-3" />
            <p className="text-gray-600">Searching products...</p>
          </div>
        ) : groupedProducts.length === 0 ? (
          <div className="text-center py-20 text-gray-600">No products found.</div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {groupedProducts.map((group) => {
              const mainVariant = group.variants[0];
              if (!mainVariant) return null;

              const mainStock = Number(mainVariant.stock_quantity || 0);
              const hasOtherStock = group.variants.slice(1).some((variant) => Number(variant.stock_quantity || 0) > 0);
              const stockLabel = mainStock > 0 ? 'In Stock' : hasOtherStock ? 'Available in other variants' : 'Out of Stock';
              const stockClass =
                stockLabel === 'In Stock'
                  ? 'bg-green-100 text-green-700'
                  : stockLabel === 'Available in other variants'
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-red-100 text-red-700';

              return (
                <Link
                  key={group.key}
                  href={`/e-commerce/product/${mainVariant.id}`}
                  className="bg-white rounded-xl border hover:border-red-200 hover:shadow-sm transition overflow-hidden"
                >
                  <div className="aspect-square bg-gray-100 relative">
                    {group.primaryImage ? (
                      <img
                        src={group.primaryImage}
                        alt={group.baseName}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.src = '/placeholder-product.png';
                        }}
                      />
                    ) : (
                      <div className="w-full h-full bg-gray-200" />
                    )}

                    {group.totalVariants > 1 && (
                      <span className="absolute top-2 left-2 bg-purple-100 text-purple-700 text-xs font-medium px-2 py-1 rounded-full">
                        +{group.totalVariants - 1} variants available
                      </span>
                    )}

                    <span className={`absolute top-2 right-2 text-xs font-medium px-2 py-1 rounded-full ${stockClass}`}>
                      {stockLabel}
                    </span>
                  </div>
                  <div className="p-3">
                    <div className="text-sm font-medium text-gray-900 line-clamp-2">{group.baseName}</div>
                    <div className="mt-1 text-red-700 font-semibold">{formatGroupedPrice(group)}</div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
}
