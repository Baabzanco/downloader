/**
 * Phase 2 — Real Instagram Public Media Provider Test Suite
 * Comprehensive real-world validation of Instagram Reels, video posts,
 * non-video posts, URL normalization, security validation, and binary streaming with ffprobe.
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

/**
 * Downloads a variant through the DownloadManager and validates real binary media with ffprobe
 */
async function verifyRealMediaDownload(
  engine: DownloaderEngine,
  downloadToken: string,
  variantId: string,
  label: string
): Promise<{ success: boolean; sizeBytes: number; duration: number; format: string }> {
  const tempFile = path.join('/tmp', `ig_test_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.mp4`);
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
      '-v', 'error',
      '-show_entries', 'format=duration,format_name,size:stream=codec_name,codec_type,width,height,bit_rate',
      '-of', 'json',
      tempFile,
    ]);

    const probe = JSON.parse(stdout);
    const videoStream = probe.streams?.find((s: any) => s.codec_type === 'video');
    const audioStream = probe.streams?.find((s: any) => s.codec_type === 'audio');
    const duration = parseFloat(probe.format?.duration || '0');

    assert(Boolean(videoStream), `[${label}] ffprobe: Video stream detected`);
    assert(['h264', 'hevc', 'av1', 'vp9'].includes(videoStream?.codec_name), `[${label}] ffprobe: Video codec verified (${videoStream?.codec_name})`);
    assert(Boolean(videoStream?.width && videoStream.width > 0), `[${label}] ffprobe: Resolution verified (${videoStream?.width}x${videoStream?.height})`);
    assert(Boolean(audioStream), `[${label}] ffprobe: Audio stream detected (${audioStream?.codec_name})`);
    assert(duration > 0, `[${label}] ffprobe: Stream duration verified (${duration.toFixed(2)}s)`);

    realDownloadsCount++;
    return {
      success: true,
      sizeBytes: stats.size,
      duration,
      format: videoStream?.codec_name,
    };
  } finally {
    if (fs.existsSync(tempFile)) {
      try {
        fs.unlinkSync(tempFile);
      } catch {
        // ignore cleanup error
      }
    }
  }
}

