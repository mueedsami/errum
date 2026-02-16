import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import Header from '@/components/ecommerce/Header';
import Footer from '@/components/ecommerce/Footer';
import SearchClient from './search-client';
import catalogService from '@/services/catalogService';
import { buildCardProductsFromResponse } from '@/lib/ecommerceCardUtils';

interface SearchPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams;
  const query = (params.q as string) || '';

  if (!query.trim()) {
    return notFound();
  }

  let initialProducts = [];
  let totalResults = 0;
  let error = '';

  try {
    const response = await catalogService.getProducts({
      search: query,
      per_page: 24,
      page: 1,
    });

    initialProducts = buildCardProductsFromResponse(response);
    totalResults = response.pagination.total;
  } catch (err) {
    console.error('Search error:', err);
    error = 'Failed to search products. Please try again.';
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <Suspense fallback={<SearchLoadingSkeleton />}>
        <SearchClient
          initialQuery={query}
          initialProducts={initialProducts}
          initialTotal={totalResults}
          initialError={error}
        />
      </Suspense>

      <Footer />
    </div>
  );
}

function SearchLoadingSkeleton() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-1/3 mb-8" />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="bg-white rounded-lg shadow-sm p-4">
              <div className="aspect-square bg-gray-200 rounded-lg mb-4" />
              <div className="h-4 bg-gray-200 rounded mb-2" />
              <div className="h-4 bg-gray-200 rounded w-2/3 mb-2" />
              <div className="h-6 bg-gray-200 rounded w-1/2" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
