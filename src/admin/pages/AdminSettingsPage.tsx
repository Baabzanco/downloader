import React, { useState, useEffect } from 'react';
import { AdminLayout } from '../components/AdminLayout';
import { useAdminAuth } from '../context/AdminAuthContext';
import { Sliders, CheckCircle, AlertCircle, Loader2, Save, Shield } from 'lucide-react';
import { AdminSetting } from '../types';

interface AdminSettingsPageProps {
  currentPath: string;
  onNavigate: (path: string) => void;
}

export const AdminSettingsPage: React.FC<AdminSettingsPageProps> = ({ currentPath, onNavigate }) => {
  const { hasPermission } = useAdminAuth();
  const [settings, setSettings] = useState<AdminSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  // Form values state
  const [values, setValues] = useState<Record<string, string>>({});

  const canWrite = hasPermission('settings.write');

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/settings');
      const data = await res.json();
      if (res.ok && data.success) {
        setSettings(data.settings || []);
        const vals: Record<string, string> = {};
        for (const s of data.settings || []) {
          vals[s.key] = s.value;
        }
        setValues(vals);
      } else {
        setError(data.error?.message || 'Failed to load settings.');
      }
    } catch {
      setError('Network communication failure.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSaveSetting = async (key: string) => {
    if (!canWrite) return;
    setSavingKey(key);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key,
          value: values[key],
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSuccess(`Setting "${key}" updated successfully.`);
        fetchSettings();
      } else {
        setError(data.error?.message || 'Failed to update setting.');
      }
    } catch {
      setError('Network communication failure.');
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <AdminLayout
      currentPath={currentPath}
      onNavigate={onNavigate}
      title="System Settings"
      subtitle="Application configuration, rate limit thresholds, and platform runtime options"
    >
      {/* Notifications */}
      {success && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-400" />
            <span>{success}</span>
          </div>
          <button onClick={() => setSuccess(null)} className="text-emerald-400 hover:text-white">
            ×
          </button>
        </div>
      )}

      {error && (
        <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-white">
            ×
          </button>
        </div>
      )}

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 shadow-xl space-y-6">
        <div>
          <h3 className="text-sm font-bold text-white">Platform Configuration Parameters</h3>
          <p className="text-xs text-zinc-400 mt-0.5">
            Parameters control server-side rate limits, maintenance flags, and global headers.
          </p>
        </div>

        {loading ? (
          <div className="py-16 text-center text-xs text-zinc-500 flex flex-col items-center justify-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
            <span>Loading settings...</span>
          </div>
        ) : (
          <div className="divide-y divide-zinc-800/80">
            {settings.map((s) => (
              <div key={s.key} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-0.5 max-w-md">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-white">{s.key}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700/60 uppercase">
                      {s.category}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400">{s.description || 'System setting'}</p>
                  <p className="text-[10px] text-zinc-500 font-mono">
                    Last updated: {new Date(s.updatedAt).toLocaleString()} by {s.updatedBy || 'system'}
                  </p>
                </div>

                <div className="flex items-center gap-2 sm:w-80">
                  <input
                    type="text"
                    disabled={!canWrite || s.isSecret}
                    value={values[s.key] !== undefined ? values[s.key] : s.value}
                    onChange={(e) => setValues({ ...values, [s.key]: e.target.value })}
                    className="flex-1 px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-white disabled:opacity-60 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />

                  {canWrite && (
                    <button
                      onClick={() => handleSaveSetting(s.key)}
                      disabled={savingKey === s.key || values[s.key] === s.value}
                      className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-medium text-white flex items-center gap-1.5 transition-all shrink-0"
                    >
                      {savingKey === s.key ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Save className="w-3.5 h-3.5" />
                      )}
                      <span>Save</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
};
