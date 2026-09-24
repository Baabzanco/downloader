import React from 'react';
import { useAdminAuth } from '../context/AdminAuthContext';
import { ShieldCheck, Activity } from 'lucide-react';

interface AdminHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export const AdminHeader: React.FC<AdminHeaderProps> = ({ title, subtitle, actions }) => {
  const { adminUser } = useAdminAuth();

  return (
    <header className="h-16 border-b border-zinc-800 bg-zinc-900/60 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-20">
      <div>
        <h2 className="text-base font-semibold text-white tracking-tight">{title}</h2>
        {subtitle && <p className="text-xs text-zinc-400">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-4">
        {actions}

        <div className="flex items-center gap-2 border-l border-zinc-800 pl-4">
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[11px] font-medium text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>Engine Online</span>
          </div>

          {adminUser?.roles?.map((r) => (
            <span
              key={r.id}
              className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                r.name === 'SUPER_ADMIN'
                  ? 'bg-purple-500/15 text-purple-300 border-purple-500/30'
                  : 'bg-blue-500/15 text-blue-300 border-blue-500/30'
              }`}
            >
              {r.name}
            </span>
          ))}
        </div>
      </div>
    </header>
  );
};
