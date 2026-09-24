import React from 'react';
import { AdminAuthProvider, useAdminAuth } from './context/AdminAuthContext';
import { AdminLoginPage } from './pages/AdminLoginPage';
import { AdminDashboardPage } from './pages/AdminDashboardPage';
import { AdminUsersPage } from './pages/AdminUsersPage';
import { AdminRolesPage } from './pages/AdminRolesPage';
import { AdminAuditLogsPage } from './pages/AdminAuditLogsPage';
import { AdminSettingsPage } from './pages/AdminSettingsPage';
import { AdminSeoPage } from './pages/AdminSeoPage';
import { AdminPagesPage } from './pages/AdminPagesPage';
import { AdminPageEditor } from './pages/AdminPageEditor';
import { AdminMediaPage } from './pages/AdminMediaPage';
import { AdminBlogPostsPage } from './pages/AdminBlogPostsPage';
import { AdminBlogPostEditorPage } from './pages/AdminBlogPostEditorPage';
import { AdminBlogTaxonomyPage } from './pages/AdminBlogTaxonomyPage';
import { ShieldAlert, Loader2, ArrowLeft } from 'lucide-react';

interface AdminAppProps {
  currentPath: string;
  onNavigate: (path: string) => void;
}

const AdminRouteContent: React.FC<AdminAppProps> = ({ currentPath, onNavigate }) => {
  const { adminUser, loading, hasPermission } = useAdminAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center text-zinc-400 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        <p className="text-xs font-medium tracking-wider uppercase font-mono">Verifying Administrative Session...</p>
      </div>
    );
  }

  // If user is at /admin/login
  if (currentPath === '/admin/login') {
    if (adminUser) {
      // Already authenticated, redirect to dashboard
      return <AdminDashboardPage currentPath="/admin/dashboard" onNavigate={onNavigate} />;
    }
    return <AdminLoginPage onNavigate={onNavigate} />;
  }

  // Protected Routes - If unauthenticated, redirect to login
  if (!adminUser) {
    return <AdminLoginPage onNavigate={onNavigate} />;
  }

  // 403 Forbidden helper screen
  const forbidden = (permissionNeeded: string) => (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 mb-4 shadow-xl">
        <ShieldAlert className="w-8 h-8" />
      </div>
      <h2 className="text-xl font-bold text-white tracking-tight">403 — Access Forbidden</h2>
      <p className="text-sm text-zinc-400 max-w-md mt-2 mb-6">
        Your administrator account does not possess the <code className="text-blue-400 bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-800 font-mono text-xs">{permissionNeeded}</code> permission required to view this section.
      </p>
      <button
        onClick={() => onNavigate('/admin/dashboard')}
        className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs flex items-center gap-2 transition-colors shadow-lg shadow-blue-500/20"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Return to Dashboard</span>
      </button>
    </div>
  );

  // Route dispatching
  if (currentPath === '/admin' || currentPath === '/admin/dashboard') {
    if (!hasPermission('dashboard.read')) return forbidden('dashboard.read');
    return <AdminDashboardPage currentPath={currentPath} onNavigate={onNavigate} />;
  }

  if (currentPath === '/admin/users') {
    if (!hasPermission('admin.users.read')) return forbidden('admin.users.read');
    return <AdminUsersPage currentPath={currentPath} onNavigate={onNavigate} />;
  }

  if (currentPath === '/admin/roles') {
    if (!hasPermission('admin.roles.read')) return forbidden('admin.roles.read');
    return <AdminRolesPage currentPath={currentPath} onNavigate={onNavigate} />;
  }

  if (currentPath === '/admin/audit-logs') {
    if (!hasPermission('audit.read')) return forbidden('audit.read');
    return <AdminAuditLogsPage currentPath={currentPath} onNavigate={onNavigate} />;
  }

  if (currentPath === '/admin/settings') {
    if (!hasPermission('settings.read')) return forbidden('settings.read');
    return <AdminSettingsPage currentPath={currentPath} onNavigate={onNavigate} />;
  }

  if (currentPath === '/admin/seo') {
    if (!hasPermission('seo.pages.read')) return forbidden('seo.pages.read');
    return <AdminSeoPage currentPath={currentPath} onNavigate={onNavigate} />;
  }

  if (currentPath === '/admin/pages') {
    if (!hasPermission('content.pages.read')) return forbidden('content.pages.read');
    return <AdminPagesPage currentPath={currentPath} onNavigate={onNavigate} />;
  }

  if (currentPath.startsWith('/admin/pages/edit/')) {
    if (!hasPermission('content.pages.read')) return forbidden('content.pages.read');
    return <AdminPageEditor currentPath={currentPath} onNavigate={onNavigate} />;
  }

  // Phase 8.4 Media Library and Blog CMS Routes
  if (currentPath === '/admin/media') {
    if (!hasPermission('media.read')) return forbidden('media.read');
    return <AdminMediaPage currentPath={currentPath} onNavigate={onNavigate} />;
  }

  if (currentPath === '/admin/blog') {
    if (!hasPermission('blog.posts.read')) return forbidden('blog.posts.read');
    return <AdminBlogPostsPage currentPath={currentPath} onNavigate={onNavigate} />;
  }

  if (currentPath === '/admin/blog/new') {
    if (!hasPermission('blog.posts.write')) return forbidden('blog.posts.write');
    return <AdminBlogPostEditorPage currentPath={currentPath} onNavigate={onNavigate} />;
  }

  if (currentPath.startsWith('/admin/blog/edit/')) {
    if (!hasPermission('blog.posts.write')) return forbidden('blog.posts.write');
    const editPostId = currentPath.replace('/admin/blog/edit/', '').trim();
    return <AdminBlogPostEditorPage currentPath={currentPath} postId={editPostId} onNavigate={onNavigate} />;
  }

  if (currentPath === '/admin/blog/taxonomy') {
    if (!hasPermission('blog.taxonomy.manage')) return forbidden('blog.taxonomy.manage');
    return <AdminBlogTaxonomyPage currentPath={currentPath} onNavigate={onNavigate} />;
  }

  // Default fallback to dashboard
  return <AdminDashboardPage currentPath="/admin/dashboard" onNavigate={onNavigate} />;
};

export const AdminApp: React.FC<AdminAppProps> = (props) => {
  return (
    <AdminAuthProvider>
      <AdminRouteContent {...props} />
    </AdminAuthProvider>
  );
};
