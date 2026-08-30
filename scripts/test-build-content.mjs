#!/usr/bin/env node
/**
 * test-build-content.mjs — コンテンツ基盤の自己検証（依存パッケージなし / Node 18+）
 * ============================================================================
 * フェーズ1の受け入れ条件を機械的に確認する。
 *
 *   1. content/*.json が読めて、必要なデータが揃っている
 *   2. 固定コピーが docs/redesign/00-implementation-brief.md の原文と一字一句一致する
 *      （テストがブリーフ本文を直接読んで部分一致を検査するので、写し間違いが残らない）
 *   3. マーカー注入が index.html を壊さない
 *      （マーカー区間の外側が1バイトも変わらない / 既存アンカーが残る / 2回流しても同じ）
 *   4. マーカーが無いファイルは書き換え対象にならない
 *   5. 壊れたマーカー（未知キー・閉じ忘れ・入れ子）は書き換えずエラーになる
 *   6. 生成HTMLのタグが閉じている / エスケープされる
 *   7. FAQPage 構造化データが画面表示のFAQと完全一致する
 *   8. sitemap 生成のURL変換・優先度ルールが期待どおり
 *
 * 使い方: node scripts/test-build-content.mjs
 * ============================================================================
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { injectFile, resolveRenderer, hasMarker, validate, loadContent, articleKey, BANNED } from './build-content.mjs';
import { urlPathOf, ruleFor, lastmodOf } from './generate-sitemap.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const readJson = (p) => JSON.parse(read(p));

let passed = 0;
const failures = [];
const test = (name, fn) => {
  try {
    fn();
    passed += 1;
  } catch (e) {
    failures.push(`${name}\n    → ${e.message}`);
  }
};
const assert = (cond, msg) => { if (!cond) throw new Error(msg); };
const assertEq = (a, b, msg) => {
  if (a !== b) throw new Error(`${msg}\n      期待: ${JSON.stringify(b)}\n      実際: ${JSON.stringify(a)}`);
};

/* ==========================================================================
   データ読み込み
   ========================================================================== */
const BRIEF = read('docs/redesign/00-implementation-brief.md');
// 本体と同じ読み込み経路を使う（記事ページの pages 登録もここで入る）。
// テスト側で組み直すと、読み込み時の加工が抜けたまま合格してしまう
const C = loadContent();

/* ==========================================================================
   1. データの形
   ========================================================================== */
test('content/ に8ファイルが揃っている', () => {
  const want = ['site.config.json', 'pillars.json', 'challenges.json', 'roadmap.json',
    'usecases.json', 'faq-top.json', 'faq-fde.json', 'insights.json'];
  const got = fs.readdirSync(path.join(ROOT, 'content')).filter((f) => f.endsWith('.json')).sort();
  assertEq(got.join(','), want.slice().sort().join(','), 'content/ のJSONファイル構成が想定と違います');
});

test('要件どおりの件数になっている', () => {
  assertEq(C.config.nav.items.length, 8, 'ナビゲーション項目は8件');
  assertEq(C.config.services.length, 8, 'Service は8件');
  assertEq(C.config.contact.subjects.length, 7, 'ご相談の種類は7件');
  assertEq(C.config.contact.fields.length, 9, 'フォーム項目は9件');
  assertEq(C.pillars.pillars.length, 3, '3本柱は3件');
  assertEq(C.pillars.crossSection.steps.length, 3, '3ステップは3件');
  assertEq(C.challenges.items.length, 8, '課題提起は8件');
  assertEq(C.roadmap.phases.length, 4, 'ロードマップは4フェーズ');
  assertEq(C.usecases.items.length, 10, '活用テーマは10件');
  assertEq(C.faqTop.items.length, 7, 'トップFAQは7問');
  assert(C.faqFde.items.length >= 7, '/fde/ FAQ はトップ7問以上');
});

test('未確定情報は推測で埋めていない（空欄プレースホルダー）', () => {
  assertEq(C.config.company.corporateNumber, '', '法人番号は未確定なので空欄');
  assertEq(C.config.company.foundingDate, '', '設立年月日は未確定なので空欄');
  assertEq(C.config.analytics.gtmId, '', 'GTM ID は未取得なので空欄');
});

test('ロードマップの各フェーズに施策と成果物がある', () => {
  for (const p of C.roadmap.phases) {
    assert(p.items.length > 0, `${p.range} に施策がありません`);
    assert(p.deliverables.length > 0, `${p.range} に成果物がありません`);
    assert(/^\d+〜\d+か月$/.test(p.range), `フェーズ表記が不正: ${p.range}`);
  }
});

/* ==========================================================================
   2. 固定コピーが要件原文と一字一句一致するか
   --------------------------------------------------------------------------
   部分一致（includes）だけでは「末尾が欠けている」「1行落ちている」を検出できない。
   そこで2段構えで検査する。
     (a) 行完全一致 … 要件原文では固定コピーの1文が markdown の1行。
                       箇条書き等の記号を除いた「行そのもの」と一致することを求める。
     (b) 往復比較   … 箇条書きで列挙されている項目は、ブリーフから抜き出した配列と
                       content/*.json の配列を丸ごと突き合わせる（欠落・重複・順序も検出）。
   ========================================================================== */
const BRIEF_LINES = BRIEF.split('\n');
/** 要件原文（第8章）の開始行。行完全一致はこの範囲だけを対象にする */
const REQ_FROM = BRIEF_LINES.findIndex((l) => l.startsWith('## 8. 元の要件定義'));
assert(REQ_FROM > 0, '要件原文（第8章）の見出しが見つかりません');

/**
 * 要件原文の各行から、箇条書き記号・Q./A.・見出し記号を外した「素の行」の集合。
 * CTAラベルは原文で 「相談する」 のように鉤括弧で引用されているため、
 * 括弧を外した形も同値として登録する（括弧は引用記号でラベルの一部ではない）。
 */
