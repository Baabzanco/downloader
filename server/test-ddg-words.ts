async function searchDdgQueries() {
  const words = ['craft', 'diy', 'animation', 'funny', 'dance', 'food', 'cooking', 'fitness', 'art', 'makeup'];
  for (const w of words) {
    const q = `site:pinterest.com/pin/ "${w}"`;
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      }
    });

    const text = await res.text();
    const matches = text.match(/pinterest\.com%2Fpin%2F(\d+)/g) || text.match(/pinterest\.com\/pin\/(\d+)/g) || [];
    const pinIds = Array.from(new Set(matches.map(m => m.match(/\d+/)![0])));
    console.log(`Word "${w}" found ${pinIds.length} Pin IDs:`, pinIds);
  }
}

searchDdgQueries();
