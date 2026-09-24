import * as cheerio from 'cheerio';

async function testPin(pinId: string) {
  const url = `https://www.pinterest.com/pin/${pinId}/`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    }
  });

  console.log(`Pin ${pinId}: Status ${res.status}`);
  const html = await res.text();
  const $ = cheerio.load(html);
  const initialPropsText = $('#__PWS_INITIAL_PROPS__').text();
  if (!initialPropsText) {
    console.log('No __PWS_INITIAL_PROPS__ found');
    return null;
  }

  const initialProps = JSON.parse(initialPropsText);
  const redux = initialProps.initialReduxState || {};
  const resources = redux.resources || {};
  const pinResources = resources.PinResource || {};
  
  console.log(`PinResource keys count:`, Object.keys(pinResources).length);
  for (const k of Object.keys(pinResources)) {
    const data = pinResources[k]?.data;
    if (data) {
      console.log(`Found Data in ${k}!`);
      console.log(`  Title:`, data.title || data.grid_title);
      console.log(`  Description:`, data.description);
      console.log(`  Videos:`, JSON.stringify(data.videos, null, 2));
      console.log(`  Story pin data:`, JSON.stringify(data.story_pin_data, null, 2)?.slice(0, 500));
      return data;
    } else if (pinResources[k]?.error) {
      console.log(`  Error in ${k}:`, pinResources[k]?.error?.message);
    }
  }

  // Also check redux.pins
  if (redux.pins && Object.keys(redux.pins).length > 0) {
    console.log(`Found redux.pins:`, Object.keys(redux.pins));
    for (const pid of Object.keys(redux.pins)) {
      console.log(`Pin ${pid} videos:`, redux.pins[pid].videos);
    }
  }

  return null;
}

async function run() {
  const pins = [
    '687494493392819875',
    '155374255883204984',
    '337766353342371987',
    '1801222879595827376',
    '108367928519632367',
    '57702438966213751'
  ];

  for (const p of pins) {
    await testPin(p);
  }
}

run();
