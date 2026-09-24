import React, { useState, useEffect } from 'react';
import {
  ChevronRight,
  Clock,
  Calendar,
  Share2,
  Copy,
  Check,
  Twitter,
  Facebook,
  Linkedin,
  ArrowLeft,
  BookOpen,
  Eye,
  Loader2,
  Tag,
  AlertTriangle,
} from 'lucide-react';

interface BlogPostDetail {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  status: string;
  publishedAt: string | null;
  createdAt: string;
  authorName?: string;
  primaryCategory?: { name: string; slug: string } | null;
  categories: Array<{ name: string; slug: string }>;
  tags: Array<{ name: string; slug: string }>;
  featuredMedia?: { publicUrl: string; altText: string | null; caption: string | null } | null;
  readTimeMinutes?: number;
}

interface BlogPostViewProps {
  slug: string;
  previewToken?: string;
  onNavigate: (path: string) => void;
}

export const BlogPostView: React.FC<BlogPostViewProps> = ({ slug, previewToken, onNavigate }) => {
  const [post, setPost] = useState<BlogPostDetail | null>(null);
  const [renderedContentHtml, setRenderedContentHtml] = useState<string>('');
  const [isPreview, setIsPreview] = useState(false);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    fetchPost();
  }, [slug, previewToken]);

  const fetchPost = async () => {
    setLoading(true);
    setNotFound(false);
    try {
      const params = new URLSearchParams();
      if (previewToken) params.set('previewToken', previewToken);

      const res = await fetch(`/api/blog/posts/${slug}?${params.toString()}`);
      if (res.status === 404) {
        setNotFound(true);
        return;
      }

      const data = await res.json();
      if (data.success && data.post) {
        setPost(data.post);
        setRenderedContentHtml(data.renderedContentHtml || '');
        setIsPreview(Boolean(data.isPreview));
      } else {
        setNotFound(true);
      }
    } catch (err) {
      console.error(err);
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  };

  const copyPageUrl = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center text-zinc-500 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        <p className="text-xs">Loading article...</p>
      </div>
    );
  }

  if (notFound || !post) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500 mb-4 shadow-xl">
          <BookOpen className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-bold text-white tracking-tight">404 — Article Not Found</h1>
        <p className="text-sm text-zinc-400 max-w-md mt-2 mb-6">
          The requested guide or article may have been unpublished, moved, or deleted.
        </p>
        <button
          onClick={() => onNavigate('/blog')}
          className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs flex items-center gap-2 transition-colors shadow-lg shadow-blue-500/20"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Return to Blog Resources</span>
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      {/* Draft Preview Banner */}
      {isPreview && (
        <div className="bg-amber-500 text-black px-4 py-2.5 text-xs font-bold flex items-center justify-center gap-2 sticky top-0 z-50 shadow-md">
          <AlertTriangle className="w-4 h-4" />
          <span>PREVIEW MODE: This article is currently in draft/review status and is not yet publicly visible.</span>
        </div>
      )}

      {/* Article Header & Breadcrumbs */}
      <div className="border-b border-zinc-800/80 bg-zinc-900/40 py-10 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto space-y-4">
          {/* Breadcrumbs */}
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <button onClick={() => onNavigate('/')} className="hover:text-white transition-colors">
              Home
            </button>
            <ChevronRight className="w-3.5 h-3.5 text-zinc-600" />
            <button onClick={() => onNavigate('/blog')} className="hover:text-white transition-colors">
              Blog
            </button>
            {post.primaryCategory && (
              <>
                <ChevronRight className="w-3.5 h-3.5 text-zinc-600" />
                <button
                  onClick={() => onNavigate(`/blog/category/${post.primaryCategory?.slug}`)}
                  className="hover:text-white transition-colors"
                >
                  {post.primaryCategory.name}
                </button>
              </>
            )}
            <ChevronRight className="w-3.5 h-3.5 text-zinc-600" />
            <span className="text-zinc-500 truncate max-w-xs">{post.title}</span>
          </div>

          {/* Category Badge & Read Time */}
          <div className="flex items-center gap-3 text-xs">
            {post.primaryCategory && (
              <span className="px-2.5 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 font-semibold uppercase tracking-wider text-[10px]">
                {post.primaryCategory.name}
              </span>
            )}
            {post.readTimeMinutes && (
              <span className="text-zinc-400 flex items-center gap-1 text-[11px]">
                <Clock className="w-3 h-3 text-zinc-500" />
                <span>{post.readTimeMinutes} min read</span>
              </span>
            )}
          </div>

          {/* Article Title */}
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-white tracking-tight leading-tight">
            {post.title}
          </h1>

          {/* Excerpt */}
          {post.excerpt && (
            <p className="text-base sm:text-lg text-zinc-300 leading-relaxed max-w-3xl pt-1">
              {post.excerpt}
            </p>
          )}

          {/* Author and Date Meta */}
          <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-zinc-800/80 text-xs text-zinc-400">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 font-bold text-xs">
                {post.authorName ? post.authorName.charAt(0) : 'E'}
              </div>
              <div>
                <p className="font-semibold text-white">{post.authorName || 'Editorial Team'}</p>
                <p className="text-[11px] text-zinc-500">
                  {post.publishedAt
                    ? `Published on ${new Date(post.publishedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`
                    : `Created on ${new Date(post.createdAt).toLocaleDateString()}`}
                </p>
              </div>
            </div>

            {/* Social Share Pills */}
            <div className="flex items-center gap-2">
              <button
                onClick={copyPageUrl}
                className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 transition-colors flex items-center gap-1.5"
                title="Copy Link"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span className="text-[11px] font-medium">{copied ? 'Copied' : 'Share'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Article Body */}
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 py-10 space-y-8">
        {/* Featured Cover Image */}
        {post.featuredMedia?.publicUrl && (
          <figure className="rounded-2xl overflow-hidden border border-zinc-800 bg-zinc-900 shadow-2xl">
            <img
              src={post.featuredMedia.publicUrl}
              alt={post.featuredMedia.altText || post.title}
              className="w-full max-h-[480px] object-cover"
            />
            {post.featuredMedia.caption && (
              <figcaption className="p-3 text-xs text-center text-zinc-400 bg-zinc-950/80 border-t border-zinc-800 italic">
                {post.featuredMedia.caption}
              </figcaption>
            )}
          </figure>
        )}

        {/* Rendered HTML Content */}
        <div
          className="blog-content-body prose prose-invert max-w-none text-zinc-300 leading-relaxed"
          dangerouslySetInnerHTML={{ __html: renderedContentHtml }}
        />

        {/* Tags Section */}
        {post.tags && post.tags.length > 0 && (
          <div className="pt-8 border-t border-zinc-800 flex flex-wrap items-center gap-2">
            <Tag className="w-4 h-4 text-zinc-500 mr-1" />
            <span className="text-xs text-zinc-500 font-semibold uppercase tracking-wider">Tags:</span>
            {post.tags.map((tag) => (
              <button
                key={tag.slug}
                onClick={() => onNavigate(`/blog/tag/${tag.slug}`)}
                className="px-3 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800 text-xs font-mono transition-colors"
              >
                #{tag.name}
              </button>
            ))}
          </div>
        )}

        {/* Back Navigation Bar */}
        <div className="pt-8 border-t border-zinc-800 flex items-center justify-between">
          <button
            onClick={() => onNavigate('/blog')}
            className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-medium border border-zinc-800 flex items-center gap-2 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to All Articles</span>
          </button>

          <button
            onClick={() => onNavigate('/')}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors shadow-lg shadow-blue-500/20"
          >
            Launch Video Downloader
          </button>
        </div>
      </main>
    </div>
  );
};
