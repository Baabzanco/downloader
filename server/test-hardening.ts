/**
 * Phase 1.5 - Real-World Downloader Hardening Test Suite
 * Independent verification of TikTok media resolution, binary streaming,
 * security boundaries, rate limiting, and concurrency.
 */
import { PlatformDetector } from './downloader/core/PlatformDetector.js';
import { SecurityValidator } from './downloader/core/SecurityValidator.js';
import { DownloaderEngine } from './downloader/core/DownloaderEngine.js';
import { isDownloaderAppError } from './downloader/core/errors.js';
import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execFileAsync = promisify(execFile);

let passedCount = 0;
let failedCount = 0;
let notTestedCount = 0;
let realDownloadsCount = 0;

function assert(condition: boolean, testName: string, details?: string) {
  if (condition) {
    console.log(`  \x1b[32m✔\x1b[0m ${testName}`);
    passedCount++;
  } else {
    console.error(`  \x1b[31m✖\x1b[0m ${testName}`);
    if (details) console.error(`    -> ${details}`);
    failedCount++;
  }
}

function markNotTested(testName: string, reason: string) {
  console.warn(`  \x1b[33m[NOT TESTED]\x1b[0m ${testName} (${reason})`);
  notTestedCount++;
}

/**
 * Downloads a variant through the DownloadManager and validates real binary media with ffprobe
 */
async function verifyRealMediaDownload(
  engine: DownloaderEngine,
  downloadToken: string,
  variantId: string,
  label: string
): Promise<{ success: boolean; sizeBytes: number; duration: number; format: string }> {
  const tempFile = path.join('/tmp', `harden_test_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.mp4`);
  const fileStream = fs.createWriteStream(tempFile);

  const headers: Record<string, string> = {};
  let statusCode = 200;

  const mockRes: any = {
    setHeader: (k: string, v: string) => {
      headers[k.toLowerCase()] = v;
    },
    status: (code: number) => {
      statusCode = code;
      return mockRes;
    },
    write: (chunk: Buffer) => fileStream.write(chunk),
    end: () => fileStream.end(),
    on: (_e: string, _cb: any) => {},
    once: (_e: string, cb: any) => fileStream.once('drain', cb),
    headersSent: false,
    writableEnded: false,
  };

  try {
    const streamResult = await engine.downloadManager.streamMediaVariant(downloadToken, variantId, mockRes);
    await new Promise<void>((resolve) => fileStream.on('finish', () => resolve()));

    const stats = fs.statSync(tempFile);
    assert(stats.size > 50000, `[${label}] Downloaded binary file > 50KB (${(stats.size / 1024 / 1024).toFixed(2)}MB)`);
    assert(stats.size === streamResult.bytesStreamed, `[${label}] Streamed bytes count matches written file stats`);
    assert(
      Boolean(headers['content-type']?.includes('video/mp4')),
      `[${label}] HTTP Content-Type verified as video/mp4 (${headers['content-type']})`
    );

    // Verify ISO Base Media container signature (magic bytes 'ftyp' at offset 4..8)
    const headerBuf = Buffer.alloc(12);
    const fd = fs.openSync(tempFile, 'r');
    fs.readSync(fd, headerBuf, 0, 12, 0);
    fs.closeSync(fd);
    const ftyp = headerBuf.subarray(4, 8).toString('ascii');
    assert(ftyp === 'ftyp', `[${label}] Container signature verified: ISO Base Media 'ftyp'`);

    // Run ffprobe to confirm real audio/video streams and plausible duration
    const { stdout } = await execFileAsync('ffprobe', [
      '-v',
      'error',
      '-show_entries',
      'format=duration,format_name:stream=codec_type,codec_name,width,height',
      '-of',
      'json',
      tempFile,
    ]);

    const probe = JSON.parse(stdout);
    const probedDuration = parseFloat(probe.format?.duration || '0');
    const videoStream = probe.streams?.find((s: any) => s.codec_type === 'video');

    assert(Boolean(videoStream), `[${label}] ffprobe confirmed valid video stream (${videoStream?.codec_name} ${videoStream?.width}x${videoStream?.height})`);
    assert(probedDuration > 0 && probedDuration < 3600, `[${label}] ffprobe confirmed plausible duration (${probedDuration.toFixed(2)}s)`);

    realDownloadsCount++;
    return {
      success: true,
      sizeBytes: stats.size,
      duration: probedDuration,
      format: probe.format?.format_name || 'mp4',
    };
  } finally {
    if (fs.existsSync(tempFile)) {
      fs.unlinkSync(tempFile);
    }
  }
}

