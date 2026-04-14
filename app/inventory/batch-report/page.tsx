'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import axiosInstance from '@/lib/axios';
import { toast } from 'react-hot-toast';
import {
  Package, ChevronDown, ChevronRight, Search, RefreshCw,
  ArrowUpDown, TrendingUp, TrendingDown, Clock, Boxes,
  ShoppingCart, BarChart3, Building2, Filter, X, SlidersHorizontal
} from 'lucide-react';
import { format } from 'date-fns';

// ─── Types ───────────────────────────────────────────────────────────────────

interface BatchRow {
  batch_id: number; batch_number: string; batch_created_at: string;
  product_id: number; product_name: string; product_sku: string;
  store_id: number; store_name: string;
  po_id: number | null; po_number: string | null; po_order_date: string | null;
  po_received_date: string | null; po_status: string | null;
  vendor_id: number | null; vendor_name: string | null;
  original_qty: number; remaining_stock: number;
  cost_price: number; sell_price: number;
  units_sold: number; order_count: number;
  revenue: number; total_cogs: number; gross_profit: number; margin_pct: number;
  first_sale_date: string | null; last_sale_date: string | null;
  sell_through_pct: number; days_since_received: number | null;
  velocity_per_day: number; days_of_stock: number | null;
  stock_value: number; potential_revenue: number;
  store_distribution: { store_id: number; store_name: string; count: number; statuses: string[] }[];
}

interface POGroup {
  po_id: number | null; po_number: string; po_order_date: string | null;
  po_received_date: string | null; po_status: string | null;
  vendor_id: number | null; vendor_name: string;
  po_original_qty: number; po_remaining: number; po_units_sold: number;
  po_revenue: number; po_gross_profit: number; po_sell_through: number;
  po_stock_value: number;
  batches: BatchRow[];
}

interface ProductGroup {
  product_id: number; product_name: string; product_sku: string;
  total_original: number; total_remaining: number; total_sold: number;
  total_revenue: number; total_profit: number; overall_sell_through: number;
  avg_velocity: number; total_stock_value: number;
  po_count: number; batch_count: number;
  by_po: POGroup[];
}

interface Summary {
  total_products: number; total_batches: number; total_pos: number;
  total_original: number; total_remaining: number; total_sold: number;
  total_revenue: number; total_profit: number; total_stock_value: number;
  overall_sell_through: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const tk  = (n: number) => `৳${n.toLocaleString('en-BD', { maximumFractionDigits: 0 })}`;
const pct = (n: number) => `${n.toFixed(1)}%`;

function SellThroughBar({ value }: { value: number }) {
  const color = value >= 80 ? '#34d399' : value >= 50 ? '#fbbf24' : value >= 20 ? '#fb923c' : '#f87171';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }}>
        <div className="h-1.5 rounded-full transition-all" style={{ width: `${Math.min(value, 100)}%`, background: color }} />
      </div>
      <span className="text-[10px] font-700 w-9 text-right" style={{ color }}>{pct(value)}</span>
    </div>
  );
}

