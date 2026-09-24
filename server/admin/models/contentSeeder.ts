import { ContentRepository } from './contentRepository.js';
import { ContentPageType, ContentPageStatus } from './contentTypes.js';

interface SeedPageDefinition {
  path: string;
  title: string;
  pageType: ContentPageType;
  status: ContentPageStatus;
  sections: Array<{
    sectionType: 'hero' | 'rich_text' | 'feature_grid' | 'how_to' | 'faq' | 'cta' | 'related_tools';
    sortOrder: number;
    data: any;
    isVisible?: boolean;
  }>;
}

const DEFAULT_PAGES_TO_SEED: SeedPageDefinition[] = [
  {
    path: '/',
    title: 'Universal Social Media Video Downloader',
    pageType: 'LANDING_PAGE',
    status: 'published',
    sections: [
      {
        sectionType: 'hero',
        sortOrder: 1,
        data: {
          eyebrow: 'Universal Downloader',
          heading: 'Social Media Video Downloader',
          description: 'Resolves publicly accessible media URLs into streamable video and audio tracks with direct server-side stream verification.',
          alignment: 'center',
          primaryCta: { label: 'Start Downloading', url: '#downloader' },
        },
      },
      {
        sectionType: 'feature_grid',
        sortOrder: 2,
        data: {
          heading: 'Enterprise Stream Resolution',
          description: 'Direct CDN stream verification with zero watermark insertion.',
          features: [
            {
              title: 'Full Resolution Streams',
              description: 'Preserve original HD, 1080p, and 4K bitrates directly from verified origin servers.',
            },
            {
              title: 'Universal Multi-Platform',
              description: 'Download clips from TikTok, Instagram Reels, Facebook, YouTube Shorts, X/Twitter, and Pinterest.',
            },
            {
              title: 'Secure Verified Media',
              description: 'Strict server-side validation with zero software installation or third-party ads.',
            },
          ],
        },
      },
      {
        sectionType: 'how_to',
        sortOrder: 3,
        data: {
          heading: 'How to Download Media',
          description: 'Simple three-step extraction workflow.',
          steps: [
            {
              stepNumber: 1,
              title: 'Copy Media Link',
              description: 'Copy the video URL from TikTok, Instagram, Facebook, YouTube, X, or Pinterest.',
            },
            {
              stepNumber: 2,
              title: 'Paste & Resolve',
              description: 'Paste the link into the download bar above and click Resolve Media.',
            },
            {
              stepNumber: 3,
              title: 'Save Clean MP4',
              description: 'Select your desired quality format and stream directly to your device.',
            },
          ],
        },
      },
      {
        sectionType: 'faq',
        sortOrder: 4,
        data: {
          heading: 'Frequently Asked Questions',
          description: 'Everything you need to know about our media resolving platform.',
          items: [
            {
              question: 'Is this video downloader free?',
              answer: 'Yes, our online media resolver is completely free with no registration or hidden fees.',
            },
            {
              question: 'Where are downloaded videos saved?',
              answer: 'Files are saved automatically to your device system default Downloads folder.',
            },
            {
              question: 'Does it remove TikTok watermarks?',
              answer: 'Yes, TikTok videos are resolved to the original clean MP4 stream without watermark when available upstream.',
            },
          ],
        },
      },
      {
        sectionType: 'cta',
        sortOrder: 5,
        data: {
          heading: 'Start Downloading Videos in Full HD',
          description: 'Paste any public link into the input bar above to begin extraction.',
          buttonLabel: 'Try Downloader Now',
          buttonUrl: '#downloader',
        },
      },
      {
        sectionType: 'related_tools',
        sortOrder: 6,
        data: {
          heading: 'Related Free Download Tools',
          description: 'Explore our specialized platform downloaders.',
          tools: [
            { route: '/tiktok-video-downloader', label: 'TikTok Downloader' },
            { route: '/instagram-reels-downloader', label: 'Instagram Reels' },
            { route: '/facebook-video-downloader', label: 'Facebook Downloader' },
            { route: '/youtube-shorts-downloader', label: 'YouTube Shorts' },
            { route: '/twitter-video-downloader', label: 'X / Twitter Downloader' },
            { route: '/pinterest-video-downloader', label: 'Pinterest Downloader' },
          ],
        },
      },
    ],
  },
  {
    path: '/tiktok-video-downloader',
    title: 'TikTok Video Downloader',
    pageType: 'TOOL_PAGE',
    status: 'published',
    sections: [
      {
        sectionType: 'hero',
        sortOrder: 1,
        data: {
          eyebrow: 'No Watermark HD',
          heading: 'TikTok Video Downloader',
          description: 'Download TikTok videos without watermark in HD MP4 quality. Fast, free, direct streaming with clean audio tracks.',
          alignment: 'center',
          primaryCta: { label: 'Download TikTok Video', url: '#downloader' },
        },
      },
      {
        sectionType: 'feature_grid',
        sortOrder: 2,
        data: {
          heading: 'TikTok Downloader Features',
          description: 'High-speed media extraction tailored for TikTok short-form clips.',
          features: [
            {
              title: 'No Watermark',
              description: 'Save original videos without TikTok logos or bouncing username watermarks.',
            },
            {
              title: 'HD MP4 Quality',
              description: 'Download the highest resolution stream published by the creator.',
            },
            {
              title: 'Clean Audio Extraction',
              description: 'Direct audio tracks preserved in pristine bitrates.',
            },
          ],
        },
      },
      {
        sectionType: 'how_to',
        sortOrder: 3,
        data: {
          heading: 'How to Download TikTok Videos',
          description: 'Save your favorite TikTok clips in three fast steps.',
          steps: [
            {
              stepNumber: 1,
              title: 'Copy TikTok Link',
              description: 'Open TikTok, tap Share on any video, and select Copy Link.',
            },
            {
              stepNumber: 2,
              title: 'Paste URL',
              description: 'Paste the link into our downloader field above and hit Resolve Media.',
            },
            {
              stepNumber: 3,
              title: 'Download MP4',
              description: 'Choose the No Watermark MP4 option to download directly to your device.',
            },
          ],
        },
      },
      {
        sectionType: 'faq',
        sortOrder: 4,
        data: {
          heading: 'TikTok Downloader FAQs',
          description: 'Common questions about downloading TikTok videos.',
          items: [
            {
              question: 'Do I need a TikTok account to download?',
              answer: 'No, you only need the public link of the video.',
            },
            {
              question: 'Does it work on iPhone and Android?',
              answer: 'Yes, it works smoothly in mobile Safari, Chrome, and desktop browsers.',
            },
          ],
        },
      },
      {
        sectionType: 'cta',
        sortOrder: 5,
        data: {
          heading: 'Ready to Save TikTok Videos?',
          description: 'Paste a link above and download your favorite TikToks instantly.',
          buttonLabel: 'Download TikTok MP4',
          buttonUrl: '#downloader',
        },
      },
      {
        sectionType: 'related_tools',
        sortOrder: 6,
        data: {
          heading: 'Related Downloader Tools',
          tools: [
            { route: '/instagram-reels-downloader', label: 'Instagram Reels' },
            { route: '/youtube-shorts-downloader', label: 'YouTube Shorts' },
            { route: '/facebook-video-downloader', label: 'Facebook Downloader' },
          ],
        },
      },
    ],
  },
  {
    path: '/instagram-reels-downloader',
    title: 'Instagram Reels Downloader',
    pageType: 'TOOL_PAGE',
    status: 'published',
    sections: [
      {
        sectionType: 'hero',
        sortOrder: 1,
        data: {
          eyebrow: 'HD Reels & Videos',
          heading: 'Instagram Reels Downloader',
          description: 'Free online Instagram Reels Downloader. Download public Instagram Reels and videos in high definition MP4 format with audio.',
          alignment: 'center',
          primaryCta: { label: 'Download Instagram Reel', url: '#downloader' },
        },
      },
      {
        sectionType: 'feature_grid',
        sortOrder: 2,
        data: {
          heading: 'Instagram Extraction Engine',
          description: 'Built for high fidelity Instagram Reels and video post downloads.',
          features: [
            {
              title: 'Full HD 1080p',
              description: 'Preserves the highest quality video bitrate available on Instagram.',
            },
            {
              title: 'Reels & Carousel Support',
              description: 'Resolves standalone Reels and video posts seamlessly.',
            },
            {
              title: 'Zero Account Login',
              description: 'Download public videos safely without entering Instagram credentials.',
            },
          ],
        },
      },
      {
        sectionType: 'how_to',
        sortOrder: 3,
        data: {
          heading: 'How to Download Instagram Reels',
          description: 'Follow these steps to save Instagram Reels to your gallery.',
          steps: [
            {
              stepNumber: 1,
              title: 'Copy Reels URL',
              description: 'Tap the three dots on the Instagram Reel and tap Link.',
            },
            {
              stepNumber: 2,
              title: 'Paste into Downloader',
              description: 'Paste the link above and click Resolve Media.',
            },
            {
              stepNumber: 3,
              title: 'Download File',
              description: 'Click Download MP4 to save the video directly.',
            },
          ],
        },
      },
      {
        sectionType: 'faq',
        sortOrder: 4,
        data: {
          heading: 'Instagram Downloader FAQs',
          description: 'Answers to frequent questions.',
          items: [
            {
              question: 'Can I download private Instagram Reels?',
              answer: 'Only publicly accessible Reels and posts can be processed by our server.',
            },
          ],
        },
      },
      {
        sectionType: 'cta',
        sortOrder: 5,
        data: {
          heading: 'Download Instagram Reels Now',
          description: 'High-speed MP4 downloads for all public Instagram videos.',
          buttonLabel: 'Try It Now',
          buttonUrl: '#downloader',
        },
      },
      {
        sectionType: 'related_tools',
        sortOrder: 6,
        data: {
          heading: 'Explore Other Tools',
          tools: [
            { route: '/tiktok-video-downloader', label: 'TikTok Downloader' },
            { route: '/facebook-video-downloader', label: 'Facebook Downloader' },
          ],
        },
      },
    ],
  },
  {
    path: '/facebook-video-downloader',
    title: 'Facebook Video Downloader',
    pageType: 'TOOL_PAGE',
    status: 'published',
    sections: [
      {
        sectionType: 'hero',
        sortOrder: 1,
        data: {
          eyebrow: 'Reels & Watch HD',
          heading: 'Facebook Video Downloader',
          description: 'Download Facebook Reels and public Watch videos in high quality MP4 format. Free, safe, and direct streaming.',
          alignment: 'center',
          primaryCta: { label: 'Download Facebook Video', url: '#downloader' },
        },
      },
      {
        sectionType: 'feature_grid',
        sortOrder: 2,
        data: {
          heading: 'Facebook Downloader Highlights',
          description: 'Supports Watch clips, timeline videos, and Facebook Reels.',
          features: [
            {
              title: 'HD & SD Options',
              description: 'Select between crisp 1080p/720p HD and data-saving SD formats.',
            },
            {
              title: 'Facebook Reels Supported',
              description: 'Full compatibility with modern Facebook mobile Reels.',
            },
            {
              title: 'Private Safe Proxy',
              description: 'Server-side verified streams with zero user logging.',
            },
          ],
        },
      },
      {
        sectionType: 'how_to',
        sortOrder: 3,
        data: {
          heading: 'How to Download Facebook Videos',
          description: 'Get your video in three easy steps.',
          steps: [
            {
              stepNumber: 1,
              title: 'Copy Post Link',
              description: 'Click Share below the Facebook video and choose Copy Link.',
            },
            {
              stepNumber: 2,
              title: 'Paste Above',
              description: 'Enter the link in the input form above.',
            },
            {
              stepNumber: 3,
              title: 'Stream to Storage',
              description: 'Select your preferred resolution and save the MP4.',
            },
          ],
        },
      },
      {
        sectionType: 'faq',
        sortOrder: 4,
        data: {
          heading: 'Facebook Downloader FAQs',
          description: 'Frequently asked questions.',
          items: [
            {
              question: 'Are Facebook Watch videos supported?',
              answer: 'Yes, public Facebook Watch and Reels links are fully supported.',
            },
          ],
        },
      },
      {
        sectionType: 'cta',
        sortOrder: 5,
        data: {
          heading: 'Save Facebook Videos Now',
          description: 'Fast, secure, and always free.',
          buttonLabel: 'Download Facebook MP4',
          buttonUrl: '#downloader',
        },
      },
      {
        sectionType: 'related_tools',
        sortOrder: 6,
        data: {
          heading: 'Other Downloaders',
          tools: [
            { route: '/youtube-shorts-downloader', label: 'YouTube Shorts' },
            { route: '/instagram-reels-downloader', label: 'Instagram Reels' },
          ],
        },
      },
    ],
  },
  {
    path: '/youtube-shorts-downloader',
    title: 'YouTube Shorts Downloader',
    pageType: 'TOOL_PAGE',
    status: 'published',
    sections: [
      {
        sectionType: 'hero',
        sortOrder: 1,
        data: {
          eyebrow: 'Fast & Free',
          heading: 'YouTube Shorts Downloader',
          description: 'Download YouTube Shorts and videos in full 1080p/720p HD MP4 and MP3 audio with direct streaming.',
          alignment: 'center',
          primaryCta: { label: 'Download YouTube Short', url: '#downloader' },
        },
      },
      {
        sectionType: 'feature_grid',
        sortOrder: 2,
        data: {
          heading: 'YouTube Shorts Capabilities',
          description: 'Optimized stream processing for short-form clips.',
          features: [
            {
              title: '1080p & 720p HD',
              description: 'Download crystal-clear high-definition vertical video.',
            },
            {
              title: 'Audio Track Extraction',
              description: 'Download the audio stream directly for background playback.',
            },
            {
              title: 'Fast Processing',
              description: 'Rapid stream resolution without lengthy transcoding queues.',
            },
          ],
        },
      },
      {
        sectionType: 'how_to',
        sortOrder: 3,
        data: {
          heading: 'How to Download YouTube Shorts',
          description: 'Save clips in seconds.',
          steps: [
            {
              stepNumber: 1,
              title: 'Copy Shorts URL',
              description: 'Tap Share on the YouTube Short and select Copy Link.',
            },
            {
              stepNumber: 2,
              title: 'Paste URL',
              description: 'Paste into the download engine bar above.',
            },
            {
              stepNumber: 3,
              title: 'Save Video',
              description: 'Select your preferred quality and save to device.',
            },
          ],
        },
      },
      {
        sectionType: 'faq',
        sortOrder: 4,
        data: {
          heading: 'YouTube Shorts FAQs',
          description: 'Common questions and answers.',
          items: [
            {
              question: 'Can I download long YouTube videos?',
              answer: 'Our engine is optimized for Shorts and clips under 15 minutes.',
            },
          ],
        },
      },
      {
        sectionType: 'cta',
        sortOrder: 5,
        data: {
          heading: 'Download YouTube Shorts Fast',
          description: 'Direct high-definition MP4 downloads.',
          buttonLabel: 'Try Downloader Now',
          buttonUrl: '#downloader',
        },
      },
      {
        sectionType: 'related_tools',
        sortOrder: 6,
        data: {
          heading: 'Related Tools',
          tools: [
            { route: '/tiktok-video-downloader', label: 'TikTok Downloader' },
            { route: '/twitter-video-downloader', label: 'X / Twitter Downloader' },
          ],
        },
      },
    ],
  },
  {
    path: '/twitter-video-downloader',
    title: 'X / Twitter Video Downloader',
    pageType: 'TOOL_PAGE',
    status: 'published',
    sections: [
      {
        sectionType: 'hero',
        sortOrder: 1,
        data: {
          eyebrow: 'HD MP4 & GIFs',
          heading: 'X / Twitter Video Downloader',
          description: 'Download videos and animated GIFs from X (Twitter) in multiple MP4 resolutions with direct stream links.',
          alignment: 'center',
          primaryCta: { label: 'Download X Video', url: '#downloader' },
        },
      },
      {
        sectionType: 'feature_grid',
        sortOrder: 2,
        data: {
          heading: 'X / Twitter Downloader Features',
          description: 'Fast resolution of video media embedded in tweets and posts.',
          features: [
            {
              title: 'Multiple Resolutions',
              description: 'Select from 1080p, 720p, 480p, or 360p MP4 bitrates.',
            },
            {
              title: 'Animated GIF Conversion',
              description: 'Save looping Twitter GIFs as lightweight MP4 video clips.',
            },
            {
              title: 'Direct CDN Links',
              description: 'High-speed downloads directly from verified Twitter media CDNs.',
            },
          ],
        },
      },
      {
        sectionType: 'how_to',
        sortOrder: 3,
        data: {
          heading: 'How to Download X / Twitter Videos',
          description: 'Simple three-step extraction.',
          steps: [
            {
              stepNumber: 1,
              title: 'Copy Post URL',
              description: 'Tap the share icon on the tweet and select Copy Link.',
            },
            {
              stepNumber: 2,
              title: 'Paste Link',
              description: 'Paste into the download input above.',
            },
            {
              stepNumber: 3,
              title: 'Save MP4',
              description: 'Choose your desired resolution and download.',
            },
          ],
        },
      },
      {
        sectionType: 'faq',
        sortOrder: 4,
        data: {
          heading: 'X / Twitter FAQs',
          description: 'Frequently asked questions.',
          items: [
            {
              question: 'Can I download videos from private accounts?',
              answer: 'Only posts and media from public accounts can be resolved.',
            },
          ],
        },
      },
      {
        sectionType: 'cta',
        sortOrder: 5,
        data: {
          heading: 'Download X / Twitter Videos Instantly',
          description: 'Save video tweets and GIFs to your camera roll or desktop.',
          buttonLabel: 'Try Downloader',
          buttonUrl: '#downloader',
        },
      },
      {
        sectionType: 'related_tools',
        sortOrder: 6,
        data: {
          heading: 'Related Downloaders',
          tools: [
            { route: '/pinterest-video-downloader', label: 'Pinterest Downloader' },
            { route: '/tiktok-video-downloader', label: 'TikTok Downloader' },
          ],
        },
      },
    ],
  },
  {
    path: '/pinterest-video-downloader',
    title: 'Pinterest Video Downloader',
    pageType: 'TOOL_PAGE',
    status: 'published',
    sections: [
      {
        sectionType: 'hero',
        sortOrder: 1,
        data: {
          eyebrow: 'Pins & Idea Pins',
          heading: 'Pinterest Video Downloader',
          description: 'Free online Pinterest Video Downloader. Download high quality Pinterest MP4 videos and Idea Pins in HD without registration.',
          alignment: 'center',
          primaryCta: { label: 'Download Pinterest Video', url: '#downloader' },
        },
      },
      {
        sectionType: 'feature_grid',
        sortOrder: 2,
        data: {
          heading: 'Pinterest Downloader Highlights',
          description: 'Direct MP4 stream extraction from Pinterest video pins.',
          features: [
            {
              title: 'HD Quality Streams',
              description: 'Download full 720p/1080p MP4 videos directly from Pinterest.',
            },
            {
              title: 'Idea Pins Supported',
              description: 'Resolves both classic video pins and modern Idea Pins.',
            },
            {
              title: 'No App Required',
              description: 'Works 100% online through your browser on mobile and desktop.',
            },
          ],
        },
      },
      {
        sectionType: 'how_to',
        sortOrder: 3,
        data: {
          heading: 'How to Download Pinterest Videos',
          description: 'Download pins in three easy steps.',
          steps: [
            {
              stepNumber: 1,
              title: 'Copy Pin Link',
              description: 'Click Share on the Pinterest Pin and choose Copy Link.',
            },
            {
              stepNumber: 2,
              title: 'Paste Above',
              description: 'Paste the link into the download bar above and resolve.',
            },
            {
              stepNumber: 3,
              title: 'Download MP4',
              description: 'Click the Download button to save the MP4 video.',
            },
          ],
        },
      },
      {
        sectionType: 'faq',
        sortOrder: 4,
        data: {
          heading: 'Pinterest Downloader FAQs',
          description: 'Common questions about Pinterest downloads.',
          items: [
            {
              question: 'Is this Pinterest downloader free?',
              answer: 'Yes, downloading Pinterest videos and Idea Pins is completely free.',
            },
          ],
        },
      },
      {
        sectionType: 'cta',
        sortOrder: 5,
        data: {
          heading: 'Start Downloading Pinterest Videos',
          description: 'Save any public Pinterest video pin in HD quality.',
          buttonLabel: 'Download Pinterest MP4',
          buttonUrl: '#downloader',
        },
      },
      {
        sectionType: 'related_tools',
        sortOrder: 6,
        data: {
          heading: 'Related Downloaders',
          tools: [
            { route: '/tiktok-video-downloader', label: 'TikTok Downloader' },
            { route: '/instagram-reels-downloader', label: 'Instagram Reels' },
          ],
        },
      },
    ],
  },
];

export class ContentSeeder {
  /**
   * Seeds the default 7 core landing pages into SQLite if not already existing
   */
  static seedDefaultPages(): void {
    for (const def of DEFAULT_PAGES_TO_SEED) {
      const existing = ContentRepository.getPageByPath(def.path);
      if (!existing) {
        const createdPage = ContentRepository.createPage({
          path: def.path,
          title: def.title,
          pageType: def.pageType,
          status: def.status,
        });

        ContentRepository.setSections(createdPage.id, def.sections);
      } else {
        if (existing.status !== def.status) {
          ContentRepository.updatePage(existing.id, { status: def.status });
        }
        const currentSections = ContentRepository.getPageSections(existing.id);
        if (currentSections.length === 0) {
          ContentRepository.setSections(existing.id, def.sections);
        }
      }
    }
  }
}
