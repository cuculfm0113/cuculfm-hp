#!/usr/bin/env node
/**
 * build-content.mjs — コンテンツデータ同期スクリプト（依存パッケージなし / Node 18+）
 * ============================================================================
 * content/*.json のデータから HTML と JSON-LD を生成し、各HTMLファイル内の
 *
 *     <!-- BEGIN:キー -->  …ここが置き換わる…  <!-- END:キー -->
 *
 * というマーカー区間だけを書き換える。マーカー区間の外側は1バイトも触らない。
 *
 * 設計上の約束:
 *   - マーカーが1つも無いファイルは読み込むだけで書き換えない（＝ノービルド維持）。
 *     コミット済みのHTMLがそのまま正であり、本スクリプトの実行は任意。
 *   - 画面表示用HTMLと JSON-LD を同一データから生成するため、両者が食い違わない。
 *   - 値が空文字の設定項目は HTML / JSON-LD に出力しない（推測で埋めない方針）。
 *
 * 使い方:
 *   node scripts/build-content.mjs              # 生成して書き込む
 *   node scripts/build-content.mjs --check      # 書き込まず、差分があれば exit 1（CI/検証向け）
 *   node scripts/build-content.mjs --dry-run    # 書き込まず、変更されるファイルとキーを表示
 *   node scripts/build-content.mjs --list       # 使えるマーカーキー一覧を表示
 *   node scripts/build-content.mjs index.html   # 対象ファイルを限定
 * ============================================================================
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONTENT_DIR = path.join(ROOT, 'content');

/** 走査対象から外すディレクトリ（HTMLがあっても触らない） */
const SKIP_DIRS = new Set([
  '.git', '.netlify', '.claude', 'node_modules', '__pycache__',
  'scripts', 'docs', 'note', 'content',
]);

/* ==========================================================================
   1. ユーティリティ
   ========================================================================== */

/** HTMLテキストのエスケープ（属性値・本文の共通） */
const esc = (s) => String(s)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

/** 見出しなど、<em>/<strong>/<br> のみ許可してエスケープする（データ側の装飾タグ用） */
const rich = (s) => esc(s).replace(/&lt;(\/?)(em|strong|br)\s*\/?&gt;/g, (_m, slash, tag) => `<${slash}${tag}>`);

/**
 * 行配列 → <p class="cls">行1<br>行2</p>（1行で出す）
 * 改行して書くと <br> の直後の改行+インデントが空白1文字として描画されるため、
 * 「狭い画面では br を display:none で無効化して自然に流す」ができなくなる。
 * 生成物なので1行が長くなること自体は許容する。
 */
const para = (cls, arrOrStr) => {
  const arr = Array.isArray(arrOrStr) ? arrOrStr : [arrOrStr];
  const ls = arr.map(esc);
  if (ls.length === 0) return [];
  const open = cls ? `<p class="${cls}">` : '<p>';
  return [`${open}${ls.join('<br>')}</p>`];
};

/** 段落配列（行配列の配列）→ <p>…</p> の連続 */
const paras = (cls, arr) => arr.flatMap((p) => para(cls, p));

/**
 * 和文の折り返し位置を句読点に限定するための分割。
 * 「現場と事業に、技術を定着させる。」→ 「現場と事業に、」「技術を定着させる。」
 * 各片を inline-block にすると、語の途中（例:「定着さ/せる」）で改行されなくなる。
 * 文字は1文字も足し引きしないので、原文との一致は保たれる。
 */
const jpPhrases = (s) => String(s).split(/(?<=[、。])/).filter(Boolean);

/** 行配列を1行の <br> 連結にする（見出し等の短い用途） */
const brJoin = (arr) => (Array.isArray(arr) ? arr : [arr]).map(esc).join('<br>');

/** 値が空（未確定）かどうか */
const isBlank = (v) => v === undefined || v === null || v === '' ||
  (Array.isArray(v) && v.length === 0);

/** オブジェクトから空値のキーを再帰的に取り除く（未確定情報を出力しないため） */
const omitEmpty = (obj) => {
  if (Array.isArray(obj)) {
    const a = obj.map(omitEmpty).filter((v) => !isBlank(v));
    return a;
  }
  if (obj && typeof obj === 'object') {
    const o = {};
    for (const [k, v] of Object.entries(obj)) {
      const cleaned = omitEmpty(v);
      if (!isBlank(cleaned)) o[k] = cleaned;
    }
    return o;
  }
  return obj;
};

/** JSON-LD を <script> に安全に埋め込む（</script> やHTMLコメントで壊れないよう最小エスケープ） */
const jsonLdScript = (data) => {
  const json = JSON.stringify(omitEmpty(data), null, 2)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
  return ['<script type="application/ld+json">', ...json.split('\n'), '</script>'];
};

/** dot 区切りパスで値を引く */
const dig = (obj, dotPath) => dotPath.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);

/** 相対パスを絶対URLへ */
const abs = (c, p) => {
  if (!p) return p;
  if (/^https?:\/\//.test(p)) return p;
  return `${c.config.site.url.replace(/\/$/, '')}${p.startsWith('/') ? p : `/${p}`}`;
};

/** ctx.file を必ず "/" 区切りの相対パスにする（Windows の \ 区切りでもキーが一致するように） */
const relOf = (ctx) => String((ctx && ctx.file) || '').replace(/\\/g, '/');

/**
 * リンク（ナビ・CTA）の href と付随属性。
 * ・トップページでは `/#contact` を `#contact` に落とす。`/#…` のままだと
 *   ページ全体が再読込され、ヒーローの3D・イントロがやり直しになる
 * ・ページ内アンカーには data-scroll を付け、既存の initSmoothScroll に拾わせる
 */
const linkAttrs = (href, ctx) => {
  const onTop = relOf(ctx) === 'index.html';
  const v = onTop && href.startsWith('/#') ? href.slice(1) : href;
  return v.startsWith('#') ? `href="${esc(v)}" data-scroll` : `href="${esc(v)}"`;
};

/* ==========================================================================
   2. データ読み込み
   ========================================================================== */

const readJson = (name) => {
  const p = path.join(CONTENT_DIR, name);
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) {
    throw new Error(`content/${name} を読めません: ${e.message}`);
  }
};

