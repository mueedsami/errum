'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
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
import Toast from '@/components/Toast';
import axios from '@/lib/axios';

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

// Helper function to parse prices correctly (handles "৳2,000.00", "2,000", etc.)
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

const extractErrorMessage = (err: any) => {
  const data = err?.response?.data;
  if (typeof data?.message === 'string') return data.message;

  if (data?.errors && typeof data.errors === 'object') {
    const k = Object.keys(data.errors)[0];
    const v = data.errors[k];
    if (Array.isArray(v) && v[0]) return v[0];
    if (typeof v === 'string') return v;
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
    fetchAssignedOrders();
    if (typeof window !== 'undefined') {
      audioRef.current = new Audio('/sounds/beep.mp3');
    }
  }, []);

  useEffect(() => {
    if (selectedOrderId) {
      fetchOrderDetails(selectedOrderId);
    }
  }, [selectedOrderId]);

  useEffect(() => {
    if (isScanning && barcodeInputRef.current) {
      setTimeout(() => barcodeInputRef.current?.focus(), 50);
    }
  }, [isScanning]);

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

  // simple error beep using WebAudio (no broken base64)
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

  // ====== OPTION C API CALLS (BACKEND VERIFIED) ======
  const fetchAssignedOrders = async () => {
    setIsLoadingOrders(true);
    try {
      const res = await axios.get('/store/fulfillment/orders/assigned', {
        params: { per_page: 100, status: 'assigned_to_store,picking' },
      });

      const orders = res?.data?.data?.orders || [];
      // backend returns oldest first, but your UI expects newest first; keep your behavior:
      orders.sort((a: any, b: any) => new Date(b.order_date || b.created_at).getTime() - new Date(a.order_date || a.created_at).getTime());

      setPendingOrders(orders);
    } catch (error: any) {
      displayToast('Error loading assigned orders: ' + extractErrorMessage(error), 'error');
    } finally {
      setIsLoadingOrders(false);
    }
  };

  const fetchOrderDetails = async (orderId: number) => {
    setIsLoadingDetails(true);
    try {
      const res = await axios.get(`/store/fulfillment/orders/${orderId}`);
      const order = res?.data?.data?.order;
      if (!order) throw new Error('Order not found');

      setOrderDetails(order);

      // Init tracking: In store-fulfillment flow, each order item is scanned ONCE (product_barcode_id set).
      const initial: Record<number, ScannedItemTracking> = {};
      (order.items || []).forEach((item: any) => {
        const alreadyScanned = !!item.product_barcode_id;
        const scannedBarcode = item?.scanned_barcode?.barcode || item?.barcode?.barcode || null;
        const productName = item?.product?.name || item?.product_name || 'Item';

        initial[item.id] = {
          required: 1,
          scanned: alreadyScanned ? [productName] : [],
          barcodes: alreadyScanned && scannedBarcode ? [scannedBarcode] : [],
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

    const items = orderDetails.items || [];
    const total = items.length;

    const scanned = items.reduce((acc: number, item: any) => {
      const has = (scannedItems[item.id]?.barcodes?.length || 0) > 0 || !!item.product_barcode_id;
      return acc + (has ? 1 : 0);
    }, 0);

    return {
      scanned,
      total,
      percentage: total > 0 ? (scanned / total) * 100 : 0,
    };
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

  // ====== SCAN (Option C): try barcode against unscanned items until backend accepts ======
  const handleBarcodeScan = async (barcode: string) => {
    if (!orderDetails) {
      displayToast('No order selected', 'error');
      return;
    }

    const clean = barcode.trim();
    if (!clean) return;

    try {
      // quick format check
      if (clean.length < 5) {
        displayToast('Invalid barcode format', 'error');
        addToScanHistory(clean, 'error', 'Invalid format');
        playErrorSound();
        return;
      }

      // local duplicate check
      const alreadyScanned = Object.values(scannedItemsRef.current).some((item) => item.barcodes.includes(clean));
      if (alreadyScanned) {
        displayToast('⚠️ Barcode already scanned for this order', 'warning');
        addToScanHistory(clean, 'warning', 'Duplicate scan');
        playErrorSound();
        return;
      }

      const items = orderDetails.items || [];
      const unscannedItems = items.filter((it: any) => !it.product_barcode_id && (scannedItemsRef.current[it.id]?.barcodes?.length || 0) === 0);

      if (unscannedItems.length === 0) {
        displayToast('⚠️ All items are already scanned', 'warning');
        addToScanHistory(clean, 'warning', 'Order already complete');
        playErrorSound();
        return;
      }

      // Try each unscanned item until one matches the barcode product (backend decides)
      let lastMismatchMsg: string | null = null;

      for (const item of unscannedItems) {
        try {
          const res = await axios.post(`/store/fulfillment/orders/${orderDetails.id}/scan-barcode`, {
            barcode: clean,
            order_item_id: item.id,
          });

          // success
          const data = res?.data?.data;
          const orderItem = data?.order_item;
          const scannedBarcode = data?.scanned_barcode;
          const productName =
            orderItem?.product?.name ||
            orderItem?.product_name ||
            item?.product?.name ||
            item?.product_name ||
            'Item';

          // update scanned UI
          setScannedItems((prev) => ({
            ...prev,
            [item.id]: {
              required: 1,
              scanned: [productName],
              barcodes: [clean],
            },
          }));

          // also update orderDetails item so UI remains consistent even after refresh logic
          setOrderDetails((prev: any) => {
            if (!prev) return prev;
            return {
              ...prev,
              status: data?.order_status || prev.status,
              items: (prev.items || []).map((it: any) =>
                it.id === item.id
                  ? {
                      ...it,
                      product_barcode_id: orderItem?.product_barcode_id || scannedBarcode?.id || true,
                      product_batch_id: orderItem?.product_batch_id || scannedBarcode?.batch_id || it.product_batch_id,
                      scanned_barcode: scannedBarcode || it.scanned_barcode,
                    }
                  : it
              ),
            };
          });

          displayToast(`✅ ${productName} scanned`, 'success');
          addToScanHistory(clean, 'success', `${productName} - scanned`);
          playSuccessSound();

          setTimeout(() => barcodeInputRef.current?.focus(), 80);
          return;
        } catch (innerErr: any) {
          const msg = extractErrorMessage(innerErr);

          // If barcode isn't in this store / isn't in_shop => stop immediately (no point trying other items)
          if (innerErr?.response?.status === 404) {
            displayToast('❌ ' + msg, 'error');
            addToScanHistory(clean, 'error', msg);
            playErrorSound();
            return;
          }

          // If product mismatch, try next item
          if (innerErr?.response?.status === 400 && msg.toLowerCase().includes('does not match')) {
            lastMismatchMsg = msg;
            continue;
          }

          // Other errors (validation, already scanned etc) -> stop and show
          displayToast('❌ ' + msg, 'error');
          addToScanHistory(clean, 'error', msg);
          playErrorSound();
          return;
        }
      }

      // If we reached here, it mismatched all items
      displayToast('❌ This barcode does not match any remaining order item', 'error');
      addToScanHistory(clean, 'error', lastMismatchMsg || 'No matching order item');
      playErrorSound();
    } catch (error: any) {
      const msg = extractErrorMessage(error);
      displayToast('Scan error: ' + msg, 'error');
      addToScanHistory(barcode, 'error', msg);
      playErrorSound();
    }
  };

  // ====== FINISH (Option C): mark ready-for-shipment ======
  const handleFulfillOrder = async () => {
    if (!orderDetails) return;

    const progress = getOrderProgress();
    if (progress.percentage !== 100) {
      displayToast('⚠️ Please scan all items before finishing', 'warning');
      return;
    }

    setIsProcessing(true);
    try {
      await axios.post(`/store/fulfillment/orders/${orderDetails.id}/ready-for-shipment`);

      displayToast('✅ Order marked as READY FOR SHIPMENT', 'success');

      setTimeout(() => {
        setSelectedOrderId(null);
        setOrderDetails(null);
        setScannedItems({});
        setScanHistory([]);
        fetchAssignedOrders();
      }, 1200);
    } catch (error: any) {
      displayToast('❌ Failed: ' + extractErrorMessage(error), 'error');
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

  // ORDER LIST VIEW
  if (!selectedOrderId) {
    return (
      <div className={darkMode ? 'dark' : ''}>
        <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
          <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />

          <div className="flex-1 flex flex-col overflow-hidden">
            <Header darkMode={darkMode} setDarkMode={setDarkMode} toggleSidebar={() => setSidebarOpen(!sidebarOpen)} />

            <main className="flex-1 overflow-auto p-4 md:p-6">
              <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">📦 Store Fulfillment</h1>
                    <p className="mt-2 text-gray-600 dark:text-gray-400">
                      Scan barcodes to fulfill assigned orders (Option C backend flow)
                    </p>
                  </div>
                  <button
                    onClick={fetchAssignedOrders}
                    disabled={isLoadingOrders}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className={`h-4 w-4 ${isLoadingOrders ? 'animate-spin' : ''}`} />
                    Refresh
                  </button>
                </div>

                {/* Search */}
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

                {/* Orders List */}
                {isLoadingOrders ? (
                  <div className="text-center py-12">
                    <Loader className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
                    <p className="text-gray-600 dark:text-gray-400">Loading orders...</p>
                  </div>
                ) : filteredOrders.length === 0 ? (
                  <div className="text-center py-12 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800">
                    <Package className="mx-auto h-12 w-12 mb-4 text-gray-400" />
                    <p className="text-lg font-medium text-gray-600 dark:text-gray-400">
                      {searchQuery ? 'No matching orders' : 'No assigned orders to fulfill'}
                    </p>
                    {!searchQuery && (
                      <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">No orders in assigned_to_store / picking</p>
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
                              {new Date(order.created_at || order.order_date).toLocaleDateString()} - {order.store?.name}
                            </p>
                          </div>
                          <div className="text-right">
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
                              {order.status || 'Assigned'}
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

  // FULFILLMENT VIEW
  return (
    <div className={darkMode ? 'dark' : ''}>
      <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
        <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />

        <div className="flex-1 flex flex-col overflow-hidden">
          <Header darkMode={darkMode} setDarkMode={setDarkMode} toggleSidebar={() => setSidebarOpen(!sidebarOpen)} />

          <main className="flex-1 overflow-auto p-4 md:p-6">
            <div className="max-w-7xl mx-auto">
              {/* Header */}
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
                      {orderDetails?.status && <span className="ml-2 text-gray-500 dark:text-gray-500">• Status: {orderDetails.status}</span>}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setIsScanning(!isScanning)}
                  className={`px-6 py-3 rounded-lg font-medium transition-all flex items-center gap-2 ${
                    isScanning ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-blue-500 hover:bg-blue-600 text-white'
                  }`}
                >
                  <Scan className="h-5 w-5" />
                  {isScanning ? 'Stop Scanning' : 'Start Scanning'}
                </button>
              </div>

              {/* Progress Bar */}
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
                    ✅ All items scanned! Ready to mark order as ready-for-shipment.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left Column - Order Items */}
                <div>
                  <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Order Items</h2>
                  <div className="space-y-3">
                    {isLoadingDetails ? (
                      <div className="text-center py-8">
                        <Loader className="h-6 w-6 animate-spin text-blue-600 mx-auto" />
                      </div>
                    ) : (
                      orderDetails?.items?.map((item: any) => {
                        const scanned = scannedItems[item.id];
                        const scannedCount = scanned?.barcodes?.length || 0;
                        const isComplete = scannedCount >= 1 || !!item.product_barcode_id;

                        const unit = parsePrice(item.unit_price);
                        const discount = parsePrice(item.discount_amount);
                        const qty = Number(item.quantity || 0);
                        const lineTotal =
                          item.total_amount !== undefined && item.total_amount !== null
                            ? parsePrice(item.total_amount)
                            : Math.max(unit * Math.max(qty, 1) - discount, 0);

                        return (
                          <div
                            key={item.id}
                            className={`p-4 rounded-lg border-2 transition-all ${
                              isComplete
                                ? 'bg-green-50 dark:bg-green-900/20 border-green-500'
                                : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700'
                            }`}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <h3 className="font-medium text-gray-900 dark:text-white">{item.product?.name || item.product_name}</h3>
                                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">SKU: {item.product?.sku || item.product_sku}</p>

                                <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                                  <div className="text-gray-600 dark:text-gray-400">
                                    Unit:{' '}
                                    <span className="font-semibold text-gray-900 dark:text-white">
                                      {formatBDT(unit, 0)}
                                    </span>
                                  </div>
                                  <div className="text-gray-600 dark:text-gray-400">
                                    Discount:{' '}
                                    <span className="font-semibold text-gray-900 dark:text-white">
                                      {formatBDT(discount, 0)}
                                    </span>
                                  </div>
                                  <div className="text-gray-600 dark:text-gray-400 sm:text-right">
                                    Line:{' '}
                                    <span className="font-semibold text-gray-900 dark:text-white">
                                      {formatBDT(lineTotal, 0)}
                                    </span>
                                  </div>
                                </div>

                                <div className="mt-2 flex items-center gap-2">
                                  <div className={`text-sm font-semibold ${isComplete ? 'text-green-600 dark:text-green-400' : 'text-gray-600 dark:text-gray-400'}`}>
                                    {isComplete ? '1 / 1 scanned' : '0 / 1 scanned'}
                                  </div>
                                </div>
                              </div>

                              <div className="ml-4">
                                {isComplete ? (
                                  <CheckCircle className="h-8 w-8 text-green-600" />
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
                        Processing...
                      </>
                    ) : progress.percentage === 100 ? (
                      <>
                        <CheckCircle className="h-5 w-5" />
                        Mark Ready For Shipment
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="h-5 w-5" />
                        Scan All Items First ({progress.scanned}/{progress.total})
                      </>
                    )}
                  </button>
                </div>

                {/* Right Column - Scanning Interface */}
                <div>
                  <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Barcode Scanner</h2>

                  {/* Barcode Input */}
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
                        {isScanning ? '📱 Scan barcode and press Enter' : '⏸️ Click "Start Scanning" to begin'}
                      </p>
                      {isScanning && (
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></div>
                          <span className="text-xs font-medium text-green-600 dark:text-green-400">Scanner Active</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Quick Actions */}
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
                        // re-fetch order details from backend to reset accurately
                        if (orderDetails?.id) fetchOrderDetails(orderDetails.id);
                        displayToast('Refreshed order scan state', 'info');
                      }}
                      className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                      Reset From Server
                    </button>
                  </div>

                  {/* Scan History */}
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
              </div>
            </div>
          </main>
        </div>
      </div>

      {showToast && <Toast message={toastMessage} type={toastType} onClose={() => setShowToast(false)} />}
    </div>
  );
}
