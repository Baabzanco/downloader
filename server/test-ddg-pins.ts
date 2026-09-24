async function searchDdg() {
  const query = 'site:pinterest.com/pin/ "watch" OR "video" OR "recipe"';
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    }
  });

  const text = await res.text();
  console.log(`DDG response length: ${text.length}`);
  const matches = text.match(/pinterest\.com%2Fpin%2F(\d+)/g) || text.match(/pinterest\.com\/pin\/(\d+)/g) || [];
  console.log('Matches:', matches);
  const pinIds = Array.from(new Set(matches.map(m => m.match(/\d+/)![0])));
  console.log('Pin IDs found:', pinIds);
}

searchDdg();
