'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Package,
  Scan,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Search,
  ArrowLeft,
  Loader,
  RefreshCw,
  ShoppingBag,
  Globe,
} from 'lucide-react';
import Header from '@/components/Header';
import Sidebar from '@/components/Sidebar';
import orderService from '@/services/orderService';
import barcodeService from '@/services/barcodeService';
import Toast from '@/components/Toast';

interface ScannedItemTracking {
  required: number;
  scanned: string[]; // Product names for display
  barcodes: string[]; // Actual barcode values
}

interface ScanHistoryEntry {
  barcode: string;
  status: 'success' | 'warning' | 'error';
  message: string;
  timestamp: string;
}

const parsePrice = (value: any): number => {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;

  if (typeof value === 'string') {
    const cleaned = value.replace(/[^0-9.-]/g, '');
    const n = parseFloat(cleaned);
    return Number.isFinite(n) ? n : 0;
  }

  const n = parseFloat(String(value));
  return Number.isFinite(n) ? n : 0;
};

const formatBDT = (value: any, decimals: 0 | 2 = 0) => {
  const amount = parsePrice(value);

  try {
    return new Intl.NumberFormat('en-BD', {
      style: 'currency',
      currency: 'BDT',
      currencyDisplay: 'narrowSymbol',
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(amount);
  } catch {
    const fixed = amount.toFixed(decimals);
    const parts = fixed.split('.');
    const intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return `৳${intPart}${decimals ? '.' + (parts[1] || '00') : ''}`;
  }
};

// ✅ normalize axios/service responses safely (works if service returns res.data or raw)
const unwrap = (res: any) => {
  if (!res) return res;
  if (typeof res === 'object' && 'success' in res) return res;
  if (res?.data && typeof res.data === 'object') return res.data;
  return res;
};

const extractErrorMessage = (err: any) => {
  const data = err?.response?.data;
  if (typeof data?.message === 'string') return data.message;

  // Laravel validation
  if (data?.errors && typeof data.errors === 'object') {
    const firstKey = Object.keys(data.errors)[0];
    const firstMsg = Array.isArray(data.errors[firstKey]) ? data.errors[firstKey][0] : String(data.errors[firstKey]);
    return firstMsg || 'Validation failed';
  }

  if (typeof err?.message === 'string') return err.message;
  return 'Something went wrong';
};

export default function WarehouseFulfillmentPage() {
  const [darkMode, setDarkMode] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [pendingOrders, setPendingOrders] = useState<any[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [orderDetails, setOrderDetails] = useState<any>(null);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  const [scannedItems, setScannedItems] = useState<Record<number, ScannedItemTracking>>({});
  const scannedItemsRef = useRef(scannedItems);
  useEffect(() => {
    scannedItemsRef.current = scannedItems;
  }, [scannedItems]);

  const [currentBarcode, setCurrentBarcode] = useState('');
  const [scanHistory, setScanHistory] = useState<ScanHistoryEntry[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error' | 'info' | 'warning'>('success');

  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    fetchPendingOrders();

    if (typeof window !== 'undefined') {
      audioRef.current = new Audio('/sounds/beep.mp3');
    }
  }, []);

  useEffect(() => {
    if (selectedOrderId) fetchOrderDetails(selectedOrderId);
  }, [selectedOrderId]);

  useEffect(() => {
    if (isScanning) {
      setTimeout(() => barcodeInputRef.current?.focus(), 50);
    }
  }, [isScanning, orderDetails]);

  const displayToast = (message: string, type: 'success' | 'error' | 'info' | 'warning' = 'success') => {
    setToastMessage(message);
    setToastType(type);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 4000);
  };

  const playSuccessSound = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {});
    }
  };

  // ✅ reliable error beep (no broken base64 wav)
  const playErrorSound = () => {
    try {
      const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'square';
      o.frequency.value = 220;
      g.gain.value = 0.05;
      o.connect(g);
      g.connect(ctx.destination);
      o.start();
      setTimeout(() => {
        o.stop();
        ctx.close().catch(() => {});
      }, 120);
    } catch {
      // ignore
    }
  };

  const addToScanHistory = (barcode: string, status: 'success' | 'warning' | 'error', message: string) => {
    const entry: ScanHistoryEntry = {
      barcode,
      status,
      message,
      timestamp: new Date().toLocaleTimeString(),
    };
    setScanHistory((prev) => [entry, ...prev.slice(0, 49)]);
  };

  const fetchPendingOrders = async () => {
    setIsLoadingOrders(true);
    try {
      const [socialCommerceRes, ecommerceRes] = await Promise.all([
        orderService.getPendingFulfillment({ per_page: 100, order_type: 'social_commerce' }),
        orderService.getPendingFulfillment({ per_page: 100, order_type: 'ecommerce' }),
      ]);

      const socialCommerce = unwrap(socialCommerceRes)?.data ?? unwrap(socialCommerceRes) ?? [];
      const ecommerce = unwrap(ecommerceRes)?.data ?? unwrap(ecommerceRes) ?? [];

      const allOrders = [...(socialCommerce || []), ...(ecommerce || [])];

      allOrders.sort((a: any, b: any) => new Date(b.order_date).getTime() - new Date(a.order_date).getTime());
      setPendingOrders(allOrders);
    } catch (error: any) {
      displayToast('Error loading orders: ' + extractErrorMessage(error), 'error');
    } finally {
      setIsLoadingOrders(false);
    }
  };

  const fetchOrderDetails = async (orderId: number) => {
    setIsLoadingDetails(true);
    try {
      const res = unwrap(await orderService.getById(orderId));
      const order = res?.data ?? res; // supports both shapes

      setOrderDetails(order);

      const initial: Record<number, ScannedItemTracking> = {};
      (order?.items || []).forEach((item: any) => {
        initial[item.id] = {
          required: Number(item.quantity || 0),
          scanned: [],
          barcodes: [],
        };
      });

      setScannedItems(initial);
      setScanHistory([]);
    } catch (error: any) {
      displayToast('Error loading order: ' + extractErrorMessage(error), 'error');
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const getOrderProgress = () => {
    if (!orderDetails) return { scanned: 0, total: 0, percentage: 0 };
    let scanned = 0;
    let total = 0;

    (orderDetails.items || []).forEach((item: any) => {
      total += Number(item.quantity || 0);
      scanned += scannedItems[item.id]?.scanned.length || 0;
    });

    return { scanned, total, percentage: total > 0 ? (scanned / total) * 100 : 0 };
  };

  const getOrderTypeBadge = (orderType: string) => {
    if (orderType === 'social_commerce') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400">
          <ShoppingBag className="h-3.5 w-3.5" />
          Social Commerce
        </span>
      );
    }
    if (orderType === 'ecommerce') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
          <Globe className="h-3.5 w-3.5" />
          E-Commerce
        </span>
      );
    }
    return null;
  };

  // ✅ backend-aligned field normalization
  const getProductId = (item: any) => Number(item?.product_id ?? item?.product?.id ?? item?.productId ?? 0) || 0;

  // IMPORTANT: backend uses product_batch_id
  const getBatchId = (item: any) =>
    Number(
      item?.product_batch_id ??
        item?.productBatchId ??
        item?.batch_id ??
        item?.batchId ??
        item?.batch?.id ??
        0
    ) || 0;

  const handleBarcodeScan = async (barcode: string) => {
    if (!orderDetails) {
      displayToast('No order selected', 'error');
      return;
    }

    const clean = barcode.trim();
    if (!clean) return;

    try {
      if (clean.length < 5) {
        displayToast('Invalid barcode format', 'error');
        addToScanHistory(clean, 'error', 'Invalid format');
        playErrorSound();
        return;
      }

      // ✅ duplicate check using latest state
      const latest = scannedItemsRef.current;
      const alreadyScanned = Object.values(latest).some((it) => it.barcodes.includes(clean));
      if (alreadyScanned) {
        displayToast('⚠️ Barcode already scanned for this order', 'warning');
        addToScanHistory(clean, 'warning', 'Duplicate scan');
        playErrorSound();
        return;
      }

      const scanRes = unwrap(await barcodeService.scanBarcode(clean));
      const data = scanRes?.data ?? scanRes;

      if (!scanRes?.success || !data?.product) {
        displayToast('❌ Barcode not found in system', 'error');
        addToScanHistory(clean, 'error', scanRes?.message || 'Barcode not found');
        playErrorSound();
        return;
      }

      const scannedProduct = data.product;
      const scannedBatch = data.current_batch;
      const isAvailable = !!data.is_available;

      if (!isAvailable) {
        displayToast('❌ This barcode is not available (already sold/defective/inactive)', 'error');
        addToScanHistory(clean, 'error', `${scannedProduct.name} - Not available`);
        playErrorSound();
        return;
      }

      const scannedProductId = Number(scannedProduct?.id ?? 0) || 0;
      const scannedBatchId = Number(scannedBatch?.id ?? 0) || 0;

      const items = orderDetails.items || [];
      const candidates = items.filter((item: any) => getProductId(item) === scannedProductId);

      if (candidates.length === 0) {
        displayToast(`❌ "${scannedProduct.name}" not in this order`, 'error');
        addToScanHistory(clean, 'error', `${scannedProduct.name} - Not in order`);
        playErrorSound();
        return;
      }

      // ✅ enforce batch same as backend (product_batch_id)
      const batchOk = candidates.filter((item: any) => {
        const orderItemBatchId = getBatchId(item);

        // If order expects a batch but scanned batch missing => reject
        if (orderItemBatchId && !scannedBatchId) return false;

        // If order expects batch => must match
        if (orderItemBatchId) return orderItemBatchId === scannedBatchId;

        // If order has NO batch assigned => fulfillment will fail later in backend.
        // Better to block early with a clear message.
        return false;
      });

      if (batchOk.length === 0) {
        displayToast(`❌ Batch mismatch (or order item has no batch assigned).`, 'error');
        addToScanHistory(clean, 'error', `${scannedProduct.name} - Batch mismatch / no batch in order item`);
        playErrorSound();
        return;
      }

      // pick an item that still needs scanning
      const latest2 = scannedItemsRef.current;
      const matchingItem = batchOk.find((item: any) => {
        const required = Number(item.quantity || 0);
        const already = latest2[item.id]?.scanned.length || 0;
        return already < required;
      });

      if (!matchingItem) {
        displayToast(`⚠️ "${scannedProduct.name}" already fully scanned`, 'warning');
        addToScanHistory(clean, 'warning', `${scannedProduct.name} - Already complete`);
        playErrorSound();
        return;
      }

      const required = Number(matchingItem.quantity || 0);
      const current = latest2[matchingItem.id] || { required, scanned: [], barcodes: [] };

      if (current.scanned.length >= required) {
        displayToast(`⚠️ Item already complete (${required}/${required})`, 'warning');
        addToScanHistory(clean, 'warning', `${scannedProduct.name} - Already complete`);
        playErrorSound();
        return;
      }

      const newCount = current.scanned.length + 1;

      setScannedItems((prev) => ({
        ...prev,
        [matchingItem.id]: {
          required,
          scanned: [...(prev[matchingItem.id]?.scanned || []), scannedProduct.name],
          barcodes: [...(prev[matchingItem.id]?.barcodes || []), clean],
        },
      }));

      displayToast(`✅ ${scannedProduct.name} (${newCount}/${required})`, 'success');
      addToScanHistory(clean, 'success', `${scannedProduct.name} - ${newCount}/${required}`);
      playSuccessSound();

      setTimeout(() => barcodeInputRef.current?.focus(), 50);
    } catch (error: any) {
      const msg = extractErrorMessage(error);
      displayToast('Scan error: ' + msg, 'error');
      addToScanHistory(barcode, 'error', msg);
      playErrorSound();
    }
  };

  const handleFulfillOrder = async () => {
    if (!orderDetails) return;

    // ✅ prechecks that match backend failure reasons
    const storeId = Number(orderDetails?.store_id ?? orderDetails?.store?.id ?? 0) || 0;
    if (!storeId) {
      displayToast('❌ This order has no store assigned. Assign store first.', 'error');
      return;
    }

    const items = orderDetails.items || [];

    const missingBatch = items.filter((it: any) => !getBatchId(it));
    if (missingBatch.length > 0) {
      displayToast('❌ Some items have no batch assigned (product_batch_id). Fix order items first.', 'error');
      console.log('Items missing product_batch_id:', missingBatch);
      return;
    }

    const allItemsScanned = items.every((item: any) => {
      const scanned = scannedItemsRef.current[item.id];
      const required = Number(item.quantity || 0);
      return scanned && scanned.barcodes.length === required;
    });

    if (!allItemsScanned) {
      displayToast('⚠️ Please scan all required items before fulfilling', 'warning');
      const missingItems = items.filter((item: any) => {
        const scanned = scannedItemsRef.current[item.id];
        const required = Number(item.quantity || 0);
        return !scanned || scanned.barcodes.length < required;
      });
      console.log('❌ Missing items:', missingItems);
      return;
    }

    setIsProcessing(true);
    try {
      const fulfillments = items.map((item: any) => ({
        order_item_id: item.id,
        barcodes: scannedItemsRef.current[item.id].barcodes,
      }));

      const fulfillRes = unwrap(await orderService.fulfill(orderDetails.id, { fulfillments }));
      if (fulfillRes?.success === false) throw new Error(fulfillRes?.message || 'Fulfillment failed');

      displayToast('✅ Order fulfilled successfully!', 'success');

      // auto complete (same behavior as your original)
      setTimeout(async () => {
        try {
          const completeRes = unwrap(await orderService.complete(orderDetails.id));
          if (completeRes?.success === false) throw new Error(completeRes?.message || 'Completion failed');

          displayToast('✅ Order completed! Inventory updated.', 'success');

          setTimeout(() => {
            setSelectedOrderId(null);
            setOrderDetails(null);
            setScannedItems({});
            setScanHistory([]);
            fetchPendingOrders();
          }, 1500);
        } catch (completeError: any) {
          displayToast('⚠️ Fulfilled but completion failed: ' + extractErrorMessage(completeError), 'error');
          setTimeout(() => {
            setSelectedOrderId(null);
            fetchPendingOrders();
          }, 2500);
        }
      }, 800);
    } catch (error: any) {
      displayToast('❌ Fulfillment failed: ' + extractErrorMessage(error), 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const filteredOrders = useMemo(() => {
    return pendingOrders.filter(
      (order) =>
        order.order_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        order.customer?.name?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [pendingOrders, searchQuery]);

  const progress = getOrderProgress();

  // =========================
  // ORDER LIST VIEW
  // =========================
  if (!selectedOrderId) {
    return (
      <div className={darkMode ? 'dark' : ''}>
        <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
          <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />
          <div className="flex-1 flex flex-col overflow-hidden">
            <Header darkMode={darkMode} setDarkMode={setDarkMode} toggleSidebar={() => setSidebarOpen(!sidebarOpen)} />

            <main className="flex-1 overflow-auto p-4 md:p-6">
              <div className="max-w-7xl mx-auto">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">📦 Warehouse Fulfillment</h1>
                    <p className="mt-2 text-gray-600 dark:text-gray-400">
                      Scan barcodes to fulfill pending social commerce & e-commerce orders
                    </p>
                  </div>
                  <button
                    onClick={fetchPendingOrders}
                    disabled={isLoadingOrders}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className={`h-4 w-4 ${isLoadingOrders ? 'animate-spin' : ''}`} />
                    Refresh
                  </button>
                </div>

                <div className="mb-6">
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search by order number or customer name..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                {isLoadingOrders ? (
                  <div className="text-center py-12">
                    <Loader className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
                    <p className="text-gray-600 dark:text-gray-400">Loading orders...</p>
                  </div>
                ) : filteredOrders.length === 0 ? (
                  <div className="text-center py-12 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800">
                    <Package className="mx-auto h-12 w-12 mb-4 text-gray-400" />
                    <p className="text-lg font-medium text-gray-600 dark:text-gray-400">
                      {searchQuery ? 'No matching orders' : 'No pending fulfillment orders'}
                    </p>
                    {!searchQuery && (
                      <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">All orders have been fulfilled or completed</p>
                    )}
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {filteredOrders.map((order) => (
                      <div
                        key={order.id}
                        onClick={() => setSelectedOrderId(order.id)}
                        className="p-6 rounded-lg border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 cursor-pointer transition-all hover:border-blue-500 hover:shadow-lg"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{order.order_number}</h3>
                              {getOrderTypeBadge(order.order_type)}
                            </div>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              {order.customer?.name} • {order.items?.length || 0} item(s)
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              {order.order_date ? new Date(order.order_date).toLocaleDateString() : ''} {order.store?.name ? `- ${order.store?.name}` : ''}
                            </p>
                          </div>
                          <div className="text-right">
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
                              Pending Fulfillment
                            </span>
                            <p className="text-lg font-bold mt-2 text-gray-900 dark:text-white">
                              {formatBDT(order.total_amount, 0)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </main>
          </div>
        </div>
        {showToast && <Toast message={toastMessage} type={toastType} onClose={() => setShowToast(false)} />}
      </div>
    );
  }

  // =========================
  // FULFILLMENT VIEW
  // =========================
  return (
    <div className={darkMode ? 'dark' : ''}>
      <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
        <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header darkMode={darkMode} setDarkMode={setDarkMode} toggleSidebar={() => setSidebarOpen(!sidebarOpen)} />

          <main className="flex-1 overflow-auto p-4 md:p-6">
            <div className="max-w-7xl mx-auto">
              <div className="mb-6 flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => {
                      setSelectedOrderId(null);
                      setOrderDetails(null);
                      setScannedItems({});
                      setScanHistory([]);
                    }}
                    className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
                  >
                    <ArrowLeft className="text-gray-900 dark:text-white" />
                  </button>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">
                        {orderDetails?.order_number || 'Loading...'}
                      </h1>
                      {orderDetails && getOrderTypeBadge(orderDetails.order_type)}
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {orderDetails?.customer?.name} • {orderDetails?.items?.length || 0} items
                      {orderDetails?.total_amount != null && (
                        <span className="ml-2 text-gray-500 dark:text-gray-500">• Total: {formatBDT(orderDetails.total_amount, 0)}</span>
                      )}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setIsScanning((v) => !v)}
                  className={`px-6 py-3 rounded-lg font-medium transition-all flex items-center gap-2 ${
                    isScanning ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-blue-500 hover:bg-blue-600 text-white'
                  }`}
                >
                  <Scan className="h-5 w-5" />
                  {isScanning ? 'Stop Scanning' : 'Start Scanning'}
                </button>
              </div>

              <div className="mb-6 p-6 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Progress: {progress.scanned} / {progress.total} items scanned
                  </span>
                  <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">{progress.percentage.toFixed(0)}%</span>
                </div>
                <div className="w-full h-4 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                  <div
                    className="h-4 bg-gradient-to-r from-blue-500 to-green-500 transition-all duration-500 ease-out"
                    style={{ width: `${progress.percentage}%` }}
                  />
                </div>
                {progress.percentage === 100 && (
                  <p className="text-sm text-green-600 dark:text-green-400 mt-2 font-medium">
                    ✅ All items scanned! Ready to fulfill order.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left */}
                <div>
                  <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Order Items</h2>
                  <div className="space-y-3">
                    {isLoadingDetails ? (
                      <div className="text-center py-8">
                        <Loader className="h-6 w-6 animate-spin text-blue-600 mx-auto" />
                      </div>
                    ) : (
                      (orderDetails?.items || []).map((item: any) => {
                        const tracked = scannedItems[item.id];
                        const required = Number(item.quantity || 0);
                        const scannedCount = tracked?.scanned.length || 0;
                        const isComplete = scannedCount === required;

                        const unit = parsePrice(item.unit_price);
                        const discount = parsePrice(item.discount_amount);
                        const qty = required;
                        const lineTotal =
                          item.total_amount !== undefined && item.total_amount !== null
                            ? parsePrice(item.total_amount)
                            : Math.max(unit * qty - discount, 0);

                        return (
                          <div
                            key={item.id}
                            className={`p-4 rounded-lg border-2 transition-all ${
                              isComplete
                                ? 'bg-green-50 dark:bg-green-900/20 border-green-500'
                                : scannedCount > 0
                                ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-500'
                                : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700'
                            }`}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <h3 className="font-medium text-gray-900 dark:text-white">{item.product_name}</h3>
                                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">SKU: {item.product_sku}</p>

                                {/* show batch from backend-compatible field */}
                                <p className="text-xs text-gray-500 dark:text-gray-500">
                                  Batch ID: {getBatchId(item) || '—'}
                                </p>

                                <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                                  <div className="text-gray-600 dark:text-gray-400">
                                    Unit: <span className="font-semibold text-gray-900 dark:text-white">{formatBDT(unit, 0)}</span>
                                  </div>
                                  <div className="text-gray-600 dark:text-gray-400">
                                    Discount:{' '}
                                    <span className="font-semibold text-gray-900 dark:text-white">{formatBDT(discount, 0)}</span>
                                  </div>
                                  <div className="text-gray-600 dark:text-gray-400 sm:text-right">
                                    Line: <span className="font-semibold text-gray-900 dark:text-white">{formatBDT(lineTotal, 0)}</span>
                                  </div>
                                </div>

                                <div className="mt-2 flex items-center gap-2">
                                  <div
                                    className={`text-sm font-semibold ${
                                      isComplete
                                        ? 'text-green-600 dark:text-green-400'
                                        : scannedCount > 0
                                        ? 'text-blue-600 dark:text-blue-400'
                                        : 'text-gray-600 dark:text-gray-400'
                                    }`}
                                  >
                                    {scannedCount} / {required} scanned
                                  </div>
                                  {scannedCount > 0 && !isComplete && (
                                    <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                      <div className="h-2 bg-blue-500 transition-all" style={{ width: `${(scannedCount / Math.max(required, 1)) * 100}%` }} />
                                    </div>
                                  )}
                                </div>
                              </div>

                              <div className="ml-4">
                                {isComplete ? (
                                  <CheckCircle className="h-8 w-8 text-green-600" />
                                ) : scannedCount > 0 ? (
                                  <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                                    <span className="text-sm font-bold text-blue-600 dark:text-blue-400">{scannedCount}</span>
                                  </div>
                                ) : (
                                  <AlertTriangle className="h-8 w-8 text-yellow-600" />
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  <button
                    onClick={handleFulfillOrder}
                    disabled={isProcessing || progress.percentage !== 100}
                    className={`w-full mt-6 px-6 py-4 rounded-lg font-semibold text-white transition-all flex items-center justify-center gap-2 ${
                      progress.percentage === 100 && !isProcessing ? 'bg-green-600 hover:bg-green-700 shadow-lg' : 'bg-gray-400 cursor-not-allowed'
                    }`}
                  >
                    {isProcessing ? (
                      <>
                        <Loader className="h-5 w-5 animate-spin" />
                        Processing Order...
                      </>
                    ) : progress.percentage === 100 ? (
                      <>
                        <CheckCircle className="h-5 w-5" />
                        Complete Fulfillment & Update Inventory
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="h-5 w-5" />
                        Scan All Items First ({progress.scanned}/{progress.total})
                      </>
                    )}
                  </button>
                </div>

                {/* Right */}
                <div>
                  <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Barcode Scanner</h2>

                  <div className="p-6 rounded-lg mb-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                    <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Scan or Enter Barcode</label>
                    <input
                      ref={barcodeInputRef}
                      type="text"
                      value={currentBarcode}
                      onChange={(e) => setCurrentBarcode(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && currentBarcode.trim()) {
                          handleBarcodeScan(currentBarcode.trim());
                          setCurrentBarcode('');
                        }
                      }}
                      disabled={!isScanning}
                      placeholder={isScanning ? 'Scan barcode or type manually...' : 'Start scanning first'}
                      className={`w-full px-4 py-3 rounded-lg border-2 text-lg font-mono transition-all ${
                        isScanning
                          ? 'bg-white dark:bg-gray-700 border-blue-500 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500'
                          : 'bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-500 cursor-not-allowed'
                      } focus:outline-none`}
                    />
                    <div className="flex items-center justify-between mt-2">
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        {isScanning ? '📱 Scan barcode or type manually and press Enter' : '⏸️ Click "Start Scanning" to begin'}
                      </p>
                      {isScanning && (
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></div>
                          <span className="text-xs font-medium text-green-600 dark:text-green-400">Scanner Active</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <button
                      onClick={() => {
                        setScanHistory([]);
                        displayToast('Scan history cleared', 'info');
                      }}
                      disabled={scanHistory.length === 0}
                      className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Clear History
                    </button>
                    <button
                      onClick={() => {
                        const reset: Record<number, ScannedItemTracking> = {};
                        (orderDetails?.items || []).forEach((item: any) => {
                          reset[item.id] = { required: Number(item.quantity || 0), scanned: [], barcodes: [] };
                        });
                        setScannedItems(reset);
                        setScanHistory([]);
                        displayToast('All scans reset', 'info');
                      }}
                      disabled={progress.scanned === 0}
                      className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Reset All Scans
                    </button>
                  </div>

                  <div className="p-4 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Scan History</h3>
                      <span className="text-xs text-gray-500 dark:text-gray-500">
                        {scanHistory.length} scan{scanHistory.length !== 1 ? 's' : ''}
                      </span>
                    </div>

                    <div className="space-y-2 max-h-96 overflow-y-auto pr-2 custom-scrollbar">
                      {scanHistory.length === 0 ? (
                        <div className="text-center py-8">
                          <Scan className="h-10 w-10 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                          <p className="text-sm text-gray-500 dark:text-gray-500">No scans yet</p>
                          <p className="text-xs text-gray-400 dark:text-gray-600 mt-1">Start scanning to see history</p>
                        </div>
                      ) : (
                        scanHistory.map((scan, index) => (
                          <div
                            key={index}
                            className={`p-3 rounded-lg border transition-all ${
                              scan.status === 'success'
                                ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                                : scan.status === 'warning'
                                ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
                                : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  {scan.status === 'success' ? (
                                    <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400 flex-shrink-0" />
                                  ) : scan.status === 'warning' ? (
                                    <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
                                  ) : (
                                    <XCircle className="h-4 w-4 text-red-600 dark:text-red-400 flex-shrink-0" />
                                  )}
                                  <span
                                    className={`text-xs font-mono font-semibold truncate ${
                                      scan.status === 'success'
                                        ? 'text-green-700 dark:text-green-400'
                                        : scan.status === 'warning'
                                        ? 'text-yellow-700 dark:text-yellow-400'
                                        : 'text-red-700 dark:text-red-400'
                                    }`}
                                  >
                                    {scan.barcode}
                                  </span>
                                </div>
                                <p className="text-xs text-gray-700 dark:text-gray-300 pl-6">{scan.message}</p>
                              </div>
                              <span className="text-xs text-gray-500 dark:text-gray-500 flex-shrink-0">{scan.timestamp}</span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-3">
                    <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                      <div className="flex items-center gap-2 mb-1">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <span className="text-xs font-medium text-green-700 dark:text-green-400">Success</span>
                      </div>
                      <p className="text-xl font-bold text-green-700 dark:text-green-400">
                        {scanHistory.filter((s) => s.status === 'success').length}
                      </p>
                    </div>
                    <div className="p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
                      <div className="flex items-center gap-2 mb-1">
                        <AlertTriangle className="h-4 w-4 text-yellow-600" />
                        <span className="text-xs font-medium text-yellow-700 dark:text-yellow-400">Warning</span>
                      </div>
                      <p className="text-xl font-bold text-yellow-700 dark:text-yellow-400">
                        {scanHistory.filter((s) => s.status === 'warning').length}
                      </p>
                    </div>
                    <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                      <div className="flex items-center gap-2 mb-1">
                        <XCircle className="h-4 w-4 text-red-600" />
                        <span className="text-xs font-medium text-red-700 dark:text-red-400">Error</span>
                      </div>
                      <p className="text-xl font-bold text-red-700 dark:text-red-400">
                        {scanHistory.filter((s) => s.status === 'error').length}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <style jsx>{`
                .custom-scrollbar::-webkit-scrollbar {
                  width: 6px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                  background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                  background: #cbd5e0;
                  border-radius: 3px;
                }
                .dark .custom-scrollbar::-webkit-scrollbar-thumb {
                  background: #4a5568;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                  background: #a0aec0;
                }
                .dark .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                  background: #718096;
                }
              `}</style>
            </div>
          </main>
        </div>
      </div>

      {showToast && <Toast message={toastMessage} type={toastType} onClose={() => setShowToast(false)} />}
    </div>
  );
}
