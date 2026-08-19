import puppeteer from 'puppeteer-core';
import fs from 'node:fs';

const OUT = '/Users/babakyohei/Library/Mobile Documents/com~apple~CloudDocs/cursor_product/HP/images/biz/';
const CAND = new URL('./thumb-cand/', import.meta.url).pathname;
fs.mkdirSync(CAND, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new', args: ['--remote-allow-origins=*'],
});
const page = await browser.newPage();
await page.goto('http://localhost:8123/', { waitUntil: 'domcontentloaded' });

const save = (name, dataUrl, dir = OUT) => {
  fs.writeFileSync(dir + name, Buffer.from(dataUrl.split(',')[1], 'base64'));
  console.log(name, Math.round(fs.statSync(dir + name).size / 1024) + 'KB');
};

/* ---- 写真クロップ(600x1000 / JPEG q0.7) ---- */
const cropJobs = [
  { name: 'biz-02-construction.jpg', src: '/images/gallery/scaffolding-low-angle.png', sx: 281, sy: 0, sw: 461, sh: 768 },
  { name: 'biz-03-inspection.jpg',   src: '/images/gallery/pipe-robot-inspection.png', sx: 300, sy: 0, sw: 346, sh: 576 },
  { name: 'biz-04-tools.jpg',        src: '/images/gallery/milling-machine.png',       sx: 104, sy: 40, sw: 560, sh: 933 },
  { name: 'biz-06-web3d.jpg',        src: '/character-design/phantom-dj/cucul-phantom-dj-turnaround.png', sx: 40, sy: 0, sw: 614, sh: 1024 },
  { name: 'biz-07-dog.jpg',          src: '/images/gallery/papillon-dog.png',          sx: 132, sy: 60, sw: 1100, sh: 1833 },
];
for (const j of cropJobs) {
  const dataUrl = await page.evaluate(async job => {
    const img = new Image();
    img.src = job.src;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = 600; c.height = 1000;
    const g = c.getContext('2d');
    g.imageSmoothingQuality = 'high';
    g.drawImage(img, job.sx, job.sy, job.sw, job.sh, 0, 0, 600, 1000);
    return c.toDataURL('image/jpeg', 0.7);
  }, j);
  save(j.name, dataUrl);
}

/* ---- 動画フレーム候補(4点、目視選定用) ---- */
for (const pct of [0.25, 0.4, 0.55, 0.7]) {
  const dataUrl = await page.evaluate(async p => {
    const v = document.createElement('video');
    v.src = '/videos/PR_cuculfm_MV.mp4';
    v.muted = true;
    await new Promise(r => { v.onloadedmetadata = r; });
    v.currentTime = v.duration * p;
    await new Promise(r => { v.onseeked = r; });
    const c = document.createElement('canvas');
    c.width = 600; c.height = 1000;
    const g = c.getContext('2d');
    /* 縦クロップ: 中央 */
    const sw = v.videoHeight * 0.6;
    g.drawImage(v, (v.videoWidth - sw) / 2, 0, sw, v.videoHeight, 0, 0, 600, 1000);
    return c.toDataURL('image/jpeg', 0.72);
  }, pct);
  save(`video-cand-${Math.round(pct * 100)}.jpg`, dataUrl, CAND);
}

/* ---- 01 AI: プロシージャルなニューラル回路アート ---- */
const aiArt = await page.evaluate(() => {
  const W = 600, H = 1000;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  /* 決定的乱数(再現性) */
  let seed = 0x41494149;
  const rnd = () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
  const rr = (a, b) => a + (b - a) * rnd();
  /* 地: ダークネイビー(feat.カードのbgと同系) */
  const bg = g.createLinearGradient(0, 0, W * .4, H);
  bg.addColorStop(0, '#141024'); bg.addColorStop(.55, '#0d0b16'); bg.addColorStop(1, '#0a0f18');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  /* 微グリッド */
  g.strokeStyle = 'rgba(123,97,255,0.05)'; g.lineWidth = 1;
  for (let x = 0; x <= W; x += 50) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
  for (let y = 0; y <= H; y += 50) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
  /* ノード配置(上2/3に集中。下1/3はテキスト帯なので暗く保つ) */
  const nodes = [];
  for (let i = 0; i < 26; i++) nodes.push({ x: rr(40, W - 40), y: rr(50, H * .68), r: rr(2.2, 5.5) });
  /* 近傍接続 */
  g.lineCap = 'round';
  nodes.forEach((a, i) => {
    const near = nodes.map((b, j) => ({ b, j, d: Math.hypot(a.x - b.x, a.y - b.y) }))
      .filter(o => o.j !== i && o.d < 210).sort((x, y) => x.d - y.d).slice(0, 3);
    near.forEach(({ b, d }) => {
      const cyan = rnd() < 0.45;
      const col = cyan ? '0,212,255' : '123,97,255';
      g.strokeStyle = `rgba(${col},${(0.5 - d / 600).toFixed(2)})`;
      g.lineWidth = rr(0.7, 1.6);
      g.shadowColor = `rgba(${col},0.8)`; g.shadowBlur = rr(3, 9);
      g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke();
      g.shadowBlur = 0;
    });
  });
  /* ノード発光 */
  nodes.forEach(n => {
    const cyan = rnd() < 0.4;
    const col = cyan ? '0,212,255' : '123,97,255';
    g.shadowColor = `rgba(${col},0.95)`; g.shadowBlur = 14;
    g.fillStyle = `rgba(${col},${rr(0.65, 1).toFixed(2)})`;
    g.beginPath(); g.arc(n.x, n.y, n.r, 0, Math.PI * 2); g.fill();
    g.shadowBlur = 0;
    g.fillStyle = 'rgba(255,255,255,0.9)';
    g.beginPath(); g.arc(n.x, n.y, n.r * 0.35, 0, Math.PI * 2); g.fill();
  });
  /* データパルス(明滅粒) */
  for (let i = 0; i < 40; i++) {
    const cyan = rnd() < 0.5;
    g.fillStyle = cyan ? 'rgba(0,212,255,0.5)' : 'rgba(123,97,255,0.45)';
    g.fillRect(rr(0, W), rr(0, H * .7), rr(1, 2.4), rr(1, 2.4));
  }
  /* 下部を沈める(テキスト帯) */
  const fade = g.createLinearGradient(0, H * .45, 0, H);
  fade.addColorStop(0, 'rgba(13,11,22,0)'); fade.addColorStop(1, 'rgba(10,13,20,0.9)');
  g.fillStyle = fade; g.fillRect(0, 0, W, H);
  return c.toDataURL('image/jpeg', 0.78);
});
save('biz-01-ai.jpg', aiArt);

await browser.close();
console.log('done');
