async function testSearchAndStatuses() {
  try {
    const res1 = await fetch('https://api.fxtwitter.com/2/profile/NASA/statuses', {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    console.log('Statuses endpoint status:', res1.status);
    if (res1.ok) {
      const data: any = await res1.json();
      console.log('Statuses count:', (data.statuses || []).length);
      if (data.statuses?.length) {
        console.log('First status:', data.statuses[0].id, data.statuses[0].text?.slice(0, 50));
      }
    }
    
    const res2 = await fetch('https://api.fxtwitter.com/2/search?q=trailer&count=10', {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    console.log('Search endpoint status:', res2.status);
    if (res2.ok) {
      const data: any = await res2.json();
      console.log('Search results count:', (data.statuses || data.tweets || []).length);
      for (const t of data.statuses || data.tweets || []) {
        if (t.media?.videos?.length || t.media?.all?.some((m: any) => m.type === 'video' || m.type === 'gif')) {
          console.log(`\n🎉 Found video tweet: ID=${t.id}, text=${t.text?.slice(0, 60)}`);
          console.log(`Media:`, JSON.stringify(t.media, null, 2));
        }
      }
    }
  } catch (e: any) {
    console.error(e.message);
  }
}

testSearchAndStatuses();
