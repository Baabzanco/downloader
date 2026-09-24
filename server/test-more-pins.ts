async function searchMorePins() {
  const queries = [
    'site:pinterest.com/pin/ "watch" "video"',
    'site:pinterest.com/pin/ "recipe" "video"',
    'site:pinterest.com/pin/ "tutorial" "video"',
    'site:pinterest.com/pin/ "animation" "video"'
  ];

  for (const q of queries) {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      }
    });

    const text = await res.text();
    const matches = text.match(/pinterest\.com%2Fpin%2F(\d+)/g) || text.match(/pinterest\.com\/pin\/(\d+)/g) || [];
    const pinIds = Array.from(new Set(matches.map(m => m.match(/\d+/)![0])));
    console.log(`Query "${q}" found IDs:`, pinIds);
  }
}

searchMorePins();
