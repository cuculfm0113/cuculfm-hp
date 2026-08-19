import puppeteer from 'puppeteer-core';
import fs from 'node:fs';

const OUT = '/Users/babakyohei/Library/Mobile Documents/com~apple~CloudDocs/cursor_product/HP/images/news/';
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new', args: ['--remote-allow-origins=*'],
});
const page = await browser.newPage();
await page.goto('http://localhost:8123/', { waitUntil: 'domcontentloaded' });

/* ページ内に油彩パイプラインを注入(全カード共通) */
await page.evaluate(() => {
  const W = 840, H = 640;
  window.ART = { W, H };

  window.mkRnd = seed => () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };

  /* ---- 油彩ストローク・パス ----
     下絵の輝度勾配に直交する向きへ、色サンプル+ジッタの短い弧を重ねる */
  window.oilPaint = (srcCanvas, opts = {}) => {
    const rnd = window.mkRnd(opts.seed ?? 1);
    const rr = (a, b) => a + (b - a) * rnd();
    const g0 = srcCanvas.getContext('2d');
    const img = g0.getImageData(0, 0, W, H);
    const d = img.data;
    const lum = new Float32Array(W * H);
    for (let i = 0; i < W * H; i++) lum[i] = d[i*4] * .299 + d[i*4+1] * .587 + d[i*4+2] * .114;
    const gradDir = (x, y) => {
      x = Math.max(1, Math.min(W - 2, x | 0)); y = Math.max(1, Math.min(H - 2, y | 0));
      const gx = lum[y*W+x+1] - lum[y*W+x-1];
      const gy = lum[(y+1)*W+x] - lum[(y-1)*W+x];
      return Math.atan2(gy, gx) + Math.PI / 2;    // エッジに沿う向き
    };
    const sample = (x, y) => {
      x = Math.max(0, Math.min(W - 1, x | 0)); y = Math.max(0, Math.min(H - 1, y | 0));
      const i = (y * W + x) * 4;
      return [d[i], d[i+1], d[i+2]];
    };
    const out = document.createElement('canvas');
    out.width = W; out.height = H;
    const g = out.getContext('2d');
    g.drawImage(srcCanvas, 0, 0);
    g.lineCap = 'round';
    const passes = opts.passes || [
      { n: 2600, len: 30, w: [7, 13], a: [.55, .8], jit: 14 },
      { n: 5200, len: 17, w: [3.5, 7], a: [.5, .8], jit: 11 },
      { n: 9000, len: 8,  w: [1.6, 3.4], a: [.45, .75], jit: 8 },
    ];
    for (const p of passes) {
      for (let i = 0; i < p.n; i++) {
        let x, y;
        if (p.focus) {   // 焦点楕円内に集中(細部パス用)
          const t = rnd() * Math.PI * 2, r = Math.sqrt(rnd());
          x = p.focus.x + Math.cos(t) * p.focus.rx * r;
          y = p.focus.y + Math.sin(t) * p.focus.ry * r;
        } else { x = rnd() * W; y = rnd() * H; }
        const dir = gradDir(x, y) + rr(-.22, .22);
        const L = p.len * rr(.6, 1.25);
        const c = sample(x, y);
        const j = p.jit;
        const col = `rgba(${Math.max(0,Math.min(255,c[0]+rr(-j,j)))|0},${Math.max(0,Math.min(255,c[1]+rr(-j,j)))|0},${Math.max(0,Math.min(255,c[2]+rr(-j,j)))|0},${rr(p.a[0], p.a[1]).toFixed(2)})`;
        g.strokeStyle = col;
        g.lineWidth = rr(p.w[0], p.w[1]);
        const mx = x + Math.cos(dir) * L * .5 + rr(-2, 2);
        const my = y + Math.sin(dir) * L * .5 + rr(-2, 2);
        g.beginPath();
        g.moveTo(x - Math.cos(dir) * L * .5, y - Math.sin(dir) * L * .5);
        g.quadraticCurveTo(mx + rr(-3, 3), my + rr(-3, 3), x + Math.cos(dir) * L * .5, y + Math.sin(dir) * L * .5);
        g.stroke();
      }
    }
    return out;
  };

  /* ---- 仕上げ: 織り目テクスチャ + ビネット + グレーディング ---- */
  window.finish = (painted, opts = {}) => {
    const rnd = window.mkRnd(opts.seed ?? 7);
    const out = document.createElement('canvas');
    out.width = W; out.height = H;
    const g = out.getContext('2d');
    g.filter = `contrast(${opts.contrast ?? 1.06}) saturate(${opts.saturate ?? 1.12})`;
    g.drawImage(painted, 0, 0);
    g.filter = 'none';
    /* キャンバス織り目 */
    const tex = document.createElement('canvas');
    tex.width = W; tex.height = H;
    const tg = tex.getContext('2d');
    tg.fillStyle = '#808080'; tg.fillRect(0, 0, W, H);
    for (let y = 0; y < H; y += 3) {
      tg.fillStyle = `rgba(${rnd() < .5 ? 118 : 140},${120 + rnd()*20|0},${120 + rnd()*20|0},.5)`;
      tg.fillRect(0, y, W, 1.4);
    }
    for (let x = 0; x < W; x += 3) {
      tg.fillStyle = `rgba(${125 + rnd()*18|0},${125 + rnd()*18|0},${118 + rnd()*14|0},.32)`;
      tg.fillRect(x, 0, 1.4, H);
    }
    g.globalCompositeOperation = 'overlay';
    g.globalAlpha = opts.texture ?? 0.22;
    g.drawImage(tex, 0, 0);
    /* ビネット */
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = 1;
    const v = g.createRadialGradient(W/2, H/2, H*.34, W/2, H/2, H*.86);
    v.addColorStop(0, 'rgba(6,6,14,0)');
    v.addColorStop(1, `rgba(6,6,14,${opts.vignette ?? .5})`);
    g.fillStyle = v; g.fillRect(0, 0, W, H);
    return out;
  };

  /* 共通パーツ: 星空・三日月 */
  window.stars = (g, rnd, n, yMax) => {
    for (let i = 0; i < n; i++) {
      const a = .25 + rnd() * .7;
      g.fillStyle = `rgba(235,240,255,${a.toFixed(2)})`;
      const s = rnd() < .12 ? 2.2 : 1.2;
      g.fillRect(rnd() * W, rnd() * yMax, s, s);
    }
  };
  window.crescent = (g, x, y, r, glow = 1, bg = '#0a0e20') => {
    g.save();
    g.shadowColor = 'rgba(255,220,120,.9)'; g.shadowBlur = 26 * glow;
    g.fillStyle = '#f2d98c';
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    g.restore();
    g.fillStyle = bg;   /* 欠け(透明にすると油彩パスで黒サンプルされ満月化する) */
    g.beginPath(); g.arc(x + r * .42, y - r * .18, r * .88, 0, Math.PI * 2); g.fill();
  };
});

