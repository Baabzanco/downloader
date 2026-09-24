async function testTweetResult(tweetId: string) {
  const url = `https://cdn.syndication.twimg.com/tweet-result?id=${tweetId}&lang=en`;
  console.log(`Fetching: ${url}`);

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      }
    });
    console.log('Status:', res.status);
    const text = await res.text();
    console.log('Raw text:', text);
  } catch (err) {
    console.error('Error:', err);
  }
}

async function main() {
  await testTweetResult('1801222879595827376');
  console.log('==================================================');
  await testTweetResult('1781440810359853245');
}

main().catch(console.error);
