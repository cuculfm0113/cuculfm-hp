/* MTG風フルカード サムネイル生成(ブログ記事13本)
   - 630×880(63:88)。金縁フレーム+タイトルバー+油彩アート窓+タイプ行+フレーバー欄
   - アートは legacy/gen-cardart.mjs の油彩パイプライン(決定的シード)を小型化して再利用
   - 前提: リポジトリルートで python3 -m http.server 8123 / cd scripts && npm i
   実行: node gen-mtg-cards.mjs [slug...]   (slug省略で全13枚) */
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = path.join(REPO, 'images', 'cards');
fs.mkdirSync(OUT, { recursive: true });

/* ============ マニフェスト(創作フィールド=カード名/フレーバーはFable起案) ============ */
const CATS = {
  inspection: { label: '調査・清掃', color: '56,189,168', en: 'INSPECTION' },
  dog: { label: '犬関連', color: '245,225,0', en: 'DOG' },
};
const CARDS = [
  // --- 調査・清掃 (photo×5=無加工写真, procedural×4) ---
  { slug: 'sewer-camera-methods', cat: 'inspection', num: 1, seed: 0x51C1,
    name: '管の眼', flavor: '「どこまで入り、何を記録するか。\n方式は目的が決める。」',
    template: 'photoPlain', photo: '/images/gallery/pipe-interior-camera.png', crop: { cx: .5, cy: .5, zoom: 1 } },
  { slug: 'sewer-damage-report', cat: 'inspection', num: 2, seed: 0x52C2,
    name: '損傷の記号', flavor: '「記号は現場の言葉。\n写真がその証人となる。」',
    template: 'photoPlain', photo: '/images/gallery/pipe-circular-inspection.png', crop: { cx: .5, cy: .5, zoom: 1 } },
  { slug: 'manhole-safety', cat: 'inspection', num: 3, seed: 0x53C3,
    name: '深淵の作法', flavor: '「開けた穴の下には、\n見えない毒が眠る。」',
    template: 'photoPlain', photo: '/images/gallery/manhole-work-site.png', crop: { cx: .5, cy: .55, zoom: 1.1 } },
  { slug: 'sewer-qualifications', cat: 'inspection', num: 4, seed: 0x54C4,
    name: '資格の地図', flavor: '「道は一本ではない。\n地図を持つ者は迷わない。」',
    template: 'photoPlain', photo: '/images/gallery/sewer-training-session.png', crop: { cx: .5, cy: .45, zoom: 1.05 } },
  { slug: 'sewer-exam-study', cat: 'inspection', num: 5, seed: 0x55C5,
    name: '過去問の塔', flavor: '「過去を解く者だけが、\n未来の管を診る。」',
    template: 'photoPlain', photo: '/images/gallery/pipe-inspection-control.png', crop: { cx: .5, cy: .5, zoom: 1 } },
  { slug: 'solar-panel-cleaning', cat: 'inspection', num: 6, seed: 0x56C6,
    name: '月光の鏡面', flavor: '「取説が正。屋根に上がらぬ\n賢者の清掃。」', template: 'moonPanels' },
  { slug: 'drone-wall-inspection', cat: 'inspection', num: 7, seed: 0x57C7,
    name: '壁面の斥候', flavor: '「打診に代わる翼。\n条件は告示が定める。」', template: 'droneSentinel' },
  { slug: 'aircon-cleaning', cat: 'inspection', num: 8, seed: 0x58C8,
    name: '白風の祠', flavor: '「フィルターは自分の手で。\n分解洗浄は資格の業。」', template: 'whiteBreeze' },
  { slug: 'gutter-cleaning', cat: 'inspection', num: 9, seed: 0x59C9,
    name: '雨樋の川守', flavor: '「溢れたあとに見る順番。\n高所を無理しない。」', template: 'rainGutter' },
  // --- 犬関連 (photo×4=無加工写真。犬写真無加工の掟にも合致) ---
  { slug: 'trust-relationship', cat: 'dog', num: 10, seed: 0x5AD1,
    name: '前日の約束', flavor: '「来店前夜の支度が、\n明日の安心を連れてくる。」',
    template: 'photoPlain', photo: '/services/dog/images/papillon-smile.jpg',
    crop: { cx: .5, cy: .4, zoom: 1.05 } },
  { slug: 'puppy-preparation', cat: 'dog', num: 11, seed: 0x5BD2,
    name: '迎え火の支度', flavor: '「道具、安全、病院、家族の約束。\n新しい家族のために。」',
    template: 'photoPlain', photo: '/services/dog/images/black-poodle-ribbon.jpg',
    crop: { cx: .5, cy: .46, zoom: 1 } },
  { slug: 'home-grooming', cat: 'dog', num: 12, seed: 0x5CD3,
    name: '白雲の手入れ', flavor: '「自宅の手入れとプロの境目。\n道具がそれを教えてくれる。」',
    template: 'photoPlain', photo: '/services/dog/images/bichon-white.jpg',
    crop: { cx: .5, cy: .38, zoom: 1.05 } },
  { slug: 'seasonal-health-care', cat: 'dog', num: 13, seed: 0x5DD4,
    name: '四季の見張り番', flavor: '「夏の熱、冬の冷え。\n季節は犬にも巡る。」',
    template: 'photoPlain', photo: '/services/dog/images/schnauzer.jpg',
    crop: { cx: .48, cy: .45, zoom: 1 } },
];

const only = process.argv.slice(2);
const targets = only.length ? CARDS.filter(c => only.includes(c.slug)) : CARDS;
if (!targets.length) { console.error('no matching slugs'); process.exit(1); }

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new', args: ['--remote-allow-origins=*'],
});
const page = await browser.newPage();
await page.goto('http://localhost:8123/', { waitUntil: 'domcontentloaded' });

