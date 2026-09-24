async function getProfileMedia(handle: string) {
  console.log(`\nFetching media for @${handle}...`);
  try {
    const res = await fetch(`https://api.fxtwitter.com/2/profile/${handle}/media`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
    });
    console.log(`Status: ${res.status}`);
    if (res.ok) {
      const data: any = await res.json();
      console.log(`Response code:`, data.code);
      const tweets = data.statuses || data.tweets || [];
      console.log(`Found ${tweets.length} tweets in media feed.`);
      for (const t of tweets) {
        if (t.media?.videos?.length || t.media?.all?.some((m: any) => m.type === 'video' || m.type === 'gif')) {
          console.log(`\n🎬 Video Tweet ID: ${t.id}`);
          console.log(`URL: https://x.com/${t.author?.screen_name || handle}/status/${t.id}`);
          console.log(`Text: ${t.text?.slice(0, 100)}`);
          console.log(`Media:`, JSON.stringify(t.media, null, 2));
        }
      }
    }
  } catch (e: any) {
    console.error(`Error:`, e.message);
  }
}

async function main() {
  await getProfileMedia('NASA');
  await getProfileMedia('PlayStation');
  await getProfileMedia('Xbox');
}

main();