async function runInstagramTests() {
  console.log('\n===============================================================');
  console.log('PHASE 2: REAL INSTAGRAM PUBLIC MEDIA PROVIDER TEST SUITE');
  console.log('===============================================================\n');

  const engine = DownloaderEngine.getInstance();

  // -------------------------------------------------------------------------
  // 1. URL Normalization & Security Boundary Tests
  // -------------------------------------------------------------------------
  console.log('--- 1. URL Normalization & Detection ---');

  const reelUrl = 'https://www.instagram.com/reel/CY9Kk-xo0vs/?igsh=MWQ1ZGUxMzBkMA==&utm_source=ig_web_copy_link';
  const postUrl = 'https://instagram.com/p/DdbdNnrz6JI/?utm_medium=share_sheet';
  const shortDomainReel = 'https://instagr.am/reel/CY9Kk-xo0vs/';
  const storyUrl = 'https://www.instagram.com/stories/username/123456789/';
  const profileUrl = 'https://www.instagram.com/nasa/';

  const d1 = PlatformDetector.detect(reelUrl);
  assert(d1.platform === 'instagram', 'Detects canonical Instagram Reel');
  assert(d1.isSupportedMediaUrl, 'Marks Instagram Reel as supported');
  assert(!d1.normalizedUrl.includes('igsh='), 'Strips tracking parameter igsh');
  assert(!d1.normalizedUrl.includes('utm_source='), 'Strips tracking parameter utm_source');

  const d2 = PlatformDetector.detect(postUrl);
  assert(d2.platform === 'instagram', 'Detects non-www Instagram Post (/p/)');
  assert(d2.isSupportedMediaUrl, 'Marks Instagram Post as supported');
  assert(!d2.normalizedUrl.includes('utm_medium='), 'Strips tracking parameter utm_medium');

  const d3 = PlatformDetector.detect(shortDomainReel);
  assert(d3.platform === 'instagram', 'Detects instagr.am short domain');
  assert(d3.isSupportedMediaUrl, 'Marks instagr.am reel as supported');

  const d4 = PlatformDetector.detect(storyUrl);
  assert(d4.platform === 'instagram', 'Detects Instagram stories host');
  assert(!d4.isSupportedMediaUrl, 'Rejects unsupported story URL safely');

  const d5 = PlatformDetector.detect(profileUrl);
  assert(d5.platform === 'instagram', 'Detects Instagram profile host');
  assert(!d5.isSupportedMediaUrl, 'Rejects profile URL safely');

  // -------------------------------------------------------------------------
  // 2. Security & SSRF Protection for Media Streams
  // -------------------------------------------------------------------------
  console.log('\n--- 2. Security & Restricted CDN Media Proxy Boundaries ---');

  let blockedCdn = false;
  try {
    SecurityValidator.validateMediaStreamUrl('https://malicious-attacker.com/fake.mp4');
  } catch (err: any) {
    if (isDownloaderAppError(err) && err.code === 'DOWNLOAD_FAILED') {
      blockedCdn = true;
    }
  }
  assert(blockedCdn, 'Rejects unauthorized media stream domain (SSRF protection)');

  let blockedLocalhost = false;
  try {
    SecurityValidator.validateMediaStreamUrl('https://127.0.0.1/internal.mp4');
  } catch (err: any) {
    if (isDownloaderAppError(err) && (err.code === 'SSRF_ATTEMPT' || err.code === 'DOWNLOAD_FAILED')) {
      blockedLocalhost = true;
    }
  }
  assert(blockedLocalhost, 'Blocks local IP media stream attempts');

  let allowedCdn = false;
  try {
    const parsed = SecurityValidator.validateMediaStreamUrl('https://scontent.cdninstagram.com/o1/v/t2/f2/m86/test.mp4?oe=123');
    if (parsed.hostname.includes('cdninstagram.com')) allowedCdn = true;
  } catch {
    allowedCdn = false;
  }
  assert(allowedCdn, 'Authorizes official Instagram media CDN (cdninstagram.com)');

  // -------------------------------------------------------------------------
  // 3. Test A: Real Public Instagram Reel 1
  // -------------------------------------------------------------------------
  console.log('\n--- 3. Test A: Real Public Instagram Reel 1 ---');
  const targetReel1 = 'https://www.instagram.com/reel/CY9Kk-xo0vs/';
  console.log(`Resolving real Reel: ${targetReel1}`);

  try {
    const resA = await engine.resolveMedia(targetReel1);
    assert(resA.success === true, 'Test A: Resolution returned success');
    if (resA.success) {
      assert(resA.media.platform === 'instagram', 'Test A: Platform identified as instagram');
      assert(resA.media.id === 'CY9Kk-xo0vs', `Test A: Extracted media ID (${resA.media.id})`);
      assert(resA.media.mediaType === 'video', 'Test A: Media type classified as video');
      assert(Boolean(resA.media.title), `Test A: Title extracted: "${resA.media.title}"`);
      assert(Boolean(resA.downloadToken), 'Test A: Secure download session token generated');

      const videoVariants = resA.media.variants.filter((v) => v.mimeType.includes('video'));
      assert(videoVariants.length > 0, `Test A: Video variants available (${videoVariants.length})`);

      const primary = videoVariants[0];
      assert(primary.format === 'mp4', 'Test A: Format verified as mp4');
      assert(primary.url.startsWith('https://'), 'Test A: Stream URL is HTTPS');

      // Verify binary download with ffprobe
      if (resA.downloadToken) {
        console.log('Streaming media variant through DownloadManager and executing ffprobe...');
        const dlResult = await verifyRealMediaDownload(engine, resA.downloadToken, primary.id, 'Test A');
        assert(dlResult.success, `Test A: Binary download and ffprobe analysis completed successfully (${(dlResult.sizeBytes / 1024 / 1024).toFixed(2)} MB, ${dlResult.duration.toFixed(1)}s)`);
      }
    }
  } catch (err: any) {
    assert(false, 'Test A: Failed to resolve or download Reel 1', err.message);
  }

  // -------------------------------------------------------------------------
  // 4. Test B: Second Distinct Real Public Instagram Reel (Different Account)
  // -------------------------------------------------------------------------
  await new Promise((r) => setTimeout(r, 2000));
  console.log('\n--- 4. Test B: Second Distinct Real Public Instagram Reel ---');
  const targetReel2 = 'https://www.instagram.com/reel/Ddi7PIlxRaj/';
  console.log(`Resolving distinct Reel: ${targetReel2}`);

  try {
    const resB = await engine.resolveMedia(targetReel2);
    assert(resB.success === true, 'Test B: Resolution returned success', !resB.success ? resB.error.message : undefined);
    if (resB.success) {
      assert(resB.media.platform === 'instagram', 'Test B: Platform identified as instagram');
      assert(resB.media.id === 'Ddi7PIlxRaj', `Test B: Extracted distinct media ID (${resB.media.id})`);
      assert(resB.media.mediaType === 'video', 'Test B: Media type classified as video');
      assert(Boolean(resB.downloadToken), 'Test B: Secure download session token generated');

      const videoVariants = resB.media.variants.filter((v) => v.mimeType.includes('video'));
      assert(videoVariants.length > 0, `Test B: Video variants available (${videoVariants.length})`);

      const primary = videoVariants[0];
      if (resB.downloadToken) {
        console.log('Streaming media variant through DownloadManager and executing ffprobe...');
        const dlResult = await verifyRealMediaDownload(engine, resB.downloadToken, primary.id, 'Test B');
        assert(dlResult.success, `Test B: Binary download and ffprobe analysis completed successfully (${(dlResult.sizeBytes / 1024 / 1024).toFixed(2)} MB, ${dlResult.duration.toFixed(1)}s)`);
      }
    }
  } catch (err: any) {
    assert(false, 'Test B: Failed to resolve or download Reel 2', err.message);
  }

  // -------------------------------------------------------------------------
  // 5. Test C: Real Public Instagram /p/ Post Containing Video
  // -------------------------------------------------------------------------
  await new Promise((r) => setTimeout(r, 2000));
  console.log('\n--- 5. Test C: Real Public Instagram /p/ Post Containing Video ---');
  const targetPostVideo = 'https://www.instagram.com/p/DdbdNnrz6JI/';
  console.log(`Resolving /p/ video post: ${targetPostVideo}`);

  try {
    const resC = await engine.resolveMedia(targetPostVideo);
    assert(resC.success === true, 'Test C: Resolution returned success', !resC.success ? resC.error.message : undefined);
    if (resC.success) {
      assert(resC.media.platform === 'instagram', 'Test C: Platform identified as instagram');
      assert(resC.media.id === 'DdbdNnrz6JI', `Test C: Extracted media ID (${resC.media.id})`);
      assert(resC.media.mediaType === 'video', 'Test C: Media type classified as video');
      assert(Boolean(resC.downloadToken), 'Test C: Secure download session token generated');

      const videoVariants = resC.media.variants.filter((v) => v.mimeType.includes('video'));
      assert(videoVariants.length > 0, `Test C: Video variants available (${videoVariants.length})`);

      const primary = videoVariants[0];
      if (resC.downloadToken) {
        console.log('Streaming media variant through DownloadManager and executing ffprobe...');
        const dlResult = await verifyRealMediaDownload(engine, resC.downloadToken, primary.id, 'Test C');
        assert(dlResult.success, `Test C: Binary download and ffprobe analysis completed successfully (${(dlResult.sizeBytes / 1024 / 1024).toFixed(2)} MB, ${dlResult.duration.toFixed(1)}s)`);
      }
    }
  } catch (err: any) {
    assert(false, 'Test C: Failed to resolve or download /p/ video post', err.message);
  }

  // -------------------------------------------------------------------------
  // 6. Test D: Valid Non-Video Instagram Post (Photo/Carousel Classification)
  // -------------------------------------------------------------------------
  await new Promise((r) => setTimeout(r, 2000));
  console.log('\n--- 6. Test D: Valid Non-Video Instagram Post ---');
  const targetPhotoPost = 'https://www.instagram.com/p/C6hhRYgP0cf/';
  console.log(`Resolving photo post: ${targetPhotoPost}`);

  try {
    const resD = await engine.resolveMedia(targetPhotoPost);
    assert(resD.success === true, 'Test D: Resolution handled successfully', !resD.success ? resD.error.message : undefined);
    if (resD.success) {
      assert(resD.media.platform === 'instagram', 'Test D: Platform identified as instagram');
      assert(resD.media.mediaType === 'image', 'Test D: Correctly classified as image post (not fake video)');
      assert(resD.media.variants.length > 0, `Test D: Image variants returned (${resD.media.variants.length})`);
      assert(resD.media.variants[0].mimeType === 'image/jpeg', 'Test D: MIME type is image/jpeg');
    }
  } catch (err: any) {
    assert(false, 'Test D: Failed to handle non-video Instagram post', err.message);
  }

  // -------------------------------------------------------------------------
  // 7. Test E: Invalid Instagram URL
  // -------------------------------------------------------------------------
  console.log('\n--- 7. Test E: Invalid Instagram URL ---');
  const invalidUrl = 'https://www.instagram.com/invalid-path-not-reel-or-post';

  const resE = await engine.resolveMedia(invalidUrl);
  assert(!resE.success, 'Test E: Invalid URL was rejected');
  if (!resE.success) {
    assert(
      resE.error.code === 'INVALID_URL' || resE.error.code === 'UNSUPPORTED_PLATFORM',
      `Test E: Expected error code returned (${resE.error.code}: ${resE.error.message})`
    );
  }

  // -------------------------------------------------------------------------
  // 8. Test F: Non-Existent or Private Instagram Post
  // -------------------------------------------------------------------------
  await new Promise((r) => setTimeout(r, 2000));
  console.log('\n--- 8. Test F: Non-Existent Instagram Post ---');
  const nonExistentUrl = 'https://www.instagram.com/reel/ZZZZZZZZZZZ/';

  const resF = await engine.resolveMedia(nonExistentUrl);
  assert(!resF.success, 'Test F: Non-existent post was rejected');
  if (!resF.success) {
    assert(
      resF.error.code === 'MEDIA_NOT_FOUND' || resF.error.code === 'PRIVATE_MEDIA' || resF.error.code === 'RESOLUTION_FAILED',
      `Test F: Honest error code returned for missing/private post (${resF.error.code}: ${resF.error.message})`
    );
  }

  // -------------------------------------------------------------------------
  // Final Results
  // -------------------------------------------------------------------------
  console.log('\n===============================================================');
  console.log('INSTAGRAM TEST SUITE SUMMARY:');
  console.log(`  Passed Assertions:     ${passedCount}`);
  console.log(`  Failed Assertions:     ${failedCount}`);
  console.log(`  Real Media Downloads:  ${realDownloadsCount} (probe-verified)`);
  console.log('===============================================================\n');

  if (failedCount > 0) {
    console.error(`❌ Instagram test suite failed with ${failedCount} failure(s).`);
    process.exit(1);
  } else {
    console.log('✅ All Instagram test assertions passed with ZERO false positives.');
    process.exit(0);
  }
}

runInstagramTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
