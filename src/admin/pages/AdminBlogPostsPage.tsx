import React, { useState, useEffect } from 'react';
import { AdminLayout } from '../components/AdminLayout';
import { useAdminAuth } from '../context/AdminAuthContext';
import {
  FileText,
  Plus,
  Search,
  Filter,
  Edit,
  Trash2,
  Eye,
  CheckCircle,
  Clock,
  Archive,
  RotateCcw,
  Loader2,
  ExternalLink,
  Tag,
  FolderTree,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  status: 'draft' | 'scheduled' | 'published' | 'archived';
  publishAt: string | null;
  publishedAt: string | null;
  createdAt: string;
  authorName?: string;
  primaryCategory?: { name: string; slug: string } | null;
  categories: Array<{ name: string; slug: string }>;
  tags: Array<{ name: string; slug: string }>;
  readTimeMinutes?: number;
}

interface AdminBlogPostsPageProps {
  currentPath: string;
  onNavigate: (path: string) => void;
}

export const AdminBlogPostsPage: React.FC<AdminBlogPostsPageProps> = ({ currentPath, onNavigate }) => {
  const { hasPermission } = useAdminAuth();
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchPosts = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (search) params.set('search', search);

      const res = await fetch(`/api/admin/blog/posts?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setPosts(data.posts || []);
        setTotal(data.total || 0);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPosts();
  }, [statusFilter, search]);

  const handlePublish = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/blog/posts/${id}/publish`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setStatusMessage({ type: 'success', text: 'Article published successfully.' });
        fetchPosts();
      } else {
        setStatusMessage({ type: 'error', text: data.error?.message || 'Publish failed.' });
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message });
    }
  };

  const handleUnpublish = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/blog/posts/${id}/unpublish`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setStatusMessage({ type: 'success', text: 'Article moved back to draft.' });
        fetchPosts();
      } else {
        setStatusMessage({ type: 'error', text: data.error?.message || 'Unpublish failed.' });
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message });
    }
  };

  const handleArchive = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/blog/posts/${id}/archive`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setStatusMessage({ type: 'success', text: 'Article archived.' });
        fetchPosts();
      } else {
        setStatusMessage({ type: 'error', text: data.error?.message || 'Archive failed.' });
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message });
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Are you sure you want to permanently delete "${title}"?`)) return;

    try {
      const res = await fetch(`/api/admin/blog/posts/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setStatusMessage({ type: 'success', text: 'Article deleted successfully.' });
        fetchPosts();
      } else {
        setStatusMessage({ type: 'error', text: data.error?.message || 'Delete failed.' });
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message });
    }
  };

  const handlePreview = async (id: string, slug: string) => {
    try {
      const res = await fetch(`/api/admin/blog/posts/${id}/preview-token`, { method: 'POST' });
      const data = await res.json();
      if (data.success && data.token) {
        window.open(`/blog/${slug}?previewToken=${data.token}`, '_blank');
      } else {
        window.open(`/blog/${slug}`, '_blank');
      }
    } catch {
      window.open(`/blog/${slug}`, '_blank');
    }
  };

  const getStatusBadge = (status: string, publishAt: string | null) => {
    switch (status) {
      case 'published':
        return (
          <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-semibold uppercase tracking-wider flex items-center gap-1">
            <CheckCircle className="w-3 h-3" />
            <span>Published</span>
          </span>
        );
      case 'scheduled':
        return (
          <span className="px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-400 border border-purple-500/20 text-[10px] font-semibold uppercase tracking-wider flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span>Scheduled</span>
          </span>
        );
      case 'archived':
        return (
          <span className="px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-400 border border-zinc-700 text-[10px] font-semibold uppercase tracking-wider flex items-center gap-1">
            <Archive className="w-3 h-3" />
            <span>Archived</span>
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-semibold uppercase tracking-wider flex items-center gap-1">
            <RotateCcw className="w-3 h-3" />
            <span>Draft</span>
          </span>
        );
    }
  };

  return (
    <AdminLayout
      currentPath={currentPath}
      onNavigate={onNavigate}
      title="Blog CMS Articles"
      subtitle="Create, edit, schedule, and publish rich guides and video downloader resources"
      actions={
        <div className="flex items-center gap-2">
          {hasPermission('blog.taxonomy.manage') && (
            <button
              onClick={() => onNavigate('/admin/blog/taxonomy')}
              className="px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-medium text-xs border border-zinc-800 flex items-center gap-2 transition-colors"
            >
              <FolderTree className="w-4 h-4 text-zinc-400" />
              <span>Categories & Tags</span>
            </button>
          )}

          {hasPermission('blog.posts.write') && (
            <button
              onClick={() => onNavigate('/admin/blog/new')}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs flex items-center gap-2 transition-colors shadow-lg shadow-blue-500/20"
            >
              <Plus className="w-4 h-4" />
              <span>New Article</span>
            </button>
          )}
        </div>
      }
    >
      {/* Status Notification */}
      {statusMessage && (
        <div
          className={`p-4 rounded-xl flex items-center gap-3 text-xs font-medium border ${
            statusMessage.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-red-500/10 border-red-500/30 text-red-300'
          }`}
        >
          {statusMessage.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            placeholder="Search articles by title, excerpt..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <Filter className="w-3.5 h-3.5" />
            <span>Status:</span>
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 rounded-xl px-3 py-2 focus:outline-none focus:border-blue-500"
          >
            <option value="all">All Statuses ({total})</option>
            <option value="published">Published</option>
            <option value="draft">Drafts</option>
            <option value="scheduled">Scheduled</option>
            <option value="archived">Archived</option>
          </select>

          <button
            onClick={fetchPosts}
            title="Refresh"
            className="p-2 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-400 hover:text-white transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Articles Table */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-zinc-400">
            <thead className="bg-zinc-950/80 text-[11px] uppercase tracking-wider text-zinc-400 border-b border-zinc-800">
              <tr>
                <th className="py-3.5 px-4 font-semibold">Article Title & Slug</th>
                <th className="py-3.5 px-4 font-semibold">Category</th>
                <th className="py-3.5 px-4 font-semibold">Status</th>
                <th className="py-3.5 px-4 font-semibold">Author</th>
                <th className="py-3.5 px-4 font-semibold">Date</th>
                <th className="py-3.5 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-zinc-500">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
                    <span>Loading articles...</span>
                  </td>
                </tr>
              ) : posts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-zinc-500">
                    <FileText className="w-10 h-10 stroke-[1.2] mx-auto mb-2 text-zinc-600" />
                    <p className="text-sm font-medium text-zinc-400">No blog articles found</p>
                    <p className="text-xs text-zinc-600 mt-1">Create your first article or adjust filters.</p>
                  </td>
                </tr>
              ) : (
                posts.map((post) => (
                  <tr key={post.id} className="hover:bg-zinc-800/30 transition-colors">
                    <td className="py-4 px-4">
                      <div className="font-semibold text-zinc-200 hover:text-blue-400 cursor-pointer text-sm" onClick={() => onNavigate(`/admin/blog/edit/${post.id}`)}>
                        {post.title}
                      </div>
                      <div className="text-[11px] text-zinc-500 font-mono mt-0.5 flex items-center gap-2">
                        <span>/blog/{post.slug}</span>
                        {post.readTimeMinutes && <span>• {post.readTimeMinutes} min read</span>}
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      {post.primaryCategory ? (
                        <span className="px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 text-[11px] border border-zinc-700/60 font-medium">
                          {post.primaryCategory.name}
                        </span>
                      ) : (
                        <span className="text-zinc-600 italic">Uncategorized</span>
                      )}
                    </td>
                    <td className="py-4 px-4">
                      {getStatusBadge(post.status, post.publishAt)}
                    </td>
                    <td className="py-4 px-4 text-zinc-300">
                      {post.authorName || 'Editorial Team'}
                    </td>
                    <td className="py-4 px-4 text-zinc-400 text-[11px]">
                      {post.publishedAt
                        ? `Published: ${new Date(post.publishedAt).toLocaleDateString()}`
                        : `Created: ${new Date(post.createdAt).toLocaleDateString()}`}
                    </td>
                    <td className="py-4 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handlePreview(post.id, post.slug)}
                          className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                          title="Preview Article"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>

                        {hasPermission('blog.posts.write') && (
                          <button
                            onClick={() => onNavigate(`/admin/blog/edit/${post.id}`)}
                            className="p-1.5 rounded-lg text-zinc-400 hover:text-blue-400 hover:bg-zinc-800 transition-colors"
                            title="Edit Article"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {hasPermission('blog.posts.publish') && (
                          <>
                            {post.status !== 'published' ? (
                              <button
                                onClick={() => handlePublish(post.id)}
                                className="p-1.5 rounded-lg text-zinc-400 hover:text-emerald-400 hover:bg-zinc-800 transition-colors"
                                title="Publish Now"
                              >
                                <CheckCircle className="w-3.5 h-3.5" />
                              </button>
                            ) : (
                              <button
                                onClick={() => handleUnpublish(post.id)}
                                className="p-1.5 rounded-lg text-zinc-400 hover:text-amber-400 hover:bg-zinc-800 transition-colors"
                                title="Move to Draft"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {post.status !== 'archived' && (
                              <button
                                onClick={() => handleArchive(post.id)}
                                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
                                title="Archive Article"
                              >
                                <Archive className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </>
                        )}

                        {hasPermission('blog.posts.delete') && (
                          <button
                            onClick={() => handleDelete(post.id, post.title)}
                            className="p-1.5 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-zinc-800 transition-colors"
                            title="Delete Article"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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
    </AdminLayout>
  );
};
