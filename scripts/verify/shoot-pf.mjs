import puppeteer from 'puppeteer-core';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new', args: ['--remote-allow-origins=*', '--hide-scrollbars'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1200, height: 750 });
/* 1. トップ(3D ready + イントロ後) */
await page.goto('http://localhost:8123/', { waitUntil: 'domcontentloaded' });
await page.waitForFunction('window.__char3d && window.__char3d.ready', { timeout: 30000 }).catch(() => {});
await sleep(4000);
await page.screenshot({ path: 'pf-cuculfm-top.png' });
/* 2. ペットの床LP */
await page.goto('http://localhost:8123/services/dog/pet-floor/', { waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
await sleep(1500);
await page.screenshot({ path: 'pf-pet-floor.png' });
/* 3. 犬図鑑 */
await page.goto('http://localhost:8123/services/dog/breeds/', { waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
await sleep(1500);
await page.screenshot({ path: 'pf-dog-breeds.png' });
await browser.close();
console.log('shots done');