const loadContent = () => ({
  config: readJson('site.config.json'),
  pillars: readJson('pillars.json'),
  challenges: readJson('challenges.json'),
  roadmap: readJson('roadmap.json'),
  usecases: readJson('usecases.json'),
  faqTop: readJson('faq-top.json'),
  faqFde: readJson('faq-fde.json'),
});

/* ==========================================================================
   3. データ検証
   ========================================================================== */

/** 使ってはいけない断定表現・誇大表現（要件「5. 制約・禁止事項」） */
export const BANNED = [
  '必ず効率化', '必ず成功', '必ず改善', '完全自動化', '完全に自動', '100%',
  '１００％', '100％', '確実に削減', 'を保証します', '保証いたします',
];

export const validate = (c) => {
  const errors = [];
  const warnings = [];

  // --- 必須キーの存在 ---
  const need = [
    ['config.site.url', c.config?.site?.url],
    ['config.company.legalName', c.config?.company?.legalName],
    ['config.nav.items', c.config?.nav?.items],
    ['config.contact.subjects', c.config?.contact?.subjects],
    ['config.services', c.config?.services],
    ['config.pages', c.config?.pages && Object.keys(c.config.pages).filter((k) => !k.startsWith('_'))],
    ['pillars.pillars', c.pillars?.pillars],
    ['pillars.crossSection.steps', c.pillars?.crossSection?.steps],
    ['challenges.items', c.challenges?.items],
    ['roadmap.phases', c.roadmap?.phases],
    ['usecases.items', c.usecases?.items],
    ['faqTop.items', c.faqTop?.items],
    ['faqFde.items', c.faqFde?.items],
  ];
  for (const [label, v] of need) if (isBlank(v)) errors.push(`必須データが空です: ${label}`);
  if (errors.length) return { errors, warnings };

  // --- WebPage のページ定義（欠けたまま出すと空の構造化データになる） ---
  // "_" 始まりのキーは注記。ページ定義としては扱わない
  for (const [key, p] of Object.entries(c.config.pages)) {
    if (key.startsWith('_')) continue;
    for (const f of ['path', 'name', 'description']) {
      if (isBlank(p[f])) errors.push(`config.pages["${key}"].${f} が空です`);
    }
    if (p.path && !p.path.startsWith('/')) errors.push(`config.pages["${key}"].path は "/" で始めてください: ${p.path}`);
    if (p.breadcrumb !== undefined) {
      if (!Array.isArray(p.breadcrumb) || p.breadcrumb.length < 2) {
        errors.push(`config.pages["${key}"].breadcrumb は2件以上の配列にしてください`);
      } else {
        p.breadcrumb.forEach((b, i) => {
          if (isBlank(b.name) || isBlank(b.path)) errors.push(`config.pages["${key}"].breadcrumb[${i}] の name/path が空です`);
        });
        const tail = p.breadcrumb[p.breadcrumb.length - 1];
        if (tail && tail.path !== p.path) {
          errors.push(`config.pages["${key}"].breadcrumb の末尾 (${tail.path}) がページ自身の path (${p.path}) と違います`);
        }
      }
    }
  }

  // --- フォーム項目（form-handler.js とマークアップ生成の前提） ---
  const fieldTypes = new Set(['text', 'email', 'tel', 'select', 'textarea', 'checkbox']);
  const seenNames = new Set();
  for (const [i, f] of c.config.contact.fields.entries()) {
    if (isBlank(f.name) || isBlank(f.label)) { errors.push(`contact.fields[${i}] の name/label が空です`); continue; }
    if (!fieldTypes.has(f.type)) errors.push(`contact.fields[${i}] (${f.name}) の type "${f.type}" は扱えません`);
    if (seenNames.has(f.name)) errors.push(`contact.fields の name が重複しています: ${f.name}`);
    seenNames.add(f.name);
    if (f.name === c.config.contact.honeypot) errors.push(`contact.fields の name が honeypot と衝突しています: ${f.name}`);
    if (f.name === 'form-name') errors.push('contact.fields に "form-name" は使えません（Netlify Forms の予約名）');
  }
  for (const k of ['required', 'requiredSelect', 'requiredCheck', 'email', 'submitting', 'success', 'failure']) {
    if (isBlank(c.config.contact.errors && c.config.contact.errors[k])) errors.push(`contact.errors.${k} が空です`);
  }

  // --- GTM ID は生成タグへそのまま埋め込むので、書式を確かめてから通す ---
  const gtm = c.config.analytics.gtmId;
  if (!isBlank(gtm) && !/^GTM-[A-Z0-9]+$/.test(gtm)) {
    errors.push(`analytics.gtmId の書式が不正です（GTM-XXXXXXX 形式）: ${gtm}`);
  }

  // --- 活用テーマは「実績ではない」注記が必須（要件: 実績と誤認させない） ---
  if (isBlank(c.usecases.note)) errors.push('usecases.json の note（活用イメージである旨の注記）が空です');

  // --- FAQ の共通設問がトップと /fde/ でずれていないか ---
  const topById = new Map(c.faqTop.items.map((it) => [it.id, it]));
  for (const it of c.faqFde.items) {
    const top = topById.get(it.id);
    if (!top) continue;
    if (top.q !== it.q || top.a !== it.a) {
      warnings.push(`FAQ "${it.id}" が faq-top.json と faq-fde.json で一致していません（共通設問は同じ文言に揃えてください）`);
    }
  }

  // --- 本文として段落出力される固定コピーが空でないか ---
  // 空配列のまま出力すると段落が消える（要件原文の本文が画面から抜ける）ので、ここで止める
  const bodyFields = [
    ['messaging.heroLead', c.config.messaging?.heroLead],
    ['messaging.fdeSub', c.config.messaging?.fdeSub],
    ['messaging.philosophy.body', c.config.messaging?.philosophy?.body],
    ['contact.body', c.config.contact?.body],
    ['challenges.closing', c.challenges.closing],
    ['roadmap.intro', c.roadmap.intro],
    ['crossSection.body', c.pillars.crossSection.body],
  ];
  c.pillars.pillars.forEach((p, i) => {
    bodyFields.push([`pillars[${i}].body`, p.body], [`pillars[${i}].fdeNote`, p.fdeNote]);
  });
  c.pillars.crossSection.steps.forEach((st, i) => bodyFields.push([`crossSection.steps[${i}].body`, st.body]));
  for (const [label, v] of bodyFields) {
    if (isBlank(v)) errors.push(`本文の固定コピーが空です: ${label}`);
    else if (Array.isArray(v) && v.some((x) => isBlank(x))) errors.push(`本文の固定コピーに空の行/段落があります: ${label}`);
  }

  // --- 禁止表現の混入チェック ---
  const walk = (node, trail) => {
    if (typeof node === 'string') {
      for (const w of BANNED) if (node.includes(w)) errors.push(`禁止表現「${w}」を検出: ${trail}`);
    } else if (Array.isArray(node)) {
      node.forEach((v, i) => walk(v, `${trail}[${i}]`));
    } else if (node && typeof node === 'object') {
      for (const [k, v] of Object.entries(node)) walk(v, `${trail}.${k}`);
    }
  };
  for (const [name, data] of Object.entries(c)) walk(data, name);

  // --- 未確定情報のお知らせ（エラーではない） ---
  const pending = [];
  if (isBlank(c.config.company.corporateNumber)) pending.push('company.corporateNumber');
  if (isBlank(c.config.company.foundingDate)) pending.push('company.foundingDate');
  if (isBlank(c.config.analytics.gtmId)) pending.push('analytics.gtmId');
  if (pending.length) warnings.push(`未設定のため出力を省略: ${pending.join(', ')}`);

  return { errors, warnings };
};

