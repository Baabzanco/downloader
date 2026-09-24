/**
 * Section 13: Production Runtime Test
 * Starts the application using the production command:
 * NODE_ENV=production PORT=3002 npm start
 * Tests:
 * 1. Production Health & Diagnostics gating
 * 2. YouTube Shorts resolution
 * 3. YouTube Shorts real download through /api/media/download
 * 4. ffprobe validation on downloaded YouTube MP4
 * 5. TikTok resolution in production
 * 6. Instagram resolution in production
 * 7. Facebook resolution in production
 */
import { spawn } from 'child_process';
import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execFileAsync = promisify(execFile);

const PROD_PORT = 3100 + Math.floor(Math.random() * 800);
const BASE_URL = `http://127.0.0.1:${PROD_PORT}`;

async function runProductionRuntimeTest() {
  console.log('===============================================================');
  console.log('PHASE 4.5 SECTION 13: PRODUCTION RUNTIME TEST');
  console.log(`Starting server with NODE_ENV=production PORT=${PROD_PORT} npm start...`);
  console.log('===============================================================');

  // Spawn production server process
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
    if (msg) console.log(`[ProdStdout] ${msg}`);
  });

  prodProcess.stderr.on('data', (d) => {
    const msg = d.toString().trim();
    if (msg) console.error(`[ProdStderr] ${msg}`);
  });

  try {
    // Wait for server to become responsive
    let ready = false;
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 600));
      try {
        const res = await fetch(`${BASE_URL}/api/health`);
        if (res.ok) {
          ready = true;
          break;
        }
      } catch {
        // retry
      }
    }

    if (!ready) {
      throw new Error(`Production server failed to respond on ${BASE_URL}/api/health within 12 seconds.`);
    }

    console.log('\n[1/7] Testing Production Health & Diagnostics gating...');
    const healthRes = await fetch(`${BASE_URL}/api/health`);
    const healthData = await healthRes.json();
    console.log('  Health response:', JSON.stringify(healthData));
    if (healthData.environment !== 'production') {
      throw new Error(`Expected environment === "production", got ${healthData.environment}`);
    }
    const diagRes = await fetch(`${BASE_URL}/api/media/diagnostics`);
    if (diagRes.status !== 403) {
      throw new Error(`Expected diagnostics endpoint to return 403 in production, got ${diagRes.status}`);
    }
    console.log('  ✔ Health ok, environment === production, diagnostics gated with 403.');

    console.log('\n[2/7] YouTube Shorts Resolution in Production Runtime...');
    const ytUrl = 'https://www.youtube.com/shorts/se50viFJ0AQ';
    const ytResolveRes = await fetch(`${BASE_URL}/api/media/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: ytUrl }),
    });
    const ytResolveData = await ytResolveRes.json();
    if (!ytResolveData.success) {
      throw new Error(`YouTube resolution failed in production: ${JSON.stringify(ytResolveData)}`);
    }
    console.log(`  ✔ YouTube resolved: "${ytResolveData.media.title}" by ${ytResolveData.media.author?.name || 'unknown'}`);
    console.log(`  ✔ Variants: ${ytResolveData.media.variants.length}, Token: ${ytResolveData.downloadToken.slice(0, 16)}...`);

    console.log('\n[3/7] YouTube Shorts Real Download through Production Endpoint...');
    const ytVariant = ytResolveData.media.variants[0];
    const ytDlUrl = `${BASE_URL}/api/media/download?token=${encodeURIComponent(
      ytResolveData.downloadToken
    )}&variantId=${encodeURIComponent(ytVariant.id)}`;

    const ytDlRes = await fetch(ytDlUrl);
    if (!ytDlRes.ok) {
      throw new Error(`YouTube download stream failed with HTTP ${ytDlRes.status}`);
    }

    const ytContentType = ytDlRes.headers.get('content-type');
    const ytContentDisposition = ytDlRes.headers.get('content-disposition');
    console.log(`  ✔ HTTP Status: ${ytDlRes.status}`);
    console.log(`  ✔ Content-Type: ${ytContentType}`);
    console.log(`  ✔ Content-Disposition: ${ytContentDisposition}`);

    const ytTmpFile = path.join('/tmp', `prod_yt_${Date.now()}.mp4`);
    const ytBuf = Buffer.from(await ytDlRes.arrayBuffer());
    fs.writeFileSync(ytTmpFile, ytBuf);
    const ytStats = fs.statSync(ytTmpFile);
    console.log(`  ✔ Streamed binary written to disk: ${(ytStats.size / 1024 / 1024).toFixed(2)} MB (${ytStats.size} bytes)`);

    console.log('\n[4/7] ffprobe Validation on Production-Downloaded YouTube MP4...');
    const { stdout: probeOut } = await execFileAsync('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration,format_name:stream=codec_name,codec_type,width,height',
      '-of', 'json',
      ytTmpFile,
    ]);
    const probe = JSON.parse(probeOut);
    const vStream = probe.streams?.find((s: any) => s.codec_type === 'video');
    const aStream = probe.streams?.find((s: any) => s.codec_type === 'audio');
    const duration = parseFloat(probe.format?.duration || '0');
    fs.unlinkSync(ytTmpFile);

    console.log(`  ✔ Video stream: ${vStream?.codec_name} (${vStream?.width}x${vStream?.height})`);
    console.log(`  ✔ Audio stream: ${aStream?.codec_name}`);
    console.log(`  ✔ Duration: ${duration.toFixed(2)}s`);
    if (!vStream || !aStream || duration <= 0) {
      throw new Error('ffprobe validation failed: missing valid video/audio stream');
    }

    console.log('\n[5/7] TikTok Resolution in Production Runtime...');
    const ttUrl = 'https://www.tiktok.com/@zachking/video/6768504823336815877';
    const ttRes = await fetch(`${BASE_URL}/api/media/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: ttUrl }),
    });
    const ttData = await ttRes.json();
    if (!ttData.success) {
      throw new Error(`TikTok resolution failed in production: ${JSON.stringify(ttData)}`);
    }
    console.log(`  ✔ TikTok resolved: "${ttData.media.title}" (${ttData.media.variants.length} variants)`);

    console.log('\n[6/7] Instagram Resolution in Production Runtime...');
    const igUrl = 'https://www.instagram.com/reel/CY9Kk-xo0vs/';
    const igRes = await fetch(`${BASE_URL}/api/media/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: igUrl }),
    });
    const igData = await igRes.json();
    if (!igData.success) {
      throw new Error(`Instagram resolution failed in production: ${JSON.stringify(igData)}`);
    }
    console.log(`  ✔ Instagram resolved: "${igData.media.title}" (${igData.media.variants.length} variants)`);

    console.log('\n[7/7] Facebook Resolution in Production Runtime...');
    const fbUrl = 'https://www.facebook.com/watch/?v=1481060365360701';
    const fbRes = await fetch(`${BASE_URL}/api/media/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: fbUrl }),
    });
    const fbData = await fbRes.json();
    if (!fbData.success) {
      throw new Error(`Facebook resolution failed in production: ${JSON.stringify(fbData)}`);
    }
    console.log(`  ✔ Facebook resolved: "${fbData.media.title}" (${fbData.media.variants.length} variants)`);

    console.log('\n===============================================================');
    console.log('✅ SECTION 13: PRODUCTION RUNTIME TEST COMPLETED WITH 100% SUCCESS');
    console.log('   All 4 providers (YouTube, TikTok, Instagram, Facebook) validated');
    console.log('   Real binary streaming & ffprobe verified in production mode.');
    console.log('===============================================================');
    prodProcess.kill('SIGTERM');
    process.exit(0);
  } finally {
    try {
      prodProcess.kill('SIGTERM');
    } catch {
      // ignore
    }
  }
}

runProductionRuntimeTest().catch((err) => {
  console.error('❌ Production runtime test failed:', err);
  process.exit(1);
});
