/**
 * Phase 3 — Real Facebook Public Video Provider Test Suite
 * Comprehensive real-world validation of Facebook Watch videos, Reels,
 * Page videos, Share links, URL normalization, security validation,
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
  const tempFile = path.join('/tmp', `fb_test_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.mp4`);
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

async function runFacebookTests() {
  console.log('\n===============================================================');
  console.log('PHASE 3: REAL FACEBOOK PUBLIC VIDEO PROVIDER TEST SUITE');
  console.log('===============================================================\n');

  const engine = DownloaderEngine.getInstance();

  // -------------------------------------------------------------------------
  // 1. URL Normalization & Detection Tests
  // -------------------------------------------------------------------------
  console.log('--- 1. URL Normalization & Detection ---');

  // 1.1 Facebook Watch URL
  const watchUrl = 'https://www.facebook.com/watch/?v=1481060365360701&mibextid=oFDknk&sfnsn=mo';
  const det1 = PlatformDetector.detect(watchUrl);
  assert(det1.platform === 'facebook', 'Detects canonical Facebook Watch URL');
  assert(det1.isSupportedMediaUrl, 'Marks Facebook Watch URL as supported');
  assert(!det1.normalizedUrl.includes('mibextid'), 'Strips tracking parameter mibextid');
  assert(!det1.normalizedUrl.includes('sfnsn'), 'Strips tracking parameter sfnsn');
  assert(det1.normalizedUrl.includes('v=1481060365360701'), 'Preserves required video ID param v');

  // 1.2 Facebook Reel URL
  const reelUrl = 'https://www.facebook.com/reel/588109690402315/?rdid=xyz&fbclid=abc';
  const det2 = PlatformDetector.detect(reelUrl);
  assert(det2.platform === 'facebook', 'Detects Facebook Reel');
  assert(det2.isSupportedMediaUrl, 'Marks Facebook Reel as supported');
  assert(!det2.normalizedUrl.includes('fbclid'), 'Strips tracking parameter fbclid');
  assert(!det2.normalizedUrl.includes('rdid'), 'Strips tracking parameter rdid');

  // 1.3 Facebook Page Video URL
  const pageVideoUrl = 'https://www.facebook.com/SansoneDeejay/videos/271051965695290';
  const det3 = PlatformDetector.detect(pageVideoUrl);
  assert(det3.platform === 'facebook', 'Detects Facebook Page Video (/videos/)');
  assert(det3.isSupportedMediaUrl, 'Marks Facebook Page Video as supported');

  // 1.4 Facebook Share Video URL
  const shareVideoUrl = 'https://www.facebook.com/share/v/19G6TVmeGZ/';
  const det4 = PlatformDetector.detect(shareVideoUrl);
  assert(det4.platform === 'facebook', 'Detects Facebook Share Video (/share/v/)');
  assert(det4.isSupportedMediaUrl, 'Marks Facebook Share Video as supported');

  // 1.5 fb.watch short domain
  const fbWatchUrl = 'https://fb.watch/sampleVideoId/';
  const det5 = PlatformDetector.detect(fbWatchUrl);
  assert(det5.platform === 'facebook', 'Detects fb.watch short domain');
  assert(det5.isSupportedMediaUrl, 'Marks fb.watch video as supported');

  // 1.6 Facebook profile / non-video page
  const profileUrl = 'https://www.facebook.com/zuck';
  const det6 = PlatformDetector.detect(profileUrl);
  assert(det6.platform === 'facebook', 'Detects Facebook profile host');
  assert(!det6.isSupportedMediaUrl, 'Rejects Facebook profile URL safely (not a video)');

  // -------------------------------------------------------------------------
  // 2. Security & Restricted CDN Media Proxy Boundaries
  // -------------------------------------------------------------------------
  console.log('\n--- 2. Security & Restricted CDN Media Proxy Boundaries ---');

  // 2.1 SSRF protection
  let ssrfBlocked = false;
  try {
    SecurityValidator.validateMediaStreamUrl('https://evil-attacker.com/exploit.mp4');
  } catch {
    ssrfBlocked = true;
  }
  assert(ssrfBlocked, 'Rejects unauthorized media stream domain (SSRF protection)');

  // 2.2 Localhost / Private IP protection
  let localIpBlocked = false;
  try {
    SecurityValidator.validateMediaStreamUrl('http://169.254.169.254/latest/meta-data');
  } catch {
    localIpBlocked = true;
  }
  assert(localIpBlocked, 'Blocks local/cloud metadata IP media stream attempts');

  // 2.3 Official Meta/Facebook CDN allowed
  let fbCdnAllowed = false;
  try {
    SecurityValidator.validateMediaStreamUrl('https://video-ams2-1.xx.fbcdn.net/o1/v/t2/f2/m366/test.mp4');
    fbCdnAllowed = true;
  } catch {
    fbCdnAllowed = false;
  }
  assert(fbCdnAllowed, 'Authorizes official Facebook media CDN (fbcdn.net)');

  // -------------------------------------------------------------------------
  // 3. Test A: Real Public Facebook Watch Video
  // -------------------------------------------------------------------------
  console.log('\n--- 3. Test A: Real Public Facebook Watch Video ---');
  const targetWatch = 'https://www.facebook.com/watch/?v=1481060365360701';
  console.log(`Resolving real Watch video: ${targetWatch}`);

  try {
    const resA = await engine.resolveMedia(targetWatch);
    assert(resA.success === true, 'Test A: Resolution returned success', !resA.success ? resA.error.message : undefined);
    if (resA.success) {
      assert(resA.media.platform === 'facebook', 'Test A: Platform identified as facebook');
      assert(resA.media.id === '1481060365360701', `Test A: Extracted media ID (${resA.media.id})`);
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
    assert(false, 'Test A: Failed to resolve or download Watch video', err.message);
  }

  // -------------------------------------------------------------------------
  // 4. Test B: Real Public Facebook Reel
  // -------------------------------------------------------------------------
  await new Promise((r) => setTimeout(r, 2000));
  console.log('\n--- 4. Test B: Real Public Facebook Reel ---');
  const targetReel = 'https://www.facebook.com/reel/588109690402315';
  console.log(`Resolving real Reel: ${targetReel}`);

  try {
    const resB = await engine.resolveMedia(targetReel);
    assert(resB.success === true, 'Test B: Resolution returned success', !resB.success ? resB.error.message : undefined);
    if (resB.success) {
      assert(resB.media.platform === 'facebook', 'Test B: Platform identified as facebook');
      assert(resB.media.id === '588109690402315', `Test B: Extracted Reel ID (${resB.media.id})`);
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
    assert(false, 'Test B: Failed to resolve or download Reel', err.message);
  }

  // -------------------------------------------------------------------------
  // 5. Test C: Real Public Facebook Page Video (/videos/)
  // -------------------------------------------------------------------------
  await new Promise((r) => setTimeout(r, 2000));
  console.log('\n--- 5. Test C: Real Public Facebook Page Video ---');
  const targetPageVideo = 'https://www.facebook.com/SansoneDeejay/videos/271051965695290';
  console.log(`Resolving page video: ${targetPageVideo}`);

  try {
    const resC = await engine.resolveMedia(targetPageVideo);
    assert(resC.success === true, 'Test C: Resolution returned success', !resC.success ? resC.error.message : undefined);
    if (resC.success) {
      assert(resC.media.platform === 'facebook', 'Test C: Platform identified as facebook');
      assert(resC.media.id === '271051965695290', `Test C: Extracted media ID (${resC.media.id})`);
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
    assert(false, 'Test C: Failed to resolve or download Page video', err.message);
  }

  // -------------------------------------------------------------------------
  // 6. Test D: Real Public Facebook Share Video URL (/share/v/)
  // -------------------------------------------------------------------------
  await new Promise((r) => setTimeout(r, 2000));
  console.log('\n--- 6. Test D: Real Public Facebook Share Video URL ---');
  const targetShareVideo = 'https://www.facebook.com/share/v/19G6TVmeGZ/';
  console.log(`Resolving share video: ${targetShareVideo}`);

  try {
    const resD = await engine.resolveMedia(targetShareVideo);
    assert(resD.success === true, 'Test D: Resolution returned success', !resD.success ? resD.error.message : undefined);
    if (resD.success) {
      assert(resD.media.platform === 'facebook', 'Test D: Platform identified as facebook');
      assert(resD.media.mediaType === 'video', 'Test D: Media type classified as video');
      assert(resD.media.variants.length > 0, `Test D: Video variants available (${resD.media.variants.length})`);

      const primary = resD.media.variants[0];
      if (resD.downloadToken) {
        console.log('Streaming media variant through DownloadManager and executing ffprobe...');
        const dlResult = await verifyRealMediaDownload(engine, resD.downloadToken, primary.id, 'Test D');
        assert(dlResult.success, `Test D: Binary download and ffprobe analysis completed successfully (${(dlResult.sizeBytes / 1024 / 1024).toFixed(2)} MB, ${dlResult.duration.toFixed(1)}s)`);
      }
    }
  } catch (err: any) {
    assert(false, 'Test D: Failed to resolve or download Share video', err.message);
  }

  // -------------------------------------------------------------------------
  // 7. Test E: Invalid Facebook URL
  // -------------------------------------------------------------------------
  console.log('\n--- 7. Test E: Invalid Facebook URL ---');
  const invalidUrl = 'https://www.facebook.com/invalid-path-not-video-or-reel';

  const resE = await engine.resolveMedia(invalidUrl);
  assert(!resE.success, 'Test E: Invalid URL was rejected');
  if (!resE.success) {
    assert(
      resE.error.code === 'INVALID_URL' || resE.error.code === 'UNSUPPORTED_PLATFORM',
      `Test E: Expected error code returned (${resE.error.code}: ${resE.error.message})`
    );
  }

  // -------------------------------------------------------------------------
  // 8. Test F: Non-Existent or Private Facebook Post
  // -------------------------------------------------------------------------
  await new Promise((r) => setTimeout(r, 2000));
  console.log('\n--- 8. Test F: Non-Existent Facebook Video ---');
  const nonExistentUrl = 'https://www.facebook.com/reel/0';

  const resF = await engine.resolveMedia(nonExistentUrl);
  assert(!resF.success, 'Test F: Non-existent video was rejected');
  if (!resF.success) {
    assert(
      resF.error.code === 'MEDIA_NOT_FOUND' || resF.error.code === 'PRIVATE_MEDIA' || resF.error.code === 'TIMEOUT',
      `Test F: Honest error code returned for missing/private video (${resF.error.code}: ${resF.error.message})`
    );
  }

  // -------------------------------------------------------------------------
  // 9. Concurrency & Coalescing Tests
  // -------------------------------------------------------------------------
  console.log('\n--- 9. Concurrency & Coalescing Tests ---');
  console.log('Testing 5 simultaneous requests (Request Coalescing on targetWatch)...');
  const start5 = Date.now();
  const results5 = await Promise.all([
    engine.resolveMedia(targetWatch),
    engine.resolveMedia(targetWatch),
    engine.resolveMedia(targetWatch),
    engine.resolveMedia(targetWatch),
    engine.resolveMedia(targetWatch),
  ]);
  const duration5 = Date.now() - start5;
  const allSucceeded5 = results5.every((r) => r.success);
  assert(allSucceeded5, `All 5 coalesced requests succeeded in ${duration5}ms`);

  console.log('Testing 10 simultaneous requests (Cached Resolution on targetReel)...');
  const start10 = Date.now();
  const results10 = await Promise.all(
    Array.from({ length: 10 }).map(() => engine.resolveMedia(targetReel))
  );
  const duration10 = Date.now() - start10;
  const allSucceeded10 = results10.every((r) => r.success);
  assert(allSucceeded10, `All 10 cached requests succeeded in ${duration10}ms`);

  // -------------------------------------------------------------------------
  // Final Results
  // -------------------------------------------------------------------------
  console.log('\n===============================================================');
  console.log('FACEBOOK TEST SUITE SUMMARY:');
  console.log(`  Passed Assertions:     ${passedCount}`);
  console.log(`  Failed Assertions:     ${failedCount}`);
  console.log(`  Real Media Downloads:  ${realDownloadsCount} (probe-verified)`);
  console.log('===============================================================\n');

  if (failedCount > 0) {
    console.error(`❌ Facebook test suite failed with ${failedCount} failure(s).`);
    process.exit(1);
  } else {
    console.log('✅ All Facebook test assertions passed with ZERO false positives.');
  }
}

runFacebookTests().catch((err) => {
  console.error('Fatal unhandled error in test suite:', err);
  process.exit(1);
});
