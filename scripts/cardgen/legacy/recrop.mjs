import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
const OUT = '/Users/babakyohei/Library/Mobile Documents/com~apple~CloudDocs/cursor_product/HP/images/biz/';
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new', args: ['--remote-allow-origins=*'],
});
const page = await browser.newPage();
await page.goto('http://localhost:8123/', { waitUntil: 'domcontentloaded' });
const jobs = [
  // 犬: ピンクのクレートを外し顔にタイト(元2048px高の y380 から)
  { name: 'biz-07-dog.jpg', src: '/images/gallery/papillon-dog.png', sx: 180, sy: 380, sw: 1000, sh: 1667, q: 0.7 },
  // 映像: 既出フレームのフレア中心へズーム
  { name: 'biz-05-video.jpg', src: '/images/biz/biz-05-video.jpg?v=1', sx: 72, sy: 120, sw: 456, sh: 760, q: 0.74 },
];
for (const j of jobs) {
  const dataUrl = await page.evaluate(async job => {
    const img = new Image();
    img.src = job.src;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = 600; c.height = 1000;
    const g = c.getContext('2d');
    g.imageSmoothingQuality = 'high';
    g.drawImage(img, job.sx, job.sy, job.sw, job.sh, 0, 0, 600, 1000);
    return c.toDataURL('image/jpeg', job.q);
  }, j);
  fs.writeFileSync(OUT + j.name, Buffer.from(dataUrl.split(',')[1], 'base64'));
  console.log(j.name, Math.round(fs.statSync(OUT + j.name).size / 1024) + 'KB');
}
await browser.close();
