async function checkAmplifyIds() {
  const ids = ['1820127349548982272', '1613583998076481537'];
  for (const id of ids) {
    try {
      const res = await fetch(`https://api.fxtwitter.com/status/${id}`, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      console.log(`ID ${id} -> Status ${res.status}`);
      if (res.ok) {
        const data = await res.json();
        console.log(`Tweet ${id}:`, JSON.stringify(data.tweet?.media, null, 2));
      }
    } catch (e: any) {
      console.error(e.message);
    }
  }
}

checkAmplifyIds();
