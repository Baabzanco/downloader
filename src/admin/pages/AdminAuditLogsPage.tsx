import React, { useState, useEffect } from 'react';
import { AdminLayout } from '../components/AdminLayout';
import { useAdminAuth } from '../context/AdminAuthContext';
import {
  FileText,
  Search,
  Filter,
  Clock,
  User,
  Shield,
  Loader2,
  Code,
  X,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react';
import { AuditLog } from '../types';

interface AdminAuditLogsPageProps {
  currentPath: string;
  onNavigate: (path: string) => void;
}

export const AdminAuditLogsPage: React.FC<AdminAuditLogsPageProps> = ({ currentPath, onNavigate }) => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState('');
  const [resourceFilter, setResourceFilter] = useState('');
  const [page, setPage] = useState(0);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const limit = 25;

  const fetchAuditLogs = async () => {
    try {
      setLoading(true);
      let url = `/api/admin/audit-logs?limit=${limit}&offset=${page * limit}`;
      if (actionFilter) url += `&action=${encodeURIComponent(actionFilter)}`;
      if (resourceFilter) url += `&resourceType=${encodeURIComponent(resourceFilter)}`;

      const res = await fetch(url);
      const data = await res.json();
      if (res.ok && data.success) {
        setLogs(data.logs || []);
        setTotal(data.total || 0);
      }
    } catch {
      // safe fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditLogs();
  }, [actionFilter, resourceFilter, page]);

  return (
    <AdminLayout
      currentPath={currentPath}
      onNavigate={onNavigate}
      title="Audit Logs"
      subtitle="Immutable event trail of administrative actions, credential changes, and security events"
    >
      {/* Information Banner */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex items-center justify-between text-xs text-zinc-400">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-emerald-400" />
          <span>
            Strict privacy redaction active: Passwords, session tokens, cookies, and secret keys are never recorded.
          </span>
        </div>
        <span className="font-mono text-zinc-500">{total} total audit entries</span>
      </div>

      {/* Filters Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-zinc-900 border border-zinc-800 p-4 rounded-xl">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <input
            type="text"
            placeholder="Filter by action (e.g. LOGIN_SUCCESS, ROLE_UPDATED)..."
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value);
              setPage(0);
            }}
            className="px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-blue-500 w-64"
          />

          <select
            value={resourceFilter}
            onChange={(e) => {
              setResourceFilter(e.target.value);
              setPage(0);
            }}
            className="px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-300 focus:outline-none"
          >
            <option value="">All Resource Types</option>
            <option value="auth">auth</option>
            <option value="admin_user">admin_user</option>
            <option value="role">role</option>
            <option value="setting">setting</option>
            <option value="system">system</option>
          </select>
        </div>

        {/* Pagination Controls */}
        <div className="flex items-center gap-2 text-xs text-zinc-400">
          <span>
            Page {page + 1} of {Math.max(1, Math.ceil(total / limit))}
          </span>
          <button
            onClick={() => setPage(Math.max(0, page - 1))}
            disabled={page === 0}
            className="p-1 rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed text-white"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => setPage(page + 1)}
            disabled={(page + 1) * limit >= total}
            className="p-1 rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed text-white"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-lg">
        {loading ? (
          <div className="py-16 text-center text-xs text-zinc-500 flex flex-col items-center justify-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
            <span>Retrieving audit trail...</span>
          </div>
        ) : logs.length === 0 ? (
          <div className="py-16 text-center text-xs text-zinc-500">No audit events found matching filters.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-zinc-300">
              <thead className="bg-zinc-950/60 border-b border-zinc-800 text-zinc-400 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-5 py-3">Timestamp</th>
                  <th className="px-5 py-3">Action</th>
                  <th className="px-5 py-3">Resource</th>
                  <th className="px-5 py-3">Actor</th>
                  <th className="px-5 py-3">Client IP</th>
                  <th className="px-5 py-3 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60 font-mono text-[11px]">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-zinc-800/30 transition-colors">
                    <td className="px-5 py-3 text-zinc-400">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="px-5 py-3">
                      <span className="font-semibold text-white bg-zinc-800 px-2 py-0.5 rounded border border-zinc-700/60">
                        {log.action}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-zinc-300 font-sans">
                      <span className="capitalize">{log.resourceType}</span>
                      {log.resourceId && (
                        <span className="text-[10px] text-zinc-500 font-mono ml-1">({log.resourceId.slice(0, 8)}...)</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-zinc-300 font-sans">
                      {log.actorEmail || 'System Bootstrap'}
                    </td>
                    <td className="px-5 py-3 text-zinc-500">{log.ipAddress || '127.0.0.1'}</td>
                    <td className="px-5 py-3 text-right">
                      {log.metadata ? (
                        <button
                          onClick={() => setSelectedLog(log)}
                          className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-blue-400 text-[10px] font-sans font-medium transition-colors"
                        >
                          Inspect JSON
                        </button>
                      ) : (
                        <span className="text-zinc-600 font-sans text-[10px]">None</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* METADATA INSPECTION MODAL */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3 mb-4">
              <div>
                <h3 className="text-sm font-bold text-white font-mono">{selectedLog.action}</h3>
                <p className="text-xs text-zinc-500">Event ID: {selectedLog.id}</p>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs mb-4">
              <div className="flex justify-between text-zinc-400 border-b border-zinc-800/60 pb-2">
                <span>Actor:</span>
                <span className="text-white font-medium">{selectedLog.actorEmail || 'System'}</span>
              </div>
              <div className="flex justify-between text-zinc-400 border-b border-zinc-800/60 pb-2">
                <span>Timestamp:</span>
                <span className="text-white font-mono">{new Date(selectedLog.createdAt).toISOString()}</span>
              </div>
              <div className="flex justify-between text-zinc-400 border-b border-zinc-800/60 pb-2">
                <span>User Agent:</span>
                <span className="text-zinc-300 truncate max-w-xs">{selectedLog.userAgent || 'Unknown'}</span>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-zinc-400 mb-1.5">Sanitized Event Metadata</p>
              <pre className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 text-[11px] font-mono text-emerald-400 overflow-x-auto max-h-56">
                {JSON.stringify(selectedLog.metadata, null, 2)}
              </pre>
            </div>

            <div className="flex justify-end pt-4 mt-4 border-t border-zinc-800">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-300 font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
};
