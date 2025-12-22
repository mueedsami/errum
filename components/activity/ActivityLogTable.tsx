'use client';

import React, { useMemo, useState } from 'react';
import { Search, ChevronDown, ChevronUp } from 'lucide-react';
import type { ActivityLogEntry } from '@/services/activityService';

type Props = {
  logs: ActivityLogEntry[];
  isLoading?: boolean;
  emptyText?: string;
  compact?: boolean;
};

function safeStr(v: any) {
  return String(v ?? '').trim();
}

function formatTs(ts: string) {
  try {
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return ts;
    return d.toLocaleString('en-GB');
  } catch {
    return ts;
  }
}

export default function ActivityLogTable({ logs, isLoading, emptyText, compact }: Props) {
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return logs;
    return logs.filter((l) => {
      const actor = safeStr(l.user?.name || l.user?.email || l.user?.id);
      const type = safeStr(l.type);
      const action = safeStr(l.action);
      const desc = safeStr(l.description);
      const meta = safeStr(JSON.stringify(l.metadata || {}));
      return [actor, type, action, desc, meta].some((x) => x.toLowerCase().includes(q));
    });
  }, [logs, query]);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search activities..."
            className="w-full pl-10 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded bg-white dark:bg-gray-900 text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
          />
        </div>
      </div>

      <div className="border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="p-6 text-center text-sm text-gray-500 dark:text-gray-400">Loading activity logs...</div>
        ) : filtered.length === 0 ? (
          <div className="p-6 text-center text-sm text-gray-500 dark:text-gray-400">{emptyText || 'No activity logs found.'}</div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">Time</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">Actor</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">Type</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">Action</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">Description</th>
                <th className="px-4 py-2 text-right text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">Details</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
              {filtered.map((l) => {
                const key = String(l.id);
                const isOpen = !!expanded[key];
                const actor = l.user?.name || l.user?.email || (l.user?.id ? `User#${l.user.id}` : 'System');
                return (
                  <React.Fragment key={key}>
                    <tr className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">{formatTs(l.created_at)}</td>
                      <td className="px-4 py-3 text-sm font-medium text-black dark:text-white">{actor}</td>
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{l.type || '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{l.action || '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                        <span className={compact ? 'line-clamp-1' : ''}>{l.description || '-'}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => setExpanded((p) => ({ ...p, [key]: !p[key] }))}
                          className="inline-flex items-center gap-1 text-xs font-medium text-black dark:text-white hover:underline"
                        >
                          {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          {isOpen ? 'Hide' : 'Show'}
                        </button>
                      </td>
                    </tr>

                    {isOpen && (
                      <tr className="bg-gray-50 dark:bg-gray-900">
                        <td colSpan={6} className="px-4 py-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div className="text-xs text-gray-600 dark:text-gray-400">
                              <div className="font-semibold text-gray-800 dark:text-gray-200 mb-1">Request</div>
                              <div>IP: {l.ip_address || '-'}</div>
                              <div className="break-words">UA: {l.user_agent || '-'}</div>
                            </div>
                            <div className="text-xs">
                              <div className="font-semibold text-gray-800 dark:text-gray-200 mb-1">Metadata</div>
                              <pre className="text-[11px] bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded p-2 overflow-auto max-h-40 text-black dark:text-white">
{JSON.stringify(l.metadata ?? {}, null, 2)}
                              </pre>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
