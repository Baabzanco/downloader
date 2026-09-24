import * as cheerio from 'cheerio';

async function auditPinterestPin(pinId: string) {
  console.log(`\n========================================`);
  console.log(`Auditing Pinterest Pin ID: ${pinId}`);
  console.log(`========================================`);

  const url = `https://www.pinterest.com/pin/${pinId}/`;
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
      }
    });

    console.log(`HTTP Status: ${res.status} ${res.statusText}`);
    const html = await res.text();
    console.log(`HTML Length: ${html.length} bytes`);

    const $ = cheerio.load(html);

    // 1. Check OpenGraph video
    const ogVideo = $('meta[property="og:video"]').attr('content') || $('meta[property="og:video:secure_url"]').attr('content');
    const ogTitle = $('meta[property="og:title"]').attr('content');
    const ogImage = $('meta[property="og:image"]').attr('content');
    console.log(`OG Title:`, ogTitle);
    console.log(`OG Image:`, ogImage);
    console.log(`OG Video:`, ogVideo);

    // 2. Check JSON-LD
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const json = JSON.parse($(el).text());
        console.log(`JSON-LD @type:`, json['@type']);
        if (json.video || json.contentUrl) {
          console.log(`JSON-LD Video found:`, json.video || json.contentUrl);
        }
      } catch {}
    });

    // 3. Check __PWS_DATA__ or relay data
    const pwsScript = $('#__PWS_DATA__').text();
    if (pwsScript) {
      console.log(`Found #__PWS_DATA__! Parsing...`);
      const pws = JSON.parse(pwsScript);
      console.log(`PWS keys:`, Object.keys(pws));
      
      const pinData = pws.props?.initialReduxState?.pins?.[pinId] || pws.initialData?.data?.pin;
      if (pinData) {
        console.log(`Found Pin Data in PWS!`);
        console.log(`Title:`, pinData.title || pinData.grid_title);
        console.log(`Videos:`, JSON.stringify(pinData.videos, null, 2));
      }
    }

    // 4. Check for any video/mp4 urls in html
    const videoMatches = html.match(/https:\/\/[^"']+\.mp4[^"']*/g);
    if (videoMatches) {
      console.log(`Regex MP4 matches found (${videoMatches.length}):`, Array.from(new Set(videoMatches)));
    }

  } catch (err: any) {
    console.error('Fetch error:', err.message);
  }
}

async function runAudit() {
  // Let's test a few public video pins from search
  const candidatePins = [
    '1130825781446736203',
    '794815034267439366',
    '614178842938837119',
    '234327986851505315',
  ];

  for (const id of candidatePins) {
    await auditPinterestPin(id);
  }
}

runAudit();
