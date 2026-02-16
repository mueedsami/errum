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
      const isActive = activeCategoryName === cat.name;

      return (
        <div key={cat.id}>
          <button
            type="button"
            onClick={() => {
              if (hasSubcategories) {
                onToggleCategory(cat.id);
                return;
              }

              router.push(`/e-commerce/${encodeURIComponent(cat.name)}`);
            }}
            className={`w-full flex items-center justify-between py-2.5 px-3 cursor-pointer transition-colors text-left ${
              isActive ? 'text-red-700 font-semibold bg-red-50' : 'text-gray-700 hover:text-gray-900 hover:bg-gray-50'
            }`}
            style={{ paddingLeft: `${level * 20 + 12}px` }}
            aria-expanded={hasSubcategories ? isExpanded : undefined}
            aria-label={hasSubcategories ? `${cat.name} category` : undefined}
          >
            <span className="flex-1">
              {cat.name}
              {cat.product_count > 0 && (
                <span className="ml-2 text-xs text-gray-500">
                  ({cat.product_count})
                </span>
              )}
            </span>
            {hasSubcategories && (
              <span className="p-0.5 rounded" aria-hidden="true">
                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </span>
            )}
          </button>
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