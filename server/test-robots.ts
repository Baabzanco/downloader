async function checkRobots() {
  const res = await fetch('https://www.pinterest.com/robots.txt', {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });
  const text = await res.text();
  console.log('Robots.txt sitemaps:');
  const sitemaps = text.match(/Sitemap: .*/g);
  console.log(sitemaps);
}

checkRobots();
