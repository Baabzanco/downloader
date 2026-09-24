import fetch from 'node-fetch';

async function scanForVideos() {
  // Let's test a sequence of IDs from recent viral tweets
  // Tweet IDs around 1700000000000000000 - 1800000000000000000
  const candidateAccounts = [
    'NASA', 'SpaceX', 'NBA', 'NFL', 'PlayStation', 'Xbox', 'NintendoAmerica', 'IGN', 'BBCBreaking', 'elonmusk'
  ];
  
  // Let's test a known sample of video IDs
  const sampleIds = [
    '1349149096909668363',
    '1354143047324299264',
    '1323314485759918080',
    '1601222879595827376',
    '1640103750014382080',
    '1686043640623251456',
    '1705645396568285514',
    '1711789476486774945',
    '1721598462719262963',
    '1730000000000000000',
    '1740000000000000000',
    '1750000000000000000',
    '1760000000000000000',
    '1770000000000000000',
    '1780000000000000000',
    '1790000000000000000',
    '1800000000000000000',
    '1810000000000000000',
    '1820000000000000000',
    '1830000000000000000',
    '1840000000000000000',
    '1850000000000000000'
  ];

  for (const id of sampleIds) {
    try {
      const res = await fetch(`https://api.fxtwitter.com/status/${id}`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
      });
      if (res.ok) {
        const data: any = await res.json();
        const media = data.tweet?.media;
        if (media?.videos?.length || media?.all?.some((m: any) => m.type === 'video' || m.type === 'gif')) {
          console.log(`\n🎉 FOUND VIDEO TWEET: https://x.com/${data.tweet.author.screen_name}/status/${id}`);
          console.log(`Author: ${data.tweet.author.name} (@${data.tweet.author.screen_name})`);
          console.log(`Text: ${data.tweet.text}`);
          console.log(`Media:`, JSON.stringify(media, null, 2));
        }
      }
    } catch (err) {}
  }
}

scanForVideos();