/* ==========================================================================
   4. レンダラー（マーカーキー → 生成HTML行）
   ========================================================================== */

/**
 * セクション見出し。既存トップの .biz-head / .news-head / .abt-head と同じ構造
 * （eyebrow → 英語 h2 → 日本語 lead）を踏襲する。
 */
const sectionHead = (cls, section, headingJa, titleId) => [
  `<div class="${cls}">`,
  '  <div>',
  `    <p class="eyebrow">${esc(section.eyebrow)}</p>`,
  `    <h2 id="${esc(titleId)}">${rich(section.title)}</h2>`,
  '  </div>',
  `  <p class="lead">${esc(headingJa)}</p>`,
  '</div>',
];

/* ---- グローバルヘッダーのナビゲーション ---- */
const renderNav = (c, ctx) => {
  const { items, cta } = c.config.nav;
  const attrs = (h) => linkAttrs(h, ctx);
  return [
    '<nav class="gnav-nav" aria-label="グローバルナビゲーション">',
    '  <ul class="gnav-list">',
    ...items.map((it) => `    <li><a class="gnav-link" ${attrs(it.href)}>${esc(it.label)}</a></li>`),
    '  </ul>',
    '</nav>',
    `<a class="gnav-cta" ${attrs(cta.href)} data-ga-event="click_consultation_cta">${esc(cta.label)}</a>`,
  ];
};

/* ---- ヒーロー追加コピー（既存ビジュアル・既存メッセージの下に置く想定） ---- */
const renderHeroCopy = (c, ctx) => {
  const m = c.config.messaging;
  // 見出しは h2。h1 はヒーローの .giant-type（CUCUL FM.LLC）が持つため増やさない。
  const attrs = (h) => linkAttrs(h, ctx);
  return [
    `<h2 class="stm-title" id="stm-title">${jpPhrases(m.heroTagline).map((t) => `<span>${esc(t)}</span>`).join('')}</h2>`,
    ...para('stm-lead', m.heroLead),
    '<div class="stm-cta">',
    // 計測イベント名はデータ側（site.config.json の heroCtas[].gaEvent）で持つ。
    // href の文字列一致で判定すると、リンク先を変えた瞬間に計測が無言で外れるため。
    ...m.heroCtas.map((b, i) => `  <a class="btn-stm${i === 0 ? '' : ' btn-stm--ghost'}" ${attrs(b.href)}${b.gaEvent ? ` data-ga-event="${esc(b.gaEvent)}"` : ''}>${esc(b.label)}</a>`),
    '</div>',
  ];
};

/* ---- /fde/ のメインコピー（H1）とサブコピー ---- */
const renderFdeLead = (c) => {
  const m = c.config.messaging;
  return [
    `<h1 class="fde-main">${esc(m.fdeMain)}</h1>`,
    '<div class="fde-sub">',
    ...paras('', m.fdeSub).map((l) => `  ${l}`),
    '</div>',
  ];
};

/* ---- 思想ブロック「AIはAIらしく、人は人らしく。」 ---- */
const renderPhilosophy = (c) => {
  const p = c.config.messaging.philosophy;
  return [
    '<blockquote class="philosophy">',
    `  <p class="philosophy-title">${esc(p.title)}</p>`,
    ...paras('philosophy-body', p.body).map((l) => `  ${l}`),
    '</blockquote>',
  ];
};

/* ---- 3本柱 ---- */
const renderPillars = (c) => {
  const label = c.pillars.fdeNoteLabel;
  return [
    '<div class="pillar-grid">',
    ...c.pillars.pillars.flatMap((p) => [
      `  <article class="pillar-card" id="${esc(p.id)}">`,
      `    <p class="eyebrow">${esc(p.en)}</p>`,
      `    <h3 class="pillar-ja">${esc(p.ja)}</h3>`,
      ...para('pillar-body', p.body).map((l) => `    ${l}`),
      '    <div class="pillar-note">',
      `      <p class="pillar-note-label">${esc(label)}</p>`,
      ...para('pillar-note-body', p.fdeNote).map((l) => `      ${l}`),
      '    </div>',
      '    <ul class="pillar-links">',
      ...p.links.map((l) => `      <li><a href="${esc(l.href)}">${esc(l.label)}</a></li>`),
      '    </ul>',
      '  </article>',
    ]),
    '</div>',
  ];
};

/* ---- FDE横断セクション本文 ---- */
const renderFdeCross = (c) => {
  const x = c.pillars.crossSection;
  return [
    `<p class="eyebrow">${esc(x.sectionName)}</p>`,
    // 見出しは句読点で分割した inline-block にする（.stm-title と同じ。
    // 「仕組み/へ。」のような語中改行を防ぐ。文字は1文字も足し引きしない）
    `<h2 class="fde-heading" id="fde-heading">${jpPhrases(x.heading).map((t) => `<span>${esc(t)}</span>`).join('')}</h2>`,
    '<div class="fde-body">',
    ...paras('', x.body).map((l) => `  ${l}`),
    '</div>',
  ];
};

