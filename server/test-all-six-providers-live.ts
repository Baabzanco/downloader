import { spawn, execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execFileAsync = promisify(execFile);

const PROD_PORT = 3200 + Math.floor(Math.random() * 500);
const BASE_URL = `http://127.0.0.1:${PROD_PORT}`;

interface ProviderTestSpec {
  platform: string;
  name: string;
  testUrl: string;
}

const PROVIDERS: ProviderTestSpec[] = [
  {
    platform: 'tiktok',
    name: 'TikTok Video Provider',
    testUrl: 'https://www.tiktok.com/@zachking/video/6768504823336815877',
  },
  {
    platform: 'instagram',
    name: 'Instagram Reels & Video Provider',
    testUrl: 'https://www.instagram.com/reel/CY9Kk-xo0vs/',
  },
  {
    platform: 'facebook',
    name: 'Facebook Video Provider',
    testUrl: 'https://www.facebook.com/watch/?v=1481060365360701',
  },
  {
    platform: 'youtube',
    name: 'YouTube Shorts & Video Provider',
    testUrl: 'https://www.youtube.com/shorts/se50viFJ0AQ',
  },
  {
    platform: 'twitter',
    name: 'X / Twitter Video Provider',
    testUrl: 'https://twitter.com/Twitter/status/1460323737035677698',
  },
  {
    platform: 'pinterest',
    name: 'Pinterest Video Provider',
    testUrl: 'https://www.pinterest.com/pin/848365648603016583/',
  },
];

async function runLiveProductionMatrix() {
  console.log('========================================================================');
  console.log(`STARTING PRODUCTION SERVER ON PORT ${PROD_PORT} (NODE_ENV=production)`);
  console.log('========================================================================\n');

  const prodProcess = spawn('npx', ['tsx', 'server.ts'], {
    env: {
      ...process.env,
      NODE_ENV: 'production',
      PORT: String(PROD_PORT),
    },
    stdio: 'pipe',
  });

  prodProcess.stdout.on('data', (d) => {
    const msg = d.toString().trim();
    if (msg) console.log(`[ServerOut] ${msg}`);
  });
  prodProcess.stderr.on('data', (d) => {
    const msg = d.toString().trim();
    if (msg) console.error(`[ServerErr] ${msg}`);
  });

  try {
    // Wait for server health
    let ready = false;
    for (let i = 0; i < 25; i++) {
      await new Promise((r) => setTimeout(r, 500));
      try {
        const res = await fetch(`${BASE_URL}/api/health`);
        if (res.ok) {
          ready = true;
          break;
        }
      } catch {
        // keep polling
      }
    }

    if (!ready) {
      throw new Error(`Server failed to start on ${BASE_URL} within 12 seconds.`);
    }

    // Verify /api/health
    const healthRes = await fetch(`${BASE_URL}/api/health`);
    const healthJson = await healthRes.json();
    console.log('✔ Health Check:', JSON.stringify(healthJson));
    if (healthJson.environment !== 'production') {
      throw new Error(`Expected environment === "production", got: ${healthJson.environment}`);
    }

    // Verify Diagnostics endpoint is gated in production
    const diagRes = await fetch(`${BASE_URL}/api/media/diagnostics`);
    if (diagRes.status !== 403) {
      throw new Error(`Diagnostics endpoint returned ${diagRes.status}, expected 403 Forbidden.`);
    }
    console.log('✔ Production Diagnostics Gating: HTTP 403 Forbidden verified');

    console.log('\n========================================================================');
    console.log('EXECUTING REAL END-TO-END DOWNLOAD MATRIX ACROSS ALL 6 PROVIDERS');
    console.log('========================================================================\n');

    const matrixReport: any[] = [];

    for (const p of PROVIDERS) {
      console.log(`\n------------------------------------------------------------------------`);
      console.log(`Testing [${p.platform.toUpperCase()}] :: ${p.testUrl}`);
      console.log(`------------------------------------------------------------------------`);

      const t0 = Date.now();
      const resolveRes = await fetch(`${BASE_URL}/api/media/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: p.testUrl }),
      });
      const resolveDuration = Date.now() - t0;

      if (!resolveRes.ok) {
        const errBody = await resolveRes.text();
        throw new Error(`Resolve failed for ${p.platform} (HTTP ${resolveRes.status}): ${errBody}`);
      }

      const resolveData = await resolveRes.json();
      if (!resolveData.success || !resolveData.media || !resolveData.downloadToken) {
        throw new Error(`Invalid resolve payload for ${p.platform}: ${JSON.stringify(resolveData)}`);
      }

      const media = resolveData.media;
      const downloadToken = resolveData.downloadToken;
      const selectedVariant = media.variants[0];

      console.log(`  ✔ Resolution (${resolveDuration}ms): "${media.title?.slice(0, 45)}"`);
      console.log(`  ✔ Variants: ${media.variants.length}, Selected: ${selectedVariant.id} (${selectedVariant.quality})`);

      const parsedStreamHost = new URL(selectedVariant.url).hostname;
      console.log(`  ✔ Media Host: ${parsedStreamHost}`);

      // Perform real binary download via /api/media/download
      const downloadUrl = `${BASE_URL}/api/media/download?token=${encodeURIComponent(
        downloadToken
      )}&variantId=${encodeURIComponent(selectedVariant.id)}`;

      const t1 = Date.now();
      const dlRes = await fetch(downloadUrl);
      const dlDuration = Date.now() - t1;

      if (!dlRes.ok) {
        const errText = await dlRes.text();
        throw new Error(`Download failed for ${p.platform} (HTTP ${dlRes.status}): ${errText}`);
      }

      const contentType = dlRes.headers.get('content-type') || '';
      const contentDisp = dlRes.headers.get('content-disposition') || '';
      const buf = Buffer.from(await dlRes.arrayBuffer());
      const bytesDownloaded = buf.length;

      console.log(`  ✔ Download HTTP ${dlRes.status} (${dlDuration}ms), Content-Type: ${contentType}`);
      console.log(`  ✔ Downloaded bytes: ${bytesDownloaded} (${(bytesDownloaded / 1024 / 1024).toFixed(2)} MB)`);

      // Verify container magic bytes directly from buffer
      let magicBox = 'unknown';
      if (buf.length >= 8) {
        const ftypCandidate = buf.subarray(4, 8).toString('latin1');
        if (ftypCandidate === 'ftyp' || ftypCandidate === 'moov' || ftypCandidate === 'mdat') {
          magicBox = ftypCandidate;
        }
      }

      // Run ffprobe on downloaded media
      const tmpPath = path.join('/tmp', `audit_p7_${p.platform}_${Date.now()}.mp4`);
      fs.writeFileSync(tmpPath, buf);

      let probeData: any = {};
      let ffprobeExitCode = 0;
      try {
        const { stdout } = await execFileAsync('ffprobe', [
          '-v',
          'error',
          '-show_entries',
          'format=duration,format_name,size:stream=codec_name,codec_type,width,height',
          '-of',
          'json',
          tmpPath,
        ]);
        probeData = JSON.parse(stdout);
      } catch (e: any) {
        ffprobeExitCode = e.code || 1;
        throw new Error(`ffprobe failed on downloaded ${p.platform} media: ${e.message}`);
      } finally {
        if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
      }

      const videoStream = probeData.streams?.find((s: any) => s.codec_type === 'video');
      const audioStream = probeData.streams?.find((s: any) => s.codec_type === 'audio');
      const duration = parseFloat(probeData.format?.duration || '0');

      console.log(`  ✔ ffprobe: Video=${videoStream?.codec_name} (${videoStream?.width}x${videoStream?.height})`);
      console.log(`  ✔ ffprobe: Audio=${audioStream?.codec_name || 'none'}`);
      console.log(`  ✔ ffprobe: Duration=${duration.toFixed(2)}s, ExitCode=${ffprobeExitCode}`);

      matrixReport.push({
        platform: p.platform,
        url: p.testUrl,
        resolveDurationMs: resolveDuration,
        variantsCount: media.variants.length,
        selectedVariantId: selectedVariant.id,
        streamHost: parsedStreamHost,
        downloadHttpStatus: dlRes.status,
        bytesDownloaded,
        contentType,
        magicBytes: magicBox,
        videoCodec: videoStream?.codec_name,
        audioCodec: audioStream?.codec_name || 'none',
        resolution: `${videoStream?.width}x${videoStream?.height}`,
        durationSeconds: duration,
        ffprobeExitCode,
      });
    }

    // =========================================================================
    // NEGATIVE TESTING IN PRODUCTION RUNTIME
    // =========================================================================
    console.log('\n========================================================================');
    console.log('TESTING NEGATIVE AND SECURITY SCENARIOS IN PRODUCTION RUNTIME');
    console.log('========================================================================\n');

    // 1. SSRF target via resolve API
    const ssrfRes = await fetch(`${BASE_URL}/api/media/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'http://127.0.0.1/video.mp4' }),
    });
    console.log(`  ✔ SSRF Attempt (127.0.0.1) -> HTTP Status: ${ssrfRes.status} (Expected 403)`);
    if (ssrfRes.status !== 403) throw new Error('Expected 403 on SSRF attempt');

    // 2. Image-only Pinterest pin rejection
    const pinImgRes = await fetch(`${BASE_URL}/api/media/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://www.pinterest.com/pin/2322237302907836/' }),
    });
    console.log(`  ✔ Image-only Pin rejection -> HTTP Status: ${pinImgRes.status} (Expected 404 MEDIA_NOT_FOUND)`);
    if (pinImgRes.status !== 404) throw new Error('Expected 404 on image-only pin');

    // 3. Non-existent pin
    const pin404Res = await fetch(`${BASE_URL}/api/media/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://www.pinterest.com/pin/999999999999' }),
    });
    console.log(`  ✔ Non-existent Pin -> HTTP Status: ${pin404Res.status} (Expected 404)`);
    if (pin404Res.status !== 404) throw new Error('Expected 404 on nonexistent pin');

    // 4. Invalid download token
    const badTokenRes = await fetch(`${BASE_URL}/api/media/download?token=forged0000000000000000000000000000000000000000000000000000000000&variantId=1`);
    console.log(`  ✔ Forged download token -> HTTP Status: ${badTokenRes.status} (Expected 404)`);
    if (badTokenRes.status !== 404) throw new Error('Expected 404 on forged download token');

    console.log('\n========================================================================');
    console.log('FINAL PRODUCTION AUDIT MATRIX: ALL 6 PROVIDERS PASSED 100%');
    console.log('========================================================================\n');
    console.table(matrixReport);

    prodProcess.kill('SIGTERM');
    process.exit(0);
  } catch (err) {
    console.error('Fatal error in production audit:', err);
    try {
      prodProcess.kill('SIGTERM');
    } catch {
      // ignore
    }
    process.exit(1);
  }
}

runLiveProductionMatrix();
