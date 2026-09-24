import React, { useState, useEffect } from 'react';
import { AdminApp } from './admin/AdminApp';
import { CmsSectionsRenderer } from './components/CmsSectionsRenderer';
import { BlogListView } from './components/blog/BlogListView';
import { BlogPostView } from './components/blog/BlogPostView';
import {
  Download,
  AlertCircle,
  Loader2,
  Film,
  Music,
  ShieldCheck,
  Activity,
  Terminal,
  Clock,
  Heart,
  MessageCircle,
  Share2,
  Eye,
  RefreshCw,
  Copy,
  Check,
  HelpCircle,
  ExternalLink,
  ChevronRight,
  Layers,
  Sparkles,
} from 'lucide-react';

interface MediaVariant {
  id: string;
  url: string;
  format: string;
  mimeType: string;
  width?: number;
  height?: number;
  bitrate?: number;
  fileSize?: number;
  quality?: string;
  hasWatermark?: boolean;
}

interface ResolvedMedia {
  id: string;
  platform: string;
  sourceUrl: string;
  normalizedUrl: string;
  title?: string;
  author?: {
    id?: string;
    name?: string;
    username?: string;
    avatarUrl?: string;
  };
  thumbnailUrl?: string;
  duration?: number;
  mediaType: 'video' | 'image' | 'audio';
  variants: MediaVariant[];
  stats?: {
    views?: number;
    likes?: number;
    comments?: number;
    shares?: number;
    downloads?: number;
  };
  resolvedAt: string;
}

interface DiagnosticLogEntry {
  id: string;
  timestamp: string;
  action: string;
  platform?: string;
  url?: string;
  status: string;
  details?: Record<string, unknown>;
  error?: string;
  durationMs?: number;
}

type EngineStatus = 'idle' | 'resolving' | 'resolved' | 'failed';
type DownloadState = Record<string, 'idle' | 'preparing' | 'ready'>;

interface RouteConfig {
  path: string;
  platform: string;
  title: string;
  metaDesc: string;
  h1: string;
  subtitle: string;
  placeholder: string;
  sampleUrl: string;
  faqs: Array<{ q: string; a: string }>;
}

