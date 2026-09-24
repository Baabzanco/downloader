async function testFxRoutes() {
  const routes = [
    'https://api.fxtwitter.com/i/status/1349149096909668363',
    'https://api.fxtwitter.com/twitter/status/1349149096909668363',
    'https://api.fxtwitter.com/status/1349149096909668363',
    'https://api.fxtwitter.com/i/status/1247616214769086465',
    'https://api.fxtwitter.com/jack/status/1247616214769086465'
  ];

  for (const r of routes) {
    const res = await fetch(r, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    console.log(`${r} -> ${res.status}`);
  }
}

testFxRoutes();
