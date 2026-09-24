async function testResolvers(pinUrl: string) {
  console.log(`\nTesting resolvers for: ${pinUrl}`);

  // Test 1: Fast download services
  const services = [
    {
      name: 'SavePin API',
      url: `https://api.savepin.app/download?url=${encodeURIComponent(pinUrl)}`
    },
    {
      name: 'Guru API Pinterest',
      url: `https://api.guruapi.tech/pinterest?url=${encodeURIComponent(pinUrl)}`
    },
    {
      name: 'TiklyDown Pinterest',
      url: `https://api.tiklydown.eu.org/api/download/v2?url=${encodeURIComponent(pinUrl)}`
    },
    {
      name: 'AllInOne Downloader',
      url: `https://api.allinonevideodownloader.net/api/fetch?url=${encodeURIComponent(pinUrl)}`
    }
  ];

  for (const s of services) {
    try {
      console.log(`Trying ${s.name}: ${s.url}`);
      const res = await fetch(s.url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      console.log(`  -> Status: ${res.status}`);
      const text = await res.text();
      console.log(`  -> Length: ${text.length}, Preview: ${text.slice(0, 200)}`);
    } catch (e: any) {
      console.log(`  -> Error: ${e.message}`);
    }
  }
}

testResolvers('https://www.pinterest.com/pin/1130825781446736203/');
