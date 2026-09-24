import * as cheerio from 'cheerio';

async function inspectRoutes(pinId: string) {
  const url = `https://www.pinterest.com/pin/${pinId}/`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    }
  });
  const html = await res.text();
  const $ = cheerio.load(html);
  const routesJson = $('#__PWS_ROUTES__').text();
  if (routesJson) {
    const routes = JSON.parse(routesJson);
    const pinRoutes = Object.keys(routes).filter(k => k.includes('pin'));
    console.log('Pin-related routes:', pinRoutes);
  }
}

inspectRoutes('687494493392819875');