/* ---- 01 Understand / 02 Build / 03 Embed ---- */
const renderFdeSteps = (c, ctx) => {
  const x = c.pillars.crossSection;
  return [
    '<ol class="fde-steps">',
    ...x.steps.flatMap((s) => [
      '  <li class="step-card">',
      `    <span class="step-no" aria-hidden="true">${esc(s.no)}</span>`,
      `    <p class="step-en">${esc(s.en)}</p>`,
      `    <h3 class="step-ja">${esc(s.ja)}</h3>`,
      ...para('step-body', s.body).map((l) => `    ${l}`),
      '  </li>',
    ]),
    '</ol>',
    `<a class="btn-fde" ${linkAttrs(x.cta.href, ctx)} data-ga-event="click_fde_service">${esc(x.cta.label)}</a>`,
  ];
};

/* ---- 課題提起 ---- */
const renderChallenges = (c) => {
  const d = c.challenges;
  return [
    ...sectionHead('chal-head', d.section, d.heading, 'chal-title'),
    '<ul class="chal-grid">',
    ...d.items.map((t, i) => [
      '  <li class="chal-card">',
      `    <span class="chal-no" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span>`,
      `    <p class="chal-text">${esc(t)}</p>`,
      '  </li>',
    ]).flat(),
    '</ul>',
    ...para('chal-closing', d.closing),
  ];
};

/* ---- 12か月ロードマップ（本文は常にHTML内に存在。details は既定で open） ---- */
const renderRoadmap = (c, ctx) => {
  const d = c.roadmap;
  return [
    ...sectionHead('rm-head-sec', d.section, d.heading, 'roadmap-title'),
    ...para('rm-intro', d.intro),
    '<ol class="rm-list">',
    ...d.phases.flatMap((p) => [
      `  <li class="rm-item" id="${esc(p.id)}">`,
      '    <details class="rm-details" open>',
      '      <summary class="rm-head">',
      `        <span class="rm-no" aria-hidden="true">${esc(p.no)}</span>`,
      `        <span class="rm-range">${esc(p.range)}</span>`,
      `        <span class="rm-title">${esc(p.title)}</span>`,
      '      </summary>',
      '      <div class="rm-detail">',
      '        <ul class="rm-tasks">',
      ...p.items.map((t) => `          <li>${esc(t)}</li>`),
      '        </ul>',
      '        <div class="rm-deliv">',
      `          <p class="rm-deliv-label">${esc(d.deliverablesLabel)}</p>`,
      '          <ul class="rm-chips">',
      ...p.deliverables.map((t) => `            <li class="rm-chip">${esc(t)}</li>`),
      '          </ul>',
      '        </div>',
      '      </div>',
      '    </details>',
      '  </li>',
    ]),
    '</ol>',
    `<a class="btn-roadmap" ${linkAttrs(d.cta.href, ctx)} data-ga-event="click_roadmap">${esc(d.cta.label)}</a>`,
  ];
};

/* ---- 活用テーマ ---- */
const renderUsecases = (c) => {
  const d = c.usecases;
  return [
    ...sectionHead('uc-head', d.section, d.heading, 'uc-title'),
    `<p class="uc-note">${esc(d.note)}</p>`,
    '<ul class="uc-list">',
    ...d.items.map((t) => `  <li class="uc-item">${esc(t)}</li>`),
    '</ul>',
  ];
};

/* ---- FAQ（details アコーディオン。JS無効でも開閉・閲覧できる） ---- */
const renderFaq = (data, titleId) => [
  ...sectionHead('faq-head', data.section, data.heading, titleId),
  '<div class="faq-list">',
  ...data.items.flatMap((it) => [
    `  <details class="faq-item" id="faq-${esc(it.id)}">`,
    `    <summary class="faq-q">${esc(it.q)}</summary>`,
    `    <div class="faq-a"><p>${esc(it.a)}</p></div>`,
    '  </details>',
  ]),
  '</div>',
];

/* ---- サービス一覧（Service 構造化データと表示を一致させるための可視リスト） ---- */
const renderServices = (c) => [
  '<ul class="svc-list">',
  ...c.config.services.flatMap((s) => [
    `  <li class="svc-item" id="svc-${esc(s.id)}">`,
    `    <a class="svc-name" href="${esc(s.url)}">${esc(s.name)}</a>`,
    `    <p class="svc-desc">${esc(s.description)}</p>`,
    '  </li>',
  ]),
  '</ul>',
];

/* ---- 会社概要テーブル（/about/ 用。空欄の項目は行ごと出力しない） ---- */
const renderCompanySpec = (c) => {
  const co = c.config.company;
  const a = co.address;
  const addrLines = [
    a.postalCode ? `〒${a.postalCode}` : '',
    `${a.addressRegion}${a.addressLocality}${a.streetAddress}`,
    a.building,
  ].filter(Boolean);
  // 「未確定（空文字）」だけでなく「キーごと存在しない」場合も行を出さない。
  // 生の値で空判定してから整形するので、undefined が文字列 "undefined" として出ることはない。
  const rows = [
    ['会社名', co.legalName, esc],
    ['英文表記', co.alternateName, esc],
    ['代表者', co.representative, esc],
    ['設立年月日', co.foundingDate, esc],
    ['法人番号', co.corporateNumber, esc],
    ['所在地', addrLines, (v) => v.map(esc).join('<br>')],
    ['電話番号', co.tel, (v) => `<a href="${esc(co.telHref)}" data-ga-event="click_phone">${esc(v)}</a>`],
    ['メールアドレス', co.email, (v) => `<a href="mailto:${esc(v)}" data-ga-event="click_email">${esc(v)}</a>`],
    ['営業時間', co.businessHours, esc],
    ['対応地域', co.serviceArea, esc],
    ['代表者経歴', co.representativeBio, esc],
  ].filter(([, v]) => !isBlank(v));
  return [
    '<dl class="spec-table">',
    ...rows.map(([k, v, fmt]) => `  <div class="spec-row"><dt>${esc(k)}</dt><dd>${fmt(v)}</dd></div>`),
    '</dl>',
  ];
};

