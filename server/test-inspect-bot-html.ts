import * as cheerio from 'cheerio';
import fs from 'fs';

async function inspectBotHtml(pinId: string) {
  const res = await fetch(`https://www.pinterest.com/pin/${pinId}/`, {
    headers: {
      'User-Agent': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.html)',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    }
  });

  const html = await res.text();
  console.log(`HTML Length: ${html.length}`);

  // Search for any script tags with JSON
  const $ = cheerio.load(html);
  $('script').each((i, el) => {
    const text = $(el).text();
    const type = $(el).attr('type');
    const id = $(el).attr('id');
    if (text.length > 500) {
      console.log(`Script ${i}: id="${id}", type="${type}", length=${text.length}`);
      // check if it contains the pin ID
      if (text.includes(pinId)) {
        console.log(`  -> Script ${i} contains pinId ${pinId}!`);
        // Find occurrences of pinId
        let idx = 0;
        while ((idx = text.indexOf(pinId, idx)) !== -1) {
          console.log(`    Snippet @ ${idx}:`, text.slice(Math.max(0, idx - 100), Math.min(text.length, idx + 200)));
          idx += pinId.length;
        }
      }
    }
  });
}

inspectBotHtml('1130825781446736203');
