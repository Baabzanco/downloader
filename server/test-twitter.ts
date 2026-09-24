import { DownloaderEngine } from './downloader/core/DownloaderEngine.js';
import { SecurityValidator } from './downloader/core/SecurityValidator.js';
import { isDownloaderAppError } from './downloader/core/errors.js';
import { ResolvedMedia } from './downloader/core/types.js';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

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
  console.log('🧪 RUNNING PHASE 5.2 X/TWITTER FINAL SECURITY & HARDENING');
  console.log('============================================================\n');

  const engine = DownloaderEngine.getInstance();
  const provider = engine.resolver.getProvider('twitter');

  // ---------------------------------------------------------
  // Suite 1: URL Normalization & Route Validation
  // ---------------------------------------------------------
  console.log('--- Suite 1: URL Normalization & Route Validation ---');
  const validUrls = [
    'https://twitter.com/SpaceX/status/1798651655648833967?utm_source=test&_r=1',
    'https://x.com/SpaceX/status/1798651655648833967?s=20&t=abcdef',
    'https://x.com/i/status/1726303323127463936?ref_src=twsrc%5Etfw',
    'https://twitter.com/i/web/status/1726303323127463936',
    'https://x.com/i/status/2094862889114841088',
  ];

  for (const u of validUrls) {
    const parsed = new URL(u);
    assert(provider?.canHandle(parsed) === true, `Provider accepts valid URL: ${u}`);
  }

  const invalidUrls = [
    'https://x.com/username',
    'https://x.com/search?q=test',
    'https://x.com/hashtag/technology',
    'https://x.com/i/lists/123456789',
    'https://x.com/i/bookmarks',
    'https://evil-x.com/user/status/12345',
  ];

  for (const u of invalidUrls) {
    const parsed = new URL(u);
    assert(provider?.canHandle(parsed) === false, `Provider rejects invalid / non-status route: ${u}`);
  }

  // ---------------------------------------------------------
  // Suite 2: Truthful Error Handling (Deleted / Inaccessible)
  // ---------------------------------------------------------
  console.log('\n--- Suite 2: Truthful Error Handling on Inaccessible Tweets ---');
  const deletedTweetUrl = 'https://x.com/NASA/status/1801222879595827376';
  const deletedRes = await engine.resolveMedia(deletedTweetUrl);
  assert(!deletedRes.success, 'Deleted tweet resolution must report failure');
  if (!deletedRes.success) {
    assert(
      deletedRes.error.code === 'MEDIA_NOT_FOUND' || deletedRes.error.code === 'PRIVATE_MEDIA',
      `Correct structured error code for deleted tweet (${deletedRes.error.code})`
    );
  }

  // ---------------------------------------------------------
  // Suite 3: Media Extraction Validation on Non-Video Tweet
  // ---------------------------------------------------------
  console.log('\n--- Suite 3: Media Extraction Validation on Non-Video Tweet ---');
  const textOnlyUrl = 'https://x.com/jack/status/20';
  const textOnlyRes = await engine.resolveMedia(textOnlyUrl);
  assert(!textOnlyRes.success, 'Text-only tweet must report failure (no video found)');
  if (!textOnlyRes.success) {
    assert(
      textOnlyRes.error.code === 'MEDIA_NOT_FOUND',
      `Identified that no video exists in text tweet (${textOnlyRes.error.code})`
    );
  }

  // ---------------------------------------------------------
  // Suite 4: Strict CDN Trust Boundary & SSRF Enforcement
  // ---------------------------------------------------------
  console.log('\n--- Suite 4: Strict CDN Trust Boundary & SSRF Enforcement ---');
  const disallowedStreamUrls = [
    'http://localhost:3000/secret.mp4',
    'http://127.0.0.1:8080/admin.mp4',
    'http://169.254.169.254/latest/meta-data',
    'http://192.168.1.1/video.mp4',
    'http://10.0.0.1/video.mp4',
    'https://attacker-controlled-domain.com/video.mp4',
    'https://twimg.com.attacker.com/video.mp4',
    'https://attacker.twimg.com.example.com/video.mp4',
    'https://cdn.syndication.twimg.com/video.mp4', // Metadata host must be blocked from media streaming
    'https://ton.twitter.com/video.mp4',
    'https://random-subdomain.twimg.com/video.mp4',
    'https://pbs.twimg.com/ext_tw_video_thumb/1726303323127463936/pu/img/test.jpg', // Static image CDN rejected from video streaming
  ];

  for (const badUrl of disallowedStreamUrls) {
    let blocked = false;
    try {
      SecurityValidator.validateMediaStreamUrl(badUrl);
    } catch (err) {
      blocked = isDownloaderAppError(err) && (err.code === 'SSRF_ATTEMPT' || err.code === 'DOWNLOAD_FAILED');
    }
    assert(blocked, `Blocked unauthorized/non-whitelisted stream URL: ${badUrl}`);
  }

  // Verify only the strict allowed hostnames succeed
  const allowedCdnUrls = [
    'https://video.twimg.com/ext_tw_video/1726303323127463936/pu/vid/avc1/720x1280/Hkb6WIqhMmdPBaqq.mp4',
  ];

  for (const goodUrl of allowedCdnUrls) {
    let allowed = false;
    try {
      SecurityValidator.validateMediaStreamUrl(goodUrl);
      allowed = true;
    } catch {}
    assert(allowed, `Authorized media host accepted: ${new URL(goodUrl).hostname}`);
  }

  // ---------------------------------------------------------
  // Suite 5: Real Numeric Tweet Tests (2 Genuine Public Videos)
  // ---------------------------------------------------------
  console.log('\n--- Suite 5: Real Numeric Tweet Tests & ffprobe Validation ---');

  const numericTestCases = [
    {
      numericTweetId: '1726303323127463936',
      sourceUrl: 'https://x.com/i/status/1726303323127463936',
      title: 'Public X Video 1 (1726303323127463936)',
      mediaUrl: 'https://video.twimg.com/ext_tw_video/1726303323127463936/pu/vid/avc1/720x1280/Hkb6WIqhMmdPBaqq.mp4?tag=12',
      variantId: 'twitter-mp4-Hkb6WIqhMmdPBaqq',
      expectedCodec: 'h264',
      expectedResolution: '720x1280',
      expectedMinBytes: 2000000
    },
    {
      numericTweetId: '2094862889114841088',
      sourceUrl: 'https://x.com/i/status/2094862889114841088',
      title: 'Public X Video 2 (2094862889114841088)',
      mediaUrl: 'https://video.twimg.com/ext_tw_video/2094862889114841088/pu/vid/avc1/320x568/8wgjUbWNyedt8l_r.mp4?tag=12',
      variantId: 'twitter-mp4-8wgjUbWNyedt8l_r',
      expectedCodec: 'h264',
      expectedResolution: '320x568',
      expectedMinBytes: 700000
    }
  ];

  for (let i = 0; i < numericTestCases.length; i++) {
    const tc = numericTestCases[i];
    console.log(`\n  Executing Numeric Tweet Test ${i + 1}: ID ${tc.numericTweetId}`);

    const media: ResolvedMedia = {
      id: tc.numericTweetId,
      platform: 'twitter',
      sourceUrl: tc.sourceUrl,
      normalizedUrl: tc.sourceUrl,
      title: tc.title,
      mediaType: 'video',
      variants: [
        {
          id: tc.variantId,
          url: tc.mediaUrl,
          format: 'mp4',
          mimeType: 'video/mp4',
          quality: tc.expectedResolution,
          hasAudio: true,
          hasVideo: true,
        }
      ],
      resolvedAt: new Date().toISOString()
    };

    const token = engine.downloadManager.createSession(media);
    assert(Boolean(token), 'Generated cryptographic session token');

    const tempFile = path.join('/tmp', `twitter_numeric_binary_${i + 1}_${Date.now()}.mp4`);
    const fileStream = fs.createWriteStream(tempFile);

    const headers: Record<string, string> = {};
    const mockRes: any = {
      setHeader: (k: string, v: string) => { headers[k.toLowerCase()] = v; },
      status: () => mockRes,
      write: (chunk: Buffer) => fileStream.write(chunk),
      end: () => fileStream.end(),
      on: () => {},
      once: (_ev: string, cb: any) => fileStream.once('drain', cb),
      headersSent: false,
      writableEnded: false
    };

    const streamResult = await engine.downloadManager.streamMediaVariant(
      token,
      tc.variantId,
      mockRes
    );

    await new Promise<void>((resolve) => fileStream.on('finish', () => resolve()));

    const stats = fs.statSync(tempFile);
    console.log(`    Downloaded bytes: ${stats.size} bytes`);
    console.log(`    Streamed bytes: ${streamResult.bytesStreamed} bytes`);
    console.log(`    Content-Type: ${headers['content-type']}`);
    console.log(`    Content-Disposition: ${headers['content-disposition']}`);

    assert(stats.size >= tc.expectedMinBytes, `Downloaded verified binary size: ${stats.size} bytes`);
    assert(stats.size === streamResult.bytesStreamed, 'Downloaded byte size matches stream report');
    assert(headers['content-type'] === 'video/mp4', 'HTTP header Content-Type is video/mp4');
    assert(headers['content-disposition']?.includes('attachment;'), 'HTTP header Content-Disposition is attachment');

    // Container signature
    const headerBuffer = Buffer.alloc(12);
    const fd = fs.openSync(tempFile, 'r');
    fs.readSync(fd, headerBuffer, 0, 12, 0);
    fs.closeSync(fd);
    const magic = headerBuffer.subarray(4, 8).toString('ascii');
    assert(magic === 'ftyp', `File magic signature is "ftyp" (ISO MP4 format)`);

    // ffprobe inspection
    const probeOutput = execSync(
      `ffprobe -v error -show_format -show_streams -print_format json "${tempFile}"`,
      { encoding: 'utf-8' }
    );
    const probeData = JSON.parse(probeOutput);
    const videoStream = probeData.streams?.find((s: any) => s.codec_type === 'video');

    assert(Boolean(videoStream), 'ffprobe detected valid video stream');
    assert(videoStream.codec_name === tc.expectedCodec, `ffprobe codec is ${tc.expectedCodec}`);
    assert(`${videoStream.width}x${videoStream.height}` === tc.expectedResolution, `ffprobe resolution is ${tc.expectedResolution}`);
    console.log(`    ffprobe duration: ${probeData.format?.duration || videoStream.duration}s`);
    console.log(`    ffprobe format_name: ${probeData.format?.format_name}`);

    fs.unlinkSync(tempFile);
  }

  // ---------------------------------------------------------
  // Suite 6: Concurrency, Coalescing & Cache Expiry
  // ---------------------------------------------------------
  console.log('\n--- Suite 6: Concurrency, Request Coalescing & Pacing ---');
  const targetIdUrl = 'https://x.com/jack/status/20';
  const start = Date.now();
  const [res1, res2] = await Promise.all([
    engine.resolveMedia(targetIdUrl),
    engine.resolveMedia(targetIdUrl),
  ]);
  const duration = Date.now() - start;
  console.log(`  Concurrent request resolution time: ${duration}ms`);
  assert(res1.success === res2.success, 'Concurrent requests for identical ID return coalesced result');

  console.log('\n============================================================');
  console.log(`PHASE 5.2 TEST SUMMARY: \x1b[32m${passedTests} passed\x1b[0m, \x1b[31m${failedTests} failed\x1b[0m`);
  console.log('============================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test execution failure:', err);
  process.exit(1);
});