/* ============ ページ内パイプライン注入 ============ */
await page.evaluate(() => {
  const AW = 542, AH = 424;            // アート窓
  const CW = 630, CH = 880;            // カード全体
  window.DIM = { AW, AH, CW, CH };

  window.mkRnd = seed => () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };

  /* 油彩(legacyと同数式、寸法のみ引数化) */
  window.oilPaint = (srcCanvas, opts = {}) => {
    const W = srcCanvas.width, H = srcCanvas.height;
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
      return Math.atan2(gy, gx) + Math.PI / 2;
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
      { n: 1400, len: 24, w: [6, 11], a: [.55, .8], jit: 14 },
      { n: 3000, len: 14, w: [3, 6], a: [.5, .8], jit: 11 },
      { n: 5200, len: 7, w: [1.5, 3], a: [.45, .75], jit: 8 },
    ];
    for (const p of passes) {
      for (let i = 0; i < p.n; i++) {
        let x, y;
        if (p.focus) {
          const t = rnd() * Math.PI * 2, r = Math.sqrt(rnd());
          x = p.focus.x + Math.cos(t) * p.focus.rx * r;
          y = p.focus.y + Math.sin(t) * p.focus.ry * r;
        } else { x = rnd() * W; y = rnd() * H; }
        const dir = gradDir(x, y) + rr(-.22, .22);
        const L = p.len * rr(.6, 1.25);
        const c = sample(x, y);
        const j = p.jit;
        g.strokeStyle = `rgba(${Math.max(0,Math.min(255,c[0]+rr(-j,j)))|0},${Math.max(0,Math.min(255,c[1]+rr(-j,j)))|0},${Math.max(0,Math.min(255,c[2]+rr(-j,j)))|0},${rr(p.a[0], p.a[1]).toFixed(2)})`;
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

  /* 仕上げ(織り目+ビネット+グレーディング、寸法非依存) */
  window.finish = (painted, opts = {}) => {
    const W = painted.width, H = painted.height;
    const rnd = window.mkRnd(opts.seed ?? 7);
    const out = document.createElement('canvas');
    out.width = W; out.height = H;
    const g = out.getContext('2d');
    g.filter = `contrast(${opts.contrast ?? 1.06}) saturate(${opts.saturate ?? 1.12})`;
    g.drawImage(painted, 0, 0);
    g.filter = 'none';
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
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = 1;
    const v = g.createRadialGradient(W/2, H/2, H*.34, W/2, H/2, H*.86);
    v.addColorStop(0, 'rgba(6,6,14,0)');
    v.addColorStop(1, `rgba(6,6,14,${opts.vignette ?? .5})`);
    g.fillStyle = v; g.fillRect(0, 0, W, H);
    return out;
  };

  window.stars = (g, rnd, n, W, yMax) => {
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
    g.fillStyle = bg;   /* 欠けは背景色で塗る(透明だと油彩が黒サンプル→満月化) */
    g.beginPath(); g.arc(x + r * .42, y - r * .18, r * .88, 0, Math.PI * 2); g.fill();
  };

  const nightSky = (g, W, H, top = '#060a18', mid = '#101a34', bot = '#0c1224') => {
    const bg = g.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, top); bg.addColorStop(.55, mid); bg.addColorStop(1, bot);
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
  };

  /* ============ シーンテンプレート(542×424 の下絵を返す) ============ */
  window.SCENES = {

    /* 写真そのまま(クロップのみ・無加工。分かりやすさ優先モード) */
    photoPlain: async (spec) => {
      const { AW, AH } = window.DIM;
      const img = new Image();
      img.src = spec.photo;
      await img.decode();
      const NW = img.naturalWidth, NH = img.naturalHeight;
      const targetAR = AW / AH;
      let cw = NW / (spec.crop?.zoom ?? 1);
      let ch = cw / targetAR;
      if (ch > NH) { ch = NH / (spec.crop?.zoom ?? 1); cw = ch * targetAR; }
      const cx = (spec.crop?.cx ?? .5) * NW, cy = (spec.crop?.cy ?? .5) * NH;
      const sx = Math.max(0, Math.min(NW - cw, cx - cw / 2));
      const sy = Math.max(0, Math.min(NH - ch, cy - ch / 2));
      const c = document.createElement('canvas'); c.width = AW; c.height = AH;
      const g = c.getContext('2d');
      g.imageSmoothingQuality = 'high';
      g.filter = 'saturate(1.02) contrast(1.03)';
      g.drawImage(img, sx, sy, cw, ch, 0, 0, AW, AH);
      g.filter = 'none';
      return c;
    },

    /* 写真→夜の油彩(クロップ+グレーズ+光粒) */
    photoOil: async (spec) => {
      const { AW, AH } = window.DIM;
      const rnd = window.mkRnd(spec.seed);
      const rr = (a, b) => a + (b - a) * rnd();
      const img = new Image();
      img.src = spec.photo;
      await img.decode();
      const NW = img.naturalWidth, NH = img.naturalHeight;
      const targetAR = AW / AH;
      let cw = NW / (spec.crop?.zoom ?? 1);
      let ch = cw / targetAR;
      if (ch > NH) { ch = NH / (spec.crop?.zoom ?? 1); cw = ch * targetAR; }
      const cx = (spec.crop?.cx ?? .5) * NW, cy = (spec.crop?.cy ?? .5) * NH;
      const sx = Math.max(0, Math.min(NW - cw, cx - cw / 2));
      const sy = Math.max(0, Math.min(NH - ch, cy - ch / 2));
      const c = document.createElement('canvas'); c.width = AW; c.height = AH;
      const g = c.getContext('2d');
      const tune = spec.tune || {};
      g.imageSmoothingQuality = 'high';
      g.filter = `saturate(.85) brightness(${tune.brightness ?? .84}) contrast(${tune.contrast ?? 1.05})`;
      g.drawImage(img, sx, sy, cw, ch, 0, 0, AW, AH);
      g.filter = 'none';
      /* 夜色グレーズ(cool=強度0..1) */
      const coolA = tune.cool ?? .6;
      g.globalCompositeOperation = 'multiply';
      g.globalAlpha = coolA;
      const cool = g.createLinearGradient(0, 0, 0, AH);
      cool.addColorStop(0, '#5a68ae'); cool.addColorStop(.45, '#8a94c8'); cool.addColorStop(1, '#a89880');
      g.fillStyle = cool; g.fillRect(0, 0, AW, AH);
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'screen';
      const warm = g.createRadialGradient(AW * .76, AH * .08, 0, AW * .76, AH * .08, AH * .95);
      warm.addColorStop(0, `rgba(255,214,120,${(tune.warm ?? .38).toFixed(2)})`);
      warm.addColorStop(1, 'rgba(255,214,120,0)');
      g.fillStyle = warm; g.fillRect(0, 0, AW, AH);
      /* シアンHUDティント(管内カメラ等の機械の眼) */
      if (tune.cyan) {
        const hud = g.createRadialGradient(AW / 2, AH / 2, AH * .1, AW / 2, AH / 2, AH * .85);
        hud.addColorStop(0, `rgba(0,229,255,${tune.cyan.toFixed(2)})`);
        hud.addColorStop(1, 'rgba(0,229,255,0)');
        g.fillStyle = hud; g.fillRect(0, 0, AW, AH);
      }
      g.globalCompositeOperation = 'source-over';
      /* 上部を夜空へ沈める(明るい昼写真用) */
      if (tune.topScrim) {
        const topFix = g.createLinearGradient(0, 0, 0, AH * .4);
        topFix.addColorStop(0, `rgba(9,12,30,${tune.topScrim.toFixed(2)})`);
        topFix.addColorStop(1, 'rgba(9,12,30,0)');
        g.fillStyle = topFix; g.fillRect(0, 0, AW, AH * .4);
      }
      /* 魔法の光粒 */
      for (let i = 0; i < 26; i++) {
        const px = rr(0, AW), py = rr(0, AH);
        const gold = rnd() < .7;
        g.fillStyle = gold ? `rgba(255,220,120,${rr(.3, .75).toFixed(2)})` : `rgba(140,240,255,${rr(.25, .55).toFixed(2)})`;
        g.shadowColor = g.fillStyle; g.shadowBlur = 7;
        g.beginPath(); g.arc(px, py, rr(1, 2.6), 0, Math.PI * 2); g.fill();
        g.shadowBlur = 0;
      }
      return c;
    },

    /* 月光の鏡面(ソーラーパネル清掃) */
    moonPanels: async (spec) => {
      const { AW, AH } = window.DIM;
      const rnd = window.mkRnd(spec.seed);
      const rr = (a, b) => a + (b - a) * rnd();
      const c = document.createElement('canvas'); c.width = AW; c.height = AH;
      const g = c.getContext('2d');
      nightSky(g, AW, AH, '#050a1a', '#0e1830', '#101426');
      window.stars(g, rnd, 90, AW, AH * .5);
      /* 満月(左上) */
      const mx = AW * .2, my = AH * .2, mr = 46;
      const halo = g.createRadialGradient(mx, my, mr * .5, mx, my, mr * 3);
      halo.addColorStop(0, 'rgba(255,240,190,.5)'); halo.addColorStop(1, 'rgba(255,240,190,0)');
      g.fillStyle = halo; g.fillRect(0, 0, AW, AH);
      const moon = g.createRadialGradient(mx - 12, my - 12, 4, mx, my, mr);
      moon.addColorStop(0, '#fff8dd'); moon.addColorStop(.8, '#f2dd9e'); moon.addColorStop(1, '#d8ba6e');
      g.fillStyle = moon; g.beginPath(); g.arc(mx, my, mr, 0, Math.PI * 2); g.fill();
      /* 屋根面(パース付き) */
      g.fillStyle = '#0c0f18';
      g.beginPath(); g.moveTo(0, AH * .62); g.lineTo(AW, AH * .5); g.lineTo(AW, AH); g.lineTo(0, AH); g.closePath(); g.fill();
      /* パネル3×2(平行四辺形+月の反射) */
      const panel = (px, py, pw, ph, skx) => {
        const grd = g.createLinearGradient(px, py, px + pw * .7, py + ph);
        grd.addColorStop(0, '#16233c'); grd.addColorStop(.45, '#1d3050'); grd.addColorStop(.55, '#2c4a74'); grd.addColorStop(1, '#101a2e');
        g.fillStyle = grd;
        g.beginPath();
        g.moveTo(px, py); g.lineTo(px + pw, py - skx); g.lineTo(px + pw + 14, py - skx + ph); g.lineTo(px + 14, py + ph);
        g.closePath(); g.fill();
        g.strokeStyle = 'rgba(150,180,220,.4)'; g.lineWidth = 1.6; g.stroke();
        /* 反射光(月) */
        const rgl = g.createLinearGradient(px, py, px + pw, py + ph);
        rgl.addColorStop(.3, 'rgba(255,240,190,0)');
        rgl.addColorStop(.5, `rgba(255,240,190,${rr(.18, .3).toFixed(2)})`);
        rgl.addColorStop(.7, 'rgba(255,240,190,0)');
        g.fillStyle = rgl;
        g.beginPath();
        g.moveTo(px, py); g.lineTo(px + pw, py - skx); g.lineTo(px + pw + 14, py - skx + ph); g.lineTo(px + 14, py + ph);
        g.closePath(); g.fill();
        /* セル格子 */
        g.strokeStyle = 'rgba(90,120,170,.35)'; g.lineWidth = 1;
        for (let i = 1; i < 4; i++) {
          g.beginPath();
          g.moveTo(px + (pw / 4) * i, py - (skx / 4) * i);
          g.lineTo(px + (pw / 4) * i + 14, py - (skx / 4) * i + ph);
          g.stroke();
        }
      };
      panel(AW * .16, AH * .66, 120, 64, 14);
      panel(AW * .42, AH * .62, 120, 64, 14);
      panel(AW * .68, AH * .58, 120, 64, 14);
      panel(AW * .1, AH * .84, 130, 60, 12);
      panel(AW * .38, AH * .8, 130, 60, 12);
      panel(AW * .66, AH * .76, 130, 60, 12);
      /* 清掃の光跡(スクイジーの一筆) */
      g.strokeStyle = 'rgba(180,240,255,.5)'; g.lineWidth = 7; g.lineCap = 'round';
      g.shadowColor = 'rgba(140,240,255,.8)'; g.shadowBlur = 14;
      g.beginPath(); g.moveTo(AW * .46, AH * .6); g.quadraticCurveTo(AW * .55, AH * .68, AW * .5, AH * .78); g.stroke();
      g.shadowBlur = 0;
      /* 洗い立ての煌めき */
      for (let i = 0; i < 16; i++) {
        const px = rr(AW * .1, AW * .95), py = rr(AH * .55, AH * .95);
        g.fillStyle = `rgba(200,245,255,${rr(.4, .85).toFixed(2)})`;
        g.shadowColor = 'rgba(180,240,255,.9)'; g.shadowBlur = 8;
        g.beginPath(); g.arc(px, py, rr(1, 2.4), 0, Math.PI * 2); g.fill();
        g.shadowBlur = 0;
      }
      return c;
    },

    /* 壁面の斥候(ドローン外壁調査) */
    droneSentinel: async (spec) => {
      const { AW, AH } = window.DIM;
      const rnd = window.mkRnd(spec.seed);
      const rr = (a, b) => a + (b - a) * rnd();
      const c = document.createElement('canvas'); c.width = AW; c.height = AH;
      const g = c.getContext('2d');
      nightSky(g, AW, AH, '#070b1c', '#111a34', '#151228');
      window.stars(g, rnd, 80, AW, AH * .7);
      window.crescent(g, AW * .14, AH * .16, 30, .8, '#0a0f24');
      /* ビル壁面(右側、パース) */
      g.fillStyle = '#101320';
      g.beginPath(); g.moveTo(AW * .58, 0); g.lineTo(AW, AH * .08); g.lineTo(AW, AH); g.lineTo(AW * .58, AH); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(150,170,210,.25)'; g.lineWidth = 1.4;
      g.beginPath(); g.moveTo(AW * .58, 0); g.lineTo(AW * .58, AH); g.stroke();
      /* 窓格子 */
      for (let r = 0; r < 7; r++) {
        for (let col = 0; col < 3; col++) {
          const wx = AW * (.63 + col * .12), wy = AH * (.1 + r * .13) + col * 4;
          const lit = rnd() < .22;
          g.fillStyle = lit ? `rgba(255,214,120,${rr(.35, .6).toFixed(2)})` : 'rgba(60,80,120,.35)';
          g.fillRect(wx, wy, AW * .075, AH * .07);
        }
      }
      /* スキャンビーム(シアンの扇) */
      const dx = AW * .3, dy = AH * .42;
      const beam = g.createLinearGradient(dx, dy, AW * .72, AH * .5);
      beam.addColorStop(0, 'rgba(0,229,255,.5)'); beam.addColorStop(1, 'rgba(0,229,255,.04)');
      g.fillStyle = beam;
      g.beginPath(); g.moveTo(dx + 14, dy); g.lineTo(AW * .78, AH * .3); g.lineTo(AW * .78, AH * .68); g.closePath(); g.fill();
      /* スキャン痕(壁面の格子ハイライト) */
      g.strokeStyle = 'rgba(0,229,255,.55)'; g.lineWidth = 1.4;
      g.strokeRect(AW * .63, AH * .36, AW * .075 * 2.6, AH * .07 * 2.8);
      /* ドローン機体(シルエット+ライト) */
      g.save(); g.translate(dx, dy);
      g.fillStyle = '#05070d';
      g.beginPath(); g.ellipse(0, 0, 26, 10, 0, 0, Math.PI * 2); g.fill();   // 胴
      g.strokeStyle = '#05070d'; g.lineWidth = 4;
      g.beginPath(); g.moveTo(-24, -4); g.lineTo(-44, -16); g.moveTo(24, -4); g.lineTo(44, -16); g.stroke(); // アーム
      g.strokeStyle = 'rgba(190,210,240,.8)'; g.lineWidth = 2.4;
      g.beginPath(); g.moveTo(-58, -18); g.lineTo(-30, -18); g.moveTo(30, -18); g.lineTo(58, -18); g.stroke(); // ローター
      g.fillStyle = 'rgba(255,80,80,.9)'; g.shadowColor = 'rgba(255,80,80,.9)'; g.shadowBlur = 8;
      g.beginPath(); g.arc(-20, 4, 2.4, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(0,229,255,.95)'; g.shadowColor = 'rgba(0,229,255,.95)'; g.shadowBlur = 10;
      g.beginPath(); g.arc(14, 2, 3, 0, Math.PI * 2); g.fill();
      g.shadowBlur = 0; g.restore();
      /* 地上の常夜灯 */
      const ground = g.createLinearGradient(0, AH * .86, 0, AH);
      ground.addColorStop(0, 'rgba(8,10,18,0)'); ground.addColorStop(1, 'rgba(8,10,18,.9)');
      g.fillStyle = ground; g.fillRect(0, AH * .86, AW, AH * .14);
      return c;
    },

    /* 白風の祠(エアコン清掃) */
    whiteBreeze: async (spec) => {
      const { AW, AH } = window.DIM;
      const rnd = window.mkRnd(spec.seed);
      const rr = (a, b) => a + (b - a) * rnd();
      const c = document.createElement('canvas'); c.width = AW; c.height = AH;
      const g = c.getContext('2d');
      /* 夜の室内(壁) */
      const bg = g.createLinearGradient(0, 0, 0, AH);
      bg.addColorStop(0, '#0d0f1e'); bg.addColorStop(.6, '#12142a'); bg.addColorStop(1, '#0a0c18');
      g.fillStyle = bg; g.fillRect(0, 0, AW, AH);
      /* 窓外の月明かり(左) */
      g.fillStyle = '#070b18';
      g.fillRect(AW * .05, AH * .18, AW * .2, AH * .5);
      g.strokeStyle = 'rgba(160,180,220,.3)'; g.lineWidth = 2;
      g.strokeRect(AW * .05, AH * .18, AW * .2, AH * .5);
      g.beginPath(); g.moveTo(AW * .15, AH * .18); g.lineTo(AW * .15, AH * .68); g.stroke();
      window.crescent(g, AW * .11, AH * .3, 16, .6, '#070b18');
      const moonlight = g.createLinearGradient(AW * .07, AH * .3, AW * .3, AH * .9);
      moonlight.addColorStop(0, 'rgba(200,215,255,.14)'); moonlight.addColorStop(1, 'rgba(200,215,255,0)');
      g.fillStyle = moonlight;
      g.beginPath(); g.moveTo(AW * .05, AH * .3); g.lineTo(AW * .25, AH * .3); g.lineTo(AW * .42, AH); g.lineTo(AW * .02, AH); g.closePath(); g.fill();
      /* エアコン本体(右上・祠 — ガンメタルの厨子) */
      const ax = AW * .5, ay = AH * .13, aw = AW * .4, ah = AH * .15;
      const body = g.createLinearGradient(ax, ay, ax, ay + ah);
      body.addColorStop(0, '#3a4356'); body.addColorStop(.55, '#232a3a'); body.addColorStop(1, '#12161f');
      g.fillStyle = body;
      g.beginPath(); g.roundRect(ax, ay, aw, ah, 10); g.fill();
      g.strokeStyle = 'rgba(180,200,230,.4)'; g.lineWidth = 1.4;
      g.beginPath(); g.roundRect(ax, ay, aw, ah, 10); g.stroke();
      /* 月光のハイライト(上面) */
      const lid = g.createLinearGradient(0, ay, 0, ay + 8);
      lid.addColorStop(0, 'rgba(200,220,250,.5)'); lid.addColorStop(1, 'rgba(200,220,250,0)');
      g.fillStyle = lid;
      g.beginPath(); g.roundRect(ax, ay, aw, 10, [10, 10, 0, 0]); g.fill();
      /* 吹き出しルーバー(淡光) */
      g.fillStyle = 'rgba(160,220,255,.55)';
      g.beginPath(); g.roundRect(ax + 12, ay + ah - 12, aw - 24, 5, 3); g.fill();
      g.fillStyle = 'rgba(0,229,255,.9)'; g.shadowColor = 'rgba(0,229,255,.9)'; g.shadowBlur = 8;
      g.beginPath(); g.arc(ax + aw - 16, ay + 12, 2.4, 0, Math.PI * 2); g.fill();
      g.shadowBlur = 0;
      /* 白風の渦(細く長い螺旋の帯を月光へ流す) */
      g.lineCap = 'round';
      const flow = (sx, sy, scale, alpha, width) => {
        g.strokeStyle = `rgba(225,242,255,${alpha})`;
        g.lineWidth = width;
        g.shadowColor = 'rgba(190,235,255,.75)'; g.shadowBlur = 10;
        g.beginPath();
        g.moveTo(sx, sy);
        /* S字→カール(左下の月光だまりへ) */
        g.bezierCurveTo(sx - 60 * scale, sy + 60 * scale, sx + 40 * scale, sy + 120 * scale, sx - 50 * scale, sy + 170 * scale);
        g.bezierCurveTo(sx - 110 * scale, sy + 205 * scale, sx - 150 * scale, sy + 165 * scale, sx - 128 * scale, sy + 138 * scale);
        g.bezierCurveTo(sx - 112 * scale, sy + 118 * scale, sx - 86 * scale, sy + 132 * scale, sx - 96 * scale, sy + 152 * scale);
        g.stroke();
      };
      flow(ax + aw * .28, ay + ah + 4, 1.05, '.5', 3.6);
      flow(ax + aw * .52, ay + ah + 2, 1.25, '.38', 2.6);
      flow(ax + aw * .74, ay + ah + 6, .85, '.3', 2);
      /* 渦を渡る微風の小アーク */
      for (let i = 0; i < 9; i++) {
        const px = rr(AW * .3, AW * .86), py = rr(AH * .38, AH * .8);
        g.strokeStyle = `rgba(210,238,255,${rr(.16, .38).toFixed(2)})`;
        g.lineWidth = rr(1, 2);
        g.beginPath();
        g.arc(px, py, rr(8, 22), rr(0, Math.PI), rr(Math.PI, Math.PI * 1.9));
        g.stroke();
      }
      g.shadowBlur = 0;
      /* 霜の結晶粒 */
      for (let i = 0; i < 22; i++) {
        const px = rr(AW * .3, AW), py = rr(AH * .3, AH * .95);
        g.strokeStyle = `rgba(220,245,255,${rr(.35, .8).toFixed(2)})`;
        g.lineWidth = 1.2;
        const s = rr(2.5, 6);
        g.save(); g.translate(px, py); g.rotate(rr(0, Math.PI));
        g.beginPath();
        g.moveTo(-s, 0); g.lineTo(s, 0); g.moveTo(0, -s); g.lineTo(0, s);
        g.moveTo(-s * .6, -s * .6); g.lineTo(s * .6, s * .6); g.moveTo(-s * .6, s * .6); g.lineTo(s * .6, -s * .6);
        g.stroke(); g.restore();
      }
      /* 床とランプの温かみ(対比) */
      g.fillStyle = '#0a0810';
      g.fillRect(0, AH * .9, AW, AH * .1);
      const lamp = g.createRadialGradient(AW * .86, AH * .88, 0, AW * .86, AH * .88, 70);
      lamp.addColorStop(0, 'rgba(255,190,110,.4)'); lamp.addColorStop(1, 'rgba(255,190,110,0)');
      g.fillStyle = lamp; g.fillRect(0, 0, AW, AH);
      return c;
    },

    /* 雨樋の川守(雨樋清掃) */
    rainGutter: async (spec) => {
      const { AW, AH } = window.DIM;
      const rnd = window.mkRnd(spec.seed);
      const rr = (a, b) => a + (b - a) * rnd();
      const c = document.createElement('canvas'); c.width = AW; c.height = AH;
      const g = c.getContext('2d');
      nightSky(g, AW, AH, '#0a0d1e', '#141a34', '#0e1226');
      window.stars(g, rnd, 46, AW, AH * .4);
      /* 雲間の月 */
      const mx = AW * .74, my = AH * .18, mr = 34;
      const halo = g.createRadialGradient(mx, my, mr * .4, mx, my, mr * 3.2);
      halo.addColorStop(0, 'rgba(255,240,190,.45)'); halo.addColorStop(1, 'rgba(255,240,190,0)');
      g.fillStyle = halo; g.fillRect(0, 0, AW, AH);
      g.fillStyle = '#f4e2a4';
      g.beginPath(); g.arc(mx, my, mr, 0, Math.PI * 2); g.fill();
      for (const [ox, oy, w, h] of [[-.9, .1, 2.6, .5], [.1, .55, 3, .6]]) {
        g.fillStyle = 'rgba(16,20,40,.75)';
        g.beginPath(); g.ellipse(mx + mr*ox, my + mr*oy, mr*w, mr*h, 0, 0, Math.PI * 2); g.fill();
      }
      /* 雨(斜めの細線) */
      g.strokeStyle = 'rgba(170,200,240,.3)'; g.lineWidth = 1.2; g.lineCap = 'round';
      for (let i = 0; i < 70; i++) {
        const px = rr(0, AW), py = rr(0, AH * .8), L = rr(10, 26);
        g.beginPath(); g.moveTo(px, py); g.lineTo(px - L * .25, py + L); g.stroke();
      }
      /* 屋根の斜辺(左上→右下) */
      g.fillStyle = '#0e1018';
      g.beginPath(); g.moveTo(0, AH * .4); g.lineTo(AW, AH * .62); g.lineTo(AW, AH * .74); g.lineTo(0, AH * .54); g.closePath(); g.fill();
      /* 瓦の線 */
      g.strokeStyle = 'rgba(140,160,200,.22)'; g.lineWidth = 1.4;
      for (let i = 1; i < 5; i++) {
        g.beginPath(); g.moveTo(0, AH * (.4 + i * .028)); g.lineTo(AW, AH * (.62 + i * .028)); g.stroke();
      }
      /* 雨樋(月光の川) */
      g.fillStyle = '#141824';
      g.beginPath(); g.moveTo(0, AH * .54); g.lineTo(AW, AH * .74); g.lineTo(AW, AH * .8); g.lineTo(0, AH * .6); g.closePath(); g.fill();
      const river = g.createLinearGradient(0, AH * .55, AW, AH * .78);
      river.addColorStop(0, 'rgba(255,235,160,.14)');
      river.addColorStop(.5, 'rgba(255,235,160,.5)');
      river.addColorStop(.75, 'rgba(180,230,255,.4)');
      river.addColorStop(1, 'rgba(180,230,255,.1)');
      g.fillStyle = river;
      g.beginPath(); g.moveTo(0, AH * .555); g.lineTo(AW, AH * .755); g.lineTo(AW, AH * .785); g.lineTo(0, AH * .585); g.closePath(); g.fill();
      /* 流れの煌めき */
      for (let i = 0; i < 18; i++) {
        const t = rr(0, 1);
        const px = t * AW, py = AH * (.56 + t * .2) + rr(-3, 8);
        g.fillStyle = `rgba(255,245,200,${rr(.4, .9).toFixed(2)})`;
        g.shadowColor = 'rgba(255,240,180,.9)'; g.shadowBlur = 7;
        g.beginPath(); g.arc(px, py, rr(.8, 2.2), 0, Math.PI * 2); g.fill();
        g.shadowBlur = 0;
      }
      /* 落ち葉(川面) */
      for (let i = 0; i < 5; i++) {
        const t = rr(.1, .9);
        const px = t * AW, py = AH * (.565 + t * .2);
        g.save(); g.translate(px, py); g.rotate(rr(0, Math.PI));
        g.fillStyle = `rgba(${170 + rnd()*40|0},${110 + rnd()*30|0},40,.85)`;
        g.beginPath(); g.ellipse(0, 0, rr(5, 9), rr(2.5, 4), 0, 0, Math.PI * 2); g.fill();
        g.restore();
      }
      /* 縦樋へ落ちる光 */
      const fall = g.createLinearGradient(AW * .92, AH * .76, AW * .92, AH);
      fall.addColorStop(0, 'rgba(200,235,255,.45)'); fall.addColorStop(1, 'rgba(200,235,255,.05)');
      g.fillStyle = fall; g.fillRect(AW * .9, AH * .76, 14, AH * .24);
      /* 手前の暗部 */
      const fg = g.createLinearGradient(0, AH * .8, 0, AH);
      fg.addColorStop(0, 'rgba(6,8,14,0)'); fg.addColorStop(1, 'rgba(6,8,14,.92)');
      g.fillStyle = fg; g.fillRect(0, AH * .7, AW, AH * .3);
      return c;
    },
  };

  /* ============ カード合成(フレーム/タイトル/タイプ行/フレーバー) ============ */
  window.composeCard = (art, spec) => {
    const { CW, CH } = window.DIM;
    const rnd = window.mkRnd(spec.seed ^ 0xF00D);
    const c = document.createElement('canvas'); c.width = CW; c.height = CH;
    const g = c.getContext('2d');

    /* 外枠(黒)→ブロンズ縁→カード面 */
    g.fillStyle = '#060504'; g.fillRect(0, 0, CW, CH);
    g.beginPath(); g.roundRect(7, 7, CW - 14, CH - 14, 22);
    g.fillStyle = '#2a1e10'; g.fill();
    const face = g.createLinearGradient(0, 0, CW * .3, CH);
    face.addColorStop(0, '#1c1710'); face.addColorStop(.58, '#141009'); face.addColorStop(1, '#0d0a06');
    g.beginPath(); g.roundRect(13, 13, CW - 26, CH - 26, 17);
    g.fillStyle = face; g.fill();
    g.beginPath(); g.roundRect(17, 17, CW - 34, CH - 34, 14);
    g.strokeStyle = 'rgba(212,160,23,.8)'; g.lineWidth = 2; g.stroke();
    g.beginPath(); g.roundRect(22, 22, CW - 44, CH - 44, 11);
    g.strokeStyle = 'rgba(232,213,176,.18)'; g.lineWidth = 1; g.stroke();

    const catColor = spec.catColor;

    /* タイトルバー */
    const tx = 36, ty = 36, tw = CW - 72, th = 54;
    const bar = g.createLinearGradient(0, ty, 0, ty + th);
    bar.addColorStop(0, '#3a2c12'); bar.addColorStop(.5, '#2a1f0d'); bar.addColorStop(1, '#20160a');
    g.beginPath(); g.roundRect(tx, ty, tw, th, 9);
    g.fillStyle = bar; g.fill();
    g.strokeStyle = 'rgba(212,160,23,.6)'; g.lineWidth = 1.4; g.stroke();
    g.beginPath(); g.roundRect(tx + 3, ty + 3, tw - 6, th - 6, 6);
    g.strokeStyle = 'rgba(255,235,170,.14)'; g.lineWidth = 1; g.stroke();
    /* カード名 */
    g.textBaseline = 'middle';
    let nameSize = 31;
    g.font = `600 ${nameSize}px "Hiragino Mincho ProN", "Noto Sans JP", serif`;
    while (g.measureText(spec.name).width > tw - 88 && nameSize > 20) {
      nameSize -= 1;
      g.font = `600 ${nameSize}px "Hiragino Mincho ProN", "Noto Sans JP", serif`;
    }
    g.shadowColor = 'rgba(0,0,0,.7)'; g.shadowBlur = 4; g.shadowOffsetY = 1;
    g.fillStyle = '#f2e2b8';
    g.fillText(spec.name, tx + 20, ty + th / 2 + 1);
    g.shadowBlur = 0; g.shadowOffsetY = 0;
    /* カテゴリ宝石 */
    const gx = tx + tw - 28, gy = ty + th / 2;
    g.save();
    g.shadowColor = `rgba(${catColor},.95)`; g.shadowBlur = 14;
    const gem = g.createRadialGradient(gx - 4, gy - 4, 1, gx, gy, 12);
    gem.addColorStop(0, '#ffffff'); gem.addColorStop(.35, `rgba(${catColor},1)`); gem.addColorStop(1, `rgba(${catColor},.55)`);
    g.fillStyle = gem;
    g.beginPath(); g.arc(gx, gy, 11, 0, Math.PI * 2); g.fill();
    g.restore();
    g.strokeStyle = 'rgba(232,213,176,.7)'; g.lineWidth = 1.6;
    g.beginPath(); g.arc(gx, gy, 11, 0, Math.PI * 2); g.stroke();

    /* アート窓(金縁二重リング=サイトCSSのプリミティブを描画で再現) */
    const ax = 44, ay = 106, awd = CW - 88, ahd = 424;
    g.fillStyle = '#141009';
    g.fillRect(ax - 4, ay - 4, awd + 8, ahd + 8);
    g.drawImage(art, ax, ay, awd, ahd);
    g.strokeStyle = 'rgba(212,160,23,.9)'; g.lineWidth = 2;
    g.strokeRect(ax - .5, ay - .5, awd + 1, ahd + 1);
    g.strokeStyle = 'rgba(232,213,176,.28)'; g.lineWidth = 1;
    g.strokeRect(ax - 4.5, ay - 4.5, awd + 9, ahd + 9);
    /* アート窓内側の影 */
    const innerV = g.createLinearGradient(0, ay, 0, ay + 26);
    innerV.addColorStop(0, 'rgba(0,0,0,.4)'); innerV.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = innerV; g.fillRect(ax, ay, awd, 26);

    /* タイプ行 */
    const py = 552, ph = 42;
    const bar2 = g.createLinearGradient(0, py, 0, py + ph);
    bar2.addColorStop(0, '#33270f'); bar2.addColorStop(1, '#1d150a');
    g.beginPath(); g.roundRect(tx, py, tw, ph, 8);
    g.fillStyle = bar2; g.fill();
    g.strokeStyle = 'rgba(212,160,23,.55)'; g.lineWidth = 1.3; g.stroke();
    g.font = '500 20px "Noto Sans JP", sans-serif';
    g.fillStyle = '#e3d6c0';
    g.fillText(`記事 — ${spec.catLabel}`, tx + 20, py + ph / 2 + 1);
    /* レアリティ菱形 */
    g.save();
    g.translate(tx + tw - 28, py + ph / 2); g.rotate(Math.PI / 4);
    g.fillStyle = `rgba(${catColor},.95)`;
    g.shadowColor = `rgba(${catColor},.9)`; g.shadowBlur = 10;
    g.fillRect(-7, -7, 14, 14);
    g.restore();
    g.save();
    g.translate(tx + tw - 28, py + ph / 2); g.rotate(Math.PI / 4);
    g.strokeStyle = 'rgba(232,213,176,.6)'; g.lineWidth = 1.4;
    g.strokeRect(-7, -7, 14, 14);
    g.restore();

    /* テキスト欄(羊皮紙+罫線+フレーバー) */
    const bx = 44, by = 610, bw = CW - 88, bh = 196;
    const parch = g.createLinearGradient(0, by, 0, by + bh);
    parch.addColorStop(0, '#191308'); parch.addColorStop(1, '#0e0a05');
    g.beginPath(); g.roundRect(bx, by, bw, bh, 8);
    g.fillStyle = parch; g.fill();
    g.strokeStyle = 'rgba(212,160,23,.4)'; g.lineWidth = 1.2; g.stroke();
    g.save();
    g.beginPath(); g.roundRect(bx, by, bw, bh, 8); g.clip();
    g.strokeStyle = 'rgba(232,213,176,.06)'; g.lineWidth = 1;
    for (let ly = by + 30; ly < by + bh; ly += 26) {
      g.beginPath(); g.moveTo(bx + 12, ly); g.lineTo(bx + bw - 12, ly); g.stroke();
    }
    g.restore();
    /* 金の飾り分割線 */
    g.strokeStyle = 'rgba(212,160,23,.5)'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(CW / 2 - 60, by + 34); g.lineTo(CW / 2 + 60, by + 34); g.stroke();
    g.fillStyle = 'rgba(212,160,23,.8)';
    g.save(); g.translate(CW / 2, by + 34); g.rotate(Math.PI / 4); g.fillRect(-3.4, -3.4, 6.8, 6.8); g.restore();
    /* フレーバーテキスト(斜体・中央寄せ) */
    const lines = spec.flavor.split('\n');
    g.font = 'italic 500 21px "Hiragino Mincho ProN", "Noto Sans JP", serif';
    g.fillStyle = '#cbbb96';
    g.textAlign = 'center';
    const lh = 38;
    const startY = by + 34 + (bh - 34) / 2 - ((lines.length - 1) * lh) / 2;
    lines.forEach((ln, i) => g.fillText(ln, CW / 2, startY + i * lh));
    g.textAlign = 'left';

    /* コレクター行 */
    g.font = '500 13px Orbitron, sans-serif';
    try { g.letterSpacing = '2px'; } catch (e) {}
    g.fillStyle = '#8a7a62';
    g.textAlign = 'center';
    const numStr = String(spec.num).padStart(2, '0');
    g.fillText(`${numStr}/13 · CUCUL FM PRESS · 2026 · ${spec.catEn}`, CW / 2, CH - 34);
    g.textAlign = 'left';
    try { g.letterSpacing = '0px'; } catch (e) {}

    /* 全体に薄い織り目+ごく浅いビネット(アートと世界観を揃える) */
    return window.finish(c, { seed: spec.seed ^ 0xBEEF, texture: .1, vignette: .18, contrast: 1.0, saturate: 1.0 });
  };
});

/* フォント読み込みを確定させる */
await page.evaluate(async () => {
  await Promise.all([
    document.fonts.load('500 20px "Noto Sans JP"'),
    document.fonts.load('700 20px "Noto Sans JP"'),
    document.fonts.load('500 13px Orbitron'),
  ]);
  await document.fonts.ready;
  // JPフォント実在チェック: フォールバックsansと幅が変わるか
  const ctx = document.createElement('canvas').getContext('2d');
  ctx.font = '600 30px "Hiragino Mincho ProN"';
  const a = ctx.measureText('資格の地図').width;
  ctx.font = '600 30px monospace';
  const b = ctx.measureText('資格の地図').width;
  if (!a || a === b) console.warn('Mincho fallback? widths:', a, b);
});

const results = [];
for (const spec of targets) {
  const cat = CATS[spec.cat];
  const dataUrl = await page.evaluate(async (s) => {
    const base = await window.SCENES[s.template](s);
    let art;
    if (s.template === 'photoPlain') {
      art = base;   // 無加工写真: 油彩も仕上げも掛けない
    } else {
      const passes = s.focus
        ? [
            { n: 1200, len: 22, w: [5.5, 10], a: [.5, .75], jit: 12 },
            { n: 2600, len: 13, w: [2.8, 5.5], a: [.45, .72], jit: 9 },
            { n: 4600, len: 6.5, w: [1.4, 2.8], a: [.4, .7], jit: 7 },
            { n: 2600, len: 4, w: [1, 1.9], a: [.35, .6], jit: 5,
              focus: { x: s.focus.x * base.width, y: s.focus.y * base.height, rx: s.focus.rx * base.width, ry: s.focus.ry * base.height } },
          ]
        : undefined;
      const painted = window.oilPaint(base, { seed: s.seed ^ 0xA11, passes });
      art = window.finish(painted, { seed: s.seed ^ 0xF1315, vignette: .42 });
    }
    const card = window.composeCard(art, s);
    return card.toDataURL('image/jpeg', .78);
  }, { ...spec, catLabel: cat.label, catColor: cat.color, catEn: cat.en });
  const file = path.join(OUT, `card-${spec.cat}-${spec.slug}.jpg`);
  fs.writeFileSync(file, Buffer.from(dataUrl.split(',')[1], 'base64'));
  const kb = Math.round(fs.statSync(file).size / 1024);
  results.push({ slug: spec.slug, kb });
  console.log(`card-${spec.cat}-${spec.slug}.jpg ${kb}KB`);
}

const total = results.reduce((s, r) => s + r.kb, 0);
console.log(`total: ${total}KB (${results.length} cards)`);
if (results.some(r => r.kb > 160)) console.warn('WARN: card over 160KB');
if (total > 6500) console.warn('WARN: total over 6.5MB');
await browser.close();
