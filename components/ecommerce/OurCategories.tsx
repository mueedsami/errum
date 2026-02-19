'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import catalogService, { CatalogCategory } from '@/services/catalogService';

interface OurCategoriesProps {
  categories?: CatalogCategory[];
  loading?: boolean;
}

const categoryIcons = [
  '👚', '👕', '👖', '👗', '🧥', '👔', '👟', '👠',
  '👜', '🎒', '💍', '⌚', '🕶️', '👒', '🧢', '🧣'
];

const defaultColors = [
  'from-pink-100 to-rose-100',
  'from-blue-100 to-cyan-100',
  'from-green-100 to-emerald-100',
  'from-purple-100 to-violet-100',
  'from-yellow-100 to-amber-100',
  'from-indigo-100 to-blue-100',
  'from-red-100 to-pink-100',
  'from-orange-100 to-red-100'
];

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');

const OurCategories: React.FC<OurCategoriesProps> = ({ categories: categoriesProp, loading = false }) => {
  const router = useRouter();
  const [categories, setCategories] = React.useState<CatalogCategory[]>(categoriesProp || []);
  const [isFetching, setIsFetching] = React.useState<boolean>(!categoriesProp);

  React.useEffect(() => {
    if (categoriesProp && Array.isArray(categoriesProp)) {
      setCategories(categoriesProp);
      setIsFetching(false);
    }
  }, [categoriesProp]);

  React.useEffect(() => {
    // If categories are passed from parent, don't fetch again.
    if (categoriesProp && Array.isArray(categoriesProp)) return;

    let active = true;

    const fetchCategories = async () => {
      try {
        setIsFetching(true);
        const data = await catalogService.getCategories();
        if (active) {
          setCategories(Array.isArray(data) ? data : []);
        }
      } catch (error) {
        console.error('Failed to load categories for home section:', error);
        if (active) {
          setCategories([]);
        }
      } finally {
        if (active) {
          setIsFetching(false);
        }
      }
    };

    fetchCategories();

    return () => {
      active = false;
    };
  }, [categoriesProp]);

  const displayCategories = (categories || []).slice(0, 8);

  if (loading || isFetching) {
    return (
      <section className="py-8 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Our Categories</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="bg-white rounded-lg p-4 animate-pulse">
                <div className="w-12 h-12 bg-gray-200 rounded-full mx-auto mb-3"></div>
                <div className="h-4 bg-gray-200 rounded mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-2/3 mx-auto"></div>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (displayCategories.length === 0) {
    return null;
  }

  return (
    <section className="py-8 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Our Categories</h2>
          <button
            onClick={() => router.push('/e-commerce/categories')}
            className="text-neutral-900 hover:text-neutral-900 font-medium text-sm"
          >
            View All →
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
          {displayCategories.map((cat, index) => {
            const hasImage = Boolean(cat.image || cat.image_url);
            const imageSrc = cat.image || cat.image_url || '';
            const icon = cat.icon || categoryIcons[index % categoryIcons.length];
            const colorClass = cat.color || defaultColors[index % defaultColors.length];

            return (
              <div
                key={cat.id}
                onClick={() => router.push(`/e-commerce/${encodeURIComponent(cat.slug || slugify(cat.name))}`)}
                className="group cursor-pointer"
              >
                <div className="bg-white rounded-lg p-4 text-center hover:shadow-md transition-all duration-300 border border-gray-100 group-hover:border-red-200">
                  <div className="mb-3">
                    {hasImage ? (
                      <div className="w-12 h-12 mx-auto relative rounded-full overflow-hidden bg-gray-100">
                        <Image
                          src={imageSrc}
                          alt={cat.name}
                          fill
                          className="object-cover group-hover:scale-110 transition-transform duration-300"
                        />
                      </div>
                    ) : (
                      <div className={`w-12 h-12 mx-auto rounded-full bg-gradient-to-br ${colorClass} flex items-center justify-center text-xl group-hover:scale-110 transition-transform duration-300`}>
                        {icon}
                      </div>
                    )}
                  </div>

                  <h3 className="font-medium text-sm text-gray-900 group-hover:text-neutral-900 transition-colors line-clamp-2 mb-1">
                    {cat.name}
                  </h3>

                  {cat.product_count !== undefined && (
                    <p className="text-xs text-gray-500">
                      {cat.product_count} items
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default OurCategories;
