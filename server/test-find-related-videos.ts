import * as cheerio from 'cheerio';

async function findRelatedPins(pinId: string) {
  // Step 1: Get session
  const pageRes = await fetch(`https://www.pinterest.com/pin/${pinId}/`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    }
  });

  const cookies = pageRes.headers.getSetCookie ? pageRes.headers.getSetCookie() : [];
  let csrfToken = '';
  for (const c of cookies) {
    const match = c.match(/csrftoken=([^;]+)/);
    if (match) csrfToken = match[1];
  }
  const cookieHeader = cookies.map((c) => c.split(';')[0]).join('; ');

  const html = await pageRes.text();
  const $ = cheerio.load(html);
  const pws = JSON.parse($('#__PWS_DATA__').text());

  // Step 2: Query RelatedPinFeedResource or PinResource
  const dataParam = JSON.stringify({
    options: {
      pin_id: pinId,
      page_size: 25
    },
    context: {}
  });

  const resourceUrl = `https://www.pinterest.com/resource/RelatedPinFeedResource/get/?source_url=%2Fpin%2F${pinId}%2F&data=${encodeURIComponent(dataParam)}`;
  
  const res = await fetch(resourceUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'X-Requested-With': 'XMLHttpRequest',
      'X-Pinterest-Pws-Handler': pws.initialHandlerId || 'www/pin/[id].js',
      'X-Pinterest-AppState': 'active',
      'X-Pinterest-Source-Url': `/pin/${pinId}/`,
      'X-CSRFToken': csrfToken,
      'Cookie': cookieHeader,
      'Referer': `https://www.pinterest.com/pin/${pinId}/`,
      'Accept': 'application/json, text/javascript, */*; q=0.01'
    }
  });

  console.log(`RelatedPinFeedResource Status: ${res.status}`);
  const json = await res.json();
  const items = json.resource_response?.data || [];
  console.log(`Found ${items.length} related pins!`);
  
  for (const item of items) {
    if (item.videos || item.is_video || item.video_url || item.story_pin_data) {
      console.log(`Found Video Pin: ID ${item.id}, Title: "${item.title || item.grid_title}"`);
      if (item.videos?.video_list) {
        console.log(`  Videos:`, Object.keys(item.videos.video_list));
        console.log(`  720p URL:`, item.videos.video_list.V_720P?.url || item.videos.video_list.V_EXP7?.url);
      }
    }
  }
}

findRelatedPins('848365648603016583');
