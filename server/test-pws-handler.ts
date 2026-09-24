async function testPwsHandler(pinId: string) {
  const dataParam = JSON.stringify({
    options: {
      id: pinId,
      field_set_key: 'detailed'
    },
    context: {}
  });
  const resourceUrl = `https://www.pinterest.com/resource/PinResource/get/?source_url=%2Fpin%2F${pinId}%2F&data=${encodeURIComponent(dataParam)}`;
  
  const handlers = [
    `www/pin/[id].js`,
    `www/pin.js`,
    `www/[username].js`,
    `www/ideas.js`,
    `www/core.js`
  ];

  for (const h of handlers) {
    try {
      const res = await fetch(resourceUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'X-Requested-With': 'XMLHttpRequest',
          'X-Pinterest-Pws-Handler': h,
          'Accept': 'application/json, text/javascript, */*; q=0.01',
          'Referer': `https://www.pinterest.com/pin/${pinId}/`
        }
      });
      console.log(`Handler "${h}": Status ${res.status}`);
      if (res.status === 200) {
        const json = await res.json();
        console.log(`Data keys:`, Object.keys(json.resource_response?.data || {}));
        const pin = json.resource_response?.data;
        if (pin) {
          console.log(`Title:`, pin.title);
          console.log(`Videos:`, pin.videos);
        }
        break;
      }
    } catch (e: any) {
      console.log(`Handler "${h}" error:`, e.message);
    }
  }
}

testPwsHandler('794815034267439366');
