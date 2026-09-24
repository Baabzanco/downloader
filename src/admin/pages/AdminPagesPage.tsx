import React, { useState, useEffect } from 'react';
import { AdminLayout } from '../components/AdminLayout';
import { useAdminAuth } from '../context/AdminAuthContext';
import {
  FileText,
  Search,
  Plus,
  Edit,
  Eye,
  CheckCircle,
  Clock,
  Archive,
  Trash2,
  ExternalLink,
  Layers,
  Sparkles,
  AlertCircle,
  RefreshCw,
  Globe,
  Sliders,
  Check,
} from 'lucide-react';

interface ContentPageItem {
  id: string;
  path: string;
  page_type: string;
  title: string;
  slug: string;
  status: 'draft' | 'published' | 'archived';
  published_at?: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
  updated_by?: string;
  section_count: number;
}

interface AdminPagesPageProps {
  currentPath: string;
  onNavigate: (path: string) => void;
}

export const AdminPagesPage: React.FC<AdminPagesPageProps> = ({ currentPath, onNavigate }) => {
  const { hasPermission } = useAdminAuth();
  const [pages, setPages] = useState<ContentPageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'draft' | 'archived'>('all');
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Create page modal state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newPath, setNewPath] = useState('');
  const [newPageType, setNewPageType] = useState('landing');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const canWrite = hasPermission('content.pages.write');
  const canPublish = hasPermission('content.pages.publish');
  const canDelete = hasPermission('content.pages.delete');

  const fetchPages = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/admin/pages', {
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) {
        throw new Error(`Failed to load pages: ${res.statusText}`);
      }
      const data = await res.json();
      setPages(data.pages || []);
    } catch (err: any) {
      setError(err.message || 'Error loading CMS pages');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPages();
  }, []);

  const handleStatusChange = async (page: ContentPageItem, newStatus: 'published' | 'draft' | 'archived') => {
    if (!canPublish) {
      setError('You lack content.pages.publish permission');
      return;
    }

    try {
      const res = await fetch(`/api/admin/pages/${page.id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || 'Failed to update page status');
      }

      setActionSuccess(`Status for "${page.title}" updated to ${newStatus}`);
      setTimeout(() => setActionSuccess(null), 4000);
      fetchPages();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handlePreview = async (page: ContentPageItem) => {
    try {
      const res = await fetch(`/api/admin/pages/${page.id}/preview-token`, {
        method: 'POST',
      });
      if (!res.ok) {
        throw new Error('Failed to generate preview token');
      }
      const data = await res.json();
      const previewUrl = `${page.path}?previewToken=${encodeURIComponent(data.token)}`;
      window.open(previewUrl, '_blank');
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDelete = async (page: ContentPageItem) => {
    if (!canDelete) {
      setError('You lack content.pages.delete permission');
      return;
    }

    if (!confirm(`Are you sure you want to permanently delete "${page.title}" (${page.path})?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/pages/${page.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Failed to delete page');
      }
      setActionSuccess(`Page "${page.title}" successfully deleted.`);
      setTimeout(() => setActionSuccess(null), 4000);
      fetchPages();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleCreatePage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canWrite) return;

    try {
      setCreating(true);
      setCreateError(null);

      const res = await fetch('/api/admin/pages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle,
          path: newPath,
          page_type: newPageType,
          status: 'draft',
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to create page');
      }

      setCreateModalOpen(false);
      setNewTitle('');
      setNewPath('');
      onNavigate(`/admin/pages/edit/${data.page.id}`);
    } catch (err: any) {
      setCreateError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const filteredPages = pages.filter((p) => {
    if (statusFilter !== 'all' && p.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return p.title.toLowerCase().includes(q) || p.path.toLowerCase().includes(q);
    }
    return true;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'published':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle className="w-3 h-3" />
            <span>Published</span>
          </span>
        );
      case 'draft':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Clock className="w-3 h-3" />
            <span>Draft</span>
          </span>
        );
      case 'archived':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-zinc-800 text-zinc-400 border border-zinc-700">
            <Archive className="w-3 h-3" />
            <span>Archived</span>
          </span>
        );
      default:
        return null;
    }
  };

  const isCoreDownloaderRoute = (path: string) => {
    return [
      '/',
      '/tiktok-video-downloader',
      '/instagram-reels-downloader',
      '/facebook-video-downloader',
      '/youtube-shorts-downloader',
      '/twitter-video-downloader',
      '/pinterest-video-downloader',
    ].includes(path);
  };

  return (
    <AdminLayout
      currentPath={currentPath}
      onNavigate={onNavigate}
      title="Pages & Landing CMS"
      subtitle="Manage structured page content, block sections, and publishing workflows"
      actions={
        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchPages}
            disabled={loading}
            className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800 transition-colors"
            title="Refresh Pages"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          {canWrite && (
            <button
              onClick={() => setCreateModalOpen(true)}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs flex items-center gap-2 transition-all shadow-md shadow-blue-500/20"
            >
              <Plus className="w-4 h-4" />
              <span>Create New Page</span>
            </button>
          )}
        </div>
      }
    >
      {/* Notifications */}
      {actionSuccess && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
          <Check className="w-4 h-4 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {error && (
        <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-zinc-400 hover:text-white text-xs">
            Dismiss
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-zinc-900/60 p-4 rounded-2xl border border-zinc-800/80">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search pages by title or path..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {(['all', 'published', 'draft', 'archived'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
                statusFilter === status
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Pages Table */}
      <div className="bg-zinc-900 border border-zinc-800/80 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-zinc-400">
            <thead className="bg-zinc-950/60 text-zinc-400 uppercase tracking-wider font-semibold border-b border-zinc-800">
              <tr>
                <th className="py-3 px-4">Page Title & Path</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-center">Sections</th>
                <th className="py-3 px-4">Last Updated</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60 font-sans">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-zinc-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
                    <span>Loading CMS pages...</span>
                  </td>
                </tr>
              ) : filteredPages.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-zinc-500">
                    No CMS pages found matching query.
                  </td>
                </tr>
              ) : (
                filteredPages.map((page) => (
                  <tr key={page.id} className="hover:bg-zinc-800/30 transition-colors group">
                    <td className="py-3.5 px-4">
                      <div className="flex flex-col">
                        <span className="font-semibold text-zinc-200 group-hover:text-blue-400 transition-colors">
                          {page.title}
                        </span>
                        <span className="text-[11px] font-mono text-zinc-400">{page.path}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded bg-zinc-800/80 text-zinc-300 font-mono text-[11px] uppercase">
                        {page.page_type}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">{getStatusBadge(page.status)}</td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="px-2 py-1 rounded-md bg-zinc-800/60 font-mono font-medium text-zinc-300">
                        {page.section_count || 0}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-zinc-400 font-mono text-[11px]">
                      {new Date(page.updated_at).toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Preview Token */}
                        <button
                          onClick={() => handlePreview(page)}
                          className="p-1.5 rounded-lg text-zinc-400 hover:text-blue-400 hover:bg-zinc-800 transition-colors"
                          title="Generate Preview Link"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        {/* Edit sections */}
                        <button
                          onClick={() => onNavigate(`/admin/pages/edit/${page.id}`)}
                          className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                          title="Edit Page & Sections"
                        >
                          <Edit className="w-4 h-4" />
                        </button>

                        {/* Status Toggle */}
                        {canPublish && (
                          <>
                            {page.status === 'draft' ? (
                              <button
                                onClick={() => handleStatusChange(page, 'published')}
                                className="px-2 py-1 rounded-lg text-[11px] font-medium bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 transition-colors"
                                title="Publish Page"
                              >
                                Publish
                              </button>
                            ) : page.status === 'published' ? (
                              <button
                                onClick={() => handleStatusChange(page, 'draft')}
                                className="px-2 py-1 rounded-lg text-[11px] font-medium bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border border-amber-500/20 transition-colors"
                                title="Unpublish to Draft"
                              >
                                Unpublish
                              </button>
                            ) : (
                              <button
                                onClick={() => handleStatusChange(page, 'draft')}
                                className="px-2 py-1 rounded-lg text-[11px] font-medium bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors"
                                title="Restore to Draft"
                              >
                                Restore
                              </button>
                            )}
                          </>
                        )}

                        {/* Delete (only for custom pages) */}
                        {canDelete && !isCoreDownloaderRoute(page.path) && (
                          <button
                            onClick={() => handleDelete(page)}
                            className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-zinc-800 transition-colors"
                            title="Delete Custom Page"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create New Page Modal */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="font-bold text-sm text-white">Create Content Page</h3>
              <button
                onClick={() => setCreateModalOpen(false)}
                className="text-zinc-500 hover:text-zinc-300 text-xs"
              >
                Cancel
              </button>
            </div>

            {createError && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                {createError}
              </div>
            )}

            <form onSubmit={handleCreatePage} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-300">Page Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Free Vimeo Video Downloader"
                  value={newTitle}
                  onChange={(e) => {
                    setNewTitle(e.target.value);
                    if (!newPath) {
                      const slug = e.target.value
                        .toLowerCase()
                        .replace(/[^a-z0-9]+/g, '-')
                        .replace(/^-|-$/g, '');
                      setNewPath(`/${slug}`);
                    }
                  }}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-300">Normalized Path</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. /vimeo-video-downloader"
                  value={newPath}
                  onChange={(e) => setNewPath(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-blue-500"
                />
                <p className="text-[11px] text-zinc-500">
                  Must start with / and cannot conflict with system routes like /admin or /api.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-300">Page Type</label>
                <select
                  value={newPageType}
                  onChange={(e) => setNewPageType(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="landing">Landing Page</option>
                  <option value="custom">Custom Content</option>
                  <option value="tool">Downloader Tool</option>
                </select>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium flex items-center gap-1.5"
                >
                  {creating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  <span>Create & Configure Sections</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
};
