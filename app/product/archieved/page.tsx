'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Edit,
  Trash2,
  Archive,
  RotateCcw,
  Package,
  Tag,
  Calendar,
  User,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

import Header from '@/components/Header';
import Sidebar from '@/components/Sidebar';
import Toast from '@/components/Toast';
import { productService, Product } from '@/services/productService';

const ERROR_IMG_SRC =
  'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODgiIGhlaWdodD0iODgiIHZpZXdCb3g9IjAgMCA4OCA4OCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSIjZGRkIj48Y2lyY2xlIGN4PSI0NCIgY3k9IjQ0IiByPSI0MCIvPjxwYXRoIGQ9Ik00NCAyNGEyMCAyMCAwIDEgMCAwIDQwIDIwIDIwIDAgMCAwIDAtNDB6bTAgNmE0IDE0IDAgMSAxIDAgMjggMTQgMTQgMCAwIDEgMC0yOHptLTEgMTNoMnYxOGgtMnoiLz48Y2lyY2xlIGN4PSIzNSIgY3k9IjM1IiByPSI3Ii8+PGNpcmNsZSBjeD0iNTMiIGN5PSIzNSIgcj0iNyIvPjwvZz48L3N2Zz4=';

interface ProductDetailPageProps {
  params: { id: string };
}

