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
await p.evaluate(() => document.getElementById('business').scrollIntoView());
await sleep(2200);
const st = await p.evaluate(() => ({
  thumbs: document.querySelectorAll('.biz-card .thumb img').length,
  loaded: [...document.querySelectorAll('.biz-card .thumb img')].every(i => i.complete && i.naturalWidth > 0),
  overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
}));
console.log('thumbs:', JSON.stringify(st));
await p.screenshot({ path: 'shots/40-biz-thumbs.png' });
await p.hover('.biz-card[href="/services/construction/"]');
await sleep(700);
await p.screenshot({ path: 'shots/41-biz-thumbs-hover.png' });
await p.close();
/* mobile */
const m = await browser.newPage();
await m.setViewport({ width: 390, height: 844, hasTouch: true, isMobile: true });
await m.goto('http://localhost:8123/', { waitUntil: 'domcontentloaded' });
await sleep(4000);
await m.evaluate(() => document.getElementById('business').scrollIntoView());
await sleep(1500);
await m.screenshot({ path: 'shots/42-biz-thumbs-mobile.png' });
await m.close();
await browser.close();
console.log('pageerrors:', errs.length ? errs : 'none');