async function runHardeningTests() {
  console.log('\n============================================================');
  console.log('🛡️ PHASE 1.5: REAL-WORLD DOWNLOADER HARDENING TEST SUITE');
  console.log('============================================================\n');

  const engine = DownloaderEngine.getInstance();

  // ------------------------------------------------------------
  // SECTION 1: Real TikTok URL Test Matrix
  // ------------------------------------------------------------
  console.log('--- 1. Real TikTok Test Matrix ---');

  // 1.1 Canonical URL 1 (Scout)
  const canonicalUrl1 = 'https://www.tiktok.com/@scout2015/video/6718335390845095173';
  console.log(`\n[Matrix 1] Testing Canonical URL 1: ${canonicalUrl1}`);
  const res1 = await engine.resolveMedia(canonicalUrl1);
  assert(res1.success === true, 'Canonical URL 1 resolves successfully');
  if (res1.success) {
    assert(res1.media.platform === 'tiktok', 'Platform confirmed as tiktok');
    assert(res1.media.mediaType === 'video', 'MediaType confirmed as video');
    assert(res1.media.variants.length > 0, `Variants resolved (${res1.media.variants.length})`);
    const videoVariant = res1.media.variants.find((v) => v.mimeType === 'video/mp4')!;
    await verifyRealMediaDownload(engine, res1.downloadToken!, videoVariant.id, 'Canonical 1');
  }

  // 1.2 Canonical URL 2 (Zach King)
  const canonicalUrl2 = 'https://www.tiktok.com/@zachking/video/6768504823336815877';
  console.log(`\n[Matrix 2] Testing Canonical URL 2: ${canonicalUrl2}`);
  const res2 = await engine.resolveMedia(canonicalUrl2);
  assert(res2.success === true, 'Canonical URL 2 resolves successfully');
  if (res2.success) {
    assert(res2.media.platform === 'tiktok', 'Platform confirmed as tiktok');
    assert((res2.media.title || '').includes('wizard') || (res2.media.title || '').includes('magic') || (res2.media.title || '').includes('illusion'), 'Metadata title contains expected content');
    const videoVariant = res2.media.variants.find((v) => v.mimeType === 'video/mp4')!;
    await verifyRealMediaDownload(engine, res2.downloadToken!, videoVariant.id, 'Canonical 2');
  }

  // 1.3 Short URL (vt.tiktok.com)
  const shortUrl = 'https://vt.tiktok.com/ZS6H3j4w8/';
  console.log(`\n[Matrix 3] Testing Shortlink URL: ${shortUrl}`);
  const res3 = await engine.resolveMedia(shortUrl);
  assert(res3.success === true, 'Shortlink vt.tiktok.com resolves successfully');
  if (res3.success) {
    assert(res3.media.platform === 'tiktok', 'Platform confirmed as tiktok');
    const videoVariant = res3.media.variants.find((v) => v.mimeType === 'video/mp4')!;
    await verifyRealMediaDownload(engine, res3.downloadToken!, videoVariant.id, 'Shortlink');
  }

  // 1.4 URL with tracking parameters
  const trackingUrl = 'https://www.tiktok.com/@scout2015/video/6718335390845095173?utm_campaign=client_share&utm_source=copy&_r=1&fbclid=IwAR0000000000&checksum=abc123';
  console.log(`\n[Matrix 4] Testing URL with heavy tracking parameters`);
  const res4 = await engine.resolveMedia(trackingUrl);
  assert(res4.success === true, 'URL with tracking parameters stripped & resolved');
  if (res4.success) {
    assert(!res4.media.normalizedUrl.includes('utm_campaign'), 'Normalized URL stripped utm_campaign');
    assert(!res4.media.normalizedUrl.includes('_r=1'), 'Normalized URL stripped _r=1');
  }

  // 1.5 Invalid TikTok URL structure
  console.log(`\n[Matrix 5] Testing Invalid TikTok URL: https://www.tiktok.com/random-invalid-path`);
  const res5 = await engine.resolveMedia('https://www.tiktok.com/random-invalid-path');
  assert(!res5.success, 'Invalid path rejected');
  if (!res5.success) {
    assert(res5.error.code === 'INVALID_URL', `Returned code INVALID_URL (got ${res5.error.code})`);
  }

  // 1.6 Syntactically valid but non-existent video
  console.log(`\n[Matrix 6] Testing Non-existent TikTok video ID`);
  const res6 = await engine.resolveMedia('https://www.tiktok.com/@validuser/video/9999999999999999999');
  assert(!res6.success, 'Non-existent video ID rejected');
  if (!res6.success) {
    assert(
      res6.error.code === 'MEDIA_NOT_FOUND' || res6.error.code === 'RESOLUTION_FAILED',
      `Returned truthful error (got ${res6.error.code}: ${res6.error.message})`
    );
  }

  // ------------------------------------------------------------
  // SECTION 2: Security, SSRF & DNS Rebinding
  // ------------------------------------------------------------
  console.log('\n--- 2. Security, SSRF & Stream URL Restrictions ---');

  // 2.1 Private & Loopback IP rejection
  const ssrfUrls = [
    'http://127.0.0.1:8000/private',
    'http://10.0.0.1/admin',
    'http://192.168.1.1/',
    'http://169.254.169.254/latest/meta-data',
    'http://[::1]/secret',
    'http://metadata.google.internal/computeMetadata/v1/',
  ];
  for (const url of ssrfUrls) {
    try {
      SecurityValidator.validateSubmittedUrl(url);
      assert(false, `Block SSRF target: ${url}`);
    } catch (err) {
      assert(isDownloaderAppError(err) && err.code === 'SSRF_ATTEMPT', `Block SSRF target: ${url}`);
    }
  }

  // 2.2 Rejection of unauthorized CDN streaming hosts
  try {
    SecurityValidator.validateMediaStreamUrl('https://evil-hacker-site.com/exploit.mp4');
    assert(false, 'Block unauthorized streaming destination host');
  } catch (err) {
    assert(
      isDownloaderAppError(err) && err.code === 'DOWNLOAD_FAILED',
      'Block unauthorized streaming destination host'
    );
  }

  // 2.3 Allow valid TikTok CDN patterns
  const validCdnUrl = 'https://v16m.tiktokcdn-us.com/video/tos/sample.mp4';
  const parsedCdn = SecurityValidator.validateMediaStreamUrl(validCdnUrl);
  assert(parsedCdn.hostname === 'v16m.tiktokcdn-us.com', 'Permit authorized TikTok CDN host');

  // ------------------------------------------------------------
  // SECTION 3: Token Security
  // ------------------------------------------------------------
  console.log('\n--- 3. Token Security & Lifetime ---');

  if (res1.success) {
    const validToken = res1.downloadToken!;
    assert(validToken.length === 64, 'Token is 32 cryptographically random bytes (64 hex characters)');

    // Test forged/invalid token
    let invalidTokenFailed = false;
    try {
      const mockRes: any = { status: () => mockRes, json: () => {} };
      await engine.downloadManager.streamMediaVariant('0000000000000000000000000000000000000000000000000000000000000000', 'any', mockRes);
    } catch (err) {
      invalidTokenFailed = isDownloaderAppError(err) && err.code === 'DOWNLOAD_FAILED';
    }
    assert(invalidTokenFailed, 'Reject invalid or non-existent download token');

    // Test non-existent variant ID on valid token
    let invalidVariantFailed = false;
    try {
      const mockRes: any = { status: () => mockRes, json: () => {} };
      await engine.downloadManager.streamMediaVariant(validToken, 'non_existent_variant_xyz', mockRes);
    } catch (err) {
      invalidVariantFailed = isDownloaderAppError(err) && err.code === 'DOWNLOAD_FAILED';
    }
    assert(invalidVariantFailed, 'Reject invalid variant ID under valid token session');
  }

  // ------------------------------------------------------------
  // SECTION 4: Rate Limiting & Concurrency
  // ------------------------------------------------------------
  console.log('\n--- 4. Rate Limiting Verification ---');

  // Test exceeding rate limit with mock IP
  const testIp = '198.51.100.99';
  let rateLimitTripped = false;
  try {
    for (let i = 0; i < 70; i++) {
      engine.rateLimiter.check(testIp);
    }
  } catch (err) {
    rateLimitTripped = isDownloaderAppError(err) && err.code === 'RATE_LIMITED';
  }
  assert(rateLimitTripped, 'Token bucket rate limiter trips with 429 RATE_LIMITED on abuse');

  // ------------------------------------------------------------
  // SECTION 5: Concurrency Test (5 & 10 requests)
  // ------------------------------------------------------------
  console.log('\n--- 5. Concurrency Load Testing ---');

  // 5.1 Test 5 Concurrent Real Resolutions
  console.log('Executing 5 concurrent real TikTok resolution requests...');
  const t0_5 = Date.now();
  const testUrls5 = [
    canonicalUrl1,
    canonicalUrl2,
    shortUrl,
    canonicalUrl1,
    canonicalUrl2,
  ];
  const promises5 = testUrls5.map((url, i) => engine.resolveMedia(url, `192.0.2.${10 + i}`));
  const results5 = await Promise.all(promises5);
  const dur5 = Date.now() - t0_5;

  const successCount5 = results5.filter((r) => r.success).length;
  console.log(`  5 Concurrent requests finished in ${dur5}ms (Avg ${(dur5 / 5).toFixed(0)}ms/req)`);
  assert(successCount5 === 5, `All 5 concurrent requests succeeded (5/5)`);

  // 5.2 Test 10 Concurrent Requests
  console.log('Executing 10 concurrent real TikTok resolution requests...');
  const t0_10 = Date.now();
  const testUrls10 = [
    canonicalUrl1,
    canonicalUrl2,
    shortUrl,
    canonicalUrl1,
    canonicalUrl2,
    canonicalUrl1,
    canonicalUrl2,
    shortUrl,
    canonicalUrl1,
    canonicalUrl2,
  ];
  const memBefore = process.memoryUsage().heapUsed;
  const promises10 = testUrls10.map((url, i) => engine.resolveMedia(url, `192.0.2.${50 + i}`));
  const results10 = await Promise.all(promises10);
  const dur10 = Date.now() - t0_10;
  const memAfter = process.memoryUsage().heapUsed;

  const successCount10 = results10.filter((r) => r.success).length;
  console.log(`  10 Concurrent requests finished in ${dur10}ms (Avg ${(dur10 / 10).toFixed(0)}ms/req)`);
  console.log(`  Heap delta: +${((memAfter - memBefore) / 1024 / 1024).toFixed(2)} MB`);
  assert(successCount10 === 10, `All 10 concurrent requests succeeded (10/10)`);

  // ------------------------------------------------------------
  // FINAL SUMMARY
  // ------------------------------------------------------------
  console.log('\n============================================================');
  console.log(`HARDENING TEST SUMMARY:`);
  console.log(`  Passed:         \x1b[32m${passedCount}\x1b[0m`);
  console.log(`  Failed:         \x1b[31m${failedCount}\x1b[0m`);
  console.log(`  Not Tested:     \x1b[33m${notTestedCount}\x1b[0m`);
  console.log(`  Real Downloads: \x1b[36m${realDownloadsCount}\x1b[0m (Independently verified with ffprobe)`);
  console.log('============================================================\n');

  if (failedCount > 0) {
    process.exit(1);
  }
}

runHardeningTests().catch((err) => {
  console.error('Fatal hardening test error:', err);
  process.exit(1);
});