const save = (name, dataUrl) => {
  fs.writeFileSync(OUT + name, Buffer.from(dataUrl.split(',')[1], 'base64'));
  console.log(name, Math.round(fs.statSync(OUT + name).size / 1024) + 'KB');
};

/* ============ 1. ARTICLES 知識の書 ============ */
save('news-01-articles.jpg', await page.evaluate(() => {
  const { W, H } = window.ART;
  const rnd = window.mkRnd(0xA1);
  const rr = (a, b) => a + (b - a) * rnd();
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  /* 夜空 */
  const bg = g.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#070b1c'); bg.addColorStop(.55, '#101832'); bg.addColorStop(1, '#1a1428');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  /* 星雲 */
  for (const [x, y, r, col] of [[W*.2, H*.3, 220, '0,204,230'], [W*.8, H*.25, 260, '123,97,255']]) {
    const n = g.createRadialGradient(x, y, 0, x, y, r);
    n.addColorStop(0, `rgba(${col},.14)`); n.addColorStop(1, `rgba(${col},0)`);
    g.fillStyle = n; g.fillRect(0, 0, W, H);
  }
  window.stars(g, rnd, 130, H * .6);
  window.crescent(g, W * .16, H * .18, 42);
  /* 光柱(書物から) */
  const bx = W * .5, by = H * .78;
  const beam = g.createLinearGradient(0, by, 0, H * .1);
  beam.addColorStop(0, 'rgba(255,214,90,.5)'); beam.addColorStop(.5, 'rgba(255,214,90,.16)'); beam.addColorStop(1, 'rgba(255,214,90,0)');
  g.fillStyle = beam;
  g.beginPath(); g.moveTo(bx - 46, by); g.lineTo(bx - 120, H * .08); g.lineTo(bx + 120, H * .08); g.lineTo(bx + 46, by); g.closePath(); g.fill();
  const glow = g.createRadialGradient(bx, by - 20, 0, bx, by - 20, 300);
  glow.addColorStop(0, 'rgba(255,210,80,.55)'); glow.addColorStop(1, 'rgba(255,210,80,0)');
  g.fillStyle = glow; g.fillRect(0, 0, W, H);
  /* 机のマッス(書物の台) */
  g.fillStyle = '#160f0a';
  g.fillRect(0, by + 46, W, H - by - 46);
  g.fillStyle = 'rgba(90,62,26,.55)';
  g.fillRect(0, by + 46, W, 10);
  /* 書物(開いた見開き) */
  const bookY = by;
  g.fillStyle = '#241a10';
  g.beginPath(); g.moveTo(bx - 230, bookY + 10); g.quadraticCurveTo(bx, bookY + 68, bx + 230, bookY + 10);
  g.lineTo(bx + 230, bookY + 48); g.quadraticCurveTo(bx, bookY + 104, bx - 230, bookY + 48); g.closePath(); g.fill();
  const pg = g.createLinearGradient(bx - 180, 0, bx + 180, 0);
  pg.addColorStop(0, '#e0bd74'); pg.addColorStop(.48, '#fff0be'); pg.addColorStop(.52, '#fffbe2'); pg.addColorStop(1, '#e0bd74');
  g.fillStyle = pg;
  g.beginPath(); g.moveTo(bx - 218, bookY); g.quadraticCurveTo(bx - 110, bookY - 32, bx, bookY - 8);
  g.quadraticCurveTo(bx + 110, bookY - 32, bx + 218, bookY);
  g.quadraticCurveTo(bx, bookY + 56, bx - 218, bookY); g.closePath(); g.fill();
  /* ページの行 */
  g.strokeStyle = 'rgba(120,90,40,.5)'; g.lineWidth = 1.6;
  for (let i = 1; i <= 4; i++) {
    g.beginPath();
    g.moveTo(bx - 185, bookY + i * 9);
    g.quadraticCurveTo(bx - 92, bookY - 24 + i * 9, bx - 24, bookY + i * 9);
    g.stroke();
    g.beginPath();
    g.moveTo(bx + 24, bookY + i * 9);
    g.quadraticCurveTo(bx + 92, bookY - 24 + i * 9, bx + 185, bookY + i * 9);
    g.stroke();
  }
  /* 立ち上る文字粒子(ルーン) */
  for (let i = 0; i < 46; i++) {
    const px = bx + rr(-85, 85), py = rr(H * .16, by - 30);
    const fall = 1 - (by - py) / (by - H * .16);
    g.save();
    g.translate(px, py); g.rotate(rr(-.5, .5));
    g.strokeStyle = `rgba(255,226,130,${(.25 + fall * .55).toFixed(2)})`;
    g.lineWidth = rr(1.2, 2.4);
    g.shadowColor = 'rgba(255,214,90,.8)'; g.shadowBlur = 7;
    const s = rr(4, 11);
    g.beginPath(); g.moveTo(-s/2, 0); g.lineTo(s/2, 0);
    if (rnd() < .5) { g.moveTo(0, -s/2); g.lineTo(0, s/2); }
    if (rnd() < .4) { g.moveTo(-s/2, -s/2); g.lineTo(s/2, s/2); }
    g.stroke(); g.restore();
  }
  const painted = window.oilPaint(c, { seed: 0xA2 });
  return window.finish(painted, { seed: 0xA3 }).toDataURL('image/jpeg', .8);
}));

