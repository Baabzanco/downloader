import React, { useState, useEffect } from 'react';
import { AdminLayout } from '../components/AdminLayout';
import { useAdminAuth } from '../context/AdminAuthContext';
import { CmsSectionsRenderer, CmsSectionItem } from '../../components/CmsSectionsRenderer';
import {
  ArrowLeft,
  Save,
  CheckCircle,
  Eye,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Layers,
  Sparkles,
  HelpCircle,
  Zap,
  Globe,
  Sliders,
  AlertCircle,
  RefreshCw,
  Check,
  ExternalLink,
  ChevronRight,
  EyeOff,
} from 'lucide-react';

interface ContentPageDetail {
  id: string;
  path: string;
  page_type: string;
  title: string;
  slug: string;
  status: 'draft' | 'published' | 'archived';
  published_at?: string;
  created_at: string;
  updated_at: string;
  sections: CmsSectionItem[];
}

interface AdminPageEditorProps {
  currentPath: string;
  onNavigate: (path: string) => void;
}

const DEFAULT_ROUTE_OPTIONS = [
  { route: '/tiktok-video-downloader', label: 'TikTok Downloader' },
  { route: '/instagram-reels-downloader', label: 'Instagram Reels' },
  { route: '/facebook-video-downloader', label: 'Facebook Downloader' },
  { route: '/youtube-shorts-downloader', label: 'YouTube Shorts' },
  { route: '/twitter-video-downloader', label: 'X / Twitter Downloader' },
  { route: '/pinterest-video-downloader', label: 'Pinterest Downloader' },
];

