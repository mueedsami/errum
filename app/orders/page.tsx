'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import Sidebar from '@/components/Sidebar';
import { ShoppingBag, Search, MoreVertical, Eye, Package, XCircle, Loader, Globe, Edit, RefreshCw, ArrowLeftRight } from 'lucide-react';
import orderService from '@/services/orderService';

interface Order {
  id: number;
  orderNumber: string;
  orderType: string;
  orderTypeLabel: string;
  date: string;
  customer: {
    name: string;
    phone: string;
    email?: string;
    address?: string;
  };
  items: Array<{
    id: number;
    name: string;
    sku: string;
    quantity: number;
    price: number;
    discount: number;
  }>;
  subtotal: number;
  discount: number;
  shipping: number;
  amounts: {
    total: number;
    paid: number;
    due: number;
  };
  status: string;
  salesBy: string;
  store: string;
  notes?: string;
  fulfillmentStatus?: string | null;
}

export default function PendingOrdersDashboard() {
  const [darkMode, setDarkMode] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('All Status');
  const [orderTypeFilter, setOrderTypeFilter] = useState('All Types');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [activeMenu, setActiveMenu] = useState<number | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const [userName, setUserName] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const name = localStorage.getItem('userName') || '';
    setUserName(name);
    loadOrders();
  }, []);

  const loadOrders = async () => {
    setIsLoading(true);
    try {
      // Fetch social commerce orders pending fulfillment
      const socialCommerceResponse = await orderService.getAll({
        order_type: 'social_commerce',
        status: 'pending',
        sort_by: 'created_at',
        sort_order: 'desc',
        per_page: 1000
      });

      // Fetch e-commerce orders pending fulfillment
      const ecommerceResponse = await orderService.getAll({
        order_type: 'ecommerce',
        status: 'pending',
        sort_by: 'created_at',
        sort_order: 'desc',
        per_page: 1000
      });

      // Combine both order types
      const allOrders = [
        ...socialCommerceResponse.data,
        ...ecommerceResponse.data
      ];

      // Sort combined orders by date
      allOrders.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      // Transform the orders
      const transformedOrders = allOrders.map((order: any) => ({
        id: order.id,
        orderNumber: order.order_number,
        orderType: order.order_type,
        orderTypeLabel: order.order_type_label,
        date: new Date(order.order_date).toLocaleDateString('en-GB'),
        customer: {
          name: order.customer.name,
          phone: order.customer.phone,
          email: order.customer.email || '',
          address: order.shipping_address || ''
        },
        items: order.items?.map((item: any) => {
          const unitPrice = Number(String(item.unit_price ?? "0").replace(/[^0-9.-]/g, ""));
          const discountAmount = Number(String(item.discount_amount ?? "0").replace(/[^0-9.-]/g, ""));
          
          console.log('Item data:', {
            product_name: item.product_name,
            unit_price_raw: item.unit_price,
            unit_price_cleaned: unitPrice,
            discount_raw: item.discount_amount,
            discount_cleaned: discountAmount
          });
          
          return {
            id: item.id,
            name: item.product_name,
            sku: item.product_sku,
            quantity: item.quantity,
            price: unitPrice,
            discount: discountAmount
          };
        }) || [],
        subtotal: Number(String(order.subtotal ?? "0").replace(/[^0-9.-]/g, "")),
        discount: Number(String(order.discount_amount ?? "0").replace(/[^0-9.-]/g, "")),
        shipping: Number(String(order.shipping_amount ?? "0").replace(/[^0-9.-]/g, "")),
        amounts: {
          total: Number(String(order.total_amount ?? "0").replace(/[^0-9.-]/g, "")),
          paid: Number(String(order.paid_amount ?? "0").replace(/[^0-9.-]/g, "")),
          due: Number(String(order.outstanding_amount ?? "0").replace(/[^0-9.-]/g, ""))
        },
        status: order.payment_status === 'paid' ? 'Paid' : 'Pending',
        salesBy: order.salesman?.name || userName || 'N/A',
        store: order.store.name,
        notes: order.notes || '',
        fulfillmentStatus: order.fulfillment_status
      }));
      
      setOrders(transformedOrders);
      setFilteredOrders(transformedOrders);

    } catch (error: any) {
      console.error('Failed to load orders:', error);
      alert('Failed to load orders. Please check your connection.');
      setOrders([]);
      setFilteredOrders([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let filtered = orders;

    if (search.trim()) {
      filtered = filtered.filter((o) =>
        o.id.toString().includes(search.trim()) ||
        o.orderNumber?.toLowerCase().includes(search.toLowerCase()) ||
        o.customer.name.toLowerCase().includes(search.toLowerCase()) ||
        o.customer.phone.includes(search.trim())
      );
    }

    if (dateFilter.trim()) {
      filtered = filtered.filter((o) => {
        const orderDate = o.date;
        let filterDateFormatted = dateFilter;
        if (dateFilter.includes('-') && dateFilter.split('-')[0].length === 4) {
          const [year, month, day] = dateFilter.split('-');
          filterDateFormatted = `${day}/${month}/${year}`;
        }
        return orderDate === filterDateFormatted;
      });
    }

    if (statusFilter !== 'All Status') {
      filtered = filtered.filter((o) =>
        statusFilter === 'Paid' ? o.amounts.due === 0 : o.amounts.due > 0
      );
    }

    if (orderTypeFilter !== 'All Types') {
      filtered = filtered.filter((o) => {
        if (orderTypeFilter === 'Social Commerce') return o.orderType === 'social_commerce';
        if (orderTypeFilter === 'E-Commerce') return o.orderType === 'ecommerce';
        return true;
      });
    }

    setFilteredOrders(filtered);
  }, [search, dateFilter, statusFilter, orderTypeFilter, orders]);

  const handleViewDetails = async (order: Order) => {
    setIsLoadingDetails(true);
    setShowDetailsModal(true);
    setActiveMenu(null);
    
    try {
      // Fetch full order details with items
      const fullOrder = await orderService.getById(order.id);
      
      // Transform the full order data
      const transformedOrder: Order = {
        id: fullOrder.id,
        orderNumber: fullOrder.order_number,
        orderType: fullOrder.order_type,
        orderTypeLabel: fullOrder.order_type_label,
        date: new Date(fullOrder.order_date).toLocaleDateString('en-GB'),
        customer: {
          name: fullOrder.customer.name,
          phone: fullOrder.customer.phone,
          email: fullOrder.customer.email || '',
          address: fullOrder.shipping_address || ''
        },
        items: fullOrder.items?.map((item: any) => ({
          id: item.id,
          name: item.product_name,
          sku: item.product_sku,
          quantity: item.quantity,
          price: Number(String(item.unit_price ?? "0").replace(/[^0-9.-]/g, "")),
          discount: Number(String(item.discount_amount ?? "0").replace(/[^0-9.-]/g, ""))
        })) || [],
        subtotal: Number(String(fullOrder.subtotal ?? "0").replace(/[^0-9.-]/g, "")),
        discount: Number(String(fullOrder.discount_amount ?? "0").replace(/[^0-9.-]/g, "")),
        shipping: Number(String(fullOrder.shipping_amount ?? "0").replace(/[^0-9.-]/g, "")),
        amounts: {
          total: Number(String(fullOrder.total_amount ?? "0").replace(/[^0-9.-]/g, "")),
          paid: Number(String(fullOrder.paid_amount ?? "0").replace(/[^0-9.-]/g, "")),
          due: Number(String(fullOrder.outstanding_amount ?? "0").replace(/[^0-9.-]/g, ""))
        },
        status: fullOrder.payment_status === 'paid' ? 'Paid' : 'Pending',
        salesBy: fullOrder.salesman?.name || userName || 'N/A',
        store: fullOrder.store.name,
        notes: fullOrder.notes || '',
        fulfillmentStatus: fullOrder.fulfillment_status
      };
      
      setSelectedOrder(transformedOrder);
    } catch (error: any) {
      console.error('Failed to load order details:', error);
      alert('Failed to load order details: ' + error.message);
      setShowDetailsModal(false);
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const handleEditOrder = async (order: Order) => {
    setActiveMenu(null);
    setIsLoadingDetails(true);
    setShowEditModal(true);
    
    try {
      // Fetch full order details with items
      const fullOrder = await orderService.getById(order.id);
      
      // Transform the full order data
      const transformedOrder: Order = {
        id: fullOrder.id,
        orderNumber: fullOrder.order_number,
        orderType: fullOrder.order_type,
        orderTypeLabel: fullOrder.order_type_label,
        date: new Date(fullOrder.order_date).toLocaleDateString('en-GB'),
        customer: {
          name: fullOrder.customer.name,
          phone: fullOrder.customer.phone,
          email: fullOrder.customer.email || '',
          address: fullOrder.shipping_address || ''
        },
        items: fullOrder.items?.map((item: any) => ({
          id: item.id,
          name: item.product_name,
          sku: item.product_sku,
          quantity: item.quantity,
          price: Number(String(item.unit_price ?? "0").replace(/[^0-9.-]/g, "")),
          discount: Number(String(item.discount_amount ?? "0").replace(/[^0-9.-]/g, ""))
        })) || [],
        subtotal: Number(String(fullOrder.subtotal ?? "0").replace(/[^0-9.-]/g, "")),
        discount: Number(String(fullOrder.discount_amount ?? "0").replace(/[^0-9.-]/g, "")),
        shipping: Number(String(fullOrder.shipping_amount ?? "0").replace(/[^0-9.-]/g, "")),
        amounts: {
          total: Number(String(fullOrder.total_amount ?? "0").replace(/[^0-9.-]/g, "")),
          paid: Number(String(fullOrder.paid_amount ?? "0").replace(/[^0-9.-]/g, "")),
          due: Number(String(fullOrder.outstanding_amount ?? "0").replace(/[^0-9.-]/g, ""))
        },
        status: fullOrder.payment_status === 'paid' ? 'Paid' : 'Pending',
        salesBy: fullOrder.salesman?.name || userName || 'N/A',
        store: fullOrder.store.name,
        notes: fullOrder.notes || '',
        fulfillmentStatus: fullOrder.fulfillment_status
      };
      
      setSelectedOrder(transformedOrder);
    } catch (error: any) {
      console.error('Failed to load order details:', error);
      alert('Failed to load order details: ' + error.message);
      setShowEditModal(false);
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const handleReturnOrder = (order: Order) => {
    setActiveMenu(null);
    alert(`Return order functionality for ${order.orderNumber} will be implemented.`);
    // TODO: Implement return order modal
  };

  const handleExchangeOrder = (order: Order) => {
    setActiveMenu(null);
    alert(`Exchange order functionality for ${order.orderNumber} will be implemented.`);
    // TODO: Implement exchange order modal
  };

  const handleCancelOrder = async (orderId: number) => {
    if (!confirm('Are you sure you want to cancel this order?')) return;

    try {
      await orderService.cancel(orderId, 'Cancelled by user');
      await loadOrders();
      setActiveMenu(null);
      alert('Order cancelled successfully!');
    } catch (error: any) {
      console.error('Error cancelling order:', error);
      alert(`Failed to cancel order: ${error.message}`);
    }
  };

  const getOrderTypeBadge = (orderType: string) => {
    if (orderType === 'social_commerce') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400">
          <ShoppingBag className="h-3 w-3" />
          Social
        </span>
      );
    }
    
    if (orderType === 'ecommerce') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
          <Globe className="h-3 w-3" />
          E-Com
        </span>
      );
    }
    
    return null;
  };

  const totalRevenue = orders.reduce((sum, order) => sum + order.amounts.total, 0);
  const paidOrders = orders.filter(o => o.amounts.due === 0).length;
  const pendingOrders = orders.filter(o => o.amounts.due > 0).length;
  const socialCommerceCount = orders.filter(o => o.orderType === 'social_commerce').length;
  const ecommerceCount = orders.filter(o => o.orderType === 'ecommerce').length;

  return (
    <div className={darkMode ? 'dark' : ''}>
      <div className="flex h-screen bg-white dark:bg-black">
        <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />
        
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header darkMode={darkMode} setDarkMode={setDarkMode} toggleSidebar={() => setSidebarOpen(!sidebarOpen)} />

          <main className="flex-1 overflow-auto bg-white dark:bg-black">
            {/* Header */}
            <div className="border-b border-gray-200 dark:border-gray-800">
              <div className="px-4 py-2">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-black dark:bg-white rounded">
                      <Package className="w-4 h-4 text-white dark:text-black" />
                    </div>
                    <div>
                      <h1 className="text-lg font-bold text-black dark:text-white leading-none">Pending Orders</h1>
                      <p className="text-[10px] text-gray-600 dark:text-gray-400 leading-none mt-0.5">
                        {filteredOrders.length} of {orders.length} orders awaiting fulfillment
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-800">
              <div className="max-w-7xl mx-auto">
                <div className="grid grid-cols-6 gap-2">
                  <div className="border border-gray-200 dark:border-gray-800 rounded p-2">
                    <p className="text-[10px] text-gray-600 dark:text-gray-400 uppercase font-medium">Total</p>
                    <p className="text-lg font-bold text-black dark:text-white leading-none mt-0.5">{orders.length}</p>
                  </div>
                  <div className="border border-gray-200 dark:border-gray-800 rounded p-2">
                    <p className="text-[10px] text-gray-600 dark:text-gray-400 uppercase font-medium">Social</p>
                    <p className="text-lg font-bold text-black dark:text-white leading-none mt-0.5">{socialCommerceCount}</p>
                  </div>
                  <div className="border border-gray-200 dark:border-gray-800 rounded p-2">
                    <p className="text-[10px] text-gray-600 dark:text-gray-400 uppercase font-medium">E-Com</p>
                    <p className="text-lg font-bold text-black dark:text-white leading-none mt-0.5">{ecommerceCount}</p>
                  </div>
                  <div className="border border-gray-200 dark:border-gray-800 rounded p-2">
                    <p className="text-[10px] text-gray-600 dark:text-gray-400 uppercase font-medium">Paid</p>
                    <p className="text-lg font-bold text-black dark:text-white leading-none mt-0.5">{paidOrders}</p>
                  </div>
                  <div className="border border-gray-200 dark:border-gray-800 rounded p-2">
                    <p className="text-[10px] text-gray-600 dark:text-gray-400 uppercase font-medium">Due</p>
                    <p className="text-lg font-bold text-black dark:text-white leading-none mt-0.5">{pendingOrders}</p>
                  </div>
                  <div className="border border-gray-200 dark:border-gray-800 rounded p-2">
                    <p className="text-[10px] text-gray-600 dark:text-gray-400 uppercase font-medium">Revenue</p>
                    <p className="text-lg font-bold text-black dark:text-white leading-none mt-0.5">৳{(totalRevenue / 1000).toFixed(0)}k</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Filters */}
            <div className="max-w-7xl mx-auto px-4 py-3">
              <div className="flex items-center gap-2 mb-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search Order ID or Customer..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded bg-white dark:bg-gray-900 text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                  />
                </div>
                
                <input
                  type="date"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded bg-white dark:bg-gray-900 text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                />
                
                <select
                  value={orderTypeFilter}
                  onChange={(e) => setOrderTypeFilter(e.target.value)}
                  className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded bg-white dark:bg-gray-900 text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                >
                  <option>All Types</option>
                  <option>Social Commerce</option>
                  <option>E-Commerce</option>
                </select>
                
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded bg-white dark:bg-gray-900 text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                >
                  <option>All Status</option>
                  <option>Paid</option>
                  <option>Pending</option>
                </select>
              </div>

              <p className="text-xs text-gray-500 dark:text-gray-500">
                Showing {filteredOrders.length} of {orders.length} orders
              </p>
            </div>

            {/* Orders Table */}
            <div className="max-w-7xl mx-auto px-4 pb-4">
              {isLoading ? (
                <div className="bg-white dark:bg-gray-900 rounded-xl p-12 text-center border border-gray-200 dark:border-gray-800">
                  <Loader className="animate-spin h-12 w-12 text-black dark:text-white mx-auto" />
                  <p className="text-gray-500 dark:text-gray-400 font-medium mt-4">Loading orders...</p>
                </div>
              ) : filteredOrders.length === 0 ? (
                <div className="bg-white dark:bg-gray-900 rounded-xl p-12 text-center border border-gray-200 dark:border-gray-800">
                  <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500 dark:text-gray-400 font-medium">No pending orders found</p>
                </div>
              ) : (
                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">Order No</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">Type</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">Customer</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">Date</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">Status</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">Amount</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                      {filteredOrders.map((order) => (
                        <tr key={order.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                          <td className="px-4 py-3">
                            <p className="text-sm font-semibold text-black dark:text-white">{order.orderNumber}</p>
                          </td>
                          <td className="px-4 py-3">
                            {getOrderTypeBadge(order.orderType)}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                                <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
                                  {order.customer.name.charAt(0).toUpperCase()}
                                </span>
                              </div>
                              <div>
                                <p className="text-sm font-medium text-black dark:text-white">{order.customer.name}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-500">{order.customer.phone}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-sm text-gray-700 dark:text-gray-300">{order.date}</p>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                              order.status === 'Paid'
                                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                            }`}>
                              {order.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <p className="text-sm font-bold text-black dark:text-white">৳{order.amounts.total.toFixed(2)}</p>
                            {order.amounts.due > 0 && (
                              <p className="text-xs text-red-600 dark:text-red-400">Due: ৳{order.amounts.due.toFixed(2)}</p>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => handleViewDetails(order)}
                                className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                                title="View Details"
                              >
                                <Eye className="h-4 w-4 text-gray-700 dark:text-gray-300" />
                              </button>
                              
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const rect = e.currentTarget.getBoundingClientRect();
                                  const menuHeight = 280; // Approximate height of menu
                                  const spaceBelow = window.innerHeight - rect.bottom;
                                  const spaceRight = window.innerWidth - rect.right;
                                  
                                  // Position menu
                                  let top = rect.bottom + 4;
                                  let left = rect.right - 224; // 224px = w-56
                                  
                                  // Adjust if not enough space below
                                  if (spaceBelow < menuHeight) {
                                    top = rect.top - menuHeight - 4;
                                  }
                                  
                                  // Adjust if not enough space on right
                                  if (spaceRight < 224) {
                                    left = rect.left - 224 + rect.width;
                                  }
                                  
                                  setMenuPosition({ top, left });
                                  setActiveMenu(activeMenu === order.id ? null : order.id);
                                }}
                                className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                                title="More Actions"
                              >
                                <MoreVertical className="h-4 w-4 text-gray-700 dark:text-gray-300" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </main>
        </div>
      </div>

      {/* Fixed Position Dropdown Menu */}
      {activeMenu !== null && menuPosition && (
        <div 
          className="fixed bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-2xl w-56 z-[60]"
          style={{ top: `${menuPosition.top}px`, left: `${menuPosition.left}px` }}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              const order = filteredOrders.find(o => o.id === activeMenu);
              if (order) handleViewDetails(order);
            }}
            className="w-full px-4 py-3 text-left text-sm font-medium text-black dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-3 rounded-t-lg border-b border-gray-100 dark:border-gray-700"
          >
            <Eye className="h-5 w-5 flex-shrink-0" />
            <span>View Details</span>
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              const order = filteredOrders.find(o => o.id === activeMenu);
              if (order) handleEditOrder(order);
            }}
            className="w-full px-4 py-3 text-left text-sm font-medium text-black dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-3 border-b border-gray-100 dark:border-gray-700"
          >
            <Edit className="h-5 w-5 flex-shrink-0" />
            <span>Edit Order</span>
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              const order = filteredOrders.find(o => o.id === activeMenu);
              if (order) handleReturnOrder(order);
            }}
            className="w-full px-4 py-3 text-left text-sm font-medium text-black dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-3 border-b border-gray-100 dark:border-gray-700"
          >
            <RefreshCw className="h-5 w-5 flex-shrink-0" />
            <span>Return Order</span>
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              const order = filteredOrders.find(o => o.id === activeMenu);
              if (order) handleExchangeOrder(order);
            }}
            className="w-full px-4 py-3 text-left text-sm font-medium text-black dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-3 border-b-2 border-gray-300 dark:border-gray-600"
          >
            <ArrowLeftRight className="h-5 w-5 flex-shrink-0" />
            <span>Exchange Order</span>
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              const order = filteredOrders.find(o => o.id === activeMenu);
              if (order) handleCancelOrder(order.id);
            }}
            className="w-full px-4 py-3 text-left text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex items-center gap-3 rounded-b-lg"
          >
            <XCircle className="h-5 w-5 flex-shrink-0" />
            <span>Cancel Order</span>
          </button>
        </div>
      )}

      {/* Order Details Modal */}
      {showDetailsModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl max-w-4xl w-full max-h-[90vh] overflow-auto border border-gray-200 dark:border-gray-800">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-6 py-4 flex items-center justify-between z-10">
              <div>
                <h2 className="text-xl font-bold text-black dark:text-white">Order Details</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {selectedOrder?.orderNumber || 'Loading...'}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowDetailsModal(false);
                  setSelectedOrder(null);
                }}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              >
                <XCircle className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            {/* Modal Content */}
            {isLoadingDetails ? (
              <div className="p-12 text-center">
                <Loader className="animate-spin h-12 w-12 text-black dark:text-white mx-auto mb-4" />
                <p className="text-gray-500 dark:text-gray-400">Loading order details...</p>
              </div>
            ) : selectedOrder ? (
              <div className="p-6 space-y-6">
              {/* Order Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-500 uppercase mb-1">Order Type</p>
                  {getOrderTypeBadge(selectedOrder.orderType)}
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-500 uppercase mb-1">Status</p>
                  <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                    selectedOrder.status === 'Paid'
                      ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                      : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                  }`}>
                    {selectedOrder.status}
                  </span>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-500 uppercase mb-1">Date</p>
                  <p className="text-sm font-medium text-black dark:text-white">{selectedOrder.date}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-500 uppercase mb-1">Store</p>
                  <p className="text-sm font-medium text-black dark:text-white">{selectedOrder.store}</p>
                </div>
              </div>

              {/* Customer Info */}
              <div>
                <h3 className="text-sm font-bold text-black dark:text-white mb-3">Customer Information</h3>
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-gray-500 dark:text-gray-500">Name</p>
                    <p className="text-sm font-medium text-black dark:text-white">{selectedOrder.customer.name}</p>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-gray-500 dark:text-gray-500">Phone</p>
                    <p className="text-sm font-medium text-black dark:text-white">{selectedOrder.customer.phone}</p>
                  </div>
                  {selectedOrder.customer.email && (
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-gray-500 dark:text-gray-500">Email</p>
                      <p className="text-sm font-medium text-black dark:text-white">{selectedOrder.customer.email}</p>
                    </div>
                  )}
                  {selectedOrder.customer.address && (
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-500 mb-1">Address</p>
                      <p className="text-sm text-black dark:text-white">{selectedOrder.customer.address}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Order Items */}
              <div>
                <h3 className="text-sm font-bold text-black dark:text-white mb-3">Order Items</h3>
                {selectedOrder.items && selectedOrder.items.length > 0 ? (
                  <div className="border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-gray-50 dark:bg-gray-800">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 dark:text-gray-300">Product</th>
                          <th className="px-4 py-2 text-center text-xs font-semibold text-gray-700 dark:text-gray-300">Qty</th>
                          <th className="px-4 py-2 text-right text-xs font-semibold text-gray-700 dark:text-gray-300">Price</th>
                          <th className="px-4 py-2 text-right text-xs font-semibold text-gray-700 dark:text-gray-300">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                        {selectedOrder.items.map((item) => (
                          <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                            <td className="px-4 py-3">
                              <p className="text-sm font-medium text-black dark:text-white">{item.name}</p>
                              <p className="text-xs text-gray-500 dark:text-gray-500">SKU: {item.sku}</p>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 text-sm font-medium text-black dark:text-white">
                                {item.quantity}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <p className="text-sm text-black dark:text-white">৳{item.price.toFixed(2)}</p>
                              {item.discount > 0 && (
                                <p className="text-xs text-red-500">-৳{item.discount.toFixed(2)}</p>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <p className="text-sm font-medium text-black dark:text-white">
                                ৳{((item.price - item.discount) * item.quantity).toFixed(2)}
                              </p>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="border border-gray-200 dark:border-gray-800 rounded-lg p-8 text-center">
                    <Package className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-sm text-gray-500 dark:text-gray-500">No items in this order</p>
                  </div>
                )}
              </div>

              {/* Order Summary */}
              <div>
                <h3 className="text-sm font-bold text-black dark:text-white mb-3">Order Summary</h3>
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-700 dark:text-gray-300">Subtotal</p>
                    <p className="text-sm font-medium text-black dark:text-white">৳{selectedOrder.subtotal.toFixed(2)}</p>
                  </div>
                  {selectedOrder.discount > 0 && (
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-gray-700 dark:text-gray-300">Discount</p>
                      <p className="text-sm font-medium text-red-600 dark:text-red-400">-৳{selectedOrder.discount.toFixed(2)}</p>
                    </div>
                  )}
                  {selectedOrder.shipping > 0 && (
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-gray-700 dark:text-gray-300">Shipping</p>
                      <p className="text-sm font-medium text-black dark:text-white">৳{selectedOrder.shipping.toFixed(2)}</p>
                    </div>
                  )}
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-2 flex items-center justify-between">
                    <p className="text-sm font-bold text-black dark:text-white">Total</p>
                    <p className="text-lg font-bold text-black dark:text-white">৳{selectedOrder.amounts.total.toFixed(2)}</p>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-700 dark:text-gray-300">Paid</p>
                    <p className="text-sm font-medium text-green-600 dark:text-green-400">৳{selectedOrder.amounts.paid.toFixed(2)}</p>
                  </div>
                  {selectedOrder.amounts.due > 0 && (
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-bold text-gray-700 dark:text-gray-300">Due</p>
                      <p className="text-sm font-bold text-red-600 dark:text-red-400">৳{selectedOrder.amounts.due.toFixed(2)}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Notes */}
              {selectedOrder.notes && (
                <div>
                  <h3 className="text-sm font-bold text-black dark:text-white mb-2">Notes</h3>
                  <p className="text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                    {selectedOrder.notes}
                  </p>
                </div>
              )}
            </div>
          ) : null}
          </div>
        </div>
      )}

      {/* Edit Order Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl max-w-4xl w-full max-h-[90vh] overflow-auto border border-gray-200 dark:border-gray-800">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-6 py-4 flex items-center justify-between z-10">
              <div>
                <h2 className="text-xl font-bold text-black dark:text-white">Edit Order</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {selectedOrder?.orderNumber || 'Loading...'}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setSelectedOrder(null);
                }}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              >
                <XCircle className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            {/* Modal Content */}
            {isLoadingDetails ? (
              <div className="p-12 text-center">
                <Loader className="animate-spin h-12 w-12 text-black dark:text-white mx-auto mb-4" />
                <p className="text-gray-500 dark:text-gray-400">Loading order details...</p>
              </div>
            ) : selectedOrder ? (
              <div className="p-6 space-y-6">
                {/* Customer Information */}
                <div>
                  <h3 className="text-sm font-bold text-black dark:text-white mb-3">Customer Information</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Name</label>
                      <input
                        type="text"
                        defaultValue={selectedOrder.customer.name}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-black dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Phone</label>
                      <input
                        type="text"
                        defaultValue={selectedOrder.customer.phone}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-black dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Email</label>
                      <input
                        type="email"
                        defaultValue={selectedOrder.customer.email}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-black dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Address</label>
                      <textarea
                        rows={2}
                        defaultValue={selectedOrder.customer.address}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-black dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                </div>

                {/* Order Items */}
                <div>
                  <h3 className="text-sm font-bold text-black dark:text-white mb-3">Order Items</h3>
                  {selectedOrder.items && selectedOrder.items.length > 0 ? (
                    <div className="space-y-3">
                      {selectedOrder.items.map((item, index) => (
                        <div key={item.id} className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                          <div className="flex-1">
                            <p className="text-sm font-medium text-black dark:text-white">{item.name}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-500">SKU: {item.sku}</p>
                          </div>
                          <div className="w-24">
                            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Qty</label>
                            <input
                              type="number"
                              defaultValue={item.quantity}
                              min="1"
                              className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-black dark:text-white text-sm"
                            />
                          </div>
                          <div className="w-32">
                            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Price</label>
                            <input
                              type="number"
                              defaultValue={item.price}
                              step="0.01"
                              className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-black dark:text-white text-sm"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">No items in this order</p>
                  )}
                </div>

                {/* Order Details */}
                <div>
                  <h3 className="text-sm font-bold text-black dark:text-white mb-3">Order Details</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Discount (৳)</label>
                      <input
                        type="number"
                        defaultValue={selectedOrder.discount}
                        step="0.01"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-black dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Shipping (৳)</label>
                      <input
                        type="number"
                        defaultValue={selectedOrder.shipping}
                        step="0.01"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-black dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Notes</label>
                      <textarea
                        rows={3}
                        defaultValue={selectedOrder.notes}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-black dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-800">
                  <button
                    onClick={() => {
                      setShowEditModal(false);
                      setSelectedOrder(null);
                    }}
                    className="px-6 py-2.5 border border-gray-300 dark:border-gray-600 text-black dark:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      alert('Save functionality will be implemented with API integration');
                      // TODO: Implement save order changes
                    }}
                    className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Click outside to close menu */}
      {activeMenu !== null && (
        <div className="fixed inset-0 z-[55]" onClick={() => setActiveMenu(null)} />
      )}

      {/* Custom Scrollbar Styles */}
      <style jsx>{`
        .overflow-y-auto::-webkit-scrollbar {
          width: 6px;
        }
        .overflow-y-auto::-webkit-scrollbar-track {
          background: transparent;
        }
        .overflow-y-auto::-webkit-scrollbar-thumb {
          background: #cbd5e0;
          border-radius: 3px;
        }
        .dark .overflow-y-auto::-webkit-scrollbar-thumb {
          background: #4a5568;
        }
        .overflow-y-auto::-webkit-scrollbar-thumb:hover {
          background: #a0aec0;
        }
        .dark .overflow-y-auto::-webkit-scrollbar-thumb:hover {
          background: #718096;
        }
      `}</style>
    </div>
  );
}