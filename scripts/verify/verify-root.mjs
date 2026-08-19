import puppeteer from 'puppeteer-core';
import fs from 'node:fs';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const URL = 'http://localhost:8123/';
const OUT = new globalThis.URL('./shots/', import.meta.url).pathname;
fs.mkdirSync(OUT, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--remote-allow-origins=*', '--window-size=1440,1000', '--hide-scrollbars'],
});

const logs = [];
async function newPage(w, h, opts = {}) {
  const page = await browser.newPage();
  await page.setViewport({ width: w, height: h, deviceScaleFactor: opts.dpr || 1, hasTouch: !!opts.touch, isMobile: !!opts.mobile });
  page.on('console', m => logs.push(`[console:${m.type()}] ${m.text()}`));
  page.on('pageerror', e => logs.push(`[PAGEERROR] ${e.message}`));
  page.on('requestfailed', r => logs.push(`[REQFAIL] ${r.url()} ${r.failure()?.errorText}`));
  return page;
}

/* ---------- 1. desktop ---------- */
const page = await newPage(1440, 900);
await page.goto(URL, { waitUntil: 'domcontentloaded' });
const ok = await page.waitForFunction('window.__char3d && window.__char3d.ready', { timeout: 25000 }).then(() => true).catch(() => false);
console.log('char3d ready:', ok);
await sleep(3500); // イントロ 2.2s + 余韻(実時間)
const loaderOn = await page.evaluate(() => document.getElementById('loader').classList.contains('is-on'));
console.log('loader still on:', loaderOn);
const is3d = await page.evaluate(() => ({
  is3d: document.querySelector('.hero-char-wrap').classList.contains('is-3d'),
  canvasOn: document.getElementById('char3d').classList.contains('is-on'),
  canvasSize: (c => c ? [c.width, c.height] : null)(document.querySelector('#char3d canvas')),
  mode: window.__char3d ? window.__char3d.mode : null,
  fps: window.__char3d ? window.__char3d.fps : null,
}));
console.log('hero state:', JSON.stringify(is3d));
await page.screenshot({ path: OUT + '01-hero-moon.png' });

/* theme red */
await page.keyboard.press('Enter');
await sleep(1400);
await page.screenshot({ path: OUT + '02-hero-red.png' });
await page.keyboard.press('Enter');
await sleep(1000);

/* ---------- 2. seq scrub ---------- */
const st = await page.evaluate(() => {
  const t = window.ScrollTrigger.getAll().find(s => s.pin);
  return t ? { start: t.start, end: t.end } : null;
});
console.log('pin trigger:', JSON.stringify(st));
if (st) {
  for (const [name, p] of [['03-seq-p00', 0.02], ['04-seq-p45', 0.45], ['05-seq-p85', 0.85]]) {
    await page.evaluate(y => window.scrollTo(0, y), st.start + (st.end - st.start) * p);
    await sleep(1600); // scrub 0.6 の追いつき(実時間)
    const m = await page.evaluate(() => window.__char3d.mode);
    console.log(name, 'mode:', m);
    await page.screenshot({ path: OUT + name + '.png' });
  }
  /* seq を完全に抜けて business へ */
  await page.evaluate(y => window.scrollTo(0, y), st.end + 1400);
  await sleep(1200);
  const after = await page.evaluate(() => ({
    mode: window.__char3d.mode,
    seqOn: document.getElementById('seq-3d').classList.contains('is-on'),
  }));
  console.log('after seq:', JSON.stringify(after));
  await page.screenshot({ path: OUT + '06-business.png' });
  /* 逆走: seq 中腹へ戻る */
  await page.evaluate(y => window.scrollTo(0, y), st.start + (st.end - st.start) * 0.5);
  await sleep(1600);
  console.log('back into seq mode:', await page.evaluate(() => window.__char3d.mode));
  /* pin より上 = ヒーローへカットバック */
  await page.evaluate(() => window.scrollTo(0, 0));
  await sleep(1400);
  console.log('back to hero mode:', await page.evaluate(() => window.__char3d.mode));
  await page.screenshot({ path: OUT + '07-hero-return.png' });
}
console.log('fps:', await page.evaluate(() => window.__char3d.fps));
await page.close();

/* ---------- 3. mobile ---------- */
const mp = await newPage(390, 844, { dpr: 2, touch: true, mobile: true });
await mp.goto(URL, { waitUntil: 'domcontentloaded' });
const mok = await mp.waitForFunction('window.__char3d && window.__char3d.ready', { timeout: 25000 }).then(() => true).catch(() => false);
await sleep(3200);
console.log('mobile ready:', mok, 'media(hover/fine):', await mp.evaluate(() => matchMedia('(hover: hover) and (pointer: fine)').matches));
await mp.screenshot({ path: OUT + '08-mobile-hero.png' });
await mp.close();

/* ---------- 4. nochar3d fallback ---------- */
const fp = await newPage(1440, 900);
await fp.goto(URL + '?nochar3d=1', { waitUntil: 'domcontentloaded' });
await sleep(3000);
console.log('fallback loader on:', await fp.evaluate(() => document.getElementById('loader').classList.contains('is-on')),
  '| svg visible:', await fp.evaluate(() => getComputedStyle(document.getElementById('cucul-char')).visibility));
await fp.screenshot({ path: OUT + '09-fallback-svg.png' });
await fp.close();

/* ---------- 5. reduced motion ---------- */
const rp = await newPage(1440, 900);
await rp.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
await rp.goto(URL, { waitUntil: 'domcontentloaded' });
const rok = await rp.waitForFunction('window.__char3d && window.__char3d.ready', { timeout: 25000 }).then(() => true).catch(() => false);
await sleep(2000);
console.log('rm ready:', rok);
await rp.screenshot({ path: OUT + '10-reduced-motion.png' });
await rp.close();

await browser.close();
console.log('\n--- logs ---');
for (const l of logs) console.log(l);