/* ---- 問い合わせフォームの「ご相談の種類」選択肢 ---- */
const subjectOptions = (c) => {
  const ct = c.config.contact;
  return [
    `<option value="">${esc(ct.subjectPlaceholder)}</option>`,
    ...ct.subjects.map((s) => `<option value="${esc(s)}">${esc(s)}</option>`),
  ];
};
const renderContactSubjects = (c) => subjectOptions(c);

/**
 * ラベルの一部だけをリンクにする（「個人情報保護方針への同意」の前半だけ /privacy/ へ）。
 * ラベル文字列そのものは1文字も変えないので、要件のフォーム項目名と一致したままになる。
 */
const labelWithLink = (label, link) => {
  if (!link || !link.text) return esc(label);
  const i = label.indexOf(link.text);
  if (i < 0) return esc(label);
  return esc(label.slice(0, i))
    + `<a href="${esc(link.href)}">${esc(link.text)}</a>`
    + esc(label.slice(i + link.text.length));
};

/* ---- 問い合わせフォームの入力項目（site.config.json の contact.fields から生成） ----
   ・required / type="email" は HTML 側に残す = JS 無効でもブラウザ標準の検証が働く。
     JS が動くときは form-handler.js が form.noValidate を立てて自前のインライン表示に切り替える
   ・各項目にエラー表示用の <p class="field-error"> を必ず1つ持たせ、aria-describedby で結ぶ */
const renderContactFields = (c) => {
  const ct = c.config.contact;
  return ct.fields.flatMap((f) => {
    const errId = `err-${f.name}`;
    const attrs = [
      `id="${esc(f.name)}"`,
      `name="${esc(f.name)}"`,
      f.autocomplete ? `autocomplete="${esc(f.autocomplete)}"` : '',
      f.required ? 'required aria-required="true"' : '',
      `aria-describedby="${esc(errId)}"`,
    ].filter(Boolean).join(' ');
    const ph = f.placeholder ? ` placeholder="${esc(f.placeholder)}"` : '';
    const star = f.required ? ' <span class="required">*</span>' : '';
    const err = `  <p class="field-error" id="${esc(errId)}" role="alert" hidden></p>`;

    if (f.type === 'checkbox') {
      return [
        '<div class="form-group form-group--check">',
        '  <label class="check-label">',
        // value にラベルをそのまま入れる = 通知メールで何に同意したかが読める
        `    <input type="checkbox" ${attrs} value="${esc(f.label)}">`,
        `    <span>${labelWithLink(f.label, f.link)}${star}</span>`,
        '  </label>',
        err,
        '</div>',
      ];
    }
    const control = f.type === 'textarea'
      ? [`  <textarea ${attrs} rows="5"${ph}></textarea>`]
      : f.type === 'select'
        ? [`  <select ${attrs}>`, ...subjectOptions(c).map((o) => `    ${o}`), '  </select>']
        : [`  <input type="${esc(f.type)}" ${attrs}${ph}>`];
    return [
      '<div class="form-group">',
      `  <label for="${esc(f.name)}">${esc(f.label)}${star}</label>`,
      ...control,
      err,
      '</div>',
    ];
  });
};

/* ---- form-handler.js が読む設定（フォーム名・honeypot 名・画面に出す文言） ----
   .js は build-content の対象外なので、設定は HTML 側に JSON で置いて渡す。
   これで文言も site.config.json 側の一元管理に乗る。 */
const renderContactConfig = (c) => {
  const ct = c.config.contact;
  const json = JSON.stringify({
    formName: ct.formName,
    honeypot: ct.honeypot,
    messages: ct.errors,
  }, null, 2).replace(/</g, '\\u003c');   // </script> で脱出されないように
  return [
    '<script type="application/json" id="contact-config">',
    ...json.split('\n'),
    '</script>',
  ];
};

/* ---- 計測タグ（全ページ共通。</head> の直前に置く） ----
   GTM ID が空のうちは GTM を読み込まない。js/analytics.js は常に読む（dataLayer に
   積むだけなので、後から GTM を入れてもイベント設計を変えずに拾える）。 */
const renderAnalytics = (c) => {
  const id = c.config.analytics.gtmId;
  const lines = ['<script>window.dataLayer=window.dataLayer||[];</script>'];
  if (id) {
    lines.push(
      '<!-- Google Tag Manager -->',
      '<script>(function(w,d,s,l,i){w[l].push({\'gtm.start\':new Date().getTime(),event:\'gtm.js\'});'
      + 'var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!=\'dataLayer\'?\'&l=\'+l:\'\';'
      + 'j.async=true;j.src=\'https://www.googletagmanager.com/gtm.js?id=\'+i+dl;'
      + `f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${id}');</script>`,
    );
  }
  lines.push('<script src="/js/analytics.js" defer></script>');
  return lines;
};

/* ---- パンくず（表示用。BreadcrumbList と同じ site.config.json の pages から生成） ---- */
const breadcrumbOf = (c, ctx) => {
  const key = relOf(ctx);
  const p = (c.config.pages || {})[key];
  if (!p) throw new Error(`site.config.json の pages に "${key}" の定義がありません`);
  if (!Array.isArray(p.breadcrumb) || p.breadcrumb.length === 0) {
    throw new Error(`site.config.json の pages["${key}"].breadcrumb がありません`);
  }
  return p.breadcrumb;
};
const renderBreadcrumb = (c, ctx) => {
  const items = breadcrumbOf(c, ctx);
  const last = items.length - 1;
  return [
    '<nav class="breadcrumb" aria-label="パンくずリスト">',
    '  <ol>',
    ...items.map((b, i) => (i === last
      ? `    <li><span aria-current="page">${esc(b.name)}</span></li>`
      : `    <li><a href="${esc(b.path)}">${esc(b.name)}</a></li>`)),
    '  </ol>',
    '</nav>',
  ];
};
const renderJsonLdBreadcrumb = (c, ctx) => jsonLdScript({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: breadcrumbOf(c, ctx).map((b, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    name: b.name,
    item: abs(c, b.path),
  })),
});

