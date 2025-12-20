'use client';

import React, { useState } from 'react';
import Header from '@/components/Header';
import Sidebar from '@/components/Sidebar';

import customerService, { Customer, CustomerOrder } from '@/services/customerService';
import orderService from '@/services/orderService';
import batchService, { Batch } from '@/services/batchService';
import barcodeTrackingService from '@/services/barcodeTrackingService';

type LookupTab = 'customer' | 'order' | 'barcode' | 'batch';

type BarcodeHistoryItem = {
  id: number;
  date: string;
  from_store?: string | null;
  to_store?: string | null;
  movement_type?: string | null;
  status_before?: string | null;
  status_after?: string | null;
  reference_type?: string | null;
  reference_id?: number | string | null;
  performed_by?: string | null;
  notes?: string | null;
};

type BarcodeHistoryData = {
  barcode: string;
  product: { id: number; name: string; sku: string | null };
  current_location: any;
  total_movements: number;
  history: BarcodeHistoryItem[];
};

type BatchLookupData = {
  batch: {
    id: number;
    batch_number: string;
    product: { id: number; name: string; sku: string | null };
    original_quantity: number;
  };
  summary: {
    total_units: number;
    active: number;
    available_for_sale: number;
    sold: number;
    defective: number;
  };
  status_breakdown: Array<{ status: string; count: number }>;
  store_distribution: Array<{ store_id: number | null; store_name: string; count: number }>;
  filters: { status?: string; store_id?: number; available_only?: boolean };
  barcodes: Array<{
    id: number;
    barcode: string;
    current_store: { id: number; name: string } | null;
    current_status: string;
    status_label: string;
    is_active: boolean;
    is_defective: boolean;
    is_available_for_sale: boolean;
    location_updated_at: string;
  }>;
};

