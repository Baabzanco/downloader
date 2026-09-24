async function testPinterestApis(pinId: string) {
  console.log(`\n========================================`);
  console.log(`Testing Pinterest Public APIs for Pin: ${pinId}`);
  console.log(`========================================`);

  // 1. Pidgets API
  try {
    const pidgetUrl = `https://api.pinterest.com/v3/pidgets/pins/info/?pin_ids=${pinId}`;
    const res = await fetch(pidgetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
      }
    });
    console.log(`[Pidgets API] Status: ${res.status}`);
    const data = await res.json();
    console.log(`[Pidgets API] Response:`, JSON.stringify(data, null, 2));
  } catch (e: any) {
    console.log(`[Pidgets API] Error:`, e.message);
  }

  // 2. PinResource GET
  try {
    const dataParam = JSON.stringify({
      options: {
        id: pinId,
        field_set_key: 'detailed'
      },
      context: {}
    });
    const resourceUrl = `https://www.pinterest.com/resource/PinResource/get/?source_url=%2Fpin%2F${pinId}%2F&data=${encodeURIComponent(dataParam)}`;
    const res = await fetch(resourceUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'X-Requested-With': 'XMLHttpRequest',
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'Referer': `https://www.pinterest.com/pin/${pinId}/`
      }
    });
    console.log(`\n[PinResource GET] Status: ${res.status}`);
    const data = await res.json();
    const pin = data.resource_response?.data;
    if (pin) {
      console.log(`[PinResource GET] Title:`, pin.title || pin.grid_title);
      console.log(`[PinResource GET] Videos:`, JSON.stringify(pin.videos, null, 2));
      console.log(`[PinResource GET] Story pin data:`, JSON.stringify(pin.story_pin_data?.pages?.[0]?.blocks, null, 2));
    } else {
      console.log(`[PinResource GET] Response:`, JSON.stringify(data, null, 2).slice(0, 500));
    }
  } catch (e: any) {
    console.log(`[PinResource GET] Error:`, e.message);
  }
}

testPinterestApis('794815034267439366');
