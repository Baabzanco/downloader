import { getDatabase } from '../db/database.js';
import { AdminRepository } from './models/adminRepository.js';
import { SeoRepository } from './models/seoRepository.js';
import { ContentRepository } from './models/contentRepository.js';
import { DEFAULT_PUBLIC_ROUTES } from './services/seoService.js';
import { AuthService } from './auth/authService.js';
import { AuditService } from './services/auditService.js';
import crypto from 'crypto';

export interface PermissionDefinition {
  key: string;
  category: string;
  description: string;
}

export const SYSTEM_PERMISSIONS: PermissionDefinition[] = [
  // Dashboard
  { key: 'dashboard.read', category: 'Dashboard', description: 'Access administrative overview and telemetry' },

  // Admin Management
  { key: 'admin.users.read', category: 'Administration', description: 'View administrator accounts and profiles' },
  { key: 'admin.users.write', category: 'Administration', description: 'Create, update, and deactivate administrator accounts' },
  { key: 'admin.roles.read', category: 'Administration', description: 'View roles and granular permissions' },
  { key: 'admin.roles.write', category: 'Administration', description: 'Create and customize administrative roles' },

  // Settings
  { key: 'settings.read', category: 'Settings', description: 'View system and application configuration' },
  { key: 'settings.write', category: 'Settings', description: 'Modify system and application settings' },

  // SEO (Phase 8.2 Technical SEO & CMS)
  { key: 'seo.pages.read', category: 'SEO', description: 'View landing pages and SEO configurations' },
  { key: 'seo.pages.write', category: 'SEO', description: 'Create and update SEO pages and metadata' },
  { key: 'seo.schema.read', category: 'SEO', description: 'View Schema.org structured data configurations' },
  { key: 'seo.schema.write', category: 'SEO', description: 'Modify Schema.org JSON-LD definitions' },
  { key: 'seo.redirects.read', category: 'SEO', description: 'View SEO URL redirects' },
  { key: 'seo.redirects.write', category: 'SEO', description: 'Create and modify URL redirects' },
  { key: 'seo.settings.read', category: 'SEO', description: 'View technical SEO settings' },
  { key: 'seo.settings.write', category: 'SEO', description: 'Update technical SEO settings' },
  { key: 'seo.health.read', category: 'SEO', description: 'Run and view technical SEO health audits' },

  // Content (Phase 8.3)
  { key: 'content.pages.read', category: 'Content', description: 'View content and static pages' },
  { key: 'content.pages.write', category: 'Content', description: 'Create and modify content pages' },
  { key: 'content.pages.publish', category: 'Content', description: 'Publish and unpublish content pages' },
  { key: 'content.pages.delete', category: 'Content', description: 'Delete content pages' },

  // Blog (Phase 8.4 Blog CMS)
  { key: 'blog.posts.read', category: 'Blog', description: 'View blog articles, drafts, and categories' },
  { key: 'blog.posts.write', category: 'Blog', description: 'Draft and edit blog articles' },
  { key: 'blog.posts.publish', category: 'Blog', description: 'Publish and schedule blog articles' },
  { key: 'blog.posts.delete', category: 'Blog', description: 'Delete and archive blog articles' },
  { key: 'blog.revisions.restore', category: 'Blog', description: 'Restore previous article revisions' },
  { key: 'blog.taxonomy.manage', category: 'Blog', description: 'Create and edit categories and tags' },

  // Media (Phase 8.4 Media Library)
  { key: 'media.read', category: 'Media', description: 'Browse uploaded media assets' },
  { key: 'media.write', category: 'Media', description: 'Upload and organize media assets' },
  { key: 'media.delete', category: 'Media', description: 'Delete media library assets' },

  // Analytics & Monitoring (Phase 8.5 Foundation)
  { key: 'analytics.read', category: 'Analytics', description: 'View traffic, resolution, and conversion metrics' },
  { key: 'providers.read', category: 'Downloader', description: 'View downloader providers operational status' },
  { key: 'providers.manage', category: 'Downloader', description: 'Toggle and configure media extraction providers' },

  // Security & Audit
  { key: 'security.logs.read', category: 'Security', description: 'Inspect security events and rate-limit blocks' },
  { key: 'audit.read', category: 'Security', description: 'Access immutable administrative audit log records' },
];

