// サイト全体シネマ統一の総合検証 (2026-08-20)
// 前提: python3 -m http.server 8123 / cd scripts && npm i
// 実行: node verify-cinematic.mjs [--prod]  (--prod で https://cucul-fm.com を対象)
import puppeteer from 'puppeteer-core';

const BASE = process.argv.includes('--prod') ? 'https://cucul-fm.com' : 'http://localhost:8123';
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new', args: ['--remote-allow-origins=*'],
});

const results = [];
const check = (name, cond, detail = '') => results.push({ name, ok: !!cond, detail: String(detail).slice(0, 120) });

async function open(url, { mobile = false, wait = 1200, scroll = false } = {}) {
  const page = await browser.newPage();
  const errors = [];
  const requests = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('request', r => requests.push(r.url()));
  await page.setViewport(mobile ? { width: 390, height: 844, isMobile: true, hasTouch: true } : { width: 1440, height: 900 });
  await page.goto(`${BASE}${url}`, { waitUntil: 'networkidle2', timeout: 45000 });
  if (scroll) {
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 700) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 100)); }
      window.scrollTo(0, 0);
    });
  }
  await new Promise(r => setTimeout(r, wait));
  return { page, errors, requests };
}

/* ---- 1. トップ回帰 ---- */
{
  const { page, errors } = await open('/', { wait: 3000 });
  check('top: console errors 0', errors.length === 0, errors[0] || '');
  check('top: #grain あり', await page.$('#grain'));
  check('top: #vignette あり', await page.$('#vignette'));
  check('top: 横overflowなし', await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1));
  await page.close();
}

/* ---- 2. 記事一覧 ---- */
{
  const { page, errors } = await open('/articles/', { scroll: true });
  check('articles: console errors 0', errors.length === 0, errors[0] || '');
  const counts = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('.article-card')];
    const by = c => cards.filter(x => x.dataset.category === c).length;
    return { total: cards.length, inspection: by('inspection'), dog: by('dog'),
      imgs: cards.filter(c => { const i = c.querySelector('img'); return i && i.complete && i.naturalWidth > 0; }).length,
      cardSrc: cards.every(c => c.querySelector('img')?.src.includes('/images/cards/')) };
  });
  check('articles: 13カード (9調査+4犬)', counts.total === 13 && counts.inspection === 9 && counts.dog === 4, JSON.stringify(counts));
  check('articles: 全カード画像ロード済', counts.imgs === 13, counts.imgs);
  check('articles: 全てMTGカード画像', counts.cardSrc);
  // フィルタ動作
  await page.click('.filter-btn[data-filter="dog"]');
  await new Promise(r => setTimeout(r, 500));
  const visDog = await page.evaluate(() => [...document.querySelectorAll('.article-card')].filter(c => c.offsetParent !== null).length);
  check('articles: 犬フィルタ→4件表示', visDog === 4, visDog);
  const hover = await page.evaluate(() => getComputedStyle(document.querySelector('.article-card')).transition.includes('translate'));
  check('articles: hoverはtranslate', hover);
  await page.close();
}

/* ---- 3. ブログ記事 ×2 ---- */
for (const u of ['/blog/inspection/sewer-camera-methods.html', '/blog/dog/trust-relationship.html']) {
  const { page, errors } = await open(u);
  check(`blog ${u.split('/').pop()}: errors 0`, errors.length === 0, errors[0] || '');
  const probe = await page.evaluate(() => ({
    stars: getComputedStyle(document.documentElement, '::before').backgroundImage.includes('radial-gradient'),
    gold: (document.querySelector('.article-featured-image') ? getComputedStyle(document.querySelector('.article-featured-image')).boxShadow.includes('212, 160, 23') : 'no-hero'),
    bg: getComputedStyle(document.body).backgroundColor,
  }));
  check(`blog ${u.split('/').pop()}: 星空疑似要素`, probe.stars);
  check(`blog ${u.split('/').pop()}: 金縁ヒーロー`, probe.gold === 'no-hero' || probe.gold === true, probe.gold);
  await page.close();
}

