import React, { useState, useEffect } from 'react';
import { AdminLayout } from '../components/AdminLayout';
import {
  Globe,
  Plus,
  Search,
  Edit2,
  Trash2,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Eye,
  Sliders,
  ArrowRight,
  Code2,
  FileCode,
  Share2,
  Sparkles,
  HelpCircle,
} from 'lucide-react';
import { useAdminAuth } from '../context/AdminAuthContext';
import {
  SeoPage,
  SeoRedirect,
  SeoPageHealthReport,
  SeoFaqItem,
  SeoBreadcrumbItem,
} from '../types';

export function AdminSeoPage({ currentPath = '/admin/seo', onNavigate }: { currentPath?: string; onNavigate: (path: string) => void }) {
  const { hasPermission } = useAdminAuth();
  const [activeTab, setActiveTab] = useState<'pages' | 'redirects' | 'health' | 'sitemap' | 'settings'>('pages');

  const [pages, setPages] = useState<SeoPage[]>([]);
  const [redirects, setRedirects] = useState<SeoRedirect[]>([]);
  const [healthReports, setHealthReports] = useState<SeoPageHealthReport[]>([]);
  const [healthSummary, setHealthSummary] = useState<any>(null);
  const [settings, setSettings] = useState<Record<string, any>>({});

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Editor Modal State
  const [editingPage, setEditingPage] = useState<SeoPage | null>(null);
  const [isNewPage, setIsNewPage] = useState(false);
  const [editorSubTab, setEditorSubTab] = useState<'basic' | 'indexing' | 'social' | 'schema' | 'sitemap' | 'faqs' | 'preview'>('basic');
  const [savingPage, setSavingPage] = useState(false);
  const [pageSaveError, setPageSaveError] = useState<string | null>(null);

  // Redirect Modal State
  const [editingRedirect, setEditingRedirect] = useState<SeoRedirect | null>(null);
  const [isNewRedirect, setIsNewRedirect] = useState(false);
  const [savingRedirect, setSavingRedirect] = useState(false);
  const [redirectError, setRedirectError] = useState<string | null>(null);

  // Sitemap & Robots live text
  const [sitemapXml, setSitemapXml] = useState<string>('');
  const [robotsTxt, setRobotsTxt] = useState<string>('');

  const canWritePages = hasPermission('seo.pages.write');
  const canWriteRedirects = hasPermission('seo.redirects.write');
  const canWriteSettings = hasPermission('seo.settings.write');

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [pagesRes, redRes, healthRes, setRes] = await Promise.all([
        fetch('/api/admin/seo/pages'),
        fetch('/api/admin/seo/redirects'),
        fetch('/api/admin/seo/health'),
        fetch('/api/admin/seo/settings'),
      ]);

      if (pagesRes.ok) {
        const data = await pagesRes.json();
        setPages(data.pages || []);
      }
      if (redRes.ok) {
        const data = await redRes.json();
        setRedirects(data.redirects || []);
      }
      if (healthRes.ok) {
        const data = await healthRes.json();
        setHealthReports(data.reports || []);
        setHealthSummary(data.summary || null);
      }
      if (setRes.ok) {
        const data = await setRes.json();
        setSettings(data.settings || {});
      }

      // Fetch dynamic sitemap and robots previews
      fetch('/sitemap.xml').then((r) => r.text()).then(setSitemapXml).catch(() => {});
      fetch('/robots.txt').then((r) => r.text()).then(setRobotsTxt).catch(() => {});
    } catch (err: any) {
      setError(err.message || 'Failed to fetch SEO configuration.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Handlers for SEO Page
  const handleOpenEditPage = (page: SeoPage) => {
    setEditingPage({ ...page });
    setIsNewPage(false);
    setPageSaveError(null);
    setEditorSubTab('basic');
  };

  const handleOpenNewPage = () => {
    setEditingPage({
      id: '',
      path: '',
      pageType: 'TOOL_PAGE',
      title: '',
      metaTitle: '',
      metaDescription: '',
      canonicalUrl: '',
      robotsIndex: true,
      robotsFollow: true,
      robotsExtra: 'max-image-preview:large',
      h1: '',
      ogTitle: '',
      ogDescription: '',
      ogImage: '',
      ogType: 'website',
      twitterCard: 'summary_large_image',
      twitterTitle: '',
      twitterDescription: '',
      twitterImage: '',
      schemaType: 'WebApplication',
      schemaJson: '',
      sitemapIncluded: true,
      sitemapPriority: 0.8,
      sitemapChangeFrequency: 'weekly',
      breadcrumbsJson: '',
      faqJson: '',
      createdAt: '',
      updatedAt: '',
    });
    setIsNewPage(true);
    setPageSaveError(null);
    setEditorSubTab('basic');
  };

  const handleSavePage = async () => {
    if (!editingPage) return;
    if (!editingPage.path || !editingPage.title) {
      setPageSaveError('Path and Title are required fields.');
      return;
    }

    setSavingPage(true);
    setPageSaveError(null);

    try {
      const url = isNewPage ? '/api/admin/seo/pages' : `/api/admin/seo/pages/${editingPage.id}`;
      const method = isNewPage ? 'POST' : 'PATCH';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingPage),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to save SEO page.');
      }

      setEditingPage(null);
      await fetchData();
    } catch (err: any) {
      setPageSaveError(err.message);
    } finally {
      setSavingPage(false);
    }
  };

  const handleDeletePage = async (id: string, path: string) => {
    if (!confirm(`Are you sure you want to delete the SEO configuration for "${path}"?`)) return;

    try {
      const res = await fetch(`/api/admin/seo/pages/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      await fetchData();
    } catch (err: any) {
      alert(`Delete error: ${err.message}`);
    }
  };

  // Handlers for Redirects
  const handleOpenEditRedirect = (red: SeoRedirect) => {
    setEditingRedirect({ ...red });
    setIsNewRedirect(false);
    setRedirectError(null);
  };

  const handleOpenNewRedirect = () => {
    setEditingRedirect({
      id: '',
      sourcePath: '',
      destinationPath: '',
      statusCode: 301,
      enabled: true,
      createdAt: '',
      updatedAt: '',
    });
    setIsNewRedirect(true);
    setRedirectError(null);
  };

  const handleSaveRedirect = async () => {
    if (!editingRedirect) return;
    if (!editingRedirect.sourcePath || !editingRedirect.destinationPath) {
      setRedirectError('Source and destination paths are required.');
      return;
    }

    setSavingRedirect(true);
    setRedirectError(null);

    try {
      const url = isNewRedirect ? '/api/admin/seo/redirects' : `/api/admin/seo/redirects/${editingRedirect.id}`;
      const method = isNewRedirect ? 'POST' : 'PATCH';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingRedirect),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to save redirect.');

      setEditingRedirect(null);
      await fetchData();
    } catch (err: any) {
      setRedirectError(err.message);
    } finally {
      setSavingRedirect(false);
    }
  };

  const handleDeleteRedirect = async (id: string, sourcePath: string) => {
    if (!confirm(`Delete redirect for "${sourcePath}"?`)) return;
    try {
      const res = await fetch(`/api/admin/seo/redirects/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      await fetchData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Settings Save
  const handleSaveSettings = async (newSettings: Record<string, string>) => {
    try {
      const res = await fetch('/api/admin/seo/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: newSettings }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setSettings(data.settings);
      alert('SEO settings saved successfully.');
      await fetchData();
    } catch (err: any) {
      alert(`Settings save error: ${err.message}`);
    }
  };

  const filteredPages = pages.filter(
    (p) =>
      p.path.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <AdminLayout
      currentPath={currentPath}
      onNavigate={onNavigate}
      title="SEO & Technical CMS"
      subtitle="Manage search engine indexing, metadata, canonical URLs, redirects, and automated sitemaps"
    >
      <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Globe className="w-6 h-6 text-blue-400" />
            SEO CMS & Technical SEO Control
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Real server-rendered meta tags, canonical rules, Open Graph cards, dynamic sitemap.xml, and crawler controls.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchData}
            className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm border border-slate-700 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          {canWritePages && (
            <button
              onClick={handleOpenNewPage}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors shadow-lg shadow-blue-500/20"
            >
              <Plus className="w-4 h-4" />
              New SEO Page
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800 gap-2">
        <button
          onClick={() => setActiveTab('pages')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'pages'
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          SEO Pages ({pages.length})
        </button>
        <button
          onClick={() => setActiveTab('redirects')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'redirects'
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Redirects ({redirects.length})
        </button>
        <button
          onClick={() => setActiveTab('health')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
            activeTab === 'health'
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          SEO Health
          {healthSummary?.errors > 0 ? (
            <span className="w-2 h-2 rounded-full bg-rose-500" />
          ) : healthSummary?.warnings > 0 ? (
            <span className="w-2 h-2 rounded-full bg-amber-500" />
          ) : (
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('sitemap')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'sitemap'
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Sitemap & Robots.txt
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'settings'
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Global Settings
        </button>
      </div>

      {error && (
        <div className="p-4 bg-rose-950/40 border border-rose-800 text-rose-300 rounded-lg text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
          {error}
        </div>
      )}

      {/* -------------------------------------------------------------
          TAB 1: SEO PAGES
      -------------------------------------------------------------- */}
      {activeTab === 'pages' && (
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by path or title..."
                className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950/80 border-b border-slate-800 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3">Path</th>
                  <th className="px-4 py-3">Page Title</th>
                  <th className="px-3 py-3">Type</th>
                  <th className="px-3 py-3">Indexing</th>
                  <th className="px-3 py-3">Sitemap</th>
                  <th className="px-3 py-3">Last Modified</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono text-xs">
                {filteredPages.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-8 text-center text-slate-400">
                      No SEO pages found.
                    </td>
                  </tr>
                ) : (
                  filteredPages.map((page) => (
                    <tr key={page.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-5 py-3.5 font-medium text-white flex items-center gap-2">
                        <span>{page.path}</span>
                        {page.path === '/' && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-blue-900/40 text-blue-300 border border-blue-800">
                            Home
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 font-sans text-xs text-slate-300 max-w-xs truncate">
                        {page.title}
                      </td>
                      <td className="px-3 py-3.5 font-sans">
                        <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 border border-slate-700">
                          {page.pageType}
                        </span>
                      </td>
                      <td className="px-3 py-3.5 font-sans">
                        {page.robotsIndex ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400">
                            <CheckCircle2 className="w-3.5 h-3.5" /> index
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] text-rose-400">
                            <XCircle className="w-3.5 h-3.5" /> noindex
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3.5 font-sans">
                        {page.sitemapIncluded ? (
                          <span className="text-[11px] text-blue-400 font-medium">
                            Yes ({page.sitemapPriority.toFixed(1)})
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-500">Excluded</span>
                        )}
                      </td>
                      <td className="px-3 py-3.5 text-slate-400 text-[11px]">
                        {page.updatedAt ? new Date(page.updatedAt).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-5 py-3.5 font-sans text-right space-x-2">
                        <a
                          href={page.path}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded border border-slate-700 transition-colors"
                          title="Open public page"
                        >
                          <Eye className="w-3 h-3" />
                          View
                        </a>
                        <button
                          onClick={() => handleOpenEditPage(page)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 text-xs rounded border border-blue-500/30 transition-colors"
                        >
                          <Edit2 className="w-3 h-3" />
                          Edit
                        </button>
                        {canWritePages && page.path !== '/' && (
                          <button
                            onClick={() => handleDeletePage(page.id, page.path)}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-rose-600/20 hover:bg-rose-600/30 text-rose-400 text-xs rounded border border-rose-500/30 transition-colors"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------
          TAB 2: REDIRECTS
      -------------------------------------------------------------- */}
      {activeTab === 'redirects' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-400">
              Manage URL aliases and 301/302 redirects. Redirects are executed server-side prior to HTML rendering.
            </p>
            {canWriteRedirects && (
              <button
                onClick={handleOpenNewRedirect}
                className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-medium transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Redirect
              </button>
            )}
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950/80 border-b border-slate-800 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3">Source URL Path</th>
                  <th className="px-4 py-3">Destination Path</th>
                  <th className="px-3 py-3">Status Code</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono text-xs">
                {redirects.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-8 text-center text-slate-400 font-sans">
                      No URL redirects configured.
                    </td>
                  </tr>
                ) : (
                  redirects.map((red) => (
                    <tr key={red.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-5 py-3.5 text-rose-300 font-medium">{red.sourcePath}</td>
                      <td className="px-4 py-3.5 text-emerald-300 flex items-center gap-1.5">
                        <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                        {red.destinationPath}
                      </td>
                      <td className="px-3 py-3.5 font-sans">
                        <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-blue-400 border border-slate-700 font-semibold">
                          HTTP {red.statusCode}
                        </span>
                      </td>
                      <td className="px-3 py-3.5 font-sans">
                        {red.enabled ? (
                          <span className="text-emerald-400 text-xs font-medium">Active</span>
                        ) : (
                          <span className="text-slate-500 text-xs">Disabled</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 font-sans text-right space-x-2">
                        {canWriteRedirects && (
                          <>
                            <button
                              onClick={() => handleOpenEditRedirect(red)}
                              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded border border-slate-700"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteRedirect(red.id, red.sourcePath)}
                              className="px-2 py-1 bg-rose-600/20 hover:bg-rose-600/30 text-rose-400 text-xs rounded border border-rose-500/30"
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------
          TAB 3: SEO HEALTH
      -------------------------------------------------------------- */}
      {activeTab === 'health' && (
        <div className="space-y-6">
          {healthSummary && (
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
                <span className="text-xs text-slate-400 uppercase font-semibold">Monitored Pages</span>
                <p className="text-2xl font-bold text-white mt-1">{healthSummary.total}</p>
              </div>
              <div className="p-4 bg-emerald-950/20 border border-emerald-800/40 rounded-xl">
                <span className="text-xs text-emerald-400 uppercase font-semibold">Optimal (Passed)</span>
                <p className="text-2xl font-bold text-emerald-400 mt-1">{healthSummary.passed}</p>
              </div>
              <div className="p-4 bg-amber-950/20 border border-amber-800/40 rounded-xl">
                <span className="text-xs text-amber-400 uppercase font-semibold">Warnings</span>
                <p className="text-2xl font-bold text-amber-400 mt-1">{healthSummary.warnings}</p>
              </div>
              <div className="p-4 bg-rose-950/20 border border-rose-800/40 rounded-xl">
                <span className="text-xs text-rose-400 uppercase font-semibold">Errors</span>
                <p className="text-2xl font-bold text-rose-400 mt-1">{healthSummary.errors}</p>
              </div>
            </div>
          )}

          <div className="space-y-3">
            {healthReports.map((report) => (
              <div
                key={report.pageId}
                className="p-5 bg-slate-900 border border-slate-800 rounded-xl space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm text-blue-400 font-semibold">{report.path}</span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                          report.status === 'PASS'
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                            : report.status === 'WARNING'
                            ? 'bg-amber-950 text-amber-400 border border-amber-800'
                            : 'bg-rose-950 text-rose-400 border border-rose-800'
                        }`}
                      >
                        {report.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 mt-1">{report.title}</p>
                  </div>

                  <button
                    onClick={() => {
                      const p = pages.find((x) => x.id === report.pageId);
                      if (p) handleOpenEditPage(p);
                    }}
                    className="self-start sm:self-auto px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded border border-slate-700 transition-colors"
                  >
                    Configure Page
                  </button>
                </div>

                {/* Issues breakdown */}
                <div className="space-y-1.5 text-xs">
                  {report.issues.map((issue, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      {issue.severity === 'PASS' ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                      ) : issue.severity === 'WARNING' ? (
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                      )}
                      <span className="text-slate-400 font-mono text-[11px] uppercase w-28 shrink-0">
                        [{issue.field}]
                      </span>
                      <span
                        className={
                          issue.severity === 'ERROR'
                            ? 'text-rose-300'
                            : issue.severity === 'WARNING'
                            ? 'text-amber-300'
                            : 'text-slate-400'
                        }
                      >
                        {issue.message}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------
          TAB 4: SITEMAP & ROBOTS.TXT
      -------------------------------------------------------------- */}
      {activeTab === 'sitemap' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-3 bg-slate-900 border border-slate-800 rounded-xl p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileCode className="w-5 h-5 text-blue-400" />
                <h3 className="text-sm font-semibold text-white">Dynamic sitemap.xml</h3>
              </div>
              <a
                href="/sitemap.xml"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 font-medium"
              >
                Open in tab <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <p className="text-xs text-slate-400">
              Live XML sitemap generated dynamically from indexable SEO pages in the database.
            </p>
            <pre className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-slate-300 text-xs font-mono overflow-x-auto max-h-96">
              {sitemapXml || 'Generating sitemap.xml...'}
            </pre>
          </div>

          <div className="space-y-3 bg-slate-900 border border-slate-800 rounded-xl p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sliders className="w-5 h-5 text-emerald-400" />
                <h3 className="text-sm font-semibold text-white">Dynamic robots.txt</h3>
              </div>
              <a
                href="/robots.txt"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 font-medium"
              >
                Open in tab <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <p className="text-xs text-slate-400">
              Crawler instructions protecting /admin and internal APIs while referencing the canonical sitemap.
            </p>
            <pre className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-slate-300 text-xs font-mono overflow-x-auto max-h-96">
              {robotsTxt || 'Generating robots.txt...'}
            </pre>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------
          TAB 5: GLOBAL SETTINGS
      -------------------------------------------------------------- */}
      {activeTab === 'settings' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-2xl space-y-6">
          <h2 className="text-lg font-bold text-white">Technical SEO Defaults</h2>

          <div className="space-y-4 text-sm">
            <div>
              <label className="block text-slate-300 font-medium mb-1">
                Canonical Public Site Origin
              </label>
              <input
                type="text"
                defaultValue={settings.public_site_url?.value || ''}
                id="setting_public_site_url"
                placeholder="https://media-downloader.app"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white font-mono text-xs focus:outline-none focus:border-blue-500"
              />
              <p className="text-xs text-slate-400 mt-1">
                The authoritative root domain used for canonical links and sitemap.xml URLs.
              </p>
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">
                Default Title Suffix
              </label>
              <input
                type="text"
                defaultValue={settings.default_title_suffix?.value || ' — Media Downloader Engine'}
                id="setting_default_title_suffix"
                placeholder=" — Media Downloader Engine"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-xs focus:outline-none focus:border-blue-500"
              />
              <p className="text-xs text-slate-400 mt-1">
                Appended to page titles when a custom meta title is not defined.
              </p>
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">
                Default Social Share Image (OG Image)
              </label>
              <input
                type="text"
                defaultValue={settings.default_og_image?.value || '/og-preview.png'}
                id="setting_default_og_image"
                placeholder="/og-preview.png"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white font-mono text-xs focus:outline-none focus:border-blue-500"
              />
              <p className="text-xs text-slate-400 mt-1">
                Fallback preview banner for social media links.
              </p>
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">
                Custom Robots.txt Rules
              </label>
              <textarea
                rows={4}
                defaultValue={settings.robots_txt_custom?.value || ''}
                id="setting_robots_txt_custom"
                placeholder="Disallow: /private-folder/"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white font-mono text-xs focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {canWriteSettings && (
            <button
              onClick={() => {
                const siteUrl = (document.getElementById('setting_public_site_url') as HTMLInputElement)?.value;
                const titleSuffix = (document.getElementById('setting_default_title_suffix') as HTMLInputElement)?.value;
                const ogImage = (document.getElementById('setting_default_og_image') as HTMLInputElement)?.value;
                const customRobots = (document.getElementById('setting_robots_txt_custom') as HTMLTextAreaElement)?.value;

                handleSaveSettings({
                  public_site_url: siteUrl,
                  default_title_suffix: titleSuffix,
                  default_og_image: ogImage,
                  robots_txt_custom: customRobots,
                });
              }}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors"
            >
              Save SEO Settings
            </button>
          )}
        </div>
      )}

      {/* -------------------------------------------------------------
          SEO PAGE EDITOR MODAL / DRAWER
      -------------------------------------------------------------- */}
      {editingPage && (
        <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden my-6">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-blue-400" />
                  {isNewPage ? 'Create SEO Page' : `Configure SEO: ${editingPage.path}`}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Full control over HTML title, meta tags, OpenGraph cards, structured JSON-LD, and robots indexing.
                </p>
              </div>
              <button
                onClick={() => setEditingPage(null)}
                className="text-slate-400 hover:text-white text-xl p-1"
              >
                ✕
              </button>
            </div>

            {/* Sub-tabs */}
            <div className="flex border-b border-slate-800 bg-slate-950/40 px-6 gap-2 overflow-x-auto text-xs font-medium">
              <button
                onClick={() => setEditorSubTab('basic')}
                className={`py-3 px-2 border-b-2 transition-colors ${
                  editorSubTab === 'basic' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                1. Basic Meta
              </button>
              <button
                onClick={() => setEditorSubTab('indexing')}
                className={`py-3 px-2 border-b-2 transition-colors ${
                  editorSubTab === 'indexing' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                2. Indexing & Canonical
              </button>
              <button
                onClick={() => setEditorSubTab('social')}
                className={`py-3 px-2 border-b-2 transition-colors ${
                  editorSubTab === 'social' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                3. Social & Cards
              </button>
              <button
                onClick={() => setEditorSubTab('schema')}
                className={`py-3 px-2 border-b-2 transition-colors ${
                  editorSubTab === 'schema' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                4. Schema JSON-LD
              </button>
              <button
                onClick={() => setEditorSubTab('sitemap')}
                className={`py-3 px-2 border-b-2 transition-colors ${
                  editorSubTab === 'sitemap' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                5. Sitemap
              </button>
              <button
                onClick={() => setEditorSubTab('preview')}
                className={`py-3 px-2 border-b-2 transition-colors flex items-center gap-1.5 ${
                  editorSubTab === 'preview' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                Live Previews
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-4 flex-1 text-sm">
              {pageSaveError && (
                <div className="p-3 bg-rose-950/40 border border-rose-800 text-rose-300 rounded-lg text-xs">
                  {pageSaveError}
                </div>
              )}

              {/* Subtab 1: Basic */}
              {editorSubTab === 'basic' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-slate-300 font-medium text-xs mb-1">
                        URL Path <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="text"
                        value={editingPage.path}
                        disabled={!isNewPage}
                        onChange={(e) => setEditingPage({ ...editingPage, path: e.target.value })}
                        placeholder="/tiktok-video-downloader"
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white font-mono text-xs focus:outline-none focus:border-blue-500 disabled:opacity-60"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-300 font-medium text-xs mb-1">Page Type</label>
                      <select
                        value={editingPage.pageType}
                        onChange={(e) => setEditingPage({ ...editingPage, pageType: e.target.value as any })}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-xs focus:outline-none focus:border-blue-500"
                      >
                        <option value="TOOL_PAGE">Tool Page (Downloader)</option>
                        <option value="STATIC_PAGE">Static Page</option>
                        <option value="BLOG_POST">Blog Post (Phase 8.4)</option>
                        <option value="BLOG_CATEGORY">Blog Category (Phase 8.4)</option>
                        <option value="BLOG_TAG">Blog Tag (Phase 8.4)</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-slate-300 font-medium text-xs">
                        Page Title (SERP Title) <span className="text-rose-400">*</span>
                      </label>
                      <span className={`text-[11px] ${editingPage.title.length > 65 ? 'text-amber-400' : 'text-slate-400'}`}>
                        {editingPage.title.length} / 60 chars
                      </span>
                    </div>
                    <input
                      type="text"
                      value={editingPage.title}
                      onChange={(e) => setEditingPage({ ...editingPage, title: e.target.value })}
                      placeholder="TikTok Video Downloader - No Watermark MP4 HD"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-xs focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-slate-300 font-medium text-xs">Meta Description</label>
                      <span className={`text-[11px] ${editingPage.metaDescription && editingPage.metaDescription.length > 160 ? 'text-amber-400' : 'text-slate-400'}`}>
                        {editingPage.metaDescription?.length || 0} / 160 chars
                      </span>
                    </div>
                    <textarea
                      rows={3}
                      value={editingPage.metaDescription || ''}
                      onChange={(e) => setEditingPage({ ...editingPage, metaDescription: e.target.value })}
                      placeholder="Download TikTok videos without watermark in HD MP4 quality..."
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-xs focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-medium text-xs mb-1">H1 Heading</label>
                    <input
                      type="text"
                      value={editingPage.h1 || ''}
                      onChange={(e) => setEditingPage({ ...editingPage, h1: e.target.value })}
                      placeholder="TikTok Video Downloader"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-xs focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              )}

              {/* Subtab 2: Indexing & Canonical */}
              {editorSubTab === 'indexing' && (
                <div className="space-y-4">
                  <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-4">
                    <h4 className="text-xs font-semibold uppercase text-slate-400">Robots Directives</h4>
                    <div className="flex items-center gap-6">
                      <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                        <input
                          type="checkbox"
                          checked={editingPage.robotsIndex}
                          onChange={(e) => setEditingPage({ ...editingPage, robotsIndex: e.target.checked })}
                          className="rounded border-slate-700 bg-slate-900 text-blue-600"
                        />
                        <span>Allow Search Engines to Index (index)</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                        <input
                          type="checkbox"
                          checked={editingPage.robotsFollow}
                          onChange={(e) => setEditingPage({ ...editingPage, robotsFollow: e.target.checked })}
                          className="rounded border-slate-700 bg-slate-900 text-blue-600"
                        />
                        <span>Follow Links on Page (follow)</span>
                      </label>
                    </div>

                    <div>
                      <label className="block text-slate-300 font-medium text-xs mb-1">
                        Extra Robots Directives
                      </label>
                      <input
                        type="text"
                        value={editingPage.robotsExtra || ''}
                        onChange={(e) => setEditingPage({ ...editingPage, robotsExtra: e.target.value })}
                        placeholder="max-image-preview:large, max-snippet:-1"
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-white text-xs font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-300 font-medium text-xs mb-1">
                      Canonical URL Override
                    </label>
                    <input
                      type="text"
                      value={editingPage.canonicalUrl || ''}
                      onChange={(e) => setEditingPage({ ...editingPage, canonicalUrl: e.target.value })}
                      placeholder="Leave empty to use automatic canonical: https://origin/path"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-xs font-mono"
                    />
                    <p className="text-[11px] text-slate-400 mt-1">
                      By default, canonical URLs are generated deterministically using the public site origin and this page's path.
                    </p>
                  </div>
                </div>
              )}

              {/* Subtab 3: Social & Cards */}
              {editorSubTab === 'social' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-slate-300 font-medium text-xs mb-1">
                        Open Graph Title (og:title)
                      </label>
                      <input
                        type="text"
                        value={editingPage.ogTitle || ''}
                        onChange={(e) => setEditingPage({ ...editingPage, ogTitle: e.target.value })}
                        placeholder="Defaults to Page Title"
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-300 font-medium text-xs mb-1">
                        Twitter Title (twitter:title)
                      </label>
                      <input
                        type="text"
                        value={editingPage.twitterTitle || ''}
                        onChange={(e) => setEditingPage({ ...editingPage, twitterTitle: e.target.value })}
                        placeholder="Defaults to OG Title"
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-xs"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-300 font-medium text-xs mb-1">
                      Open Graph Description (og:description)
                    </label>
                    <textarea
                      rows={2}
                      value={editingPage.ogDescription || ''}
                      onChange={(e) => setEditingPage({ ...editingPage, ogDescription: e.target.value })}
                      placeholder="Defaults to Meta Description"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-xs"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-slate-300 font-medium text-xs mb-1">
                        Social Card Image URL (og:image)
                      </label>
                      <input
                        type="text"
                        value={editingPage.ogImage || ''}
                        onChange={(e) => setEditingPage({ ...editingPage, ogImage: e.target.value })}
                        placeholder="https://... or /og-preview.png"
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-xs font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-300 font-medium text-xs mb-1">
                        Twitter Card Type
                      </label>
                      <select
                        value={editingPage.twitterCard}
                        onChange={(e) => setEditingPage({ ...editingPage, twitterCard: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-xs"
                      >
                        <option value="summary_large_image">summary_large_image</option>
                        <option value="summary">summary</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Subtab 4: Schema */}
              {editorSubTab === 'schema' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-slate-300 font-medium text-xs mb-1">
                      Schema.org Entity Type
                    </label>
                    <select
                      value={editingPage.schemaType}
                      onChange={(e) => setEditingPage({ ...editingPage, schemaType: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-xs"
                    >
                      <option value="WebApplication">WebApplication</option>
                      <option value="SoftwareApplication">SoftwareApplication</option>
                      <option value="WebPage">WebPage</option>
                      <option value="FAQPage">FAQPage</option>
                      <option value="BreadcrumbList">BreadcrumbList</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-300 font-medium text-xs mb-1">
                      Custom Schema JSON-LD Override (Optional)
                    </label>
                    <textarea
                      rows={8}
                      value={editingPage.schemaJson || ''}
                      onChange={(e) => setEditingPage({ ...editingPage, schemaJson: e.target.value })}
                      placeholder="Leave empty to use automatic Schema.org generation matching the selected entity type."
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-emerald-400 font-mono text-xs focus:outline-none"
                    />
                    <p className="text-[11px] text-slate-400 mt-1">
                      If provided, this must be valid JSON syntax without &lt;script&gt; tags.
                    </p>
                  </div>
                </div>
              )}

              {/* Subtab 5: Sitemap */}
              {editorSubTab === 'sitemap' && (
                <div className="space-y-4">
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                    <input
                      type="checkbox"
                      checked={editingPage.sitemapIncluded}
                      onChange={(e) => setEditingPage({ ...editingPage, sitemapIncluded: e.target.checked })}
                      className="rounded border-slate-700 bg-slate-900 text-blue-600"
                    />
                    <span>Include in sitemap.xml</span>
                  </label>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-slate-300 font-medium text-xs mb-1">
                        Sitemap Priority ({editingPage.sitemapPriority.toFixed(1)})
                      </label>
                      <input
                        type="range"
                        min="0.1"
                        max="1.0"
                        step="0.1"
                        value={editingPage.sitemapPriority}
                        onChange={(e) => setEditingPage({ ...editingPage, sitemapPriority: parseFloat(e.target.value) })}
                        className="w-full"
                      />
                      <div className="flex justify-between text-[10px] text-slate-500">
                        <span>0.1 (Low)</span>
                        <span>0.5 (Normal)</span>
                        <span>1.0 (Top)</span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-slate-300 font-medium text-xs mb-1">
                        Change Frequency
                      </label>
                      <select
                        value={editingPage.sitemapChangeFrequency}
                        onChange={(e) => setEditingPage({ ...editingPage, sitemapChangeFrequency: e.target.value as any })}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-xs"
                      >
                        <option value="always">always</option>
                        <option value="hourly">hourly</option>
                        <option value="daily">daily</option>
                        <option value="weekly">weekly</option>
                        <option value="monthly">monthly</option>
                        <option value="yearly">yearly</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Subtab 6: Live Previews */}
              {editorSubTab === 'preview' && (
                <div className="space-y-6">
                  {/* Google Preview */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold uppercase text-slate-400">
                      Google Search SERP Preview
                    </h4>
                    <div className="p-4 bg-white rounded-lg max-w-xl text-left font-sans shadow-sm border border-slate-200">
                      <div className="text-[11px] text-slate-600 truncate mb-1">
                        https://media-downloader.app{editingPage.path}
                      </div>
                      <div className="text-[#1a0dab] hover:underline text-lg font-medium cursor-pointer truncate">
                        {editingPage.title || 'Page Title Placeholder'}
                      </div>
                      <div className="text-xs text-[#4d5156] line-clamp-2 mt-1">
                        {editingPage.metaDescription || 'No meta description configured for this page snippet.'}
                      </div>
                    </div>
                  </div>

                  {/* Social Card Preview */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold uppercase text-slate-400">
                      Social Share Card Preview (OpenGraph / Twitter)
                    </h4>
                    <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden max-w-md">
                      <div className="h-44 bg-slate-800 flex items-center justify-center text-slate-500 text-xs">
                        {editingPage.ogImage ? (
                          <img
                            src={editingPage.ogImage}
                            alt="Preview"
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as any).style.display = 'none';
                            }}
                          />
                        ) : (
                          <div className="flex flex-col items-center gap-1">
                            <Share2 className="w-6 h-6 text-slate-600" />
                            <span>1200 x 630 Social Preview</span>
                          </div>
                        )}
                      </div>
                      <div className="p-3">
                        <span className="text-[10px] text-slate-500 uppercase tracking-wider">
                          MEDIA-DOWNLOADER.APP
                        </span>
                        <h5 className="text-sm font-semibold text-white truncate mt-0.5">
                          {editingPage.ogTitle || editingPage.title || 'Social Card Title'}
                        </h5>
                        <p className="text-xs text-slate-400 line-clamp-2 mt-1">
                          {editingPage.ogDescription || editingPage.metaDescription || 'Card description summary.'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-end gap-3">
              <button
                onClick={() => setEditingPage(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg transition-colors"
              >
                Cancel
              </button>
              {canWritePages && (
                <button
                  onClick={handleSavePage}
                  disabled={savingPage}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors shadow-lg shadow-blue-500/20"
                >
                  {savingPage ? 'Saving...' : 'Save SEO Configuration'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------
          REDIRECT MODAL
      -------------------------------------------------------------- */}
      {editingRedirect && (
        <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 space-y-4">
            <h3 className="text-lg font-bold text-white">
              {isNewRedirect ? 'Create URL Redirect' : 'Edit URL Redirect'}
            </h3>

            {redirectError && (
              <div className="p-3 bg-rose-950/40 border border-rose-800 text-rose-300 rounded text-xs">
                {redirectError}
              </div>
            )}

            <div className="space-y-3 text-sm">
              <div>
                <label className="block text-slate-300 font-medium text-xs mb-1">
                  Source Path (From)
                </label>
                <input
                  type="text"
                  value={editingRedirect.sourcePath}
                  disabled={!isNewRedirect}
                  onChange={(e) => setEditingRedirect({ ...editingRedirect, sourcePath: e.target.value })}
                  placeholder="/old-path"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded text-white font-mono text-xs disabled:opacity-60"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium text-xs mb-1">
                  Destination Path (To)
                </label>
                <input
                  type="text"
                  value={editingRedirect.destinationPath}
                  onChange={(e) => setEditingRedirect({ ...editingRedirect, destinationPath: e.target.value })}
                  placeholder="/new-path"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded text-white font-mono text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-300 font-medium text-xs mb-1">
                    HTTP Status Code
                  </label>
                  <select
                    value={editingRedirect.statusCode}
                    onChange={(e) => setEditingRedirect({ ...editingRedirect, statusCode: parseInt(e.target.value) as any })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded text-white text-xs"
                  >
                    <option value={301}>301 Permanent</option>
                    <option value={302}>302 Temporary</option>
                    <option value={307}>307 Temporary</option>
                    <option value={308}>308 Permanent</option>
                  </select>
                </div>

                <div className="flex items-end pb-2">
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                    <input
                      type="checkbox"
                      checked={editingRedirect.enabled}
                      onChange={(e) => setEditingRedirect({ ...editingRedirect, enabled: e.target.checked })}
                      className="rounded border-slate-700 bg-slate-900 text-blue-600"
                    />
                    <span>Redirect Enabled</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                onClick={() => setEditingRedirect(null)}
                className="px-4 py-2 bg-slate-800 text-slate-300 text-xs rounded hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveRedirect}
                disabled={savingRedirect}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded shadow-lg shadow-blue-500/20"
              >
                {savingRedirect ? 'Saving...' : 'Save Redirect'}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </AdminLayout>
  );
}
