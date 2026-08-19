import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
const svg = fs.readFileSync('phantom-papillon-silhouette.svg', 'utf8');
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--remote-allow-origins=*'] });
const p = await browser.newPage();
await p.setViewport({ width: 660, height: 400 });
await p.setContent(`<body style="margin:0;display:flex;gap:30px;align-items:center;justify-content:center;background:#0a0a1a;height:100vh">
  <div style="color:#f5e100;width:240px">${svg}</div>
  <div style="color:#8a8a9b;width:120px">${svg}</div>
  <div style="color:#1c1c26;width:240px;background:#e8e8f0;padding:10px;border-radius:8px">${svg}</div>
</body>`);
await new Promise(r => setTimeout(r, 400));
await p.screenshot({ path: 'shots/60-silhouette.png' });
await browser.close();
console.log('preview saved');
