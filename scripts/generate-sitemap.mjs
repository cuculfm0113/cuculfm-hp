#!/usr/bin/env node
/**
 * generate-sitemap.mjs — sitemap.xml 自動生成（依存パッケージなし / Node 18+）
 * ============================================================================
 * 公開HTMLを走査して sitemap.xml を生成する。
 *
 *   - ベースURLは content/site.config.json の site.url を使う（一元管理）
 *   - 下書き・非公開・ツール類のディレクトリ（docs/ note/ scripts/ 等）は除外
 *   - 404.html と <meta name="robots" content="noindex"> のページは除外
 *   - index.html はディレクトリURL（末尾スラッシュ）、それ以外は .html のまま
 *   - lastmod は git の最終コミット日。未コミットの変更があるファイルと git 管理外は mtime
 *
 * 使い方:
 *   node scripts/generate-sitemap.mjs             # sitemap.xml を書き出す
 *   node scripts/generate-sitemap.mjs --check     # 書き込まず、差分があれば exit 1
 *
 * 注意: sitemap.xml を一度も生成し直していない間は --check が差分あり（exit 1）になる。
 *       既存の sitemap.xml は手書きで、並び順と lastmod が生成結果と異なるため。
 *       URL の集合は一致しているので、生成し直せば以後 --check は通る。
 *   node scripts/generate-sitemap.mjs --dry-run   # 書き込まず、生成結果と差分の要約を表示
 *   node scripts/generate-sitemap.mjs --list      # 対象URL一覧だけ表示
 * ============================================================================
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'sitemap.xml');

/** sitemap に載せないディレクトリ（下書き・非公開・ツール・素材） */
const SKIP_DIRS = new Set([
  '.git', '.netlify', '.claude', 'node_modules', '__pycache__',
  'scripts', 'docs', 'note', 'documents', 'terminals',
  'character-design', 'content', 'images', 'audio', 'videos', 'logo',
]);

/** sitemap に載せないファイル名 */
const SKIP_FILES = new Set(['404.html']);

/**
 * URL ごとの changefreq / priority。上から順に最初に一致したものを使う。
 * 既存の手書き sitemap.xml の値を踏襲している。
 * 唯一の差分は /services/dog/pet-floor/（既存 monthly/0.85 → 生成 weekly/0.9）。
 * 他の下層サービスページと同じ扱いに揃えるため、1件だけの例外規則は設けていない。
 */
const RULES = [
  { re: /^\/$/, changefreq: 'weekly', priority: '1.0' },
  { re: /^\/insights\/$/, changefreq: 'weekly', priority: '0.9' },
  { re: /^\/insights\/[^/]+\/$/, changefreq: 'monthly', priority: '0.8' },
  { re: /^\/fde\/$/, changefreq: 'monthly', priority: '0.9' },
  { re: /^\/about\/$/, changefreq: 'monthly', priority: '0.8' },
  { re: /^\/privacy\/$/, changefreq: 'yearly', priority: '0.3' },
  { re: /^\/services\/.*\/$/, changefreq: 'weekly', priority: '0.9' },
  { re: /\.html$/, changefreq: 'monthly', priority: '0.8' },
  { re: /\/$/, changefreq: 'weekly', priority: '0.9' },
];
const DEFAULT_RULE = { changefreq: 'monthly', priority: '0.7' };
const ruleFor = (url) => RULES.find((r) => r.re.test(url)) || DEFAULT_RULE;

/**
 * ローカルタイムゾーンの YYYY-MM-DD。
 * toISOString() は UTC なので、JST の 00:00〜09:00 に生成すると mtime 由来の日付だけ
 * 1日過去にずれ、git の %cs（ローカル日付）と食い違う。
 */
const localDate = (d) => {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

const escXml = (s) => String(s)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&apos;');

/* -------------------------------------------------------------------------- */

const walkHtml = (dir, out = []) => {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.isDirectory()) {
      if (SKIP_DIRS.has(ent.name)) continue;
      walkHtml(path.join(dir, ent.name), out);
    } else if (ent.isFile() && ent.name.endsWith('.html') && !SKIP_FILES.has(ent.name)) {
      out.push(path.join(dir, ent.name));
    }
  }
  return out;
};

