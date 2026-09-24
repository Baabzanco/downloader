async function testFxUrl(apiUrl: string) {
  console.log(`Fetching: ${apiUrl}`);
  try {
    const res = await fetch(apiUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      }
    });
    console.log('Status:', res.status);
    const json = await res.json();
    console.log('JSON:', JSON.stringify(json, null, 2));
  } catch (err) {
    console.error('Error:', err);
  }
}

async function main() {
  await testFxUrl('https://api.fxtwitter.com/SpaceX/status/1801222879595827376');
  console.log('------------------------------------------------------');
  await testFxUrl('https://api.fxtwitter.com/elonmusk/status/1794931478146740693');
}

main().catch(console.error);
