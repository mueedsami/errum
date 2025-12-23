import axios from '@/lib/axios';

// NOTE:
// This service is intentionally named `activityService` because it is already imported
// throughout the frontend. It maps to the backend's `/activity-logs` API.

export type ActivityLogEntry = {
  id: number;
  created_at: string;
  updated_at?: string;

  // UI-friendly fields
  user?: {
    id?: number;
    name?: string;
    email?: string;
  } | null;

  /** Module/entity (derived from subject_type) */
  type?: string;
  /** Action (derived from event) */
  action?: string;
  description?: string;
  metadata?: Record<string, any> | null;

  // Optional extras (if backend stores these in properties)
  ip_address?: string | null;
  user_agent?: string | null;

  // Raw backend fields (kept for power-users / debugging)
  log_name?: string | null;
  event?: string | null;
  subject_type?: string | null;
  subject_id?: number | string | null;
  causer_id?: number | string | null;
  causer_type?: string | null;
  display?: {
    causer_name?: string;
    subject_name?: string;
    changes_count?: number;
  };
};

export type ActivityLogsParams = {
  page?: number;
  per_page?: number;

  // date range: YYYY-MM-DD
  start_date?: string;
  end_date?: string;
  // preferred backend param names
  date_from?: string;
  date_to?: string;

  // backend filters
  log_name?: string;
  description?: string;
  event?: string;
  causer_id?: number | string;
  subject_type?: string; // full class name, e.g. App\\Models\\Order
  subject_id?: number | string;

  // Newer UI params (will be normalized before request)
  model?: string;
  modelId?: number | string;
  action?: string;
  userId?: number | string;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
};

// Backwards-compatible alias used by existing components.
export type ActivityLogParams = ActivityLogsParams;

type Paginator<T> = {
  current_page: number;
  data: T[];
  first_page_url?: string;
  from?: number | null;
  last_page: number;
  last_page_url?: string;
  next_page_url?: string | null;
  path?: string;
  per_page: number;
  prev_page_url?: string | null;
  to?: number | null;
  total: number;
};

// Convenience mapping for older UI code that passes a short `type` like "orders".
// Backend expects base model names (e.g. "Order"), NOT full class names.
const MODULE_TO_SUBJECT_TYPE: Record<string, string> = {
  orders: 'Order',
  order: 'Order',
  products: 'Product',
  product: 'Product',
  batches: 'ProductBatch',
  batch: 'ProductBatch',
  barcodes: 'ProductBarcode',
  barcode: 'ProductBarcode',
  shipments: 'Shipment',
  shipment: 'Shipment',
  customers: 'Customer',
  customer: 'Customer',
  employees: 'Employee',
  employee: 'Employee',
  stores: 'Store',
  store: 'Store',
};

const baseModelFromSubjectType = (subjectType?: string | null) => {
  if (!subjectType) return '';
  // Accept either "Order" or "App\\Models\\Order"
  const parts = String(subjectType).split('\\');
  return parts[parts.length - 1] || String(subjectType);
};

const toEntry = (item: any): ActivityLogEntry => {
  // Controller returns `metadata` and `changes`, while spatie uses `properties`.
  const props = item?.metadata ?? item?.properties ?? null;
  const causer = item?.causer ?? null;

  // Some installs store request metadata inside metadata/properties.
  const ip = props?.ip_address ?? props?.ip ?? props?.request_ip ?? item?.metadata?.ip_address ?? null;
  const ua = props?.user_agent ?? props?.ua ?? props?.request_user_agent ?? item?.metadata?.user_agent ?? null;

  const subjectBase = item?.subject?.type ?? baseModelFromSubjectType(item?.subject_type);

  return {
    id: item?.id,
    created_at: item?.created_at_formatted ?? item?.created_at,
    updated_at: item?.updated_at,

    user: causer
      ? {
          id: causer?.id,
          name: causer?.name,
          email: causer?.email,
        }
      : null,

    type: subjectBase || undefined,
    action: item?.event ?? undefined,
    description: item?.description ?? undefined,
    metadata: props ?? null,
    ip_address: ip,
    user_agent: ua,

    log_name: item?.log_name ?? null,
    event: item?.event ?? null,
    subject_type: item?.subject?.full_type ?? item?.subject_type ?? null,
    subject_id: item?.subject?.id ?? item?.subject_id ?? null,
    causer_id: item?.causer_id ?? null,
    causer_type: item?.causer_type ?? null,
    display: item?.display ?? undefined,
  };
};

