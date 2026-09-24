import React, { useState, useEffect } from 'react';
import { AdminLayout } from '../components/AdminLayout';
import { useAdminAuth } from '../context/AdminAuthContext';
import { RichTextEditor, StructuredDocument } from '../components/RichTextEditor';
import { MediaLibraryModal } from '../components/MediaLibraryModal';
import {
  Save,
  ArrowLeft,
  Eye,
  CheckCircle,
  Clock,
  Archive,
  RotateCcw,
  History,
  Image as ImageIcon,
  Tag,
  FolderTree,
  Globe,
  Loader2,
  AlertCircle,
  X,
  Calendar,
  Layers,
} from 'lucide-react';

interface BlogCategory {
  id: string;
  name: string;
  slug: string;
}

interface BlogTag {
  id: string;
  name: string;
  slug: string;
}

interface BlogRevision {
  id: string;
  revisionNumber: number;
  authorName?: string;
  title: string;
  changeReason: string | null;
  createdAt: string;
}

interface AdminBlogPostEditorPageProps {
  currentPath: string;
  postId?: string;
  onNavigate: (path: string) => void;
}

export const AdminBlogPostEditorPage: React.FC<AdminBlogPostEditorPageProps> = ({
  currentPath,
  postId,
  onNavigate,
}) => {
  const { hasPermission } = useAdminAuth();
  const isEditing = Boolean(postId);

  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [status, setStatus] = useState<'draft' | 'scheduled' | 'published' | 'archived'>('draft');
  const [publishAt, setPublishAt] = useState('');
  const [contentDoc, setContentDoc] = useState<StructuredDocument>({
    version: 1,
    type: 'doc',
    children: [{ type: 'paragraph', text: '' }],
  });
  const [featuredMedia, setFeaturedMedia] = useState<{ id: string; publicUrl: string; title: string } | null>(null);
  const [primaryCategoryId, setPrimaryCategoryId] = useState<string>('');
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [tagsInput, setTagsInput] = useState<string>('');

  // SEO fields
  const [metaTitle, setMetaTitle] = useState('');
  const [metaDescription, setMetaDescription] = useState('');
  const [canonicalUrl, setCanonicalUrl] = useState('');
  const [robotsIndex, setRobotsIndex] = useState(true);
  const [robotsFollow, setRobotsFollow] = useState(true);

  // Available Taxonomies
  const [categories, setCategories] = useState<BlogCategory[]>([]);
  const [availableTags, setAvailableTags] = useState<BlogTag[]>([]);

  // Revisions & Modals
  const [revisions, setRevisions] = useState<BlogRevision[]>([]);
  const [showRevisionsDrawer, setShowRevisionsDrawer] = useState(false);
  const [showSeoDrawer, setShowSeoDrawer] = useState(false);
  const [showMediaModal, setShowMediaModal] = useState(false);

  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchTaxonomies();
    if (isEditing && postId) {
      fetchPostDetails(postId);
      fetchRevisions(postId);
    }
  }, [postId]);

  const fetchTaxonomies = async () => {
    try {
      const [catRes, tagRes] = await Promise.all([
        fetch('/api/admin/blog/categories'),
        fetch('/api/admin/blog/tags'),
      ]);
      const catData = await catRes.json();
      const tagData = await tagRes.json();
      if (catData.success) setCategories(catData.categories || []);
      if (tagData.success) setAvailableTags(tagData.tags || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchPostDetails = async (id: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/blog/posts/${id}`);
      const data = await res.json();
      if (data.success && data.post) {
        const p = data.post;
        setTitle(p.title || '');
        setSlug(p.slug || '');
        setExcerpt(p.excerpt || '');
        setStatus(p.status || 'draft');
        setPublishAt(p.publishAt ? p.publishAt.substring(0, 16) : '');
        if (p.contentDocument) {
          setContentDoc(p.contentDocument);
        }
        if (p.featuredMedia) {
          setFeaturedMedia({
            id: p.featuredMedia.id,
            publicUrl: p.featuredMedia.publicUrl,
            title: p.featuredMedia.title || p.featuredMedia.originalFilename,
          });
        }
        if (p.primaryCategoryId) setPrimaryCategoryId(p.primaryCategoryId);
        if (Array.isArray(p.categories)) {
          setSelectedCategoryIds(p.categories.map((c: any) => c.id));
        }
        if (Array.isArray(p.tags)) {
          setTagsInput(p.tags.map((t: any) => t.name).join(', '));
        }
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: 'Failed to load article details.' });
    } finally {
      setLoading(false);
    }
  };

  const fetchRevisions = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/blog/posts/${id}/revisions`);
      const data = await res.json();
      if (data.success) {
        setRevisions(data.revisions || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle);
    if (!isEditing && !slug) {
      const autoSlug = newTitle
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');
      setSlug(autoSlug);
    }
  };

  const handleSave = async (overrideStatus?: 'draft' | 'scheduled' | 'published' | 'archived') => {
    if (!title.trim()) {
      setStatusMessage({ type: 'error', text: 'Article title is required.' });
      return;
    }

    setSaving(true);
    setStatusMessage(null);

    const effectiveStatus = overrideStatus || status;

    const payload = {
      title,
      slug: slug || undefined,
      excerpt,
      contentDocument: contentDoc,
      featuredMediaId: featuredMedia?.id || null,
      primaryCategoryId: primaryCategoryId || null,
      categoryIds: selectedCategoryIds,
      tagNames: tagsInput.split(',').map((t) => t.trim()).filter(Boolean),
      status: effectiveStatus,
      publishAt: effectiveStatus === 'scheduled' && publishAt ? new Date(publishAt).toISOString() : null,
      seo: {
        metaTitle: metaTitle || undefined,
        metaDescription: metaDescription || undefined,
        canonicalUrl: canonicalUrl || undefined,
        robotsIndex,
        robotsFollow,
      },
    };

    try {
      const url = isEditing ? `/api/admin/blog/posts/${postId}` : '/api/admin/blog/posts';
      const method = isEditing ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success) {
        setStatusMessage({ type: 'success', text: `Article ${isEditing ? 'updated' : 'created'} successfully.` });
        if (!isEditing && data.post?.id) {
          onNavigate(`/admin/blog/edit/${data.post.id}`);
        } else if (isEditing && postId) {
          fetchPostDetails(postId);
          fetchRevisions(postId);
        }
      } else {
        setStatusMessage({ type: 'error', text: data.error?.message || 'Save failed.' });
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleRestoreRevision = async (revId: string, revNum: number) => {
    if (!postId) return;
    if (!confirm(`Are you sure you want to restore revision #${revNum}? Current unsaved changes will be replaced.`)) return;

    try {
      const res = await fetch(`/api/admin/blog/posts/${postId}/revisions/${revId}/restore`, {
        method: 'POST',
      });
      const data = await res.json();
      if (data.success) {
        setStatusMessage({ type: 'success', text: `Restored to revision #${revNum}.` });
        setShowRevisionsDrawer(false);
        fetchPostDetails(postId);
        fetchRevisions(postId);
      } else {
        setStatusMessage({ type: 'error', text: data.error?.message || 'Restore failed.' });
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message });
    }
  };

  const handlePreview = async () => {
    if (!isEditing || !postId) {
      setStatusMessage({ type: 'error', text: 'Please save the article first before generating a preview.' });
      return;
    }

    try {
      const res = await fetch(`/api/admin/blog/posts/${postId}/preview-token`, { method: 'POST' });
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

  return (
    <AdminLayout
      currentPath={currentPath}
      onNavigate={onNavigate}
      title={isEditing ? 'Edit Blog Article' : 'Create New Article'}
      subtitle={isEditing ? `Editing: ${title || slug}` : 'Draft structured content with media and SEO'}
      actions={
        <div className="flex items-center gap-2">
          <button
            onClick={() => onNavigate('/admin/blog')}
            className="px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-medium text-xs border border-zinc-800 flex items-center gap-2 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>All Articles</span>
          </button>

          {isEditing && (
            <button
              onClick={handlePreview}
              className="px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-medium text-xs border border-zinc-800 flex items-center gap-2 transition-colors"
              title="Open Secure Draft Preview"
            >
              <Eye className="w-4 h-4 text-blue-400" />
              <span>Preview</span>
            </button>
          )}

          {isEditing && (
            <button
              onClick={() => setShowRevisionsDrawer(true)}
              className="px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-medium text-xs border border-zinc-800 flex items-center gap-2 transition-colors"
            >
              <History className="w-4 h-4 text-purple-400" />
              <span>Revisions ({revisions.length})</span>
            </button>
          )}

          <button
            onClick={() => handleSave()}
            disabled={saving}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs flex items-center gap-2 transition-colors shadow-lg shadow-blue-500/20 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>{saving ? 'Saving...' : 'Save Changes'}</span>
          </button>
        </div>
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
          {statusMessage.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center h-80 text-zinc-500 gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          <p className="text-xs">Loading article editor...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content & Rich Text Editor */}
          <div className="lg:col-span-2 space-y-5">
            {/* Title & Slug */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2">
                  Article Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  placeholder="e.g., How to Download TikTok Videos Without Watermark in 1080p HD"
                  className="w-full px-4 py-3 bg-zinc-950 border border-zinc-800 rounded-xl text-base font-bold text-white placeholder-zinc-600 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">
                  URL Slug <span className="text-zinc-600">(public path: /blog/{slug || '...'})</span>
                </label>
                <input
                  type="text"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="how-to-download-tiktok-videos"
                  className="w-full px-3.5 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs font-mono text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">
                  Excerpt / Lead Summary <span className="text-zinc-600">(1-2 sentences for listings & search)</span>
                </label>
                <textarea
                  rows={2}
                  value={excerpt}
                  onChange={(e) => setExcerpt(e.target.value)}
                  placeholder="A concise summary of what creators and readers will learn from this article..."
                  className="w-full px-3.5 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-blue-500 resize-y"
                />
              </div>
            </div>

            {/* Structured Rich Text WYSIWYG Editor */}
            <RichTextEditor value={contentDoc} onChange={setContentDoc} />
          </div>

          {/* Sidebar Publishing & Metadata Controls */}
          <div className="space-y-5">
            {/* Publish Status Box */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4 shadow-lg">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 border-b border-zinc-800 pb-3">
                Publishing Status
              </h3>

              <div className="space-y-2">
                <label className="block text-xs text-zinc-400">Current Status:</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                  className="w-full bg-zinc-950 border border-zinc-800 text-xs text-white rounded-xl px-3 py-2.5 focus:outline-none focus:border-blue-500"
                >
                  <option value="draft">Draft (Unpublished)</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="published">Published (Live to Public)</option>
                  <option value="archived">Archived</option>
                </select>
              </div>

              {status === 'scheduled' && (
                <div className="space-y-2 pt-2 border-t border-zinc-800/80">
                  <label className="block text-xs text-zinc-400 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-purple-400" />
                    <span>Schedule Date & Time (UTC):</span>
                  </label>
                  <input
                    type="datetime-local"
                    value={publishAt}
                    onChange={(e) => setPublishAt(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 rounded-xl px-3 py-2 focus:outline-none focus:border-blue-500"
                  />
                </div>
              )}

              <div className="pt-3 border-t border-zinc-800 flex flex-col gap-2">
                {status !== 'published' && hasPermission('blog.posts.publish') && (
                  <button
                    type="button"
                    onClick={() => handleSave('published')}
                    disabled={saving}
                    className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-medium transition-colors flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>Publish Immediately</span>
                  </button>
                )}

                {status === 'published' && hasPermission('blog.posts.publish') && (
                  <button
                    type="button"
                    onClick={() => handleSave('draft')}
                    disabled={saving}
                    className="w-full py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-medium transition-colors flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Revert to Draft</span>
                  </button>
                )}
              </div>
            </div>

            {/* Featured Image Box */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 border-b border-zinc-800 pb-3">
                Featured Cover Image
              </h3>

              {featuredMedia ? (
                <div className="space-y-3">
                  <div className="relative rounded-xl overflow-hidden border border-zinc-800 bg-zinc-950 p-2">
                    <img src={featuredMedia.publicUrl} alt="" className="max-h-40 mx-auto rounded object-cover" />
                    <button
                      type="button"
                      onClick={() => setFeaturedMedia(null)}
                      className="absolute top-3 right-3 p-1 bg-black/80 hover:bg-red-600 text-white rounded-lg transition-colors"
                      title="Remove Featured Image"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <p className="text-[11px] text-zinc-500 truncate font-mono">{featuredMedia.title}</p>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowMediaModal(true)}
                  className="w-full py-8 border-2 border-dashed border-zinc-800 rounded-xl flex flex-col items-center justify-center text-zinc-400 hover:text-white hover:border-zinc-700 transition-colors"
                >
                  <ImageIcon className="w-6 h-6 mb-2 text-zinc-500" />
                  <span className="text-xs font-medium">Set Featured Image</span>
                </button>
              )}
            </div>

            {/* Categories & Tags Box */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 border-b border-zinc-800 pb-3 flex items-center justify-between">
                <span>Taxonomy</span>
                <FolderTree className="w-3.5 h-3.5 text-zinc-500" />
              </h3>

              <div>
                <label className="block text-xs text-zinc-400 mb-1.5">Primary Category</label>
                <select
                  value={primaryCategoryId}
                  onChange={(e) => {
                    setPrimaryCategoryId(e.target.value);
                    if (e.target.value && !selectedCategoryIds.includes(e.target.value)) {
                      setSelectedCategoryIds([...selectedCategoryIds, e.target.value]);
                    }
                  }}
                  className="w-full bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 rounded-xl px-3 py-2 focus:outline-none focus:border-blue-500"
                >
                  <option value="">None / Uncategorized</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1.5">Tags (Comma-separated)</label>
                <input
                  type="text"
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  placeholder="tiktok, hd, video, mp4, tips"
                  className="w-full bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 rounded-xl px-3 py-2 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {/* SEO & Meta Overrides Drawer Trigger */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Article SEO Overrides</h3>
                  <p className="text-[11px] text-zinc-500">Fine-tune canonical, indexing, and meta tags</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSeoDrawer(!showSeoDrawer)}
                  className="p-1.5 rounded-lg bg-zinc-800 text-zinc-300 hover:text-white"
                >
                  <Globe className="w-4 h-4 text-blue-400" />
                </button>
              </div>

              {showSeoDrawer && (
                <div className="space-y-3 pt-3 border-t border-zinc-800 text-xs">
                  <div>
                    <label className="block text-zinc-400 mb-1">Custom Meta Title</label>
                    <input
                      type="text"
                      value={metaTitle}
                      onChange={(e) => setMetaTitle(e.target.value)}
                      placeholder={title || 'Leave blank for default'}
                      className="w-full bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 rounded-lg px-3 py-1.5 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-zinc-400 mb-1">Custom Meta Description</label>
                    <textarea
                      rows={2}
                      value={metaDescription}
                      onChange={(e) => setMetaDescription(e.target.value)}
                      placeholder={excerpt || 'Leave blank for default'}
                      className="w-full bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 rounded-lg px-3 py-1.5 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-zinc-400 mb-1">Canonical URL Override</label>
                    <input
                      type="text"
                      value={canonicalUrl}
                      onChange={(e) => setCanonicalUrl(e.target.value)}
                      placeholder="https://example.com/blog/..."
                      className="w-full bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 rounded-lg px-3 py-1.5 focus:outline-none font-mono"
                    />
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-zinc-400">Search Engine Indexing:</span>
                    <label className="flex items-center gap-1.5 text-zinc-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={robotsIndex}
                        onChange={(e) => setRobotsIndex(e.target.checked)}
                        className="rounded bg-zinc-950 border-zinc-800 text-blue-600"
                      />
                      <span>index</span>
                    </label>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Featured Media Modal */}
      <MediaLibraryModal
        isOpen={showMediaModal}
        onClose={() => setShowMediaModal(false)}
        onSelect={(asset) => {
          setFeaturedMedia({
            id: asset.id,
            publicUrl: asset.publicUrl,
            title: asset.title || asset.originalFilename,
          });
        }}
        title="Choose Featured Cover Image"
      />

      {/* Revisions History Drawer */}
      {showRevisionsDrawer && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex justify-end">
          <div className="bg-zinc-900 border-l border-zinc-800 w-full max-w-md h-full flex flex-col p-6 shadow-2xl overflow-hidden animate-in slide-in-from-right">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-purple-400" />
                <h3 className="font-semibold text-white text-sm">Revision History</h3>
              </div>
              <button
                onClick={() => setShowRevisionsDrawer(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-3">
              {revisions.length === 0 ? (
                <p className="text-xs text-zinc-500 italic text-center py-8">No prior revisions recorded yet.</p>
              ) : (
                revisions.map((rev) => (
                  <div
                    key={rev.id}
                    className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-white">Revision #{rev.revisionNumber}</span>
                      <span className="text-[10px] text-zinc-500 font-mono">
                        {new Date(rev.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-zinc-400 truncate">{rev.title}</p>
                    {rev.changeReason && (
                      <p className="text-[11px] text-zinc-500 italic bg-zinc-900 p-1.5 rounded">
                        "{rev.changeReason}"
                      </p>
                    )}
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[10px] text-zinc-500">By {rev.authorName || 'Administrator'}</span>
                      {hasPermission('blog.posts.write') && (
                        <button
                          type="button"
                          onClick={() => handleRestoreRevision(rev.id, rev.revisionNumber)}
                          className="px-2.5 py-1 rounded-lg bg-blue-600/20 hover:bg-blue-600 text-blue-300 hover:text-white text-[11px] font-medium transition-colors"
                        >
                          Restore This Version
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
};
