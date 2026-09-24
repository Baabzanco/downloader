async function findLiveVideoTweets() {
  const ids = [
    // Video IDs from various popular accounts & test cases
    '1349149096909668363', // Twitter post
    '1354143047324299264',
    '1323314485759918080',
    '1585341905663674368',
    '1671907481102434305',
    '1686043640623251456',
    '1700000000000000000',
    '1750000000000000000',
    '1780000000000000000',
    '1800000000000000000',
    '1611111111111111111',
    '1247616214769086465',
    '1346889437826859008',
    '1351194098934272002',
    '1369713797108117513',
    '1400000000000000000',
    '1450000000000000000',
    '1500000000000000000',
    '1550000000000000000',
    '1600000000000000000',
    '1650000000000000000',
    '1700000000000000000',
  ];

  for (const id of ids) {
    try {
      const res = await fetch(`https://api.fxtwitter.com/status/${id}`, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.tweet) {
          console.log(`\n[FOUND] Tweet ${id} by @${data.tweet.author?.screen_name}`);
          console.log(`Text: ${data.tweet.text?.slice(0, 100)}`);
          if (data.tweet.media?.videos?.length) {
            console.log(`🎬 HAS VIDEO:`, data.tweet.media.videos);
          } else if (data.tweet.media?.all?.some((m: any) => m.type === 'video' || m.type === 'gif')) {
            console.log(`🎬 HAS MEDIA VIDEO:`, data.tweet.media.all);
          } else {
            console.log(`(No video, media keys: ${Object.keys(data.tweet.media || {})})`);
          }
        }
      }
    } catch (e: any) {
      // ignore
    }
  }
}

findLiveVideoTweets();