export const AdminPageEditor: React.FC<AdminPageEditorProps> = ({ currentPath, onNavigate }) => {
  const { hasPermission } = useAdminAuth();
  const pageId = currentPath.split('/admin/pages/edit/')[1] || '';

  const [page, setPage] = useState<ContentPageDetail | null>(null);
  const [sections, setSections] = useState<CmsSectionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  // Add section modal
  const [addSectionModalOpen, setAddSectionModalOpen] = useState(false);
  const [selectedSectionType, setSelectedSectionType] = useState<CmsSectionItem['sectionType']>('rich_text');

  // Page metadata fields
  const [title, setTitle] = useState('');
  const [path, setPath] = useState('');
  const [pageType, setPageType] = useState('landing');
  const [status, setStatus] = useState<'draft' | 'published' | 'archived'>('draft');

  const canWrite = hasPermission('content.pages.write');
  const canPublish = hasPermission('content.pages.publish');

  const fetchPage = async () => {
    if (!pageId) return;
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/admin/pages/${pageId}`);
      if (!res.ok) {
        throw new Error(`Failed to load page: ${res.statusText}`);
      }
      const data = await res.json();
      const p = data.page;
      setPage(p);
      setTitle(p.title);
      setPath(p.path);
      setPageType(p.page_type);
      setStatus(p.status);

      const sortedSections = (p.sections || []).map((s: any) => ({
        id: s.id,
        sectionType: s.section_type,
        sortOrder: s.sort_order,
        data: typeof s.data_json === 'string' ? JSON.parse(s.data_json) : s.data_json,
        isVisible: Boolean(s.is_visible),
      }));

      setSections(sortedSections);
      if (sortedSections.length > 0 && !activeSectionId) {
        setActiveSectionId(sortedSections[0].id);
      }
    } catch (err: any) {
      setError(err.message || 'Error fetching page details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPage();
  }, [pageId]);

  const handleSave = async (overrideStatus?: 'draft' | 'published') => {
    if (!canWrite) return;
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const targetStatus = overrideStatus || status;

      // 1. Update page metadata
      const metaRes = await fetch(`/api/admin/pages/${pageId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          path,
          page_type: pageType,
          status: targetStatus,
        }),
      });

      if (!metaRes.ok) {
        const errData = await metaRes.json();
        throw new Error(errData.message || 'Failed to update page metadata');
      }

      // 2. Update sections transactionally
      const payloadSections = sections.map((s, idx) => ({
        id: s.id.startsWith('new_') ? undefined : s.id,
        section_type: s.sectionType,
        sort_order: idx + 1,
        data_json: s.data,
        is_visible: s.isVisible !== false,
      }));

      const sectionsRes = await fetch(`/api/admin/pages/${pageId}/sections`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sections: payloadSections }),
      });

      if (!sectionsRes.ok) {
        const errData = await sectionsRes.json();
        throw new Error(errData.message || 'Failed to save sections');
      }

      setStatus(targetStatus);
      setSuccess('Page and sections saved successfully.');
      setTimeout(() => setSuccess(null), 4000);
      fetchPage();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handlePublishToggle = async () => {
    if (!canPublish) {
      setError('You lack content.pages.publish permission');
      return;
    }
    const newStatus = status === 'published' ? 'draft' : 'published';
    await handleSave(newStatus);
  };

  const handleOpenPublicPreview = async () => {
    try {
      const res = await fetch(`/api/admin/pages/${pageId}/preview-token`, {
        method: 'POST',
      });
      if (!res.ok) {
        throw new Error('Failed to generate preview token');
      }
      const data = await res.json();
      const previewUrl = `${path}?previewToken=${encodeURIComponent(data.token)}`;
      window.open(previewUrl, '_blank');
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleMoveSection = (index: number, direction: 'up' | 'down') => {
    const newSections = [...sections];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newSections.length) return;

    const temp = newSections[index];
    newSections[index] = newSections[targetIndex];
    newSections[targetIndex] = temp;

    newSections.forEach((s, idx) => {
      s.sortOrder = idx + 1;
    });

    setSections(newSections);
  };

  const handleToggleVisibility = (id: string) => {
    setSections(
      sections.map((s) => (s.id === id ? { ...s, isVisible: !s.isVisible } : s))
    );
  };

  const handleDeleteSection = (id: string) => {
    if (!confirm('Are you sure you want to delete this section?')) return;
    const remaining = sections.filter((s) => s.id !== id);
    setSections(remaining);
    if (activeSectionId === id) {
      setActiveSectionId(remaining.length > 0 ? remaining[0].id : null);
    }
  };

  const handleAddSection = () => {
    let initialData: any = {};
    switch (selectedSectionType) {
      case 'hero':
        initialData = {
          eyebrow: 'Fast & Secure',
          heading: 'Video Downloader',
          description: 'Download online videos in high quality MP4 format.',
          alignment: 'center',
          primaryCta: { label: 'Get Started', url: '#downloader' },
        };
        break;
      case 'rich_text':
        initialData = {
          heading: 'About This Tool',
          subheading: 'High Speed Media Processing',
          content: 'Easily download media directly to your device with our verified resolution engine.',
        };
        break;
      case 'feature_grid':
        initialData = {
          heading: 'Core Capabilities',
          description: 'Engineered for speed, security, and reliability.',
          features: [
            { title: 'Full HD Quality', description: 'Up to 1080p and 4K stream preservation.' },
            { title: 'No Watermark', description: 'Clean MP4 streams when available upstream.' },
            { title: 'Zero Software Required', description: 'Runs 100% in your browser without installs.' },
          ],
        };
        break;
      case 'how_to':
        initialData = {
          heading: 'How to Download Videos',
          description: 'Three simple steps to save your favorite clips.',
          steps: [
            { stepNumber: 1, title: 'Copy Video URL', description: 'Copy the post link from the platform app or website.' },
            { stepNumber: 2, title: 'Paste & Resolve', description: 'Paste into the downloader engine input box above.' },
            { stepNumber: 3, title: 'Save Media File', description: 'Select your preferred MP4 resolution and stream directly.' },
          ],
        };
        break;
      case 'faq':
        initialData = {
          heading: 'Frequently Asked Questions',
          description: 'Answers to common questions regarding video downloading.',
          items: [
            { question: 'Is this service free to use?', answer: 'Yes, our online downloader is completely free with no registration required.' },
            { question: 'Where are downloads saved?', answer: 'Files are saved to your default system browser downloads folder.' },
          ],
        };
        break;
      case 'cta':
        initialData = {
          heading: 'Ready to Download Media Fast?',
          description: 'Paste any supported social link above and enjoy instant high-resolution downloads.',
          buttonLabel: 'Try Downloader Now',
          buttonUrl: '#downloader',
        };
        break;
      case 'related_tools':
        initialData = {
          heading: 'Related Free Download Tools',
          description: 'Explore our other high-speed platform downloaders.',
          tools: DEFAULT_ROUTE_OPTIONS,
        };
        break;
    }

    const newId = `new_${Date.now()}`;
    const newSection: CmsSectionItem = {
      id: newId,
      sectionType: selectedSectionType,
      sortOrder: sections.length + 1,
      data: initialData,
      isVisible: true,
    };

    setSections([...sections, newSection]);
    setActiveSectionId(newId);
    setAddSectionModalOpen(false);
  };

  const updateActiveSectionData = (updater: (prevData: any) => any) => {
    if (!activeSectionId) return;
    setSections(
      sections.map((s) => {
        if (s.id === activeSectionId) {
          return { ...s, data: updater(s.data || {}) };
        }
        return s;
      })
    );
  };

  const activeSection = sections.find((s) => s.id === activeSectionId);

  return (
    <AdminLayout
      currentPath={currentPath}
      onNavigate={onNavigate}
      title={page ? `Editing: ${page.title}` : 'Page Editor'}
      subtitle={`Path: ${path} • Type: ${pageType}`}
      actions={
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => onNavigate('/admin/pages')}
            className="px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-medium flex items-center gap-1.5 border border-zinc-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Pages List</span>
          </button>

          <button
            onClick={() => setShowPreviewModal(!showPreviewModal)}
            className="px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-medium flex items-center gap-1.5 border border-zinc-800 transition-colors"
          >
            <Eye className="w-4 h-4" />
            <span>{showPreviewModal ? 'Hide In-Editor Preview' : 'In-Editor Preview'}</span>
          </button>

          <button
            onClick={handleOpenPublicPreview}
            className="px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-blue-400 text-xs font-medium flex items-center gap-1.5 border border-zinc-800 transition-colors"
            title="Open Public Preview in New Tab"
          >
            <ExternalLink className="w-4 h-4" />
            <span>Public Preview</span>
          </button>

          {canPublish && (
            <button
              onClick={handlePublishToggle}
              disabled={saving}
              className={`px-3 py-2 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-colors ${
                status === 'published'
                  ? 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border border-amber-500/30'
                  : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/30'
              }`}
            >
              <CheckCircle className="w-4 h-4" />
              <span>{status === 'published' ? 'Unpublish to Draft' : 'Publish Page'}</span>
            </button>
          )}

          {canWrite && (
            <button
              onClick={() => handleSave()}
              disabled={saving}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs flex items-center gap-2 transition-all shadow-md shadow-blue-500/20"
            >
              {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>Save Changes</span>
            </button>
          )}
        </div>
      }
    >
      {/* Notifications */}
      {success && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
          <Check className="w-4 h-4 shrink-0" />
          <span>{success}</span>
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

      {/* Page Metadata Bar */}
      <div className="bg-zinc-900 border border-zinc-800/80 rounded-2xl p-4 sm:p-5 shadow-xl space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
          <Globe className="w-4 h-4 text-blue-400" />
          <span>Page Metadata Configuration</span>
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-300">Page Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-300">Normalized Path</label>
            <input
              type="text"
              value={path}
              onChange={(e) => setPath(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-300">Publishing Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
            >
              <option value="draft">Draft (Private / Isolated)</option>
              <option value="published">Published (Public)</option>
              <option value="archived">Archived</option>
            </select>
          </div>
        </div>
      </div>

      {/* Editor Split Layout: Sections List (Left) + Form Editor (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Sections Sidebar (4 Cols) */}
        <div className="lg:col-span-4 bg-zinc-900 border border-zinc-800/80 rounded-2xl p-4 space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-400" />
              <h3 className="font-bold text-xs uppercase tracking-wider text-zinc-300">
                Page Sections ({sections.length})
              </h3>
            </div>
            {canWrite && (
              <button
                onClick={() => setAddSectionModalOpen(true)}
                className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium flex items-center gap-1 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Section</span>
              </button>
            )}
          </div>

          <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
            {sections.length === 0 ? (
              <div className="py-12 text-center text-zinc-500 text-xs">
                No sections added yet. Click "+ Add Section" to begin.
              </div>
            ) : (
              sections.map((section, idx) => {
                const isActive = section.id === activeSectionId;
                return (
                  <div
                    key={section.id}
                    onClick={() => setActiveSectionId(section.id)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                      isActive
                        ? 'bg-blue-600/15 border-blue-500 text-white shadow-sm'
                        : 'bg-zinc-950/60 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 overflow-hidden">
                      <span className="w-5 h-5 rounded-md bg-zinc-800 text-zinc-300 font-mono text-[10px] flex items-center justify-center font-bold shrink-0">
                        {idx + 1}
                      </span>
                      <div className="overflow-hidden">
                        <p className="text-xs font-semibold uppercase tracking-wider truncate">
                          {section.sectionType.replace('_', ' ')}
                        </p>
                        <p className="text-[11px] text-zinc-500 truncate">
                          {section.data?.heading || section.data?.title || 'No Heading'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => handleToggleVisibility(section.id)}
                        className={`p-1 rounded hover:bg-zinc-800 transition-colors ${
                          section.isVisible !== false ? 'text-zinc-400' : 'text-zinc-600'
                        }`}
                        title={section.isVisible !== false ? 'Visible' : 'Hidden'}
                      >
                        {section.isVisible !== false ? (
                          <Eye className="w-3.5 h-3.5" />
                        ) : (
                          <EyeOff className="w-3.5 h-3.5 text-amber-500" />
                        )}
                      </button>

                      <button
                        onClick={() => handleMoveSection(idx, 'up')}
                        disabled={idx === 0}
                        className="p-1 rounded text-zinc-400 hover:text-white disabled:opacity-30 disabled:hover:text-zinc-400"
                        title="Move Up"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => handleMoveSection(idx, 'down')}
                        disabled={idx === sections.length - 1}
                        className="p-1 rounded text-zinc-400 hover:text-white disabled:opacity-30 disabled:hover:text-zinc-400"
                        title="Move Down"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => handleDeleteSection(section.id)}
                        className="p-1 rounded text-zinc-500 hover:text-red-400"
                        title="Delete Section"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Section Form Editor (8 Cols) */}
        <div className="lg:col-span-8 bg-zinc-900 border border-zinc-800/80 rounded-2xl p-5 shadow-xl space-y-6">
          {!activeSection ? (
            <div className="py-20 text-center text-zinc-500 text-xs">
              Select or add a section from the sidebar to edit its properties.
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-blue-600/20 text-blue-400 border border-blue-500/30 text-[11px] font-mono font-semibold uppercase">
                    {activeSection.sectionType.replace('_', ' ')}
                  </span>
                  <h3 className="font-bold text-sm text-white">Section Content Editor</h3>
                </div>
                <div className="flex items-center gap-2 text-xs text-zinc-400">
                  <span>Order: {activeSection.sortOrder}</span>
                  <span>•</span>
                  <span className={activeSection.isVisible !== false ? 'text-emerald-400' : 'text-amber-400'}>
                    {activeSection.isVisible !== false ? 'Visible on Page' : 'Hidden'}
                  </span>
                </div>
              </div>

              {/* Dynamic Form Editor Per Section Type */}
              {activeSection.sectionType === 'hero' && (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-300">Eyebrow Tag (Optional)</label>
                    <input
                      type="text"
                      value={activeSection.data?.eyebrow || ''}
                      onChange={(e) =>
                        updateActiveSectionData((prev) => ({ ...prev, eyebrow: e.target.value }))
                      }
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-300">Hero Heading (H1)</label>
                    <input
                      type="text"
                      value={activeSection.data?.heading || ''}
                      onChange={(e) =>
                        updateActiveSectionData((prev) => ({ ...prev, heading: e.target.value }))
                      }
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-300">Hero Subtitle / Description</label>
                    <textarea
                      rows={3}
                      value={activeSection.data?.description || ''}
                      onChange={(e) =>
                        updateActiveSectionData((prev) => ({ ...prev, description: e.target.value }))
                      }
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-zinc-800">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-zinc-300">Primary CTA Label</label>
                      <input
                        type="text"
                        value={activeSection.data?.primaryCta?.label || ''}
                        onChange={(e) =>
                          updateActiveSectionData((prev) => ({
                            ...prev,
                            primaryCta: { ...prev.primaryCta, label: e.target.value },
                          }))
                        }
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-zinc-300">Primary CTA Destination URL</label>
                      <input
                        type="text"
                        value={activeSection.data?.primaryCta?.url || ''}
                        onChange={(e) =>
                          updateActiveSectionData((prev) => ({
                            ...prev,
                            primaryCta: { ...prev.primaryCta, url: e.target.value },
                          }))
                        }
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {activeSection.sectionType === 'rich_text' && (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-300">Section Heading</label>
                    <input
                      type="text"
                      value={activeSection.data?.heading || ''}
                      onChange={(e) =>
                        updateActiveSectionData((prev) => ({ ...prev, heading: e.target.value }))
                      }
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-300">Subheading (Optional)</label>
                    <input
                      type="text"
                      value={activeSection.data?.subheading || ''}
                      onChange={(e) =>
                        updateActiveSectionData((prev) => ({ ...prev, subheading: e.target.value }))
                      }
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-300">Content (Markdown / Plain Text)</label>
                    <textarea
                      rows={8}
                      value={activeSection.data?.content || ''}
                      onChange={(e) =>
                        updateActiveSectionData((prev) => ({ ...prev, content: e.target.value }))
                      }
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs font-sans text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              )}

              {activeSection.sectionType === 'feature_grid' && (
                <div className="space-y-5">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-300">Section Heading</label>
                    <input
                      type="text"
                      value={activeSection.data?.heading || ''}
                      onChange={(e) =>
                        updateActiveSectionData((prev) => ({ ...prev, heading: e.target.value }))
                      }
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-300">Section Subtitle / Description</label>
                    <input
                      type="text"
                      value={activeSection.data?.description || ''}
                      onChange={(e) =>
                        updateActiveSectionData((prev) => ({ ...prev, description: e.target.value }))
                      }
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="space-y-3 pt-2 border-t border-zinc-800">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-zinc-300">Feature Items</h4>
                      <button
                        onClick={() =>
                          updateActiveSectionData((prev) => ({
                            ...prev,
                            features: [
                              ...(prev.features || []),
                              { title: 'New Feature', description: 'Feature details here.' },
                            ],
                          }))
                        }
                        className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Add Feature</span>
                      </button>
                    </div>

                    {(activeSection.data?.features || []).map((feat: any, fIdx: number) => (
                      <div
                        key={fIdx}
                        className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 space-y-2.5 relative group"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-blue-400">Feature #{fIdx + 1}</span>
                          <button
                            onClick={() =>
                              updateActiveSectionData((prev) => ({
                                ...prev,
                                features: prev.features.filter((_: any, idx: number) => idx !== fIdx),
                              }))
                            }
                            className="text-zinc-500 hover:text-red-400 text-xs"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <input
                          type="text"
                          placeholder="Feature Title"
                          value={feat.title || ''}
                          onChange={(e) =>
                            updateActiveSectionData((prev) => {
                              const newF = [...prev.features];
                              newF[fIdx] = { ...newF[fIdx], title: e.target.value };
                              return { ...prev, features: newF };
                            })
                          }
                          className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                        />
                        <textarea
                          rows={2}
                          placeholder="Feature Description"
                          value={feat.description || ''}
                          onChange={(e) =>
                            updateActiveSectionData((prev) => {
                              const newF = [...prev.features];
                              newF[fIdx] = { ...newF[fIdx], description: e.target.value };
                              return { ...prev, features: newF };
                            })
                          }
                          className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeSection.sectionType === 'how_to' && (
                <div className="space-y-5">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-300">Section Heading</label>
                    <input
                      type="text"
                      value={activeSection.data?.heading || ''}
                      onChange={(e) =>
                        updateActiveSectionData((prev) => ({ ...prev, heading: e.target.value }))
                      }
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-300">Section Description</label>
                    <input
                      type="text"
                      value={activeSection.data?.description || ''}
                      onChange={(e) =>
                        updateActiveSectionData((prev) => ({ ...prev, description: e.target.value }))
                      }
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="space-y-3 pt-2 border-t border-zinc-800">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-zinc-300">Ordered Steps</h4>
                      <button
                        onClick={() =>
                          updateActiveSectionData((prev) => ({
                            ...prev,
                            steps: [
                              ...(prev.steps || []),
                              {
                                stepNumber: (prev.steps?.length || 0) + 1,
                                title: 'New Step',
                                description: 'Step explanation.',
                              },
                            ],
                          }))
                        }
                        className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Add Step</span>
                      </button>
                    </div>

                    {(activeSection.data?.steps || []).map((step: any, sIdx: number) => (
                      <div
                        key={sIdx}
                        className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 space-y-2.5 relative group"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-blue-400">Step #{sIdx + 1}</span>
                          <button
                            onClick={() =>
                              updateActiveSectionData((prev) => ({
                                ...prev,
                                steps: prev.steps.filter((_: any, idx: number) => idx !== sIdx),
                              }))
                            }
                            className="text-zinc-500 hover:text-red-400 text-xs"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <input
                          type="text"
                          placeholder="Step Title"
                          value={step.title || ''}
                          onChange={(e) =>
                            updateActiveSectionData((prev) => {
                              const newS = [...prev.steps];
                              newS[sIdx] = { ...newS[sIdx], title: e.target.value };
                              return { ...prev, steps: newS };
                            })
                          }
                          className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                        />
                        <textarea
                          rows={2}
                          placeholder="Step Description"
                          value={step.description || ''}
                          onChange={(e) =>
                            updateActiveSectionData((prev) => {
                              const newS = [...prev.steps];
                              newS[sIdx] = { ...newS[sIdx], description: e.target.value };
                              return { ...prev, steps: newS };
                            })
                          }
                          className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeSection.sectionType === 'faq' && (
                <div className="space-y-5">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-300">FAQ Section Heading</label>
                    <input
                      type="text"
                      value={activeSection.data?.heading || ''}
                      onChange={(e) =>
                        updateActiveSectionData((prev) => ({ ...prev, heading: e.target.value }))
                      }
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="space-y-3 pt-2 border-t border-zinc-800">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-zinc-300">Question & Answer Pairs</h4>
                      <button
                        onClick={() =>
                          updateActiveSectionData((prev) => ({
                            ...prev,
                            items: [
                              ...(prev.items || []),
                              { question: 'New Question?', answer: 'Detailed answer here.' },
                            ],
                          }))
                        }
                        className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Add Question</span>
                      </button>
                    </div>

                    {(activeSection.data?.items || []).map((faq: any, qIdx: number) => (
                      <div
                        key={qIdx}
                        className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 space-y-2.5 relative group"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-blue-400">FAQ #{qIdx + 1}</span>
                          <button
                            onClick={() =>
                              updateActiveSectionData((prev) => ({
                                ...prev,
                                items: prev.items.filter((_: any, idx: number) => idx !== qIdx),
                              }))
                            }
                            className="text-zinc-500 hover:text-red-400 text-xs"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <input
                          type="text"
                          placeholder="Question"
                          value={faq.question || ''}
                          onChange={(e) =>
                            updateActiveSectionData((prev) => {
                              const newI = [...prev.items];
                              newI[qIdx] = { ...newI[qIdx], question: e.target.value };
                              return { ...prev, items: newI };
                            })
                          }
                          className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                        />
                        <textarea
                          rows={2}
                          placeholder="Answer"
                          value={faq.answer || ''}
                          onChange={(e) =>
                            updateActiveSectionData((prev) => {
                              const newI = [...prev.items];
                              newI[qIdx] = { ...newI[qIdx], answer: e.target.value };
                              return { ...prev, items: newI };
                            })
                          }
                          className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeSection.sectionType === 'cta' && (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-300">CTA Heading</label>
                    <input
                      type="text"
                      value={activeSection.data?.heading || ''}
                      onChange={(e) =>
                        updateActiveSectionData((prev) => ({ ...prev, heading: e.target.value }))
                      }
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-300">CTA Description</label>
                    <textarea
                      rows={3}
                      value={activeSection.data?.description || ''}
                      onChange={(e) =>
                        updateActiveSectionData((prev) => ({ ...prev, description: e.target.value }))
                      }
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-zinc-800">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-zinc-300">Button Label</label>
                      <input
                        type="text"
                        value={activeSection.data?.buttonLabel || ''}
                        onChange={(e) =>
                          updateActiveSectionData((prev) => ({ ...prev, buttonLabel: e.target.value }))
                        }
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-zinc-300">Button Destination URL</label>
                      <input
                        type="text"
                        value={activeSection.data?.buttonUrl || ''}
                        onChange={(e) =>
                          updateActiveSectionData((prev) => ({ ...prev, buttonUrl: e.target.value }))
                        }
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {activeSection.sectionType === 'related_tools' && (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-300">Section Heading</label>
                    <input
                      type="text"
                      value={activeSection.data?.heading || ''}
                      onChange={(e) =>
                        updateActiveSectionData((prev) => ({ ...prev, heading: e.target.value }))
                      }
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-300">Section Subtitle</label>
                    <input
                      type="text"
                      value={activeSection.data?.description || ''}
                      onChange={(e) =>
                        updateActiveSectionData((prev) => ({ ...prev, description: e.target.value }))
                      }
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="pt-2 border-t border-zinc-800 space-y-2">
                    <label className="text-xs font-semibold text-zinc-300">Included Downloader Routes</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {DEFAULT_ROUTE_OPTIONS.map((opt) => {
                        const currentTools = activeSection.data?.tools || [];
                        const isChecked = currentTools.some((t: any) => t.route === opt.route);
                        return (
                          <label
                            key={opt.route}
                            className={`p-2.5 rounded-xl border flex items-center justify-between text-xs cursor-pointer transition-colors ${
                              isChecked
                                ? 'bg-blue-600/10 border-blue-500/30 text-white'
                                : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                            }`}
                          >
                            <span>{opt.label}</span>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                updateActiveSectionData((prev) => {
                                  const list = prev.tools || [];
                                  if (e.target.checked) {
                                    return { ...prev, tools: [...list, opt] };
                                  } else {
                                    return {
                                      ...prev,
                                      tools: list.filter((t: any) => t.route !== opt.route),
                                    };
                                  }
                                });
                              }}
                              className="rounded border-zinc-700 text-blue-600 focus:ring-blue-500"
                            />
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* In-Editor Live Render Preview */}
      {showPreviewModal && (
        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 shadow-2xl space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-emerald-400" />
              <h3 className="font-bold text-xs uppercase tracking-wider text-white">
                Live Public Renderer Preview
              </h3>
            </div>
            <span className="text-[11px] text-zinc-500 font-mono">Simulated Public Viewport</span>
          </div>

          <div className="p-6 rounded-2xl bg-slate-950 border border-slate-800/80">
            <CmsSectionsRenderer sections={sections} onNavigate={() => {}} />
          </div>
        </div>
      )}

      {/* Add Section Modal */}
      {addSectionModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="font-bold text-sm text-white">Add Page Section</h3>
              <button
                onClick={() => setAddSectionModalOpen(false)}
                className="text-zinc-500 hover:text-zinc-300 text-xs"
              >
                Cancel
              </button>
            </div>

            <div className="space-y-2">
              {[
                { type: 'hero', label: 'Hero Header', desc: 'Title, subtitle, eyebrow tag, and CTA buttons' },
                { type: 'rich_text', label: 'Rich Text', desc: 'Custom content blocks and narrative copy' },
                { type: 'feature_grid', label: 'Feature Grid', desc: '3-column feature cards with icons and descriptions' },
                { type: 'how_to', label: 'How-To Steps', desc: 'Numbered step-by-step instructions' },
                { type: 'faq', label: 'Frequently Asked Questions', desc: 'Interactive accordion FAQ items' },
                { type: 'cta', label: 'Call to Action', desc: 'Prominent banner with button redirect' },
                { type: 'related_tools', label: 'Related Tools', desc: 'Internal links to other downloader tools' },
              ].map((item) => (
                <div
                  key={item.type}
                  onClick={() => setSelectedSectionType(item.type as any)}
                  className={`p-3 rounded-xl border cursor-pointer transition-all ${
                    selectedSectionType === item.type
                      ? 'bg-blue-600/15 border-blue-500 text-white'
                      : 'bg-zinc-950/60 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                  }`}
                >
                  <p className="text-xs font-semibold">{item.label}</p>
                  <p className="text-[11px] text-zinc-500">{item.desc}</p>
                </div>
              ))}
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setAddSectionModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddSection}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Selected Section</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
};
