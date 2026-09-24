import * as cheerio from 'cheerio';

async function testBotCrawlers(pinId: string) {
  const bots = [
    { name: 'Googlebot', ua: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' },
    { name: 'FacebookBot', ua: 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.html)' },
    { name: 'TwitterBot', ua: 'Twitterbot/1.0' },
    { name: 'WhatsApp', ua: 'WhatsApp/2.21.12.21 A' },
    { name: 'TelegramBot', ua: 'TelegramBot (like TwitterBot)' },
    { name: 'PinterestApp', ua: 'Pinterest/10.0 (iPhone; iOS 17.0; Scale/3.00)' },
  ];

  for (const bot of bots) {
    console.log(`\nTesting Bot User-Agent: ${bot.name}`);
    try {
      const res = await fetch(`https://www.pinterest.com/pin/${pinId}/`, {
        headers: {
          'User-Agent': bot.ua,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        }
      });
      console.log(`Status: ${res.status}`);
      const html = await res.text();
      console.log(`HTML Length: ${html.length}`);
      const $ = cheerio.load(html);

      const ogVideo = $('meta[property="og:video"]').attr('content') || $('meta[property="og:video:secure_url"]').attr('content');
      const ogTitle = $('meta[property="og:title"]').attr('content');
      const ogImage = $('meta[property="og:image"]').attr('content');
      console.log(`OG Title:`, ogTitle);
      console.log(`OG Video:`, ogVideo);
      console.log(`OG Image:`, ogImage);

      // Check json-ld
      $('script[type="application/ld+json"]').each((_, el) => {
        try {
          const json = JSON.parse($(el).text());
          console.log(`JSON-LD:`, JSON.stringify(json, null, 2).slice(0, 500));
        } catch {}
      });

      const mp4s = html.match(/https:\/\/[^"'\s<>]+\.mp4[^"'\s<>]*/g);
      if (mp4s) {
        console.log(`Found MP4s:`, Array.from(new Set(mp4s)));
      }
    } catch (e: any) {
      console.log(`Error:`, e.message);
    }
  }
}

testBotCrawlers('1130825781446736203');
