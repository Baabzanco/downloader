/**
 * Phase 6: Real Pinterest Public Video Provider Test Suite
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

async function verifyRealMediaDownload(
  engine: DownloaderEngine,
  downloadToken: string,
  variantId: string,
  label: string
): Promise<{ success: boolean; sizeBytes: number; duration: number; format: string }> {
  const tempFile = path.join('/tmp', `pin_test_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.mp4`);
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
      headers['content-type'] === 'video/mp4' || headers['content-type'] === 'video/quicktime',
      `[${label}] HTTP Content-Type verified as video/mp4 (${headers['content-type']})`
    );

    // Validate ISO Base Media header
    const buffer = Buffer.alloc(12);
    const fd = fs.openSync(tempFile, 'r');
    fs.readSync(fd, buffer, 0, 12, 0);
    fs.closeSync(fd);
    const magicBox = buffer.subarray(4, 8).toString('ascii');
    assert(magicBox === 'ftyp', `[${label}] Container signature verified: ISO Base Media 'ftyp'`);

    // Execute ffprobe
    const { stdout } = await execFileAsync('ffprobe', [
      '-v',
      'error',
      '-show_entries',
      'stream=codec_name,codec_type,width,height:format=duration',
      '-of',
      'json',
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
      } catch {}
    }
  }
}

async function runPinterestTests() {
  console.log('\n===============================================================');
  console.log('PHASE 6: REAL PINTEREST PUBLIC VIDEO PROVIDER TEST SUITE');
  console.log('===============================================================\n');

  const engine = DownloaderEngine.getInstance();

  // 1. URL Normalization & Route Matching
  console.log('--- 1. URL Normalization & Detection ---');
  const validPins = [
    'https://www.pinterest.com/pin/848365648603016583/',
    'https://pinterest.com/pin/848365648603016583?utm_source=share',
    'https://pin.it/7xYZ123',
  ];

  for (const url of validPins) {
    const d = PlatformDetector.detect(url);
    assert(d.platform === 'pinterest', `Detects Pinterest platform for ${url}`);
    assert(d.isSupportedMediaUrl, `Marks ${url} as supported media URL`);
  }

  const invalidUrls = [
    'https://www.pinterest.com/username/',
    'https://www.pinterest.com/search/pins/?q=food',
  ];

  for (const url of invalidUrls) {
    const d = PlatformDetector.detect(url);
    assert(!d.isSupportedMediaUrl, `Rejects non-pin route safely: ${url}`);
  }

  // 2. Security Boundaries & CDN validation
  console.log('\n--- 2. Security & Restricted CDN Media Proxy Boundaries ---');
  let rejectedSsrf = false;
  try {
    SecurityValidator.validateMediaStreamUrl('https://evil-attacker.com/video.mp4');
  } catch (err) {
    rejectedSsrf = true;
  }
  assert(rejectedSsrf, 'Rejects unauthorized stream domain');

  let acceptedV1 = false;
  try {
    SecurityValidator.validateMediaStreamUrl('https://v1.pinimg.com/videos/mc/720p/test.mp4');
    acceptedV1 = true;
  } catch {}
  assert(acceptedV1, 'Authorizes official Pinterest video CDN (v1.pinimg.com)');

  let acceptedV2 = false;
  try {
    SecurityValidator.validateMediaStreamUrl('https://v2.pinimg.com/videos/mc/exp7/test.mp4');
    acceptedV2 = true;
  } catch {}
  assert(acceptedV2, 'Authorizes official Pinterest video CDN (v2.pinimg.com)');

  let rejectedImageCdn = false;
  try {
    SecurityValidator.validateMediaStreamUrl('https://i.pinimg.com/originals/photo.jpg');
  } catch {
    rejectedImageCdn = true;
  }
  assert(rejectedImageCdn, 'Rejects static image CDN (i.pinimg.com) from media video streaming');

  // 3. Live Pin Video Resolution & ffprobe binary download
  console.log('\n--- 3. Live Pinterest Video Resolution & Download ---');
  const livePinUrl = 'https://www.pinterest.com/pin/848365648603016583/';
  const resolveRes = await engine.resolveMedia(livePinUrl);

  assert(resolveRes.success, 'Live Pinterest resolution completed with success: true');
  if (resolveRes.success) {
    assert(resolveRes.media.platform === 'pinterest', 'Platform correctly identified as pinterest');
    assert(Boolean(resolveRes.media.title), 'Pin title extracted accurately');
    assert(Boolean(resolveRes.media.variants && resolveRes.media.variants.length > 0), 'Found video variants');
    assert(Boolean(resolveRes.downloadToken), 'Generated valid session download token');

    if (resolveRes.downloadToken) {
      const variant = resolveRes.media.variants[0];
      await verifyRealMediaDownload(engine, resolveRes.downloadToken, variant.id, 'Live Pin Video');
    }
  }

  // 4. Honest Error Handling
  console.log('\n--- 4. Honest Error Handling ---');
  const nonExistentRes = await engine.resolveMedia('https://www.pinterest.com/pin/999999999999999999/');
  assert(!nonExistentRes.success, 'Non-existent pin returns failure');
  if (!nonExistentRes.success) {
    assert(
      nonExistentRes.error.code === 'MEDIA_NOT_FOUND' || nonExistentRes.error.code === 'RESOLUTION_FAILED',
      `Honest error code returned: ${nonExistentRes.error.code}`
    );
  }

  console.log('\n===============================================================');
  console.log(`PINTEREST TEST SUITE SUMMARY:`);
  console.log(`  Passed Assertions:     ${passedCount}`);
  console.log(`  Failed Assertions:     ${failedCount}`);
  console.log(`  Real Media Downloads:  ${realDownloadsCount} (probe-verified)`);
  console.log('===============================================================');

  if (failedCount > 0) {
    process.exit(1);
  }
}

runPinterestTests().catch((err) => {
  console.error('Pinterest test suite error:', err);
  process.exit(1);
});