export const SYSTEM_ROLES: Array<{
  name: string;
  description: string;
  permissions: string[];
}> = [
  {
    name: 'SUPER_ADMIN',
    description: 'Full unconstrained administrative access across all system capabilities',
    permissions: SYSTEM_PERMISSIONS.map((p) => p.key),
  },
  {
    name: 'ADMIN',
    description: 'Standard administrator with user management, content, settings, and diagnostics access',
    permissions: [
      'dashboard.read',
      'admin.users.read',
      'admin.users.write',
      'admin.roles.read',
      'settings.read',
      'settings.write',
      'content.pages.read',
      'content.pages.write',
      'content.pages.publish',
      'content.pages.delete',
      'blog.posts.read',
      'blog.posts.write',
      'blog.posts.publish',
      'blog.posts.delete',
      'blog.revisions.restore',
      'blog.taxonomy.manage',
      'media.read',
      'media.write',
      'media.delete',
      'analytics.read',
      'providers.read',
      'audit.read',
    ],
  },
  {
    name: 'SEO_MANAGER',
    description: 'Specialized role for SEO optimization, landing pages, redirects, and technical SEO control',
    permissions: [
      'dashboard.read',
      'seo.pages.read',
      'seo.pages.write',
      'seo.schema.read',
      'seo.schema.write',
      'seo.redirects.read',
      'seo.redirects.write',
      'seo.settings.read',
      'seo.settings.write',
      'seo.health.read',
      'content.pages.read',
      'content.pages.write',
      'analytics.read',
    ],
  },
  {
    name: 'CONTENT_MANAGER',
    description: 'Editorial role for managing pages, articles, and media library assets',
    permissions: [
      'dashboard.read',
      'content.pages.read',
      'content.pages.write',
      'content.pages.publish',
      'content.pages.delete',
      'blog.posts.read',
      'blog.posts.write',
      'blog.posts.publish',
      'blog.posts.delete',
      'blog.revisions.restore',
      'blog.taxonomy.manage',
      'media.read',
      'media.write',
      'media.delete',
    ],
  },
  {
    name: 'ANALYTICS_VIEWER',
    description: 'Read-only access to dashboard statistics, analytics, and telemetry',
    permissions: ['dashboard.read', 'analytics.read', 'providers.read'],
  },
  {
    name: 'SUPPORT',
    description: 'Support personnel with read-only access to users, diagnostics, and audit logs',
    permissions: ['dashboard.read', 'admin.users.read', 'providers.read', 'audit.read'],
  },
];

