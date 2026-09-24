async function testEndpoints(user: string, tweetId: string) {
  console.log(`\n================ Testing Tweet: ${user}/status/${tweetId} ================`);
  
  // 1. Syndication
  try {
    const token = (Number(tweetId) / 1e15 * Math.PI).toString(36).replace(/(0+|\.)/g, '');
    const syndUrl = `https://cdn.syndication.twimg.com/tweet-result?id=${tweetId}&lang=en&token=${token}`;
    const res = await fetch(syndUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    console.log(`[Syndication] Status: ${res.status}`);
    if (res.ok) {
      const data = await res.json();
      console.log(`[Syndication] Keys:`, Object.keys(data));
      if (data.video || data.mediaDetails) {
        console.log(`[Syndication] Has video/mediaDetails!`);
      }
    }
  } catch (e: any) {
    console.log(`[Syndication] Error:`, e.message);
  }

  // 2. FxTwitter
  try {
    const fxUrl = `https://api.fxtwitter.com/${user}/status/${tweetId}`;
    const res = await fetch(fxUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0' }
    });
    console.log(`[FxTwitter] Status: ${res.status}`);
    if (res.ok) {
      const data = await res.json();
      console.log(`[FxTwitter] code: ${data.code}, message: ${data.message}`);
      if (data.tweet) {
        console.log(`[FxTwitter] Tweet text:`, data.tweet.text?.slice(0, 80));
        console.log(`[FxTwitter] media:`, JSON.stringify(data.tweet.media, null, 2));
      }
    }
  } catch (e: any) {
    console.log(`[FxTwitter] Error:`, e.message);
  }

  // 3. VxTwitter
  try {
    const vxUrl = `https://api.vxtwitter.com/${user}/status/${tweetId}`;
    const res = await fetch(vxUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    console.log(`[VxTwitter] Status: ${res.status}`);
    if (res.ok) {
      const data = await res.json();
      console.log(`[VxTwitter] text:`, data.text?.slice(0, 80));
      console.log(`[VxTwitter] media_extended:`, JSON.stringify(data.media_extended, null, 2));
    }
  } catch (e: any) {
    console.log(`[VxTwitter] Error:`, e.message);
  }
}

async function main() {
  // Test multiple candidate tweets
  await testEndpoints('SpaceX', '1798651655648833967');
  await testEndpoints('elonmusk', '1585341905663674368');
  await testEndpoints('jack', '20');
}

main().catch(console.error);