/* ---- 問い合わせセクションの見出し・本文 ---- */
const renderContactCopy = (c) => {
  const ct = c.config.contact;
  return [
    // 句読点で分割した inline-block（語中改行を防ぐ。文字は1文字も足し引きしない）
    `<h2 class="ct-heading">${jpPhrases(ct.heading).map((t) => `<span>${esc(t)}</span>`).join('')}</h2>`,
    ...paras('ct-body', ct.body),
  ];
};

/* ---- JSON-LD: WebSite + Organization ---- */
const renderJsonLdOrganization = (c) => {
  const co = c.config.company;
  const site = c.config.site;
  const a = co.address;
  const orgId = `${site.url}/#organization`;
  return jsonLdScript({
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': `${site.url}/#website`,
        url: `${site.url}/`,
        name: site.name,
        description: site.description,
        publisher: { '@id': orgId },
        inLanguage: 'ja-JP',
      },
      {
        '@type': 'Organization',
        '@id': orgId,
        name: co.legalName,
        alternateName: [co.alternateName, co.brandName, co.brandNameJa].filter(Boolean),
        url: `${site.url}/`,
        logo: abs(c, co.logo),
        description: c.config.entity.businessDefinition.join(''),
        foundingDate: co.foundingDate,
        taxID: co.corporateNumber,
        address: {
          '@type': 'PostalAddress',
          streetAddress: [a.streetAddress, a.building].filter(Boolean).join(' '),
          addressLocality: a.addressLocality,
          addressRegion: a.addressRegion,
          postalCode: a.postalCode,
          addressCountry: a.addressCountry,
        },
        telephone: co.telInternational,
        email: co.email,
        contactPoint: [{
          '@type': 'ContactPoint',
          contactType: 'customer support',
          telephone: co.telInternational,
          email: co.email,
          availableLanguage: ['ja'],
        }],
        sameAs: co.sameAs,
      },
    ],
  });
};

/* ---- JSON-LD: Service 8件 ---- */
const renderJsonLdServices = (c) => {
  const site = c.config.site;
  return jsonLdScript({
    '@context': 'https://schema.org',
    '@graph': c.config.services.map((s) => ({
      '@type': 'Service',
      '@id': `${site.url}/#service-${s.id}`,
      name: s.name,
      description: s.description,
      url: abs(c, s.url),
      provider: { '@id': `${site.url}/#organization` },
    })),
  });
};

/* ---- JSON-LD: WebPage ----
   ページごとの name / description は site.config.json の pages に置き、キーは
   HTML の相対パス（"index.html" など）。マーカーは全ページ共通の1キーで済み、
   どのページを描いているかは injectFile が渡す ctx.file から決まる。
   pages に無いファイルへ置かれたらエラーにする（空の WebPage を黙って出さない）。 */
const renderJsonLdWebPage = (c, ctx) => {
  const key = relOf(ctx);
  const p = (c.config.pages || {})[key];
  if (!p) {
    throw new Error(`site.config.json の pages に "${key}" の定義がありません`);
  }
  const site = c.config.site;
  const url = abs(c, p.path);
  return jsonLdScript({
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': `${url}#webpage`,
    url,
    name: p.name,
    description: p.description,
    isPartOf: { '@id': `${site.url}/#website` },
    about: { '@id': `${site.url}/#organization` },
    inLanguage: 'ja-JP',
  });
};

/* ---- JSON-LD: FAQPage（表示中のFAQと同一データから生成） ---- */
const renderJsonLdFaq = (data) => jsonLdScript({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: data.items.map((it) => ({
    '@type': 'Question',
    name: it.q,
    acceptedAnswer: { '@type': 'Answer', text: it.a },
  })),
});

/** マーカーキー → { render, inline?, desc } */
const RENDERERS = {
  'nav': { desc: 'グローバルヘッダーのナビ + 相談するCTA', render: renderNav },
  'hero-copy': { desc: 'ヒーロー追加コピー（技術定着メッセージ + CTA2つ）', render: renderHeroCopy },
  'fde-lead': { desc: '/fde/ のメインコピー（H1）とサブコピー', render: renderFdeLead },
  'philosophy': { desc: '思想ブロック「AIはAIらしく、人は人らしく。」', render: renderPhilosophy },
  'pillars': { desc: '3本柱カード（#pillar-construction 等のアンカー付き）', render: renderPillars },
  'fde-cross': { desc: 'FDE横断セクションの見出しと本文', render: renderFdeCross },
  'fde-steps': { desc: '01 Understand / 02 Build / 03 Embed + CTA', render: renderFdeSteps },
  'challenges': { desc: '課題提起カード8枚 + 締め文', render: renderChallenges },
  'roadmap': { desc: '12か月ロードマップ4フェーズ + CTA', render: renderRoadmap },
  'usecases': { desc: '活用テーマ10項目（活用イメージ注記つき）', render: renderUsecases },
  'faq-top': { desc: 'トップページFAQ（7問）', render: (c) => renderFaq(c.faqTop, 'faq-title') },
  'faq-fde': { desc: '/fde/ ページFAQ', render: (c) => renderFaq(c.faqFde, 'faq-title') },
  'services': { desc: 'サービス8件の可視リスト', render: renderServices },
  'company-spec': { desc: '会社概要テーブル（空欄項目は出力しない）', render: renderCompanySpec },
  'contact-copy': { desc: '問い合わせセクションの見出し・本文', render: renderContactCopy },
  'contact-subjects': { desc: 'ご相談の種類 <option> 群', render: renderContactSubjects },
  'contact-fields': { desc: '問い合わせフォームの入力項目9つ（contact.fields から生成）', render: renderContactFields },
  'contact-config': { desc: 'form-handler.js が読む設定JSON（フォーム名・honeypot・文言）', render: renderContactConfig },
  'analytics': { desc: '計測タグ（dataLayer + GTM + /js/analytics.js）。</head> 直前に置く', render: renderAnalytics },
  'breadcrumb': { desc: 'パンくず（pages[相対パス].breadcrumb から生成）', render: renderBreadcrumb },
  'jsonld-organization': { desc: 'JSON-LD: WebSite + Organization（index.html の既存ブロックを囲んで置き換える）', render: renderJsonLdOrganization },
  'jsonld-webpage': { desc: 'JSON-LD: WebPage（site.config.json の pages[相対パス] から生成）', render: renderJsonLdWebPage },
  'jsonld-services': { desc: 'JSON-LD: Service 8件', render: renderJsonLdServices },
  'jsonld-faq-top': { desc: 'JSON-LD: FAQPage（トップ）', render: (c) => renderJsonLdFaq(c.faqTop) },
  'jsonld-faq-fde': { desc: 'JSON-LD: FAQPage（/fde/）', render: (c) => renderJsonLdFaq(c.faqFde) },
  'jsonld-breadcrumb': { desc: 'JSON-LD: BreadcrumbList（表示用 breadcrumb と同一データ）', render: renderJsonLdBreadcrumb },
};

