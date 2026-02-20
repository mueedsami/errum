'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import catalogService, { CatalogCategory } from '@/services/catalogService';
import SectionHeader from '@/components/ecommerce/ui/SectionHeader';

interface OurCategoriesProps {
  categories?: CatalogCategory[];
  loading?: boolean;
}

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');

const flattenPreferred = (items: CatalogCategory[]): CatalogCategory[] => {
  const out: CatalogCategory[] = [];
  const seen = new Set<number>();

  items.forEach((cat) => {
    const children = Array.isArray(cat.children) ? cat.children : [];
    if (children.length > 0) {
      children.forEach((child) => {
        if (!seen.has(child.id)) {
          seen.add(child.id);
          out.push(child);
        }
      });
    } else if (!seen.has(cat.id)) {
      seen.add(cat.id);
      out.push(cat);
    }
  });

  // fallback in case tree is shallow/unexpected
  items.forEach((cat) => {
    if (!seen.has(cat.id)) {
      seen.add(cat.id);
      out.push(cat);
    }
  });

  return out;
};

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');

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
    if (categoriesProp && Array.isArray(categoriesProp)) return;
    let active = true;

    const fetchCategories = async () => {
      try {
        setIsFetching(true);
        const data = await catalogService.getCategories();
        if (active) setCategories(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error('Failed to load categories for home section:', error);
        if (active) setCategories([]);
      } finally {
        if (active) setIsFetching(false);
      }
    };

    fetchCategories();
    return () => {
      active = false;
    };
  }, [categoriesProp]);

  const displayCategories = flattenPreferred(categories || [])
    .filter((c) => Boolean(c?.name))
    .slice(0, 10);

  if (loading || isFetching) {
    return (
      <section className="ec-section">
        <div className="ec-container">
          <div className="ec-surface p-4 sm:p-6">
            <div className="h-3 w-32 rounded bg-neutral-200" />
            <div className="mt-3 h-8 w-56 rounded bg-neutral-200" />
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="rounded-2xl border border-neutral-200 bg-white p-3 animate-pulse">
                  <div className="mx-auto h-14 w-14 rounded-full bg-neutral-100" />
                  <div className="mt-3 h-3 rounded bg-neutral-100" />
                  <div className="mt-2 h-3 w-2/3 rounded bg-neutral-100" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (displayCategories.length === 0) return null;

  return (
    <section className="ec-section">
      <div className="ec-container">
        <div className="ec-surface p-4 sm:p-6 lg:p-7">
          <SectionHeader
            eyebrow="Discover categories"
            title="Shop by Category"
            subtitle="Clean entry points for the most active product groups"
            actionLabel="View all"
            onAction={() => router.push('/e-commerce/categories')}
          />

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {displayCategories.map((cat) => {
              const imageSrc = cat.image || cat.image_url || '';
              const hasImage = Boolean(imageSrc);
              return (
                <button
                  key={cat.id}
                  onClick={() => router.push(`/e-commerce/${encodeURIComponent(cat.slug || slugify(cat.name))}`)}
                  className="ec-card ec-card-hover group flex flex-col items-center rounded-2xl p-3 text-center"
                  type="button"
                >
                  <div className="relative h-14 w-14 overflow-hidden rounded-full border border-neutral-200 bg-neutral-50">
                    {hasImage ? (
                      <Image src={imageSrc} alt={cat.name} fill className="object-cover transition-transform duration-300 group-hover:scale-110" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-neutral-100 to-amber-50 text-sm font-semibold text-neutral-700">
                        {initials(cat.name) || 'EC'}
                      </div>
                    )}
                  </div>

                  <p className="mt-3 line-clamp-2 min-h-[2.25rem] text-sm font-semibold text-neutral-900">{cat.name}</p>
                  <div className="mt-1 flex items-center gap-2 text-[11px] text-neutral-500">
                    <span>{Number(cat.product_count || 0)} items</span>
                    <span className="text-neutral-400">•</span>
                    <span className="group-hover:text-neutral-800">Explore</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};

export default OurCategories;