const ROUTES: Record<string, RouteConfig> = {
  '/pinterest-video-downloader': {
    path: '/pinterest-video-downloader',
    platform: 'pinterest',
    title: 'Pinterest Video Downloader - Download Pinterest MP4 Videos Online',
    metaDesc: 'Free online Pinterest Video Downloader. Download high quality Pinterest MP4 videos and Idea Pins in HD without registration.',
    h1: 'Pinterest Video Downloader',
    subtitle: 'Extract and download high-definition MP4 videos from Pinterest Pins and Idea Pins with direct stream resolution.',
    placeholder: 'Paste a Pinterest pin URL (e.g. https://www.pinterest.com/pin/848365648603016583/ or pin.it/...)',
    sampleUrl: 'https://www.pinterest.com/pin/848365648603016583/',
    faqs: [
      {
        q: 'How do I download a video from Pinterest?',
        a: 'Copy the URL of the Pinterest Pin containing a video (or use a pin.it short link), paste it into the box above, and click "Resolve Media". Once processed, choose your preferred MP4 quality and click Download.',
      },
      {
        q: 'Does this tool support pin.it short links?',
        a: 'Yes! Our backend server automatically follows and expands pin.it short links safely through verified redirect hops.',
      },
      {
        q: 'Can I download image-only Pins as video?',
        a: 'No, our video downloader specifically extracts direct MP4 video streams. Image-only pins without video tracks are rejected with a clear notification.',
      },
      {
        q: 'Is there any watermark added to the downloaded Pinterest video?',
        a: 'No watermarks are added. You receive the original direct video stream provided by Pinterest CDN.',
      },
    ],
  },
  '/tiktok-video-downloader': {
    path: '/tiktok-video-downloader',
    platform: 'tiktok',
    title: 'TikTok Video Downloader - No Watermark MP4 HD',
    metaDesc: 'Download TikTok videos without watermark in HD MP4 quality. Fast, free, and direct streaming.',
    h1: 'TikTok Video Downloader',
    subtitle: 'Download TikTok videos in crystal-clear HD without watermark directly to your device.',
    placeholder: 'Paste a TikTok video link (e.g. https://www.tiktok.com/@user/video/...)',
    sampleUrl: 'https://www.tiktok.com/@scout2015/video/6718335390845095173',
    faqs: [
      {
        q: 'How to download TikTok without watermark?',
        a: 'Paste your TikTok video URL into the input field and click Resolve Media. Choose the HD No Watermark variant to download.',
      },
    ],
  },
  '/instagram-reels-downloader': {
    path: '/instagram-reels-downloader',
    platform: 'instagram',
    title: 'Instagram Reels Downloader - Download IG Reels & Videos HD MP4',
    metaDesc: 'Free online Instagram Reels Downloader. Download public Instagram Reels and videos in high definition MP4 format with audio.',
    h1: 'Instagram Reels Downloader',
    subtitle: 'Save public Instagram Reels, video posts, and clips directly in crystal clear HD with full audio fidelity.',
    placeholder: 'Paste an Instagram Reel or Video URL (e.g. https://www.instagram.com/reel/...)',
    sampleUrl: 'https://www.instagram.com/reel/CY9Kk-xo0vs/',
    faqs: [
      {
        q: 'How do I download Instagram Reels?',
        a: 'Copy the Reel link from the Instagram app or website, paste it above, and click Resolve Media. Choose your preferred MP4 download option.',
      },
      {
        q: 'Does this work for private Instagram accounts?',
        a: 'No, only public Instagram Reels and videos can be resolved and downloaded. Private accounts are strictly protected.',
      },
      {
        q: 'Can I download Instagram Reels with audio?',
        a: 'Yes, all downloaded Reels contain the direct audio track included in the video stream.',
      },
    ],
  },
  '/instagram-video-downloader': {
    path: '/instagram-reels-downloader',
    platform: 'instagram',
    title: 'Instagram Video & Reels Downloader',
    metaDesc: 'Download Instagram Reels, Videos, and IGTV posts in high definition MP4 format.',
    h1: 'Instagram Reels & Video Downloader',
    subtitle: 'Save public Instagram Reels and video posts directly with full audio fidelity.',
    placeholder: 'Paste an Instagram Reel or Video URL (e.g. https://www.instagram.com/reel/...)',
    sampleUrl: 'https://www.instagram.com/reel/C8r27R_vW-7/',
    faqs: [
      {
        q: 'Can I download Instagram Reels?',
        a: 'Yes, public Instagram Reels and video posts can be resolved and streamed directly.',
      },
    ],
  },
  '/youtube-shorts-downloader': {
    path: '/youtube-shorts-downloader',
    platform: 'youtube',
    title: 'YouTube Shorts Downloader - HD Video & Audio',
    metaDesc: 'Download YouTube Shorts and videos in full 1080p/720p HD MP4 and MP3 audio.',
    h1: 'YouTube Shorts Downloader',
    subtitle: 'Download YouTube Shorts and video clips with separate high-quality video and audio stream options.',
    placeholder: 'Paste a YouTube Shorts or Video URL (e.g. https://www.youtube.com/shorts/...)',
    sampleUrl: 'https://www.youtube.com/shorts/aqz-KE-bpKQ',
    faqs: [
      {
        q: 'Does this support YouTube Shorts and full videos?',
        a: 'Yes, both YouTube Shorts (youtube.com/shorts/...) and standard YouTube videos are supported.',
      },
    ],
  },
  '/twitter-video-downloader': {
    path: '/twitter-video-downloader',
    platform: 'twitter',
    title: 'X / Twitter Video Downloader - HD MP4',
    metaDesc: 'Download videos and GIFs from X (Twitter) in multiple MP4 resolutions.',
    h1: 'X / Twitter Video Downloader',
    subtitle: 'Save videos and animated GIFs from public tweets and posts on X / Twitter in HD.',
    placeholder: 'Paste an X / Twitter tweet URL (e.g. https://x.com/user/status/...)',
    sampleUrl: 'https://twitter.com/Twitter/status/1460323737035677698',
    faqs: [
      {
        q: 'How do I download videos from X (Twitter)?',
        a: 'Copy the tweet URL containing the video, paste it above, and select your desired MP4 resolution.',
      },
    ],
  },
  '/facebook-video-downloader': {
    path: '/facebook-video-downloader',
    platform: 'facebook',
    title: 'Facebook Video Downloader - Reels & Watch HD',
    metaDesc: 'Download Facebook Reels and public Watch videos in high quality MP4 format.',
    h1: 'Facebook Video Downloader',
    subtitle: 'Download public Facebook Reels, Watch videos, and clips in HD/SD quality.',
    placeholder: 'Paste a Facebook Video or Reel URL (e.g. https://www.facebook.com/reel/...)',
    sampleUrl: 'https://www.facebook.com/reel/1022068992686884',
    faqs: [
      {
        q: 'Can I download Facebook Reels?',
        a: 'Yes, public Facebook Reels and Watch videos are fully supported.',
      },
    ],
  },
};

