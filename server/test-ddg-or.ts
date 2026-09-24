async function searchDdgOr() {
  const queries = [
    'site:pinterest.com/pin/ "watch" OR "tutorial"',
    'site:pinterest.com/pin/ "video" OR "crafts"',
    'site:pinterest.com/pin/ "shorts" OR "reels"',
    'site:pinterest.com/pin/ "tiktok" OR "instagram"',
    'site:pinterest.com/pin/ "recipe" OR "cake"',
    'site:pinterest.com/pin/ "diy" OR "easy"',
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
    console.log(`Query "${q}" found ${pinIds.length} Pin IDs:`, pinIds);
  }
}

searchDdgOr();