function DaysChip({ days }: { days: number | null }) {
  if (days === null) return <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.25)' }}>—</span>;
  if (days >= 999) return <span className="text-[10px] font-600" style={{ color: '#818cf8' }}>No sales</span>;
  const color = days <= 7 ? '#f87171' : days <= 14 ? '#fb923c' : days <= 30 ? '#fbbf24' : '#34d399';
  return <span className="text-[10px] font-700" style={{ color }}>{days}d left</span>;
}

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return null;
  const cfg: Record<string, { bg: string; color: string }> = {
    received:           { bg: 'rgba(52,211,153,0.12)',  color: '#34d399' },
    fully_received:     { bg: 'rgba(52,211,153,0.12)',  color: '#34d399' },
    partially_received: { bg: 'rgba(251,191,36,0.12)', color: '#fbbf24' },
    sent_to_vendor:     { bg: 'rgba(129,140,248,0.12)', color: '#818cf8' },
    approved:           { bg: 'rgba(99,102,241,0.12)',  color: '#818cf8' },
    draft:              { bg: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)' },
    cancelled:          { bg: 'rgba(239,68,68,0.12)',   color: '#f87171' },
  };
  const c = cfg[status] ?? { bg: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)' };
  return (
    <span className="text-[9px] font-700 px-2 py-0.5 rounded-full uppercase tracking-wider"
      style={{ background: c.bg, color: c.color }}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function BatchReportPage() {
  const [items, setItems]         = useState<ProductGroup[]>([]);
  const [summary, setSummary]     = useState<Summary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [total, setTotal]         = useState(0);
  const [page, setPage]           = useState(1);
  const [lastPage, setLastPage]   = useState(1);

  // Filters
  const [search, setSearch]       = useState('');
  const [sortBy, setSortBy]       = useState('received_date');
  const [sortDir, setSortDir]     = useState<'desc' | 'asc'>('desc');
  const perPage = 15;

  // Expanded state
  const [expandedProducts, setExpandedProducts] = useState<Set<number>>(new Set());
  const [expandedPOs, setExpandedPOs]           = useState<Set<string>>(new Set());
  const [expandedBatches, setExpandedBatches]   = useState<Set<number>>(new Set());

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (pg = 1) => {
    setIsLoading(true);
    try {
      const res = await axiosInstance.get('/inventory/intelligence/batch-report', {
        params: { search: search || undefined, sort_by: sortBy, sort_dir: sortDir, per_page: perPage, page: pg },
      });
      if (res.data.success) {
        const d = res.data.data;
        setItems(d.items);
        setSummary(d.summary);
        setTotal(d.total);
        setLastPage(d.last_page);
        setPage(pg);
      }
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed to load batch report');
    } finally {
      setIsLoading(false);
    }
  }, [search, sortBy, sortDir]);

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => load(1), 400);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [load]);

  const toggleProduct = (id: number) => {
    setExpandedProducts(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };
  const togglePO = (key: string) => {
    setExpandedPOs(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });
  };
  const toggleBatch = (id: number) => {
    setExpandedBatches(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const cycleSort = (field: string) => {
    if (sortBy === field) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setSortBy(field); setSortDir('desc'); }
  };

  const SortBtn = ({ field, label }: { field: string; label: string }) => (
    <button onClick={() => cycleSort(field)}
      className="flex items-center gap-1 text-[10px] font-600 uppercase tracking-wider transition-colors"
      style={{ color: sortBy === field ? '#f0d080' : 'rgba(255,255,255,0.35)' }}>
      {label}
      <ArrowUpDown className="w-3 h-3" style={{ opacity: sortBy === field ? 1 : 0.3 }} />
    </button>
  );

  return (
    <div className="min-h-screen p-6 space-y-5" style={{ background: '#0a0a0f', fontFamily: 'DM Sans, sans-serif' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=DM+Sans:wght@300;400;500;600;700&display=swap');
        .bc { background: linear-gradient(135deg,rgba(255,255,255,0.04),rgba(255,255,255,0.01)); border: 1px solid rgba(255,255,255,0.07); border-radius:14px; }
        .gold { background:linear-gradient(105deg,#c9a84c,#f0d080,#c9a84c); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; }
        .syne { font-family:'Syne',sans-serif; }
        .ghost { background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); color:rgba(255,255,255,0.7); transition:all .2s; border-radius:12px; }
        .ghost:hover { background:rgba(255,255,255,0.08); color:white; }
        .input-dark { background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); color:white; border-radius:12px; transition:all .2s; }
        .input-dark:focus { outline:none; border-color:rgba(201,168,76,0.4); }
        .input-dark::placeholder { color:rgba(255,255,255,0.25); }
        .input-dark option { background:#1a1a2e; }
        .tr:hover { background:rgba(255,255,255,0.02); }
        .scroll-x::-webkit-scrollbar { height:3px; } .scroll-x::-webkit-scrollbar-thumb { background:rgba(201,168,76,0.3); border-radius:99px; }
        .product-row { border-left: 3px solid rgba(201,168,76,0.3); }
        .po-row { border-left: 3px solid rgba(99,102,241,0.3); }
        .batch-row { border-left: 3px solid rgba(52,211,153,0.2); }
      `}</style>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(201,168,76,0.12)', border: '1px solid rgba(201,168,76,0.25)' }}>
              <Boxes className="w-5 h-5" style={{ color: '#f0d080' }} />
            </div>
            <h1 className="syne text-2xl font-800 text-white">Batch <span className="gold">Performance</span> Report</h1>
          </div>
          <p style={{ color: 'rgba(255,255,255,0.4)' }} className="text-xs ml-12">
            Product → PO → Batch breakdown with sell-through, velocity &amp; stock analytics
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'rgba(255,255,255,0.3)' }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search product, SKU, PO, batch…"
              className="input-dark pl-9 pr-8 py-2 text-xs w-64" />
            {search && <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2"><X className="w-3.5 h-3.5" style={{ color: 'rgba(255,255,255,0.3)' }} /></button>}
          </div>
          <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="input-dark px-3 py-2 text-xs">
            <option value="received_date">Sort: Received Date</option>
            <option value="sold_units">Sort: Units Sold</option>
            <option value="sell_through">Sort: Sell-Through %</option>
            <option value="revenue">Sort: Revenue</option>
            <option value="velocity">Sort: Velocity</option>
            <option value="days_of_stock">Sort: Days of Stock</option>
            <option value="remaining">Sort: Remaining Stock</option>
          </select>
          <button onClick={() => setSortDir(d => d === 'desc' ? 'asc' : 'desc')} className="ghost p-2">
            <ArrowUpDown className="w-4 h-4" style={{ color: sortDir === 'asc' ? '#f0d080' : 'rgba(255,255,255,0.5)' }} />
          </button>
          <button onClick={() => load(page)} disabled={isLoading} className="ghost flex items-center gap-1.5 px-3 py-2 text-xs">
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {[
            { label: 'Products',    value: summary.total_products,   color: '#818cf8', bg: 'rgba(99,102,241,0.08)',  border: 'rgba(99,102,241,0.12)' },
            { label: 'POs',         value: summary.total_pos,        color: '#f0d080', bg: 'rgba(201,168,76,0.08)', border: 'rgba(201,168,76,0.12)' },
            { label: 'Batches',     value: summary.total_batches,    color: '#34d399', bg: 'rgba(52,211,153,0.08)', border: 'rgba(52,211,153,0.12)' },
            { label: 'Units Sold',  value: summary.total_sold,       color: '#fb923c', bg: 'rgba(249,115,22,0.08)', border: 'rgba(249,115,22,0.12)' },
            { label: 'Sell-Through',value: `${summary.overall_sell_through}%`, color: summary.overall_sell_through >= 50 ? '#34d399' : '#f87171', bg: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.08)' },
          ].map(s => (
            <div key={s.label} className="rounded-xl p-4" style={{ background: s.bg, border: `1px solid ${s.border}` }}>
              <p className="text-[9px] uppercase tracking-widest font-600 mb-1.5" style={{ color: 'rgba(255,255,255,0.4)' }}>{s.label}</p>
              <p className="syne text-2xl font-800" style={{ color: s.color }}>{s.value}</p>
            </div>
          ))}
        </div>
      )}
      {summary && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Total Revenue',    value: tk(summary.total_revenue),    color: '#f0d080' },
            { label: 'Gross Profit',     value: tk(summary.total_profit),     color: '#34d399' },
            { label: 'Stock Value Left', value: tk(summary.total_stock_value),color: '#818cf8' },
          ].map(s => (
            <div key={s.label} className="bc p-4 flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-widest font-600" style={{ color: 'rgba(255,255,255,0.4)' }}>{s.label}</span>
              <span className="syne text-lg font-800" style={{ color: s.color }}>{s.value}</span>
            </div>
          ))}
        </div>
      )}

      {/* Main table */}
      <div className="bc overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
              style={{ borderColor: 'rgba(201,168,76,0.3)', borderTopColor: '#f0d080' }} />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-16">
            <Package className="w-12 h-12 mx-auto mb-3 opacity-10 text-white" />
            <p style={{ color: 'rgba(255,255,255,0.4)' }} className="text-sm">No batch data found</p>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
            {items.map(product => {
              const isProdExpanded = expandedProducts.has(product.product_id);
              return (
                <div key={product.product_id}>
                  {/* ── Product Row ── */}
                  <div className="product-row px-5 py-3.5 cursor-pointer tr"
                    onClick={() => toggleProduct(product.product_id)}>
                    <div className="flex items-center gap-3">
                      <div className="w-5 h-5 flex items-center justify-center shrink-0">
                        {isProdExpanded
                          ? <ChevronDown className="w-4 h-4" style={{ color: '#f0d080' }} />
                          : <ChevronRight className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.4)' }} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-white text-sm font-700">{product.product_name}</span>
                          <span className="text-[10px] font-mono" style={{ color: 'rgba(255,255,255,0.35)' }}>{product.product_sku}</span>
                          <span className="text-[9px] font-600 px-1.5 py-0.5 rounded"
                            style={{ background: 'rgba(201,168,76,0.1)', color: '#f0d080', border: '1px solid rgba(201,168,76,0.2)' }}>
                            {product.po_count} PO{product.po_count !== 1 ? 's' : ''} · {product.batch_count} batch{product.batch_count !== 1 ? 'es' : ''}
                          </span>
                        </div>
                      </div>
                      {/* Product-level metrics */}
                      <div className="hidden lg:flex items-center gap-6 text-right shrink-0">
                        <div>
                          <p className="text-[9px] text-muted uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.35)' }}>Received</p>
                          <p className="text-xs font-700 text-white">{product.total_original}</p>
                        </div>
                        <div>
                          <p className="text-[9px] uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.35)' }}>Sold</p>
                          <p className="text-xs font-700" style={{ color: '#34d399' }}>{product.total_sold}</p>
                        </div>
                        <div>
                          <p className="text-[9px] uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.35)' }}>Remaining</p>
                          <p className="text-xs font-700" style={{ color: '#818cf8' }}>{product.total_remaining}</p>
                        </div>
                        <div className="w-28">
                          <p className="text-[9px] uppercase tracking-widest mb-1" style={{ color: 'rgba(255,255,255,0.35)' }}>Sell-Through</p>
                          <SellThroughBar value={product.overall_sell_through} />
                        </div>
                        <div>
                          <p className="text-[9px] uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.35)' }}>Revenue</p>
                          <p className="text-xs font-700 syne gold">{tk(product.total_revenue)}</p>
                        </div>
                        <div>
                          <p className="text-[9px] uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.35)' }}>Profit</p>
                          <p className="text-xs font-700" style={{ color: '#34d399' }}>{tk(product.total_profit)}</p>
                        </div>
                        <div>
                          <p className="text-[9px] uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.35)' }}>Velocity</p>
                          <p className="text-xs font-700" style={{ color: '#fbbf24' }}>{product.avg_velocity.toFixed(3)}/d</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ── PO Groups ── */}
                  {isProdExpanded && product.by_po.map(po => {
                    const poKey = `${product.product_id}-${po.po_number}`;
                    const isPOExpanded = expandedPOs.has(poKey);
                    return (
                      <div key={poKey} style={{ background: 'rgba(99,102,241,0.02)' }}>
                        {/* PO row */}
                        <div className="po-row pl-10 pr-5 py-3 cursor-pointer tr"
                          onClick={() => togglePO(poKey)}>
                          <div className="flex items-center gap-3">
                            <div className="w-4 h-4 flex items-center justify-center shrink-0">
                              {isPOExpanded
                                ? <ChevronDown className="w-3.5 h-3.5" style={{ color: '#818cf8' }} />
                                : <ChevronRight className="w-3.5 h-3.5" style={{ color: 'rgba(255,255,255,0.3)' }} />}
                            </div>
                            <div className="flex items-center gap-3 flex-1 min-w-0 flex-wrap">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-700" style={{ color: '#818cf8' }}>
                                  {po.po_number === 'Manual/Direct' ? '📦 Manual/Direct' : `🛒 ${po.po_number}`}
                                </span>
                                <StatusBadge status={po.po_status} />
                              </div>
                              {po.vendor_name && po.vendor_name !== 'Unknown' && (
                                <span className="text-[10px] font-500" style={{ color: 'rgba(255,255,255,0.4)' }}>
                                  from {po.vendor_name}
                                </span>
                              )}
                              {po.po_received_date && (
                                <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
                                  · Received {format(new Date(po.po_received_date), 'dd MMM yyyy')}
                                </span>
                              )}
                              <span className="text-[9px] px-1.5 py-0.5 rounded"
                                style={{ background: 'rgba(99,102,241,0.1)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.2)' }}>
                                {po.batches.length} batch{po.batches.length !== 1 ? 'es' : ''}
                              </span>
                            </div>
                            {/* PO-level metrics */}
                            <div className="hidden lg:flex items-center gap-6 text-right shrink-0">
                              <div>
                                <p className="text-[9px] uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.3)' }}>Ordered</p>
                                <p className="text-xs font-700 text-white">{po.po_original_qty}</p>
                              </div>
                              <div>
                                <p className="text-[9px] uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.3)' }}>Sold</p>
                                <p className="text-xs font-700" style={{ color: '#34d399' }}>{po.po_units_sold}</p>
                              </div>
                              <div>
                                <p className="text-[9px] uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.3)' }}>Left</p>
                                <p className="text-xs font-700" style={{ color: '#818cf8' }}>{po.po_remaining}</p>
                              </div>
                              <div className="w-24">
                                <p className="text-[9px] uppercase tracking-widest mb-1" style={{ color: 'rgba(255,255,255,0.3)' }}>Sell-Through</p>
                                <SellThroughBar value={po.po_sell_through} />
                              </div>
                              <div>
                                <p className="text-[9px] uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.3)' }}>Revenue</p>
                                <p className="text-xs font-700" style={{ color: '#f0d080' }}>{tk(po.po_revenue)}</p>
                              </div>
                              <div>
                                <p className="text-[9px] uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.3)' }}>Profit</p>
                                <p className="text-xs font-700" style={{ color: '#34d399' }}>{tk(po.po_gross_profit)}</p>
                              </div>
                              <div>
                                <p className="text-[9px] uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.3)' }}>Stock Value</p>
                                <p className="text-xs font-700" style={{ color: '#818cf8' }}>{tk(po.po_stock_value)}</p>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* ── Batch rows under this PO ── */}
                        {isPOExpanded && po.batches.map(batch => {
                          const isBatchExpanded = expandedBatches.has(batch.batch_id);
                          return (
                            <div key={batch.batch_id} style={{ background: 'rgba(52,211,153,0.02)' }}>
                              <div className="batch-row pl-16 pr-5 py-2.5 tr"
                                onClick={() => toggleBatch(batch.batch_id)} style={{ cursor: 'pointer' }}>
                                <div className="flex items-center gap-3">
                                  <div className="w-4 h-4 shrink-0">
                                    {isBatchExpanded
                                      ? <ChevronDown className="w-3 h-3" style={{ color: '#34d399' }} />
                                      : <ChevronRight className="w-3 h-3" style={{ color: 'rgba(255,255,255,0.25)' }} />}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="text-[11px] font-700 font-mono" style={{ color: '#34d399' }}>{batch.batch_number}</span>
                                      <span className="text-[9px]" style={{ color: 'rgba(255,255,255,0.35)' }}>
                                        @ {batch.store_name}
                                      </span>
                                      {batch.days_since_received !== null && (
                                        <span className="text-[9px]" style={{ color: 'rgba(255,255,255,0.25)' }}>
                                          · {batch.days_since_received}d ago
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  {/* Batch metrics */}
                                  <div className="hidden xl:flex items-center gap-5 text-right shrink-0">
                                    <div>
                                      <p className="text-[9px] uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.25)' }}>Rcvd</p>
                                      <p className="text-[11px] font-700 text-white">{batch.original_qty}</p>
                                    </div>
                                    <div>
                                      <p className="text-[9px] uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.25)' }}>Sold</p>
                                      <p className="text-[11px] font-700" style={{ color: '#34d399' }}>{batch.units_sold}</p>
                                    </div>
                                    <div>
                                      <p className="text-[9px] uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.25)' }}>Left</p>
                                      <p className="text-[11px] font-700" style={{ color: '#818cf8' }}>{batch.remaining_stock}</p>
                                    </div>
                                    <div className="w-20">
                                      <p className="text-[9px] uppercase tracking-widest mb-1" style={{ color: 'rgba(255,255,255,0.25)' }}>S/T</p>
                                      <SellThroughBar value={batch.sell_through_pct} />
                                    </div>
                                    <div>
                                      <p className="text-[9px] uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.25)' }}>Revenue</p>
                                      <p className="text-[11px] font-700" style={{ color: '#f0d080' }}>{tk(batch.revenue)}</p>
                                    </div>
                                    <div>
                                      <p className="text-[9px] uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.25)' }}>Margin</p>
                                      <p className="text-[11px] font-700" style={{ color: batch.margin_pct >= 20 ? '#34d399' : '#fbbf24' }}>{pct(batch.margin_pct)}</p>
                                    </div>
                                    <div>
                                      <p className="text-[9px] uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.25)' }}>Vel/d</p>
                                      <p className="text-[11px] font-700" style={{ color: '#fbbf24' }}>{batch.velocity_per_day.toFixed(3)}</p>
                                    </div>
                                    <div>
                                      <DaysChip days={batch.days_of_stock} />
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Batch detail panel */}
                              {isBatchExpanded && (
                                <div className="pl-20 pr-5 pb-4" style={{ background: 'rgba(0,0,0,0.15)' }}>
                                  <div className="rounded-xl p-4 mt-1"
                                    style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                                      {[
                                        { label: 'Cost Price',    value: tk(batch.cost_price) },
                                        { label: 'Sell Price',    value: tk(batch.sell_price) },
                                        { label: 'Stock Value',   value: tk(batch.stock_value) },
                                        { label: 'Pot. Revenue',  value: tk(batch.potential_revenue) },
                                        { label: 'Gross Profit',  value: tk(batch.gross_profit), color: '#34d399' },
                                        { label: 'Orders',        value: batch.order_count },
                                        { label: 'First Sale',    value: batch.first_sale_date ? format(new Date(batch.first_sale_date), 'dd MMM yy') : '—' },
                                        { label: 'Last Sale',     value: batch.last_sale_date  ? format(new Date(batch.last_sale_date),  'dd MMM yy') : '—' },
                                      ].map(m => (
                                        <div key={m.label} className="rounded-lg p-2.5"
                                          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.04)' }}>
                                          <p className="text-[9px] uppercase tracking-widest mb-1" style={{ color: 'rgba(255,255,255,0.3)' }}>{m.label}</p>
                                          <p className="text-xs font-700" style={{ color: (m as any).color || 'white' }}>{m.value}</p>
                                        </div>
                                      ))}
                                    </div>

                                    {/* Store distribution */}
                                    {batch.store_distribution.length > 0 && (
                                      <div>
                                        <p className="text-[9px] uppercase tracking-widest font-600 mb-2"
                                          style={{ color: 'rgba(255,255,255,0.3)' }}>Barcode Distribution Across Branches</p>
                                        <div className="flex flex-wrap gap-2">
                                          {batch.store_distribution.map(d => (
                                            <div key={d.store_id} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg"
                                              style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.15)' }}>
                                              <Building2 className="w-3 h-3" style={{ color: '#818cf8' }} />
                                              <span className="text-[10px] text-white font-600">{d.store_name}</span>
                                              <span className="text-[10px] font-700" style={{ color: '#818cf8' }}>{d.count} units</span>
                                              <span className="text-[9px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
                                                ({d.statuses.join(', ')})
                                              </span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pagination */}
      {lastPage > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.35)' }}>
            Showing page {page} of {lastPage} · {total} products
          </p>
          <div className="flex items-center gap-2">
            <button onClick={() => load(page - 1)} disabled={page <= 1 || isLoading}
              className="ghost px-3 py-1.5 text-xs disabled:opacity-30">← Prev</button>
            <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>{page} / {lastPage}</span>
            <button onClick={() => load(page + 1)} disabled={page >= lastPage || isLoading}
              className="ghost px-3 py-1.5 text-xs disabled:opacity-30">Next →</button>
          </div>
        </div>
      )}
    </div>
  );
}
