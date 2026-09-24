import { getTweet } from 'react-tweet/api';

async function testReactTweet(tweetId: string) {
  console.log(`Calling react-tweet getTweet for ID: ${tweetId}`);
  try {
    const tweet = await getTweet(tweetId);
    if (!tweet) {
      console.log('Tweet NOT found (returned undefined).');
      return;
    }
    console.log('Tweet found successfully!');
    console.log('Keys:', Object.keys(tweet));
    console.log('Text:', tweet.text);
    console.log('User:', tweet.user?.screen_name, `(${tweet.user?.name})`);
    if (tweet.video) {
      console.log('Video:', JSON.stringify(tweet.video, null, 2));
    } else {
      console.log('No video property on tweet object.');
    }
  } catch (err) {
    console.error('Error calling react-tweet:', err);
  }
}

async function main() {
  await testReactTweet('1585341905663674368');
}

main().catch(console.error);
