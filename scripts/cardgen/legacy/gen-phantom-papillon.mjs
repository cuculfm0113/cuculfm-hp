import puppeteer from 'puppeteer-core';
import fs from 'node:fs';

const OUT = '/Users/babakyohei/Library/Mobile Documents/com~apple~CloudDocs/cursor_product/HP/character-design/phantom-papillon/';
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new', args: ['--remote-allow-origins=*'],
});
const page = await browser.newPage();
await page.goto('http://localhost:8123/', { waitUntil: 'domcontentloaded' });

/* 油彩パイプライン(gen-cardart.mjs と同系。縦900x1200版) */
const dataUrl = await page.evaluate(async () => {
  const W = 900, H = 1200;
  const mkRnd = seed => () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
  const rnd = mkRnd(0x9A11);
  const rr = (a, b) => a + (b - a) * rnd();

  const img = new Image();
  img.src = '/services/dog/images/papillon-smile.jpg';
  await img.decode();

  /* ---- 下絵 ---- */
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  /* 夜空ベース */
  const bg = g.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#050a1c'); bg.addColorStop(.55, '#0d1430'); bg.addColorStop(1, '#131024');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  /* 星 */
  for (let i = 0; i < 110; i++) {
    g.fillStyle = `rgba(235,240,255,${(.2 + rnd() * .7).toFixed(2)})`;
    const s = rnd() < .1 ? 2.4 : 1.3;
    g.fillRect(rnd() * W, rnd() * H * .55, s, s);
  }
  /* 三日月(左上) */
  {
    const mx = W * .88, my = H * .08, r = 40;
    g.save();
    g.shadowColor = 'rgba(255,220,120,.9)'; g.shadowBlur = 30;
    g.fillStyle = '#f2d98c';
    g.beginPath(); g.arc(mx, my, r, 0, Math.PI * 2); g.fill();
    g.restore();
    g.fillStyle = '#081026';
    g.beginPath(); g.arc(mx + r * .42, my - r * .18, r * .88, 0, Math.PI * 2); g.fill();
  }
  /* 犬写真をフェザーマスクで合成(533x800 → 胸から上を中心に) */
  const dog = document.createElement('canvas'); dog.width = W; dog.height = H;
  const dg = dog.getContext('2d');
  dg.filter = 'saturate(.8) brightness(.86) contrast(1.06)';
  /* src: 全身の上半分中心 (sx28 sy150 sw505 sh672) → 900x1197 */
  dg.drawImage(img, 28, 150, 505, 672, 0, 30, W, H - 30);
  dg.filter = 'none';
  /* フェザーマスク: 犬を中心に楕円で残す */
  dg.globalCompositeOperation = 'destination-in';
  dg.save();
  dg.translate(W * .5, H * .52); dg.scale(1.5, 1);   /* 蝶耳を含む横長楕円 */
  const m = dg.createRadialGradient(0, 0, H * .2, 0, 0, H * .46);
  m.addColorStop(0, 'rgba(0,0,0,1)');
  m.addColorStop(.6, 'rgba(0,0,0,.95)');
  m.addColorStop(1, 'rgba(0,0,0,0)');
  dg.fillStyle = m;
  dg.fillRect(-W, -H, W * 2, H * 2);
  dg.restore();
  g.drawImage(dog, 0, 0);
  /* 犬の外周を夜空へ沈める(残った草地の色を殺す) */
  g.save();
  g.translate(W * .5, H * .5); g.scale(1.5, 1);
  const nite = g.createRadialGradient(0, 0, H * .3, 0, 0, H * .62);
  nite.addColorStop(0, 'rgba(7,11,30,0)');
  nite.addColorStop(.65, 'rgba(7,11,30,.5)');
  nite.addColorStop(1, 'rgba(7,11,30,.92)');
  g.fillStyle = nite;
  g.fillRect(-W, -H, W * 2, H * 2);
  g.restore();
  /* 夜色グレーズ */
  g.globalCompositeOperation = 'multiply';
  const cool = g.createLinearGradient(0, 0, 0, H);
  cool.addColorStop(0, '#8b96cf'); cool.addColorStop(.5, '#aab0d8'); cool.addColorStop(1, '#b8a898');
  g.fillStyle = cool; g.fillRect(0, 0, W, H);
  /* 月光(左上からの金) */
  g.globalCompositeOperation = 'screen';
  const warm = g.createRadialGradient(W * .16, H * .1, 0, W * .16, H * .1, H * .8);
  warm.addColorStop(0, 'rgba(255,214,120,.34)'); warm.addColorStop(1, 'rgba(255,214,120,0)');
  g.fillStyle = warm; g.fillRect(0, 0, W, H);
  g.globalCompositeOperation = 'source-over';

  /* ---- ファントム意匠(写真の上に描き込み → 油彩で馴染ませる) ---- */
  /* 座標基準: 顔中心 ≈ (W*.46, H*.44)、首元 ≈ (W*.5, H*.72)、胸 ≈ (W*.5, H*.86) */
  /* 1) 首輪(黒革+金縁) */
  g.save();
  g.strokeStyle = '#15120e'; g.lineWidth = 26; g.lineCap = 'round';
  g.beginPath(); g.ellipse(W * .5, H * .70, 150, 52, -.05, Math.PI * .12, Math.PI * .88); g.stroke();
  g.strokeStyle = 'rgba(212,160,23,.8)'; g.lineWidth = 4;
  g.beginPath(); g.ellipse(W * .5, H * .715, 150, 52, -.05, Math.PI * .14, Math.PI * .86); g.stroke();
  g.restore();
  /* 2) 白Xタグ(首輪右側の小さな菱タグ) */
  {
    const tx = W * .66, ty = H * .745;
    g.save(); g.translate(tx, ty); g.rotate(.2);
    g.fillStyle = '#1a1a1f';
    g.beginPath(); g.moveTo(0, -20); g.lineTo(17, 0); g.lineTo(0, 20); g.lineTo(-17, 0); g.closePath(); g.fill();
    g.strokeStyle = '#f6f4ef'; g.lineWidth = 4.2; g.lineCap = 'round';
    g.beginPath(); g.moveTo(-8, -8); g.lineTo(8, 8); g.moveTo(8, -8); g.lineTo(-8, 8); g.stroke();
    g.restore();
  }
  /* 3) 金の三日月チャーム(首輪中央から胸へ) */
  {
    const cx = W * .5, cy = H * .78, r = 30;
    g.strokeStyle = 'rgba(212,160,23,.9)'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(cx, cy - 34); g.lineTo(cx, cy - r); g.stroke();
    g.save();
    g.shadowColor = 'rgba(255,212,0,.95)'; g.shadowBlur = 16;
    g.fillStyle = '#e8bc3a';
    g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
    g.restore();
    g.fillStyle = '#1c1408';
    g.beginPath(); g.arc(cx + r * .5, cy - r * .14, r * .8, 0, Math.PI * 2); g.fill();
    /* チャームのハイライト */
    g.strokeStyle = 'rgba(255,240,180,.9)'; g.lineWidth = 2.4;
    g.beginPath(); g.arc(cx, cy, r * .96, Math.PI * .55, Math.PI * 1.3); g.stroke();
  }
  /* 4) 蝶耳の毛先シアン回路ライン(左右の耳の輪郭に沿って) */
  const earTrace = (p0, c1, p1, branches) => {
    g.save();
    g.strokeStyle = 'rgba(0,229,255,.7)'; g.lineWidth = 1.9; g.lineCap = 'round';
    g.shadowColor = 'rgba(0,229,255,.85)'; g.shadowBlur = 10;
    g.beginPath(); g.moveTo(p0[0], p0[1]); g.quadraticCurveTo(c1[0], c1[1], p1[0], p1[1]); g.stroke();
    for (const [bx, by, ex, ey] of branches) {
      g.lineWidth = 1.4;
      g.beginPath(); g.moveTo(bx, by); g.lineTo(ex, ey); g.stroke();
      g.fillStyle = 'rgba(140,244,255,.95)';
      g.beginPath(); g.arc(ex, ey, 2.6, 0, Math.PI * 2); g.fill();
    }
    g.restore();
  };
  /* 左耳: 外輪郭 (下端→耳先) に沿う */
  earTrace([W*.10, H*.40], [W*.13, H*.24], [W*.31, H*.17],
    [[W*.15, H*.30, W*.19, H*.28], [W*.24, H*.21, W*.26, H*.25]]);
  /* 右耳: 外輪郭 (下端→耳先) に沿う */
  earTrace([W*.90, H*.34], [W*.83, H*.18], [W*.62, H*.14],
    [[W*.80, H*.22, W*.77, H*.26], [W*.70, H*.17, W*.71, H*.21]]);
  /* 6) 魔法の光粒 */
  for (let i = 0; i < 40; i++) {
    const gold = rnd() < .65;
    g.fillStyle = gold ? `rgba(255,220,120,${rr(.3,.8).toFixed(2)})` : `rgba(140,240,255,${rr(.25,.6).toFixed(2)})`;
    g.shadowColor = g.fillStyle; g.shadowBlur = 8;
    g.beginPath(); g.arc(rr(0, W), rr(0, H), rr(1.2, 3.2), 0, Math.PI * 2); g.fill();
    g.shadowBlur = 0;
  }

  /* ---- 油彩ストローク ---- */
  const src = g.getImageData(0, 0, W, H);
  const d = src.data;
  const lum = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) lum[i] = d[i*4]*.299 + d[i*4+1]*.587 + d[i*4+2]*.114;
  const gradDir = (x, y) => {
    x = Math.max(1, Math.min(W-2, x|0)); y = Math.max(1, Math.min(H-2, y|0));
    return Math.atan2(lum[(y+1)*W+x] - lum[(y-1)*W+x], lum[y*W+x+1] - lum[y*W+x-1]) + Math.PI/2;
  };
  const sample = (x, y) => {
    x = Math.max(0, Math.min(W-1, x|0)); y = Math.max(0, Math.min(H-1, y|0));
    const i = (y*W+x)*4; return [d[i], d[i+1], d[i+2]];
  };
  const out = document.createElement('canvas'); out.width = W; out.height = H;
  const og = out.getContext('2d');
  og.drawImage(c, 0, 0);
  og.lineCap = 'round';
  const passes = [
    { n: 3200, len: 30, w: [7, 13], a: [.5, .75], jit: 12 },
    { n: 6500, len: 16, w: [3, 6.5], a: [.45, .72], jit: 9 },
    { n: 11000, len: 8, w: [1.5, 3.2], a: [.4, .68], jit: 7 },
    { n: 6000, len: 4.5, w: [1, 2], a: [.35, .6], jit: 5, focus: { x: W*.46, y: H*.5, rx: 300, ry: 280 } },
  ];
  for (const p of passes) {
    for (let i = 0; i < p.n; i++) {
      let x, y;
      if (p.focus) {
        const t = rnd() * Math.PI * 2, r = Math.sqrt(rnd());
        x = p.focus.x + Math.cos(t) * p.focus.rx * r;
        y = p.focus.y + Math.sin(t) * p.focus.ry * r;
      } else { x = rnd() * W; y = rnd() * H; }
      const dir = gradDir(x, y) + rr(-.2, .2);
      const L = p.len * rr(.6, 1.25);
      const cc = sample(x, y);
      const j = p.jit;
      og.strokeStyle = `rgba(${Math.max(0,Math.min(255,cc[0]+rr(-j,j)))|0},${Math.max(0,Math.min(255,cc[1]+rr(-j,j)))|0},${Math.max(0,Math.min(255,cc[2]+rr(-j,j)))|0},${rr(p.a[0],p.a[1]).toFixed(2)})`;
      og.lineWidth = rr(p.w[0], p.w[1]);
      og.beginPath();
      og.moveTo(x - Math.cos(dir)*L*.5, y - Math.sin(dir)*L*.5);
      og.quadraticCurveTo(x + rr(-3,3), y + rr(-3,3), x + Math.cos(dir)*L*.5, y + Math.sin(dir)*L*.5);
      og.stroke();
    }
  }
  /* ---- 仕上げ ---- */
  const fin = document.createElement('canvas'); fin.width = W; fin.height = H;
  const fg = fin.getContext('2d');
  fg.filter = 'contrast(1.06) saturate(1.1)';
  fg.drawImage(out, 0, 0);
  fg.filter = 'none';
  const tex = document.createElement('canvas'); tex.width = W; tex.height = H;
  const tg = tex.getContext('2d');
  tg.fillStyle = '#808080'; tg.fillRect(0, 0, W, H);
  for (let y = 0; y < H; y += 3) { tg.fillStyle = `rgba(${rnd()<.5?118:140},${120+rnd()*20|0},${120+rnd()*20|0},.5)`; tg.fillRect(0, y, W, 1.4); }
  for (let x = 0; x < W; x += 3) { tg.fillStyle = `rgba(${125+rnd()*18|0},${125+rnd()*18|0},${118+rnd()*14|0},.32)`; tg.fillRect(x, 0, 1.4, H); }
  fg.globalCompositeOperation = 'overlay'; fg.globalAlpha = .2;
  fg.drawImage(tex, 0, 0);
  fg.globalCompositeOperation = 'source-over'; fg.globalAlpha = 1;
  const v = fg.createRadialGradient(W/2, H*.5, H*.3, W/2, H*.5, H*.8);
  v.addColorStop(0, 'rgba(5,7,16,0)'); v.addColorStop(1, 'rgba(5,7,16,.6)');
  fg.fillStyle = v; fg.fillRect(0, 0, W, H);
  const bfade = fg.createLinearGradient(0, H*.82, 0, H);
  bfade.addColorStop(0, 'rgba(5,7,16,0)'); bfade.addColorStop(1, 'rgba(5,7,16,.85)');
  fg.fillStyle = bfade; fg.fillRect(0, H*.82, W, H*.18);
  return fin.toDataURL('image/jpeg', .82);
});
fs.writeFileSync(OUT + 'phantom-papillon-portrait.jpg', Buffer.from(dataUrl.split(',')[1], 'base64'));
console.log('portrait', Math.round(fs.statSync(OUT + 'phantom-papillon-portrait.jpg').size / 1024) + 'KB');
await browser.close();