/** noindex 指定のページを除外するための判定 */
const isNoindex = (html) => {
  // name=robots はクォート有無どちらの書き方も拾う
  const m = html.match(/<meta\b[^>]*\bname\s*=\s*["']?robots["']?[^>]*>/gi) || [];
  return m.some((tag) => /noindex/i.test(tag));
};

/**
 * HTML の「最終コミット日」を git log 1回分の出力からまとめて取得する。
 * ファイルごとに git を起動すると本数分のプロセス起動コストがかかるため、
 * 全HTMLを1回のログ走査で引き当てる。git が使えない場合は空 Map を返す。
 */
const gitDateMap = () => {
  const map = new Map();
  try {
    const out = execFileSync(
      'git',
      ['-c', 'core.quotePath=false', 'log', '--format=@@LASTMOD@@%cs', '--name-only', '--no-renames', '--', '*.html'],
      { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 60_000, maxBuffer: 32 * 1024 * 1024 },
    );
    let cur = null;
    for (const line of out.split('\n')) {
      if (line.startsWith('@@LASTMOD@@')) { cur = line.slice('@@LASTMOD@@'.length).trim(); continue; }
      const p = line.trim();
      // git log は新しい順に出るため、最初に現れた日付がそのファイルの最終更新日
      if (p && cur && !map.has(p)) map.set(p, cur);
    }
  } catch { /* git 未導入 / リポジトリ外 / タイムアウト → mtime へフォールバック */ }
  return map;
};

/**
 * 未コミットの変更があるファイル（変更済み・未追跡）の一覧。
 * 「編集 → sitemap生成 → commit → deploy」という手順のため、生成時点では
 * 今まさに更新したページがまだ未コミットである。git の最終コミット日をそのまま使うと
 * 1つ前のコミット日（数か月前のこともある）を lastmod に書いてしまうので、
 * 未コミットのファイルはファイル更新時刻を使う。
 */
const gitDirtySet = () => {
  const set = new Set();
  try {
    const out = execFileSync(
      'git',
      ['-c', 'core.quotePath=false', 'status', '--porcelain', '--untracked-files=all'],
      { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 60_000 },
    );
    for (const line of out.split('\n')) {
      if (!line.trim()) continue;
      const p = line.slice(3).trim();
      if (!p) continue;
      // リネーム表記 "old -> new" は新しい方を採用
      set.add(p.includes(' -> ') ? p.split(' -> ').pop().trim() : p);
    }
  } catch { /* git が使えないときは全件 mtime になるだけ */ }
  return set;
};

/** lastmod (YYYY-MM-DD)。未コミットのファイルと git 管理外は mtime、それ以外は最終コミット日 */
const lastmodOf = (file, dates, dirty) => {
  const rel = path.relative(ROOT, file).split(path.sep).join('/');
  const mtime = localDate(fs.statSync(file).mtime);
  if (dirty.has(rel)) return mtime;
  const d = dates.get(rel);
  return d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : mtime;
};

/** ファイルパス → サイト内URLパス */
const urlPathOf = (file) => {
  const rel = path.relative(ROOT, file).split(path.sep).join('/');
  if (rel === 'index.html') return '/';
  if (rel.endsWith('/index.html')) return `/${rel.slice(0, -'index.html'.length)}`;
  return `/${rel}`;
};

const build = () => {
  let config;
  try {
    config = JSON.parse(fs.readFileSync(path.join(ROOT, 'content/site.config.json'), 'utf8'));
  } catch (e) {
    throw new Error(`content/site.config.json を読めません（ベースURLの取得元）: ${e.message}`);
  }
  if (!config.site?.url) throw new Error('content/site.config.json の site.url が空です');
  const base = String(config.site.url).replace(/\/$/, '');

  const dates = gitDateMap();
  const dirty = gitDirtySet();
  const entries = [];
  const excluded = [];
  for (const file of walkHtml(ROOT)) {
    const html = fs.readFileSync(file, 'utf8');
    const urlPath = urlPathOf(file);
    if (isNoindex(html)) { excluded.push(`${urlPath} (noindex)`); continue; }
    const { changefreq, priority } = ruleFor(urlPath);
    entries.push({ loc: `${base}${urlPath}`, urlPath, lastmod: lastmodOf(file, dates, dirty), changefreq, priority });
  }

  // 決定的な並び: ルートを先頭に、以降はURLパスの辞書順
  entries.sort((a, b) => {
    if (a.urlPath === '/') return -1;
    if (b.urlPath === '/') return 1;
    return a.urlPath < b.urlPath ? -1 : a.urlPath > b.urlPath ? 1 : 0;
  });

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...entries.flatMap((e) => [
      '  <url>',
      `    <loc>${escXml(encodeURI(e.loc))}</loc>`,
      `    <lastmod>${e.lastmod}</lastmod>`,
      `    <changefreq>${e.changefreq}</changefreq>`,
      `    <priority>${e.priority}</priority>`,
      '  </url>',
    ]),
    '</urlset>',
    '',
  ].join('\n');

  return { xml, entries, excluded };
};

/* -------------------------------------------------------------------------- */

const main = () => {
  const flags = new Set(process.argv.slice(2).filter((a) => a.startsWith('--')));
  // 唯一の破壊的動作が「フラグ無し」なので、打ち間違いは書き込みに落とさず中止する
  const KNOWN_FLAGS = new Set(['--check', '--dry-run', '--list']);
  const unknown = [...flags].filter((f) => !KNOWN_FLAGS.has(f));
  if (unknown.length) {
    console.error(`error: 不明なオプション: ${unknown.join(', ')}`);
    console.error(`使えるオプション: ${[...KNOWN_FLAGS].join(' ')}`);
    return 1;
  }
  const isCheck = flags.has('--check');
  const isDry = flags.has('--dry-run') || isCheck || flags.has('--list');

  const { xml, entries, excluded } = build();

  if (flags.has('--list')) {
    for (const e of entries) console.log(`${e.priority}  ${e.changefreq.padEnd(7)}  ${e.lastmod}  ${e.urlPath}`);
    console.log(`\n${entries.length} URL`);
    if (excluded.length) console.log(`除外: ${excluded.join(', ')}`);
    return 0;
  }

  const prev = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
  const locsOf = (s) => new Set([...s.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]));
  const prevLocs = locsOf(prev);
  const nextLocs = locsOf(xml);
  const added = [...nextLocs].filter((u) => !prevLocs.has(u));
  const removed = [...prevLocs].filter((u) => !nextLocs.has(u));

  if (excluded.length) console.log(`除外したページ: ${excluded.join(', ')}`);
  console.log(`URL ${entries.length} 件（既存 ${prevLocs.size} 件）`);
  if (added.length) console.log(`  + 追加 ${added.length}: ${added.join(', ')}`);
  if (removed.length) console.log(`  - 削除 ${removed.length}: ${removed.join(', ')}`);
  if (!added.length && !removed.length) console.log('  URL の増減なし');

  if (xml === prev) {
    console.log('sitemap.xml は最新です。');
    return 0;
  }
  if (isCheck) {
    console.error('--check: sitemap.xml が最新ではありません。`node scripts/generate-sitemap.mjs` を実行してください。');
    return 1;
  }
  if (isDry) {
    console.log('--dry-run: sitemap.xml は書き換えていません。');
    return 0;
  }
  fs.writeFileSync(OUT, xml, 'utf8');
  console.log('sitemap.xml を更新しました。');
  return 0;
};

// process.argv[1] はシンボリックリンク未解決、import.meta.url は解決済みなので realpath で揃える
const isSameFile = (a, b) => {
  try { return fs.realpathSync(a) === fs.realpathSync(b); } catch { return path.resolve(a) === path.resolve(b); }
};
if (process.argv[1] && isSameFile(process.argv[1], fileURLToPath(import.meta.url))) {
  process.exit(main());
}

export { build, urlPathOf, ruleFor, lastmodOf };