/* ============ 2. RECRUIT 月光の道 ============ */
save('news-02-recruit.jpg', await page.evaluate(() => {
  const { W, H } = window.ART;
  const rnd = window.mkRnd(0xB1);
  const rr = (a, b) => a + (b - a) * rnd();
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  const bg = g.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#060a18'); bg.addColorStop(.6, '#121a34'); bg.addColorStop(1, '#0c1020');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  window.stars(g, rnd, 120, H * .5);
  /* 満月 */
  const mx = W * .62, my = H * .3, mr = 92;
  const halo = g.createRadialGradient(mx, my, mr * .6, mx, my, mr * 3);
  halo.addColorStop(0, 'rgba(255,235,170,.5)'); halo.addColorStop(1, 'rgba(255,235,170,0)');
  g.fillStyle = halo; g.fillRect(0, 0, W, H);
  const moon = g.createRadialGradient(mx - mr*.3, my - mr*.3, mr*.1, mx, my, mr);
  moon.addColorStop(0, '#fff6d8'); moon.addColorStop(.75, '#f4dd9c'); moon.addColorStop(1, '#d9b96a');
  g.fillStyle = moon;
  g.beginPath(); g.arc(mx, my, mr, 0, Math.PI * 2); g.fill();
  g.fillStyle = 'rgba(190,160,100,.2)';
  for (const [ox, oy, or_] of [[-.3, -.1, .16], [.2, .25, .12], [.28, -.3, .09], [-.05, .38, .07]]) {
    g.beginPath(); g.arc(mx + mr*ox, my + mr*oy, mr*or_, 0, Math.PI * 2); g.fill();
  }
  /* 地平・丘 */
  g.fillStyle = '#0a0d1c';
  g.beginPath(); g.moveTo(0, H * .72);
  g.quadraticCurveTo(W * .3, H * .66, W * .55, H * .7);
  g.quadraticCurveTo(W * .8, H * .74, W, H * .69);
  g.lineTo(W, H); g.lineTo(0, H); g.closePath(); g.fill();
  /* 丘の縁の月光 */
  g.strokeStyle = 'rgba(255,232,150,.28)'; g.lineWidth = 3;
  g.beginPath(); g.moveTo(0, H * .72);
  g.quadraticCurveTo(W * .3, H * .66, W * .55, H * .7);
  g.quadraticCurveTo(W * .8, H * .74, W, H * .69);
  g.stroke();
  /* 月光の道 */
  const road = g.createLinearGradient(0, H, 0, H * .68);
  road.addColorStop(0, 'rgba(255,232,150,.75)'); road.addColorStop(.7, 'rgba(255,225,120,.3)'); road.addColorStop(1, 'rgba(255,225,120,.06)');
  g.fillStyle = road;
  g.beginPath(); g.moveTo(W * .3, H); g.lineTo(mx - 26, H * .69); g.lineTo(mx + 26, H * .69); g.lineTo(W * .78, H); g.closePath(); g.fill();
  /* 歩む作業者シルエット(ヘルメット) */
  const px = W * .52, py = H * .82, s = 1.4;
  g.fillStyle = '#05060c';
  g.save(); g.translate(px, py); g.scale(s, s);
  g.beginPath();  // 胴+脚(歩行)
  g.moveTo(-13, 0); g.quadraticCurveTo(-15, -34, -9, -52);
  g.lineTo(9, -52); g.quadraticCurveTo(15, -32, 12, 0);
  g.lineTo(20, 34); g.lineTo(13, 35); g.lineTo(3, 6);
  g.lineTo(-9, 36); g.lineTo(-16, 34); g.lineTo(-6, -2); g.closePath(); g.fill();
  g.beginPath(); g.arc(0, -62, 11, 0, Math.PI * 2); g.fill();     // 頭
  g.beginPath(); g.ellipse(0, -66, 15, 7, 0, Math.PI, 0); g.fill(); // ヘルメット
  g.fillRect(-16, -68, 32, 4);
  /* 月光のリムライト */
  g.strokeStyle = 'rgba(255,235,160,.85)'; g.lineWidth = 2.4; g.lineCap = 'round';
  g.beginPath(); g.moveTo(10, -50); g.quadraticCurveTo(14, -30, 12, -2); g.stroke();
  g.beginPath(); g.ellipse(2, -66, 14, 7, 0, -Math.PI * .1, Math.PI * .45); g.stroke();
  g.restore();
  /* 手前へ落ちる影 */
  g.fillStyle = 'rgba(4,5,10,.55)';
  g.beginPath(); g.ellipse(px, py + 40, 46, 10, 0, 0, Math.PI * 2); g.fill();
  const painted = window.oilPaint(c, { seed: 0xB2 });
  return window.finish(painted, { seed: 0xB3 }).toDataURL('image/jpeg', .8);
}));

