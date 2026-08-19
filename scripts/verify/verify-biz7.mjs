import puppeteer from 'puppeteer-core';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new', args: ['--remote-allow-origins=*', '--hide-scrollbars'],
});
const errs = [];
/* A. トップ BUSINESS 7カード(1440/1280) */
for (const w of [1440, 1280]) {
  const p = await browser.newPage();
  await p.setViewport({ width: w, height: 900 });
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8123/', { waitUntil: 'domcontentloaded' });
  await p.waitForFunction('window.__char3d && window.__char3d.ready', { timeout: 30000 }).catch(() => {});
  await sleep(2500);
  await p.evaluate(() => document.getElementById('business').scrollIntoView());
  await sleep(1800);
  const st = await p.evaluate(() => {
    const cards = [...document.querySelectorAll('.biz-card')];
    return {
      count: cards.length,
      overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      cardW: Math.round(cards[0].getBoundingClientRect().width),
      webCard: cards[5] ? { no: cards[5].querySelector('.no').textContent, href: cards[5].getAttribute('href') } : null,
      dogNo: cards[6] ? cards[6].querySelector('.no').textContent : null,
    };
  });
  console.log(`A ${w}px:`, JSON.stringify(st));
  if (w === 1440) await p.screenshot({ path: 'shots/30-biz-7cards.png' });
  await p.close();
}
/* B. モバイル横スクロール */
{
  const p = await browser.newPage();
  await p.setViewport({ width: 390, height: 844, hasTouch: true, isMobile: true });
  await p.goto('http://localhost:8123/', { waitUntil: 'domcontentloaded' });
  await sleep(4000);
  await p.evaluate(() => document.getElementById('business').scrollIntoView());
  await sleep(1500);
  console.log('B mobile:', await p.evaluate(() => ({
    cards: document.querySelectorAll('.biz-card').length,
    scrollable: (s => s.scrollWidth > s.clientWidth)(document.getElementById('biz-scroller')),
  })).then(JSON.stringify));
  await p.close();
}
/* C. services/web ページ + 画像/リンク */
{
  const p = await browser.newPage();
  await p.setViewport({ width: 1440, height: 900 });
  const fails = [];
  p.on('response', r => { if (r.status() >= 400) fails.push(r.url()); });
  await p.goto('http://localhost:8123/services/web/', { waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
  await sleep(1200);
  const st = await p.evaluate(() => ({
    h1: document.querySelector('.hero-title')?.textContent,
    features: [...document.querySelectorAll('.feature-title')].map(e => e.textContent),
    pfLinks: [...document.querySelectorAll('.articles-grid .article-card a')].map(a => a.getAttribute('href')),
    imgsLoaded: [...document.querySelectorAll('.article-image img')].every(i => i.complete && i.naturalWidth > 0),
  }));
  console.log('C services/web:', JSON.stringify(st));
  console.log('C 4xx:', fails.filter(u => !u.includes('favicon')).length ? fails : 'none(favicon除く)');
  await p.screenshot({ path: 'shots/31-services-web.png', fullPage: false });
  await p.evaluate(() => window.scrollTo(0, 700));
  await sleep(800);
  await p.screenshot({ path: 'shots/32-services-web-pf.png' });
  /* ポートフォリオ4リンクのHTTP確認 */
  for (const href of st.pfLinks) {
    const url = 'http://localhost:8123' + href;
    const res = await fetch(url);
    console.log('  link', href, res.status);
  }
  await p.close();
}
await browser.close();
console.log('pageerrors:', errs.length ? errs : 'none');
