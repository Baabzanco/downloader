async function testPinterestCsrfResource(pinId: string) {
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
  console.log('CSRF Token:', csrfToken);

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
      'X-CSRFToken': csrfToken,
      'X-Pinterest-AppState': 'active',
      'Cookie': cookieHeader,
      'Referer': `https://www.pinterest.com/pin/${pinId}/`
    }
  });

  console.log(`PinResource status: ${res.status}`);
  const text = await res.text();
  console.log(`Response length: ${text.length}`);
  if (res.status === 200) {
    const json = JSON.parse(text);
    console.log('Resource Data:', JSON.stringify(json.resource_response?.data, null, 2).slice(0, 1500));
  } else {
    console.log('Response:', text.slice(0, 500));
  }
}

testPinterestCsrfResource('1130825781446736203');
