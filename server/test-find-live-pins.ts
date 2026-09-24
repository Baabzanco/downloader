import * as cheerio from 'cheerio';

async function findLivePins() {
  const pages = [
    'https://www.pinterest.com/ideas/',
    'https://www.pinterest.com/today/',
    'https://www.pinterest.com/ideas/food-and-drink/918530398158/',
    'https://www.pinterest.com/ideas/diy-and-crafts/935572520847/',
  ];

  for (const p of pages) {
    try {
      console.log(`Fetching ${p}...`);
      const res = await fetch(p, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        }
      });
      const html = await res.text();
      const pinMatches = html.match(/\/pin\/(\d+)\//g) || [];
      const pinIds = Array.from(new Set(pinMatches.map(m => m.replace(/\/pin\/|\//g, ''))));
      console.log(`Found ${pinIds.length} pin IDs from ${p}:`, pinIds.slice(0, 10));

      // Also check for pws JSON
      const $ = cheerio.load(html);
      const pwsText = $('#__PWS_DATA__').text();
      if (pwsText) {
        const jsonPinMatches = pwsText.match(/"id":"(\d+)"/g);
        if (jsonPinMatches) {
          const jsonIds = Array.from(new Set(jsonPinMatches.map(m => m.match(/\d+/)![0])));
          console.log(`PWS JSON IDs:`, jsonIds.slice(0, 10));
        }
      }
    } catch (e: any) {
      console.log(`Error:`, e.message);
    }
  }
}

findLivePins();