export default function ProductDetailPage({ params }: ProductDetailPageProps) {
  const router = useRouter();
  const productId = params.id;

  const [darkMode, setDarkMode] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number>(0);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
  };

  const fetchProduct = async () => {
    setLoading(true);
    try {
      const data = await productService.getById(productId);
      setProduct(data);
      setSelectedImageIndex(0);
    } catch (error) {
      console.error('Failed to load product:', error);
      showToast('Failed to load product', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProduct();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  const handleBack = () => {
    router.push('/product/list');
  };

  const handleEdit = () => {
    router.push(`/product/add?id=${productId}`);
  };

  const handleDelete = async () => {
    if (!product) return;

    if (!confirm(`Delete "${product.name}"? This action cannot be undone.`)) return;

    try {
      await productService.delete(productId);
      showToast('Product deleted successfully', 'success');
      setTimeout(() => router.push('/product/list'), 1000);
    } catch (error) {
      console.error('Failed to delete product:', error);
      showToast('Failed to delete product', 'error');
    }
  };

  // 🔁 Archive <-> Restore toggle
  const handleToggleArchive = async () => {
    if (!product) return;

    const isArchived = product.is_archived;
    const action = isArchived ? 'restore' : 'archive';

    const confirmMessage = isArchived
      ? `Restore "${product.name}" and show it again in the product list?`
      : `Archive "${product.name}"? You can restore it later from archived products.`;

    if (!confirm(confirmMessage)) return;

    try {
      if (isArchived) {
        await productService.restore(productId);
        showToast('Product restored successfully', 'success');
      } else {
        await productService.archive(productId);
        showToast('Product archived successfully', 'success');
      }

      // Refresh product data so button & badge update
      await fetchProduct();
    } catch (error) {
      console.error(`Failed to ${action} product:`, error);
      showToast(`Failed to ${action} product`, 'error');
    }
  };

  const getImageUrl = (imagePath?: string | null) => {
    if (!imagePath) return ERROR_IMG_SRC;
    if (imagePath.startsWith('http')) return imagePath;
    const baseUrl = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || '';
    return `${baseUrl}/storage/${imagePath}`;
  };

  const images = product?.images || [];
  const activeImages = images.filter((img) => img.is_active);
  const displayImages = activeImages.length > 0 ? activeImages : images;
  const selectedImage = displayImages[selectedImageIndex];

  const nextImage = () => {
    if (displayImages.length === 0) return;
    setSelectedImageIndex((prev) => (prev + 1) % displayImages.length);
  };

  const prevImage = () => {
    if (displayImages.length === 0) return;
    setSelectedImageIndex((prev) => (prev - 1 + displayImages.length) % displayImages.length);
  };

  if (loading) {
    return (
      <div className={darkMode ? 'dark' : ''}>
        <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
          <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />
          <div className="flex-1 flex flex-col">
            <Header
              darkMode={darkMode}
              setDarkMode={setDarkMode}
              toggleSidebar={() => setSidebarOpen(!sidebarOpen)}
            />
            <main className="flex-1 flex items-center justify-center">
              <p className="text-gray-600 dark:text-gray-300">Loading product...</p>
            </main>
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className={darkMode ? 'dark' : ''}>
        <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
          <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />
          <div className="flex-1 flex flex-col">
            <Header
              darkMode={darkMode}
              setDarkMode={setDarkMode}
              toggleSidebar={() => setSidebarOpen(!sidebarOpen)}
            />
            <main className="flex-1 flex items-center justify-center">
              <p className="text-gray-600 dark:text-gray-300">Product not found.</p>
            </main>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={darkMode ? 'dark' : ''}>
      <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
        <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />

        <div className="flex-1 flex flex-col overflow-hidden">
          <Header
            darkMode={darkMode}
            setDarkMode={setDarkMode}
            toggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          />

          <main className="flex-1 overflow-y-auto p-6">
            <div className="max-w-6xl mx-auto">
              {/* Top bar */}
              <div className="flex items-center justify-between mb-6">
                <button
                  onClick={handleBack}
                  className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to Product List
                </button>

                <div className="flex items-center gap-3">
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                      product.is_archived
                        ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                        : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                    }`}
                  >
                    <Package className="w-3 h-3" />
                    {product.is_archived ? 'Archived' : 'Active'}
                  </span>

                  <button
                    onClick={handleEdit}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gray-900 text-white dark:bg-white dark:text-gray-900 hover:opacity-90 transition-colors font-medium shadow-sm"
                  >
                    <Edit className="w-4 h-4" />
                    Edit
                  </button>

                  {product.is_archived ? (
                    <button
                      onClick={handleToggleArchive}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors font-medium shadow-sm"
                    >
                      <RotateCcw className="w-4 h-4" />
                      Restore
                    </button>
                  ) : (
                    <button
                      onClick={handleToggleArchive}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-yellow-500 text-white hover:bg-yellow-600 transition-colors font-medium shadow-sm"
                    >
                      <Archive className="w-4 h-4" />
                      Archive
                    </button>
                  )}

                  <button
                    onClick={handleDelete}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors font-medium shadow-sm"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Image / Gallery */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 flex flex-col">
                  <div className="relative w-full aspect-[4/3] rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-900 flex items-center justify-center">
                    <img
                      src={getImageUrl(selectedImage?.image_path)}
                      alt={product.name}
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = ERROR_IMG_SRC;
                      }}
                      className="w-full h-full object-contain"
                    />

                    {displayImages.length > 1 && (
                      <>
                        <button
                          type="button"
                          onClick={prevImage}
                          className="absolute left-3 top-1/2 -translate-y-1/2 inline-flex items-center justify-center p-2 rounded-full bg-white/80 dark:bg-gray-900/80 shadow hover:bg-white dark:hover:bg-gray-900"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={nextImage}
                          className="absolute right-3 top-1/2 -translate-y-1/2 inline-flex items-center justify-center p-2 rounded-full bg-white/80 dark:bg-gray-900/80 shadow hover:bg-white dark:hover:bg-gray-900"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>

                  {displayImages.length > 1 && (
                    <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
                      {displayImages.map((img, index) => (
                        <button
                          key={img.id || index}
                          type="button"
                          onClick={() => setSelectedImageIndex(index)}
                          className={`h-16 w-16 flex-shrink-0 rounded-md overflow-hidden border ${
                            index === selectedImageIndex
                              ? 'border-gray-900 dark:border-white'
                              : 'border-gray-200 dark:border-gray-700'
                          }`}
                        >
                          <img
                            src={getImageUrl(img.image_path)}
                            alt={`Thumbnail ${index + 1}`}
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = ERROR_IMG_SRC;
                            }}
                            className="w-full h-full object-cover"
                          />
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Details */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 flex flex-col gap-4">
                  <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                      {product.name}
                    </h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">SKU: {product.sku}</p>
                  </div>

                  {product.description && (
                    <div>
                      <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                        Description
                      </h2>
                      <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line">
                        {product.description}
                      </p>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                        <Tag className="w-4 h-4 text-gray-400" />
                        <span>Category ID: {product.category_id}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                        <User className="w-4 h-4 text-gray-400" />
                        <span>Vendor ID: {product.vendor_id}</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        <span>Created At: {product.created_at || 'N/A'}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        <span>Updated At: {product.updated_at || 'N/A'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Custom Fields */}
                  {product.custom_fields && product.custom_fields.length > 0 && (
  <div>
    <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
      Custom Fields
    </h2>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {(product.custom_fields as any[]).map((field: any, index: number) => {
        // Try to guess key, label and value from different possible shapes
        const key =
          field.id ??
          field.field_id ??
          field.custom_field_id ??
          index;

        const label =
          field.label ??
          field.name ??
          field.field_name ??
          field.title ??
          field?.field?.label ??
          field?.field?.name ??
          `Field ${index + 1}`;

        const rawValue =
          field.value ??
          field.field_value ??
          field.data ??
          field.answer ??
          field?.field?.value;

        const displayValue = Array.isArray(rawValue)
          ? rawValue.join(', ')
          : rawValue === null || rawValue === undefined || rawValue === ''
          ? '—'
          : String(rawValue);

        return (
          <div
            key={key}
            className="border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2"
          >
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">
              {label}
            </p>
            <p className="text-sm text-gray-900 dark:text-gray-100">
              {displayValue}
            </p>
          </div>
        );
      })}
    </div>
  </div>
)}

                  {/* Variants */}
                  {product.variants && product.variants.length > 0 && (
                    <div>
                      <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                        Variants
                      </h2>
                      <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                        {product.variants.map((variant: any) => (
                          <div
                            key={variant.id}
                            className="border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 flex flex-col gap-1"
                          >
                            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                              {variant.name}
                            </p>
                            {variant.sku && (
                              <p className="text-xs text-gray-500 dark:text-gray-400">SKU: {variant.sku}</p>
                            )}
                            {variant.attributes && (
                              <p className="text-xs text-gray-600 dark:text-gray-400">
                                {Object.entries(variant.attributes)
                                  .map(([key, value]) => `${key}: ${value}`)
                                  .join(' • ')}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
