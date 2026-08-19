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
await p.goto('http://localhost:8123/', { waitUntil: 'domcontentloaded' });
await p.waitForFunction('window.__char3d && window.__char3d.ready', { timeout: 30000 }).catch(() => {});
await sleep(2500);
await p.evaluate(() => document.getElementById('news').scrollIntoView());
await sleep(2200);
console.log(await p.evaluate(() => ({
  arts: document.querySelectorAll('.news-card .card-art img').length,
  loaded: [...document.querySelectorAll('.news-card .card-art img')].every(i => i.complete && i.naturalWidth > 0),
  overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  cardH: Math.round(document.querySelector('.news-card').getBoundingClientRect().height),
})).then(JSON.stringify));
await p.screenshot({ path: 'shots/50-news-art.png' });
await p.hover('.news-card[href="/recruit/"]');
await sleep(700);
await p.screenshot({ path: 'shots/51-news-art-hover.png' });
await p.close();
const m = await browser.newPage();
await m.setViewport({ width: 390, height: 844, hasTouch: true, isMobile: true });
await m.goto('http://localhost:8123/', { waitUntil: 'domcontentloaded' });
await sleep(4000);
await m.evaluate(() => document.getElementById('news').scrollIntoView());
await sleep(1600);
await m.screenshot({ path: 'shots/52-news-art-mobile.png' });
await m.close();
await browser.close();
console.log('pageerrors:', errs.length ? errs : 'none');
