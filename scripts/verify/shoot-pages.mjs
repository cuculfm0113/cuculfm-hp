// 汎用ページ一括スクショ: node shoot-pages.mjs <outdir> [urlsFile]
// urlsFile 省略時は services/style.css の全消費者17ページ。
// 前提: リポジトリルートで python3 -m http.server 8123
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

const OUT = process.argv[2];
if (!OUT) { console.error('usage: node shoot-pages.mjs <outdir> [urlsFile]'); process.exit(1); }
fs.mkdirSync(OUT, { recursive: true });

const DEFAULT_URLS = [
  '/services/ai/', '/services/ai-tools/', '/services/condo/',
  '/services/condo/garage/', '/services/condo/hideaway/', '/services/condo/mahjong/',
  '/services/construction/', '/services/craft/', '/services/custom/',
  '/services/document/', '/services/dog/', '/services/inspection/',
  '/services/media/', '/services/tools/', '/services/video/', '/services/web/',
  '/services/dog/pet-floor/',
];
const urls = process.argv[3]
  ? fs.readFileSync(process.argv[3], 'utf8').split('\n').map(s => s.trim()).filter(Boolean)
  : DEFAULT_URLS;

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new',
  args: ['--remote-allow-origins=*'],
});

const errors = {};
for (const u of urls) {
  const name = u.replace(/^\//, '').replace(/\/$/, '').replace(/[/?=.]/g, '-') || 'root';
  const page = await browser.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  await page.setViewport({ width: 1440, height: 900 });
  try {
    await page.goto(`http://localhost:8123${u}`, { waitUntil: 'networkidle0', timeout: 30000 });
    await new Promise(r => setTimeout(r, 800));
    await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: true });
  } catch (e) { errs.push(`NAV: ${e.message}`); }
  if (errs.length) errors[u] = errs;
  await page.close();
}
await browser.close();
console.log(JSON.stringify({ shot: urls.length, errors }, null, 2));
