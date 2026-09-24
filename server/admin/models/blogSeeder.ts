/**
 * Blog Content Seeder for Phase 8.4
 * Seeds default production categories, tags, and rich guides with internal linking to downloader tools.
 */

import { BlogRepository } from './blogRepository.js';
import { BlogService } from '../services/blogService.js';
import { StructuredDocument } from './blogDocumentTypes.js';

export class BlogSeeder {
  public static seedDefaultBlogData(): void {
    // 1. Seed Categories
    const categoriesToSeed = [
      { name: 'Guides & Tutorials', slug: 'guides-tutorials', description: 'Step-by-step guides on downloading and saving HD social media videos.' },
      { name: 'Video Formats & Quality', slug: 'formats-quality', description: 'Understanding MP4, MP3, 1080p, 4K video resolution and encoding.' },
      { name: 'Platform Tips', slug: 'platform-tips', description: 'Tips and tricks for TikTok, Instagram Reels, YouTube Shorts, and X/Twitter.' },
      { name: 'Creator Resources', slug: 'creator-resources', description: 'Best practices for content creators, repurposing clips, and video editing.' },
    ];

    const categoryMap = new Map<string, string>();
    for (const cat of categoriesToSeed) {
      let existing = BlogRepository.getCategoryBySlug(cat.slug);
      if (!existing) {
        existing = BlogRepository.createCategory(cat.name, cat.slug, cat.description);
      }
      categoryMap.set(cat.slug, existing.id);
    }

    // 2. Seed Tags
    const tagsToSeed = [
      { name: 'TikTok', slug: 'tiktok' },
      { name: 'Instagram', slug: 'instagram' },
      { name: 'YouTube Shorts', slug: 'youtube-shorts' },
      { name: 'Facebook', slug: 'facebook' },
      { name: 'X / Twitter', slug: 'twitter' },
      { name: 'Pinterest', slug: 'pinterest' },
      { name: 'HD Video', slug: 'hd-video' },
      { name: 'No Watermark', slug: 'no-watermark' },
      { name: 'MP4 Download', slug: 'mp4-download' },
    ];

    const tagMap = new Map<string, string>();
    for (const tag of tagsToSeed) {
      let existing = BlogRepository.getTagBySlug(tag.slug);
      if (!existing) {
        existing = BlogRepository.createTag(tag.name, tag.slug);
      }
      tagMap.set(tag.slug, existing.id);
    }

    // 3. Seed Production Articles if none exist
    const existingPosts = BlogRepository.listPosts({ limit: 1 });
    if (existingPosts.total === 0) {
      const articles = [
        {
          title: 'How to Download TikTok Videos Without Watermark in HD (2026 Guide)',
          slug: 'how-to-download-tiktok-videos-without-watermark-hd',
          excerpt: 'Complete tutorial on extracting crystal-clear 1080p TikTok videos without logo watermarks for backup, editing, and offline watching.',
          categorySlug: 'guides-tutorials',
          tags: ['tiktok', 'no-watermark', 'hd-video'],
          contentDocument: {
            version: 1,
            type: 'doc',
            children: [
              {
                type: 'paragraph',
                text: 'TikTok is home to millions of viral dance videos, cooking recipes, educational breakdowns, and comedy sketches. However, saving a video directly from the app often leaves an intrusive moving watermark that covers key parts of the screen.',
              },
              {
                type: 'heading',
                level: 2,
                text: 'Why Download TikTok Videos Without Watermark?',
              },
              {
                type: 'paragraph',
                text: 'Whether you are an editor looking to repurpose your own content across platforms, or an archivist preserving your favorite creators, clean high-definition MP4 files without overlays give you the ultimate viewing and editing freedom.',
              },
              {
                type: 'callout',
                variant: 'tip',
                text: 'Quick Tool: You can instantly grab any video using our dedicated ',
                children: [
                  {
                    type: 'paragraph',
                    text: 'Quick Tool: Try our fast and free ',
                    marks: [],
                    children: [
                      {
                        type: 'paragraph',
                        text: 'TikTok Video Downloader',
                        marks: [{ type: 'bold' }, { type: 'link', href: '/tiktok-video-downloader' }],
                      },
                      {
                        type: 'paragraph',
                        text: ' to extract full 1080p clips directly in your browser.',
                      },
                    ],
                  },
                ],
              },
              {
                type: 'heading',
                level: 2,
                text: 'Step-by-Step Guide to Saving TikTok Clips',
              },
              {
                type: 'list',
                ordered: true,
                children: [
                  { type: 'listItem', text: 'Open the TikTok mobile app or desktop website and navigate to the video.' },
                  { type: 'listItem', text: 'Tap the Share button and click "Copy Link".' },
                  { type: 'listItem', text: 'Paste the copied URL into our downloader search bar.' },
                  { type: 'listItem', text: 'Select "Download HD (No Watermark)" to save the MP4 file to your device.' },
                ],
              },
              {
                type: 'heading',
                level: 2,
                text: 'Best Practices for Content Repurposing',
              },
              {
                type: 'paragraph',
                text: 'When reposting short videos to Instagram Reels or YouTube Shorts, algorithms favor clean media without third-party platform badges. Always ensure you have rights or permission before sharing content from other creators.',
              },
            ],
          } as StructuredDocument,
        },
        {
          title: 'Instagram Reels Downloader: Save Audio, Videos & Stories in 1080p',
          slug: 'instagram-reels-downloader-save-audio-video-1080p',
          excerpt: 'Learn how to easily save high-resolution Instagram Reels and Stories directly to your camera roll or PC with original audio preserved.',
          categorySlug: 'platform-tips',
          tags: ['instagram', 'hd-video', 'mp4-download'],
          contentDocument: {
            version: 1,
            type: 'doc',
            children: [
              {
                type: 'paragraph',
                text: 'Instagram Reels have become the primary way people share short-form video stories, creative transitions, and trending audio. Saving these clips locally ensures you never lose inspiring ideas or memorable moments.',
              },
              {
                type: 'heading',
                level: 2,
                text: 'Preserving Maximum Visual and Audio Fidelity',
              },
              {
                type: 'paragraph',
                text: 'Instagram compresses uploads depending on network conditions. Our engine bypasses client-side compression to fetch the original high-bitrate stream uploaded by the creator.',
              },
              {
                type: 'callout',
                variant: 'info',
                text: 'Instant Access: Check out our ',
                children: [
                  {
                    type: 'paragraph',
                    text: 'Explore our ',
                    children: [
                      {
                        type: 'paragraph',
                        text: 'Instagram Reels Downloader',
                        marks: [{ type: 'bold' }, { type: 'link', href: '/instagram-reels-downloader' }],
                      },
                      {
                        type: 'paragraph',
                        text: ' to save high-quality MP4 reels with zero software installation required.',
                      },
                    ],
                  },
                ],
              },
              {
                type: 'heading',
                level: 2,
                text: 'Comparing Video Formats: MP4 vs Other Codecs',
              },
              {
                type: 'table',
                children: [
                  {
                    type: 'tableRow',
                    children: [
                      { type: 'tableCell', text: 'Format' },
                      { type: 'tableCell', text: 'Compatibility' },
                      { type: 'tableCell', text: 'Audio Codec' },
                      { type: 'tableCell', text: 'Recommended For' },
                    ],
                  },
                  {
                    type: 'tableRow',
                    children: [
                      { type: 'tableCell', text: 'MP4 (H.264)' },
                      { type: 'tableCell', text: 'Universal (iOS, Android, Windows, Mac)' },
                      { type: 'tableCell', text: 'AAC Stereo' },
                      { type: 'tableCell', text: 'General playback & social sharing' },
                    ],
                  },
                  {
                    type: 'tableRow',
                    children: [
                      { type: 'tableCell', text: 'WebM (VP9)' },
                      { type: 'tableCell', text: 'Modern Browsers / Chrome' },
                      { type: 'tableCell', text: 'Opus' },
                      { type: 'tableCell', text: 'Web embedding & high compression' },
                    ],
                  },
                ],
              },
            ],
          } as StructuredDocument,
        },
        {
          title: 'The Ultimate Guide to YouTube Shorts Downloading & Audio Extraction',
          slug: 'ultimate-guide-youtube-shorts-download-audio-extraction',
          excerpt: 'Detailed tutorial on saving YouTube Shorts in Full HD 1080p and extracting MP3 background audio effortlessly.',
          categorySlug: 'formats-quality',
          tags: ['youtube-shorts', 'hd-video', 'mp4-download'],
          contentDocument: {
            version: 1,
            type: 'doc',
            children: [
              {
                type: 'paragraph',
                text: 'YouTube Shorts offers incredible variety, from quick programming tutorials to music clips and travel vlogs. Knowing how to download these videos directly gives you offline access whenever you need it.',
              },
              {
                type: 'heading',
                level: 2,
                text: 'High-Bitrate Audio & Video Streams',
              },
              {
                type: 'paragraph',
                text: 'Unlike standard social clips, YouTube streams video and audio in adaptive chunks. Our server-side processing stitches video and audio tracks seamlessly into a single standalone MP4 container.',
              },
              {
                type: 'callout',
                variant: 'success',
                text: 'Ready to download? Use our ',
                children: [
                  {
                    type: 'paragraph',
                    text: 'Try our official ',
                    children: [
                      {
                        type: 'paragraph',
                        text: 'YouTube Shorts Downloader',
                        marks: [{ type: 'bold' }, { type: 'link', href: '/youtube-shorts-downloader' }],
                      },
                      {
                        type: 'paragraph',
                        text: ' for ultra-fast downloads on any device.',
                      },
                    ],
                  },
                ],
              },
            ],
          } as StructuredDocument,
        },
      ];

      for (const item of articles) {
        const primaryCatId = categoryMap.get(item.categorySlug) || null;
        const tagIds = item.tags.map((t) => tagMap.get(t)).filter(Boolean) as string[];

        BlogService.createPost({
          title: item.title,
          slug: item.slug,
          excerpt: item.excerpt,
          contentDocument: item.contentDocument,
          primaryCategoryId: primaryCatId,
          categoryIds: primaryCatId ? [primaryCatId] : [],
          tagIds,
          status: 'published',
        });
      }
    }
  }
}
