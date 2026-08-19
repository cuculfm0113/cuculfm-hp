import puppeteer from 'puppeteer-core';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new', args: ['--remote-allow-origins=*', '--hide-scrollbars'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
const errs = [];
page.on('pageerror', e => errs.push(e.message));
page.on('console', m => { if (m.type() === 'error') errs.push('[console] ' + m.text()); });
const t0 = Date.now();
await page.goto('https://cucul-fm.com/top-v2/', { waitUntil: 'domcontentloaded' });
const ok = await page.waitForFunction('window.__char3d && window.__char3d.ready', { timeout: 40000 }).then(() => true).catch(() => false);
console.log('prod ready:', ok, 'in', Date.now() - t0, 'ms');
await sleep(3500);
console.log('prod hero:', await page.evaluate(() => ({
  is3d: document.querySelector('.hero-char-wrap').classList.contains('is-3d'),
  loaderOn: document.getElementById('loader').classList.contains('is-on'),
  mode: window.__char3d.mode, fps: window.__char3d.fps,
})).then(JSON.stringify));
await page.screenshot({ path: 'shots/14-prod-hero.png' });
const st = await page.evaluate(() => {
  const t = window.ScrollTrigger.getAll().find(s => s.pin);
  return t ? { start: t.start, end: t.end } : null;
});
await page.evaluate(y => window.scrollTo(0, y), st.start + (st.end - st.start) * 0.5);
await sleep(1600);
console.log('prod seq mode:', await page.evaluate(() => window.__char3d.mode));
await page.screenshot({ path: 'shots/15-prod-seq.png' });
await page.evaluate(() => window.scrollTo(0, 0));
await sleep(1400);
console.log('prod back to hero:', await page.evaluate(() => window.__char3d.mode));
console.log('errors:', errs.length ? errs : 'none');
await browser.close();