export async function bootstrapAdminSystem(): Promise<void> {
  const db = getDatabase();

  // 1. Seed Permissions
  const insertPerm = db.prepare(`
    INSERT INTO permissions (id, key, description, category, created_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET
      description = excluded.description,
      category = excluded.category
  `);

  const now = new Date().toISOString();
  for (const perm of SYSTEM_PERMISSIONS) {
    const id = `perm_${perm.key.replace(/\./g, '_')}`;
    insertPerm.run(id, perm.key, perm.description, perm.category, now);
  }

  // 2. Seed System Roles
  for (const roleDef of SYSTEM_ROLES) {
    const existingRole = AdminRepository.getRoleByName(roleDef.name);
    let roleId = existingRole?.id;

    if (!existingRole) {
      roleId = `role_${roleDef.name.toLowerCase()}`;
      db.prepare(`
        INSERT INTO roles (id, name, description, is_system, created_at, updated_at)
        VALUES (?, ?, ?, 1, ?, ?)
      `).run(roleId, roleDef.name, roleDef.description, now, now);
    } else {
      roleId = existingRole.id;
    }

    // Associate permissions
    db.prepare('DELETE FROM role_permissions WHERE role_id = ?').run(roleId);
    const insertRolePerm = db.prepare(
      'INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)'
    );

    for (const permKey of roleDef.permissions) {
      const permRow = db.prepare('SELECT id FROM permissions WHERE key = ?').get(permKey) as any;
      if (permRow) {
        insertRolePerm.run(roleId, permRow.id);
      }
    }
  }

  // 3. Seed Default System Settings
  AdminRepository.upsertSetting(
    'site_name',
    'Media Downloader Platform',
    'Application brand name displayed across UI headers',
    false,
    'general',
    'system'
  );
  AdminRepository.upsertSetting(
    'maintenance_mode',
    'false',
    'When enabled, non-admin public downloader requests are gated',
    false,
    'system',
    'system'
  );
  AdminRepository.upsertSetting(
    'rate_limit_per_minute',
    '30',
    'Maximum media resolution requests per client IP per minute',
    false,
    'security',
    'system'
  );

  // 4. Safe Bootstrap of Initial Super Admin
  const adminCountRow = db.prepare('SELECT COUNT(*) as count FROM admin_users').get() as any;
  const adminCount = Number(adminCountRow?.count || 0);

  if (adminCount === 0) {
    const initialEmail = (process.env.ADMIN_INITIAL_EMAIL || 'admin@example.com').toLowerCase().trim();
    const initialPassword = process.env.ADMIN_INITIAL_PASSWORD || 'Admin12345!Secure';
    const initialName = process.env.ADMIN_INITIAL_NAME || 'System Super Administrator';

    const passwordHash = await AuthService.hashPassword(initialPassword);
    const superAdminRole = AdminRepository.getRoleByName('SUPER_ADMIN');

    if (!superAdminRole) {
      throw new Error('Fatal: SUPER_ADMIN role could not be resolved during bootstrap.');
    }

    const userId = crypto.randomUUID();
    AdminRepository.createUser(
      {
        id: userId,
        email: initialEmail,
        passwordHash,
        name: initialName,
        status: 'active',
      },
      [superAdminRole.id]
    );

    AuditService.log({
      actorAdminUserId: userId,
      actorEmail: initialEmail,
      action: 'BOOTSTRAP_INITIAL_SUPER_ADMIN',
      resourceType: 'system',
      resourceId: userId,
      metadata: { email: initialEmail, role: 'SUPER_ADMIN' },
    });

    console.log(`[AdminBootstrap] Initial Super Admin initialized successfully for ${initialEmail}.`);
  }

  // 5. Seed Initial SEO Pages, Redirects, and Technical Settings (Phase 8.2)
  bootstrapSeoData();

  // 6. Seed Initial Pages / Landing CMS Content (Phase 8.3)
  bootstrapContentData();
}

