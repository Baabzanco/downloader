/**
 * Real Integration & Unit Test Suite for Media Downloader Engine
 */
import { PlatformDetector } from './downloader/core/PlatformDetector.js';
import { SecurityValidator } from './downloader/core/SecurityValidator.js';
import { DownloaderEngine } from './downloader/core/DownloaderEngine.js';
import { isDownloaderAppError } from './downloader/core/errors.js';
import fs from 'fs';
import path from 'path';

let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, testName: string, details?: string) {
  if (condition) {
    console.log(`  \x1b[32m✔\x1b[0m ${testName}`);
    passedTests++;
  } else {
    console.error(`  \x1b[31m✖\x1b[0m ${testName}`);
    if (details) console.error(`    -> ${details}`);
    failedTests++;
  }
}

async function runTests() {
  console.log('\n============================================================');
  console.log('🧪 RUNNING MEDIA DOWNLOADER ENGINE TEST SUITE');
  console.log('============================================================\n');

  // ------------------------------------------------------------
  // UNIT TESTS: URL Normalization & SSRF Security
  // ------------------------------------------------------------
  console.log('--- Suite 1: Security & URL Normalization ---');

  // Test SSRF blocking
  try {
    SecurityValidator.validateSubmittedUrl('http://127.0.0.1/admin');
    assert(false, 'Block loopback IPv4 SSRF');
  } catch (err) {
    assert(
      isDownloaderAppError(err) && err.code === 'SSRF_ATTEMPT',
      'Block loopback IPv4 SSRF'
    );
  }

  try {
    SecurityValidator.validateSubmittedUrl('http://localhost:8080/secret');
    assert(false, 'Block localhost SSRF');
  } catch (err) {
    assert(
      isDownloaderAppError(err) && err.code === 'SSRF_ATTEMPT',
      'Block localhost SSRF'
    );
  }

  try {
    SecurityValidator.validateSubmittedUrl('http://169.254.169.254/latest/meta-data');
    assert(false, 'Block cloud metadata link-local SSRF');
  } catch (err) {
    assert(
      isDownloaderAppError(err) && err.code === 'SSRF_ATTEMPT',
      'Block cloud metadata link-local SSRF'
    );
  }

  try {
    SecurityValidator.validateSubmittedUrl('ftp://ftp.example.com/file');
    assert(false, 'Block non-HTTP/HTTPS protocol');
  } catch (err) {
    assert(
      isDownloaderAppError(err) && err.code === 'INVALID_URL',
      'Block non-HTTP/HTTPS protocol'
    );
  }

  // Test Tracking Param Removal
  const dirtyUrl = 'https://www.tiktok.com/@user/video/1234567890?utm_source=share&utm_medium=ios_app&_r=1&ref=tw';
  const { normalizedString } = PlatformDetector.normalizeUrl(dirtyUrl);
  assert(
    !normalizedString.includes('utm_source') && !normalizedString.includes('_r=1'),
    'Strip tracking parameters (utm_*, _r, etc.)'
  );

  // ------------------------------------------------------------
  // UNIT TESTS: Platform Detection
  // ------------------------------------------------------------
  console.log('\n--- Suite 2: Platform Detection & Route Matching ---');

  const platformsToTest = [
    {
      url: 'https://www.tiktok.com/@scout2015/video/6718335390845095173',
      expected: 'tiktok',
      validMedia: true,
    },
    {
      url: 'https://vm.tiktok.com/ZM8xXYZ12/',
      expected: 'tiktok',
      validMedia: true,
    },
    {
      url: 'https://www.tiktok.com/@scout2015',
      expected: 'tiktok',
      validMedia: false, // Profile, not video post
    },
    {
      url: 'https://www.instagram.com/reel/C3x9pL4vABC/',
      expected: 'instagram',
      validMedia: true,
    },
    {
      url: 'https://www.facebook.com/watch/?v=123456789',
      expected: 'facebook',
      validMedia: true,
    },
    {
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      expected: 'youtube',
      validMedia: true,
    },
    {
      url: 'https://x.com/jack/status/20',
      expected: 'twitter',
      validMedia: true,
    },
    {
      url: 'https://www.pinterest.com/pin/1234567890/',
      expected: 'pinterest',
      validMedia: true,
    },
    {
      url: 'https://example.com/random/page',
      expected: 'unknown',
      validMedia: false,
    },
  ];

  for (const testCase of platformsToTest) {
    const res = PlatformDetector.detect(testCase.url);
    assert(
      res.platform === testCase.expected,
      `Detect ${testCase.expected.toUpperCase()} from ${testCase.url.substring(0, 40)}...`,
      `Expected ${testCase.expected}, got ${res.platform}`
    );
    assert(
      res.isSupportedMediaUrl === testCase.validMedia,
      `Validate media URL structure for ${testCase.expected}`,
      `Expected isSupportedMediaUrl=${testCase.validMedia}, got ${res.isSupportedMediaUrl}`
    );
  }

  // ------------------------------------------------------------
  // INTEGRATION TEST: Unsupported Platform Rejection
  // ------------------------------------------------------------
  console.log('\n--- Suite 3: Unsupported Platform Rejection (Phase 1 Boundary) ---');
  const engine = DownloaderEngine.getInstance();

  const unsupportedRes = await engine.resolveMedia('https://vimeo.com/123456789');
  assert(
    !unsupportedRes.success && unsupportedRes.error.code === 'UNSUPPORTED_PLATFORM',
    'Return honest UNSUPPORTED_PLATFORM error for unsupported platform'
  );

  // ------------------------------------------------------------
  // REAL INTEGRATION TEST: TikTok End-to-End Resolution & Download
  // ------------------------------------------------------------
  console.log('\n--- Suite 4: REAL TikTok Media Resolution & Streaming ---');
  const realTikTokUrl = 'https://www.tiktok.com/@scout2015/video/6718335390845095173';
  console.log(`Resolving real TikTok URL: ${realTikTokUrl}`);

  const startTime = Date.now();
  const resolveResult = await engine.resolveMedia(realTikTokUrl);
  const duration = Date.now() - startTime;

  assert(resolveResult.success === true, 'Real TikTok resolution completed with success: true');

  if (resolveResult.success) {
    const media = resolveResult.media;
    console.log(`  Resolved in ${duration}ms`);
    console.log(`  Title: "${media.title}"`);
    console.log(`  Author: ${media.author?.name} (@${media.author?.username})`);
    console.log(`  Duration: ${media.duration}s`);
    console.log(`  Variants count: ${media.variants.length}`);

    assert(media.platform === 'tiktok', 'Platform is verified as tiktok');
    assert(Boolean(media.title && media.title.length > 0), 'Contains real video title');
    assert(Boolean(media.author?.username === 'scout2015'), 'Author username accurately matched (scout2015)');
    assert(Boolean(media.duration && media.duration > 0), 'Contains valid positive duration');
    assert(Boolean(media.thumbnailUrl && media.thumbnailUrl.startsWith('http')), 'Contains valid CDN thumbnail URL');
    assert(media.variants.length >= 2, 'Has at least 2 real media variants (e.g. HD/No-WM video, Audio)');

    // Verify variants detail
    const videoVariant = media.variants.find((v) => v.mimeType === 'video/mp4');
    assert(Boolean(videoVariant && videoVariant.url.startsWith('http')), 'Has valid MP4 video variant URL');

    const audioVariant = media.variants.find((v) => v.mimeType === 'audio/mpeg');
    assert(Boolean(audioVariant && audioVariant.url.startsWith('http')), 'Has valid MP3 audio variant URL');

    // ------------------------------------------------------------
    // REAL DOWNLOAD TEST: Download video bytes and verify binary format
    // ------------------------------------------------------------
    console.log('\n--- Suite 5: Real Media Download & Binary Integrity ---');
    const token = resolveResult.downloadToken!;
    assert(Boolean(token), 'Generated valid temporary download token');

    const selectedVariant = videoVariant!;
    console.log(`Downloading real media binary from variant: ${selectedVariant.id} (${selectedVariant.quality})`);

    // Stream to temporary file
    const tempFilePath = path.join('/tmp', `test_download_${Date.now()}.mp4`);
    const fileStream = fs.createWriteStream(tempFilePath);

    // Mock Express Response wrapper to capture stream
    let statusCode = 200;
    const headers: Record<string, string> = {};
    const mockRes: any = {
      setHeader: (k: string, v: string) => {
        headers[k.toLowerCase()] = v;
      },
      status: (code: number) => {
        statusCode = code;
        return mockRes;
      },
      write: (chunk: Buffer) => {
        return fileStream.write(chunk);
      },
      end: () => {
        fileStream.end();
      },
      on: (_event: string, _cb: any) => {},
      once: (_event: string, cb: any) => {
        fileStream.once('drain', cb);
      },
      headersSent: false,
      writableEnded: false,
    };

    const streamResult = await engine.downloadManager.streamMediaVariant(
      token,
      selectedVariant.id,
      mockRes
    );

    // Wait for file stream finish
    await new Promise<void>((resolve) => fileStream.on('finish', () => resolve()));

    const fileStats = fs.statSync(tempFilePath);
    console.log(`  Downloaded file size: ${fileStats.size} bytes (${(fileStats.size / (1024 * 1024)).toFixed(2)} MB)`);
    console.log(`  Reported bytes streamed: ${streamResult.bytesStreamed} bytes`);
    console.log(`  Header Content-Type: ${headers['content-type']}`);
    console.log(`  Header Content-Disposition: ${headers['content-disposition']}`);

    assert(fileStats.size > 100000, 'Downloaded file is not empty (> 100KB, real video)');
    assert(fileStats.size === streamResult.bytesStreamed, 'File size matches streamed bytes count');
    assert(
      headers['content-disposition']?.includes('attachment; filename='),
      'Content-Disposition header correctly set for browser download'
    );

    // Read first 12 bytes to check MP4 / ISO signature (ftyp)
    const headerBuffer = Buffer.alloc(12);
    const fd = fs.openSync(tempFilePath, 'r');
    fs.readSync(fd, headerBuffer, 0, 12, 0);
    fs.closeSync(fd);

    const ftypString = headerBuffer.subarray(4, 8).toString('ascii');
    assert(
      ftypString === 'ftyp',
      `Binary header is verified ISO Base Media / MP4 format (magic '${ftypString}')`
    );

    // Clean up temporary file
    fs.unlinkSync(tempFilePath);
    assert(true, 'Cleaned up temporary test file');
  }

  // ------------------------------------------------------------
  // ERROR HANDLING TEST: Non-existent / deleted video
  // ------------------------------------------------------------
  console.log('\n--- Suite 6: Error Handling for Non-existent / Invalid Media ---');
  const invalidTiktok = await engine.resolveMedia('https://www.tiktok.com/@nonexistent_user_999999999/video/1111111111111111111');
  assert(
    !invalidTiktok.success &&
      (invalidTiktok.error.code === 'MEDIA_NOT_FOUND' || invalidTiktok.error.code === 'RESOLUTION_FAILED'),
    'Accurately returns error code for non-existent video without fabricating success'
  );

  console.log('\n============================================================');
  console.log(`TEST SUMMARY: \x1b[32m${passedTests} passed\x1b[0m, \x1b[31m${failedTests} failed\x1b[0m`);
  console.log('============================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test execution failure:', err);
  process.exit(1);
});