const REQ_LINE_SET = (() => {
  const set = new Set();
  for (const raw of BRIEF_LINES.slice(REQ_FROM)) {
    const line = raw.replace(/^\s*-\s/, '').replace(/^(Q|A)\.\s/, '').replace(/^#{1,6}\s/, '').trim();
    if (!line) continue;
    set.add(line);
    const quoted = line.match(/^「(.+)」$/);
    if (quoted) set.add(quoted[1]);
  }
  return set;
})();

/** ブリーフの指定行以降で、最初に現れる箇条書きブロックを配列で返す */
const briefBullets = (anchor, indent = '') => {
  const i = BRIEF_LINES.indexOf(anchor);
  assert(i >= 0, `ブリーフに見つかりません: ${anchor}`);
  const prefix = `${indent}- `;
  let j = i + 1;
  while (j < BRIEF_LINES.length && !BRIEF_LINES[j].startsWith(prefix)) j += 1;
  const out = [];
  while (j < BRIEF_LINES.length && BRIEF_LINES[j].startsWith(prefix)) out.push(BRIEF_LINES[j++].slice(prefix.length));
  assert(out.length > 0, `箇条書きが取れません: ${anchor}`);
  return out;
};
/** startAnchor 以降に現れる innerAnchor の直後の段落（同じ見出し語が何度も出る節で使う） */
const briefParaIn = (startAnchor, innerAnchor) => {
  const start = BRIEF_LINES.indexOf(startAnchor);
  assert(start >= 0, `ブリーフに見つかりません: ${startAnchor}`);
  const i = BRIEF_LINES.indexOf(innerAnchor, start);
  assert(i > start, `${startAnchor} の後に見つかりません: ${innerAnchor}`);
  let j = i + 1;
  while (j < BRIEF_LINES.length && BRIEF_LINES[j].trim() === '') j += 1;
  const out = [];
  while (j < BRIEF_LINES.length && BRIEF_LINES[j].trim() !== '') out.push(BRIEF_LINES[j++]);
  assert(out.length > 0, `段落が取れません: ${startAnchor} / ${innerAnchor}`);
  return out;
};

/** ブリーフの指定行の直後の段落（連続する非空行）を配列で返す */
const briefPara = (anchor, skipParas = 0) => {
  const i = BRIEF_LINES.indexOf(anchor);
  assert(i >= 0, `ブリーフに見つかりません: ${anchor}`);
  let j = i + 1;
  for (let k = 0; k <= skipParas; k += 1) {
    while (j < BRIEF_LINES.length && BRIEF_LINES[j].trim() === '') j += 1;
    if (k === skipParas) break;
    while (j < BRIEF_LINES.length && BRIEF_LINES[j].trim() !== '') j += 1;
  }
  const out = [];
  while (j < BRIEF_LINES.length && BRIEF_LINES[j].trim() !== '') out.push(BRIEF_LINES[j++]);
  assert(out.length > 0, `段落が取れません: ${anchor}`);
  return out;
};

/** (a) 行完全一致で検査する固定コピー */
const lineExact = () => {
  const m = C.config.messaging;
  const ct = C.config.contact;
  const x = C.pillars.crossSection;
  return [
    m.existingTagline, m.siteTagline, ...m.siteTaglineSupport,
    m.heroTagline, ...m.heroLead, ...m.heroCtas.map((b) => b.label),
    m.fdeMain, ...m.fdeSub.flat(),
    m.philosophy.title, ...m.philosophy.body.flat(),
    ...C.config.nav.items.map((i) => i.label), C.config.nav.cta.label,
    ct.heading, ...ct.body.flat(), ct.cta.label,
    ...ct.subjects, ...ct.fields.map((f) => f.label),
    ...C.config.entity.businessDefinition, ...C.config.entity.fdeDefinition,
    ...C.config.services.map((s) => s.name),
    ...C.pillars.pillars.flatMap((p) => [p.en, p.ja, ...p.body, ...p.fdeNote]),
    x.sectionName, x.heading, ...x.body.flat(), x.cta.label,
    ...x.steps.flatMap((s) => [`${s.no} ${s.en}`, s.ja, ...s.body]),
    C.challenges.heading, ...C.challenges.items, ...C.challenges.closing,
    C.roadmap.heading, ...C.roadmap.intro, C.roadmap.cta.label,
    ...C.roadmap.phases.flatMap((p) => [`${p.range}：${p.title}`, ...p.items, ...p.deliverables]),
    C.usecases.heading, ...C.usecases.items,
    ...C.faqTop.items.flatMap((i) => [i.q, i.a]),
  ];
};

test('固定コピーが要件原文の「行そのもの」と完全一致する（切り詰め・欠落を検出）', () => {
  const bad = lineExact().filter((v) => !REQ_LINE_SET.has(v));
  assert(bad.length === 0,
    `要件原文の行と完全一致しない文字列が ${bad.length} 件あります:\n      - ${bad.join('\n      - ')}`);
});

/** (b) 列挙項目はブリーフから抜き出した配列と丸ごと突き合わせる */
const roundTrips = () => {
  const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const cases = [
    ['ナビゲーション項目', C.config.nav.items.map((i) => i.label), briefBullets('ナビゲーション：')],
    ['ご相談の種類', C.config.contact.subjects, briefBullets('- ご相談の種類', '  ')],
    ['Service 8件', C.config.services.map((s) => s.name), briefBullets('Serviceには、以下のサービスを設定する。')],
    ['課題提起8件', C.challenges.items, briefBullets('以下を、業界を限定しない表現のカードとして表示する。')],
    ['活用テーマ10件', C.usecases.items, briefBullets('以下は実績ではなく、「活用イメージ」と明記する。')],
    ['ヒーローCTA', C.config.messaging.heroCtas.map((b) => b.label), briefBullets('CTA：')],
    ['ヒーロー本文', C.config.messaging.heroLead,
      briefPara('その下またはアニメーション切り替え要素で、以下を表示する。', 1)],
    ['ロードマップ導入文', C.roadmap.intro, briefPara('導入文：')],
    ['課題提起の締め文', C.challenges.closing, briefPara('セクション末尾：')],
    ['思想ブロック本文', C.config.messaging.philosophy.body.flat(),
      [...briefPara('## ククルFMの思想として目立たせる文章', 1), ...briefPara('## ククルFMの思想として目立たせる文章', 2)]],
    ['FDEサブコピー', C.config.messaging.fdeSub.flat(),
      [...briefPara('## FDE・AI実装支援ページのサブコピー'), ...briefPara('## FDE・AI実装支援ページのサブコピー', 1)]],
  ];
  for (const [, , brief] of cases) assert(brief.length > 0, '');
  return cases.filter(([, mine, brief]) => !eq(mine, brief));
};

test('列挙項目がブリーフの原文リストと丸ごと一致する（欠落・重複・順序も検出）', () => {
  const bad = roundTrips();
  assert(bad.length === 0, `原文リストと一致しません:\n${bad.map(([n, mine, brief]) =>
    `      ${n}\n        JSON : ${JSON.stringify(mine)}\n        原文 : ${JSON.stringify(brief)}`).join('\n')}`);
});

test('3本柱の本文・補足が原文の段落と丸ごと一致する', () => {
  const anchors = ['### CONSTRUCTION & INFRASTRUCTURE', '### CREATIVE & TECH', '### LIFESTYLE'];
  anchors.forEach((anchor, k) => {
    const p = C.pillars.pillars[k];
    assertEq(p.en, anchor.slice(4), `${anchor}: 英語見出しが一致しません`);
    assertEq(p.ja, briefParaIn(anchor, '見出し：')[0], `${anchor}: 日本語見出しが一致しません`);
    assertEq(JSON.stringify(p.body), JSON.stringify(briefParaIn(anchor, '本文：')), `${anchor}: 本文が一致しません`);
    assertEq(JSON.stringify(p.fdeNote), JSON.stringify(briefParaIn(anchor, '補足：')), `${anchor}: 補足が一致しません`);
  });
});

test('FDE横断セクションの本文・3ステップが原文と丸ごと一致する', () => {
  const sec = '## 3. FDE横断セクション';
  const x = C.pillars.crossSection;
  assertEq(x.sectionName, briefParaIn(sec, 'セクション名：')[0], 'セクション名が一致しません');
  assertEq(x.heading, briefParaIn(sec, '日本語見出し：')[0], '日本語見出しが一致しません');

  // 本文3段落
  const start = BRIEF_LINES.indexOf(sec);
  let j = BRIEF_LINES.indexOf('本文：', start) + 1;
  const bodyParas = [];
  for (let k = 0; k < 3; k += 1) {
    while (BRIEF_LINES[j].trim() === '') j += 1;
    const para = [];
    while (BRIEF_LINES[j].trim() !== '') para.push(BRIEF_LINES[j++]);
    bodyParas.push(para);
  }
  assertEq(JSON.stringify(x.body), JSON.stringify(bodyParas), '本文3段落が一致しません');

  // 3ステップ（見出し2行 + 本文段落）
  let s2 = BRIEF_LINES.indexOf('3ステップ図解：', start) + 1;
  x.steps.forEach((st) => {
    while (BRIEF_LINES[s2].trim() === '') s2 += 1;
    const head = [];
    while (BRIEF_LINES[s2].trim() !== '') head.push(BRIEF_LINES[s2++]);
    while (BRIEF_LINES[s2].trim() === '') s2 += 1;
    const body = [];
    while (BRIEF_LINES[s2].trim() !== '') body.push(BRIEF_LINES[s2++]);
    assertEq(`${st.no} ${st.en}`, head[0], 'ステップ見出しが一致しません');
    assertEq(st.ja, head[1], 'ステップ日本語見出しが一致しません');
    assertEq(JSON.stringify(st.body), JSON.stringify(body), `ステップ ${st.no} の本文が一致しません`);
  });
});

test('ロードマップ4フェーズの施策・成果物が原文リストと丸ごと一致する', () => {
  const anchors = [
    '### 1〜3か月：現場課題を、実装できる要件へ',
    '### 4〜6か月：最小構成を作り、実務で動かす',
    '### 7〜9か月：現場に定着させ、利用範囲を広げる',
    '### 10〜12か月：成果を可視化し、継続改善できる体制へ',
  ];
  anchors.forEach((anchor, k) => {
    const p = C.roadmap.phases[k];
    const i = BRIEF_LINES.indexOf(anchor);
    assert(i >= 0, `ブリーフに見つかりません: ${anchor}`);
    let j = i + 1;
    while (!BRIEF_LINES[j].startsWith('- ')) j += 1;
    const items = [];
    while (BRIEF_LINES[j]?.startsWith('- ')) items.push(BRIEF_LINES[j++].slice(2));
    assertEq(JSON.stringify(p.items), JSON.stringify(items), `${anchor} の施策が原文と一致しません`);
    let d = BRIEF_LINES.indexOf('成果物：', i);
    while (!BRIEF_LINES[d].startsWith('- ')) d += 1;
    const dels = [];
    while (BRIEF_LINES[d]?.startsWith('- ')) dels.push(BRIEF_LINES[d++].slice(2));
    assertEq(JSON.stringify(p.deliverables), JSON.stringify(dels), `${anchor} の成果物が原文と一致しません`);
    assertEq(`${p.range}：${p.title}`, anchor.slice(4), `${anchor} の見出しが一致しません`);
  });
});

test('FAQ7問がブリーフの Q./A. と丸ごと一致する', () => {
  const from = BRIEF_LINES.indexOf('## 8. FAQ');
  const to = BRIEF_LINES.indexOf('## 9. お問い合わせ');
  assert(from > 0 && to > from, 'FAQ 章が見つかりません');
  const qs = [];
  const as = [];
  for (let i = from; i < to; i += 1) {
    if (BRIEF_LINES[i].startsWith('Q. ')) qs.push(BRIEF_LINES[i].slice(3));
    if (BRIEF_LINES[i].startsWith('A. ')) as.push(BRIEF_LINES[i].slice(3));
  }
  assertEq(JSON.stringify(C.faqTop.items.map((x) => x.q)), JSON.stringify(qs), 'FAQ の質問が原文と一致しません');
  assertEq(JSON.stringify(C.faqTop.items.map((x) => x.a)), JSON.stringify(as), 'FAQ の回答が原文と一致しません');
});

test('会社情報がブリーフの確定値と一致する（行の一部として引用されている項目）', () => {
  const co = C.config.company;
  const a = co.address;
  for (const v of [co.legalName, co.alternateName, co.representative, co.tel, co.email,
    a.postalCode, a.addressRegion, a.addressLocality, a.streetAddress, a.building,
    C.pillars.fdeNoteLabel, C.roadmap.deliverablesLabel]) {
    assert(BRIEF.includes(v), `ブリーフに見つかりません: ${JSON.stringify(v)}`);
  }
  assert(BRIEF.includes(`${a.addressRegion}${a.addressLocality}${a.streetAddress}`), '所在地の連結表記が一致しません');
  assert(BRIEF.includes(`〒${a.postalCode} ${a.addressRegion}${a.addressLocality}${a.streetAddress} ${a.building}`),
    '所在地がブリーフの1行と一致しません');
});

test('活用テーマに「実績ではない」注記がある', () => {
  assert(!!C.usecases.note, 'usecases.json の note が空です');
  assert(C.usecases.note.includes('実績') && C.usecases.note.includes('活用イメージ'),
    `note は「実績ではなく活用イメージ」である旨を含む必要があります: ${C.usecases.note}`);
});

test('表記は CUCUL FM.LLC に統一されている（スペース入りは使わない）', () => {
  const all = JSON.stringify(C);
  assert(!all.includes('CUCUL FM .LLC'), '「CUCUL FM .LLC」（スペースあり）が混入しています');
  assert(all.includes('CUCUL FM.LLC'), '「CUCUL FM.LLC」が見つかりません');
});

test('架空の実績・断定表現が入っていない', () => {
  // 本体の BANNED を共有し、テスト固有の語を足す（二重管理で食い違わないように）
  const banned = [...BANNED, '導入社数', '削減率', '導入実績', '顧客ロゴ'];
  const hits = [];
  const walk = (n, trail) => {
    if (typeof n === 'string') { for (const w of banned) if (n.includes(w)) hits.push(`${w} @ ${trail}`); }
    else if (Array.isArray(n)) n.forEach((v, i) => walk(v, `${trail}[${i}]`));
    else if (n && typeof n === 'object') for (const [k, v] of Object.entries(n)) walk(v, `${trail}.${k}`);
  };
  for (const [k, v] of Object.entries(C)) walk(v, k);
  assert(hits.length === 0, `禁止表現: ${hits.join(', ')}`);
});

test('FAQの共通設問がトップと /fde/ で一致している', () => {
  const top = new Map(C.faqTop.items.map((i) => [i.id, i]));
  for (const it of C.faqFde.items) {
    const t = top.get(it.id);
    if (!t) continue;
    assertEq(it.q, t.q, `FAQ "${it.id}" の質問がずれています`);
    assertEq(it.a, t.a, `FAQ "${it.id}" の回答がずれています`);
  }
  for (const id of top.keys()) {
    assert(C.faqFde.items.some((i) => i.id === id), `/fde/ FAQ にトップの設問 "${id}" がありません`);
  }
});

/* ==========================================================================
   3. マーカー注入が index.html を壊さないこと
   ========================================================================== */
const INDEX = read('index.html');
/** index.html が実際に持っているマーカー数（フェーズが進むほど増える） */
const INDEX_MARKERS = [...INDEX.matchAll(/<!--\s*BEGIN:([A-Za-z0-9_.:@-]+)\s*-->/g)].length;
/** マーカーを持たない実ファイル。「触らない」ことの検証に使う。
 *  フェーズ4で全公開ページに計測マーカーが入ったので、対象はキャラ確認用ビューアだけになった */
const NO_MARKER_FILE = 'character-design/phantom-dj/viewer.html';
const NO_MARKER_HTML = read(NO_MARKER_FILE);
/** マーカー区間の中身を伏せ字にして、外側だけを比較できるようにする */
const blankMarkers = (s) => s.replace(
  /(<!--\s*BEGIN:([A-Za-z0-9_.:@-]+)\s*-->)[\s\S]*?(<!--\s*END:\2\s*-->)/g,
  (_m, begin, _k, end) => `${begin}<<<BODY>>>${end}`,
);

/** トップページに実際に入れる予定のマーカーを、既存構造を壊さない位置に挿入した検証用HTML */
const withMarkers = (() => {
  let s = INDEX;
  const insertBefore = (needle, block) => {
    const i = s.indexOf(needle);
    if (i < 0) throw new Error(`挿入位置が見つかりません: ${needle}`);
    s = `${s.slice(0, i)}${block}${s.slice(i)}`;
  };
  // JSON-LD（head の preconnect 群の直前 = 既存マーカー区間の外側。
  // index.html 側の jsonld-organization の内側に入れると入れ子になってしまう）
  insertBefore('<link rel="dns-prefetch" href="https://fonts.googleapis.com">',
    '<!-- BEGIN:jsonld-organization -->\n<!-- END:jsonld-organization -->\n');
  // 本文セクション群（</main> の直前 = 既存セクションの後ろ）
  const keys = ['pillars', 'fde-cross', 'fde-steps', 'challenges', 'roadmap', 'usecases',
    'faq-top', 'services', 'contact-copy', 'jsonld-services', 'jsonld-faq-top'];
  insertBefore('</main>', `${keys.map((k) => `  <!-- BEGIN:${k} -->\n  <!-- END:${k} -->`).join('\n')}\n`);
  // インライン展開（電話番号）と未確定値（法人番号 = 何も出力されないこと）
  insertBefore('</main>',
    '  <p>TEL: <!-- BEGIN:cfg:company.tel --><!-- END:cfg:company.tel -->'
    + ' / 法人番号: <!-- BEGIN:cfg:company.corporateNumber --><!-- END:cfg:company.corporateNumber --></p>\n');
  return s;
})();

// rel は 'index.html' のまま渡す。jsonld-webpage は ctx.file をキーに
// site.config.json の pages を引くので、別名にすると定義なしエラーになる
const injected = injectFile(withMarkers, C, 'index.html');

test('注入時にエラーが出ない', () => {
  assertEq(injected.errors.length, 0, `注入エラー: ${injected.errors.join(' / ')}`);
  assertEq(injected.keys.length, 14 + INDEX_MARKERS,
    `処理されたマーカー数が想定と違います（挿入14 + index.html 既存${INDEX_MARKERS}）`);
});

test('マーカー区間の外側は1バイトも変わらない', () => {
  assertEq(blankMarkers(injected.next), blankMarkers(withMarkers),
    'マーカー区間の外側が書き換えられています');
});

test('既存の演出・アンカー・フォームが残っている', () => {
  const must = [
    'id="hero"', 'id="seq"', 'id="business"', 'id="news"', 'id="about"', 'id="contact"',
    'id="contactForm"', 'id="index-overlay"', 'id="biz-scroller"', 'id="site-bgm"',
    'class="site-footer"', 'data-theme="moon"', 'href="/services/dog/#puppies"',
    'href="tel:09062623842"',
  ];
  for (const m of must) assert(injected.next.includes(m), `${m} が失われました`);
  const count = (s, re) => (s.match(re) || []).length;
  assertEq(count(injected.next, /<section\b/g), count(INDEX, /<section\b/g), '<section> の数が変わりました');
  assertEq(count(injected.next, /<\/section>/g), count(INDEX, /<\/section>/g), '</section> の数が変わりました');
  assertEq(count(injected.next, /<form\b/g), count(INDEX, /<form\b/g), '<form> の数が変わりました');
  assert(injected.next.trimEnd().endsWith('</html>'), '文書末尾が壊れています');
});

test('2回流しても結果が変わらない（冪等）', () => {
  const again = injectFile(injected.next, C, 'index.html');
  assertEq(again.errors.length, 0, `2回目でエラー: ${again.errors.join(' / ')}`);
  assertEq(again.next, injected.next, '2回目の注入で内容が変化しました');
});

test('マーカー検出と置換の判定が一致する（空白違いを取りこぼさない）', () => {
  const variants = [
    '<!-- BEGIN:usecases -->',
    '<!--BEGIN:usecases-->',
    '<!--  BEGIN:usecases  -->',
    '<!--\tBEGIN:usecases\t-->',
  ];
  for (const begin of variants) {
    const end = begin.replace('BEGIN', 'END');
    const src = `<div>${begin}${end}</div>`;
    assert(hasMarker(src), `マーカーとして検出されません: ${JSON.stringify(begin)}`);
    const r = injectFile(src, C, 'variant.html');
    assertEq(r.errors.length, 0, `置換でエラー: ${JSON.stringify(begin)} / ${r.errors.join(' ')}`);
    assert(r.next !== src, `検出されたのに置換されていません: ${JSON.stringify(begin)}`);
    assert(r.next.includes('uc-list'), `生成物が入っていません: ${JSON.stringify(begin)}`);
  }
  assert(!hasMarker('<div><!-- END:usecases --></div>'), 'END だけでマーカー扱いになりました');
  assert(!hasMarker(NO_MARKER_HTML), `${NO_MARKER_FILE} にマーカーがあると判定されました`);
});

test('マーカーが無いファイルは一切変化しない', () => {
  const r = injectFile(NO_MARKER_HTML, C, NO_MARKER_FILE);
  assertEq(r.errors.length, 0, 'マーカー無しでエラーが出ました');
  assertEq(r.next, NO_MARKER_HTML, 'マーカーが無いのに内容が変わりました');
  assertEq(r.keys.length, 0, 'マーカーが無いのにキーが処理されました');
});

test('index.html は build-content を流しても差分が出ない（同期済み）', () => {
  const r = injectFile(INDEX, C, 'index.html');
  assertEq(r.errors.length, 0, `エラー: ${r.errors.join(' / ')}`);
  assertEq(r.next, INDEX, 'index.html が content/*.json と同期していません（build-content.mjs を実行してください）');
  assert(r.keys.length > 0, 'index.html にマーカーが1つもありません');
});

test('インライン展開が働き、未確定値は何も出力しない', () => {
  assert(injected.next.includes('TEL: <!-- BEGIN:cfg:company.tel -->090-6262-3842<!-- END:cfg:company.tel -->'),
    'cfg:company.tel が展開されていません');
  assert(injected.next.includes('法人番号: <!-- BEGIN:cfg:company.corporateNumber --><!-- END:cfg:company.corporateNumber -->'),
    '未確定の法人番号が出力されています（空欄のままであるべき）');
});

test('cfg: が配列を <br> 連結し、書き間違いのパスはエラーになる', () => {
  const ok = injectFile('<p><!-- BEGIN:cfg:company.sameAs --><!-- END:cfg:company.sameAs --></p>', C, 't');
  assertEq(ok.errors.length, 0, `配列展開でエラー: ${ok.errors.join(' / ')}`);
  assert(ok.next.includes('instagram.com/cuculfm_llc/<br>https://x.com/'), '配列が <br> 連結されていません');

  for (const [label, key] of [['存在しないパス', 'cfg:company.nosuchfield'], ['オブジェクト', 'cfg:company.address']]) {
    const src = `<p><!-- BEGIN:${key} --><!-- END:${key} --></p>`;
    const r = injectFile(src, C, 't');
    assert(r.errors.length > 0, `${label} がエラーになりません`);
    assertEq(r.next, src, `${label} でエラーなのに内容が変わりました`);
  }
});

test('JSON-LDだけを置いて表示用が無いページはエラーになる（非表示の構造化データを作らない）', () => {
  for (const [ld, visible] of [['jsonld-faq-top', 'faq-top'], ['jsonld-faq-fde', 'faq-fde'], ['jsonld-services', 'services']]) {
    const only = `<div><!-- BEGIN:${ld} --><!-- END:${ld} --></div>`;
    const r = injectFile(only, C, 'hidden.html');
    assert(r.errors.length > 0, `${ld} を単独で置いてもエラーになりません`);
    assertEq(r.next, only, `${ld} 単独でエラーなのに書き換えられました`);

    const both = `<div><!-- BEGIN:${visible} --><!-- END:${visible} --><!-- BEGIN:${ld} --><!-- END:${ld} --></div>`;
    const ok = injectFile(both, C, 'paired.html');
    assertEq(ok.errors.length, 0, `${visible} と対で置いたのにエラー: ${ok.errors.join(' / ')}`);
  }
});

test('マーカーキーに使えない文字はエラーになる（無言で無視しない）', () => {
  for (const key of ['faq top', 'faq-top（トップ）', 'faq/top']) {
    const src = `<div><!-- BEGIN:${key} --><!-- END:${key} --></div>`;
    assert(hasMarker(src), `検出されません: ${key}`);
    const r = injectFile(src, C, 'badkey.html');
    assert(r.errors.length > 0, `不正キー "${key}" がエラーになりません`);
    assertEq(r.next, src, `不正キー "${key}" でエラーなのに書き換えられました`);
  }
});

test('会社概要テーブルはキーが存在しない場合も undefined を出力しない', () => {
  const hc = structuredClone(C);
  delete hc.config.company.serviceArea;
  delete hc.config.company.representativeBio;
  hc.config.company.businessHours = null;
  const html = resolveRenderer('company-spec').render(hc).join('\n');
  assert(!html.includes('undefined'), '文字列 "undefined" が出力されました');
  assert(!html.includes('null'), '文字列 "null" が出力されました');
  assert(!html.includes('対応地域'), 'キーが無いのに行が出力されました');
  assert(html.includes('ククルFM合同会社'), '存在する値まで消えました');
});

test('ヒーローCTAの計測イベントはデータ由来で、リンク先変更で消えない', () => {
  const hc = structuredClone(C);
  hc.config.messaging.heroCtas[1].href = '/fde/index.html';
  const html = resolveRenderer('hero-copy').render(hc).join('\n');
  assert(html.includes('data-ga-event="click_fde_service"'), 'リンク先を変えたら計測属性が消えました');
  assert(html.includes('href="/fde/index.html"'), 'リンク先が反映されていません');
});

test('本文の固定コピーが空だと validate がエラーにする', () => {
  const bad = structuredClone(C);
  bad.challenges.closing = [];
  assert(validate(bad).errors.some((e) => e.includes('challenges.closing')), '空の締め文が検出されません');

  const bad2 = structuredClone(C);
  bad2.pillars.pillars[0].body = [];
  assert(validate(bad2).errors.some((e) => e.includes('pillars[0].body')), '空の本文が検出されません');

  const bad3 = structuredClone(C);
  bad3.usecases.note = '';
  assert(validate(bad3).errors.some((e) => e.includes('note')), '活用イメージ注記の欠落が検出されません');

  const bad4 = structuredClone(C);
  bad4.roadmap.phases[0].items[0] = '必ず効率化できます';
  assert(validate(bad4).errors.some((e) => e.includes('禁止表現')), '禁止表現が検出されません');

  assertEq(validate(structuredClone(C)).errors.length, 0, '正常なデータでエラーが出ました');
});

test('空配列を渡しても undefined を出力しない', () => {
  const bad = structuredClone(C);
  bad.challenges.closing = [];
  bad.roadmap.intro = [];
  for (const key of ['challenges', 'roadmap']) {
    const html = resolveRenderer(key).render(bad).join('\n');
    assert(!html.includes('undefined'), `${key}: 空配列から "undefined" が出力されました`);
    assert(!/<p[^>]*>\s*<\/p>/.test(html), `${key}: 空の <p> が残っています`);
  }
});

test('リンク先が実在するか、後続フェーズで作る予定のページに限られる', () => {
  const planned = new Set(['/fde/', '/insights/', '/about/', '/privacy/']);
  const hrefs = new Set();
  const walk = (n) => {
    if (typeof n === 'string') { if (n.startsWith('/')) hrefs.add(n); }
    else if (Array.isArray(n)) n.forEach(walk);
    else if (n && typeof n === 'object') for (const [k, v] of Object.entries(n)) { if (k === 'href' || k === 'url') walk(v); else walk(v); }
  };
  for (const [, v] of Object.entries(C)) walk(v);
  const missing = [];
  for (const h of hrefs) {
    const p = h.split('#')[0];
    if (planned.has(p)) continue;
    const asDir = path.join(ROOT, p.replace(/^\//, ''), 'index.html');
    const asFile = path.join(ROOT, p.replace(/^\//, ''));
    if (!fs.existsSync(asDir) && !fs.existsSync(asFile)) missing.push(h);
  }
  assert(missing.length === 0, `存在しないリンク先: ${missing.join(', ')}`);
});

test('contact-subjects が要件どおりの option を出力する', () => {
  const html = resolveRenderer('contact-subjects').render(C).join('\n');
  const opts = [...html.matchAll(/<option value="([^"]*)">([^<]*)<\/option>/g)];
  assertEq(opts.length, C.config.contact.subjects.length + 1, 'option の数が違います（先頭のプレースホルダー込み）');
  assertEq(opts[0][1], '', '先頭の option の value が空ではありません');
  assertEq(JSON.stringify(opts.slice(1).map((m) => m[2])), JSON.stringify(C.config.contact.subjects),
    'ご相談の種類の並びが違います');
});

/* ==========================================================================
   4. 壊れたマーカーは書き換えずエラーにする
   ========================================================================== */
const brokenCases = {
  '未知キー': '<div><!-- BEGIN:no-such-key --><!-- END:no-such-key --></div>',
  '閉じ忘れ': '<div><!-- BEGIN:usecases --></div>',
  '対応しないEND': '<div><!-- END:usecases --></div>',
  '入れ子': '<div><!-- BEGIN:usecases --><!-- BEGIN:faq-top --><!-- END:faq-top --><!-- END:usecases --></div>',
  'キー不一致': '<div><!-- BEGIN:usecases --><!-- END:faq-top --></div>',
};
for (const [name, src] of Object.entries(brokenCases)) {
  test(`壊れたマーカー（${name}）はエラーになり、原文を変えない`, () => {
    const r = injectFile(src, C, 'broken.html');
    assert(r.errors.length > 0, 'エラーが報告されませんでした');
    assertEq(r.next, src, 'エラー時に内容が書き換えられました');
  });
}

/* ==========================================================================
   5. 生成HTMLの健全性
   ========================================================================== */
const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr']);
/** 生成断片のタグ開閉が取れているか（開始/終了タグのスタック検査） */
const tagBalance = (html) => {
  const stack = [];
  for (const m of html.matchAll(/<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b[^>]*?(\/?)>/g)) {
    const [, closing, tag, selfClose] = m;
    const t = tag.toLowerCase();
    if (VOID.has(t) || selfClose) continue;
    if (closing) {
      const open = stack.pop();
      if (open !== t) throw new Error(`タグの対応が取れていません: </${t}> に対する開始タグは ${open || 'なし'}`);
    } else stack.push(t);
  }
  if (stack.length) throw new Error(`閉じられていないタグ: ${stack.join(', ')}`);
};

const BLOCK_KEYS = ['nav', 'hero-copy', 'fde-lead', 'philosophy', 'pillars', 'fde-cross', 'fde-steps',
  'fde-steps-detail', 'service-fde', 'challenges', 'roadmap', 'usecases', 'faq-top', 'faq-fde',
  'services', 'company-spec', 'contact-copy'];
for (const key of BLOCK_KEYS) {
  test(`生成HTML（${key}）のタグが閉じている`, () => {
    const html = resolveRenderer(key).render(C).join('\n');
    assert(html.trim() !== '', '生成結果が空です');
    tagBalance(html);
  });
}

test('生成HTMLでテキストがエスケープされる', () => {
  const html = resolveRenderer('pillars').render(C).join('\n');
  assert(html.includes('CONSTRUCTION &amp; INFRASTRUCTURE'), '& がエスケープされていません');
  assert(!/CONSTRUCTION & INFRASTRUCTURE/.test(html), '生の & が残っています');
  const nav = resolveRenderer('nav').render(C).join('\n');
  assert(nav.includes('Construction &amp; Infrastructure'), 'ナビの & がエスケープされていません');
});

test('重要本文がJS無しでもHTMLに存在する（details は初期表示 open）', () => {
  const rm = resolveRenderer('roadmap').render(C).join('\n');
  assert(rm.includes('<details class="rm-details" open>'), 'ロードマップの details が open ではありません');
  for (const p of C.roadmap.phases) {
    for (const item of p.items) assert(rm.includes(item.replace(/&/g, '&amp;')), `ロードマップ本文が欠落: ${item}`);
    for (const d of p.deliverables) assert(rm.includes(`>${d}</li>`), `成果物が欠落: ${d}`);
  }
  const uc = resolveRenderer('usecases').render(C).join('\n');
  for (const item of C.usecases.items) assert(uc.includes(item), `活用テーマ本文が欠落: ${item}`);
});

test('会社概要テーブルは空欄項目を出力しない', () => {
  const html = resolveRenderer('company-spec').render(C).join('\n');
  assert(!html.includes('法人番号'), '未確定の法人番号の行が出力されています');
  assert(!html.includes('設立年月日'), '未確定の設立年月日の行が出力されています');
  assert(html.includes('ククルFM合同会社'), '会社名が出力されていません');
  assert(html.includes('090-6262-3842'), '電話番号が出力されていません');
});

/* ==========================================================================
   6. JSON-LD
   ========================================================================== */
const parseLd = (key) => {
  const html = resolveRenderer(key).render(C).join('\n');
  const m = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  assert(m, `${key}: <script type="application/ld+json"> が生成されていません`);
  return JSON.parse(m[1]);
};

test('注入後のHTML内 JSON-LD がすべて JSON として妥当', () => {
  const blocks = [...injected.next.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  assert(blocks.length >= 3, `JSON-LD ブロックが足りません: ${blocks.length}`);
  blocks.forEach((b, i) => {
    try { JSON.parse(b[1]); } catch (e) { throw new Error(`${i + 1}番目の JSON-LD が壊れています: ${e.message}`); }
  });
});

test('Organization JSON-LD に未確定情報が入らない', () => {
  const ld = parseLd('jsonld-organization');
  const org = ld['@graph'].find((n) => n['@type'] === 'Organization');
  assert(org, 'Organization ノードがありません');
  assert(!('foundingDate' in org), '未確定の設立年月日が出力されています');
  assert(!('taxID' in org), '未確定の法人番号が出力されています');
  assertEq(org.name, 'ククルFM合同会社', '会社名が違います');
  assertEq(org.telephone, '+81-90-6262-3842', '電話番号が違います');
  assert(org.sameAs.length === 2, 'sameAs が2件ではありません');
});

test('Service JSON-LD が8件・可視リストと一致する', () => {
  const ld = parseLd('jsonld-services');
  assertEq(ld['@graph'].length, 8, 'Service が8件ではありません');
  const visible = resolveRenderer('services').render(C).join('\n');
  for (const s of ld['@graph']) {
    assert(visible.includes(s.name), `Service "${s.name}" が可視リストにありません`);
    assert(visible.includes(s.description), `Service "${s.name}" の説明が可視リストと一致しません`);
    assert(/^https:\/\/cucul-fm\.com\//.test(s.url), `Service "${s.name}" の url が絶対URLではありません`);
  }
});

for (const [key, ldKey, data] of [['faq-top', 'jsonld-faq-top', C.faqTop], ['faq-fde', 'jsonld-faq-fde', C.faqFde]]) {
  test(`FAQPage（${ldKey}）が画面表示のFAQと完全一致する`, () => {
    const ld = parseLd(ldKey);
    assertEq(ld['@type'], 'FAQPage', '@type が FAQPage ではありません');
    assertEq(ld.mainEntity.length, data.items.length, '設問数が表示と一致しません');
    const html = resolveRenderer(key).render(C).join('\n');
    const unesc = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'").replace(/&amp;/g, '&');
    const shownQ = [...html.matchAll(/<summary class="faq-q">([\s\S]*?)<\/summary>/g)].map((m) => unesc(m[1]));
    const shownA = [...html.matchAll(/<div class="faq-a"><p>([\s\S]*?)<\/p><\/div>/g)].map((m) => unesc(m[1]));
    assertEq(shownQ.join(''), ld.mainEntity.map((q) => q.name).join(''), '質問が表示と構造化データで一致しません');
    assertEq(shownA.join(''), ld.mainEntity.map((q) => q.acceptedAnswer.text).join(''), '回答が表示と構造化データで一致しません');
  });
}

/* --------------------------------------------------------------------------
   悪意ある / 想定外の文字を含むデータを流しても壊れないこと
   （現在のデータには < や " が無いため、合成データで防御を実際に確かめる）
   -------------------------------------------------------------------------- */
const HOSTILE = '</script><script>alert("x")</script> & "引用" <em>強調</em>';
const hostileContent = () => {
  const c = structuredClone(C);
  c.faqTop = structuredClone(C.faqTop);
  c.faqTop.items = [{ id: 'hostile', q: `質問 ${HOSTILE}`, a: `回答 ${HOSTILE}` }];
  c.config.services = [{ id: 'h', name: `サービス ${HOSTILE}`, url: '/fde/', description: `説明 ${HOSTILE}` }];
  c.usecases.items = [`活用 ${HOSTILE}`];
  c.config.company.tel = `03-0000-0000" onload="alert(1)`;
  return c;
};

test('JSON-LD が </script> で脱出されない', () => {
  const hc = hostileContent();
  const html = resolveRenderer('jsonld-faq-top').render(hc).join('\n');
  const inner = html.replace(/^<script type="application\/ld\+json">\n/, '').replace(/\n<\/script>$/, '');
  assert(!inner.toLowerCase().includes('</script'), 'JSON-LD 内に生の </script> が残っています');
  assert(!inner.includes('<'), 'JSON-LD 内に生の < が残っています');
  const ld = JSON.parse(inner);
  assertEq(ld.mainEntity[0].name, `質問 ${HOSTILE}`, 'エスケープ後に元の文字列へ復元できません');
  assertEq(ld.mainEntity[0].acceptedAnswer.text, `回答 ${HOSTILE}`, '回答が復元できません');
});

test('本文HTMLに生のタグが出力されない', () => {
  const hc = hostileContent();
  for (const key of ['faq-top', 'usecases', 'services']) {
    const html = resolveRenderer(key).render(hc).join('\n');
    assert(!html.includes('<script>'), `${key}: 生の <script> が出力されました`);
    assert(!html.includes('</script>'), `${key}: 生の </script> が出力されました`);
    assert(html.includes('&lt;script&gt;'), `${key}: < がエスケープされていません`);
    tagBalance(html);
  }
});

test('属性値に " を入れても属性が壊れない', () => {
  const hc = hostileContent();
  const html = resolveRenderer('company-spec').render(hc).join('\n');
  // 生の " で属性が閉じられ、新しい属性（onload=）が生えていないこと
  assert(!/\son[a-z]+\s*=\s*"/i.test(html), '属性値から脱出してイベントハンドラ属性が生成されました');
  assert(html.includes('onload=&quot;'), '" がエスケープされたテキストとして出力されていません');
  const hrefs = [...html.matchAll(/href="([^"]*)"/g)].map((m) => m[1]);
  assert(hrefs.every((h) => /^(tel:|mailto:|\/|https?:)/.test(h)), `href が壊れています: ${hrefs.join(', ')}`);
  tagBalance(html);
});

test('見出しの装飾タグは <em>/<strong>/<br> だけ許可される', () => {
  const hc = hostileContent();
  hc.challenges = structuredClone(C.challenges);
  hc.challenges.heading = '見出し <em>強調</em> <script>alert(1)</script>';
  const html = resolveRenderer('challenges').render(hc).join('\n');
  // 見出しは esc() 経由なので装飾タグも含めすべてエスケープされる（本文は素通しにしない）
  assert(!html.includes('<script>'), '見出しから <script> が素通ししました');
});

/* ==========================================================================
   6b. グローバルナビの表示切替（フェーズ2）
   ========================================================================== */
test('グローバルナビが GSAP に依存していない', () => {
  const start = INDEX.indexOf('function initGlobalNav()');
  assert(start > 0, 'initGlobalNav が index.html にありません');
  const src = INDEX.slice(start, INDEX.indexOf('function initBizProgressMobile()'));
  assert(!/gsap|ScrollTrigger/.test(src),
    'initGlobalNav が GSAP を参照しています（CDN 断でナビが出なくなる）');
  assert(INDEX.includes('initGlobalNav();'), 'initGlobalNav() が呼ばれていません');
  assert(INDEX.includes('<noscript><style>.gnav{'), 'JS 無効時のフォールバックがありません');
});

test('グローバルナビがヒーロー通過で出て、戻すと消える（ヒステリシスあり）', () => {
  const start = INDEX.indexOf('function initGlobalNav()');
  const src = INDEX.slice(start, INDEX.indexOf('function initBizProgressMobile()'));
  const cls = new Set();
  const handlers = {};
  const bar = { classList: { toggle: (n, v) => { if (v) cls.add(n); else cls.delete(n); } } };
  const hero = { offsetHeight: 900 };
  const $sel = (sel) => (sel === '#gnav' ? bar : sel === '#hero' ? hero : null);
  const win = {
    scrollY: 0,
    innerHeight: 900,
    requestAnimationFrame: (f) => f(),
    addEventListener: (t, f) => { (handlers[t] = handlers[t] || []).push(f); },
  };
  // eslint-disable-next-line no-new-func
  new Function('$', 'window', `${src}; return initGlobalNav;`)($sel, win)();
  const at = (y) => { win.scrollY = y; (handlers.scroll || []).forEach((f) => f()); return cls.has('is-on'); };
  assertEq(at(0), false, '最上部でバーが出ています');
  assertEq(at(819), false, 'ヒーロー内でバーが出ています');
  assertEq(at(821), true, 'ヒーローを通過してもバーが出ません');
  assertEq(at(760), true, '少し戻しただけでバーが消えました（ヒステリシスが効いていない）');
  assertEq(at(700), false, '十分戻してもバーが消えません');
  assert(handlers.scroll && handlers.resize, 'scroll / resize の購読がありません');
});

test('固定ヘッダー分のアンカー余白がある（深リンクがバーに潜らない）', () => {
  assert(/html\{scroll-padding-top:/.test(INDEX),
    'html への scroll-padding-top がありません（#contact 等がヘッダーの下に隠れます）');
});

/* ==========================================================================
   6c. トップページのセクション構成・構造化データ（フェーズ3）
   ========================================================================== */
/** データ側の素の文字列を、生成HTML内での表記に合わせる */
const escText = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/** index.html に入っている JSON-LD をすべてパースしたもの */
const INDEX_LD = [...INDEX.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
  .map((m, i) => {
    try { return JSON.parse(m[1]); } catch (e) { throw new Error(`index.html の ${i + 1} 番目の JSON-LD が壊れています: ${e.message}`); }
  });
/** @graph を展開した全ノード */
const LD_NODES = INDEX_LD.flatMap((n) => (n['@graph'] ? n['@graph'] : [n]));

test('セクションが要件どおりの順序で並んでいる', () => {
  const want = ['hero', 'statement', 'seq', 'fde-cross', 'business',
    'challenges', 'roadmap', 'usecases', 'news', 'about', 'faq', 'contact'];
  const got = [...INDEX.matchAll(/<section id="([a-z0-9-]+)"/g)].map((m) => m[1]);
  assertEq(JSON.stringify(got), JSON.stringify(want), 'セクションの並びが要件と違います');
});

test('グローバルナビのページ内リンク先がすべて存在する', () => {
  const anchors = [...INDEX.matchAll(/<a class="gnav-(?:link|cta)" href="#([a-z0-9-]+)"/g)].map((m) => m[1]);
  assert(anchors.length >= 5, `ナビのページ内リンクが見つかりません（${anchors.length}件）`);
  for (const id of anchors) {
    assert(INDEX.includes(`id="${id}"`), `ナビのリンク先 #${id} がページ内に存在しません`);
  }
  // 3本柱のアンカーは要件で指定された固定 id
  for (const id of ['pillar-construction', 'pillar-creative', 'pillar-lifestyle']) {
    assert(anchors.includes(id), `ナビが #${id} を指していません`);
    assert(INDEX.includes(`id="${id}"`), `#${id} がページ内に存在しません`);
  }
});

test('トップ内のCTAはページを再読込しない（/# ではなく # + data-scroll）', () => {
  const bad = [...INDEX.matchAll(/href="(\/#[a-z0-9-]+)"/g)].map((m) => m[1]);
  assertEq(bad.length, 0,
    `トップに /# リンクが残っています（押すとヒーローの3D・イントロがやり直しになる）: ${bad.join(', ')}`);
  assert(/<a class="btn-roadmap" href="#contact" data-scroll/.test(INDEX),
    'ロードマップCTAがページ内スクロールになっていません');
  // 下層ページでは逆に /#contact のまま（ページ間リンクなので落としてはいけない）
  const sub = injectFile('<div><!-- BEGIN:roadmap --><!-- END:roadmap --></div>', C, 'fde/index.html');
  assertEq(sub.errors.length, 0, `下層ページの生成でエラー: ${sub.errors.join(' / ')}`);
  assert(sub.next.includes('href="/#contact"'), '下層ページで /#contact がページ内アンカーに落ちています');
  assert(!sub.next.includes('data-scroll'), '下層ページのCTAに data-scroll が付いています');
});

/** タグを外し実体参照を戻した index.html の素のテキスト。
 *  見出しは語中改行を防ぐために <span> で割ってあるので、タグ込みの includes では拾えない */
const INDEX_TEXT = INDEX.replace(/<[^>]+>/g, '')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
  .replace(/&#39;/g, "'").replace(/&amp;/g, '&');

test('新セクションの本文が JS 無しで index.html に存在する', () => {
  const need = [
    C.pillars.crossSection.heading,
    ...C.pillars.crossSection.steps.map((s) => s.ja),
    ...C.pillars.pillars.map((p) => p.ja),
    ...C.challenges.items,
    ...C.usecases.items,
    C.usecases.note,
    ...C.roadmap.phases.flatMap((p) => [p.title, ...p.items, ...p.deliverables]),
    ...C.faqTop.items.flatMap((it) => [it.q, it.a]),
    ...C.config.services.flatMap((s) => [s.name, s.description]),
  ];
  for (const t of need) {
    assert(INDEX_TEXT.includes(t), `本文が index.html にありません: ${String(t).slice(0, 34)}…`);
  }
});

test('Service 8件は可視リストと構造化データが揃っている', () => {
  assertEq((INDEX.match(/class="svc-item"/g) || []).length, 8, '可視の提供サービスが8件ではありません');
  const services = LD_NODES.filter((n) => n['@type'] === 'Service');
  assertEq(services.length, 8, 'Service 構造化データが8件ではありません');
  for (const s of services) {
    assert(INDEX.includes(escText(s.name)), `Service "${s.name}" が画面に出ていません`);
    assert(INDEX.includes(escText(s.description)), `Service "${s.name}" の説明が画面に出ていません`);
  }
});

test('WebPage 構造化データが title / meta description と一致する', () => {
  const page = LD_NODES.find((n) => n['@type'] === 'WebPage');
  assert(page, 'WebPage の JSON-LD がありません');
  assertEq(page.name, INDEX.match(/<title>([^<]*)<\/title>/)[1], 'WebPage の name が <title> と違います');
  assertEq(page.description, INDEX.match(/<meta name="description" content="([^"]*)">/)[1],
    'WebPage の description が meta description と違います');
  assertEq(page.url, 'https://cucul-fm.com/', 'WebPage の url が違います');
});

test('トップに必要な構造化データが揃っている', () => {
  for (const t of ['WebSite', 'Organization', 'WebPage', 'Service', 'FAQPage']) {
    assert(LD_NODES.some((n) => n['@type'] === t), `${t} の構造化データがありません`);
  }
  const faq = LD_NODES.find((n) => n['@type'] === 'FAQPage');
  assertEq(faq.mainEntity.length, C.faqTop.items.length, 'FAQPage の設問数が表示と違います');
});

test('index.html の Organization が強化され、未確定情報は入っていない', () => {
  const org = LD_NODES.find((n) => n['@type'] === 'Organization');
  assert(org, 'Organization がありません');
  assertEq(org.email, C.config.company.email, '公開用メールアドレスが違います');
  assert(org.alternateName.includes('CUCUL FM.LLC'), 'alternateName に CUCUL FM.LLC がありません');
  assert(Array.isArray(org.contactPoint) && org.contactPoint.length === 1, 'contactPoint がありません');
  assert(!('foundingDate' in org), '未確定の設立年月日が出力されています');
  assert(!('taxID' in org), '未確定の法人番号が出力されています');
});

test('#about の事業内容に FDE・AI実装支援が入っている', () => {
  const m = INDEX.match(/<dt>事業内容<\/dt><dd>([\s\S]*?)<\/dd>/);
  assert(m, '事業内容の行が見つかりません');
  assert(m[1].includes('FDE・AI実装支援'), '事業内容に FDE・AI実装支援が追記されていません');
});

test('フッターとINDEXオーバーレイに新規ページへの導線がある', () => {
  const foot = INDEX.slice(INDEX.indexOf('<footer class="site-footer">'), INDEX.indexOf('</footer>'));
  const idx = INDEX.slice(INDEX.indexOf('id="index-overlay"'), INDEX.indexOf('<audio id="site-bgm"'));
  for (const href of ['/fde/', '/insights/', '/about/', '/privacy/']) {
    assert(foot.includes(`href="${href}"`), `フッターに ${href} へのリンクがありません`);
    assert(idx.includes(`href="${href}"`), `INDEXオーバーレイに ${href} へのリンクがありません`);
  }
  // 既存の深リンク（下層19ページが依存）は残っている
  for (const href of ['#about', '#contact']) {
    assert(idx.includes(`href="${href}" data-scroll`), `INDEXオーバーレイから ${href} が消えました`);
  }
});

test('ロードマップの折りたたみは JS 無効時に本文を隠さない', () => {
  assertEq((INDEX.match(/<details class="rm-details" open>/g) || []).length, C.roadmap.phases.length,
    'ロードマップの details が全フェーズ open で出力されていません');
  const start = INDEX.indexOf('function initRoadmapFold()');
  assert(start > 0, 'initRoadmapFold が index.html にありません');
  const src = INDEX.slice(start, INDEX.indexOf('function initAnimations()'));
  assert(!/gsap|ScrollTrigger/.test(src), 'initRoadmapFold が GSAP を参照しています');
  assert(INDEX.includes('initRoadmapFold();'), 'initRoadmapFold() が呼ばれていません');
});

test('新セクションの reveal は gsap.from（GSAP が落ちても可視のまま）', () => {
  const triggers = ['#fde-cross', '.fde-steps-in', '.pillar-in', '.biz-scroller', '.svc-in',
    '#challenges', '#roadmap', '#usecases', '#faq'];
  for (const trg of triggers) {
    const re = new RegExp(`gsap\\.from\\([^;]*?trigger: '${trg.replace(/[.#]/g, '\\$&')}'`);
    assert(re.test(INDEX), `${trg} の reveal が gsap.from で登録されていません`);
  }
});

test('新セクションが reduced-motion で即時可視になる', () => {
  const start = INDEX.indexOf("mm.add('(prefers-reduced-motion: reduce)'");
  assert(start > 0, 'reduced-motion の打ち消しブロックがありません');
  const src = INDEX.slice(start, INDEX.indexOf("mm.add('(prefers-reduced-motion: no-preference)'"));
  for (const sel of ['.pillar-card', '.step-card', '.chal-card', '.rm-item',
    '.uc-item', '.faq-item', '.svc-item']) {
    assert(src.includes(`'${sel}'`), `reduced-motion の打ち消しに ${sel} がありません`);
  }
});

test('jsonld-webpage は pages 未定義のページでエラーになる', () => {
  const src = '<div><!-- BEGIN:jsonld-webpage --><!-- END:jsonld-webpage --></div>';
  const r = injectFile(src, C, 'nowhere/index.html');
  assert(r.errors.length > 0, '未定義ページでエラーになりません（空の WebPage を黙って出さない）');
  assertEq(r.next, src, 'エラーなのに内容が書き換えられました');
  const ok = injectFile(src, C, 'index.html');
  assertEq(ok.errors.length, 0, `定義済みページでエラー: ${ok.errors.join(' / ')}`);
});

/* ==========================================================================
   6d. Netlify Forms / プライバシーポリシー / 計測（フェーズ4）
   ========================================================================== */
const PRIVACY = read('privacy/index.html');
const HANDLER = read('contact/form-handler.js');
const ANALYTICS_JS = read('js/analytics.js');
/** 計測マーカーを入れる対象（build-content が走査する公開ページ） */
const PUBLIC_PAGES = (() => {
  const skip = new Set(['.git', '.netlify', '.claude', 'node_modules', '__pycache__',
    'scripts', 'docs', 'note', 'content', 'character-design']);
  const out = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.isDirectory()) { if (!skip.has(e.name)) walk(path.join(dir, e.name)); }
      else if (e.isFile() && e.name.endsWith('.html')) out.push(path.relative(ROOT, path.join(dir, e.name)));
    }
  };
  walk(ROOT);
  return out.sort();
})();

test('フォームが Netlify Forms の検出条件を満たしている', () => {
  const ct = C.config.contact;
  const form = INDEX.match(/<form id="contactForm"[\s\S]*?<\/form>/);
  assert(form, '#contactForm が見つかりません');
  const html = form[0];
  assert(html.includes(`name="${ct.formName}"`), `form の name が config の formName (${ct.formName}) と違います`);
  assert(html.includes('method="POST"'), 'method="POST" がありません');
  assert(html.includes('data-netlify="true"'), 'data-netlify="true" がありません（Netlify がフォームを検出できません）');
  assert(html.includes(`netlify-honeypot="${ct.honeypot}"`), `netlify-honeypot が config の honeypot (${ct.honeypot}) と違います`);
  assert(html.includes(`<input type="hidden" name="form-name" value="${ct.formName}">`),
    'hidden の form-name がありません（JS 送信では必須）');
  assert(new RegExp(`name="${ct.honeypot}"`).test(html), `honeypot の入力欄 (${ct.honeypot}) がありません`);
  // mailto 方式の名残が残っていないこと
  assert(!/mailto:[^"]*gmail/.test(INDEX + HANDLER), '旧 mailto 宛先（gmail）が残っています');
  assert(!HANDLER.includes('cuculinfo0113'), 'form-handler.js に旧アドレスが残っています');
});

test('フォーム項目が要件の9つ・config と一致する', () => {
  const form = INDEX.match(/<form id="contactForm"[\s\S]*?<\/form>/)[0];
  const want = C.config.contact.fields;
  assertEq(want.length, 9, 'フォーム項目が9つではありません');
  for (const f of want) {
    assert(form.includes(`name="${f.name}"`), `入力欄 ${f.name} がありません`);
    assert(form.includes(`id="err-${f.name}"`), `${f.name} のエラー表示欄がありません`);
    // ラベル文字列は要件の項目名そのまま（タグを外して照合する）
    const text = form.replace(/<[^>]+>/g, '');
    assert(text.includes(f.label), `ラベル「${f.label}」が画面に出ていません`);
  }
  // 必須項目は HTML 側にも required を残す（JS 無効時はブラウザが検証する）
  for (const f of want.filter((x) => x.required)) {
    const re = new RegExp(`(id|name)="${f.name}"[^>]*required`);
    assert(re.test(form), `${f.name} に required がありません（JS 無効時に検証されません）`);
  }
  assert(/<select id="subject"[\s\S]*?<\/select>/.test(form), 'ご相談の種類が select になっていません');
  const opts = form.match(/<select id="subject"[\s\S]*?<\/select>/)[0].match(/<option/g) || [];
  assertEq(opts.length, C.config.contact.subjects.length + 1, '選択肢の数が違います（プレースホルダー込み）');
});

test('同意チェックから /privacy/ へリンクしている', () => {
  const form = INDEX.match(/<form id="contactForm"[\s\S]*?<\/form>/)[0];
  assert(/<input type="checkbox" id="privacy"[^>]*required/.test(form), '同意チェックが必須になっていません');
  assert(form.includes('<a href="/privacy/">個人情報保護方針</a>'), '同意欄から /privacy/ へのリンクがありません');
  assert(fs.existsSync(path.join(ROOT, 'privacy/index.html')), '/privacy/ のページがありません');
});

test('form-handler.js が alert を使わずインライン表示する', () => {
  assert(!/\balert\s*\(/.test(HANDLER), 'alert が残っています（インライン表示にすること）');
  assert(HANDLER.includes('noValidate'), 'JS 有効時にブラウザ標準の検証を止めていません');
  assert(/fetch\(/.test(HANDLER), 'fetch で送信していません');
  assert(HANDLER.includes('application/x-www-form-urlencoded'), '送信の Content-Type が要件と違います');
  assert(/button\.disabled\s*=\s*true/.test(HANDLER), '送信中にボタンを無効化していません');
  for (const ev of ['contact_form_submit', 'contact_form_success']) {
    assert(HANDLER.includes(ev), `${ev} を送出していません`);
  }
});

test('画面に出す文言は site.config.json 由来（form-handler に直書きしない）', () => {
  const cfgBlock = INDEX.match(/<script type="application\/json" id="contact-config">([\s\S]*?)<\/script>/);
  assert(cfgBlock, 'contact-config の JSON がありません');
  const parsed = JSON.parse(cfgBlock[1]);
  assertEq(parsed.formName, C.config.contact.formName, 'formName が config と違います');
  assertEq(parsed.honeypot, C.config.contact.honeypot, 'honeypot が config と違います');
  assertEq(JSON.stringify(parsed.messages), JSON.stringify(C.config.contact.errors), '文言が config と違います');
  // 失敗時メッセージは電話番号を含むので、config 側の番号と食い違っていないこと
  assert(parsed.messages.failure.includes(C.config.company.tel),
    '失敗メッセージの電話番号が config と一致しません');
});

test('計測イベントが要件の一覧をすべて実装している', () => {
  const want = ['contact_form_view', 'contact_form_start', 'contact_form_submit', 'contact_form_success',
    'click_phone', 'click_email', 'click_consultation_cta', 'click_fde_service', 'click_roadmap',
    'scroll_depth_50', 'scroll_depth_90'];
  const src = ANALYTICS_JS + HANDLER + INDEX;
  for (const ev of want) assert(src.includes(ev), `計測イベント ${ev} の実装が見当たりません`);
  // data-ga-event で送るイベントは、実際にその属性を持つ要素がトップにあること
  for (const ev of ['click_consultation_cta', 'click_fde_service', 'click_roadmap', 'click_phone']) {
    assert(INDEX.includes(`data-ga-event="${ev}"`), `${ev} を発火する要素がトップにありません`);
  }
  assert(ANALYTICS_JS.includes('IntersectionObserver'), 'contact_form_view が IntersectionObserver で実装されていません');
});

test('計測タグが全公開ページに入っている', () => {
  const missing = PUBLIC_PAGES.filter((rel) => !read(rel).includes('<!-- BEGIN:analytics -->'));
  assert(missing.length === 0, `計測マーカーが無いページ: ${missing.join(', ')}`);
  assert(PUBLIC_PAGES.length >= 45, `公開ページの数が想定より少ないです: ${PUBLIC_PAGES.length}`);
  // GTM ID が空のうちは GTM を読み込まない
  // （gtag.js も googletagmanager.com から配信されるので、ドメイン名では区別できない。
  //   GTM は gtm.js、GA4 直結は gtag/js で見分ける）
  const rendered = resolveRenderer('analytics').render(C, { file: 'index.html' }).join('\n');
  if (!C.config.analytics.gtmId) {
    assert(!rendered.includes('gtm.js'), 'GTM ID が空なのに GTM を読み込んでいます');
  }
  assert(rendered.includes('/js/analytics.js'), 'analytics.js を読み込んでいません');
  if (!C.config.analytics.ga4MeasurementId) {
    assert(!rendered.includes('gtag/js'), '測定ID が空なのに gtag.js を読み込んでいます');
  }
});

/** analytics マーカーを、指定した計測IDで描いた結果 */
const renderAnalyticsWith = (ids) => {
  const c = structuredClone(C);
  Object.assign(c.config.analytics, ids);
  return { html: resolveRenderer('analytics').render(c, { file: 'index.html' }).join('\n'), c };
};

test('GA4 の測定IDだけで gtag.js が入り、GTM は要らない', () => {
  const { html } = renderAnalyticsWith({ gtmId: '', ga4MeasurementId: 'G-ABCD123456' });
  assert(html.includes('googletagmanager.com/gtag/js?id=G-ABCD123456'), 'gtag.js が出力されていません');
  assert(html.includes("gtag('config','G-ABCD123456')"), 'GA4 の config が出力されていません');
  assert(!html.includes('gtm.js'), 'GTM を使わない構成なのに GTM が出力されています');
  assert(html.includes('CUCULFM.directGa4=true'),
    'directGa4 フラグが立っていません（analytics.js が GA4 へ直接送れません）');
});

test('GTM の ID だけなら GTM を読み、gtag.js は出さない', () => {
  const { html } = renderAnalyticsWith({ gtmId: 'GTM-ABC1234', ga4MeasurementId: '' });
  assert(html.includes('googletagmanager.com/gtm.js'), 'GTM が出力されていません');
  assert(html.includes('GTM-ABC1234'), 'GTM ID が反映されていません');
  assert(!html.includes('gtag/js'), 'GTM 構成なのに gtag.js も出力されています');
  assert(!html.includes('directGa4'),
    'GTM 構成で directGa4 が立っています（GTM のトリガーと二重に計上されます）');
});

test('両方入っていたら GTM を優先し、二重計測にならない', () => {
  const { html, c } = renderAnalyticsWith({ gtmId: 'GTM-ABC1234', ga4MeasurementId: 'G-ABCD123456' });
  assert(html.includes('gtm.js'), 'GTM が出力されていません');
  assert(!html.includes('gtag/js'), '両方設定時に gtag.js も出力されています（二重計測）');
  assert(!html.includes('directGa4'), '両方設定時に directGa4 が立っています（二重計測）');
  assert(validate(c).warnings.some((w) => w.includes('二重計測')), '両方設定時の警告が出ていません');
});

test('不正な計測IDは素通ししない（生成タグへ直接埋め込むため）', () => {
  for (const [key, value] of [['gtmId', "x';alert(1)//"], ['ga4MeasurementId', "G-x';alert(1)//"],
    ['ga4MeasurementId', 'UA-12345-1']]) {
    const bad = structuredClone(C);
    bad.config.analytics = { gtmId: '', ga4MeasurementId: '', googleSiteVerification: '' };
    bad.config.analytics[key] = value;
    assert(validate(bad).errors.some((e) => e.includes(key)),
      `不正な ${key} (${value}) がエラーになりません`);
  }
});

test('analytics.js の gtag 送信は directGa4 で守られている', () => {
  assert(ANALYTICS_JS.includes('window.CUCULFM.directGa4'),
    'analytics.js が directGa4 を見ていません');
  // ガード無しの gtag 呼び出しが無いこと（GTM 運用時の二重計上を防ぐ）
  const calls = [...ANALYTICS_JS.matchAll(/window\.gtag\(/g)];
  assertEq(calls.length, 1, 'gtag の呼び出し箇所が1つではありません');
  const guard = ANALYTICS_JS.indexOf('window.CUCULFM.directGa4');
  assert(guard >= 0 && guard < calls[0].index, 'gtag 呼び出しが directGa4 のガードより前にあります');
});

test('_redirects が社内向けファイルを配信しない', () => {
  const rd = read('_redirects');
  for (const p of ['/docs/*', '/content/*', '/scripts/*', '/CLAUDE.md', '/AGENTS.md']) {
    // 末尾の `!`（force）が無いと、実在するファイルにはルールが適用されない
    // （Netlify の shadowing）。`!` 無しでデプロイして全パス 200 のままだった実績あり
    const re = new RegExp(`^${p.replace(/[*./]/g, '\\$&')}\\s+\\S+\\s+404!`, 'm');
    assert(re.test(rd), `${p} を 404! にする行がありません（force の ! が無いと効きません）`);
  }
  assert(!/\s404\s*$/m.test(rd), '404 に force の ! が付いていない行があります');
  // ルート直下の .md は社内向け。増えたら塞ぎ忘れないよう、ここで検査する
  for (const f of fs.readdirSync(ROOT).filter((n) => n.endsWith('.md'))) {
    assert(new RegExp(`^/${f.replace(/[.]/g, '\\$&')}\\s`, 'm').test(rd),
      `ルート直下の ${f} を 404! にする行がありません`);
    assert(!/[^\x20-\x7e]/.test(f),
      `${f} は日本語などの非ASCII名です。_redirects で塞げないので docs/ へ移動してください`);
  }
  // 3Dキャラのモデルを巻き添えにしていないこと
  assert(!/^\/character-design\/\*/m.test(rd),
    '/character-design/* を丸ごと塞いでいます（トップの3Dキャラ model.glb が読めなくなります）');
  assert(fs.existsSync(path.join(ROOT, 'character-design/phantom-dj/model.glb')),
    'model.glb の場所が変わっています。_redirects の除外範囲を見直してください');
  // サイトが実行時に参照しているパスを塞いでいないこと
  for (const live of ['/js/analytics.js', '/contact/form-handler.js', '/services/style.css']) {
    assert(!rd.includes(live), `${live} は実際に配信が必要なので塞いではいけません`);
  }
});

test('/privacy/ が要件の項目を満たしている', () => {
  const text = PRIVACY.replace(/<[^>]+>/g, '');
  for (const need of ['利用目的', '第三者', 'Cookie', 'Google アナリティクス', 'お問い合わせ窓口', '開示']) {
    assert(text.includes(need), `プライバシーポリシーに「${need}」の記載がありません`);
  }
  assert(text.includes(C.config.company.legalName), '事業者名が出ていません');
  assert(text.includes(C.config.company.email), '問い合わせ用メールアドレスが出ていません');
  // mailto の href とテキストが食い違わないこと
  const mailtos = [...PRIVACY.matchAll(/href="mailto:([^"]+)"/g)].map((m) => m[1]);
  assert(mailtos.length > 0, 'mailto リンクがありません');
  for (const m of mailtos) assertEq(m, C.config.company.email, 'mailto の宛先が config と違います');
  assertEq((PRIVACY.match(/<h1/g) || []).length, 1, 'H1 が1つではありません');
  assert(PRIVACY.includes('rel="canonical" href="https://cucul-fm.com/privacy/"'), 'canonical がありません');
  assert(PRIVACY.includes('og:title'), 'OGP がありません');
});

test('/privacy/ のパンくずが表示と構造化データで一致する', () => {
  const nav = PRIVACY.match(/<nav class="breadcrumb"[\s\S]*?<\/nav>/);
  assert(nav, '表示用のパンくずがありません');
  const shown = [...nav[0].matchAll(/<li>(?:<a [^>]*>|<span [^>]*>)([^<]+)</g)].map((m) => m[1]);
  const blocks = [...PRIVACY.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
    .map((m) => JSON.parse(m[1]));
  const ld = blocks.find((n) => n['@type'] === 'BreadcrumbList');
  assert(ld, 'BreadcrumbList の JSON-LD がありません');
  assertEq(JSON.stringify(shown), JSON.stringify(ld.itemListElement.map((i) => i.name)),
    'パンくずの表示と BreadcrumbList が一致しません');
  assertEq(ld.itemListElement[ld.itemListElement.length - 1].item, 'https://cucul-fm.com/privacy/',
    'BreadcrumbList の末尾がページ自身の URL ではありません');
  const page = blocks.find((n) => n['@type'] === 'WebPage');
  assert(page, 'WebPage の JSON-LD がありません');
  assertEq(page.name, PRIVACY.match(/<title>([^<]*)<\/title>/)[1], 'WebPage の name が <title> と違います');
});

test('BreadcrumbList だけを置いて表示用が無いページはエラーになる', () => {
  const only = '<div><!-- BEGIN:jsonld-breadcrumb --><!-- END:jsonld-breadcrumb --></div>';
  const r = injectFile(only, C, 'privacy/index.html');
  assert(r.errors.length > 0, '表示用パンくずが無いのにエラーになりません');
  const noBc = '<div><!-- BEGIN:breadcrumb --><!-- END:breadcrumb --></div>';
  const r2 = injectFile(noBc, C, 'index.html');
  assert(r2.errors.length > 0, 'breadcrumb 定義の無いページでエラーになりません');
});

test('form-handler.js と analytics.js が外部ライブラリに依存していない', () => {
  for (const [name, src] of [['form-handler.js', HANDLER], ['analytics.js', ANALYTICS_JS]]) {
    assert(!/\bimport\s|\brequire\s*\(/.test(src), `${name} が外部モジュールを読み込んでいます`);
    assert(!/\$\(|jQuery/.test(src), `${name} が jQuery を使っています`);
  }
});

/* ==========================================================================
   6e. /fde/ ・/about/（フェーズ5）と /insights/（フェーズ6）で共通に見るもの
   ========================================================================== */
const FDE = read('fde/index.html');
const ABOUT = read('about/index.html');
const INSIGHTS = read('insights/index.html');
/** [相対パス, HTML, insights.json の記事] */
const ARTICLES = C.insights.articles.map((a) => [articleKey(a.slug), read(articleKey(a.slug)), a]);
/** ページのテキスト（タグを外し、実体参照を戻したもの） */
const textOf = (html) => html.replace(/<[^>]+>/g, ' ')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
  .replace(/&#39;/g, "'").replace(/&amp;/g, '&');
/** ページ内の JSON-LD をすべて parse して返す */
const ldOf = (html) => [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
  .map((m) => JSON.parse(m[1]));

/** フェーズ5・6でつくったページ。meta・リンク・計測は同じ基準で見る */
const NEW_PAGES = [
  ['fde/index.html', FDE], ['about/index.html', ABOUT], ['insights/index.html', INSIGHTS],
  ...ARTICLES.map(([rel, html]) => [rel, html]),
];
/** そのうち WebPage 系の構造化データを持つページ（記事は Article なので別で見る） */
const WEBPAGE_PAGES = [['fde/index.html', FDE], ['about/index.html', ABOUT], ['insights/index.html', INSIGHTS]];

for (const [rel, html] of NEW_PAGES) {
  test(`${rel} の title / description / canonical が site.config.json と一致する`, () => {
    const p = C.config.pages[rel];
    assert(p, `site.config.json の pages に ${rel} がありません`);
    assertEq(html.match(/<title>([^<]*)<\/title>/)[1], p.name, '<title> が pages.name と違います');
    assertEq(html.match(/<meta name="description" content="([^"]*)">/)[1], p.description,
      'meta description が pages.description と違います');
    assert(html.includes(`rel="canonical" href="https://cucul-fm.com${p.path}"`), 'canonical がありません');
    assertEq((html.match(/<h1/g) || []).length, 1, 'H1 が1つではありません');
    // OGP / Twitter Card も同じ文言（SNS 表示と画面がずれない）
    for (const [attr, key, want] of [['property', 'og:title', p.name], ['property', 'og:description', p.description],
      ['property', 'og:url', `https://cucul-fm.com${p.path}`],
      ['name', 'twitter:title', p.name], ['name', 'twitter:description', p.description]]) {
      const re = new RegExp(`<meta ${attr}="${key}" content="([^"]*)">`);
      const m = html.match(re);
      assert(m, `${key} がありません`);
      assertEq(m[1], want, `${key} が config と違います`);
    }
  });

  test(`${rel} のパンくずが表示と BreadcrumbList で一致する`, () => {
    const p = C.config.pages[rel];
    const nav = html.match(/<nav class="breadcrumb"[\s\S]*?<\/nav>/);
    assert(nav, '表示用のパンくずがありません');
    const shown = [...nav[0].matchAll(/<li>(?:<a [^>]*>|<span [^>]*>)([^<]+)</g)].map((m) => m[1]);
    const bc = ldOf(html).find((n) => n['@type'] === 'BreadcrumbList');
    assert(bc, 'BreadcrumbList がありません');
    assertEq(JSON.stringify(shown), JSON.stringify(bc.itemListElement.map((i) => i.name)),
      'パンくずの表示と BreadcrumbList が一致しません');
    assertEq(bc.itemListElement[bc.itemListElement.length - 1].item, `https://cucul-fm.com${p.path}`,
      'BreadcrumbList の末尾がページ自身の URL ではありません');
  });

  test(`${rel} の内部リンク先がすべて存在する`, () => {
    const planned = new Set(['/insights/']);
    const hrefs = [...html.matchAll(/href="(\/[^"#]*)(?:#[^"]*)?"/g)].map((m) => m[1]);
    const missing = hrefs.filter((h) => {
      if (planned.has(h) || h === '/') return false;
      return !fs.existsSync(path.join(ROOT, h.replace(/^\//, ''), 'index.html'))
        && !fs.existsSync(path.join(ROOT, h.replace(/^\//, '')));
    });
    assert(missing.length === 0, `存在しないリンク先: ${[...new Set(missing)].join(', ')}`);
  });

  test(`${rel} に計測タグと「相談する」導線がある`, () => {
    assert(html.includes('<!-- BEGIN:analytics -->'), '計測マーカーがありません');
    assert(html.includes('data-ga-event="click_consultation_cta"'), '相談CTAの計測がありません');
    assert(html.includes('data-ga-event="click_phone"'), '電話クリックの計測がありません');
    assert(html.includes('data-ga-event="click_email"'), 'メールクリックの計測がありません');
    // 電話・メールは config と一致（表示文字列も href も）
    for (const m of [...html.matchAll(/href="mailto:([^"]+)"/g)]) {
      assertEq(m[1], C.config.company.email, 'mailto の宛先が config と違います');
    }
    for (const m of [...html.matchAll(/href="(tel:[^"]+)"/g)]) {
      assertEq(m[1], C.config.company.telHref, 'tel: の番号が config と違います');
    }
  });
}

for (const [rel, html] of WEBPAGE_PAGES) {
  test(`${rel} の WebPage 構造化データが title と一致する`, () => {
    const p = C.config.pages[rel];
    const page = ldOf(html).find((n) => n['@type'] === (p.type || 'WebPage'));
    assert(page, `${p.type || 'WebPage'} の JSON-LD がありません`);
    assertEq(page.name, p.name, 'WebPage の name が pages.name と違います');
    assertEq(page.name, html.match(/<title>([^<]*)<\/title>/)[1], 'WebPage の name が <title> と違います');
  });
}

test('/fde/ が要件の構成要素をすべて含んでいる', () => {
  const text = textOf(FDE);
  const m = C.config.messaging;
  // 1. メインコピー（H1）とサブコピー
  assert(FDE.includes(`<h1 class="fde-main">${m.fdeMain}</h1>`), 'H1 がメインコピーと一致しません');
  for (const line of m.fdeSub.flat()) assert(text.includes(line), `サブコピーの行が欠けています: ${line}`);
  // 2. 思想ブロック
  assert(text.includes(m.philosophy.title), '思想ブロックの見出しがありません');
  for (const line of m.philosophy.body.flat()) assert(text.includes(line), `思想ブロックの本文が欠けています: ${line}`);
  // 3. 立ち位置（「〜ではない」4つ + 平易な言い換え）
  for (const not of ['AIツール販売会社', 'Web制作会社', '受託開発会社', 'ITコンサルティング会社']) {
    assert(text.includes(`単なる${not}`), `立ち位置の対比に「単なる${not}」がありません`);
  }
  assert(text.includes('現場伴走型のAI・DX実装支援'), '平易な言い換えが前面に出ていません');
  // 4. 対象業種（要件の11業種）
  for (const ind of ['下水道', '建設', '設備', '保守点検', '清掃', '物流', '製造',
    '不動産・施設管理', 'クリエイティブ事業', '地域事業', 'サービス業']) {
    assert(text.includes(ind), `対象業種に「${ind}」がありません`);
  }
  // 5. 3ステップ詳細
  for (const s of C.pillars.crossSection.steps) {
    assert(text.includes(s.ja), `ステップ「${s.ja}」がありません`);
    for (const d of s.detail) assert(text.includes(d), `ステップ詳細が欠けています: ${d}`);
  }
  // 6. ロードマップ（4フェーズの施策・成果物がJS無しで読める）
  assert(FDE.includes('<details class="rm-details" open>'), 'ロードマップの details が open ではありません');
  for (const p of C.roadmap.phases) {
    for (const item of p.items) assert(text.includes(item), `ロードマップの施策が欠けています: ${item}`);
    for (const d of p.deliverables) assert(text.includes(d), `ロードマップの成果物が欠けています: ${d}`);
  }
  // 7. 活用テーマ（実績ではない注記つき）
  assert(text.includes(C.usecases.note), '活用イメージである旨の注記がありません');
  for (const item of C.usecases.items) assert(text.includes(item), `活用テーマが欠けています: ${item}`);
  // 8. AI・データの取扱い方針
  for (const need of ['AIに入力してよい情報', '扱うべきでない情報', '人による確認・承認',
    'お客様のデータの取扱い', 'セキュリティ']) {
    assert(text.includes(need), `AI・データの取扱い方針に「${need}」がありません`);
  }
  // 9. FAQ（faq-fde の全問）
  for (const it of C.faqFde.items) assert(text.includes(it.q), `FAQ の設問が欠けています: ${it.q}`);
  // 10. CTA・公開日・監修者
  assert(text.includes(C.config.contact.heading), '問い合わせの見出しがありません');
  assert(/公開日/.test(text) && /最終更新日/.test(text), '公開日・最終更新日の表記がありません');
  assert(text.includes(`監修`) && text.includes(C.config.company.representative), '監修者の表記がありません');
});

test('/fde/ の Service 構造化データが可視ブロックと一致する', () => {
  const svc = ldOf(FDE).find((n) => n['@type'] === 'Service');
  assert(svc, 'Service の JSON-LD がありません');
  const fde = C.config.services.find((s) => s.id === 'fde');
  assertEq(svc.name, fde.name, 'Service の name が config と違います');
  assertEq(svc.url, `https://cucul-fm.com${fde.url}`, 'Service の url が違います');
  // トップの Service 8件と同じ @id（同じサービスを2つの実体に分けない）
  assertEq(svc['@id'], 'https://cucul-fm.com/#service-fde', 'Service の @id がトップと揃っていません');
  // 構造化データの各値が、画面にも同じ文字列で出ていること
  const text = textOf(FDE);
  for (const v of [svc.name, svc.description, svc.areaServed, C.config.company.legalName]) {
    assert(text.includes(v), `Service の値が画面に出ていません: ${v}`);
  }
  assertEq(svc.provider['@id'], 'https://cucul-fm.com/#organization', 'provider が Organization を指していません');
});

test('/fde/ の3ステップ詳細は自ページへのCTAを持たない', () => {
  const html = resolveRenderer('fde-steps-detail').render(C).join('\n');
  assert(!html.includes('href="/fde/"'), '/fde/ の中に /fde/ へのCTAが入っています');
  assert(!html.includes('btn-fde'), 'トップ用のCTAが混ざっています');
  for (const s of C.pillars.crossSection.steps) {
    for (const d of s.detail) assert(html.includes(d), `detail が出力されていません: ${d}`);
  }
  assert(html.includes(C.pillars.crossSection.detailLabel), 'detail の見出しが出力されていません');
});

test('/about/ が要件の掲載項目を満たしている', () => {
  const text = textOf(ABOUT);
  const co = C.config.company;
  for (const v of [co.legalName, co.alternateName, co.representative, co.tel, co.email,
    co.serviceArea, co.representativeBio, co.address.postalCode, co.address.streetAddress]) {
    assert(text.includes(v), `会社情報が出ていません: ${v}`);
  }
  // 未確定情報は会社情報テーブルに空の行として出さない
  // （「確定したら掲載します」という注記の中に語が出るのは可）
  const spec = ABOUT.match(/<dl class="spec-table">[\s\S]*?<\/dl>/);
  assert(spec, '会社情報テーブルがありません');
  for (const pending of ['法人番号', '設立年月日']) {
    assert(!spec[0].includes(pending), `未確定の${pending}の行が出ています`);
  }
  // ミッション・大切にする考え方
  assert(text.includes(C.config.messaging.existingTagline), 'ミッション（既存タグライン）がありません');
  for (const v of ['多様性と融合', '顧客中心主義', 'イノベーションとDX推進', '実現志向']) {
    assert(text.includes(v), `大切にしている考え方に「${v}」がありません`);
  }
  // 3本柱とFDEの関係
  for (const p of C.pillars.pillars) {
    assert(text.includes(p.ja), `3本柱「${p.ja}」がありません`);
    for (const line of p.fdeNote) assert(text.includes(line), `FDEとのつながりの補足が欠けています: ${line}`);
  }
  assert(text.includes(C.pillars.fdeNoteLabel), 'FDEとのつながりのラベルがありません');
  // 事業内容（Service 8件の可視リスト）
  for (const s of C.config.services) assert(text.includes(s.name), `事業内容に「${s.name}」がありません`);
  // 体制・問い合わせ方法・プライバシーポリシー
  assert(text.includes('体制'), 'FDE・AI実装支援の体制の記載がありません');
  assert(ABOUT.includes('href="/privacy/"'), 'プライバシーポリシーへのリンクがありません');
  assert(ABOUT.includes('href="/fde/"'), '/fde/ への内部リンクがありません');
});

test('/about/ に AboutPage と Organization の構造化データがある', () => {
  const blocks = ldOf(ABOUT);
  assert(blocks.some((n) => n['@type'] === 'AboutPage'), 'AboutPage がありません');
  const graph = blocks.find((n) => Array.isArray(n['@graph']));
  assert(graph, 'Organization の @graph がありません');
  const org = graph['@graph'].find((n) => n['@type'] === 'Organization');
  assert(org, 'Organization ノードがありません');
  assertEq(org['@id'], 'https://cucul-fm.com/#organization', 'Organization の @id がトップと揃っていません');
  assert(!('foundingDate' in org) && !('taxID' in org), '未確定情報が構造化データに入っています');
  // sameAs は画面のリンクとも一致させる（表示していない情報を構造化データに書かない）
  for (const u of org.sameAs) assert(ABOUT.includes(u), `sameAs のリンクが画面にありません: ${u}`);
});

test('WebPage の type は許可した下位型だけ通る', () => {
  const c = structuredClone(C);
  c.config.pages['about/index.html'].type = 'AboutPage';
  const ok = resolveRenderer('jsonld-webpage').render(c, { file: 'about/index.html' }).join('\n');
  assert(ok.includes('"@type": "AboutPage"'), 'AboutPage が出力されません');
  c.config.pages['about/index.html'].type = 'NotAType';
  const bad = injectFile('<!-- BEGIN:jsonld-webpage --><!-- END:jsonld-webpage -->', c, 'about/index.html');
  assert(bad.errors.length > 0, '未知の type がエラーになりません');
});

test('新規ページの手書き本文に架空の実績・断定表現が入っていない', () => {
  // content/*.json は validate が見ているが、HTML に直接書いた本文は素通りするのでここで見る
  const banned = [...BANNED, '導入社数', '削減率', '導入実績', '顧客ロゴ', 'CUCUL FM .LLC'];
  const hits = [];
  for (const [rel, html] of [['fde/index.html', FDE], ['about/index.html', ABOUT]]) {
    const text = textOf(html);
    for (const w of banned) if (text.includes(w)) hits.push(`${w} @ ${rel}`);
  }
  assert(hits.length === 0, `禁止表現: ${hits.join(', ')}`);
});

test('Service の JSON-LD だけを置いて可視ブロックが無いページはエラーになる', () => {
  const only = '<div><!-- BEGIN:jsonld-service-fde --><!-- END:jsonld-service-fde --></div>';
  const r = injectFile(only, C, 'fde/index.html');
  assert(r.errors.length > 0, '可視の service-fde が無いのにエラーになりません');
});

/* ==========================================================================
   6f. /insights/ 一覧と記事（フェーズ6）
   ========================================================================== */
test('要件で指定された記事8本が揃っている', () => {
  const got = C.insights.articles.map((a) => a.slug);
  // ブリーフ「3. 実装計画」の /insights/ に挙がっている8本。
  // 前半4本がフェーズ6、後半4本がフェーズ7で追加された
  for (const s of ['fde-toha', 'genba-dx', 'ai-teichaku', 'gyomu-flow',
    'saas-vs-custom', 'ai-usecases', 'data-foundation', 'dx-roadmap']) {
    assert(got.includes(s), `記事 ${s} がありません`);
  }
  // 確定事項4: スラッグは SaaS の表記に合わせて saas-vs-custom にする
  assert(!got.includes('sas-vs-custom'), 'スラッグは saas-vs-custom に修正して実装する決まりです');
});

test('insights.json の記事とページの実体が一致する', () => {
  for (const a of C.insights.articles) {
    assert(fs.existsSync(path.join(ROOT, articleKey(a.slug))), `${a.slug} のページがありません`);
  }
  const dirs = fs.readdirSync(path.join(ROOT, 'insights'), { withFileTypes: true })
    .filter((e) => e.isDirectory()).map((e) => e.name).sort();
  assertEq(dirs.join(','), C.insights.articles.map((a) => a.slug).sort().join(','),
    'insights/ のディレクトリと insights.json の記事が一致しません（載っていない記事・実体の無い記事）');
});

test('一覧ページに全記事が載っている', () => {
  const text = textOf(INSIGHTS);
  for (const a of C.insights.articles) {
    assert(INSIGHTS.includes(`href="/insights/${a.slug}/"`), `一覧に ${a.slug} へのリンクがありません`);
    assert(text.includes(a.title), `一覧に「${a.title}」が出ていません`);
    assert(text.includes(a.excerpt), `一覧に ${a.slug} の要約が出ていません`);
    assert(text.includes(a.category), `一覧に ${a.slug} のカテゴリが出ていません`);
  }
});

for (const [rel, html, a] of ARTICLES) {
  test(`${rel} の Article 構造化データが表示と一致する`, () => {
    const ld = ldOf(html).find((n) => n['@type'] === 'Article');
    assert(ld, 'Article の JSON-LD がありません');
    assertEq(ld.headline, a.title, 'headline が insights.json と違います');
    assertEq(ld.description, a.description, 'description が insights.json と違います');
    assertEq(ld.datePublished, a.datePublished, 'datePublished が違います');
    assertEq(ld.dateModified, a.dateModified, 'dateModified が違います');
    assertEq(ld.mainEntityOfPage, `https://cucul-fm.com/insights/${a.slug}/`, 'mainEntityOfPage が違います');
    assertEq(ld.publisher['@id'], 'https://cucul-fm.com/#organization', 'publisher が Organization を指していません');
    // 画面にも同じ値が出ていること（表示していない情報を構造化データに書かない）
    const text = textOf(html);
    assert(text.includes(a.title), 'H1 に記事タイトルが出ていません');
    assert(text.includes(ld.author.name), '執筆者が画面に出ていません');
    assert(text.includes(ld.contributor.name), '監修者が画面に出ていません');
    assert(text.includes(ld.articleSection), 'カテゴリが画面に出ていません');
    // 日付は表示用の和暦表記でも同じ日を指していること
    const [y, mo, d] = a.datePublished.split('-').map(Number);
    assert(text.includes(`${y}年${mo}月${d}日`), '公開日が画面に出ていません');
    assert(html.includes(`<time datetime="${a.datePublished}">`), 'time 要素の datetime がありません');
  });

  test(`${rel} が記事の品質基準を満たしている`, () => {
    // H1 直下に結論、FAQ小節、CTA、関連記事、目次
    assert(html.includes(`<h1 class="post-title">${a.title}</h1>`), 'H1 が記事タイトルと一致しません');
    assert(/<p class="post-lead">/.test(html), 'H1 直下の結論（リード）がありません');
    assertEq((html.match(/<h2 id="faq">/g) || []).length, 1, 'FAQ小節がありません');
    assert((html.match(/<div class="qa">/g) || []).length >= 3, 'FAQ が3問未満です');
    assert(/<nav class="post-toc"/.test(html), '目次がありません');
    assert(html.includes('<!-- BEGIN:article-related -->'), '関連記事のマーカーがありません');
    assert(html.includes('href="/fde/"'), '/fde/ への内部リンクがありません');
    assert(html.includes('href="/#contact"'), '問い合わせへの導線がありません');
    // 本文量（要件: 2,000〜3,500字目安）
    const body = html.match(/<div class="post-body">([\s\S]*?)<\/div>\s*<!-- BEGIN:article-related/);
    assert(body, '本文（post-body）が見つかりません');
    const lead = html.match(/<p class="post-lead">([\s\S]*?)<\/p>/)[1];
    const chars = (lead + body[1]).replace(/<[^>]+>/g, ' ').replace(/\s+/g, '').length;
    assert(chars >= 2000 && chars <= 3500, `本文が2,000〜3,500字の目安から外れています: ${chars}字`);
    // 見出し構造（H1は1つ、H2で本論を組む）
    assertEq((html.match(/<h1/g) || []).length, 1, 'H1 が1つではありません');
    assert((html.match(/<h2 /g) || []).length >= 4, 'H2 の本論が4つ未満です');
  });

  test(`${rel} の目次リンクと見出しの id が一致する`, () => {
    const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
    const toc = [...html.matchAll(/<li><a href="#([^"]+)">/g)].map((m) => m[1]);
    assert(toc.length >= 5, `目次の項目が少なすぎます: ${toc.length}`);
    const missing = toc.filter((t) => !ids.includes(t));
    assert(missing.length === 0, `目次のリンク先が無い: ${missing.join(', ')}`);
    // 見出し側に目次から辿れない H2 が残っていないか（追記したのに目次に足し忘れた場合）
    const h2ids = [...html.matchAll(/<h2 id="([^"]+)"/g)].map((m) => m[1]);
    const orphan = h2ids.filter((h) => !toc.includes(h));
    assert(orphan.length === 0, `目次に載っていない H2: ${orphan.join(', ')}`);
  });

  test(`${rel} に架空の実績・断定表現が入っていない`, () => {
    const banned = [...BANNED, '導入社数', '削減率', '導入実績', '顧客ロゴ', 'CUCUL FM .LLC'];
    const text = textOf(html);
    const hits = banned.filter((w) => text.includes(w));
    assert(hits.length === 0, `禁止表現: ${hits.join(', ')}`);
  });

  test(`${rel} の関連記事が実在する記事を指している`, () => {
    const links = [...html.matchAll(/<li><a href="\/insights\/([^/]+)\/">/g)].map((m) => m[1]);
    assert(links.length > 0, '関連記事が出力されていません');
    for (const s of links) {
      assert(C.insights.articles.some((x) => x.slug === s), `関連記事に未知のスラッグ: ${s}`);
      assert(s !== a.slug, '関連記事が自分自身を指しています');
    }
  });
}

test('記事ページのクラス名が既存のブログカードと衝突していない', () => {
  // .article-title / .article-date / .article-excerpt は /articles/ や下層ページの
  // カードが使っている。記事ページで同じ名前を使うと、そちらの見た目が変わる
  const shared = ['article-title', 'article-date', 'article-excerpt', 'article-card'];
  for (const [rel, html] of ARTICLES) {
    for (const cls of shared) {
      assert(!new RegExp(`class="[^"]*\\b${cls}\\b`).test(html),
        `${rel} が既存カード用のクラス ${cls} を使っています（post-* を使ってください）`);
    }
  }
  const css = read('services/style.css');
  for (const cls of shared) {
    const defs = (css.match(new RegExp(`\\.${cls}(?![a-zA-Z0-9_-])`, 'g')) || []).length;
    assert(defs > 0, `${cls} の既存定義が見当たりません（このテストの前提が崩れています）`);
  }
});

test('Article の JSON-LD だけを置いて著者・日付の表示が無いページはエラーになる', () => {
  const only = '<div><!-- BEGIN:jsonld-article --><!-- END:jsonld-article --></div>';
  const r = injectFile(only, C, articleKey('fde-toha'));
  assert(r.errors.length > 0, '表示用の article-meta が無いのにエラーになりません');
  // 記事以外のページで記事用マーカーを使ったらエラー
  const wrong = '<div><!-- BEGIN:article-meta --><!-- END:article-meta --></div>';
  assert(injectFile(wrong, C, 'index.html').errors.length > 0, '記事以外のページでエラーになりません');
});

test('記事メタデータの不備を validate が止める', () => {
  const bad = (mut) => { const c = structuredClone(C); mut(c); return validate(c).errors; };
  assert(bad((c) => { c.insights.articles[0].datePublished = '2026/08/29'; })
    .some((e) => e.includes('datePublished')), '日付形式の誤りが検出されません');
  assert(bad((c) => { c.insights.articles[0].slug = 'Bad_Slug'; })
    .some((e) => e.includes('slug')), 'スラッグの誤りが検出されません');
  assert(bad((c) => { c.insights.articles[0].related = ['no-such-article']; })
    .some((e) => e.includes('related')), '未知の関連記事が検出されません');
  assert(bad((c) => { c.insights.articles[0].dateModified = '2020-01-01'; })
    .some((e) => e.includes('dateModified')), '更新日が公開日より前でも通ってしまいます');
});

test('記事ページの pages 定義が insights.json から自動で作られる', () => {
  for (const a of C.insights.articles) {
    const p = C.config.pages[articleKey(a.slug)];
    assert(p, `${a.slug} の pages 定義が作られていません`);
    assertEq(p.name, `${a.title} | ${C.config.site.titleSuffix}`, 'name が title + サフィックスになっていません');
    assertEq(p.description, a.description, 'description が insights.json と違います');
    assertEq(p.breadcrumb.length, 3, 'パンくずが3階層ではありません');
    assertEq(p.breadcrumb[1].path, '/insights/', 'パンくずの2階層目が /insights/ ではありません');
  }
  // 手書きの pages があればそちらを優先する（黙って上書きしない）
  const raw = JSON.parse(read('content/site.config.json'));
  for (const a of C.insights.articles) {
    assert(!raw.pages[articleKey(a.slug)],
      `site.config.json に ${a.slug} の定義が手書きされています（insights.json 側だけにしてください）`);
  }
});

/* ==========================================================================
   7. sitemap 生成ルール
   ========================================================================== */
test('ファイルパス→URL変換が正しい', () => {
  assertEq(urlPathOf(path.join(ROOT, 'index.html')), '/', 'ルート');
  assertEq(urlPathOf(path.join(ROOT, 'services/ai/index.html')), '/services/ai/', 'ディレクトリURL');
  assertEq(urlPathOf(path.join(ROOT, 'blog/dog/home-grooming.html')), '/blog/dog/home-grooming.html', '個別HTML');
  assertEq(urlPathOf(path.join(ROOT, 'fde/index.html')), '/fde/', '新規ページ');
});

test('lastmod がローカル日付で、UTC 由来の1日ずれが起きない', () => {
  const f = path.join(ROOT, 'index.html');
  const st = fs.statSync(f);
  const pad = (n) => String(n).padStart(2, '0');
  const local = `${st.mtime.getFullYear()}-${pad(st.mtime.getMonth() + 1)}-${pad(st.mtime.getDate())}`;
  assertEq(lastmodOf(f, new Map(), new Set()), local, 'mtime がローカル日付になっていません');
});

test('未コミットのHTMLは lastmod に古いコミット日を書かない', () => {
  const f = path.join(ROOT, 'index.html');
  const commitDate = '2020-01-01';
  // ローカルタイムゾーンで比較する（UTC で組むと JST 午前中にずれて偽陽性になる）
  const d = fs.statSync(f).mtime;
  const pad = (n) => String(n).padStart(2, '0');
  const today = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  // 未コミット扱い → mtime を使う（1つ前のコミット日を書かない）
  assertEq(lastmodOf(f, new Map([['index.html', commitDate]]), new Set(['index.html'])), today,
    '未コミットなのに古いコミット日が使われました');
  // コミット済み → 最終コミット日を使う
  assertEq(lastmodOf(f, new Map([['index.html', commitDate]]), new Set()), commitDate,
    'コミット済みファイルでコミット日が使われていません');
  // git 管理外 → mtime
  assertEq(lastmodOf(f, new Map(), new Set()), today, 'git 管理外で mtime が使われていません');
});

test('sitemap の優先度ルールが既存の値を踏襲している', () => {
  assertEq(ruleFor('/').priority, '1.0', 'トップ');
  assertEq(ruleFor('/services/ai/').priority, '0.9', 'サービスページ');
  assertEq(ruleFor('/blog/dog/home-grooming.html').priority, '0.8', 'ブログ記事');
  assertEq(ruleFor('/articles/').priority, '0.9', '記事一覧');
  assertEq(ruleFor('/insights/fde-toha/').priority, '0.8', 'Insights 記事');
  assertEq(ruleFor('/privacy/').changefreq, 'yearly', 'プライバシーポリシー');
});

/* ==========================================================================
   8. スクリプト自体の制約（依存パッケージなし）
   ========================================================================== */
test('スクリプトが外部パッケージに依存していない', () => {
  for (const f of ['scripts/build-content.mjs', 'scripts/generate-sitemap.mjs']) {
    const src = read(f);
    for (const m of src.matchAll(/^import\s+[\s\S]*?from\s+'([^']+)'/gm)) {
      assert(m[1].startsWith('node:') || m[1].startsWith('.'),
        `${f}: 外部パッケージ "${m[1]}" を読み込んでいます`);
    }
  }
});

/* ==========================================================================
   結果
   ========================================================================== */
console.log(`\n${passed} 件成功 / ${failures.length} 件失敗`);
if (failures.length) {
  console.error('\n失敗:');
  for (const f of failures) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log('✓ すべてのテストに合格しました');
