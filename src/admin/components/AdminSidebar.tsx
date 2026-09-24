import React from 'react';
import {
  LayoutDashboard,
  Users,
  Shield,
  FileText,
  Sliders,
  Radio,
  FileCode,
  Image,
  BarChart3,
  LogOut,
  ExternalLink,
  Lock,
  Layers,
} from 'lucide-react';
import { useAdminAuth } from '../context/AdminAuthContext';

interface AdminSidebarProps {
  currentPath: string;
  onNavigate: (path: string) => void;
}

export const AdminSidebar: React.FC<AdminSidebarProps> = ({ currentPath, onNavigate }) => {
  const { adminUser, hasPermission, logout } = useAdminAuth();

  const handleLogout = async () => {
    await logout();
    onNavigate('/admin/login');
  };

  const navItem = (
    label: string,
    path: string,
    icon: React.ReactNode,
    permKey?: string,
    badge?: string,
    disabled = false
  ) => {
    if (permKey && !hasPermission(permKey)) {
      return null;
    }

    const isActive = currentPath === path;

    return (
      <button
        key={path}
        onClick={() => !disabled && onNavigate(path)}
        disabled={disabled}
        className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
          isActive
            ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30 shadow-sm'
            : disabled
            ? 'text-zinc-500 opacity-60 cursor-not-allowed'
            : 'text-zinc-300 hover:text-white hover:bg-zinc-800/60'
        }`}
      >
        <div className="flex items-center gap-3">
          <span className={isActive ? 'text-blue-400' : 'text-zinc-400'}>{icon}</span>
          <span>{label}</span>
        </div>
        {badge && (
          <span className="text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700/60">
            {badge}
          </span>
        )}
      </button>
    );
  };

  return (
    <aside className="w-64 bg-zinc-900 border-r border-zinc-800/80 flex flex-col h-screen select-none">
      {/* Brand Header */}
      <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white font-bold text-sm shadow-md shadow-blue-500/20">
            <Lock className="w-4 h-4" />
          </div>
          <div>
            <h1 className="font-semibold text-sm text-white tracking-tight">Admin Console</h1>
            <p className="text-[11px] text-zinc-400 font-mono">v8.1 Production</p>
          </div>
        </div>
      </div>

      {/* Navigation Scroll Area */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {/* Core Overview */}
        <div>
          <p className="px-3 text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-2">
            Overview
          </p>
          <div className="space-y-1">
            {navItem('Dashboard', '/admin/dashboard', <LayoutDashboard className="w-4 h-4" />, 'dashboard.read')}
          </div>
        </div>

        {/* Access & User Management */}
        <div>
          <p className="px-3 text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-2">
            Access Management
          </p>
          <div className="space-y-1">
            {navItem('Administrators', '/admin/users', <Users className="w-4 h-4" />, 'admin.users.read')}
            {navItem('Roles & Permissions', '/admin/roles', <Shield className="w-4 h-4" />, 'admin.roles.read')}
          </div>
        </div>

        {/* Security & Audits */}
        <div>
          <p className="px-3 text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-2">
            Security & Audit
          </p>
          <div className="space-y-1">
            {navItem('Audit Logs', '/admin/audit-logs', <FileText className="w-4 h-4" />, 'audit.read')}
          </div>
        </div>

        {/* System Settings & Engine */}
        <div>
          <p className="px-3 text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-2">
            Engine & Settings
          </p>
          <div className="space-y-1">
            {navItem('Settings', '/admin/settings', <Sliders className="w-4 h-4" />, 'settings.read')}
          </div>
        </div>

        {/* Future CMS Modules Foundation */}
        <div>
          <p className="px-3 text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-2">
            CMS & Technical SEO
          </p>
          <div className="space-y-1">
            {navItem('Pages & Landing CMS', '/admin/pages', <Layers className="w-4 h-4" />, 'content.pages.read')}
            {navItem('SEO & Metadata', '/admin/seo', <FileCode className="w-4 h-4" />, 'seo.pages.read')}
            {navItem('Blog Posts', '/admin/blog', <FileText className="w-4 h-4" />, 'blog.posts.read')}
            {navItem('Media Library', '/admin/media', <Image className="w-4 h-4" />, 'media.read')}
            {navItem('Analytics', '/admin/analytics', <BarChart3 className="w-4 h-4" />, undefined, 'Phase 8.5', true)}
          </div>
        </div>
      </div>

      {/* User Footer Profile */}
      <div className="p-3 border-t border-zinc-800 bg-zinc-950/40">
        <div className="flex items-center justify-between mb-3 px-1">
          <div className="flex items-center gap-2 overflow-hidden">
            <div className="w-7 h-7 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-xs font-semibold text-zinc-200">
              {adminUser?.name?.charAt(0) || 'A'}
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-medium text-white truncate">{adminUser?.name}</p>
              <p className="text-[10px] text-zinc-400 truncate">{adminUser?.email}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            title="Log Out"
            className="p-1.5 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-zinc-800/80 transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>

        {/* Exit back to public downloader */}
        <button
          onClick={() => onNavigate('/')}
          className="w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50 border border-zinc-800/80 transition-colors"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          <span>Public Downloader</span>
        </button>
      </div>
    </aside>
  );
};
