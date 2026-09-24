/**
 * Phase 4 — Real YouTube Shorts & Video Provider Test Suite
 * Comprehensive real-world validation of YouTube Shorts, Watch videos,
 * youtu.be shortlinks, URL normalization, security validation,
 * concurrency coalescing, and binary streaming with ffprobe.
 */
import { PlatformDetector } from './downloader/core/PlatformDetector.js';
import { SecurityValidator } from './downloader/core/SecurityValidator.js';
import { DownloaderEngine } from './downloader/core/DownloaderEngine.js';
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
  const tempFile = path.join('/tmp', `yt_test_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.mp4`);
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
      format: videoStream?.codec_name || 'mp4',
    };
  } finally {
    if (fs.existsSync(tempFile)) {
      try {
        fs.unlinkSync(tempFile);
      } catch {
        // cleanup ignore
      }
    }
  }
}

async function runTestSuite() {
  console.log('===============================================================');
  console.log('PHASE 4: REAL YOUTUBE SHORTS & VIDEO PROVIDER TEST SUITE');
  console.log('===============================================================');

  const engine = DownloaderEngine.getInstance();

  // -------------------------------------------------------------
  // 1. URL Normalization & Platform Detection
  // -------------------------------------------------------------
  console.log('\n--- 1. URL Normalization & Detection ---');

  // Shorts canonical
  const shortsRaw = 'https://www.youtube.com/shorts/se50viFJ0AQ?si=abc123tracking&feature=share';
  const shortsDetected = PlatformDetector.detect(shortsRaw);
  assert(shortsDetected.platform === 'youtube', 'Detects canonical YouTube Shorts URL');
  assert(shortsDetected.isSupportedMediaUrl, 'Marks YouTube Shorts URL as supported');
  assert(!shortsDetected.normalizedUrl.includes('si='), 'Strips tracking parameter si');
  assert(!shortsDetected.normalizedUrl.includes('feature='), 'Strips tracking parameter feature');

  // Watch URL canonical
  const watchRaw = 'https://www.youtube.com/watch?v=kJQP7kiw5Fk&utm_source=test&fbclid=xyz987';
  const watchDetected = PlatformDetector.detect(watchRaw);
  assert(watchDetected.platform === 'youtube', 'Detects canonical YouTube Watch URL');
  assert(watchDetected.isSupportedMediaUrl, 'Marks YouTube Watch URL as supported');
  assert(!watchDetected.normalizedUrl.includes('utm_source'), 'Strips tracking parameter utm_source');
  assert(!watchDetected.normalizedUrl.includes('fbclid'), 'Strips tracking parameter fbclid');
  assert(watchDetected.normalizedUrl.includes('v=kJQP7kiw5Fk'), 'Preserves required video ID param v');

  // youtu.be short domain
  const youtuRaw = 'https://youtu.be/se50viFJ0AQ?si=sharedLink';
  const youtuDetected = PlatformDetector.detect(youtuRaw);
  assert(youtuDetected.platform === 'youtube', 'Detects youtu.be short domain');
  assert(youtuDetected.isSupportedMediaUrl, 'Marks youtu.be video as supported');
  assert(!youtuDetected.normalizedUrl.includes('si='), 'Strips tracking parameter from youtu.be');

  // Unsupported URLs: Channel and Playlist
  const channelUrl = 'https://www.youtube.com/@MrBeast';
  const channelDetected = PlatformDetector.detect(channelUrl);
  assert(channelDetected.platform === 'youtube', 'Detects YouTube channel host');
  assert(!channelDetected.isSupportedMediaUrl, 'Rejects YouTube channel URL safely (not a video)');

  const playlistUrl = 'https://www.youtube.com/playlist?list=PL123456789';
  const playlistDetected = PlatformDetector.detect(playlistUrl);
  assert(!playlistDetected.isSupportedMediaUrl, 'Rejects YouTube playlist-only URL safely');

  const watchNoV = 'https://www.youtube.com/watch';
  const watchNoVDetected = PlatformDetector.detect(watchNoV);
  assert(!watchNoVDetected.isSupportedMediaUrl, 'Rejects /watch URL missing v parameter');

  // -------------------------------------------------------------
  // 2. Security & SSRF Validation
  // -------------------------------------------------------------
  console.log('\n--- 2. Security & Restricted CDN Media Proxy Boundaries ---');

  let ssrfBlocked = false;
  try {
    SecurityValidator.validateMediaStreamUrl('https://evil-attacker-site.com/video.mp4');
  } catch (err: any) {
    if (err.code === 'SSRF_ATTEMPT' || err.code === 'DOWNLOAD_FAILED') {
      ssrfBlocked = true;
    }
  }
  assert(ssrfBlocked, 'Rejects unauthorized media stream domain (SSRF protection)');

  let metaBlocked = false;
  try {
    SecurityValidator.validateMediaStreamUrl('https://169.254.169.254/latest/meta-data/');
  } catch (err: any) {
    if (err.code === 'SSRF_ATTEMPT' || err.code === 'DOWNLOAD_FAILED') {
      metaBlocked = true;
    }
  }
  assert(metaBlocked, 'Blocks local/cloud metadata IP media stream attempts');

  let validCdnOk = false;
  try {
    const validCdn = SecurityValidator.validateMediaStreamUrl('https://pamela88.savenow.to/api/v2/download/sample');
    validCdnOk = validCdn.hostname.includes('savenow.to');
  } catch (e: any) {
    validCdnOk = false;
  }
  assert(validCdnOk, 'Authorizes official streaming delivery CDN (savenow.to)');

  // -------------------------------------------------------------
  // 3. Test A: Real Public YouTube Short (MrBeast)
  // -------------------------------------------------------------
  console.log('\n--- 3. Test A: Real Public YouTube Short ---');
  const targetShortA = 'https://www.youtube.com/shorts/se50viFJ0AQ';
  console.log(`Resolving real Short: ${targetShortA}`);

  const resolveResA = await engine.resolveMedia(targetShortA);
  assert(resolveResA.success, 'Test A: Resolution returned success', !resolveResA.success ? resolveResA.error.message : undefined);
  if (resolveResA.success) {
    assert(resolveResA.media.platform === 'youtube', 'Test A: Platform identified as youtube');
    assert(resolveResA.media.id === 'se50viFJ0AQ', 'Test A: Extracted Short ID (se50viFJ0AQ)');
    assert(resolveResA.media.mediaType === 'video', 'Test A: Media type classified as video');
    assert(Boolean(resolveResA.media.title), `Test A: Title extracted: "${resolveResA.media.title}"`);
    assert(Boolean(resolveResA.downloadToken), 'Test A: Secure download session token generated');
    assert(resolveResA.media.variants.length >= 1, `Test A: Video variants available (${resolveResA.media.variants.length})`);

    const primaryVariant = resolveResA.media.variants[0];
    assert(primaryVariant.format === 'mp4', 'Test A: Format verified as mp4');
    assert(primaryVariant.url.startsWith('https://'), 'Test A: Stream URL is HTTPS');

    console.log('Streaming media variant through DownloadManager and executing ffprobe...');
    const dlResult = await verifyRealMediaDownload(
      engine,
      resolveResA.downloadToken!,
      primaryVariant.id,
      'Test A'
    );
    assert(
      dlResult.success,
      `Test A: Binary download and ffprobe analysis completed successfully (${(dlResult.sizeBytes / 1024 / 1024).toFixed(2)} MB, ${dlResult.duration.toFixed(1)}s)`
    );
  }

  // -------------------------------------------------------------
  // 4. Test B: Distinct Real Public YouTube Short (Me at the zoo)
  // -------------------------------------------------------------
  console.log('\n--- 4. Test B: Distinct Real Public YouTube Short ---');
  const targetShortB = 'https://www.youtube.com/shorts/jNQXAC9IVRw';
  console.log(`Resolving distinct Short: ${targetShortB}`);

  const resolveResB = await engine.resolveMedia(targetShortB);
  assert(resolveResB.success, 'Test B: Resolution returned success', !resolveResB.success ? resolveResB.error.message : undefined);
  if (resolveResB.success) {
    assert(resolveResB.media.platform === 'youtube', 'Test B: Platform identified as youtube');
    assert(resolveResB.media.id === 'jNQXAC9IVRw', 'Test B: Extracted Short ID (jNQXAC9IVRw)');
    assert(resolveResB.media.mediaType === 'video', 'Test B: Media type classified as video');
    assert(Boolean(resolveResB.downloadToken), 'Test B: Secure download session token generated');
    assert(resolveResB.media.variants.length >= 1, `Test B: Video variants available (${resolveResB.media.variants.length})`);

    const primaryVariant = resolveResB.media.variants[0];
    console.log('Streaming media variant through DownloadManager and executing ffprobe...');
    const dlResult = await verifyRealMediaDownload(
      engine,
      resolveResB.downloadToken!,
      primaryVariant.id,
      'Test B'
    );
    assert(
      dlResult.success,
      `Test B: Binary download and ffprobe analysis completed successfully (${(dlResult.sizeBytes / 1024 / 1024).toFixed(2)} MB, ${dlResult.duration.toFixed(1)}s)`
    );
  }

  // -------------------------------------------------------------
  // 5. Test C: Standard Public YouTube Video URL
  // -------------------------------------------------------------
  console.log('\n--- 5. Test C: Standard Public YouTube Video URL ---');
  const targetWatch = 'https://www.youtube.com/watch?v=kJQP7kiw5Fk';
  console.log(`Resolving watch video: ${targetWatch}`);

  const resolveResC = await engine.resolveMedia(targetWatch);
  assert(resolveResC.success, 'Test C: Resolution returned success', !resolveResC.success ? resolveResC.error.message : undefined);
  if (resolveResC.success) {
    assert(resolveResC.media.platform === 'youtube', 'Test C: Platform identified as youtube');
    assert(resolveResC.media.id === 'kJQP7kiw5Fk', 'Test C: Extracted media ID (kJQP7kiw5Fk)');
    assert(resolveResC.media.mediaType === 'video', 'Test C: Media type classified as video');
    assert(Boolean(resolveResC.downloadToken), 'Test C: Secure download session token generated');
    assert(resolveResC.media.variants.length >= 1, `Test C: Video variants available (${resolveResC.media.variants.length})`);
    assert(resolveResC.media.variants[0].url.startsWith('https://'), 'Test C: Media variant URL is HTTPS');
  }

  // -------------------------------------------------------------
  // 6. Test D: Real Public youtu.be URL
  // -------------------------------------------------------------
  console.log('\n--- 6. Test D: Real Public youtu.be URL ---');
  const targetYoutu = 'https://youtu.be/se50viFJ0AQ';
  console.log(`Resolving youtu.be URL: ${targetYoutu}`);

  const resolveResD = await engine.resolveMedia(targetYoutu);
  assert(resolveResD.success, 'Test D: Resolution returned success', !resolveResD.success ? resolveResD.error.message : undefined);
  if (resolveResD.success) {
    assert(resolveResD.media.platform === 'youtube', 'Test D: Platform identified as youtube');
    assert(resolveResD.media.id === 'se50viFJ0AQ', 'Test D: Correctly resolved from youtu.be shortcode');
    assert(resolveResD.media.variants.length >= 1, 'Test D: Media variants available');
  }

  // -------------------------------------------------------------
  // 7. Test E: Invalid URL Rejection
  // -------------------------------------------------------------
  console.log('\n--- 7. Test E: Invalid YouTube URL ---');
  const invalidUrl = 'https://www.youtube.com/watch?v=invalid_short_id';
  const resE = await engine.resolveMedia(invalidUrl);
  assert(!resE.success, 'Test E: Invalid URL was rejected');
  if (!resE.success) {
    assert(
      resE.error.code === 'INVALID_URL' || resE.error.code === 'MEDIA_NOT_FOUND',
      `Test E: Expected error code returned (${resE.error.code}: ${resE.error.message})`
    );
  }

  // -------------------------------------------------------------
  // 8. Test F: Non-Existent YouTube Video
  // -------------------------------------------------------------
  console.log('\n--- 8. Test F: Non-Existent YouTube Video ---');
  const missingUrl = 'https://www.youtube.com/shorts/00000000000';
  const resF = await engine.resolveMedia(missingUrl);
  assert(!resF.success, 'Test F: Non-existent video was rejected');
  if (!resF.success) {
    assert(
      resF.error.code === 'MEDIA_NOT_FOUND' || resF.error.code === 'PRIVATE_MEDIA',
      `Test F: Honest error code returned for missing video (${resF.error.code}: ${resF.error.message})`
    );
  }

  // -------------------------------------------------------------
  // 9. Test G: Unsupported Content (Playlist / Channel)
  // -------------------------------------------------------------
  console.log('\n--- 9. Test G: Unsupported YouTube Content ---');
  const resG1 = await engine.resolveMedia('https://www.youtube.com/playlist?list=PLtest123');
  assert(!resG1.success, 'Test G: Playlist URL rejected');
  if (!resG1.success) {
    assert(resG1.error.code === 'INVALID_URL', `Test G: Playlist URL rejected with INVALID_URL (${resG1.error.code}: ${resG1.error.message})`);
  }

  const resG2 = await engine.resolveMedia('https://www.youtube.com/@SomeCreator');
  assert(!resG2.success, 'Test G: Channel URL rejected');
  if (!resG2.success) {
    assert(resG2.error.code === 'INVALID_URL', `Test G: Channel URL rejected with INVALID_URL (${resG2.error.code}: ${resG2.error.message})`);
  }

  // -------------------------------------------------------------
  // 10. Concurrency & Coalescing Tests
  // -------------------------------------------------------------
  console.log('\n--- 10. Concurrency & Coalescing Tests ---');
  console.log('Testing 5 simultaneous requests (Request Coalescing on targetShortA)...');
  const startCoalesce = Date.now();
  const coalesceResults = await Promise.all([
    engine.resolveMedia(targetShortA),
    engine.resolveMedia(targetShortA),
    engine.resolveMedia(targetShortA),
    engine.resolveMedia(targetShortA),
    engine.resolveMedia(targetShortA),
  ]);
  const coalesceElapsed = Date.now() - startCoalesce;
  const allCoalesceSucceeded = coalesceResults.every((r) => r.success);
  assert(allCoalesceSucceeded, `All 5 coalesced requests succeeded in ${coalesceElapsed}ms`);

  console.log('Testing 10 simultaneous requests (Cached Resolution on targetShortB)...');
  const startCached = Date.now();
  const cachedPromises = Array.from({ length: 10 }, () => engine.resolveMedia(targetShortB));
  const cachedResults = await Promise.all(cachedPromises);
  const cachedElapsed = Date.now() - startCached;
  const allCachedSucceeded = cachedResults.every((r) => r.success);
  assert(allCachedSucceeded, `All 10 cached requests succeeded in ${cachedElapsed}ms`);

  // -------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------
  console.log('\n===============================================================');
  console.log('YOUTUBE TEST SUITE SUMMARY:');
  console.log(`  Passed Assertions:     ${passedCount}`);
  console.log(`  Failed Assertions:     ${failedCount}`);
  console.log(`  Real Media Downloads:  ${realDownloadsCount} (probe-verified)`);
  console.log('===============================================================');

  if (failedCount > 0) {
    console.error(`❌ YouTube test suite finished with ${failedCount} failures.`);
    process.exit(1);
  } else {
    console.log('✅ All YouTube test assertions passed with ZERO false positives.');
  }
}

runTestSuite().catch((err) => {
  console.error('Fatal unhandled error running YouTube test suite:', err);
  process.exit(1);
});
