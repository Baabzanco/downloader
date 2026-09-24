import * as cheerio from 'cheerio';

async function fetchVideoPinsFromSitemap() {
  const url = 'https://www.pinterest.com/v3_sitemaps/video_pin_sitemap_www.pinterest.com.xml';
  console.log(`Fetching video pin sitemap: ${url}`);
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });
  const xml = await res.text();
  console.log(`XML length: ${xml.length}`);

  // Extract loc tags
  const matches = xml.match(/<loc>(https:\/\/www\.pinterest\.com\/pin\/\d+\/)<\/loc>/g) || [];
  console.log(`Found ${matches.length} video pin URLs!`);
  const urls = matches.slice(0, 10).map(m => m.replace(/<\/?loc>/g, ''));
  console.log('Sample Video Pins:', urls);
  return urls;
}

fetchVideoPinsFromSitemap();
