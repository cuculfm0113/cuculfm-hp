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
await p.goto('http://localhost:8123/services/dog/pet-floor/', { waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
await sleep(1500);
const st = await p.evaluate(() => ({
  overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  heroArt: !!document.querySelector('.pet-floor-hero-art img') && document.querySelector('.pet-floor-hero-art img').complete,
  flowSteps: document.querySelectorAll('.pet-floor-flow li').length,
  midCta: !!document.querySelector('.pet-floor-midcta'),
  ctaId: !!document.getElementById('pet-floor-cta'),
  videoOk: !!document.querySelector('.pet-floor-cases-section video'),
}));
console.log('petfloor:', JSON.stringify(st));
await p.screenshot({ path: 'shots/70-petfloor-hero.png' });
await p.evaluate(() => document.querySelector('.pet-floor-flow-section').scrollIntoView());
await sleep(900);
await p.screenshot({ path: 'shots/71-petfloor-flow.png' });
await p.evaluate(() => document.getElementById('pet-floor-cta').scrollIntoView());
await sleep(900);
await p.screenshot({ path: 'shots/72-petfloor-cta.png' });
await p.close();
const m = await browser.newPage();
await m.setViewport({ width: 390, height: 844, hasTouch: true, isMobile: true });
await m.goto('http://localhost:8123/services/dog/pet-floor/', { waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
await sleep(1500);
console.log('mobile overflowX:', await m.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth));
await m.screenshot({ path: 'shots/73-petfloor-mobile.png' });
await m.close();
await browser.close();
console.log('pageerrors:', errs.length ? errs : 'none');