export function bootstrapContentData(): void {
  const initialCmsPages: Array<{
    path: string;
    title: string;
    pageType: 'TOOL_PAGE' | 'STATIC_PAGE' | 'LANDING_PAGE';
    sections: Array<{
      sectionType: any;
      sortOrder: number;
      data: any;
      isVisible?: boolean;
    }>;
  }> = [
    {
      path: '/',
      title: 'Universal Social Media Video Downloader',
      pageType: 'TOOL_PAGE',
      sections: [
        {
          sectionType: 'hero',
          sortOrder: 0,
          data: {
            eyebrow: 'Universal Media Resolver & Downloader',
            heading: 'Universal Social Media Video Downloader',
            description: 'Resolves publicly accessible media URLs into streamable video and audio tracks with direct server-side stream verification and zero telemetry.',
            primaryCta: { label: 'Explore Tools', url: '#downloader-input' },
            secondaryCta: { label: 'Supported Platforms', url: '#supported-providers' },
            alignment: 'center',
          },
        },
        {
          sectionType: 'feature_grid',
          sortOrder: 1,
          data: {
            heading: 'Engine Architecture & Capabilities',
            description: 'Engineered for reliability, direct binary stream extraction, and strict enterprise security protections.',
            features: [
              { title: 'Multi-Platform Resolution', description: 'Supports TikTok, Instagram Reels, Facebook Watch, YouTube Shorts, X/Twitter, and Pinterest Pins.' },
              { title: 'SSRF & Domain Boundary Guard', description: 'Strict IP address validation prevents internal network pivoting and private subnet extraction.' },
              { title: 'Verified Stream Binaries', description: 'Validates HTTP content headers and upstream reachability before generating download tokens.' },
              { title: 'Zero Third-Party Tracking', description: 'No tracking pixels, third-party analytics scripts, or client-side telemetry.' },
              { title: 'Adaptive Quality Picker', description: 'Extracts full HD MP4 video along with isolated MP3 and audio tracks where available.' },
              { title: 'High-Throughput Streaming', description: 'Low-latency proxied chunk streaming directly to browser with complete Range request support.' },
            ],
          },
        },
        {
          sectionType: 'how_to',
          sortOrder: 2,
          data: {
            heading: 'How to Download Social Media Videos',
            description: 'Three simple steps to resolve and download public media in full quality.',
            steps: [
              { stepNumber: 1, title: 'Copy Media URL', description: 'Copy the URL of any public video or reel from TikTok, Instagram, YouTube, Facebook, X, or Pinterest.' },
              { stepNumber: 2, title: 'Resolve Video Stream', description: 'Paste the URL into the input field above and click "Resolve Media" to fetch available stream qualities.' },
              { stepNumber: 3, title: 'Download Binary File', description: 'Select your preferred MP4 resolution or audio track and stream the file directly to your device.' },
            ],
          },
        },
        {
          sectionType: 'faq',
          sortOrder: 3,
          data: {
            heading: 'Frequently Asked Questions',
            description: 'Common questions about resolving and downloading public social media content.',
            items: [
              { question: 'Is this service free to use?', answer: 'Yes, this downloader engine is 100% free with no registration or subscriptions required.' },
              { question: 'Does the downloader store or log downloaded videos?', answer: 'No. All videos are streamed directly from upstream content delivery networks through transient memory-efficient proxies. No media files are stored on server disks.' },
              { question: 'Can I download private account videos?', answer: 'No. Our engine strictly honors provider access controls and only resolves publicly accessible media URLs.' },
              { question: 'What video quality formats are supported?', answer: 'The engine extracts original resolutions provided by the source platform, including 1080p Full HD, 720p HD, SD MP4, and isolated audio MP3/M4A streams.' },
            ],
          },
        },
        {
          sectionType: 'related_tools',
          sortOrder: 4,
          data: {
            heading: 'Supported Platform Downloaders',
            description: 'Dedicated tools optimized for each social platform.',
            tools: [
              { route: '/tiktok-video-downloader', label: 'TikTok Downloader' },
              { route: '/instagram-reels-downloader', label: 'Instagram Downloader' },
              { route: '/facebook-video-downloader', label: 'Facebook Downloader' },
              { route: '/youtube-shorts-downloader', label: 'YouTube Shorts' },
              { route: '/twitter-video-downloader', label: 'X / Twitter Downloader' },
              { route: '/pinterest-video-downloader', label: 'Pinterest Downloader' },
            ],
          },
        },
        {
          sectionType: 'cta',
          sortOrder: 5,
          data: {
            heading: 'Ready to Download Public Media?',
            description: 'Try resolving a sample media link right now with instant extraction.',
            buttonLabel: 'Try TikTok Sample',
            buttonUrl: '/tiktok-video-downloader',
          },
        },
      ],
    },
    {
      path: '/tiktok-video-downloader',
      title: 'TikTok Video Downloader',
      pageType: 'TOOL_PAGE',
      sections: [
        {
          sectionType: 'hero',
          sortOrder: 0,
          data: {
            eyebrow: 'TikTok Media Engine',
            heading: 'TikTok Video Downloader',
            description: 'Save TikTok videos directly without watermark in full MP4 HD quality with complete audio tracks.',
            primaryCta: { label: 'Paste TikTok Link', url: '#media-url' },
            alignment: 'center',
          },
        },
        {
          sectionType: 'how_to',
          sortOrder: 1,
          data: {
            heading: 'How to Download TikTok Videos Without Watermark',
            description: 'Quick guide to extract clean HD MP4 TikTok clips.',
            steps: [
              { stepNumber: 1, title: 'Copy Share Link', description: 'Tap "Share" on any TikTok video and select "Copy Link".' },
              { stepNumber: 2, title: 'Paste in Resolver', description: 'Paste the copied URL (tiktok.com/@user/video/... or vm.tiktok.com) into our search box above.' },
              { stepNumber: 3, title: 'Download No-Watermark MP4', description: 'Click Download MP4 to save the clean video without overlay watermark.' },
            ],
          },
        },
        {
          sectionType: 'feature_grid',
          sortOrder: 2,
          data: {
            heading: 'TikTok Tool Advantages',
            features: [
              { title: 'No Watermark Clean Video', description: 'Removes TikTok logo and username overlay for clean playback.' },
              { title: 'Original Audio Extraction', description: 'Isolates background audio and music tracks in high-fidelity MP3.' },
              { title: 'Mobile & Desktop Ready', description: 'Works seamlessly across iOS Safari, Android Chrome, macOS, and Windows.' },
            ],
          },
        },
        {
          sectionType: 'faq',
          sortOrder: 3,
          data: {
            heading: 'TikTok Downloader FAQ',
            items: [
              { question: 'Do I need to install any TikTok downloader app or browser extension?', answer: 'No installation required. Everything operates entirely in your web browser.' },
              { question: 'Does this remove the TikTok watermark?', answer: 'Yes, our resolver identifies the original raw video stream without the animated TikTok watermark overlay.' },
            ],
          },
        },
        {
          sectionType: 'related_tools',
          sortOrder: 4,
          data: {
            heading: 'Other Video Downloaders',
            tools: [
              { route: '/instagram-reels-downloader', label: 'Instagram Reels Downloader' },
              { route: '/youtube-shorts-downloader', label: 'YouTube Shorts Downloader' },
              { route: '/facebook-video-downloader', label: 'Facebook Video Downloader' },
            ],
          },
        },
      ],
    },
    {
      path: '/instagram-reels-downloader',
      title: 'Instagram Reels & Video Downloader',
      pageType: 'TOOL_PAGE',
      sections: [
        {
          sectionType: 'hero',
          sortOrder: 0,
          data: {
            eyebrow: 'Instagram Media Engine',
            heading: 'Instagram Reels & Video Downloader',
            description: 'Download public Instagram Reels, videos, and clips in crystal-clear HD MP4 with full audio fidelity.',
            primaryCta: { label: 'Paste Instagram Link', url: '#media-url' },
            alignment: 'center',
          },
        },
        {
          sectionType: 'how_to',
          sortOrder: 1,
          data: {
            heading: 'How to Download Instagram Reels',
            steps: [
              { stepNumber: 1, title: 'Copy Reel Link', description: 'Open Instagram, tap the three dots or Share button on the reel, and tap "Copy link".' },
              { stepNumber: 2, title: 'Resolve Stream', description: 'Paste the link into the field above and tap "Resolve Media".' },
              { stepNumber: 3, title: 'Save Video', description: 'Select the high quality MP4 video stream and save it to your camera roll or downloads folder.' },
            ],
          },
        },
        {
          sectionType: 'faq',
          sortOrder: 2,
          data: {
            heading: 'Instagram Downloader FAQ',
            items: [
              { question: 'Can I download private Instagram posts?', answer: 'No. The engine only resolves public Instagram reels and videos accessible without login.' },
              { question: 'Is the audio preserved in the downloaded video?', answer: 'Yes, our stream pipeline preserves the complete stereo audio soundtrack.' },
            ],
          },
        },
        {
          sectionType: 'related_tools',
          sortOrder: 3,
          data: {
            heading: 'Explore Other Tools',
            tools: [
              { route: '/tiktok-video-downloader', label: 'TikTok Downloader' },
              { route: '/facebook-video-downloader', label: 'Facebook Downloader' },
              { route: '/twitter-video-downloader', label: 'X / Twitter Downloader' },
            ],
          },
        },
      ],
    },
    {
      path: '/facebook-video-downloader',
      title: 'Facebook Video Downloader',
      pageType: 'TOOL_PAGE',
      sections: [
        {
          sectionType: 'hero',
          sortOrder: 0,
          data: {
            eyebrow: 'Facebook Media Engine',
            heading: 'Facebook Video Downloader',
            description: 'Download public Facebook Reels, Watch videos, and clips in HD/SD quality.',
            primaryCta: { label: 'Paste Facebook URL', url: '#media-url' },
            alignment: 'center',
          },
        },
        {
          sectionType: 'how_to',
          sortOrder: 1,
          data: {
            heading: 'How to Download Facebook Videos',
            steps: [
              { stepNumber: 1, title: 'Copy Facebook URL', description: 'Copy the URL of the public Facebook Reel or Watch video.' },
              { stepNumber: 2, title: 'Resolve in Engine', description: 'Paste the link above and click Resolve Media.' },
              { stepNumber: 3, title: 'Select HD Stream', description: 'Pick between 720p HD and SD MP4 streams and download immediately.' },
            ],
          },
        },
        {
          sectionType: 'faq',
          sortOrder: 2,
          data: {
            heading: 'Facebook Downloader FAQ',
            items: [
              { question: 'Can I download Facebook Reels?', answer: 'Yes, both Facebook Reels (facebook.com/reel/...) and Watch videos are fully supported.' },
            ],
          },
        },
        {
          sectionType: 'related_tools',
          sortOrder: 3,
          data: {
            heading: 'Related Tools',
            tools: [
              { route: '/instagram-reels-downloader', label: 'Instagram Reels Downloader' },
              { route: '/tiktok-video-downloader', label: 'TikTok Downloader' },
            ],
          },
        },
      ],
    },
    {
      path: '/youtube-shorts-downloader',
      title: 'YouTube Shorts Downloader',
      pageType: 'TOOL_PAGE',
      sections: [
        {
          sectionType: 'hero',
          sortOrder: 0,
          data: {
            eyebrow: 'YouTube Media Engine',
            heading: 'YouTube Shorts Downloader',
            description: 'Download YouTube Shorts and video clips with separate high-quality video and audio stream options.',
            primaryCta: { label: 'Paste YouTube URL', url: '#media-url' },
            alignment: 'center',
          },
        },
        {
          sectionType: 'how_to',
          sortOrder: 1,
          data: {
            heading: 'How to Download YouTube Shorts',
            steps: [
              { stepNumber: 1, title: 'Copy YouTube Short Link', description: 'Tap Share on the YouTube Short and copy the link (youtube.com/shorts/... or youtu.be).' },
              { stepNumber: 2, title: 'Extract Video Streams', description: 'Paste the link into the URL input and click Resolve Media.' },
              { stepNumber: 3, title: 'Save MP4 Video', description: 'Download your chosen video resolution or extract the MP3 audio track directly.' },
            ],
          },
        },
        {
          sectionType: 'faq',
          sortOrder: 2,
          data: {
            heading: 'YouTube Shorts FAQ',
            items: [
              { question: 'Does this support YouTube Shorts and full videos?', answer: 'Yes, both YouTube Shorts (youtube.com/shorts/...) and standard YouTube video URLs are supported.' },
            ],
          },
        },
        {
          sectionType: 'related_tools',
          sortOrder: 3,
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
      sections: [
        {
          sectionType: 'hero',
          sortOrder: 0,
          data: {
            eyebrow: 'X / Twitter Media Engine',
            heading: 'X / Twitter Video Downloader',
            description: 'Save videos and animated GIFs from public tweets and posts on X / Twitter in HD.',
            primaryCta: { label: 'Paste Tweet Link', url: '#media-url' },
            alignment: 'center',
          },
        },
        {
          sectionType: 'how_to',
          sortOrder: 1,
          data: {
            heading: 'How to Download Videos from X (Twitter)',
            steps: [
              { stepNumber: 1, title: 'Copy Post Link', description: 'Click the share icon on the tweet or post and copy the URL.' },
              { stepNumber: 2, title: 'Resolve Streams', description: 'Paste the x.com or twitter.com link above and click Resolve Media.' },
              { stepNumber: 3, title: 'Download MP4', description: 'Select your preferred bitrate and download the MP4 file to your device.' },
            ],
          },
        },
        {
          sectionType: 'faq',
          sortOrder: 2,
          data: {
            heading: 'X / Twitter Downloader FAQ',
            items: [
              { question: 'How do I download videos from X (Twitter)?', answer: 'Copy the tweet URL containing the video, paste it above, and select your desired MP4 resolution.' },
            ],
          },
        },
        {
          sectionType: 'related_tools',
          sortOrder: 3,
          data: {
            heading: 'Related Tools',
            tools: [
              { route: '/tiktok-video-downloader', label: 'TikTok Downloader' },
              { route: '/pinterest-video-downloader', label: 'Pinterest Downloader' },
            ],
          },
        },
      ],
    },
    {
      path: '/pinterest-video-downloader',
      title: 'Pinterest Video Downloader',
      pageType: 'TOOL_PAGE',
      sections: [
        {
          sectionType: 'hero',
          sortOrder: 0,
          data: {
            eyebrow: 'Pinterest Media Engine',
            heading: 'Pinterest Video Downloader',
            description: 'Extract and download high-definition MP4 videos from Pinterest Pins and Idea Pins with direct stream resolution.',
            primaryCta: { label: 'Paste Pin Link', url: '#media-url' },
            alignment: 'center',
          },
        },
        {
          sectionType: 'how_to',
          sortOrder: 1,
          data: {
            heading: 'How to Download Pinterest Videos',
            steps: [
              { stepNumber: 1, title: 'Copy Pin Link', description: 'Tap the share button on the Pinterest Pin and copy the link (pinterest.com/pin/... or pin.it).' },
              { stepNumber: 2, title: 'Resolve Pin Stream', description: 'Paste into our resolver and click Resolve Media.' },
              { stepNumber: 3, title: 'Download MP4 File', description: 'Download the high-definition video directly in MP4 format.' },
            ],
          },
        },
        {
          sectionType: 'faq',
          sortOrder: 2,
          data: {
            heading: 'Pinterest Downloader FAQ',
            items: [
              { question: 'Can I download Pinterest Idea Pins and video pins?', answer: 'Yes, both standard video pins and multi-page Idea Pins with video media are supported.' },
            ],
          },
        },
        {
          sectionType: 'related_tools',
          sortOrder: 3,
          data: {
            heading: 'Related Tools',
            tools: [
              { route: '/instagram-reels-downloader', label: 'Instagram Reels Downloader' },
              { route: '/tiktok-video-downloader', label: 'TikTok Downloader' },
            ],
          },
        },
      ],
    },
  ];

  for (const pageDef of initialCmsPages) {
    const existing = ContentRepository.getPageByPath(pageDef.path);
    if (!existing) {
      const pageId = `page_${pageDef.path === '/' ? 'home' : pageDef.path.replace(/[^a-zA-Z0-9]/g, '_')}`;
      const created = ContentRepository.createPage({
        id: pageId,
        path: pageDef.path,
        title: pageDef.title,
        pageType: pageDef.pageType,
        status: 'published',
      });
      ContentRepository.setSections(created.id, pageDef.sections);
    }
  }
}


export function bootstrapSeoData(): void {
  // 5.1 Seed Default SEO Pages
  for (const [path, routeDef] of Object.entries(DEFAULT_PUBLIC_ROUTES)) {
    const existing = SeoRepository.getPageByPath(path);
    if (!existing) {
      SeoRepository.upsertPage({
        id: `page_${path === '/' ? 'home' : path.replace(/[^a-zA-Z0-9]/g, '_')}`,
        path,
        pageType: routeDef.pageType || 'TOOL_PAGE',
        title: routeDef.title || 'Media Downloader Engine',
        metaTitle: routeDef.metaTitle || routeDef.title,
        metaDescription: routeDef.metaDescription || '',
        canonicalUrl: null,
        robotsIndex: routeDef.robotsIndex !== false,
        robotsFollow: routeDef.robotsFollow !== false,
        robotsExtra: 'max-image-preview:large',
        h1: routeDef.h1 || routeDef.title,
        ogTitle: routeDef.ogTitle || routeDef.title,
        ogDescription: routeDef.ogDescription || routeDef.metaDescription,
        ogImage: null,
        ogType: 'website',
        twitterCard: 'summary_large_image',
        twitterTitle: routeDef.ogTitle || routeDef.title,
        twitterDescription: routeDef.ogDescription || routeDef.metaDescription,
        twitterImage: null,
        schemaType: routeDef.schemaType || 'WebPage',
        schemaJson: null,
        sitemapIncluded: routeDef.sitemapIncluded !== false,
        sitemapPriority: routeDef.sitemapPriority ?? 0.8,
        sitemapChangeFrequency: routeDef.sitemapChangeFrequency || 'weekly',
        breadcrumbsJson: null,
        faqJson: null,
      });
    }
  }

  // 5.2 Seed Legacy Canonical Redirects
  const existingRedirect = SeoRepository.getRedirectBySource('/instagram-video-downloader');
  if (!existingRedirect) {
    SeoRepository.upsertRedirect({
      id: 'redirect_ig_legacy_video',
      sourcePath: '/instagram-video-downloader',
      destinationPath: '/instagram-reels-downloader',
      statusCode: 301,
      enabled: true,
    });
  }

  const existingIgShortRedirect = SeoRepository.getRedirectBySource('/ig-reels');
  if (!existingIgShortRedirect) {
    SeoRepository.upsertRedirect({
      id: 'redirect_ig_reels_short',
      sourcePath: '/ig-reels',
      destinationPath: '/instagram-reels-downloader',
      statusCode: 301,
      enabled: true,
    });
  }

  // 5.3 Seed Default Technical SEO Settings
  if (!SeoRepository.getSetting('public_site_url')) {
    SeoRepository.upsertSetting(
      'public_site_url',
      process.env.APP_URL || 'https://media-downloader.app',
      'Production canonical public website origin for sitemap and canonical links'
    );
  }
  if (!SeoRepository.getSetting('default_title_suffix')) {
    SeoRepository.upsertSetting(
      'default_title_suffix',
      ' — Media Downloader Engine',
      'Appended suffix for page titles when not already present'
    );
  }
  if (!SeoRepository.getSetting('default_og_image')) {
    SeoRepository.upsertSetting(
      'default_og_image',
      '/og-preview.png',
      'Default social share image URL when specific page image is omitted'
    );
  }
}