/**
 * キーからレンダラーを解決する。
 * `cfg:<dot.path>` は site.config.json の値をインライン展開する動的キー。
 */
export const resolveRenderer = (key) => {
  if (key.startsWith('cfg:')) {
    const dotPath = key.slice(4);
    return {
      inline: true,
      render: (c) => {
        const v = dig(c.config, dotPath);
        // 存在しないパス = 書き間違い。空欄（未確定）とは区別してエラーにする
        if (v === undefined) {
          throw new Error(`cfg:${dotPath} は site.config.json に存在しないパスです`);
        }
        if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
          throw new Error(`cfg:${dotPath} はオブジェクトです。文字列または文字列配列のパスを指定してください`);
        }
        if (Array.isArray(v) && v.some((x) => x !== null && typeof x === 'object')) {
          throw new Error(`cfg:${dotPath} の配列に文字列以外が含まれています`);
        }
        if (isBlank(v)) return ['']; // 未確定（空文字・空配列）→ 何も出力しない
        return [Array.isArray(v) ? brJoin(v) : esc(v)];
      },
    };
  }
  return RENDERERS[key] || null;
};

/* ==========================================================================
   5. マーカー置換
   ========================================================================== */

const MARKER_RE = /([ \t]*)<!--\s*BEGIN:([A-Za-z0-9_.:@-]+)\s*-->([\s\S]*?)<!--\s*END:\2\s*-->/g;
const BEGIN_SCAN = /<!--\s*BEGIN:([A-Za-z0-9_.:@-]+)\s*-->/g;
const END_SCAN = /<!--\s*END:([A-Za-z0-9_.:@-]+)\s*-->/g;

/**
 * ファイルにマーカーがあるかの判定。
 * MARKER_RE と同じ書式（<!--  BEGIN:key  --> のような空白違いも許す）で判定しないと、
 * 「置換対象なのに走査対象から外れて無言でスキップされる」ズレが生じるため、必ず同じ正規表現を使う。
 */
export const hasMarker = (src) => /<!--\s*BEGIN:/.test(src);

/** マーカーキーに使える文字 */
const KEY_RE = /^[A-Za-z0-9_.:@-]+$/;
/** キーの妥当性を問わず BEGIN/END らしき記述を拾う（書き間違いを黙って見逃さないため） */
const LOOSE_SCAN = /<!--\s*(BEGIN|END):([^>]*?)\s*-->/g;

/**
 * JSON-LD マーカーと、その内容を画面に表示するマーカーの対応。
 * 「画面に出していない内容を構造化データにだけ書く」ことを防ぐ（要件: 非表示FAQを作らない）。
 */
const LD_PAIRS = {
  'jsonld-faq-top': 'faq-top',
  'jsonld-faq-fde': 'faq-fde',
  'jsonld-services': 'services',
  'jsonld-breadcrumb': 'breadcrumb',
};

/**
 * BEGIN / END が「開いたら必ず同じキーで閉じる」「入れ子にしない」形になっているか検査する。
 * 1つでも崩れていれば置換を行わずエラーにする（壊れたHTMLを書き出さないため）。
 */
const checkBalance = (src, rel) => {
  const errs = [];
  const tokens = [
    ...[...src.matchAll(BEGIN_SCAN)].map((m) => ({ at: m.index, kind: 'BEGIN', key: m[1] })),
    ...[...src.matchAll(END_SCAN)].map((m) => ({ at: m.index, kind: 'END', key: m[1] })),
  ].sort((a, b) => a.at - b.at);

  const lineOf = (at) => src.slice(0, at).split('\n').length;

  // キーに使えない文字（空白・全角など）のマーカーは、正規表現に一致せず無言で無視されるため先に弾く
  for (const m of src.matchAll(LOOSE_SCAN)) {
    if (!KEY_RE.test(m[2])) {
      errs.push(`${rel}:${lineOf(m.index)}: マーカーキー "${m[2]}" に使えない文字が含まれています（使えるのは英数字と _ . : @ -）`);
    }
  }
  if (errs.length) return errs;

  let open = null;
  for (const t of tokens) {
    if (t.kind === 'BEGIN') {
      if (open) {
        errs.push(`${rel}:${lineOf(t.at)}: マーカーが入れ子になっています（"${open.key}" を閉じる前に "${t.key}" が開かれました）`);
        return errs;
      }
      open = t;
    } else {
      if (!open) {
        errs.push(`${rel}:${lineOf(t.at)}: 対応する BEGIN の無い <!-- END:${t.key} --> があります`);
        return errs;
      }
      if (open.key !== t.key) {
        errs.push(`${rel}:${lineOf(t.at)}: <!-- BEGIN:${open.key} --> が <!-- END:${t.key} --> で閉じられています`);
        return errs;
      }
      open = null;
    }
  }
  if (open) errs.push(`${rel}:${lineOf(open.at)}: <!-- BEGIN:${open.key} --> が閉じられていません`);
  return errs;
};

/**
 * 1ファイル分のマーカー置換を行う。
 * @returns {{ next: string, keys: string[], errors: string[] }}
 */
