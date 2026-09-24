import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  Calendar,
  Clock,
  ArrowRight,
  Search,
  Tag,
  FolderTree,
  Loader2,
  ChevronRight,
  Sparkles,
} from 'lucide-react';

interface BlogPostListItem {
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
  featuredMedia?: { publicUrl: string; altText: string | null } | null;
  readTimeMinutes?: number;
}

interface BlogCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
}

interface BlogTag {
  id: string;
  name: string;
  slug: string;
}

interface BlogListViewProps {
  currentPath: string;
  categoryFilter?: string;
  tagFilter?: string;
  onNavigate: (path: string) => void;
}

export const BlogListView: React.FC<BlogListViewProps> = ({
  currentPath,
  categoryFilter,
  tagFilter,
  onNavigate,
}) => {
  const [posts, setPosts] = useState<BlogPostListItem[]>([]);
  const [categories, setCategories] = useState<BlogCategory[]>([]);
  const [tags, setTags] = useState<BlogTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchBlogData();
  }, [categoryFilter, tagFilter, search]);

  const fetchBlogData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (categoryFilter) params.set('category', categoryFilter);
      if (tagFilter) params.set('tag', tagFilter);
      if (search) params.set('search', search);

      const [postsRes, catRes, tagRes] = await Promise.all([
        fetch(`/api/blog/posts?${params.toString()}`),
        fetch('/api/blog/categories'),
        fetch('/api/blog/tags'),
      ]);

      const postsData = await postsRes.json();
      const catData = await catRes.json();
      const tagData = await tagRes.json();

      if (postsData.success) setPosts(postsData.posts || []);
      if (catData.success) setCategories(catData.categories || []);
      if (tagData.success) setTags(tagData.tags || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const activeCategory = categories.find((c) => c.slug === categoryFilter);
  const activeTag = tags.find((t) => t.slug === tagFilter);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      {/* Header Banner */}
      <div className="border-b border-zinc-800 bg-zinc-900/50 py-12 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto space-y-4">
          {/* Breadcrumbs */}
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <button onClick={() => onNavigate('/')} className="hover:text-white transition-colors">
              Home
            </button>
            <ChevronRight className="w-3.5 h-3.5 text-zinc-600" />
            <button
              onClick={() => onNavigate('/blog')}
              className={`${!categoryFilter && !tagFilter ? 'text-blue-400 font-medium' : 'hover:text-white'}`}
            >
              Blog
            </button>
            {activeCategory && (
              <>
                <ChevronRight className="w-3.5 h-3.5 text-zinc-600" />
                <span className="text-blue-400 font-medium">{activeCategory.name}</span>
              </>
            )}
            {activeTag && (
              <>
                <ChevronRight className="w-3.5 h-3.5 text-zinc-600" />
                <span className="text-blue-400 font-medium">#{activeTag.name}</span>
              </>
            )}
          </div>

          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold uppercase tracking-wider mb-2">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Resources & Tutorials</span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                {activeCategory
                  ? `${activeCategory.name} Guides`
                  : activeTag
                  ? `Articles Tagged #${activeTag.name}`
                  : 'Official Video Downloader Blog'}
              </h1>
              <p className="text-sm text-zinc-400 max-w-2xl mt-2">
                {activeCategory?.description ||
                  'Learn how to download high definition videos from TikTok, Instagram Reels, YouTube Shorts, and Facebook without watermarks.'}
              </p>
            </div>

            {/* Search Input */}
            <div className="relative w-full md:w-72">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                type="text"
                placeholder="Search articles..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 py-8 space-y-8">
        {/* Categories Bar */}
        <div className="flex flex-wrap items-center gap-2 pb-4 border-b border-zinc-800/80">
          <button
            onClick={() => onNavigate('/blog')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-medium transition-colors ${
              !categoryFilter && !tagFilter
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-zinc-900 text-zinc-400 hover:text-white hover:bg-zinc-800'
            }`}
          >
            All Articles
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => onNavigate(`/blog/category/${cat.slug}`)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-medium transition-colors ${
                categoryFilter === cat.slug
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-zinc-900 text-zinc-400 hover:text-white hover:bg-zinc-800'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Articles Grid */}
        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 text-zinc-500 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            <p className="text-xs">Loading articles...</p>
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-16 bg-zinc-900/40 border border-zinc-800 rounded-2xl p-8">
            <BookOpen className="w-12 h-12 mx-auto text-zinc-600 mb-3 stroke-[1.2]" />
            <h3 className="text-base font-bold text-white">No articles found</h3>
            <p className="text-xs text-zinc-400 mt-1 max-w-md mx-auto">
              We couldn't find any published articles matching your current search or category filter.
            </p>
            {(categoryFilter || tagFilter || search) && (
              <button
                onClick={() => onNavigate('/blog')}
                className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-medium"
              >
                Clear Filters
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {posts.map((post) => (
              <article
                key={post.id}
                onClick={() => onNavigate(`/blog/${post.slug}`)}
                className="group bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-2xl overflow-hidden flex flex-col transition-all cursor-pointer hover:shadow-xl hover:-translate-y-0.5"
              >
                {/* Featured Image */}
                {post.featuredMedia?.publicUrl ? (
                  <div className="aspect-[16/9] w-full overflow-hidden bg-zinc-950">
                    <img
                      src={post.featuredMedia.publicUrl}
                      alt={post.featuredMedia.altText || post.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />
                  </div>
                ) : (
                  <div className="aspect-[16/9] w-full bg-gradient-to-tr from-blue-950/40 via-zinc-900 to-indigo-950/40 flex items-center justify-center p-6 border-b border-zinc-800/60">
                    <BookOpen className="w-10 h-10 text-blue-500/40" />
                  </div>
                )}

                <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                  <div className="space-y-2.5">
                    {/* Category & Read Time */}
                    <div className="flex items-center justify-between text-[11px] text-zinc-400 font-medium">
                      {post.primaryCategory ? (
                        <span className="text-blue-400 uppercase tracking-wider font-semibold">
                          {post.primaryCategory.name}
                        </span>
                      ) : (
                        <span className="text-zinc-500 uppercase tracking-wider">Guide</span>
                      )}
                      {post.readTimeMinutes && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-zinc-500" />
                          <span>{post.readTimeMinutes} min read</span>
                        </span>
                      )}
                    </div>

                    {/* Title */}
                    <h2 className="text-base font-bold text-white group-hover:text-blue-400 transition-colors leading-snug">
                      {post.title}
                    </h2>

                    {/* Excerpt */}
                    {post.excerpt && (
                      <p className="text-xs text-zinc-400 line-clamp-3 leading-relaxed">
                        {post.excerpt}
                      </p>
                    )}
                  </div>

                  {/* Footer Meta */}
                  <div className="pt-3 border-t border-zinc-800/80 flex items-center justify-between text-[11px] text-zinc-400">
                    <span>{post.publishedAt ? new Date(post.publishedAt).toLocaleDateString() : 'Recent'}</span>
                    <span className="text-blue-400 font-medium flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                      <span>Read Guide</span>
                      <ArrowRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}

        {/* Popular Tags Section */}
        {tags.length > 0 && (
          <div className="pt-8 border-t border-zinc-800">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3 flex items-center gap-2">
              <Tag className="w-3.5 h-3.5" />
              <span>Explore Topics & Tags</span>
            </h3>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <button
                  key={tag.id}
                  onClick={() => onNavigate(`/blog/tag/${tag.slug}`)}
                  className={`px-3 py-1 rounded-lg text-xs font-mono transition-colors ${
                    tagFilter === tag.slug
                      ? 'bg-blue-600 text-white'
                      : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800'
                  }`}
                >
                  #{tag.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
