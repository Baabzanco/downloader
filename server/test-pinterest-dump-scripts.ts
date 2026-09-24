import * as cheerio from 'cheerio';
import fs from 'fs';

async function dumpScripts(pinUrl: string) {
  console.log(`Fetching: ${pinUrl}`);
  const res = await fetch(pinUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    }
  });

  const html = await res.text();
  console.log(`Status: ${res.status}`);
  console.log(`HTML Length: ${html.length}`);

  const $ = cheerio.load(html);

  $('script').each((i, el) => {
    const text = $(el).text();
    const id = $(el).attr('id');
    const type = $(el).attr('type');
    console.log(`Script ${i}: id="${id}", type="${type}", len=${text.length}`);

    if (text.includes('v1.pinimg.com') || text.includes('.mp4') || text.includes('video_list') || text.includes('videos')) {
      console.log(`  -> FOUND VIDEO KEYWORDS in Script ${i}!`);
      // Find snippets
      const matches = text.match(/(.{0,50}(?:v1\.pinimg\.com|\.mp4|video_list).{0,100})/g);
      console.log(`  Snippets:`, matches?.slice(0, 5));
    }
  });
}

dumpScripts('https://www.pinterest.com/pin/1130825781446736203/');