/* ============ 3. EVENT 祝祭の夜 ============ */
save('news-03-event.jpg', await page.evaluate(() => {
  const { W, H } = window.ART;
  const rnd = window.mkRnd(0xC1);
  const rr = (a, b) => a + (b - a) * rnd();
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  const bg = g.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#08060f'); bg.addColorStop(.65, '#141024'); bg.addColorStop(1, '#20101c');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  window.stars(g, rnd, 80, H * .5);
  window.crescent(g, W * .88, H * .14, 30, .7, '#0a0812');
  /* 花火バースト */
  const burst = (cx, cy, R, cols, n, seedOff) => {
    const r2 = window.mkRnd(0xC2 + seedOff);
    const rb = (a, b) => a + (b - a) * r2();
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rb(-.05, .05);
      const L = R * rb(.55, 1);
      const col = cols[i % cols.length];
      const gr = g.createLinearGradient(cx, cy, cx + Math.cos(a) * L, cy + Math.sin(a) * L);
      gr.addColorStop(0, `rgba(${col},.9)`); gr.addColorStop(.8, `rgba(${col},.35)`); gr.addColorStop(1, `rgba(${col},0)`);
      g.strokeStyle = gr; g.lineWidth = rb(1.6, 3.2); g.lineCap = 'round';
      g.beginPath(); g.moveTo(cx + Math.cos(a) * R * .08, cy + Math.sin(a) * R * .08);
      const bend = rb(-8, 8);
      g.quadraticCurveTo(cx + Math.cos(a) * L * .55 + bend, cy + Math.sin(a) * L * .55 + rb(2, 12),
        cx + Math.cos(a) * L, cy + Math.sin(a) * L + rb(4, 16));
      g.stroke();
      g.fillStyle = `rgba(${col},${rb(.6, 1).toFixed(2)})`;
      g.shadowColor = `rgba(${col},.9)`; g.shadowBlur = 8;
      g.beginPath(); g.arc(cx + Math.cos(a) * L, cy + Math.sin(a) * L + rb(4, 14), rb(1.6, 3.4), 0, Math.PI * 2); g.fill();
      g.shadowBlur = 0;
    }
    const core = g.createRadialGradient(cx, cy, 0, cx, cy, R * .5);
    core.addColorStop(0, 'rgba(255,246,200,.9)'); core.addColorStop(1, 'rgba(255,246,200,0)');
    g.fillStyle = core; g.fillRect(cx - R, cy - R, R * 2, R * 2);
  };
  burst(W * .42, H * .32, 210, ['255,214,90', '255,190,60'], 46, 1);
  burst(W * .75, H * .45, 120, ['0,204,230', '140,240,255'], 34, 2);
  burst(W * .18, H * .5, 100, ['255,107,107', '255,150,90'], 30, 3);
  /* 群衆シルエット+提灯 */
  g.fillStyle = '#07060d';
  g.beginPath(); g.moveTo(0, H);
  let x = 0;
  g.lineTo(0, H * .88);
  while (x < W) {
    const w = rr(24, 52);
    g.quadraticCurveTo(x + w / 2, H * (.83 + rr(-.02, .02)), x + w, H * (.88 + rr(-.01, .015)));
    x += w;
  }
  g.lineTo(W, H); g.closePath(); g.fill();
  for (let i = 0; i < 14; i++) {
    const lx = rr(30, W - 30), ly = H * rr(.9, .97);
    g.fillStyle = `rgba(255,${170 + rnd()*50|0},70,${rr(.5, .95).toFixed(2)})`;
    g.shadowColor = 'rgba(255,180,80,.9)'; g.shadowBlur = 10;
    g.beginPath(); g.arc(lx, ly, rr(2.4, 4.6), 0, Math.PI * 2); g.fill();
    g.shadowBlur = 0;
  }
  const painted = window.oilPaint(c, { seed: 0xC3 });
  return window.finish(painted, { seed: 0xC4, saturate: 1.18 }).toDataURL('image/jpeg', .8);
}));

