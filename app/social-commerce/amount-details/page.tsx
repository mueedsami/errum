'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Globe, DollarSign, CreditCard, Wallet, XCircle } from 'lucide-react';
import Header from '@/components/Header';
import Sidebar from '@/components/Sidebar';

// Import axios from your custom instance
const axios = typeof window !== 'undefined' ? require('@/lib/axios').default : null;

interface PaymentMethod {
  id: number;
  code: string;
  name: string;
  type: string;
  supports_partial: boolean;
  requires_reference: boolean;
  fixed_fee: number;
  percentage_fee: number;
}

interface OrderData {
  store_id: string | number;
  customer: {
    name: string;
    email: string;
    phone: string;
    address: string;
  };
  items: Array<{
    product_id: number | string;
    batch_id?: number | string | null;
    barcode?: string | null;

    // UI-only fields that must NOT be sent to backend
    productName?: string;
    product_name?: string;
    product?: { name?: string };

    quantity: number | string;
    unit_price: number | string;
    discount_amount?: number | string | null;
    amount?: number | string | null;
  }>;
  subtotal: number;
  isInternational: boolean;
  deliveryAddress: any;
  defectiveItems?: Array<any>;
  notes?: string;
}

type ToastType = 'success' | 'error';

export default function AmountDetailsPage() {
  const [darkMode, setDarkMode] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [orderData, setOrderData] = useState<OrderData | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const [vatRate, setVatRate] = useState('5');
  const [transportCost, setTransportCost] = useState('0');

  // Payment options: 'full', 'partial', or 'none'
  const [paymentOption, setPaymentOption] = useState<'full' | 'partial' | 'none'>('full');
  const [advanceAmount, setAdvanceAmount] = useState('');

  // Payment methods
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('');
  const [transactionReference, setTransactionReference] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');

  // COD payment method
  const [codPaymentMethod, setCodPaymentMethod] = useState('');

  const [toast, setToast] = useState({ show: false, message: '', type: 'success' as ToastType });

  const displayToast = (message: string, type: ToastType = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000);
  };

  const toNumber = (v: any, fallback = 0) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  };

  const safeTrim = (v: any) => (typeof v === 'string' ? v.trim() : '');

  const getItemName = (item: any) =>
    item?.productName ||
    item?.product_name ||
    item?.product?.name ||
    (item?.product_id ? `Product #${item.product_id}` : 'Product');

  const getDeliveryAddressText = (od: OrderData) => {
    return (
      safeTrim(od?.customer?.address) ||
      safeTrim(od?.deliveryAddress?.address) ||
      safeTrim(od?.deliveryAddress?.full_address) ||
      safeTrim(od?.deliveryAddress?.delivery_address) ||
      safeTrim(od?.deliveryAddress?.street) ||
      '—'
    );
  };

  const calculateItemAmount = (item: any): number => {
    if (item?.amount !== undefined && item?.amount !== null && item?.amount !== '') {
      return toNumber(item.amount, 0);
    }
    const unitPrice = toNumber(item?.unit_price, 0);
    const qty = toNumber(item?.quantity, 0);
    const discount = toNumber(item?.discount_amount, 0);
    return unitPrice * qty - discount;
  };

  // Load pendingOrder + fetch payment methods
  useEffect(() => {
    const storedOrder = sessionStorage.getItem('pendingOrder');
    if (storedOrder) {
      const parsedOrder = JSON.parse(storedOrder);

      // Normalize items + amount
      if (parsedOrder.items) {
        parsedOrder.items = parsedOrder.items.map((item: any) => ({
          ...item,
          amount: calculateItemAmount(item),
        }));

        // If subtotal missing, calculate "after discount" subtotal
        if (!parsedOrder.subtotal || parsedOrder.subtotal === 0) {
          parsedOrder.subtotal = parsedOrder.items.reduce(
            (sum: number, item: any) => sum + calculateItemAmount(item),
            0
          );
        }
      }

      // Ensure customer object exists for UI
      parsedOrder.customer = parsedOrder.customer || { name: '', email: '', phone: '', address: '' };

      // Fill customer.address from deliveryAddress fallback (UI fix)
      if (!parsedOrder.customer.address) {
        parsedOrder.customer.address = getDeliveryAddressText(parsedOrder);
      }

      setOrderData(parsedOrder);
    } else {
      window.location.href = '/social-commerce';
      return;
    }

    const fetchPaymentMethods = async () => {
      try {
        if (!axios) return;

        const response = await axios.get('/payment-methods', {
          params: { customer_type: 'social_commerce' },
        });

        if (response.data?.success) {
          const methods = response.data?.data?.payment_methods || response.data?.data || [];
          setPaymentMethods(methods);

          // defaults
          const mobileMethod = methods.find((m: PaymentMethod) => m.type === 'mobile_banking');
          const cashMethod = methods.find((m: PaymentMethod) => m.type === 'cash');

          if (mobileMethod) setSelectedPaymentMethod(String(mobileMethod.id));
          if (cashMethod) setCodPaymentMethod(String(cashMethod.id));
        }
      } catch (error: any) {
        console.error('Error fetching payment methods:', error);

        if (error.response?.status === 401) {
          displayToast('Session expired. Please log in again.', 'error');
          localStorage.removeItem('token');
          setTimeout(() => (window.location.href = '/login'), 1500);
          return;
        }

        displayToast('Error loading payment methods', 'error');
      }
    };

    fetchPaymentMethods();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Derived totals
  const computed = useMemo(() => {
    if (!orderData) {
      return { subtotal: 0, totalDiscount: 0, vat: 0, transport: 0, total: 0 };
    }

    const items = orderData.items || [];
    const subtotal = toNumber(orderData.subtotal, 0);

    const totalDiscount =
      items.reduce((sum: number, item: any) => sum + toNumber(item?.discount_amount, 0), 0) || 0;

    const vat = (subtotal * toNumber(vatRate, 0)) / 100;
    const transport = toNumber(transportCost, 0);
    const total = subtotal + vat + transport;

    return { subtotal, totalDiscount, vat, transport, total };
  }, [orderData, vatRate, transportCost]);

  const selectedMethod = useMemo(
    () => paymentMethods.find((m) => String(m.id) === selectedPaymentMethod),
    [paymentMethods, selectedPaymentMethod]
  );

  const codMethod = useMemo(
    () => paymentMethods.find((m) => String(m.id) === codPaymentMethod),
    [paymentMethods, codPaymentMethod]
  );

  const advance = useMemo(() => {
    if (paymentOption === 'partial') return toNumber(advanceAmount, 0);
    if (paymentOption === 'full') return computed.total;
    return 0;
  }, [paymentOption, advanceAmount, computed.total]);

  const codAmount = useMemo(() => {
    if (paymentOption === 'partial') return computed.total - advance;
    if (paymentOption === 'none') return computed.total;
    return 0;
  }, [paymentOption, computed.total, advance]);

  const advanceFee = useMemo(() => {
    if (!selectedMethod || paymentOption === 'none') return 0;
    const fixed = toNumber(selectedMethod.fixed_fee, 0);
    const percent = toNumber(selectedMethod.percentage_fee, 0);
    return fixed + (advance * percent) / 100;
  }, [selectedMethod, paymentOption, advance]);

  const codFee = useMemo(() => {
    if (!(paymentOption === 'partial' || paymentOption === 'none') || !codMethod) return 0;
    const fixed = toNumber(codMethod.fixed_fee, 0);
    const percent = toNumber(codMethod.percentage_fee, 0);
    return fixed + (codAmount * percent) / 100;
  }, [paymentOption, codMethod, codAmount]);

  const totalFees = useMemo(() => toNumber(advanceFee, 0) + toNumber(codFee, 0), [advanceFee, codFee]);

  /**
   * ✅ Build payload EXACTLY as backend expects (OrderController@create)
   * - DO NOT send UI-only fields in items
   * - batch_id must be null/omitted if empty/invalid (nullable|exists)
   * - discount_amount can be 0 or omitted
   */
  const buildOrderPayload = (od: OrderData) => {
    const normalizedItems = (od.items || []).map((it: any) => {
      const product_id = toNumber(it.product_id, 0);

      // batch_id is nullable in backend, but if you send "" or 0 => exists fails
      const rawBatch = it.batch_id;
      const batch_id_num = toNumber(rawBatch, 0);
      const batch_id = batch_id_num > 0 ? batch_id_num : null;

      const barcode = safeTrim(it.barcode);

      const payloadItem: any = {
        product_id,
        quantity: Math.max(1, Math.floor(toNumber(it.quantity, 0))),
        unit_price: Math.max(0, toNumber(it.unit_price, 0)),
      };

      // Only include optional fields if valid
      if (batch_id) payloadItem.batch_id = batch_id;
      if (barcode) payloadItem.barcode = barcode;

      const disc = toNumber(it.discount_amount, 0);
      if (disc > 0) payloadItem.discount_amount = disc;

      return payloadItem;
    });

    const payload: any = {
      order_type: 'social_commerce',
      store_id: toNumber(od.store_id, 0),
      customer: {
        name: safeTrim(od.customer?.name),
        phone: safeTrim(od.customer?.phone),
        email: safeTrim(od.customer?.email) || null,
        address: getDeliveryAddressText(od) === '—' ? null : getDeliveryAddressText(od),
      },
      items: normalizedItems,
      shipping_amount: toNumber(computed.transport, 0),
      notes:
        od.notes ||
        `Social Commerce order. ${
          paymentOption === 'full'
            ? 'Full payment'
            : paymentOption === 'partial'
              ? `Advance: ৳${advance.toFixed(2)}, COD: ৳${codAmount.toFixed(2)}`
              : 'No payment - Full COD'
        }`,
    };

    // Backend allows customer.address nullable; keep it nullable
    if (!payload.customer.address) delete payload.customer.address;

    return payload;
  };

  const extractBackendErrorMessage = (err: any) => {
    const data = err?.response?.data;

    // Laravel validation format:
    // { success:false, message:"Validation failed", errors:{ field:["msg"] } }
    if (data?.errors && typeof data.errors === 'object') {
      const keys = Object.keys(data.errors);
      if (keys.length) {
        const firstKey = keys[0];
        const firstMsg = Array.isArray(data.errors[firstKey]) ? data.errors[firstKey][0] : String(data.errors[firstKey]);
        return firstMsg || data.message || 'Validation failed.';
      }
    }

    if (data?.message) return data.message;
    if (err?.message) return err.message;
    return 'Error placing order. Please try again.';
  };

  const validateClientSide = (od: OrderData) => {
    const errors: string[] = [];
    const payload = buildOrderPayload(od);

    // Match backend requirements
    if (!payload.store_id || Number.isNaN(payload.store_id)) errors.push('store_id missing or invalid.');
    if (!payload.customer?.name) errors.push('Customer name is required.');
    if (!payload.customer?.phone) errors.push('Customer phone is required.');
    if (!Array.isArray(payload.items) || payload.items.length === 0) errors.push('At least 1 item is required.');

    const badIndex = payload.items.findIndex((i: any) => !i.product_id || !i.quantity || i.unit_price === null || i.unit_price === undefined);
    if (badIndex !== -1) errors.push(`Item ${badIndex + 1} has missing product/qty/price.`);

    // Payment validations
    if (paymentOption === 'full' || paymentOption === 'partial') {
      if (!selectedPaymentMethod) errors.push('Please select a payment method.');
      if (selectedMethod?.requires_reference && !safeTrim(transactionReference)) {
        errors.push(`Transaction reference is required for ${selectedMethod.name}.`);
      }
    }
    if (paymentOption === 'partial') {
      if (!advanceAmount || advance <= 0 || advance >= computed.total) {
        errors.push('Advance must be > 0 and < total.');
      }
      if (!codPaymentMethod) errors.push('Select COD payment method.');
    }
    if (paymentOption === 'none') {
      if (!codPaymentMethod) errors.push('Select COD payment method for full COD.');
    }

    return { ok: errors.length === 0, errors, payload };
  };

  const handlePlaceOrder = async () => {
    if (!orderData) return;

    if (!axios) {
      displayToast('System error. Please refresh the page.', 'error');
      return;
    }

    const { ok, errors, payload } = validateClientSide(orderData);
    if (!ok) {
      displayToast(errors[0], 'error');
      console.warn('Client validation errors:', errors);
      console.warn('Payload:', payload);
      return;
    }

    setIsProcessing(true);

    try {
      console.log('═══════════════════════════════════');
      console.log('📦 PLACING SOCIAL COMMERCE ORDER');
      console.log('POST /orders payload:', JSON.stringify(payload, null, 2));
      console.log('═══════════════════════════════════');

      // Step 1: Create Order
      const createOrderResponse = await axios.post('/orders', payload);

      if (!createOrderResponse.data?.success) {
        throw new Error(createOrderResponse.data?.message || 'Failed to create order');
      }

      const createdOrder = createOrderResponse.data.data;
      console.log('✅ Order created:', createdOrder.order_number);

      // Step 2: Defective items (best effort)
      const defectiveItems = orderData.defectiveItems || [];
      if (defectiveItems.length > 0) {
        for (const defectItem of defectiveItems) {
          try {
            await axios.post(`/defects/${defectItem.defectId}/mark-sold`, {
              order_id: createdOrder.id,
              selling_price: defectItem.price,
              sale_notes: `Sold via Social Commerce - Order #${createdOrder.order_number}`,
              sold_at: new Date().toISOString(),
            });
          } catch (e) {
            console.warn('⚠️ defect mark-sold failed:', defectItem?.defectId);
          }
        }
      }

      // Step 3: Payments
      if (paymentOption === 'full') {
        const paymentData: any = {
          payment_method_id: toNumber(selectedPaymentMethod, 0),
          amount: computed.total,
          payment_type: 'full',
          auto_complete: true,
          notes: paymentNotes || `Social Commerce full payment via ${selectedMethod?.name}`,
          payment_data: {},
        };

        if (selectedMethod?.requires_reference && safeTrim(transactionReference)) {
          paymentData.transaction_reference = safeTrim(transactionReference);
          paymentData.external_reference = safeTrim(transactionReference);
        }

        const paymentResponse = await axios.post(`/orders/${createdOrder.id}/payments/simple`, paymentData);
        if (!paymentResponse.data?.success) {
          throw new Error(paymentResponse.data?.message || 'Failed to process payment');
        }

        displayToast(`Order ${createdOrder.order_number} placed with full payment!`, 'success');
      } else if (paymentOption === 'partial') {
        const advancePaymentData: any = {
          payment_method_id: toNumber(selectedPaymentMethod, 0),
          amount: advance,
          payment_type: 'partial',
          auto_complete: true,
          notes: `Advance via ${selectedMethod?.name}. COD remaining: ৳${codAmount.toFixed(2)}`,
          payment_data: {},
        };

        if (selectedMethod?.requires_reference && safeTrim(transactionReference)) {
          advancePaymentData.transaction_reference = safeTrim(transactionReference);
          advancePaymentData.external_reference = safeTrim(transactionReference);
        }

        const advanceResponse = await axios.post(`/orders/${createdOrder.id}/payments/simple`, advancePaymentData);
        if (!advanceResponse.data?.success) {
          throw new Error(advanceResponse.data?.message || 'Failed to process advance payment');
        }

        displayToast(
          `Order ${createdOrder.order_number} placed! Advance: ৳${advance.toFixed(2)}, COD: ৳${codAmount.toFixed(2)}`,
          'success'
        );
      } else {
        displayToast(`Order ${createdOrder.order_number} placed! Full COD: ৳${codAmount.toFixed(2)}`, 'success');
      }

      sessionStorage.removeItem('pendingOrder');
      setTimeout(() => (window.location.href = '/orders'), 1500);
    } catch (error: any) {
      console.error('═══════════════════════════════════');
      console.error('❌ ORDER CREATION FAILED');
      console.error('Status:', error?.response?.status);
      console.error('Response:', JSON.stringify(error?.response?.data, null, 2));
      console.error('═══════════════════════════════════');

      displayToast(extractBackendErrorMessage(error), 'error');

      if (error?.response?.status === 401) {
        localStorage.removeItem('token');
        setTimeout(() => (window.location.href = '/login'), 1500);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  if (!orderData) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <p className="text-gray-600 dark:text-gray-400">Loading...</p>
      </div>
    );
  }

  const deliveryAddressText = getDeliveryAddressText(orderData);

  return (
    <div className={darkMode ? 'dark' : ''}>
      <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
        <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />

        <div className="flex-1 flex flex-col overflow-hidden">
          <Header darkMode={darkMode} setDarkMode={setDarkMode} toggleSidebar={() => setSidebarOpen(!sidebarOpen)} />

          <main className="flex-1 overflow-auto p-4 md:p-6">
            <div className="max-w-7xl mx-auto">
              <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Amount Details</h1>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left Column - Order Summary */}
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Order Summary</h2>

                {/* Customer Info */}
                <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800">
                  <p className="text-xs text-blue-800 dark:text-blue-300 font-medium mb-2">Customer Information</p>
                  <p className="text-sm text-gray-900 dark:text-white font-medium">{orderData.customer?.name || '—'}</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">{orderData.customer?.email || '—'}</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">{orderData.customer?.phone || '—'}</p>
                </div>

                {/* Delivery Address */}
                <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 rounded border border-green-200 dark:border-green-800">
                  <p className="text-xs text-green-800 dark:text-green-300 font-medium mb-2">Delivery Address</p>
                  <p className="text-sm text-gray-900 dark:text-white">{deliveryAddressText}</p>
                  {orderData.isInternational && (
                    <div className="mt-2 flex items-center gap-1 text-xs text-blue-700 dark:text-blue-400">
                      <Globe className="w-3 h-3" />
                      <span>International Delivery</span>
                    </div>
                  )}
                </div>

                {/* Products List */}
                <div className="mb-4">
                  <p className="text-sm font-medium text-gray-900 dark:text-white mb-3">
                    Products ({orderData.items?.length || 0})
                  </p>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {orderData.items?.map((item: any, index: number) => {
                      const itemAmount = calculateItemAmount(item);
                      const name = getItemName(item);

                      return (
                        <div key={index} className="flex justify-between items-center p-2 rounded bg-gray-50 dark:bg-gray-700">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm text-gray-900 dark:text-white truncate">{name}</p>
                            <p className="text-xs text-gray-600 dark:text-gray-400">
                              Qty: {toNumber(item.quantity, 0)} × ৳{toNumber(item.unit_price, 0).toFixed(2)}
                            </p>
                            {toNumber(item.discount_amount, 0) > 0 && (
                              <p className="text-xs text-red-600 dark:text-red-400">
                                Discount: -৳{toNumber(item.discount_amount, 0).toFixed(2)}
                              </p>
                            )}
                          </div>
                          <p className="text-sm font-medium text-gray-900 dark:text-white ml-2">৳{itemAmount.toFixed(2)}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Subtotal */}
                <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex justify-between text-base font-semibold">
                    <span className="text-gray-900 dark:text-white">Subtotal</span>
                    <span className="text-gray-900 dark:text-white">৳{computed.subtotal.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Right Column - Payment Details */}
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Payment Details</h2>

                <div className="space-y-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Sub Total</span>
                    <span className="text-gray-900 dark:text-white">৳{computed.subtotal.toFixed(2)}</span>
                  </div>

                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Total Discount</span>
                    <span className="text-red-600 dark:text-red-400">-৳{computed.totalDiscount.toFixed(2)}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">VAT</label>
                      <input
                        type="text"
                        value={`৳${computed.vat.toFixed(2)}`}
                        readOnly
                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-gray-50 dark:bg-gray-600 text-gray-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">VAT Rate %</label>
                      <input
                        type="number"
                        value={vatRate}
                        onChange={(e) => setVatRate(e.target.value)}
                        disabled={isProcessing}
                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Transport Cost</label>
                    <input
                      type="number"
                      value={transportCost}
                      onChange={(e) => setTransportCost(e.target.value)}
                      disabled={isProcessing}
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
                    />
                  </div>

                  <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
                    <div className="flex justify-between text-lg font-bold mb-4">
                      <span className="text-gray-900 dark:text-white">Total Amount</span>
                      <span className="text-gray-900 dark:text-white">৳{computed.total.toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Payment Option Selection */}
                  <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                    <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-3">Payment Option</label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() => {
                          setPaymentOption('full');
                          setAdvanceAmount('');
                        }}
                        disabled={isProcessing}
                        className={`flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-all ${
                          paymentOption === 'full'
                            ? 'border-blue-600 bg-blue-100 dark:bg-blue-900/40'
                            : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700'
                        } disabled:opacity-50`}
                      >
                        <DollarSign className={`w-5 h-5 mb-1 ${paymentOption === 'full' ? 'text-blue-600' : 'text-gray-600 dark:text-gray-400'}`} />
                        <span className={`text-xs font-medium ${paymentOption === 'full' ? 'text-blue-900 dark:text-blue-300' : 'text-gray-700 dark:text-gray-300'}`}>
                          Full Payment
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Pay Now</span>
                      </button>

                      <button
                        onClick={() => setPaymentOption('partial')}
                        disabled={isProcessing}
                        className={`flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-all ${
                          paymentOption === 'partial'
                            ? 'border-purple-600 bg-purple-100 dark:bg-purple-900/40'
                            : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700'
                        } disabled:opacity-50`}
                      >
                        <Wallet className={`w-5 h-5 mb-1 ${paymentOption === 'partial' ? 'text-purple-600' : 'text-gray-600 dark:text-gray-400'}`} />
                        <span className={`text-xs font-medium ${paymentOption === 'partial' ? 'text-purple-900 dark:text-purple-300' : 'text-gray-700 dark:text-gray-300'}`}>
                          Advance + COD
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Partial Now</span>
                      </button>

                      <button
                        onClick={() => {
                          setPaymentOption('none');
                          setAdvanceAmount('');
                          setSelectedPaymentMethod('');
                          setTransactionReference('');

                          const cashMethod = paymentMethods.find((m: PaymentMethod) => m.type === 'cash');
                          if (cashMethod) setCodPaymentMethod(String(cashMethod.id));
                        }}
                        disabled={isProcessing}
                        className={`flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-all ${
                          paymentOption === 'none'
                            ? 'border-orange-600 bg-orange-100 dark:bg-orange-900/40'
                            : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700'
                        } disabled:opacity-50`}
                      >
                        <XCircle className={`w-5 h-5 mb-1 ${paymentOption === 'none' ? 'text-orange-600' : 'text-gray-600 dark:text-gray-400'}`} />
                        <span className={`text-xs font-medium ${paymentOption === 'none' ? 'text-orange-900 dark:text-orange-300' : 'text-gray-700 dark:text-gray-300'}`}>
                          No Payment
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Full COD</span>
                      </button>
                    </div>
                  </div>

                  {/* Advance Amount Input (only for partial) */}
                  {paymentOption === 'partial' && (
                    <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg border border-yellow-200 dark:border-yellow-800">
                      <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                        Advance Amount (Booking Confirmation)
                      </label>
                      <input
                        type="number"
                        value={advanceAmount}
                        onChange={(e) => setAdvanceAmount(e.target.value)}
                        disabled={isProcessing}
                        placeholder={`Enter amount (Max: ৳${computed.total.toFixed(2)})`}
                        min="0"
                        max={computed.total}
                        step="0.01"
                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 disabled:opacity-50"
                      />
                      <div className="mt-3 space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600 dark:text-gray-400">Advance Payment:</span>
                          <span className="font-semibold text-green-600 dark:text-green-400">৳{advance.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600 dark:text-gray-400">COD at Delivery:</span>
                          <span className="font-semibold text-orange-600 dark:text-orange-400">৳{codAmount.toFixed(2)}</span>
                        </div>
                        {totalFees > 0 && (
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600 dark:text-gray-400">Total Fees:</span>
                            <span className="text-red-600 dark:text-red-400">৳{totalFees.toFixed(2)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* No Payment Info */}
                  {paymentOption === 'none' && (
                    <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-lg border border-orange-200 dark:border-orange-800">
                      <p className="text-sm font-medium text-orange-900 dark:text-orange-300 mb-2">No Advance Payment</p>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600 dark:text-gray-400">Full COD Amount:</span>
                          <span className="font-semibold text-orange-600 dark:text-orange-400">৳{codAmount.toFixed(2)}</span>
                        </div>
                        {codFee > 0 && (
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600 dark:text-gray-400">COD Fee:</span>
                            <span className="text-red-600 dark:text-red-400">৳{codFee.toFixed(2)}</span>
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">Full payment will be collected on delivery</p>
                    </div>
                  )}

                  {/* Advance Payment Method (not shown for 'none') */}
                  {paymentOption !== 'none' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        {paymentOption === 'full' ? 'Payment Method' : 'Advance Payment Method'} <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={selectedPaymentMethod}
                        onChange={(e) => setSelectedPaymentMethod(e.target.value)}
                        disabled={isProcessing}
                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
                      >
                        <option value="">Select Payment Method</option>
                        {paymentMethods.map((method) => (
                          <option key={method.id} value={method.id}>
                            {method.name}
                            {toNumber(method.percentage_fee, 0) > 0 && ` (${method.percentage_fee}% fee)`}
                            {toNumber(method.fixed_fee, 0) > 0 && ` (+৳${method.fixed_fee})`}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* COD Payment Method (for partial and none) */}
                  {(paymentOption === 'partial' || paymentOption === 'none') && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        COD Payment Method <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={codPaymentMethod}
                        onChange={(e) => setCodPaymentMethod(e.target.value)}
                        disabled={isProcessing || paymentOption === 'none'}
                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <option value="">Select COD Method</option>
                        {paymentMethods.map((method) => (
                          <option key={method.id} value={method.id}>
                            {method.name}
                          </option>
                        ))}
                      </select>
                      {paymentOption === 'none' && (
                        <p className="mt-1 text-xs text-blue-600 dark:text-blue-400">Automatically set to Cash for COD</p>
                      )}
                    </div>
                  )}

                  {/* Transaction Reference (not shown for 'none') */}
                  {paymentOption !== 'none' && selectedMethod?.requires_reference && (
                    <div>
                      <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">
                        Transaction Reference <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={transactionReference}
                        onChange={(e) => setTransactionReference(e.target.value)}
                        disabled={isProcessing}
                        placeholder={`Enter ${selectedMethod.name} transaction ID`}
                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 disabled:opacity-50"
                      />
                    </div>
                  )}

                  {/* Payment Notes */}
                  <div>
                    <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Payment Notes (Optional)</label>
                    <textarea
                      value={paymentNotes}
                      onChange={(e) => setPaymentNotes(e.target.value)}
                      disabled={isProcessing}
                      placeholder="Add any payment notes..."
                      rows={2}
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 disabled:opacity-50"
                    />
                  </div>

                  {/* Action Buttons */}
                  <div className="grid grid-cols-2 gap-3 pt-4">
                    <button
                      onClick={() => window.history.back()}
                      disabled={isProcessing}
                      className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm rounded hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Back
                    </button>
                    <button
                      onClick={handlePlaceOrder}
                      disabled={
                        isProcessing ||
                        (paymentOption === 'full' && !selectedPaymentMethod) ||
                        (paymentOption === 'partial' && (!advanceAmount || !selectedPaymentMethod || !codPaymentMethod)) ||
                        (paymentOption === 'none' && !codPaymentMethod)
                      }
                      className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {isProcessing ? (
                        <>
                          <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                          Processing...
                        </>
                      ) : (
                        <>
                          <CreditCard className="w-4 h-4" />
                          Place Order
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Toast */}
            {toast.show && (
              <div className="fixed bottom-4 right-4 z-50 animate-in slide-in-from-bottom">
                <div className={`px-4 py-3 rounded-lg shadow-lg ${toast.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
                  {toast.message}
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
