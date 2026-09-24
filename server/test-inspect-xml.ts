async function inspectXml() {
  const url = 'https://www.pinterest.com/v3_sitemaps/video_pin_sitemap_www.pinterest.com.xml';
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });
  const xml = await res.text();
  console.log(xml);
}

inspectXml();
