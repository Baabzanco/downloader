import * as cheerio from 'cheerio';

async function testExactPws(pinId: string) {
  // 1. Initial page load
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

  console.log(`initialHandlerId:`, pws.initialHandlerId);
  console.log(`appVersion:`, pws.appVersion);
  console.log(`CSRF:`, csrfToken);

  // 2. Query PinResource with pws.context
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
      'X-Pinterest-Pws-Handler': pws.initialHandlerId,
      'X-Pinterest-AppState': 'active',
      'X-Pinterest-Source-Url': `/pin/${pinId}/`,
      'X-CSRFToken': csrfToken,
      'Cookie': cookieHeader,
      'Referer': `https://www.pinterest.com/pin/${pinId}/`,
      'Accept': 'application/json, text/javascript, */*; q=0.01'
    }
  });

  console.log(`Status: ${res.status}`);
  const text = await res.text();
  console.log(`Text preview: ${text.slice(0, 300)}`);
}

testExactPws('687494493392819875');
