import * as cheerio from 'cheerio';

async function inspectInitialProps(pinUrl: string) {
  const res = await fetch(pinUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    }
  });
  const html = await res.text();
  const $ = cheerio.load(html);
  const initialProps = $('#__PWS_INITIAL_PROPS__').text();
  console.log(`__PWS_INITIAL_PROPS__:`, initialProps);
}

inspectInitialProps('https://www.pinterest.com/pin/1130825781446736203/');