export default function LookupPage() {
  // Layout (required by Header/Sidebar)
  const [darkMode, setDarkMode] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Tabs
  const [activeTab, setActiveTab] = useState<LookupTab>('customer');

  // Shared UI
  const [error, setError] = useState('');

  // =========================
  // CUSTOMER LOOKUP (existing)
  // =========================
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [expandedOrderId, setExpandedOrderId] = useState<number | null>(null);
  const [suggestions, setSuggestions] = useState<Customer[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);

  // ======================
  // ORDER LOOKUP (existing)
  // ======================
  const [orderNumber, setOrderNumber] = useState('');
  const [singleOrder, setSingleOrder] = useState<CustomerOrder | null>(null);
  const [orderSuggestions, setOrderSuggestions] = useState<CustomerOrder[]>([]);
  const [showOrderSuggestions, setShowOrderSuggestions] = useState(false);
  const [orderSearchLoading, setOrderSearchLoading] = useState(false);

  // ======================
  // BARCODE LOOKUP (new)
  // ======================
  const [barcodeInput, setBarcodeInput] = useState('');
  const [barcodeLoading, setBarcodeLoading] = useState(false);
  const [barcodeData, setBarcodeData] = useState<BarcodeHistoryData | null>(null);

  // ======================
  // BATCH LOOKUP (new)
  // ======================
  const [batchQuery, setBatchQuery] = useState('');
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchData, setBatchData] = useState<BatchLookupData | null>(null);

  const [batchSuggestions, setBatchSuggestions] = useState<Batch[]>([]);
  const [showBatchSuggestions, setShowBatchSuggestions] = useState(false);
  const [batchSearchLoading, setBatchSearchLoading] = useState(false);
  const [selectedBatchId, setSelectedBatchId] = useState<number | null>(null);

  // -----------------------
  // Helpers
  // -----------------------
  const formatPhoneNumber = (phone: string) => phone.replace(/\D/g, '');

  const formatCurrency = (amount: string | number) => {
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('en-BD', {
      style: 'currency',
      currency: 'BDT',
      minimumFractionDigits: 0,
    }).format(numAmount);
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

  const formatOrderType = (order: CustomerOrder) => {
    if ((order as any).order_type_label) return (order as any).order_type_label;
    if (order.order_type) {
      return order.order_type
        .split('_')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
    }
    return 'N/A';
  };

  const getStatusBadge = (status?: string | null) => {
    if (!status) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 dark:bg-gray-900/30 text-gray-800 dark:text-gray-300">
          Unknown
        </span>
      );
    }

    const statusConfig: { [key: string]: { bg: string; text: string } } = {
      paid: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-800 dark:text-green-300' },
      partial: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-800 dark:text-yellow-300' },
      partially_paid: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-800 dark:text-yellow-300' },
      pending: { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-800 dark:text-orange-300' },
      failed: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-800 dark:text-red-300' },
    };

    const config = statusConfig[status.toLowerCase()] || statusConfig['pending'];

    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${config.bg} ${config.text}`}>
        {status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}
      </span>
    );
  };

  const toggleOrderDetails = (orderId: number) => {
    setExpandedOrderId(expandedOrderId === orderId ? null : orderId);
  };

  // -----------------------
  // CUSTOMER suggestions
  // -----------------------
  const fetchSuggestions = async (searchTerm: string) => {
    if (searchTerm.length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    setSearchLoading(true);
    try {
      const formattedSearch = formatPhoneNumber(searchTerm);
      const searchResults = await customerService.search({ phone: formattedSearch, per_page: 10 });

      const matching = searchResults.data.filter((c) => {
        const cPhone = c.phone.replace(/\D/g, '');
        return cPhone.startsWith(formattedSearch);
      });

      setSuggestions(matching);
      setShowSuggestions(matching.length > 0);
    } catch {
      setSuggestions([]);
    } finally {
      setSearchLoading(false);
    }
  };

  // -----------------------
  // ORDER suggestions
  // -----------------------
  const fetchOrderSuggestions = async (searchTerm: string) => {
    if (searchTerm.length < 3) {
      setOrderSuggestions([]);
      setShowOrderSuggestions(false);
      return;
    }
    setOrderSearchLoading(true);
    try {
      const cleanSearch = searchTerm.trim().replace(/^#/, '');

      const searchResults = await orderService.getAll({
        search: cleanSearch,
        per_page: 10,
      });

      const matching: CustomerOrder[] = searchResults.data
        .filter((order: any) => {
          const orderNum = order.order_number.replace(/^#/, '');
          const searchNum = cleanSearch.replace(/^#/, '');
          return orderNum.toLowerCase().startsWith(searchNum.toLowerCase());
        })
        .map((order: any) => ({
          id: order.id,
          order_number: order.order_number,
          order_date: order.order_date,
          order_type: order.order_type,
          order_type_label: order.order_type_label || order.order_type,
          total_amount: order.total_amount,
          paid_amount: order.paid_amount,
          outstanding_amount: order.outstanding_amount,
          payment_status: order.payment_status,
          status: order.status,
          store: order.store,
          items: order.items || [],
          shipping_address: order.shipping_address,
          notes: order.notes,
        }));

      setOrderSuggestions(matching);
      setShowOrderSuggestions(matching.length > 0);
    } catch {
      setOrderSuggestions([]);
    } finally {
      setOrderSearchLoading(false);
    }
  };

  // -----------------------
  // BATCH suggestions (new)
  // -----------------------
  const fetchBatchSuggestions = async (term: string) => {
    if (term.trim().length < 2) {
      setBatchSuggestions([]);
      setShowBatchSuggestions(false);
      return;
    }
    setBatchSearchLoading(true);
    try {
      const res = await batchService.getBatchesArray({
        search: term.trim(),
        per_page: 10,
      });

      // prefer batch_number startsWith if possible
      const t = term.trim().toLowerCase();
      const filtered = res.filter((b) => (b.batch_number || '').toLowerCase().includes(t));

      setBatchSuggestions(filtered);
      setShowBatchSuggestions(filtered.length > 0);
    } catch {
      setBatchSuggestions([]);
    } finally {
      setBatchSearchLoading(false);
    }
  };

  // -----------------------
  // Effects: debounce inputs
  // -----------------------
  React.useEffect(() => {
    const id = setTimeout(() => {
      if (phoneNumber.trim() && activeTab === 'customer') fetchSuggestions(phoneNumber);
      else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    }, 300);
    return () => clearTimeout(id);
  }, [phoneNumber, activeTab]);

  React.useEffect(() => {
    const id = setTimeout(() => {
      if (orderNumber.trim() && activeTab === 'order') fetchOrderSuggestions(orderNumber);
      else {
        setOrderSuggestions([]);
        setShowOrderSuggestions(false);
      }
    }, 300);
    return () => clearTimeout(id);
  }, [orderNumber, activeTab]);

  React.useEffect(() => {
    const id = setTimeout(() => {
      if (batchQuery.trim() && activeTab === 'batch') fetchBatchSuggestions(batchQuery);
      else {
        setBatchSuggestions([]);
        setShowBatchSuggestions(false);
      }
    }, 300);
    return () => clearTimeout(id);
  }, [batchQuery, activeTab]);

  // Click outside close dropdowns
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.search-container')) setShowSuggestions(false);
      if (!target.closest('.order-search-container')) setShowOrderSuggestions(false);
      if (!target.closest('.batch-search-container')) setShowBatchSuggestions(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // -----------------------
  // Customer handlers
  // -----------------------
  const handleSelectSuggestion = async (selectedCustomer: Customer) => {
    setPhoneNumber(selectedCustomer.phone);
    setShowSuggestions(false);
    setSuggestions([]);

    setLoading(true);
    setError('');
    setCustomer(null);
    setOrders([]);
    setSingleOrder(null);

    try {
      setCustomer(selectedCustomer);

      const ordersResponse = await customerService.getOrderHistory(selectedCustomer.id, {
        per_page: 100,
        page: 1,
      });

      setOrders(ordersResponse.data || []);
    } catch (err: any) {
      setError(err.message || 'An error occurred while loading customer data');
    } finally {
      setLoading(false);
    }
  };

  const handleSearchCustomer = async () => {
    if (!phoneNumber.trim()) {
      setError('Please enter a phone number');
      return;
    }

    setShowSuggestions(false);
    setSuggestions([]);

    setLoading(true);
    setError('');
    setCustomer(null);
    setOrders([]);
    setSingleOrder(null);

    try {
      const formattedPhone = formatPhoneNumber(phoneNumber);

      const searchResults = await customerService.search({
        phone: formattedPhone,
        per_page: 10,
      });

      if (!searchResults.data || searchResults.data.length === 0) {
        setError('No customer found with this phone number');
        return;
      }

      const exact = searchResults.data.find((c) => c.phone.replace(/\D/g, '') === formattedPhone);
      if (!exact) {
        setError(`No customer found with phone number: ${phoneNumber}`);
        return;
      }

      setCustomer(exact);

      const ordersResponse = await customerService.getOrderHistory(exact.id, {
        per_page: 100,
        page: 1,
      });
      setOrders(ordersResponse.data || []);
    } catch (err: any) {
      setError(err.message || 'An error occurred while searching');
    } finally {
      setLoading(false);
    }
  };

  // -----------------------
  // Order handlers
  // -----------------------
  const handleSelectOrderSuggestion = async (selected: CustomerOrder) => {
    setOrderNumber(selected.order_number);
    setShowOrderSuggestions(false);
    setOrderSuggestions([]);

    setLoading(true);
    setError('');
    setSingleOrder(null);
    setCustomer(null);
    setOrders([]);

    try {
      setSingleOrder(selected);

      const fullOrder: any = await orderService.getById(selected.id);

      if (fullOrder.customer) {
        const customerData: Customer = {
          id: fullOrder.customer.id,
          customer_code: fullOrder.customer.customer_code,
          name: fullOrder.customer.name,
          phone: fullOrder.customer.phone,
          email: fullOrder.customer.email,
          customer_type: 'retail',
          status: 'active',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        setCustomer(customerData);
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred while loading order data');
    } finally {
      setLoading(false);
    }
  };

  const handleSearchOrder = async () => {
    if (!orderNumber.trim()) {
      setError('Please enter an order number');
      return;
    }

    setLoading(true);
    setError('');
    setSingleOrder(null);
    setCustomer(null);
    setOrders([]);

    try {
      const cleanOrderNumber = orderNumber.trim().replace(/^#/, '');

      const ordersResponse: any = await orderService.getAll({
        search: cleanOrderNumber,
        per_page: 50,
      });

      if (!ordersResponse.data || ordersResponse.data.length === 0) {
        setError(`No order found with number: ${cleanOrderNumber}`);
        return;
      }

      let found = ordersResponse.data.find(
        (o: any) => o.order_number.toLowerCase() === cleanOrderNumber.toLowerCase()
      );

      if (!found) {
        found = ordersResponse.data.find((o: any) =>
          o.order_number.toLowerCase().includes(cleanOrderNumber.toLowerCase())
        );
      }

      if (!found) found = ordersResponse.data[0];

      const orderData: CustomerOrder = {
        id: found.id,
        order_number: found.order_number,
        order_date: found.order_date,
        order_type: found.order_type,
        order_type_label: found.order_type_label || found.order_type,
        total_amount: found.total_amount,
        paid_amount: found.paid_amount,
        outstanding_amount: found.outstanding_amount,
        payment_status: found.payment_status,
        status: found.status,
        store: found.store,
        items: found.items || [],
        shipping_address: found.shipping_address,
        notes: found.notes,
      };

      setSingleOrder(orderData);

      if (found.customer) {
        const customerData: Customer = {
          id: found.customer.id,
          customer_code: found.customer.customer_code,
          name: found.customer.name,
          phone: found.customer.phone,
          email: found.customer.email,
          customer_type: 'retail',
          status: 'active',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        setCustomer(customerData);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'An error occurred while searching for the order');
    } finally {
      setLoading(false);
    }
  };

  // -----------------------
  // Barcode handlers (new)
  // -----------------------
  const handleSearchBarcode = async () => {
    const code = barcodeInput.trim();
    if (!code) {
      setError('Please enter a barcode');
      return;
    }

    setBarcodeLoading(true);
    setError('');
    setBarcodeData(null);

    try {
      const res = await barcodeTrackingService.getBarcodeHistory(code);
      if (!res?.success) {
        setError('Barcode not found');
        return;
      }
      setBarcodeData(res.data as any);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch barcode history');
    } finally {
      setBarcodeLoading(false);
    }
  };

  // -----------------------
  // Batch handlers (new)
  // -----------------------
  const handleSelectBatchSuggestion = async (b: Batch) => {
    setBatchQuery(b.batch_number);
    setSelectedBatchId(b.id);
    setShowBatchSuggestions(false);
    setBatchSuggestions([]);

    await handleSearchBatch(b.id);
  };

  const handleSearchBatch = async (forcedBatchId?: number) => {
    const batchId = forcedBatchId || selectedBatchId;

    // If no selected ID, try parsing numeric ID from input
    let finalBatchId: number | null = batchId ?? null;
    if (!finalBatchId) {
      const maybe = Number(batchQuery.trim());
      if (!Number.isNaN(maybe) && maybe > 0) finalBatchId = maybe;
    }

    if (!finalBatchId) {
      setError('Select a batch from suggestions or enter a batch ID');
      return;
    }

    setBatchLoading(true);
    setError('');
    setBatchData(null);

    try {
      const res = await barcodeTrackingService.getBatchBarcodes(finalBatchId);
      if (!res?.success) {
        setError('Batch not found');
        return;
      }
      setBatchData(res.data as any);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch batch history');
    } finally {
      setBatchLoading(false);
    }
  };

  // Quick open barcode from batch table
  const openBarcodeFromBatch = (barcode: string) => {
    setActiveTab('barcode');
    setBarcodeInput(barcode);
    setBarcodeData(null);
    setError('');
    setTimeout(() => handleSearchBarcode(), 0);
  };

  // Tab switch reset (light)
  const switchTab = (tab: LookupTab) => {
    setActiveTab(tab);
    setError('');
    setExpandedOrderId(null);

    if (tab === 'customer') {
      setSingleOrder(null);
    }
    if (tab === 'order') {
      setOrders([]);
    }
    if (tab === 'barcode') {
      setBarcodeData(null);
    }
    if (tab === 'batch') {
      setBatchData(null);
    }
  };

  return (
    <div className={darkMode ? 'dark' : ''}>
      <div className="flex h-screen bg-white dark:bg-black">
        <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />

        <div className="flex-1 flex flex-col overflow-hidden">
          <Header
            darkMode={darkMode}
            setDarkMode={setDarkMode}
            toggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          />

          <main className="flex-1 overflow-auto bg-white dark:bg-black">
            {/* Header + Tabs */}
            <div className="border-b border-gray-200 dark:border-gray-800">
              <div className="px-4 py-2">
                <div className="max-w-7xl mx-auto">
                  <h1 className="text-base font-semibold text-black dark:text-white leading-none mb-2">
                    Lookup
                  </h1>

                  <div className="flex gap-1 flex-wrap">
                    <button
                      onClick={() => switchTab('customer')}
                      className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                        activeTab === 'customer'
                          ? 'bg-black dark:bg-white text-white dark:text-black'
                          : 'bg-gray-100 dark:bg-gray-900 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800'
                      }`}
                    >
                      Customer Lookup
                    </button>

                    <button
                      onClick={() => switchTab('order')}
                      className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                        activeTab === 'order'
                          ? 'bg-black dark:bg-white text-white dark:text-black'
                          : 'bg-gray-100 dark:bg-gray-900 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800'
                      }`}
                    >
                      Order Lookup
                    </button>

                    <button
                      onClick={() => switchTab('barcode')}
                      className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                        activeTab === 'barcode'
                          ? 'bg-black dark:bg-white text-white dark:text-black'
                          : 'bg-gray-100 dark:bg-gray-900 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800'
                      }`}
                    >
                      Barcode History
                    </button>

                    <button
                      onClick={() => switchTab('batch')}
                      className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                        activeTab === 'batch'
                          ? 'bg-black dark:bg-white text-white dark:text-black'
                          : 'bg-gray-100 dark:bg-gray-900 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800'
                      }`}
                    >
                      Batch History
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Main Content */}
            <div className="max-w-6xl mx-auto px-4 py-4">
              {/* Error */}
              {error && (
                <p className="mb-3 text-xs text-red-600 dark:text-red-400">
                  {error}
                </p>
              )}

              {/* =========================
                  CUSTOMER PANEL (existing)
                  ========================= */}
              {activeTab === 'customer' && (
                <>
                  <div className="mb-4">
                    <div className="relative max-w-xl mx-auto search-container">
                      <div className="relative">
                        <input
                          type="text"
                          value={phoneNumber}
                          onChange={(e) => setPhoneNumber(e.target.value)}
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') handleSearchCustomer();
                          }}
                          onFocus={() => {
                            if (suggestions.length > 0) setShowSuggestions(true);
                          }}
                          placeholder="Type phone number..."
                          className="w-full pl-3 pr-24 py-2.5 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 text-black dark:text-white text-sm placeholder-gray-400 focus:outline-none focus:border-black dark:focus:border-white transition-colors"
                        />
                        <button
                          onClick={handleSearchCustomer}
                          disabled={loading}
                          className="absolute right-1.5 top-1/2 transform -translate-y-1/2 px-4 py-1.5 bg-black dark:bg-white text-white dark:text-black rounded hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium text-xs"
                        >
                          {loading ? 'Searching...' : 'Search'}
                        </button>

                        {showSuggestions && suggestions.length > 0 && (
                          <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-md shadow-xl max-h-80 overflow-y-auto z-50">
                            {searchLoading && (
                              <div className="px-3 py-2 text-center">
                                <div className="w-4 h-4 border-2 border-gray-300 dark:border-gray-700 border-t-black dark:border-t-white rounded-full animate-spin mx-auto"></div>
                              </div>
                            )}

                            {suggestions.map((s, index) => (
                              <button
                                key={s.id}
                                onClick={() => handleSelectSuggestion(s)}
                                className={`w-full px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left ${
                                  index !== suggestions.length - 1 ? 'border-b border-gray-100 dark:border-gray-800' : ''
                                }`}
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-black dark:text-white mb-0.5">
                                      {s.phone}
                                    </p>
                                    <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
                                      {s.name}
                                    </p>
                                  </div>
                                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-black dark:bg-white text-white dark:text-black font-medium uppercase">
                                    {s.customer_type}
                                  </span>
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {customer && (
                    <div className="border border-gray-200 dark:border-gray-800 rounded-md p-3 mb-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-semibold text-black dark:text-white">{customer.name}</p>
                          <p className="text-xs text-gray-600 dark:text-gray-400">{customer.phone}</p>
                          {customer.customer_code && (
                            <p className="text-[10px] text-gray-500 dark:text-gray-500">Code: {customer.customer_code}</p>
                          )}
                        </div>
                        <span className="text-[10px] px-2 py-1 rounded bg-gray-100 dark:bg-gray-900 text-gray-700 dark:text-gray-300">
                          {orders.length} orders
                        </span>
                      </div>
                    </div>
                  )}

                  {orders.length > 0 && (
                    <div className="border border-gray-200 dark:border-gray-800 rounded-md overflow-hidden">
                      <div className="bg-gray-50 dark:bg-gray-900 px-3 py-2 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
                        <h2 className="text-xs font-semibold text-black dark:text-white uppercase tracking-wide">
                          Order History
                        </h2>
                        <span className="text-[9px] px-2 py-0.5 bg-black dark:bg-white text-white dark:text-black rounded font-medium">
                          {orders.length}
                        </span>
                      </div>

                      <div className="divide-y divide-gray-200 dark:divide-gray-800">
                        {orders.map((order) => (
                          <div key={order.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors">
                            <div className="p-3 cursor-pointer" onClick={() => toggleOrderDetails(order.id)}>
                              <div className="grid grid-cols-5 gap-3">
                                <div>
                                  <p className="text-[9px] text-gray-500 dark:text-gray-500 uppercase font-medium mb-0.5">Order #</p>
                                  <p className="text-xs font-medium text-black dark:text-white">{order.order_number}</p>
                                </div>
                                <div>
                                  <p className="text-[9px] text-gray-500 dark:text-gray-500 uppercase font-medium mb-0.5">Date</p>
                                  <p className="text-xs text-black dark:text-white">{formatDate(order.order_date)}</p>
                                </div>
                                <div>
                                  <p className="text-[9px] text-gray-500 dark:text-gray-500 uppercase font-medium mb-0.5">Type</p>
                                  <p className="text-xs text-black dark:text-white">{formatOrderType(order)}</p>
                                </div>
                                <div>
                                  <p className="text-[9px] text-gray-500 dark:text-gray-500 uppercase font-medium mb-0.5">Total</p>
                                  <p className="text-xs font-medium text-black dark:text-white">{formatCurrency(order.total_amount)}</p>
                                </div>
                                <div>
                                  <p className="text-[9px] text-gray-500 dark:text-gray-500 uppercase font-medium mb-0.5">Payment</p>
                                  {getStatusBadge(order.payment_status)}
                                </div>
                              </div>
                            </div>

                            {expandedOrderId === order.id && (
                              <div className="px-3 pb-3 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
                                <div className="pt-3 space-y-2">
                                  <div>
                                    <p className="text-[9px] font-semibold text-black dark:text-white uppercase mb-1.5">Items</p>
                                    <div className="bg-white dark:bg-black rounded border border-gray-200 dark:border-gray-800 overflow-hidden">
                                      <table className="w-full text-[10px]">
                                        <thead className="bg-gray-50 dark:bg-gray-900">
                                          <tr>
                                            <th className="px-2 py-1.5 text-left text-[9px] font-semibold text-gray-700 dark:text-gray-300 uppercase">Product</th>
                                            <th className="px-2 py-1.5 text-left text-[9px] font-semibold text-gray-700 dark:text-gray-300 uppercase">SKU</th>
                                            <th className="px-2 py-1.5 text-right text-[9px] font-semibold text-gray-700 dark:text-gray-300 uppercase">Qty</th>
                                            <th className="px-2 py-1.5 text-right text-[9px] font-semibold text-gray-700 dark:text-gray-300 uppercase">Price</th>
                                            <th className="px-2 py-1.5 text-right text-[9px] font-semibold text-gray-700 dark:text-gray-300 uppercase">Total</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                                          {order.items.map((item) => (
                                            <tr key={item.id}>
                                              <td className="px-2 py-1.5 font-medium text-black dark:text-white">{item.product_name}</td>
                                              <td className="px-2 py-1.5 text-gray-600 dark:text-gray-400">{item.product_sku}</td>
                                              <td className="px-2 py-1.5 text-right font-medium text-black dark:text-white">{item.quantity}</td>
                                              <td className="px-2 py-1.5 text-right text-gray-600 dark:text-gray-400">{formatCurrency(item.unit_price)}</td>
                                              <td className="px-2 py-1.5 text-right font-medium text-black dark:text-white">{formatCurrency(item.total_amount)}</td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>

                                  <div className="grid grid-cols-2 gap-2">
                                    <div>
                                      <p className="text-[9px] font-semibold text-black dark:text-white uppercase mb-1">Store</p>
                                      <p className="text-[10px] text-gray-600 dark:text-gray-400 font-medium">{order.store.name}</p>
                                    </div>
                                    <div>
                                      <p className="text-[9px] font-semibold text-black dark:text-white uppercase mb-1">Payment</p>
                                      <div className="space-y-0.5 text-[10px]">
                                        <div className="flex justify-between">
                                          <span className="text-gray-600 dark:text-gray-400">Total:</span>
                                          <span className="font-medium text-black dark:text-white">{formatCurrency(order.total_amount)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span className="text-gray-600 dark:text-gray-400">Paid:</span>
                                          <span className="font-medium text-green-600 dark:text-green-400">{formatCurrency(order.paid_amount)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span className="text-gray-600 dark:text-gray-400">Due:</span>
                                          <span className="font-medium text-red-600 dark:text-red-400">{formatCurrency(order.outstanding_amount)}</span>
                                        </div>
                                      </div>
                                    </div>
                                  </div>

                                  {order.notes && (
                                    <div>
                                      <p className="text-[9px] font-semibold text-black dark:text-white uppercase mb-1">Notes</p>
                                      <p className="text-[10px] text-gray-600 dark:text-gray-400">{order.notes}</p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* ======================
                  ORDER PANEL (existing)
                  ====================== */}
              {activeTab === 'order' && (
                <>
                  <div className="mb-4">
                    <div className="relative max-w-xl mx-auto order-search-container">
                      <div className="relative">
                        <input
                          type="text"
                          value={orderNumber}
                          onChange={(e) => setOrderNumber(e.target.value)}
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') handleSearchOrder();
                          }}
                          onFocus={() => {
                            if (orderSuggestions.length > 0) setShowOrderSuggestions(true);
                          }}
                          placeholder="Type order number..."
                          className="w-full pl-3 pr-24 py-2.5 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 text-black dark:text-white text-sm placeholder-gray-400 focus:outline-none focus:border-black dark:focus:border-white transition-colors"
                        />
                        <button
                          onClick={handleSearchOrder}
                          disabled={loading}
                          className="absolute right-1.5 top-1/2 transform -translate-y-1/2 px-4 py-1.5 bg-black dark:bg-white text-white dark:text-black rounded hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium text-xs"
                        >
                          {loading ? 'Searching...' : 'Search'}
                        </button>

                        {showOrderSuggestions && orderSuggestions.length > 0 && (
                          <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-md shadow-xl max-h-80 overflow-y-auto z-50">
                            {orderSearchLoading && (
                              <div className="px-3 py-2 text-center">
                                <div className="w-4 h-4 border-2 border-gray-300 dark:border-gray-700 border-t-black dark:border-t-white rounded-full animate-spin mx-auto"></div>
                              </div>
                            )}
                            {orderSuggestions.map((s, index) => (
                              <button
                                key={s.id}
                                onClick={() => handleSelectOrderSuggestion(s)}
                                className={`w-full px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left ${
                                  index !== orderSuggestions.length - 1 ? 'border-b border-gray-100 dark:border-gray-800' : ''
                                }`}
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-black dark:text-white mb-0.5">
                                      {s.order_number}
                                    </p>
                                    <div className="flex items-center gap-2 text-xs">
                                      <span className="text-gray-600 dark:text-gray-400">
                                        {formatDate(s.order_date)}
                                      </span>
                                      <span className="text-gray-400">•</span>
                                      <span className="font-medium text-gray-600 dark:text-gray-400">
                                        {formatCurrency(s.total_amount)}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    {getStatusBadge(s.payment_status)}
                                  </div>
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {singleOrder && (
                    <div className="border border-gray-200 dark:border-gray-800 rounded-md overflow-hidden">
                      <div className="bg-gray-50 dark:bg-gray-900 px-3 py-2 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
                        <h2 className="text-xs font-semibold text-black dark:text-white uppercase tracking-wide">
                          Order Details
                        </h2>
                        <span className="text-[9px] px-2 py-0.5 bg-black dark:bg-white text-white dark:text-black rounded font-medium">
                          1
                        </span>
                      </div>

                      <div className="p-3">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                          <div>
                            <p className="text-[9px] text-gray-500 uppercase font-medium">Order #</p>
                            <p className="text-sm font-semibold text-black dark:text-white">{singleOrder.order_number}</p>
                          </div>
                          <div>
                            <p className="text-[9px] text-gray-500 uppercase font-medium">Date</p>
                            <p className="text-sm text-black dark:text-white">{formatDate(singleOrder.order_date)}</p>
                          </div>
                          <div>
                            <p className="text-[9px] text-gray-500 uppercase font-medium">Total</p>
                            <p className="text-sm font-semibold text-black dark:text-white">{formatCurrency(singleOrder.total_amount)}</p>
                          </div>
                          <div>
                            <p className="text-[9px] text-gray-500 uppercase font-medium">Payment</p>
                            {getStatusBadge(singleOrder.payment_status)}
                          </div>
                        </div>

                        <div className="bg-white dark:bg-black rounded border border-gray-200 dark:border-gray-800 overflow-hidden">
                          <table className="w-full text-[10px]">
                            <thead className="bg-gray-50 dark:bg-gray-900">
                              <tr>
                                <th className="px-2 py-1.5 text-left text-[9px] font-semibold text-gray-700 dark:text-gray-300 uppercase">Product</th>
                                <th className="px-2 py-1.5 text-right text-[9px] font-semibold text-gray-700 dark:text-gray-300 uppercase">Qty</th>
                                <th className="px-2 py-1.5 text-right text-[9px] font-semibold text-gray-700 dark:text-gray-300 uppercase">Total</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                              {singleOrder.items.map((item) => (
                                <tr key={item.id}>
                                  <td className="px-2 py-1.5 font-medium text-black dark:text-white">
                                    {item.product_name}
                                    <div className="text-[9px] text-gray-500">{item.product_sku}</div>
                                  </td>
                                  <td className="px-2 py-1.5 text-right text-black dark:text-white">{item.quantity}</td>
                                  <td className="px-2 py-1.5 text-right font-semibold text-black dark:text-white">
                                    {formatCurrency(item.total_amount)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        {singleOrder.notes && (
                          <div className="mt-3">
                            <p className="text-[9px] font-semibold text-black dark:text-white uppercase mb-1">Notes</p>
                            <p className="text-[10px] text-gray-600 dark:text-gray-400">{singleOrder.notes}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* ======================
                  BARCODE PANEL (new)
                  ====================== */}
              {activeTab === 'barcode' && (
                <>
                  <div className="mb-4">
                    <div className="relative max-w-xl mx-auto">
                      <div className="relative">
                        <input
                          type="text"
                          value={barcodeInput}
                          onChange={(e) => setBarcodeInput(e.target.value)}
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') handleSearchBarcode();
                          }}
                          placeholder="Type barcode..."
                          className="w-full pl-3 pr-24 py-2.5 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 text-black dark:text-white text-sm placeholder-gray-400 focus:outline-none focus:border-black dark:focus:border-white transition-colors"
                        />
                        <button
                          onClick={handleSearchBarcode}
                          disabled={barcodeLoading}
                          className="absolute right-1.5 top-1/2 transform -translate-y-1/2 px-4 py-1.5 bg-black dark:bg-white text-white dark:text-black rounded hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium text-xs"
                        >
                          {barcodeLoading ? 'Loading...' : 'Search'}
                        </button>
                      </div>
                    </div>
                  </div>

                  {barcodeData && (
                    <div className="space-y-3">
                      <div className="border border-gray-200 dark:border-gray-800 rounded-md p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-xs font-semibold text-black dark:text-white">
                              {barcodeData.product.name}{' '}
                              <span className="text-gray-500 text-[10px]">
                                {barcodeData.product.sku ? `(${barcodeData.product.sku})` : ''}
                              </span>
                            </p>
                            <p className="text-[10px] text-gray-600 dark:text-gray-400">
                              Barcode: <span className="font-semibold">{barcodeData.barcode}</span>
                            </p>
                          </div>
                          <span className="text-[10px] px-2 py-1 rounded bg-gray-100 dark:bg-gray-900 text-gray-700 dark:text-gray-300">
                            {barcodeData.total_movements} movements
                          </span>
                        </div>

                        {/* Current location */}
                        {barcodeData.current_location && (
                          <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-2">
                            <div className="border border-gray-200 dark:border-gray-800 rounded p-2">
                              <p className="text-[9px] text-gray-500 uppercase font-medium mb-1">Status</p>
                              <p className="text-xs font-semibold text-black dark:text-white">
                                {barcodeData.current_location.status_label || barcodeData.current_location.current_status}
                              </p>
                            </div>
                            <div className="border border-gray-200 dark:border-gray-800 rounded p-2">
                              <p className="text-[9px] text-gray-500 uppercase font-medium mb-1">Current Store</p>
                              <p className="text-xs text-black dark:text-white">
                                {barcodeData.current_location.current_store?.name || '—'}
                              </p>
                            </div>
                            <div className="border border-gray-200 dark:border-gray-800 rounded p-2">
                              <p className="text-[9px] text-gray-500 uppercase font-medium mb-1">Batch</p>
                              <p className="text-xs text-black dark:text-white">
                                {barcodeData.current_location.batch?.batch_number || '—'}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Movement History Table */}
                      <div className="border border-gray-200 dark:border-gray-800 rounded-md overflow-hidden">
                        <div className="bg-gray-50 dark:bg-gray-900 px-3 py-2 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
                          <h2 className="text-xs font-semibold text-black dark:text-white uppercase tracking-wide">
                            Barcode Movement History
                          </h2>
                          <span className="text-[9px] px-2 py-0.5 bg-black dark:bg-white text-white dark:text-black rounded font-medium">
                            {barcodeData.history?.length || 0}
                          </span>
                        </div>

                        <div className="overflow-x-auto">
                          <table className="w-full text-[10px]">
                            <thead className="bg-white dark:bg-black">
                              <tr className="border-b border-gray-200 dark:border-gray-800">
                                <th className="px-2 py-2 text-left text-[9px] font-semibold text-gray-700 dark:text-gray-300 uppercase">Date</th>
                                <th className="px-2 py-2 text-left text-[9px] font-semibold text-gray-700 dark:text-gray-300 uppercase">Type</th>
                                <th className="px-2 py-2 text-left text-[9px] font-semibold text-gray-700 dark:text-gray-300 uppercase">From</th>
                                <th className="px-2 py-2 text-left text-[9px] font-semibold text-gray-700 dark:text-gray-300 uppercase">To</th>
                                <th className="px-2 py-2 text-left text-[9px] font-semibold text-gray-700 dark:text-gray-300 uppercase">Status</th>
                                <th className="px-2 py-2 text-left text-[9px] font-semibold text-gray-700 dark:text-gray-300 uppercase">By</th>
                                <th className="px-2 py-2 text-left text-[9px] font-semibold text-gray-700 dark:text-gray-300 uppercase">Ref</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                              {(barcodeData.history || []).map((h) => (
                                <tr key={h.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/40">
                                  <td className="px-2 py-2 text-gray-700 dark:text-gray-300">{formatDate(h.date)}</td>
                                  <td className="px-2 py-2 font-semibold text-black dark:text-white">
                                    {h.movement_type || '—'}
                                  </td>
                                  <td className="px-2 py-2 text-gray-700 dark:text-gray-300">{h.from_store || '—'}</td>
                                  <td className="px-2 py-2 text-gray-700 dark:text-gray-300">{h.to_store || '—'}</td>
                                  <td className="px-2 py-2 text-gray-700 dark:text-gray-300">
                                    {(h.status_before || '—') + ' → ' + (h.status_after || '—')}
                                  </td>
                                  <td className="px-2 py-2 text-gray-700 dark:text-gray-300">{h.performed_by || '—'}</td>
                                  <td className="px-2 py-2 text-gray-700 dark:text-gray-300">
                                    {h.reference_type ? `${h.reference_type}#${h.reference_id ?? ''}` : '—'}
                                  </td>
                                </tr>
                              ))}
                              {!barcodeData.history?.length && (
                                <tr>
                                  <td colSpan={7} className="px-3 py-6 text-center text-xs text-gray-500 dark:text-gray-400">
                                    No movement history found for this barcode.
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* ======================
                  BATCH PANEL (new)
                  ====================== */}
              {activeTab === 'batch' && (
                <>
                  <div className="mb-4">
                    <div className="relative max-w-xl mx-auto batch-search-container">
                      <div className="relative">
                        <input
                          type="text"
                          value={batchQuery}
                          onChange={(e) => {
                            setBatchQuery(e.target.value);
                            setSelectedBatchId(null);
                          }}
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') handleSearchBatch();
                          }}
                          onFocus={() => {
                            if (batchSuggestions.length > 0) setShowBatchSuggestions(true);
                          }}
                          placeholder="Type batch number (or batch ID)..."
                          className="w-full pl-3 pr-24 py-2.5 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 text-black dark:text-white text-sm placeholder-gray-400 focus:outline-none focus:border-black dark:focus:border-white transition-colors"
                        />
                        <button
                          onClick={() => handleSearchBatch()}
                          disabled={batchLoading}
                          className="absolute right-1.5 top-1/2 transform -translate-y-1/2 px-4 py-1.5 bg-black dark:bg-white text-white dark:text-black rounded hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium text-xs"
                        >
                          {batchLoading ? 'Loading...' : 'Search'}
                        </button>

                        {showBatchSuggestions && batchSuggestions.length > 0 && (
                          <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-md shadow-xl max-h-80 overflow-y-auto z-50">
                            {batchSearchLoading && (
                              <div className="px-3 py-2 text-center">
                                <div className="w-4 h-4 border-2 border-gray-300 dark:border-gray-700 border-t-black dark:border-t-white rounded-full animate-spin mx-auto"></div>
                              </div>
                            )}

                            {batchSuggestions.map((b, index) => (
                              <button
                                key={b.id}
                                onClick={() => handleSelectBatchSuggestion(b)}
                                className={`w-full px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left ${
                                  index !== batchSuggestions.length - 1 ? 'border-b border-gray-100 dark:border-gray-800' : ''
                                }`}
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-black dark:text-white mb-0.5">
                                      {b.batch_number}
                                    </p>
                                    <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
                                      {b.product?.name} {b.product?.sku ? `(${b.product.sku})` : ''} • {b.store?.name}
                                    </p>
                                  </div>
                                  <span className="text-[9px] px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-semibold">
                                    ID: {b.id}
                                  </span>
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {batchData && (
                    <div className="space-y-3">
                      <div className="border border-gray-200 dark:border-gray-800 rounded-md p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-xs font-semibold text-black dark:text-white">
                              Batch: {batchData.batch.batch_number}{' '}
                              <span className="text-gray-500 text-[10px]"> (ID: {batchData.batch.id})</span>
                            </p>
                            <p className="text-[10px] text-gray-600 dark:text-gray-400">
                              Product: <span className="font-semibold">{batchData.batch.product.name}</span>{' '}
                              {batchData.batch.product.sku ? `(${batchData.batch.product.sku})` : ''}
                            </p>
                          </div>
                        </div>

                        <div className="mt-3 grid grid-cols-2 md:grid-cols-5 gap-2">
                          <div className="border border-gray-200 dark:border-gray-800 rounded p-2">
                            <p className="text-[9px] text-gray-500 uppercase font-medium mb-1">Total</p>
                            <p className="text-xs font-semibold text-black dark:text-white">{batchData.summary.total_units}</p>
                          </div>
                          <div className="border border-gray-200 dark:border-gray-800 rounded p-2">
                            <p className="text-[9px] text-gray-500 uppercase font-medium mb-1">Active</p>
                            <p className="text-xs font-semibold text-black dark:text-white">{batchData.summary.active}</p>
                          </div>
                          <div className="border border-gray-200 dark:border-gray-800 rounded p-2">
                            <p className="text-[9px] text-gray-500 uppercase font-medium mb-1">Available</p>
                            <p className="text-xs font-semibold text-black dark:text-white">{batchData.summary.available_for_sale}</p>
                          </div>
                          <div className="border border-gray-200 dark:border-gray-800 rounded p-2">
                            <p className="text-[9px] text-gray-500 uppercase font-medium mb-1">Sold</p>
                            <p className="text-xs font-semibold text-black dark:text-white">{batchData.summary.sold}</p>
                          </div>
                          <div className="border border-gray-200 dark:border-gray-800 rounded p-2">
                            <p className="text-[9px] text-gray-500 uppercase font-medium mb-1">Defective</p>
                            <p className="text-xs font-semibold text-black dark:text-white">{batchData.summary.defective}</p>
                          </div>
                        </div>
                      </div>

                      {/* Barcodes Table */}
                      <div className="border border-gray-200 dark:border-gray-800 rounded-md overflow-hidden">
                        <div className="bg-gray-50 dark:bg-gray-900 px-3 py-2 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
                          <h2 className="text-xs font-semibold text-black dark:text-white uppercase tracking-wide">
                            Batch Units (Barcodes)
                          </h2>
                          <span className="text-[9px] px-2 py-0.5 bg-black dark:bg-white text-white dark:text-black rounded font-medium">
                            {batchData.barcodes.length}
                          </span>
                        </div>

                        <div className="overflow-x-auto">
                          <table className="w-full text-[10px]">
                            <thead className="bg-white dark:bg-black">
                              <tr className="border-b border-gray-200 dark:border-gray-800">
                                <th className="px-2 py-2 text-left text-[9px] font-semibold text-gray-700 dark:text-gray-300 uppercase">Barcode</th>
                                <th className="px-2 py-2 text-left text-[9px] font-semibold text-gray-700 dark:text-gray-300 uppercase">Status</th>
                                <th className="px-2 py-2 text-left text-[9px] font-semibold text-gray-700 dark:text-gray-300 uppercase">Store</th>
                                <th className="px-2 py-2 text-left text-[9px] font-semibold text-gray-700 dark:text-gray-300 uppercase">Updated</th>
                                <th className="px-2 py-2 text-left text-[9px] font-semibold text-gray-700 dark:text-gray-300 uppercase">Flags</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                              {batchData.barcodes.map((b) => (
                                <tr key={b.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/40">
                                  <td className="px-2 py-2">
                                    <button
                                      onClick={() => openBarcodeFromBatch(b.barcode)}
                                      className="text-black dark:text-white font-semibold hover:underline"
                                      title="Open barcode history"
                                    >
                                      {b.barcode}
                                    </button>
                                  </td>
                                  <td className="px-2 py-2 text-gray-700 dark:text-gray-300">
                                    {b.status_label || b.current_status}
                                  </td>
                                  <td className="px-2 py-2 text-gray-700 dark:text-gray-300">
                                    {b.current_store?.name || '—'}
                                  </td>
                                  <td className="px-2 py-2 text-gray-700 dark:text-gray-300">
                                    {b.location_updated_at ? formatDate(b.location_updated_at) : '—'}
                                  </td>
                                  <td className="px-2 py-2 text-gray-700 dark:text-gray-300">
                                    <div className="flex gap-1 flex-wrap">
                                      {!b.is_active && (
                                        <span className="text-[9px] px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800">
                                          inactive
                                        </span>
                                      )}
                                      {b.is_defective && (
                                        <span className="text-[9px] px-2 py-0.5 rounded bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">
                                          defective
                                        </span>
                                      )}
                                      {b.is_available_for_sale && (
                                        <span className="text-[9px] px-2 py-0.5 rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                                          sale
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              ))}
                              {!batchData.barcodes.length && (
                                <tr>
                                  <td colSpan={5} className="px-3 py-6 text-center text-xs text-gray-500 dark:text-gray-400">
                                    No units found for this batch.
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
