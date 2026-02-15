import { getBaseProductName, getColorLabel, getSizeLabel } from '@/lib/productNameUtils';

export interface GroupedVariant {
  id: number;
  name: string;
  sku?: string;
  color?: string;
  size?: string;
  price: number;
  in_stock: boolean;
  stock_quantity: number;
  image: string;
  raw: any;
}

export interface GroupedProduct {
  key: string;
  baseName: string;
  representativeId: number;
  primaryImage: string;
  variants: GroupedVariant[];
  totalVariants: number;
  hasVariations: boolean;
  lowestPrice: number;
  highestPrice: number;
  inStock: boolean;
  totalStock: number;
  category?: { id: number; name: string } | null;
  representative: any;
}

const toNumber = (value: any): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

export function getProductPrimaryImage(product: any): string {
  const images = Array.isArray(product?.images) ? product.images : [];
  const primary = images.find((img: any) => !!img?.is_primary) || images[0];
  return primary?.url || '/placeholder-product.png';
}

export function getMotherBaseName(product: any): string {
  return getBaseProductName(product?.name || '', product?.base_name || undefined);
}

export function getMotherGroupKey(product: any): string {
  const baseName = getMotherBaseName(product).toLowerCase();
  const categoryId = product?.category?.id ?? '0';
  return `${categoryId}::${baseName}`;
}

export function groupProductsByMother(products: any[]): GroupedProduct[] {
  const groups = new Map<string, GroupedProduct>();

  (products || []).forEach((product: any) => {
    if (!product || typeof product !== 'object') return;

    const baseName = getMotherBaseName(product);
    const key = getMotherGroupKey(product);

    if (!groups.has(key)) {
      groups.set(key, {
        key,
        baseName,
        representativeId: product.id,
        primaryImage: getProductPrimaryImage(product),
        variants: [],
        totalVariants: 0,
        hasVariations: false,
        lowestPrice: toNumber(product?.selling_price),
        highestPrice: toNumber(product?.selling_price),
        inStock: !!product?.in_stock,
        totalStock: toNumber(product?.stock_quantity),
        category: product?.category || null,
        representative: product,
      });
    }

    const group = groups.get(key)!;

    const price = toNumber(product?.selling_price);
    const stockQty = toNumber(product?.stock_quantity);

    group.variants.push({
      id: Number(product.id),
      name: product.name || '',
      sku: product.sku,
      color: getColorLabel(product.name || ''),
      size: getSizeLabel(product.name || ''),
      price,
      in_stock: !!product.in_stock,
      stock_quantity: stockQty,
      image: getProductPrimaryImage(product),
      raw: product,
    });

    group.lowestPrice = Math.min(group.lowestPrice, price);
    group.highestPrice = Math.max(group.highestPrice, price);
    group.totalStock += stockQty;
    group.inStock = group.inStock || !!product.in_stock;

    // Prefer in-stock representative for navigation and thumbnail
    if (product?.in_stock && !group.representative?.in_stock) {
      group.representative = product;
      group.representativeId = Number(product.id);
      group.primaryImage = getProductPrimaryImage(product);
    }
  });

  return Array.from(groups.values()).map((group) => {
    const uniqueById = new Map<number, GroupedVariant>();
    group.variants.forEach((v) => {
      if (!uniqueById.has(v.id)) uniqueById.set(v.id, v);
    });

    const variants = Array.from(uniqueById.values()).sort((a, b) => {
      if (a.in_stock !== b.in_stock) return a.in_stock ? -1 : 1;

      const ac = (a.color || '').toLowerCase();
      const bc = (b.color || '').toLowerCase();
      if (ac !== bc) return ac.localeCompare(bc);

      const as = (a.size || '').toLowerCase();
      const bs = (b.size || '').toLowerCase();
      if (as !== bs) return as.localeCompare(bs);

      return a.id - b.id;
    });

    const representative = variants.find((v) => v.in_stock) || variants[0];

    return {
      ...group,
      variants,
      totalVariants: variants.length,
      hasVariations: variants.length > 1,
      representativeId: representative?.id || group.representativeId,
      primaryImage: representative?.image || group.primaryImage,
    };
  });
}

export function formatGroupedPrice(group: GroupedProduct): string {
  if (group.totalVariants > 1 && group.lowestPrice !== group.highestPrice) {
    return `৳${group.lowestPrice.toFixed(2)} - ৳${group.highestPrice.toFixed(2)}`;
  }
  const price = Number.isFinite(group.lowestPrice) ? group.lowestPrice : 0;
  return `৳${price.toFixed(2)}`;
}
