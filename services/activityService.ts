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

  // backend filters
  log_name?: string;
  description?: string;
  event?: string;
  causer_id?: number | string;
  subject_type?: string; // full class name, e.g. App\\Models\\Order
  subject_id?: number | string;
};

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
const MODULE_TO_SUBJECT_TYPE: Record<string, string> = {
  orders: 'App\\Models\\Order',
  order: 'App\\Models\\Order',
  products: 'App\\Models\\Product',
  product: 'App\\Models\\Product',
  batches: 'App\\Models\\Batch',
  batch: 'App\\Models\\Batch',
  shipments: 'App\\Models\\Shipment',
  shipment: 'App\\Models\\Shipment',
  customers: 'App\\Models\\Customer',
  customer: 'App\\Models\\Customer',
  stores: 'App\\Models\\Store',
  store: 'App\\Models\\Store',
};

const baseModelFromSubjectType = (subjectType?: string | null) => {
  if (!subjectType) return '';
  const parts = String(subjectType).split('\\');
  return parts[parts.length - 1] || String(subjectType);
};

const toEntry = (item: any): ActivityLogEntry => {
  const props = item?.properties ?? null;
  const causer = item?.causer ?? null;

  // Some installs store request metadata inside properties.
  const ip = props?.ip_address ?? props?.ip ?? props?.request_ip ?? null;
  const ua = props?.user_agent ?? props?.ua ?? props?.request_user_agent ?? null;

  return {
    id: item?.id,
    created_at: item?.created_at,
    updated_at: item?.updated_at,

    user: causer
      ? {
          id: causer?.id,
          name: causer?.name,
          email: causer?.email,
        }
      : null,

    type: baseModelFromSubjectType(item?.subject_type),
    action: item?.event ?? undefined,
    description: item?.description ?? undefined,
    metadata: props ?? null,
    ip_address: ip,
    user_agent: ua,

    log_name: item?.log_name ?? null,
    event: item?.event ?? null,
    subject_type: item?.subject_type ?? null,
    subject_id: item?.subject_id ?? null,
    causer_id: item?.causer_id ?? null,
    causer_type: item?.causer_type ?? null,
    display: item?.display ?? undefined,
  };
};

const activityService = {
  /**
   * Global/paginated activity logs.
   * Backend: GET /activity-logs
   */
  async getAll(params: (ActivityLogsParams & { type?: string; search?: string; employee_id?: any }) = {}) {
    const {
      // backward-compat inputs (older UI used these)
      type,
      search,
      employee_id,
      ...rest
    } = params as any;

    const mapped: any = { ...rest };

    if (!mapped.subject_type && type) {
      mapped.subject_type = MODULE_TO_SUBJECT_TYPE[String(type).toLowerCase()] || type;
    }

    // older UI used `search` as a description substring
    if (!mapped.description && search) mapped.description = search;

    // older UI used `employee_id` for causer filter
    if (!mapped.causer_id && employee_id) mapped.causer_id = employee_id;

    const res = await axios.get('/activity-logs', { params: mapped });
    const paginator = res.data as Paginator<any>;
    return {
      ...paginator,
      data: Array.isArray(paginator?.data) ? paginator.data.map(toEntry) : [],
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

  async getStats(params: Pick<ActivityLogsParams, 'start_date' | 'end_date'> = {}) {
    const res = await axios.get('/activity-logs/stats', { params });
    return res.data;
  },

  async getAvailableModels() {
    const res = await axios.get('/activity-logs/models');
    return res.data; // {success, data:[{value,label,full_name}]}
  },

  async getAvailableUsers() {
    const res = await axios.get('/activity-logs/users');
    return res.data; // {success, data:[{id,name,email}]}
  },

  async exportCsv(params: ActivityLogsParams = {}) {
    // returns a CSV download response from backend
    const res = await axios.get('/activity-logs/export', {
      params,
      responseType: 'blob',
    });
    return res;
  },
};

export default activityService;
