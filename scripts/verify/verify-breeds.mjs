import puppeteer from 'puppeteer-core';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new', args: ['--remote-allow-origins=*', '--hide-scrollbars'],
});
const p = await browser.newPage();
await p.setViewport({ width: 1440, height: 900 });
const errs = [];
p.on('pageerror', e => errs.push(e.message));
await p.goto('http://localhost:8123/services/dog/breeds/', { waitUntil: 'domcontentloaded' });
await sleep(2500);
const init = await p.evaluate(() => ({
  total: document.getElementById('totalBreeds').textContent,
  count: document.getElementById('resultCount').textContent,
  cards: document.querySelectorAll('.breed-card').length,
  overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
}));
console.log('init:', JSON.stringify(init));
await p.screenshot({ path: 'shots/80-breeds-top.png' });
/* 検索「柴」 */
await p.type('#searchInput', '柴');
await sleep(600);
console.log('search 柴:', await p.evaluate(() => document.getElementById('resultCount').textContent + '件 / cards=' + document.querySelectorAll('.breed-card').length));
await p.evaluate(() => { const i = document.getElementById('searchInput'); i.value = ''; i.dispatchEvent(new Event('input')); });
await sleep(400);
/* サイズ絞込(小型犬) */
await p.evaluate(() => [...document.querySelectorAll('.filter-btn')].find(b => b.dataset.filter === 'size' && b.dataset.value === 's').click());
await sleep(500);
console.log('size=s:', await p.evaluate(() => document.getElementById('resultCount').textContent));
/* グループ絞込(第9群) */
await p.evaluate(() => [...document.querySelectorAll('.filter-btn')].find(b => b.dataset.filter === 'group' && b.dataset.value === '9').click());
await sleep(500);
console.log('size=s & group=9:', await p.evaluate(() => document.getElementById('resultCount').textContent));
await p.screenshot({ path: 'shots/81-breeds-filtered.png' });
/* リセットして柴犬詳細へ */
await p.evaluate(() => [...document.querySelectorAll('.filter-btn')].filter(b => b.dataset.value === 'all').forEach(b => b.click()));
await sleep(400);
await p.goto('http://localhost:8123/services/dog/breeds/detail.html?id=shiba-inu', { waitUntil: 'domcontentloaded' });
await sleep(2200);
const det = await p.evaluate(() => ({
  title: document.title.slice(0, 24),
  h1ok: /柴犬/.test(document.getElementById('detailRoot').textContent),
  stats: document.querySelectorAll('#detailRoot [class*="stat"]').length,
  prevNext: [...document.querySelectorAll('#detailRoot a')].filter(a => /detail\.html\?id=/.test(a.getAttribute('href') || '')).length,
}));
console.log('detail:', JSON.stringify(det));
await p.screenshot({ path: 'shots/82-breeds-detail.png' });
/* 前後ナビの実クリック */
await p.evaluate(() => [...document.querySelectorAll('#detailRoot a')].find(a => /NEXT/.test(a.textContent)).click());
await sleep(1800);
console.log('next nav url:', await p.evaluate(() => location.search));
await p.close();
const m = await browser.newPage();
await m.setViewport({ width: 390, height: 844, hasTouch: true, isMobile: true });
await m.goto('http://localhost:8123/services/dog/breeds/', { waitUntil: 'domcontentloaded' });
await sleep(2000);
/* モバイル: フィルタトグル開閉 */
await m.tap('#filterToggle');
await sleep(500);
console.log('mobile filter open:', await m.evaluate(() => document.getElementById('filterPanel').classList.contains('open') || document.getElementById('filterToggle').classList.contains('open')));
await m.screenshot({ path: 'shots/83-breeds-mobile.png' });
await m.close();
await browser.close();
console.log('pageerrors:', errs.length ? errs : 'none');
