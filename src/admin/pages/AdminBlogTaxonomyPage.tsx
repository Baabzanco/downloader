import React, { useState, useEffect } from 'react';
import { AdminLayout } from '../components/AdminLayout';
import { useAdminAuth } from '../context/AdminAuthContext';
import {
  FolderTree,
  Tag,
  Plus,
  Trash2,
  Edit2,
  Check,
  AlertCircle,
  Loader2,
  Search,
  ArrowLeft,
} from 'lucide-react';

interface BlogCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  createdAt: string;
}

interface BlogTag {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
}

interface AdminBlogTaxonomyPageProps {
  currentPath: string;
  onNavigate: (path: string) => void;
}

export const AdminBlogTaxonomyPage: React.FC<AdminBlogTaxonomyPageProps> = ({ currentPath, onNavigate }) => {
  const { hasPermission } = useAdminAuth();
  const [activeTab, setActiveTab] = useState<'categories' | 'tags'>('categories');

  // Categories state
  const [categories, setCategories] = useState<BlogCategory[]>([]);
  const [catName, setCatName] = useState('');
  const [catSlug, setCatSlug] = useState('');
  const [catDesc, setCatDesc] = useState('');
  const [editingCatId, setEditingCatId] = useState<string | null>(null);

  // Tags state
  const [tags, setTags] = useState<BlogTag[]>([]);
  const [tagName, setTagName] = useState('');
  const [tagSlug, setTagSlug] = useState('');
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [tagSearch, setTagSearch] = useState('');

  const [loading, setLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchTaxonomies = async () => {
    setLoading(true);
    try {
      const [catRes, tagRes] = await Promise.all([
        fetch('/api/admin/blog/categories'),
        fetch('/api/admin/blog/tags'),
      ]);
      const catData = await catRes.json();
      const tagData = await tagRes.json();
      if (catData.success) setCategories(catData.categories || []);
      if (tagData.success) setTags(tagData.tags || []);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTaxonomies();
  }, []);

  const handleSaveCategory = async () => {
    if (!catName.trim()) {
      setStatusMessage({ type: 'error', text: 'Category name is required.' });
      return;
    }

    try {
      const url = editingCatId ? `/api/admin/blog/categories/${editingCatId}` : '/api/admin/blog/categories';
      const method = editingCatId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: catName, slug: catSlug || undefined, description: catDesc }),
      });

      const data = await res.json();
      if (data.success) {
        setStatusMessage({ type: 'success', text: `Category ${editingCatId ? 'updated' : 'created'}.` });
        setCatName('');
        setCatSlug('');
        setCatDesc('');
        setEditingCatId(null);
        fetchTaxonomies();
      } else {
        setStatusMessage({ type: 'error', text: data.error?.message || 'Failed to save category.' });
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message });
    }
  };

  const handleDeleteCategory = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete category "${name}"?`)) return;

    try {
      const res = await fetch(`/api/admin/blog/categories/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setStatusMessage({ type: 'success', text: 'Category deleted.' });
        fetchTaxonomies();
      } else {
        setStatusMessage({ type: 'error', text: data.error?.message || 'Delete failed.' });
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message });
    }
  };

  const handleSaveTag = async () => {
    if (!tagName.trim()) {
      setStatusMessage({ type: 'error', text: 'Tag name is required.' });
      return;
    }

    try {
      const url = editingTagId ? `/api/admin/blog/tags/${editingTagId}` : '/api/admin/blog/tags';
      const method = editingTagId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: tagName, slug: tagSlug || undefined }),
      });

      const data = await res.json();
      if (data.success) {
        setStatusMessage({ type: 'success', text: `Tag ${editingTagId ? 'updated' : 'created'}.` });
        setTagName('');
        setTagSlug('');
        setEditingTagId(null);
        fetchTaxonomies();
      } else {
        setStatusMessage({ type: 'error', text: data.error?.message || 'Failed to save tag.' });
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message });
    }
  };

  const handleDeleteTag = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete tag "#${name}"?`)) return;

    try {
      const res = await fetch(`/api/admin/blog/tags/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setStatusMessage({ type: 'success', text: 'Tag deleted.' });
        fetchTaxonomies();
      } else {
        setStatusMessage({ type: 'error', text: data.error?.message || 'Delete failed.' });
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message });
    }
  };

  return (
    <AdminLayout
      currentPath={currentPath}
      onNavigate={onNavigate}
      title="Blog Taxonomy"
      subtitle="Manage hierarchical categories and descriptive tags for article discovery"
      actions={
        <button
          onClick={() => onNavigate('/admin/blog')}
          className="px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-medium text-xs border border-zinc-800 flex items-center gap-2 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Articles</span>
        </button>
      }
    >
      {/* Alert Status Banner */}
      {statusMessage && (
        <div
          className={`p-4 rounded-xl flex items-center gap-3 text-xs font-medium border ${
            statusMessage.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-red-500/10 border-red-500/30 text-red-300'
          }`}
        >
          {statusMessage.type === 'success' ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-zinc-800 pb-3">
        <button
          onClick={() => setActiveTab('categories')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors ${
            activeTab === 'categories'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
              : 'bg-zinc-900 text-zinc-400 hover:text-white'
          }`}
        >
          <FolderTree className="w-4 h-4" />
          <span>Categories ({categories.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('tags')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors ${
            activeTab === 'tags'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
              : 'bg-zinc-900 text-zinc-400 hover:text-white'
          }`}
        >
          <Tag className="w-4 h-4" />
          <span>Tags ({tags.length})</span>
        </button>
      </div>

      {/* Content */}
      {activeTab === 'categories' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Add / Edit Category Form */}
          {hasPermission('blog.taxonomy.manage') && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
                {editingCatId ? 'Edit Category' : 'Add New Category'}
              </h3>

              <div>
                <label className="block text-xs text-zinc-400 mb-1">Name</label>
                <input
                  type="text"
                  value={catName}
                  onChange={(e) => {
                    setCatName(e.target.value);
                    if (!editingCatId && !catSlug) {
                      setCatSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
                    }
                  }}
                  placeholder="e.g. Tutorials"
                  className="w-full bg-zinc-950 border border-zinc-800 text-xs text-white rounded-xl px-3 py-2 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1">Slug</label>
                <input
                  type="text"
                  value={catSlug}
                  onChange={(e) => setCatSlug(e.target.value)}
                  placeholder="tutorials"
                  className="w-full bg-zinc-950 border border-zinc-800 text-xs font-mono text-zinc-300 rounded-xl px-3 py-2 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1">Description</label>
                <textarea
                  rows={3}
                  value={catDesc}
                  onChange={(e) => setCatDesc(e.target.value)}
                  placeholder="Description for category page..."
                  className="w-full bg-zinc-950 border border-zinc-800 text-xs text-zinc-300 rounded-xl px-3 py-2 focus:outline-none focus:border-blue-500 resize-y"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                {editingCatId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingCatId(null);
                      setCatName('');
                      setCatSlug('');
                      setCatDesc('');
                    }}
                    className="px-3 py-2 bg-zinc-800 text-zinc-300 rounded-xl text-xs font-medium"
                  >
                    Cancel
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleSaveCategory}
                  className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-medium transition-colors shadow-lg shadow-blue-500/20"
                >
                  {editingCatId ? 'Update Category' : 'Create Category'}
                </button>
              </div>
            </div>
          )}

          {/* Categories List */}
          <div className={`${hasPermission('blog.taxonomy.manage') ? 'lg:col-span-2' : 'lg:col-span-3'} bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden`}>
            <table className="w-full text-left text-xs text-zinc-400">
              <thead className="bg-zinc-950 text-[11px] uppercase tracking-wider text-zinc-400 border-b border-zinc-800">
                <tr>
                  <th className="py-3 px-4 font-semibold">Name & Description</th>
                  <th className="py-3 px-4 font-semibold">Slug</th>
                  <th className="py-3 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {categories.map((cat) => (
                  <tr key={cat.id} className="hover:bg-zinc-800/30">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-white">{cat.name}</div>
                      {cat.description && <div className="text-zinc-500 text-[11px] mt-0.5">{cat.description}</div>}
                    </td>
                    <td className="py-3 px-4 font-mono text-zinc-400">/blog/category/{cat.slug}</td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {hasPermission('blog.taxonomy.manage') && (
                          <>
                            <button
                              onClick={() => {
                                setEditingCatId(cat.id);
                                setCatName(cat.name);
                                setCatSlug(cat.slug);
                                setCatDesc(cat.description || '');
                              }}
                              className="p-1.5 rounded-lg text-zinc-400 hover:text-blue-400 hover:bg-zinc-800"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteCategory(cat.id, cat.name)}
                              className="p-1.5 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-zinc-800"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Tags Tab */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Add / Edit Tag Form */}
          {hasPermission('blog.taxonomy.manage') && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
                {editingTagId ? 'Edit Tag' : 'Add New Tag'}
              </h3>

              <div>
                <label className="block text-xs text-zinc-400 mb-1">Name</label>
                <input
                  type="text"
                  value={tagName}
                  onChange={(e) => {
                    setTagName(e.target.value);
                    if (!editingTagId && !tagSlug) {
                      setTagSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
                    }
                  }}
                  placeholder="e.g. tiktok"
                  className="w-full bg-zinc-950 border border-zinc-800 text-xs text-white rounded-xl px-3 py-2 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1">Slug</label>
                <input
                  type="text"
                  value={tagSlug}
                  onChange={(e) => setTagSlug(e.target.value)}
                  placeholder="tiktok"
                  className="w-full bg-zinc-950 border border-zinc-800 text-xs font-mono text-zinc-300 rounded-xl px-3 py-2 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                {editingTagId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingTagId(null);
                      setTagName('');
                      setTagSlug('');
                    }}
                    className="px-3 py-2 bg-zinc-800 text-zinc-300 rounded-xl text-xs font-medium"
                  >
                    Cancel
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleSaveTag}
                  className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-medium transition-colors shadow-lg shadow-blue-500/20"
                >
                  {editingTagId ? 'Update Tag' : 'Create Tag'}
                </button>
              </div>
            </div>
          )}

          {/* Tags List */}
          <div className={`${hasPermission('blog.taxonomy.manage') ? 'lg:col-span-2' : 'lg:col-span-3'} bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden`}>
            <div className="p-3 bg-zinc-950 border-b border-zinc-800">
              <div className="relative max-w-xs">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input
                  type="text"
                  value={tagSearch}
                  onChange={(e) => setTagSearch(e.target.value)}
                  placeholder="Search tags..."
                  className="w-full pl-9 pr-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <table className="w-full text-left text-xs text-zinc-400">
              <thead className="bg-zinc-950 text-[11px] uppercase tracking-wider text-zinc-400 border-b border-zinc-800">
                <tr>
                  <th className="py-3 px-4 font-semibold">Tag</th>
                  <th className="py-3 px-4 font-semibold">Slug</th>
                  <th className="py-3 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {tags
                  .filter((t) => !tagSearch || t.name.toLowerCase().includes(tagSearch.toLowerCase()))
                  .map((tag) => (
                    <tr key={tag.id} className="hover:bg-zinc-800/30">
                      <td className="py-3 px-4 font-semibold text-white">#{tag.name}</td>
                      <td className="py-3 px-4 font-mono text-zinc-400">/blog/tag/{tag.slug}</td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {hasPermission('blog.taxonomy.manage') && (
                            <>
                              <button
                                onClick={() => {
                                  setEditingTagId(tag.id);
                                  setTagName(tag.name);
                                  setTagSlug(tag.slug);
                                }}
                                className="p-1.5 rounded-lg text-zinc-400 hover:text-blue-400 hover:bg-zinc-800"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteTag(tag.id, tag.name)}
                                className="p-1.5 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-zinc-800"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </AdminLayout>
  );
};
