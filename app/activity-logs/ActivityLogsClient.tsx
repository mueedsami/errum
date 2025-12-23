'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Header from '@/components/Header';
import Sidebar from '@/components/Sidebar';
import { Calendar, History, Loader, Search, RefreshCw } from 'lucide-react';
import activityService, { ActivityLogEntry, ActivityLogParams } from '@/services/activityService';
import ActivityLogTable from '@/components/activity/ActivityLogTable';
import { useSearchParams } from 'next/navigation';

type UserOpt = { id: number; name: string };
type ModelOpt = { value: string; label: string; full_name: string };

const iso = (d: Date) => d.toISOString().slice(0, 10);

export default function ActivityLogsClient() {
  const sp = useSearchParams();
  const [darkMode, setDarkMode] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [users, setUsers] = useState<UserOpt[]>([]);
  const [models, setModels] = useState<ModelOpt[]>([]);
  const [filtersLoading, setFiltersLoading] = useState(false);

  const [logs, setLogs] = useState<ActivityLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // filters
  const [q, setQ] = useState<string>(sp.get('q') || sp.get('search') || '');
  // We store module as `subject_type` (full class name), but still allow plain strings.
  const [module, setModule] = useState<string>(sp.get('module') || '');
  const [employeeId, setEmployeeId] = useState<string>(sp.get('employee') || sp.get('employeeId') || '');
  const [event, setEvent] = useState<string>(sp.get('event') || '');

  // Optional: deep-link to a specific model record's logs
  const [modelName, setModelName] = useState<string>(sp.get('model') || '');
  const [entityId, setEntityId] = useState<string>(sp.get('id') || sp.get('entityId') || '');

  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return iso(d);
  });
  const [endDate, setEndDate] = useState<string>(() => iso(new Date()));

  const params: ActivityLogParams = useMemo(
    () => ({
      start_date: startDate,
      end_date: endDate,
      search: q.trim() || undefined,
      type: module.trim() || undefined,
      event: event.trim() || undefined,
      employee_id: employeeId ? Number(employeeId) : undefined,
      page: 1,
      per_page: 100,
    }),
    [startDate, endDate, q, module, employeeId, event]
  );

  const loadFilterOptions = async () => {
    setFiltersLoading(true);
    try {
      const [u, m] = await Promise.all([
        activityService.getAvailableUsers().catch(() => ({ data: [] })),
        activityService.getAvailableModels().catch(() => ({ data: [] })),
      ]);

      const mappedUsers: UserOpt[] = (u.data || [])
        .map((x: any) => ({ id: Number(x.id), name: String(x.name || `User #${x.id}`) }))
        .filter((x) => Number.isFinite(x.id));
      mappedUsers.sort((a, b) => a.name.localeCompare(b.name));
      setUsers(mappedUsers);

      const mappedModels: ModelOpt[] = (m.data || [])
        .map((x: any) => ({
          value: String(x.value || ''),
          label: String(x.label || x.value || ''),
          full_name: String(x.full_name || ''),
        }))
        .filter((x) => x.full_name);
      mappedModels.sort((a, b) => a.label.localeCompare(b.label));
      setModels(mappedModels);
    } finally {
      setFiltersLoading(false);
    }
  };

  const loadLogs = async () => {
    setIsLoading(true);
    setError(null);
    try {
      if (modelName && entityId) {
        const res = await activityService.getModelLogs(modelName, entityId);
        setLogs(res.data);
      } else {
        const res = await activityService.getLogs(params);
        setLogs(res.data);
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to load activity logs.');
      setLogs([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadFilterOptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.start_date, params.end_date, params.search, params.type, params.employee_id, params.event, modelName, entityId]);

  return (
    <div className={darkMode ? 'dark' : ''}>
      <div className="flex h-screen bg-white dark:bg-black">
        <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header darkMode={darkMode} setDarkMode={setDarkMode} toggleSidebar={() => setSidebarOpen(!sidebarOpen)} />

          <main className="flex-1 overflow-auto bg-white dark:bg-black">
            <div className="border-b border-gray-200 dark:border-gray-800">
              <div className="px-4 py-2">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-black dark:bg-white rounded">
                      <History className="w-4 h-4 text-white dark:text-black" />
                    </div>
                    <div>
                      <h1 className="text-lg font-bold text-black dark:text-white leading-none">Activity Logs</h1>
                      <p className="text-[10px] text-gray-600 dark:text-gray-400 leading-none mt-0.5">
                        {logs.length} entries
                        {modelName && entityId ? ` • ${modelName} #${entityId}` : module ? ` • ${module}` : ''}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={loadLogs}
                    className="inline-flex items-center gap-1 px-2 py-1 border border-gray-300 dark:border-gray-700 rounded text-xs font-medium text-black dark:text-white hover:bg-gray-50 dark:hover:bg-gray-900"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                    Refresh
                  </button>
                </div>
              </div>
            </div>

            {/* Filters */}
            <div className="max-w-7xl mx-auto px-4 py-3">
              <div className="grid grid-cols-1 md:grid-cols-6 gap-2">
                <div className="md:col-span-2 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search (order no, barcode, note, action...)"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    className="w-full pl-10 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded bg-white dark:bg-gray-900 text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                  />
                </div>

                <select
                  value={module}
                  onChange={(e) => setModule(e.target.value)}
                  className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded bg-white dark:bg-gray-900 text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                >
                  <option value="">All modules</option>
                  {/* If models list is available, show them */}
                  {models.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                  {/* Fallback common modules */}
                  <option value="orders">Orders</option>
                  <option value="products">Products</option>
                  <option value="batches">Batches</option>
                  <option value="inventory">Inventory</option>
                </select>

                <select
                  value={event}
                  onChange={(e) => setEvent(e.target.value)}
                  className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded bg-white dark:bg-gray-900 text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                >
                  <option value="">All actions</option>
                  <option value="created">created</option>
                  <option value="updated">updated</option>
                  <option value="deleted">deleted</option>
                </select>

                <select
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded bg-white dark:bg-gray-900 text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                >
                  <option value="">All users</option>
                  {users.map((u) => (
                    <option key={u.id} value={String(u.id)}>
                      {u.name}
                    </option>
                  ))}
                </select>

                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full pl-10 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded bg-white dark:bg-gray-900 text-black dark:text-white focus:outline-none"
                    />
                  </div>
                  <div className="relative flex-1">
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded bg-white dark:bg-gray-900 text-black dark:text-white focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-2 flex items-center justify-between">
                <p className="text-xs text-gray-500 dark:text-gray-500">
                  Tip: You can filter by module (model), action, user and date range. Deep links like <code className="px-1 py-0.5 bg-gray-100 dark:bg-gray-900 rounded">?model=Order&id=123</code> show logs for a specific record.
                </p>
                {filtersLoading && (
                  <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                    <Loader className="w-3.5 h-3.5 animate-spin" />
                    Loading filters...
                  </div>
                )}
              </div>
            </div>

            {/* Table */}
            <div className="max-w-7xl mx-auto px-4 pb-6">
              {error ? (
                <div className="border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-900/10 rounded-lg p-4 text-sm text-red-700 dark:text-red-300">
                  {error}
                  <div className="text-xs text-gray-600 dark:text-gray-400 mt-2">
                    If your backend doesn't provide a global logs endpoint, this page will fall back to per-employee logs (it may be slower).
                  </div>
                </div>
              ) : null}

              <ActivityLogTable logs={logs} isLoading={isLoading} emptyText="No activities found for this date range." />
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
