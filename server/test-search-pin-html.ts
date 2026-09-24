import * as cheerio from 'cheerio';

async function searchPinHtml(pinId: string) {
  const url = `https://www.pinterest.com/pin/${pinId}/`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    }
  });
  const html = await res.text();
  console.log(`Pin ${pinId} HTML Length: ${html.length}`);

  const $ = cheerio.load(html);
  
  // Look for any script with JSON
  $('script').each((i, el) => {
    const text = $(el).text();
    if (text.includes('video') || text.includes('images') || text.includes('pin')) {
      // Find JSON objects
      try {
        const parsed = JSON.parse(text);
        console.log(`Script ${i} (id=${$(el).attr('id')}): parsed JSON keys:`, Object.keys(parsed));
        if (parsed.initialReduxState) {
          console.log(`  initialReduxState keys:`, Object.keys(parsed.initialReduxState));
          if (parsed.initialReduxState.resources) {
            console.log(`  resources keys:`, Object.keys(parsed.initialReduxState.resources));
          }
        }
      } catch {}
    }
  });

  // Also check if there is OpenGraph or canonical tags
  console.log('Title tag:', $('title').text());
  console.log('og:title:', $('meta[property="og:title"]').attr('content'));
  console.log('og:image:', $('meta[property="og:image"]').attr('content'));
  console.log('og:video:', $('meta[property="og:video"]').attr('content'));
  console.log('canonical:', $('link[rel="canonical"]').attr('href'));
}

searchPinHtml('687494493392819875');
