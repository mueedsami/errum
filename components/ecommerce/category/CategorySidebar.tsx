'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { ChevronRight, ChevronDown } from 'lucide-react';
import { CatalogCategory } from '@/services/catalogService';

interface CategorySidebarProps {
  categories: CatalogCategory[];
  expandedCategories: Set<number>;
  onToggleCategory: (categoryId: number) => void;
  activeCategoryName: string;
}

const slugify = (value: string): string =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');

const toCategoryPath = (cat: CatalogCategory): string => {
  const slug = cat.slug ? String(cat.slug).trim() : slugify(cat.name || '');
  return `/e-commerce/${encodeURIComponent(slug)}`;
};

export default function CategorySidebar({ 
  categories, 
  expandedCategories, 
  onToggleCategory, 
  activeCategoryName 
}: CategorySidebarProps) {
  const router = useRouter();

  const renderCategoryTree = (cats: CatalogCategory[], level: number = 0) => {
    return cats.map((cat) => {
      const hasSubcategories = cat.children && cat.children.length > 0;
      const isExpanded = expandedCategories.has(cat.id);
      const isActive = slugify(activeCategoryName) === slugify(cat.slug || cat.name || '');

      return (
        <div key={cat.id}>
          <div
            className={`flex items-center justify-between py-2.5 px-3 cursor-pointer transition-colors ${
              isActive ? 'text-red-700 font-semibold bg-red-50' : 'text-gray-700 hover:text-gray-900 hover:bg-gray-50'
            }`}
            style={{ paddingLeft: `${level * 20 + 12}px` }}
            onClick={() => {
              if (hasSubcategories) {
                onToggleCategory(cat.id);
              } else {
                router.push(toCategoryPath(cat));
              }
            }}
          >
            <span className="flex-1">
              {cat.name}
              {cat.product_count > 0 && (
                <span className="ml-2 text-xs text-gray-500">
                  ({cat.product_count})
                </span>
              )}
            </span>
            <div className="flex items-center gap-2">
              {hasSubcategories && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleCategory(cat.id);
                  }}
                  className="p-0.5 hover:bg-gray-200 rounded"
                >
                  {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>
              )}
            </div>
          </div>
          {hasSubcategories && isExpanded && (
            <div>{renderCategoryTree(cat.children!, level + 1)}</div>
          )}
        </div>
      );
    });
  };

  return (
    <aside className="w-64 flex-shrink-0 hidden lg:block">
      <div className="bg-white border border-gray-200 rounded-lg sticky top-4">
        <div className="p-6 border-b">
          <h3 className="text-lg font-bold text-gray-900">PRODUCT CATEGORIES</h3>
        </div>
        <div className="p-4 max-h-[600px] overflow-y-auto">
          {categories.length > 0 ? (
            renderCategoryTree(categories)
          ) : (
            <p className="text-sm text-gray-500 text-center py-4">
              No categories available
            </p>
          )}
        </div>
      </div>
    </aside>
  );
}