function isPaginator(x: any): x is Paginator<any> {
  return x && typeof x === 'object' && Array.isArray(x.data) && typeof x.current_page === 'number';
}

const activityService = {
  /**
   * Global/paginated activity logs.
   * Backend: GET /activity-logs
   */
  async getAll(
    params: (ActivityLogsParams & {
      // newer UI aliases
      model?: string;
      modelId?: number;
      action?: string;
      userId?: number | string;
      dateFrom?: string;
      dateTo?: string;
      perPage?: number;
      sortBy?: string;
      sortOrder?: string;

      // older UI aliases
      type?: string;
      search?: string;
      employee_id?: any;
    }) = {}
  ) {
    const {
      // backward-compat inputs (older UI used these)
      type,
      search,
      employee_id,
      ...rest
    } = params as any;

    const mapped: any = { ...rest };

    // -----------------------------
    // Newer UI param mapping
    // -----------------------------
    // model/action/userId are the UI filter names
    if (!mapped.subject_type && params?.model && params.model !== 'all') {
      // UI may pass either base model ("Order") or full class name.
      mapped.subject_type = baseModelFromSubjectType(params.model);
    }
    if (!mapped.subject_id && params?.modelId) mapped.subject_id = params.modelId;
    if (!mapped.event && params?.action && params.action !== 'all') mapped.event = params.action;
    if (!mapped.causer_id && params?.userId && params.userId !== 'all') mapped.causer_id = params.userId;

    // date range (UI uses dateFrom/dateTo; backend uses date_from/date_to)
    if (!mapped.date_from && (params as any)?.dateFrom) mapped.date_from = (params as any).dateFrom;
    if (!mapped.date_to && (params as any)?.dateTo) mapped.date_to = (params as any).dateTo;
    if (!mapped.date_from && mapped.start_date) mapped.date_from = mapped.start_date;
    if (!mapped.date_to && mapped.end_date) mapped.date_to = mapped.end_date;

    // Clean up UI-only aliases so we don't send noisy params to backend.
    delete mapped.start_date;
    delete mapped.end_date;
    delete mapped.dateFrom;
    delete mapped.dateTo;
    delete mapped.perPage;
    delete mapped.sortBy;
    delete mapped.sortOrder;
    delete mapped.model;
    delete mapped.modelId;
    delete mapped.action;
    delete mapped.userId;

    // per-page / sorting aliases
    if (!mapped.per_page && (params as any)?.perPage) mapped.per_page = (params as any).perPage;
    if (!mapped.sort_by && (params as any)?.sortBy) mapped.sort_by = (params as any).sortBy;
    // Backend uses sort_direction (not sort_order)
    if (!mapped.sort_direction && (params as any)?.sortOrder) mapped.sort_direction = (params as any).sortOrder;

    if (!mapped.subject_type && type) {
      const normalized = String(type).toLowerCase();
      mapped.subject_type = MODULE_TO_SUBJECT_TYPE[normalized] || baseModelFromSubjectType(type);
    }

    // Search: backend supports a global `search` filter.
    if (!mapped.search && search) mapped.search = search;

    // older UI used `employee_id` for causer filter
    if (!mapped.causer_id && employee_id) {
      mapped.causer_id = employee_id;
      if (!mapped.causer_type) mapped.causer_type = 'Employee';
    }

    const res = await axios.get('/activity-logs', { params: mapped });
    const payload = res.data;

    // Accept either:
    // 1) { success: true, data: <paginator> }
    // 2) <paginator>
    // 3) { data: [...] }
    const maybe = payload?.data && isPaginator(payload.data) ? payload.data : payload;
    let paginator: Paginator<any>;

    if (isPaginator(maybe)) {
      paginator = maybe;
    } else if (Array.isArray(maybe?.data)) {
      // Non-paginated wrapper: { data: [...] }
      paginator = {
        current_page: 1,
        data: maybe.data,
        last_page: 1,
        per_page: maybe.data.length,
        total: maybe.data.length,
        from: maybe.data.length ? 1 : null,
        to: maybe.data.length || null,
      };
    } else if (Array.isArray(maybe)) {
      paginator = {
        current_page: 1,
        data: maybe,
        last_page: 1,
        per_page: maybe.length,
        total: maybe.length,
        from: maybe.length ? 1 : null,
        to: maybe.length || null,
      };
    } else {
      paginator = {
        current_page: 1,
        data: [],
        last_page: 1,
        per_page: mapped.per_page || 50,
        total: 0,
        from: null,
        to: null,
      };
    }

    return {
      ...paginator,
      data: Array.isArray(paginator.data) ? paginator.data.map(toEntry) : [],
    } as Paginator<ActivityLogEntry>;
  },

  /**
   * Entity-specific logs (non-paginated)
   * Backend: GET /activity-logs/model/{ModelBaseName}/{id}
   */
  async getModelLogs(model: string, id: number | string) {
    const res = await axios.get(`/activity-logs/model/${encodeURIComponent(model)}/${encodeURIComponent(String(id))}`);
    const payload = res.data;
    const rows = payload?.data ?? payload;
    return {
      success: Boolean(payload?.success ?? true),
      data: Array.isArray(rows) ? rows.map(toEntry) : [],
      message: payload?.message,
    };
  },

  async getStats(params: Pick<ActivityLogsParams, 'start_date' | 'end_date' | 'date_from' | 'date_to'> = {}) {
    // Backend: GET /activity-logs/statistics (date_from/date_to)
    const mapped: any = { ...params };
    if (mapped.start_date && !mapped.date_from) mapped.date_from = mapped.start_date;
    if (mapped.end_date && !mapped.date_to) mapped.date_to = mapped.end_date;
    delete mapped.start_date;
    delete mapped.end_date;

    const res = await axios.get('/activity-logs/statistics', { params: mapped });
    // Backend returns { success: true, data: { total, by_model, by_event, by_user } }
    return res.data?.data ?? res.data;
  },

  async getAvailableModels() {
    const res = await axios.get('/activity-logs/models');
    return {
      success: Boolean(res.data?.success ?? true),
      data: res.data?.data ?? [],
    };
  },

  async getAvailableUsers() {
    const res = await axios.get('/activity-logs/users');
    return {
      success: Boolean(res.data?.success ?? true),
      data: res.data?.data ?? [],
    };
  },

  // ---- Aliases used by the Activity Logs pages/components ----
  async getLogs(params: any = {}) {
    return this.getAll(params);
  },

  async getModels() {
    return this.getAvailableModels();
  },

  async getUsers() {
    return this.getAvailableUsers();
  },

  async getActions() {
    const stats: any = await this.getStats();
    const byEvent = (stats && (stats.by_event || stats.byEvent)) || {};
    return Object.keys(byEvent).sort();
  },

  async exportCsv(params: ActivityLogsParams = {}) {
    // Backend: GET /activity-logs/export/csv
    const res = await axios.get('/activity-logs/export/csv', {
      params,
      responseType: 'blob',
    });
    return res;
  },

  async exportExcel(params: ActivityLogsParams = {}) {
    // Backend: GET /activity-logs/export/excel
    const res = await axios.get('/activity-logs/export/excel', {
      params,
      responseType: 'blob',
    });
    return res;
  },
};

export default activityService;
