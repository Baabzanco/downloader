async function searchGeneralPins() {
  const queries = [
    'site:pinterest.com/pin/ cake recipe',
    'site:pinterest.com/pin/ drawing tutorial',
    'site:pinterest.com/pin/ workout routine',
    'site:pinterest.com/pin/ origami tutorial'
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
    console.log(`Query "${q}" found ${pinIds.length} IDs:`, pinIds.slice(0, 5));
  }
}

searchGeneralPins();
