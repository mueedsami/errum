import { GroupedProduct, ProductResponse, SimpleProduct } from '@/services/catalogService';

const toNumber = (value: unknown): number => {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

const toUnixMs = (value: unknown): number => {
  if (!value) return 0;
  const ms = Date.parse(String(value));
  return Number.isFinite(ms) ? ms : 0;
};

export const getCardNewestSortKey = (product: SimpleProduct): number => {
  const variants = getVariantListForCard(product);
  let newestTime = 0;
  let newestId = 0;

  variants.forEach((item) => {
    newestId = Math.max(newestId, toNumber((item as any)?.id));
    newestTime = Math.max(
      newestTime,
      toUnixMs((item as any)?.created_at),
      toUnixMs((item as any)?.updated_at),
    );
  });

  // Timestamp drives order. ID is a tiebreaker for records without dates.
  return newestTime > 0 ? newestTime * 100000 + newestId : newestId;
};


const dedupeVariants = (variants: SimpleProduct[]): SimpleProduct[] => {
  const seen = new Set<string>();
  const list: SimpleProduct[] = [];

  variants.forEach((variant) => {
    const key = variant.id
      ? `id:${variant.id}`
      : variant.sku
        ? `sku:${variant.sku}`
        : `${variant.name}|${variant.base_name || ''}`;

    if (seen.has(key)) return;
    seen.add(key);
    list.push(variant);
  });

  return list;
};

const groupToCardProduct = (group: GroupedProduct): SimpleProduct => {
  const rawVariants = [group.main_variant, ...(group.variants || [])].filter(Boolean) as SimpleProduct[];
  const allVariants = dedupeVariants(rawVariants);
  const main = group.main_variant || allVariants[0];

  if (!main) {
    return {
      id: 0,
      name: group.base_name || 'Product',
      display_name: group.base_name || 'Product',
      base_name: group.base_name || undefined,
      variation_suffix: '',
      sku: '',
      selling_price: 0,
      stock_quantity: 0,
      description: group.description || '',
      images: [],
      category: group.category,
      in_stock: false,
      has_variants: false,
      total_variants: 1,
      variants: [],
    };
  }

  return {
    ...main,
    name: group.base_name || main.base_name || main.display_name || main.name,
    display_name: group.base_name || main.display_name || main.base_name || main.name,
    base_name: group.base_name || main.base_name || main.display_name || main.name,
    description: group.description ?? main.description,
    category: group.category || main.category,
    has_variants: Boolean(group.has_variants || allVariants.length > 1),
    total_variants: allVariants.length,
    variants: allVariants,
  };
};

/**
 * Returns one card product per base product (main variant + attached variant list).
 * This prevents duplicate cards when the API returns grouped catalog payloads.
 */
export const buildCardProductsFromResponse = (response: ProductResponse): SimpleProduct[] => {
  const grouped =
    (Array.isArray((response as any)?.grouped_products)
      ? ((response as any).grouped_products as GroupedProduct[])
      : null) ||
    (Array.isArray((response as any)?.groupedProducts)
      ? ((response as any).groupedProducts as GroupedProduct[])
      : []);

  if (grouped.length > 0) {
    return grouped.map(groupToCardProduct);
  }

  const flat = Array.isArray(response?.products) ? response.products : [];
  return dedupeVariants(flat as SimpleProduct[]);
};

export const getVariantListForCard = (product: SimpleProduct): SimpleProduct[] => {
  const variants = Array.isArray(product.variants) ? product.variants : [];

  // Ensure the visible/main card product is included for unified stock/price logic.
  const combined = [product, ...variants].filter(Boolean) as SimpleProduct[];
  return dedupeVariants(combined);
};

export const getAdditionalVariantCount = (product: SimpleProduct): number => {
  const all = getVariantListForCard(product);
  return Math.max(0, all.length - 1);
};

export const getCardStockLabel = (product: SimpleProduct): string => {
  const mainStock = Number(product.stock_quantity || 0);
  if (mainStock > 0) return 'In Stock';

  const allVariants = getVariantListForCard(product);
  const hasOtherStock = allVariants.some((variant) => {
    if (variant.id && product.id && variant.id === product.id) return false;
    return Number(variant.stock_quantity || 0) > 0;
  });

  if (hasOtherStock) return 'Available in other variants';
  return 'Out of Stock';
};

export const getCardPriceText = (product: SimpleProduct): string => {
  const variants = getVariantListForCard(product);
  const prices = variants
    .map((item) => toNumber(item.selling_price))
    .filter((price) => price > 0);

  if (prices.length === 0) {
    const fallback = toNumber(product.selling_price);
    return `৳${fallback.toLocaleString()}`;
  }

  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);

  if (minPrice === maxPrice) {
    return `৳${minPrice.toLocaleString()}`;
  }

  return `৳${minPrice.toLocaleString()} - ৳${maxPrice.toLocaleString()}`;
};