/* ---- 4. サービス ×5 + 犬写真無加工 ---- */
for (const u of ['/services/ai-tools/', '/services/construction/', '/services/dog/', '/services/inspection/', '/services/condo/garage/']) {
  const { page, errors } = await open(u, { scroll: true });
  check(`svc ${u}: errors 0`, errors.length === 0, errors[0] || '');
  const probe = await page.evaluate(() => ({
    heroStars: getComputedStyle(document.querySelector('.service-hero'), '::before').backgroundImage.includes('radial-gradient'),
    deadBlog: [...document.querySelectorAll('a[href*="blog/"]')].filter(a => /blog\/(ai|ai-tools|video|web|condo|construction|custom|tools|craft|document|media)\//.test(a.href)).length,
    bodyBg: getComputedStyle(document.body).backgroundImage.includes('gradient'),
  }));
  check(`svc ${u}: ヒーロー星空`, probe.heroStars);
  check(`svc ${u}: 隠蔽ブログへのリンク0`, probe.deadBlog === 0, probe.deadBlog);
  if (u === '/services/dog/') {
    const filters = await page.evaluate(() =>
      [...document.querySelectorAll('img')].map(i => getComputedStyle(i).filter).filter(f => f !== 'none').length);
    check('svc dog: imgフィルタ無し(写真無加工)', filters === 0, filters);
    check('svc dog: #puppies アンカーあり', await page.$('#puppies'));
  }
  await page.close();
}

/* ---- 5. 図鑑回帰 ---- */
{
  const { page, errors } = await open('/services/dog/breeds/', { wait: 2500 });
  check('breeds: errors 0', errors.length === 0, errors[0] || '');
  check('breeds: #breedsGrid', await page.$('#breedsGrid'));
  check('breeds: .filter-row', await page.$('.filter-row'));
  const cardCount = await page.evaluate(() => document.querySelectorAll('.breed-card').length);
  check('breeds: カード描画', cardCount > 100, cardCount);
  await page.close();
}
{
  const { page, errors } = await open('/services/dog/breeds/detail.html?id=shiba', { wait: 2000 });
  check('breeds detail: errors 0', errors.length === 0, errors[0] || '');
  const name = await page.evaluate(() => document.body.textContent.includes('柴犬'));
  check('breeds detail: ?id=shiba 描画', name);
  await page.close();
}

/* ---- 6. pet-floor 回帰 ---- */
{
  const { page, errors } = await open('/services/dog/pet-floor/');
  check('pet-floor: errors 0', errors.length === 0, errors[0] || '');
  check('pet-floor: パピヨン肖像あり', await page.evaluate(() => !!document.querySelector('img[src*="phantom-papillon"]')));
  await page.close();
}

/* ---- 7. recruit ---- */
{
  const { page, errors, requests } = await open('/recruit/');
  check('recruit: errors 0', errors.length === 0, errors[0] || '');
  check('recruit: Poppinsリクエスト0', !requests.some(r => r.includes('Poppins')));
  check('recruit: Bebas読込', requests.some(r => r.includes('Bebas')));
  check('recruit: #contact CTAあり', await page.evaluate(() => !!document.querySelector('a[href="../index.html#contact"]')));
  await page.close();
}

/* ---- 8. 404 / event(デスクトップ+モバイル・ハンバーガー) ---- */
for (const u of ['/404.html', '/event/']) {
  const { page, errors } = await open(u);
  check(`${u}: errors 0`, errors.length === 0, errors[0] || '');
  check(`${u}: .navbar あり`, await page.$('.navbar'));
  await page.close();
  const m = await open(u, { mobile: true });
  check(`${u} mobile: errors 0`, m.errors.length === 0, m.errors[0] || '');
  const toggled = await m.page.evaluate(() => {
    document.querySelector('.hamburger').click();
    return document.querySelector('.nav-menu').classList.contains('active');
  });
  check(`${u} mobile: ハンバーガー開閉`, toggled);
  await m.page.close();
}

/* ---- 集計 ---- */
await browser.close();
const fails = results.filter(r => !r.ok);
for (const r of results) console.log(`${r.ok ? '✓' : '✗'} ${r.name}${r.ok ? '' : '  <<< ' + r.detail}`);
console.log(`\n${results.length - fails.length}/${results.length} passed`);
process.exit(fails.length ? 1 : 0);
