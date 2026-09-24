async function testPinterestSessionResource(pinId: string) {
  // Step 1: Initial GET to get cookies & tokens
  const pageRes = await fetch(`https://www.pinterest.com/pin/${pinId}/`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    }
  });

  const rawCookies = pageRes.headers.get('set-cookie');
  console.log('Set-Cookie headers:', rawCookies);

  // Extract cookies
  const cookies = pageRes.headers.getSetCookie ? pageRes.headers.getSetCookie() : [];
  const cookieHeader = cookies.map((c) => c.split(';')[0]).join('; ');
  console.log('Cookie header:', cookieHeader);

  // Step 2: Request PinResource
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
      'X-Pinterest-AppState': 'active',
      'Cookie': cookieHeader,
      'Referer': `https://www.pinterest.com/pin/${pinId}/`
    }
  });

  console.log(`PinResource with session: Status ${res.status}`);
  const text = await res.text();
  console.log(`Response length: ${text.length}`);
  if (res.status === 200) {
    try {
      const json = JSON.parse(text);
      console.log('Resource Data:', JSON.stringify(json.resource_response?.data, null, 2).slice(0, 1000));
    } catch {}
  } else {
    console.log('Response text:', text.slice(0, 500));
  }
}

testPinterestSessionResource('1130825781446736203');
