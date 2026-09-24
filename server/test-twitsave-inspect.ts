import * as fs from 'fs';

async function testWriteFull() {
  const tweetUrl = 'https://twitter.com/NASA/status/1671907481102434305';
  const url = `https://twitsave.com/info?url=${encodeURIComponent(tweetUrl)}`;
  console.log(`Fetching Twitsave: ${url}`);

  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, Gecko) Chrome/126.0.0.0 Safari/537.36',
    }
  });

  const html = await res.text();
  fs.writeFileSync('./twitsave_full.html', html, 'utf-8');
  console.log('Saved to ./twitsave_full.html');
}

testWriteFull().catch(console.error);
