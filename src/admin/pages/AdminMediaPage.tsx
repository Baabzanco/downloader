import React, { useState, useEffect, useRef } from 'react';
import { AdminLayout } from '../components/AdminLayout';
import { useAdminAuth } from '../context/AdminAuthContext';
import {
  Image as ImageIcon,
  Upload,
  Trash2,
  Edit2,
  Search,
  Filter,
  Loader2,
  Check,
  AlertCircle,
  Link,
  Copy,
  ExternalLink,
  RefreshCw,
  FolderOpen,
  Info,
} from 'lucide-react';

interface MediaAsset {
  id: string;
  filename: string;
  originalFilename: string;
  mimeType: string;
  mediaType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  storageKey: string;
  publicUrl: string;
  altText: string | null;
  caption: string | null;
  title: string | null;
  createdAt: string;
  updatedAt: string;
}

interface MediaUsageReference {
  type: string;
  id: string;
  title: string;
  pathOrSlug: string;
}

interface AdminMediaPageProps {
  currentPath: string;
  onNavigate: (path: string) => void;
}

export const AdminMediaPage: React.FC<AdminMediaPageProps> = ({ currentPath, onNavigate }) => {
  const { hasPermission } = useAdminAuth();
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState('');
  const [mediaTypeFilter, setMediaTypeFilter] = useState<string>('all');
  const [selectedAsset, setSelectedAsset] = useState<MediaAsset | null>(null);
  const [usages, setUsages] = useState<MediaUsageReference[]>([]);
  const [loadingUsages, setLoadingUsages] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editAlt, setEditAlt] = useState('');
  const [editCaption, setEditCaption] = useState('');
  const [savingMetadata, setSavingMetadata] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchAssets = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (mediaTypeFilter !== 'all') params.set('mediaType', mediaTypeFilter);

      const res = await fetch(`/api/admin/media?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setAssets(data.assets || []);
        setTotal(data.total || 0);
      }
    } catch (err: any) {
      console.error('Failed to fetch media assets:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssets();
  }, [search, mediaTypeFilter]);

  const handleSelectAsset = async (asset: MediaAsset) => {
    setSelectedAsset(asset);
    setEditTitle(asset.title || asset.originalFilename);
    setEditAlt(asset.altText || '');
    setEditCaption(asset.caption || '');
    setLoadingUsages(true);
    try {
      const res = await fetch(`/api/admin/media/${asset.id}/usages`);
      const data = await res.json();
      if (data.success) {
        setUsages(data.usages || []);
      }
    } catch {
      setUsages([]);
    } finally {
      setLoadingUsages(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    setStatusMessage(null);
    try {
      const formData = new FormData();
      for (let i = 0; i < files.length; i++) {
        formData.append('files', files[i]);
      }

      const res = await fetch('/api/admin/media/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (data.success) {
        setStatusMessage({ type: 'success', text: `Successfully uploaded ${data.count} media asset(s).` });
        fetchAssets();
        if (data.assets && data.assets.length > 0) {
          handleSelectAsset(data.assets[0]);
        }
      } else {
        setStatusMessage({ type: 'error', text: data.error?.message || 'Upload failed.' });
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Upload network error.' });
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleSaveMetadata = async () => {
    if (!selectedAsset) return;
    setSavingMetadata(true);
    setStatusMessage(null);
    try {
      const res = await fetch(`/api/admin/media/${selectedAsset.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editTitle,
          altText: editAlt,
          caption: editCaption,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSelectedAsset(data.asset);
        setStatusMessage({ type: 'success', text: 'Media metadata updated.' });
        fetchAssets();
      } else {
        setStatusMessage({ type: 'error', text: data.error?.message || 'Failed to update metadata.' });
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message });
    } finally {
      setSavingMetadata(false);
    }
  };

  const handleDeleteAsset = async (force = false) => {
    if (!selectedAsset) return;
    if (!confirm(`Are you sure you want to delete "${selectedAsset.title || selectedAsset.originalFilename}"?`)) return;

    setStatusMessage(null);
    try {
      const res = await fetch(`/api/admin/media/${selectedAsset.id}?force=${force}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        setStatusMessage({ type: 'success', text: 'Asset deleted.' });
        setSelectedAsset(null);
        fetchAssets();
      } else if (data.error?.code === 'MEDIA_IN_USE') {
        if (confirm(`${data.error.message}\n\nDo you want to force delete it anyway?`)) {
          handleDeleteAsset(true);
        }
      } else {
        setStatusMessage({ type: 'error', text: data.error?.message || 'Delete failed.' });
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message });
    }
  };

  const copyUrlToClipboard = (url: string, id: string) => {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <AdminLayout
      currentPath={currentPath}
      onNavigate={onNavigate}
      title="Media Library"
      subtitle="Upload, optimize, and organize images and assets with automated usage tracking"
      actions={
        hasPermission('media.write') ? (
          <div>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              multiple
              accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs flex items-center gap-2 transition-colors shadow-lg shadow-blue-500/20 disabled:opacity-50"
            >
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              <span>{uploading ? 'Uploading...' : 'Upload Files'}</span>
            </button>
          </div>
        ) : undefined
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

      {/* Filter and Search Bar */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            placeholder="Search media by filename, title, alt..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <Filter className="w-3.5 h-3.5" />
            <span>Type:</span>
          </div>
          <select
            value={mediaTypeFilter}
            onChange={(e) => setMediaTypeFilter(e.target.value)}
            className="bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 rounded-xl px-3 py-2 focus:outline-none focus:border-blue-500"
          >
            <option value="all">All Media</option>
            <option value="image">Images (JPG, PNG, WebP, GIF, SVG)</option>
          </select>

          <button
            onClick={fetchAssets}
            title="Refresh"
            className="p-2 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-400 hover:text-white transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Grid & Detail Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Media Grid */}
        <div className="lg:col-span-2 bg-zinc-900 border border-zinc-800 rounded-2xl p-4 min-h-[500px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-80 text-zinc-500 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
              <p className="text-xs">Loading media assets...</p>
            </div>
          ) : assets.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-80 text-zinc-500 gap-3">
              <FolderOpen className="w-12 h-12 stroke-[1.2]" />
              <p className="text-sm font-medium text-zinc-400">No media assets found</p>
              <p className="text-xs text-zinc-600 max-w-xs text-center">
                Upload image assets (PNG, JPEG, WebP, SVG) to use across blog posts and pages.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {assets.map((asset) => {
                const isSelected = selectedAsset?.id === asset.id;
                return (
                  <div
                    key={asset.id}
                    onClick={() => handleSelectAsset(asset)}
                    className={`group relative rounded-xl border overflow-hidden cursor-pointer transition-all aspect-square bg-zinc-950 flex flex-col ${
                      isSelected
                        ? 'border-blue-500 ring-2 ring-blue-500/20'
                        : 'border-zinc-800 hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex-1 flex items-center justify-center overflow-hidden p-2">
                      <img
                        src={asset.publicUrl}
                        alt={asset.altText || asset.title || asset.originalFilename}
                        className="max-h-full max-w-full object-contain rounded"
                        loading="lazy"
                      />
                    </div>
                    <div className="bg-zinc-900/90 border-t border-zinc-800 px-2.5 py-1.5 flex items-center justify-between">
                      <p className="text-[11px] font-medium text-zinc-300 truncate" title={asset.title || asset.originalFilename}>
                        {asset.title || asset.originalFilename}
                      </p>
                      <span className="text-[9px] text-zinc-400 font-mono">
                        {asset.width && asset.height ? `${asset.width}x${asset.height}` : formatBytes(asset.sizeBytes)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Selected Asset Inspector */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
          {selectedAsset ? (
            <div className="space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                <h3 className="text-sm font-semibold text-white">Asset Details</h3>
                {hasPermission('media.delete') && (
                  <button
                    onClick={() => handleDeleteAsset(false)}
                    className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-zinc-800 rounded-lg transition-colors"
                    title="Delete Media Asset"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Preview Box */}
              <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3 flex items-center justify-center max-h-48 overflow-hidden">
                <img
                  src={selectedAsset.publicUrl}
                  alt={selectedAsset.altText || ''}
                  className="max-h-40 max-w-full object-contain rounded"
                />
              </div>

              {/* File Info */}
              <div className="space-y-1.5 text-xs text-zinc-400">
                <div className="flex justify-between py-1 border-b border-zinc-800/60">
                  <span>Filename:</span>
                  <span className="text-zinc-200 font-mono truncate max-w-[180px]">{selectedAsset.originalFilename}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-zinc-800/60">
                  <span>Dimensions:</span>
                  <span className="text-zinc-200">{selectedAsset.width && selectedAsset.height ? `${selectedAsset.width} x ${selectedAsset.height} px` : 'Vector / N/A'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-zinc-800/60">
                  <span>File Size:</span>
                  <span className="text-zinc-200">{formatBytes(selectedAsset.sizeBytes)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-zinc-800/60">
                  <span>MIME Type:</span>
                  <span className="text-zinc-200 font-mono">{selectedAsset.mimeType}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span>Public URL:</span>
                  <button
                    onClick={() => copyUrlToClipboard(selectedAsset.publicUrl, selectedAsset.id)}
                    className="flex items-center gap-1 text-blue-400 hover:text-blue-300 font-mono"
                  >
                    {copiedId === selectedAsset.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedId === selectedAsset.id ? 'Copied' : 'Copy Path'}</span>
                  </button>
                </div>
              </div>

              {/* Metadata Edit Form */}
              <div className="space-y-3 pt-2">
                <div>
                  <label className="block text-[11px] font-medium text-zinc-400 mb-1">Title</label>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    disabled={!hasPermission('media.write')}
                    className="w-full px-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-zinc-400 mb-1">Alt Text (Accessibility & SEO)</label>
                  <input
                    type="text"
                    value={editAlt}
                    onChange={(e) => setEditAlt(e.target.value)}
                    disabled={!hasPermission('media.write')}
                    placeholder="Describe the image..."
                    className="w-full px-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-zinc-400 mb-1">Caption</label>
                  <input
                    type="text"
                    value={editCaption}
                    onChange={(e) => setEditCaption(e.target.value)}
                    disabled={!hasPermission('media.write')}
                    placeholder="Optional image caption..."
                    className="w-full px-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                {hasPermission('media.write') && (
                  <button
                    onClick={handleSaveMetadata}
                    disabled={savingMetadata}
                    className="w-full py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-xs font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    {savingMetadata ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Edit2 className="w-3.5 h-3.5" />}
                    <span>Save Metadata</span>
                  </button>
                )}
              </div>

              {/* Usages Reference List */}
              <div className="pt-3 border-t border-zinc-800">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-zinc-300">Active Usages ({usages.length})</span>
                  {loadingUsages && <Loader2 className="w-3 h-3 animate-spin text-zinc-500" />}
                </div>
                {usages.length === 0 ? (
                  <p className="text-[11px] text-zinc-500 italic">No articles or pages currently link to this asset.</p>
                ) : (
                  <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                    {usages.map((u, i) => (
                      <div key={i} className="p-2 rounded-lg bg-zinc-950 border border-zinc-800/80 text-[11px] flex items-center justify-between">
                        <div className="truncate mr-2">
                          <span className="text-zinc-300 font-medium">{u.title}</span>
                          <span className="text-zinc-500 text-[10px] block">{u.pathOrSlug}</span>
                        </div>
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 whitespace-nowrap">
                          {u.type}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-80 text-zinc-500 gap-2">
              <Info className="w-8 h-8 stroke-[1.2]" />
              <p className="text-xs">Select an asset to view metadata and usage references.</p>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
};
