import * as cheerio from 'cheerio';

async function inspectPwsData(pinId: string) {
  const url = `https://www.pinterest.com/pin/${pinId}/`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    }
  });
  const html = await res.text();
  const $ = cheerio.load(html);
  const pws = JSON.parse($('#__PWS_DATA__').text());
  console.log(`appVersion:`, pws.appVersion);
  console.log(`initialHandlerId:`, pws.initialHandlerId);
  console.log(`context:`, pws.context);
  console.log(`site:`, pws.site);
  console.log(`renderMode:`, pws.renderMode);
}

inspectPwsData('687494493392819875');