export default function App() {
  const isDev = Boolean(import.meta.env.DEV);
  const [currentPath, setCurrentPath] = useState(
    typeof window !== 'undefined' ? window.location.pathname : '/'
  );
  const [inputUrl, setInputUrl] = useState('');
  const [engineStatus, setEngineStatus] = useState<EngineStatus>('idle');
  const [resolvedMedia, setResolvedMedia] = useState<ResolvedMedia | null>(null);
  const [downloadToken, setDownloadToken] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<{ code: string; message: string } | null>(null);
  const [downloadStates, setDownloadStates] = useState<DownloadState>({});
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const [logs, setLogs] = useState<DiagnosticLogEntry[]>([]);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [resolvedSeo, setResolvedSeo] = useState<any>(null);
  const [cmsPage, setCmsPage] = useState<any>(null);
  const [cmsSections, setCmsSections] = useState<any[]>([]);
  const [isCmsPreview, setIsCmsPreview] = useState(false);
  const [cmsPageNotFound, setCmsPageNotFound] = useState(false);

  // Sync route on popstate
  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  if (currentPath.startsWith('/admin')) {
    return (
      <AdminApp
        currentPath={currentPath}
        onNavigate={(path) => {
          window.history.pushState({}, '', path);
          setCurrentPath(path);
        }}
      />
    );
  }

  // Public Blog Routes
  if (currentPath.startsWith('/blog')) {
    const handleNavigate = (path: string) => {
      window.history.pushState({}, '', path);
      setCurrentPath(path);
    };

    if (currentPath === '/blog') {
      return <BlogListView currentPath={currentPath} onNavigate={handleNavigate} />;
    }

    if (currentPath.startsWith('/blog/category/')) {
      const catSlug = currentPath.replace('/blog/category/', '').trim();
      return <BlogListView currentPath={currentPath} categoryFilter={catSlug} onNavigate={handleNavigate} />;
    }

    if (currentPath.startsWith('/blog/tag/')) {
      const tagSlug = currentPath.replace('/blog/tag/', '').trim();
      return <BlogListView currentPath={currentPath} tagFilter={tagSlug} onNavigate={handleNavigate} />;
    }

    const postSlug = currentPath.replace('/blog/', '').trim();
    const previewToken = typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('previewToken') || undefined
      : undefined;

    return <BlogPostView slug={postSlug} previewToken={previewToken} onNavigate={handleNavigate} />;
  }

  const currentRouteConfig = ROUTES[currentPath] || null;

  // Real Dynamic SEO Sync: Fetch authoritative metadata from backend SEO service
  useEffect(() => {
    let isCancelled = false;

    const syncSeo = async () => {
      try {
        const res = await fetch(`/api/seo/resolve?path=${encodeURIComponent(currentPath)}`);
        if (res.ok) {
          const data = await res.json();
          if (isCancelled) return;

          // Follow client-side redirect if configured
          if (data.redirect && data.redirect.destination !== currentPath) {
            window.history.replaceState({}, '', data.redirect.destination);
            setCurrentPath(data.redirect.destination);
            return;
          }

          if (data.seo) {
            setResolvedSeo(data.seo);
            document.title = data.seo.title;

            // Meta Description
            let metaDesc = document.querySelector('meta[name="description"]');
            if (!metaDesc) {
              metaDesc = document.createElement('meta');
              metaDesc.setAttribute('name', 'description');
              document.head.appendChild(metaDesc);
            }
            metaDesc.setAttribute('content', data.seo.metaDescription || '');

            // Canonical Link
            let canonicalLink = document.querySelector('link[rel="canonical"]');
            if (!canonicalLink) {
              canonicalLink = document.createElement('link');
              canonicalLink.setAttribute('rel', 'canonical');
              document.head.appendChild(canonicalLink);
            }
            canonicalLink.setAttribute('href', data.seo.canonicalUrl);

            // Robots
            let robotsMeta = document.querySelector('meta[name="robots"]');
            if (!robotsMeta) {
              robotsMeta = document.createElement('meta');
              robotsMeta.setAttribute('name', 'robots');
              document.head.appendChild(robotsMeta);
            }
            robotsMeta.setAttribute('content', data.seo.robots);

            // Open Graph
            let ogTitle = document.querySelector('meta[property="og:title"]');
            if (ogTitle) ogTitle.setAttribute('content', data.seo.og?.title || data.seo.title);
            let ogDesc = document.querySelector('meta[property="og:description"]');
            if (ogDesc) ogDesc.setAttribute('content', data.seo.og?.description || data.seo.metaDescription);
            let ogUrl = document.querySelector('meta[property="og:url"]');
            if (ogUrl) ogUrl.setAttribute('content', data.seo.og?.url || data.seo.canonicalUrl);

            // Twitter
            let twTitle = document.querySelector('meta[name="twitter:title"]');
            if (twTitle) twTitle.setAttribute('content', data.seo.twitter?.title || data.seo.title);
            let twDesc = document.querySelector('meta[name="twitter:description"]');
            if (twDesc) twDesc.setAttribute('content', data.seo.twitter?.description || data.seo.metaDescription);

            // Structured Data JSON-LD
            let scriptTag = document.querySelector('#seo-structured-data');
            if (!scriptTag) {
              scriptTag = document.createElement('script');
              scriptTag.setAttribute('id', 'seo-structured-data');
              scriptTag.setAttribute('type', 'application/ld+json');
              document.head.appendChild(scriptTag);
            }
            scriptTag.textContent = data.seo.schemaJson;
            return;
          }
        }
      } catch (err) {
        console.warn('Could not fetch dynamic SEO metadata:', err);
      }

      // Fallback to static route definition if offline or failed
      if (currentRouteConfig) {
        document.title = currentRouteConfig.title;
      }
    };

    syncSeo();

    return () => {
      isCancelled = true;
    };
  }, [currentPath, currentRouteConfig]);

  // Real CMS Content Sync: Fetch structured page & sections from Pages CMS
  useEffect(() => {
    let isCancelled = false;

    // Check if initial SSR state exists in DOM
    const initialScript = document.getElementById('__CMS_INITIAL_STATE__');
    if (initialScript && initialScript.textContent) {
      try {
        const parsed = JSON.parse(initialScript.textContent);
        if (parsed?.page?.path === currentPath) {
          setCmsPage(parsed.page);
          setCmsSections(parsed.sections || []);
          setIsCmsPreview(Boolean(parsed.isPreview));
          setCmsPageNotFound(false);
          return;
        }
      } catch {
        // Fall back to network fetch
      }
    }

    const fetchCms = async () => {
      try {
        const searchParams = new URLSearchParams(window.location.search);
        const previewToken = searchParams.get('previewToken') || '';
        const tokenQuery = previewToken ? `&previewToken=${encodeURIComponent(previewToken)}` : '';
        const res = await fetch(`/api/pages/resolve?path=${encodeURIComponent(currentPath)}${tokenQuery}`);

        if (res.ok) {
          const data = await res.json();
          if (isCancelled) return;
          if (data.success && data.page) {
            setCmsPage(data.page);
            setCmsSections(data.sections || []);
            setIsCmsPreview(Boolean(data.isPreview));
            setCmsPageNotFound(false);
            return;
          }
        } else if (res.status === 404) {
          if (isCancelled) return;
          setCmsPage(null);
          setCmsSections([]);
          const isCoreRoute = ROUTES[currentPath] !== undefined;
          setCmsPageNotFound(!isCoreRoute);
        }
      } catch (err) {
        console.warn('Could not fetch CMS content:', err);
      }
    };

    fetchCms();

    return () => {
      isCancelled = true;
    };
  }, [currentPath]);

  const navigateTo = (path: string) => {
    if (window.location.pathname !== path) {
      window.history.pushState({}, '', path);
      setCurrentPath(path);
      setResolvedMedia(null);
      setEngineStatus('idle');
      setErrorMessage(null);
    }
  };

  // Live client-side hint for detection
  const detectedPlatformHint = (() => {
    if (!inputUrl.trim()) return null;
    const lower = inputUrl.toLowerCase();
    if (lower.includes('tiktok.com')) return { name: 'TikTok', supported: true };
    if (lower.includes('instagram.com') || lower.includes('instagr.am')) return { name: 'Instagram', supported: true };
    if (lower.includes('facebook.com') || lower.includes('fb.watch')) return { name: 'Facebook', supported: true };
    if (lower.includes('youtube.com') || lower.includes('youtu.be')) return { name: 'YouTube', supported: true };
    if (lower.includes('twitter.com') || lower.includes('x.com')) return { name: 'X / Twitter', supported: true };
    if (lower.includes('pinterest.com') || lower.includes('pin.it')) return { name: 'Pinterest', supported: true };
    return { name: 'Unknown / Generic', supported: false };
  })();

  const fetchDiagnostics = async () => {
    if (!isDev) return;
    try {
      const res = await fetch('/api/media/diagnostics');
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (diagnosticsOpen && isDev) {
      fetchDiagnostics();
      const interval = setInterval(fetchDiagnostics, 3000);
      return () => clearInterval(interval);
    }
  }, [diagnosticsOpen, isDev]);

  const handleResolve = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const url = inputUrl.trim();
    if (!url) return;

    setEngineStatus('resolving');
    setErrorMessage(null);
    setResolvedMedia(null);
    setDownloadToken(null);
    setDownloadStates({});

    try {
      const response = await fetch('/api/media/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });

      const data = await response.json();

      if (data.success && data.media) {
        setResolvedMedia(data.media);
        setDownloadToken(data.downloadToken || null);
        setEngineStatus('resolved');
      } else {
        setEngineStatus('failed');
        setErrorMessage({
          code: data.error?.code || 'RESOLUTION_FAILED',
          message: data.error?.message || 'Unable to resolve media from this URL.',
        });
      }
    } catch (err: unknown) {
      setEngineStatus('failed');
      setErrorMessage({
        code: 'NETWORK_ERROR',
        message: err instanceof Error ? err.message : 'Failed to connect to the backend downloader engine.',
      });
    }
  };

  const handleDownload = (variant: MediaVariant) => {
    if (!downloadToken) return;

    // Set truthful preparing state
    setDownloadStates((prev) => ({ ...prev, [variant.id]: 'preparing' }));

    const downloadUrl = `/api/media/download?token=${encodeURIComponent(
      downloadToken
    )}&variantId=${encodeURIComponent(variant.id)}`;

    // Trigger browser stream
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.setAttribute('download', '');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Reset button after stream initiation
    setTimeout(() => {
      setDownloadStates((prev) => ({ ...prev, [variant.id]: 'idle' }));
    }, 2500);
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes || bytes <= 0) return null;
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  };

  const formatNumber = (num?: number) => {
    if (num === undefined || num === null) return '0';
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
    return num.toLocaleString();
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Preview Mode Sticky Banner */}
      {isCmsPreview && (
        <div className="bg-amber-500 text-slate-950 text-xs font-bold text-center py-2 px-4 sticky top-0 z-50 shadow-md flex items-center justify-center gap-2">
          <span className="w-2 h-2 rounded-full bg-slate-950 animate-pulse"></span>
          <span>PREVIEW MODE — Viewing unpublished draft content for "{cmsPage?.title || currentPath}"</span>
        </div>
      )}

      {/* Top Banner */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div
            onClick={() => navigateTo('/')}
            className="flex items-center space-x-3 cursor-pointer"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-500 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Download className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
                  Media Engine
                </span>
                <span className="px-2 py-0.5 text-xs font-semibold uppercase tracking-wider rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  6 Platforms Active
                </span>
              </div>
              <p className="text-xs text-slate-400">Production Multi-Platform Media Resolution Engine</p>
            </div>
          </div>

          {/* Development-only diagnostics toggle */}
          {isDev && (
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setDiagnosticsOpen(!diagnosticsOpen)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 flex items-center space-x-1.5 transition-colors border border-slate-700"
              >
                <Terminal className="w-3.5 h-3.5" />
                <span>{diagnosticsOpen ? 'Hide Diagnostics' : 'Dev Diagnostics'}</span>
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Navigation Sub-header for Platform Routes */}
      <nav className="border-b border-slate-800/80 bg-slate-900/30 overflow-x-auto py-2">
        <div className="max-w-5xl mx-auto px-4 flex items-center space-x-2 text-xs font-medium">
          <button
            onClick={() => navigateTo('/')}
            className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
              currentPath === '/'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            All Platforms
          </button>
          <button
            onClick={() => navigateTo('/pinterest-video-downloader')}
            className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors flex items-center space-x-1.5 ${
              currentPath === '/pinterest-video-downloader'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            <span>Pinterest Downloader</span>
          </button>
          <button
            onClick={() => navigateTo('/tiktok-video-downloader')}
            className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors flex items-center space-x-1.5 ${
              currentPath === '/tiktok-video-downloader'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            <span>TikTok</span>
          </button>
          <button
            onClick={() => navigateTo('/instagram-reels-downloader')}
            className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors flex items-center space-x-1.5 ${
              currentPath === '/instagram-reels-downloader' || currentPath === '/instagram-video-downloader'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            <span>Instagram Reels</span>
          </button>
          <button
            onClick={() => navigateTo('/facebook-video-downloader')}
            className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors flex items-center space-x-1.5 ${
              currentPath === '/facebook-video-downloader'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            <span>Facebook</span>
          </button>
          <button
            onClick={() => navigateTo('/youtube-shorts-downloader')}
            className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors flex items-center space-x-1.5 ${
              currentPath === '/youtube-shorts-downloader'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            <span>YouTube</span>
          </button>
          <button
            onClick={() => navigateTo('/twitter-video-downloader')}
            className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors flex items-center space-x-1.5 ${
              currentPath === '/twitter-video-downloader'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            <span>X / Twitter</span>
          </button>
          <button
            onClick={() => navigateTo('/blog')}
            className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors flex items-center space-x-1.5 ${
              currentPath.startsWith('/blog')
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>Blog & Guides</span>
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-8 flex flex-col space-y-8">
        {/* Hero & Provider Status or 404 */}
        {cmsPageNotFound ? (
          <section className="text-center py-16 space-y-4 bg-slate-900/40 border border-slate-800 rounded-2xl p-8">
            <h1 className="text-3xl sm:text-4xl font-extrabold text-white">404 — Page Not Found</h1>
            <p className="text-slate-400 text-sm max-w-md mx-auto">
              The requested page does not exist or has not been published yet.
            </p>
            <button
              onClick={() => navigateTo('/')}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-colors"
            >
              Return to Home
            </button>
          </section>
        ) : (
          <section className="text-center space-y-3 pt-4">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-xs text-slate-400 mb-2">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Server-Verified Media Streams • SSRF Protected</span>
            </div>

            {/* Breadcrumbs if present */}
            {resolvedSeo?.breadcrumbs && resolvedSeo.breadcrumbs.length > 1 && (
              <nav aria-label="Breadcrumb" className="flex items-center justify-center space-x-1.5 text-xs text-slate-400 pb-1">
                {resolvedSeo.breadcrumbs.map((b: any, i: number) => (
                  <React.Fragment key={i}>
                    {i > 0 && <span className="text-slate-600">/</span>}
                    <button
                      onClick={() => navigateTo(b.path)}
                      className={`hover:underline ${
                        i === resolvedSeo.breadcrumbs.length - 1
                          ? 'text-slate-200 font-medium'
                          : 'text-slate-400'
                      }`}
                    >
                      {b.label}
                    </button>
                  </React.Fragment>
                ))}
              </nav>
            )}

            {(() => {
              const cmsHero = cmsSections.find((s: any) => s.sectionType === 'hero')?.data;
              return (
                <>
                  {cmsHero?.eyebrow && (
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mb-1">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>{cmsHero.eyebrow}</span>
                    </div>
                  )}

                  <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
                    {resolvedSeo?.h1 || cmsHero?.heading || (currentRouteConfig ? currentRouteConfig.h1 : 'Social Media Video Downloader')}
                  </h1>
                  <p className="text-slate-400 max-w-2xl mx-auto text-sm sm:text-base">
                    {resolvedSeo?.metaDescription || cmsHero?.description || (currentRouteConfig
                      ? currentRouteConfig.subtitle
                      : 'Resolves publicly accessible media URLs into streamable video and audio tracks with direct server-side stream verification.')}
                  </p>
                </>
              );
            })()}

            {/* Supported Providers Badges */}
            <div className="pt-3 flex flex-wrap items-center justify-center gap-2 max-w-2xl mx-auto">
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-emerald-950/80 text-emerald-300 border border-emerald-500/30 flex items-center space-x-1.5 shadow-sm">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>Pinterest (Active)</span>
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-emerald-950/80 text-emerald-300 border border-emerald-500/30 flex items-center space-x-1.5 shadow-sm">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>TikTok (Active)</span>
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-emerald-950/80 text-emerald-300 border border-emerald-500/30 flex items-center space-x-1.5 shadow-sm">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>Instagram (Active)</span>
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-emerald-950/80 text-emerald-300 border border-emerald-500/30 flex items-center space-x-1.5 shadow-sm">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>Facebook (Active)</span>
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-emerald-950/80 text-emerald-300 border border-emerald-500/30 flex items-center space-x-1.5 shadow-sm">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>YouTube Shorts (Active)</span>
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-emerald-950/80 text-emerald-300 border border-emerald-500/30 flex items-center space-x-1.5 shadow-sm">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>X / Twitter (Active)</span>
              </span>
            </div>
          </section>
        )}

        {/* Input Form Card */}
        <section className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl backdrop-blur-sm">
          <form onSubmit={handleResolve} className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <label htmlFor="media-url" className="font-semibold text-slate-300">
                  Target Media URL
                </label>
                {detectedPlatformHint && (
                  <span
                    className={`font-medium ${
                      detectedPlatformHint.supported ? 'text-emerald-400' : 'text-amber-400'
                    }`}
                  >
                    Platform: {detectedPlatformHint.name}{' '}
                    {detectedPlatformHint.supported ? '(Ready)' : '(Not enabled)'}
                  </span>
                )}
              </div>

              <div className="relative flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <input
                    id="media-url"
                    type="text"
                    value={inputUrl}
                    onChange={(e) => setInputUrl(e.target.value)}
                    placeholder={
                      currentRouteConfig
                        ? currentRouteConfig.placeholder
                        : 'Paste a Pinterest, TikTok, Instagram, Facebook, YouTube, or X URL...'
                    }
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  />
                  {inputUrl && (
                    <button
                      type="button"
                      onClick={() => setInputUrl('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 hover:text-slate-300"
                    >
                      Clear
                    </button>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={engineStatus === 'resolving' || !inputUrl.trim()}
                  className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm text-white flex items-center justify-center space-x-2 transition-all shadow-md shadow-indigo-600/20 shrink-0"
                >
                  {engineStatus === 'resolving' ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Resolving Stream...</span>
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4" />
                      <span>Resolve Media</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Quick sample helper */}
            <div className="flex flex-wrap items-center justify-between text-xs text-slate-400 pt-1 border-t border-slate-800/60">
              <span className="text-slate-500">Quick test sample:</span>
              <div className="flex items-center space-x-3">
                {currentRouteConfig ? (
                  <button
                    type="button"
                    onClick={() => setInputUrl(currentRouteConfig.sampleUrl)}
                    className="text-indigo-400 hover:text-indigo-300 font-medium underline underline-offset-2"
                  >
                    Use Sample {currentRouteConfig.platform} URL
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        setInputUrl('https://www.pinterest.com/pin/848365648603016583/')
                      }
                      className="text-indigo-400 hover:text-indigo-300 font-medium underline underline-offset-2"
                    >
                      Pinterest Video
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setInputUrl('https://www.tiktok.com/@scout2015/video/6718335390845095173')
                      }
                      className="text-indigo-400 hover:text-indigo-300 font-medium underline underline-offset-2"
                    >
                      TikTok
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setInputUrl('https://www.youtube.com/shorts/aqz-KE-bpKQ')
                      }
                      className="text-indigo-400 hover:text-indigo-300 font-medium underline underline-offset-2"
                    >
                      YouTube
                    </button>
                  </>
                )}
              </div>
            </div>
          </form>
        </section>

        {/* State: Resolving Spinner */}
        {engineStatus === 'resolving' && (
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-10 flex flex-col items-center justify-center space-y-4 animate-in fade-in duration-200">
            <div className="relative">
              <div className="w-12 h-12 rounded-full border-4 border-indigo-500/20 border-t-indigo-500 animate-spin"></div>
            </div>
            <div className="text-center space-y-1">
              <h3 className="font-semibold text-white">Contacting Upstream Provider</h3>
              <p className="text-xs text-slate-400">
                Verifying video access, validating variant stream reachability, and preparing download session...
              </p>
            </div>
          </div>
        )}

        {/* State: Failed Error Banner */}
        {engineStatus === 'failed' && errorMessage && (
          <div className="bg-red-950/40 border border-red-800/60 rounded-2xl p-5 flex items-start space-x-3 text-red-200 animate-in fade-in duration-200">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div className="space-y-1 text-sm flex-1">
              <div className="flex items-center space-x-2">
                <span className="font-bold text-red-300">Resolution Failed</span>
                <span className="px-2 py-0.5 rounded bg-red-900/60 text-red-300 font-mono text-xs border border-red-700/50">
                  {errorMessage.code}
                </span>
              </div>
              <p className="text-red-300/90 text-xs sm:text-sm">{errorMessage.message}</p>
            </div>
          </div>
        )}

        {/* State: Resolved Media Display */}
        {engineStatus === 'resolved' && resolvedMedia && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl space-y-6 p-6 animate-in fade-in duration-300">
            {/* Media Header & Creator Card */}
            <div className="flex flex-col md:flex-row gap-6 items-start">
              {/* Thumbnail / Dynamic Preview */}
              <div className="relative w-full md:w-56 aspect-[9/16] md:aspect-square bg-slate-950 rounded-xl overflow-hidden border border-slate-800 shrink-0 shadow-inner group">
                {resolvedMedia.thumbnailUrl ? (
                  <img
                    src={resolvedMedia.thumbnailUrl}
                    alt={resolvedMedia.title || 'Media thumbnail'}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-600">
                    <Film className="w-10 h-10" />
                  </div>
                )}
                {resolvedMedia.duration && (
                  <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-black/80 backdrop-blur-sm text-white text-xs font-mono flex items-center space-x-1">
                    <Clock className="w-3 h-3" />
                    <span>{resolvedMedia.duration}s</span>
                  </div>
                )}
                <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/70 backdrop-blur-sm text-xs font-medium text-emerald-400 uppercase tracking-wider border border-white/10">
                  {resolvedMedia.platform}
                </div>
              </div>

              {/* Information & Stats */}
              <div className="flex-1 space-y-4">
                <div className="space-y-1.5">
                  <div className="flex items-center space-x-3">
                    {resolvedMedia.author?.avatarUrl && (
                      <img
                        src={resolvedMedia.author.avatarUrl}
                        alt={resolvedMedia.author.name || 'Author'}
                        className="w-8 h-8 rounded-full border border-slate-700 object-cover"
                      />
                    )}
                    <div>
                      <h4 className="text-sm font-bold text-white flex items-center space-x-1">
                        <span>{resolvedMedia.author?.name || 'Creator'}</span>
                        {resolvedMedia.author?.username && (
                          <span className="text-xs text-slate-400 font-normal">
                            (@{resolvedMedia.author.username})
                          </span>
                        )}
                      </h4>
                    </div>
                  </div>

                  <h2 className="text-lg font-bold text-slate-100 leading-snug">
                    {resolvedMedia.title || 'Untitled Post'}
                  </h2>
                </div>

                {/* Real Metrics if available */}
                {resolvedMedia.stats && (
                  <div className="flex flex-wrap gap-4 text-xs text-slate-400 pt-2 border-t border-slate-800">
                    {resolvedMedia.stats.views !== undefined && (
                      <div className="flex items-center space-x-1">
                        <Eye className="w-3.5 h-3.5 text-slate-500" />
                        <span>{formatNumber(resolvedMedia.stats.views)} views</span>
                      </div>
                    )}
                    {resolvedMedia.stats.likes !== undefined && (
                      <div className="flex items-center space-x-1">
                        <Heart className="w-3.5 h-3.5 text-rose-500" />
                        <span>{formatNumber(resolvedMedia.stats.likes)} likes</span>
                      </div>
                    )}
                    {resolvedMedia.stats.comments !== undefined && (
                      <div className="flex items-center space-x-1">
                        <MessageCircle className="w-3.5 h-3.5 text-sky-500" />
                        <span>{formatNumber(resolvedMedia.stats.comments)} comments</span>
                      </div>
                    )}
                    {resolvedMedia.stats.shares !== undefined && (
                      <div className="flex items-center space-x-1">
                        <Share2 className="w-3.5 h-3.5 text-amber-500" />
                        <span>{formatNumber(resolvedMedia.stats.shares)} shares</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Source link info */}
                <div className="flex items-center space-x-2 text-xs text-slate-400">
                  <span className="truncate max-w-sm font-mono text-slate-500">
                    {resolvedMedia.sourceUrl}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(resolvedMedia.sourceUrl);
                      setCopiedUrl(true);
                      setTimeout(() => setCopiedUrl(false), 2000);
                    }}
                    className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800"
                    title="Copy URL"
                  >
                    {copiedUrl ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Available Media Variants */}
            <div className="space-y-3 pt-4 border-t border-slate-800">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">
                  Available Streams ({resolvedMedia.variants.length})
                </h3>
                <span className="text-xs text-slate-400">Verified streamable binaries</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {resolvedMedia.variants.map((variant) => {
                  const state = downloadStates[variant.id] || 'idle';
                  const isAudio = variant.mimeType.includes('audio');
                  const sizeFormatted = formatFileSize(variant.fileSize);

                  return (
                    <div
                      key={variant.id}
                      className="bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-xl p-4 flex flex-col justify-between space-y-3 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center space-x-2.5">
                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                              isAudio
                                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                            }`}
                          >
                            {isAudio ? <Music className="w-4 h-4" /> : <Film className="w-4 h-4" />}
                          </div>
                          <div>
                            <div className="font-semibold text-sm text-slate-200">
                              {variant.quality || (isAudio ? 'Audio Track' : 'Video')}
                            </div>
                            <div className="text-xs text-slate-400 flex items-center space-x-2 font-mono">
                              <span className="uppercase">{variant.format}</span>
                              {sizeFormatted && (
                                <>
                                  <span>•</span>
                                  <span>{sizeFormatted}</span>
                                </>
                              )}
                              {variant.hasWatermark && (
                                <>
                                  <span>•</span>
                                  <span className="text-amber-400">Watermarked</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="pt-2 flex items-center justify-end space-x-2">
                        <button
                          type="button"
                          onClick={() => handleDownload(variant)}
                          disabled={state === 'preparing'}
                          className="w-full py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-xs font-semibold text-slate-100 flex items-center justify-center space-x-1.5 transition-colors border border-slate-700 disabled:opacity-75"
                        >
                          {state === 'preparing' ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                              <span>Preparing stream...</span>
                            </>
                          ) : (
                            <>
                              <Download className="w-3.5 h-3.5 text-slate-300" />
                              <span>Download {variant.format.toUpperCase()}</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Pages CMS Rendered Content or Fallback */}
        {cmsSections.length > 0 ? (
          <CmsSectionsRenderer
            sections={cmsSections}
            onNavigate={navigateTo}
            excludeHero={true}
          />
        ) : currentRouteConfig ? (
          <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6">
            <div className="space-y-3">
              <h2 className="text-xl font-bold text-white flex items-center space-x-2">
                <Layers className="w-5 h-5 text-indigo-400" />
                <span>About {currentRouteConfig.h1}</span>
              </h2>
              <p className="text-sm text-slate-300 leading-relaxed">
                Our high-speed {currentRouteConfig.platform} video extraction engine resolves and streams direct MP4 video media from publicly accessible posts. Streams are proxied through secure server-side verification pipelines with strict SSRF protections and rate-controlled upstream fetching.
              </p>
            </div>

            {/* How it works */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800/80 space-y-2">
                <div className="w-7 h-7 rounded-lg bg-indigo-500/10 text-indigo-400 font-bold flex items-center justify-center text-xs">
                  1
                </div>
                <h3 className="font-semibold text-sm text-slate-200">Copy Link</h3>
                <p className="text-xs text-slate-400">
                  Copy the {currentRouteConfig.platform} video or post URL from your browser or mobile app.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800/80 space-y-2">
                <div className="w-7 h-7 rounded-lg bg-indigo-500/10 text-indigo-400 font-bold flex items-center justify-center text-xs">
                  2
                </div>
                <h3 className="font-semibold text-sm text-slate-200">Resolve Media</h3>
                <p className="text-xs text-slate-400">
                  Paste the URL above and let our engine extract direct CDN video streams and metadata.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800/80 space-y-2">
                <div className="w-7 h-7 rounded-lg bg-indigo-500/10 text-indigo-400 font-bold flex items-center justify-center text-xs">
                  3
                </div>
                <h3 className="font-semibold text-sm text-slate-200">Download MP4</h3>
                <p className="text-xs text-slate-400">
                  Select your preferred resolution and stream the binary file directly to your device.
                </p>
              </div>
            </div>

            {/* FAQs */}
            {currentRouteConfig.faqs.length > 0 && (
              <div className="pt-4 border-t border-slate-800 space-y-4">
                <h3 className="text-base font-bold text-white flex items-center space-x-2">
                  <HelpCircle className="w-4 h-4 text-indigo-400" />
                  <span>Frequently Asked Questions</span>
                </h3>
                <div className="space-y-3">
                  {currentRouteConfig.faqs.map((faq, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/60 space-y-1.5"
                    >
                      <h4 className="font-semibold text-sm text-slate-200">{faq.q}</h4>
                      <p className="text-xs text-slate-400 leading-relaxed">{faq.a}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Related Tools */}
            <div className="pt-4 border-t border-slate-800">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
                Related Free Download Tools
              </h4>
              <div className="flex flex-wrap gap-2">
                {Object.values(ROUTES).map((route) => (
                  <button
                    key={route.path}
                    onClick={() => navigateTo(route.path)}
                    className="text-xs px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white flex items-center space-x-1 transition-colors"
                  >
                    <span>{route.h1}</span>
                    <ChevronRight className="w-3 h-3 text-slate-500" />
                  </button>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        {/* Development Diagnostics Drawer (Only visible when isDev === true) */}
        {isDev && diagnosticsOpen && (
          <section className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <Activity className="w-4 h-4 text-indigo-400" />
                <h3 className="font-bold text-sm text-slate-200">[DEV ONLY] Engine Diagnostics</h3>
              </div>
              <button
                onClick={fetchDiagnostics}
                className="text-xs text-slate-400 hover:text-slate-200 flex items-center space-x-1"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Refresh</span>
              </button>
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto font-mono text-xs pr-1">
              {logs.length === 0 ? (
                <div className="text-slate-500 py-4 text-center">No trace events recorded yet.</div>
              ) : (
                logs.map((log) => (
                  <div
                    key={log.id}
                    className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/80 space-y-1"
                  >
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-indigo-400 font-bold uppercase">{log.action}</span>
                      <span
                        className={
                          log.status === 'success'
                            ? 'text-emerald-400'
                            : log.status === 'started'
                            ? 'text-sky-400'
                            : 'text-rose-400'
                        }
                      >
                        [{log.status}]
                      </span>
                      {log.durationMs !== undefined && (
                        <span className="text-slate-400">{log.durationMs}ms</span>
                      )}
                      <span className="text-slate-400">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    {log.url && <div className="text-slate-400 truncate">URL: {log.url}</div>}
                    {log.error && <div className="text-rose-400">Error: {log.error}</div>}
                  </div>
                ))
              )}
            </div>
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 py-6 text-center text-xs text-slate-400 space-y-2">
        <div className="flex flex-wrap justify-center gap-4 text-slate-400">
          <button onClick={() => navigateTo('/pinterest-video-downloader')} className="hover:text-slate-200">
            Pinterest Video Downloader
          </button>
          <span>•</span>
          <button onClick={() => navigateTo('/tiktok-video-downloader')} className="hover:text-slate-200">
            TikTok Video Downloader
          </button>
          <span>•</span>
          <button onClick={() => navigateTo('/instagram-video-downloader')} className="hover:text-slate-200">
            Instagram Video Downloader
          </button>
          <span>•</span>
          <button onClick={() => navigateTo('/facebook-video-downloader')} className="hover:text-slate-200">
            Facebook Video Downloader
          </button>
          <span>•</span>
          <button onClick={() => navigateTo('/youtube-shorts-downloader')} className="hover:text-slate-200">
            YouTube Shorts Downloader
          </button>
          <span>•</span>
          <button onClick={() => navigateTo('/twitter-video-downloader')} className="hover:text-slate-200">
            Twitter Video Downloader
          </button>
          <span>•</span>
          <button onClick={() => navigateTo('/blog')} className="text-indigo-400 hover:text-indigo-300 font-medium">
            Blog & Guides
          </button>
          <span>•</span>
          <button onClick={() => navigateTo('/admin/dashboard')} className="text-slate-400 hover:text-blue-400 transition-colors">
            Admin Console
          </button>
        </div>
        <p className="text-slate-500">Media Downloader Engine — Production Multi-Platform Media Resolution Core</p>
      </footer>
    </div>
  );
}