export const injectFile = (src, content, rel = '(memory)') => {
  const errors = checkBalance(src, rel);
  if (errors.length) return { next: src, keys: [], errors };

  const eol = src.includes('\r\n') ? '\r\n' : '\n';
  const keys = [];
  const next = src.replace(MARKER_RE, (match, indent, key) => {
    const r = resolveRenderer(key);
    if (!r) {
      errors.push(`${rel}: 未知のマーカーキー "${key}"（--list で一覧を確認してください）`);
      return match;
    }
    keys.push(key);
    let lines;
    try {
      lines = r.render(content, { file: rel });
    } catch (e) {
      errors.push(`${rel}: マーカー "${key}" の生成に失敗しました: ${e.message}`);
      return match;
    }
    if (r.inline) {
      return `${indent}<!-- BEGIN:${key} -->${lines.join('')}<!-- END:${key} -->`;
    }
    const body = lines.map((l) => (l === '' ? '' : `${indent}${l}`)).join(eol);
    return [
      `${indent}<!-- BEGIN:${key} -->`,
      ...(body ? [body] : []),
      `${indent}<!-- END:${key} -->`,
    ].join(eol);
  });

  // JSON-LD だけを置いて画面表示が無い＝非表示の構造化データになる。要件で禁止されているので弾く
  for (const [ld, visible] of Object.entries(LD_PAIRS)) {
    if (keys.includes(ld) && !keys.includes(visible)) {
      errors.push(`${rel}: <!-- BEGIN:${ld} --> がありますが、同じページに表示用の <!-- BEGIN:${visible} --> がありません（画面に出していない内容を構造化データに書かないため）`);
    }
  }

  // 途中でエラーが出た場合は一切書き換えない（壊れた状態を書き出さない）
  if (errors.length) return { next: src, keys, errors };
  return { next, keys, errors };
};

/* ==========================================================================
   6. ファイル走査
   ========================================================================== */

const walkHtml = (dir, out = []) => {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.isDirectory()) {
      if (SKIP_DIRS.has(ent.name)) continue;
      walkHtml(path.join(dir, ent.name), out);
    } else if (ent.isFile() && ent.name.endsWith('.html')) {
      out.push(path.join(dir, ent.name));
    }
  }
  return out;
};

/* ==========================================================================
   7. CLI
   ========================================================================== */

const main = () => {
  const argv = process.argv.slice(2);
  const flags = new Set(argv.filter((a) => a.startsWith('--')));
  const targets = argv.filter((a) => !a.startsWith('--'));

  // 打ち間違えたフラグ（--chek 等）を黙って無視すると、検証のつもりの実行が書き込みになる。
  // 未知のフラグは安全側に倒して中止する。
  const KNOWN_FLAGS = new Set(['--check', '--dry-run', '--verbose', '--list']);
  const unknown = [...flags].filter((f) => !KNOWN_FLAGS.has(f));
  if (unknown.length) {
    console.error(`error: 不明なオプション: ${unknown.join(', ')}`);
    console.error(`使えるオプション: ${[...KNOWN_FLAGS].join(' ')}`);
    return 1;
  }
  const isCheck = flags.has('--check');
  const isDry = flags.has('--dry-run') || isCheck;
  const verbose = flags.has('--verbose');

  if (flags.has('--list')) {
    console.log('使用できるマーカーキー:\n');
    for (const [k, v] of Object.entries(RENDERERS)) console.log(`  <!-- BEGIN:${k} -->`.padEnd(36) + v.desc);
    console.log(`  ${'<!-- BEGIN:cfg:<dot.path> -->'.padEnd(34)}site.config.json の値をインライン展開（例 cfg:company.tel）`);
    console.log('\n書式:  <!-- BEGIN:キー -->  …生成物…  <!-- END:キー -->');
    return 0;
  }

  const content = loadContent();
  const { errors: vErrors, warnings } = validate(content);
  for (const w of warnings) console.warn(`warn: ${w}`);
  if (vErrors.length) {
    for (const e of vErrors) console.error(`error: ${e}`);
    console.error('\ncontent/ のデータ検証に失敗しました。HTMLは変更していません。');
    return 1;
  }

  const files = targets.length
    ? targets.map((t) => path.resolve(ROOT, t))
    : walkHtml(ROOT);

  const changed = [];
  const errors = [];
  let scanned = 0;
  let withMarkers = 0;

  for (const file of files.sort()) {
    if (!fs.existsSync(file)) { errors.push(`ファイルが存在しません: ${path.relative(ROOT, file)}`); continue; }
    const rel = path.relative(ROOT, file);
    const src = fs.readFileSync(file, 'utf8');
    scanned += 1;
    // マーカーが1つも無いファイルは一切触らない
    if (!hasMarker(src)) {
      if (verbose) console.log(`skip   ${rel} (マーカーなし)`);
      continue;
    }
    withMarkers += 1;
    const { next, keys, errors: fErrors } = injectFile(src, content, rel);
    errors.push(...fErrors);
    if (fErrors.length) continue;
    if (next === src) {
      if (verbose) console.log(`ok     ${rel} (${keys.length} マーカー / 差分なし)`);
      continue;
    }
    changed.push(rel);
    if (!isDry) fs.writeFileSync(file, next, 'utf8');
    console.log(`${isDry ? 'diff  ' : 'update'} ${rel} (${keys.join(', ')})`);
  }

  if (errors.length) {
    for (const e of errors) console.error(`error: ${e}`);
    return 1;
  }

  console.log(`\nHTML ${scanned} 件を走査 / マーカーあり ${withMarkers} 件 / ${isDry ? '差分' : '更新'} ${changed.length} 件`);
  if (isCheck && changed.length) {
    console.error('--check: 生成物とHTMLが同期していません。`node scripts/build-content.mjs` を実行してください。');
    return 1;
  }
  return 0;
};

/**
 * 直接実行されたときだけ CLI として動く（テストから import しても main() は走らない）。
 * import.meta.url は Node がシンボリックリンクを解決した実体パスになるのに対し、
 * process.argv[1] は解決前のパスなので、両方 realpath に揃えてから比較する
 * （macOS の /tmp → /private/tmp のようなリンク越しの実行で無言の no-op にならないように）。
 */
const isSameFile = (a, b) => {
  try {
    return fs.realpathSync(a) === fs.realpathSync(b);
  } catch {
    return path.resolve(a) === path.resolve(b);
  }
};
if (process.argv[1] && isSameFile(process.argv[1], fileURLToPath(import.meta.url))) {
  process.exit(main());
}