/* ============ 4. PUPPIES 月光の使い魔(写真→油彩) ============ */
save('news-04-puppies.jpg', await page.evaluate(async () => {
  const { W, H } = window.ART;
  const rnd = window.mkRnd(0xD1);
  const rr = (a, b) => a + (b - a) * rnd();
  const img = new Image();
  img.src = '/images/gallery/papillon-dog.png';
  await img.decode();
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  /* 夜のパレットへ寄せて写真を敷く(顔中心のクロップ) */
  g.filter = 'saturate(.85) brightness(.82) contrast(1.05)';
  /* 元 1365x2048 → 横 840x640: 引きで顔全体+胸元 */
  g.drawImage(img, 55, 340, 1250, 953, 0, 0, W, H);
  g.filter = 'none';
  /* 夜色のグレーズ(青を全体に、金を右上から) */
  g.globalCompositeOperation = 'multiply';
  const cool = g.createLinearGradient(0, 0, 0, H);
  cool.addColorStop(0, '#6f7ec2'); cool.addColorStop(.4, '#9aa4d4'); cool.addColorStop(1, '#b8a68e');
  g.fillStyle = cool; g.fillRect(0, 0, W, H);
  g.globalCompositeOperation = 'screen';
  const warm = g.createRadialGradient(W * .78, H * .1, 0, W * .78, H * .1, H * .9);
  warm.addColorStop(0, 'rgba(255,214,120,.4)'); warm.addColorStop(1, 'rgba(255,214,120,0)');
  g.fillStyle = warm; g.fillRect(0, 0, W, H);
  g.globalCompositeOperation = 'source-over';
  /* 上部のピンク被り(背景のクレート色)を夜空へ沈める */
  const topFix = g.createLinearGradient(0, 0, 0, H * .34);
  topFix.addColorStop(0, 'rgba(9,12,30,.88)');
  topFix.addColorStop(.6, 'rgba(9,12,30,.4)');
  topFix.addColorStop(1, 'rgba(9,12,30,0)');
  g.fillStyle = topFix; g.fillRect(0, 0, W, H * .34);
  /* 頭上の光輪 */
  const hx = W * .52, hy = H * .1;
  g.save();
  g.strokeStyle = 'rgba(255,226,130,.9)'; g.lineWidth = 5;
  g.shadowColor = 'rgba(255,214,90,.95)'; g.shadowBlur = 18;
  g.beginPath(); g.ellipse(hx, hy, 92, 24, -.06, 0, Math.PI * 2); g.stroke();
  g.strokeStyle = 'rgba(255,240,190,.5)'; g.lineWidth = 2;
  g.beginPath(); g.ellipse(hx, hy, 76, 18, -.06, 0, Math.PI * 2); g.stroke();
  g.restore();
  /* 魔法の光粒 */
  for (let i = 0; i < 34; i++) {
    const px = rr(0, W), py = rr(0, H);
    const gold = rnd() < .7;
    g.fillStyle = gold ? `rgba(255,220,120,${rr(.3, .8).toFixed(2)})` : `rgba(140,240,255,${rr(.25, .6).toFixed(2)})`;
    g.shadowColor = g.fillStyle; g.shadowBlur = 8;
    g.beginPath(); g.arc(px, py, rr(1.2, 3), 0, Math.PI * 2); g.fill();
    g.shadowBlur = 0;
  }
  /* 焦点=顔に細部パスを追加(目鼻の可読性維持) */
  const painted = window.oilPaint(c, {
    seed: 0xD2,
    passes: [
      { n: 2200, len: 26, w: [6, 12], a: [.5, .75], jit: 12 },
      { n: 4600, len: 15, w: [3, 6], a: [.45, .72], jit: 9 },
      { n: 8000, len: 7.5, w: [1.5, 3], a: [.4, .7], jit: 7 },
      { n: 4200, len: 4.5, w: [1, 2], a: [.35, .6], jit: 5, focus: { x: W * .5, y: H * .56, rx: 260, ry: 190 } },
    ],
  });
  return window.finish(painted, { seed: 0xD3, saturate: 1.08, vignette: .56 }).toDataURL('image/jpeg', .8);
}));

await browser.close();
console.log('done');
