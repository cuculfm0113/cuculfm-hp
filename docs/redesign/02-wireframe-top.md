# 02. トップページ詳細ワイヤーフレーム

`index.html`（約5,600行）の**実装済み**セクション構成を上から順に記録したもの。
記載の id・クラス名・文言はすべて 2026-08-30 時点の実ファイルから引き写している。

- コンテンツの正体は `content/*.json` + `scripts/build-content.mjs`。マーカー区間
  `<!-- BEGIN:キー --> … <!-- END:キー -->` は build で上書きされるため**手で編集しない**
  （キーの一覧は build-content.mjs の `RENDERERS` 定義。使い方は 07-update-guide.md）
- CSS の初期状態は「可視」。GSAP は `gsap.from` で後から隠して見せるだけなので、
  **JS 無効・GSAP CDN 断のどちらでも全セクションが素の HTML/CSS で読める**
- 計測イベントの意味と一覧は 06-analytics.md

## ページ全体の並び

```
┌──────────────────────────────────────────────┐
│ #gnav（固定ヘッダー。ヒーロー通過後に降りてくる / body直下）│
├──────────────────────────────────────────────┤
│ #hero          100svh のシネマティックヒーロー【1pxも変えない】│
│ #statement     補強キャッチ「現場と事業に、技術を定着させる。」│
│ #seq           canvas シーケンス（pin + scrub）              │
│ #fde-cross     FDE横断の帯 + 3ステップ                       │
│ #business      3本柱 → 7カードスクローラー → 提供サービス8件 │
│ #challenges    課題カード8枚                                 │
│ #roadmap       12か月ロードマップ 4フェーズ                  │
│ #usecases      活用テーマ10項目                              │
│ #news          掲示板カード4枚                               │
│ #about         会社情報 + 地図                               │
│ #faq           FAQ 7問                                       │
│ #contact       電話CTA + Netlify Forms                       │
│ footer         サイトマップ3カラム                           │
├──────────────────────────────────────────────┤
│ #index-overlay 全リンクのインデックス（dialog / body直下）   │
└──────────────────────────────────────────────┘
```

セクション外の常駐要素（いずれも装飾・補助。`aria-hidden` か `sr-only`）:

| 要素 | 役割 |
|---|---|
| `#loader`（`#ld-fill` / `#ld-num`） | 初回ロード演出「LOADING 0%」 |
| `.theme-layer--moon` / `--red`、`.beam` | テーマ切替のクロスフェード背景 |
| `#site-bgm` | アンビエントBGM。**autoplay なし**。再生/停止は `#btn-sound` だけ |
| `#vignette` / `#grain` / `#dust` | fixed + pointer-events:none のオーバーレイ |

---

## 1. gnav（グローバルヘッダー）

```
┌──────────────────────────────────────────────────────────┐
│ ▎CUCULFM.LLC  Our Service FDE・AI実装支援 Construction…  │
│               … Lifestyle Insights About Us Contact      │
│                                    [相談する]  [≡ MENU]  │
└──────────────────────────────────────────────────────────┘
```

| 項目 | 実装 |
|---|---|
| 要素 | `header.gnav#gnav` > `.gnav-in`。body 直下（`#seq` の pin 区間外） |
| ブランド | `.gnav-brand` 「CUCULFM.LLC」→ `#hero` |
| ナビ | `.gnav-nav` > `.gnav-list` > `.gnav-link`。Our Service(#business) / FDE・AI実装支援(/fde/) / Construction & Infrastructure(#pillar-construction) / Creative & Tech(#pillar-creative) / Lifestyle(#pillar-lifestyle) / Insights(/insights/) / About Us(/about/) / Contact(#contact) |
| データ | マーカー `nav` ← `content/site.config.json` の `nav`（items + cta） |
| CTA | `.gnav-cta` 「相談する」→ `#contact`、`data-ga-event="click_consultation_cta"` |
| メニュー | `#btn-index-gnav`（`data-idx-open`）が `#index-overlay` を開く。モバイルはこれがハンバーガー |

挙動: `initGlobalNav()` の scroll 監視で `y > hero.offsetHeight - 80` を越えたら
`.is-on` を付けて降ろす（出したら 120px 戻すまで消さないヒステリシス付き）。
**GSAP に依存しない**（CDN 断でもナビは出る）。JS 無効時は `<noscript>` の
style で常時表示に倒す。

## 2. #hero — 【1px も変えない】

```
┌──────────────────────────────────────────────────────────┐
│ ▎CUCULFM.LLC    [●SOUND OFF][VIEW BUSINESS][IG][X][≡INDEX]│
│ SUPPORTING BLUE-COLLAR…   CONSTRUCTION & TECH & LIFESTYLE │
│                                                          │
│        C U C U L   F M . L L C   ←h1 .giant-type         │
│              ┌────────────┐                              │
│              │ キャラSVG   │ ←#cucul-char（+#char3d GLB） │
│              │ (三日月リング)│   ⌄ SCROLL TO EXPLORE       │
│              └────────────┘                              │
│ [OUR ROADMAP] [● PRESS [ENTERBAR] TO SWITCH]             │
│                EST. KAWAGUCHI / SAITAMA [●BUSINESS INDEX]│
└──────────────────────────────────────────────────────────┘
```

| 項目 | 実装 |
|---|---|
| 要素 | `section#hero`（aria-label「CUCUL FM.LLC」）。100svh |
| h1 | `.giant-type` 「CUCUL FM.LLC」（ページ唯一の h1） |
| コーナー文言 | 「SUPPORTING BLUE-COLLAR & AILIFE」 / 「CONSTRUCTION & TECH & LIFESTYLE｜普段と新しい暮らしをサポートする会社」 |
| キャラ | インラインSVG `#cucul-char`（`#char-head` がカーソル追従ティルト、`#char-face` は1.4倍視差）。GLB 有効時は `#char3d` に canvas |
| ナビ | `#btn-sound`（BGMトグル・初期 SOUND OFF）/ VIEW BUSINESS(#business) / Instagram / X / `#btn-index-top`(INDEX) |
| 下部バー | OUR ROADMAP（現状 `#business` 行き。TODOコメントあり）/ `#theme-switch`（Enter でもテーマ切替）/ `#btn-index-hero`(BUSINESS INDEX) |
| データ | **マーカーなし（全て直書き）** |
| CTA計測 | なし（data-ga-event を持つ要素はヒーロー内に無い） |

**確定事項11（ブリーフ）: ヒーローの描画は 1px も変えない。**
`#hero` は 100svh に構図が詰まりきっており（1440×900 でキャラの肩が下端に接する）、
内側に本文+CTAを足すと `.hero-stage` が圧縮されてキャラと巨大タイポの寸法が変わる。
このため改修で足した補強コピーはヒーロー内ではなく**直後の独立セクション
`#statement`** に置いた。変更前後のファーストビュー画素比較で 1440px・1280px とも
差分 0px を確認済み。ヒーローに要素を足したくなったら、まずこの決定に立ち返ること。

## 3. #statement（補強キャッチ）

```
┌──────────────────────────────────────────────────────────┐
│        現場と事業に、技術を定着させる。   ←h2 #stm-title  │
│   建設・インフラ、クリエイティブ・テック、ライフスタイル。…│
│   [ククルFMの事業を見る] [FDE・AI実装支援を見る]          │
└──────────────────────────────────────────────────────────┘
```

| 項目 | 実装 |
|---|---|
| 要素 | `section#statement` > `.stm-in` |
| h2 | `#stm-title` 「現場と事業に、技術を定着させる。」（句読点で `<span>` 分割） |
| lead | `.stm-lead` 「建設・インフラ、クリエイティブ・テック、ライフスタイル。〜人と現場がより良く働く仕組みをつくります。」 |
| データ | マーカー `hero-copy` ← `site.config.json` の `messaging`（heroTagline / heroLead / heroCtas） |
| CTA | `.btn-stm` 「ククルFMの事業を見る」→ `#business`（計測なし）/ `.btn-stm--ghost` 「FDE・AI実装支援を見る」→ `/fde/`、`data-ga-event="click_fde_service"`（イベント名は `heroCtas[].gaEvent` でデータ側が持つ） |
| 挙動 | 初期状態で可視。GSAP 到達後に `gsap.from`（trigger top 82%・once）でフェードイン。JS 無効でも読める |

## 4. #seq（シネマティックシーケンス / pin + scrub）

```
┌──────────────────────────────────────────────────────────┐
│ ┌─ #seq-canvas（全画面。GLB時は #seq-3d へ差替え）──────┐ │
│ │   WE BUILD                    ┊scrubで              │ │
│ │   THE ORDINARY                ┊キャプション切替       │ │
│ │   & THE NEXT     → TECH ACROSS ALL                   │ │
│ └──────────────────────────────────────────────────────┘ │
│  CUCULFM.LLC / SEQUENCE 01 / KAWAGUCHI SAITAMA JP        │
└──────────────────────────────────────────────────────────┘
```

| 項目 | 実装 |
|---|---|
| 要素 | `section#seq`。`ScrollTrigger` の `pin: true, scrub` で画面固定しながら進む |
| キャプション1 | `.seq-cap--1` h2「WE BUILD THE ORDINARY & THE NEXT」+「現場も、オフィスも、映像も、AIも。現場に立つ人の「普段」を支えながら、次の暮らしをつくる。」 |
| キャプション2 | `.seq-cap--2` h2「TECH ACROSS ALL」+「建設・インフラ / クリエイティブ・テック / ライフスタイル。3本の柱をテクノロジーで横串に。」 |
| 描画 | `#seq-canvas`（フレーム連番）→ 無ければ `#seq-char-stage`（キャラSVGクローン）→ GLB 有効時は `#seq-3d`（pin 中だけ `#char3d` が移動して全画面化） |
| データ | **マーカーなし（直書き）** |
| 禁止 | **この中に `position:fixed` の要素を置かない（pin が壊れる）**。gnav / index-overlay が body 直下なのはこのため |

## 5. #fde-cross（FDE横断の帯 + 3ステップ）

```
┌──────────────────────────────────────────────────────────┐
│ FDE & AI IMPLEMENTATION                                   │
│ 技術を、現場で使われる仕組みへ。      ←h2 #fde-heading    │
│ 良いツールも、現場の仕事に合わなければ…（3段落）          │
│ ┌───────────┐┌───────────┐┌───────────┐                  │
│ │01 Understand││02 Build   ││03 Embed   │                 │
│ │現場と事業を ││仕組みを設 ││使われ続け │                  │
│ │理解する     ││計・実装する││る状態へ育てる│               │
│ └───────────┘└───────────┘└───────────┘                  │
│           [FDE・AI実装支援の詳細を見る]                    │
└──────────────────────────────────────────────────────────┘
```

| 項目 | 実装 |
|---|---|
| 要素 | `section#fde-cross` > `.fde-in`（本文）+ `.fde-steps-in`（3ステップ） |
| eyebrow | 「FDE & AI IMPLEMENTATION」 |
| h2 | `#fde-heading` 「技術を、現場で使われる仕組みへ。」 |
| 本文 | 「良いツールも、現場の仕事に合わなければ使われ続けません。」ほか3段落 |
| ステップ | `ol.fde-steps` > `.step-card`。01 Understand「現場と事業を理解する」/ 02 Build「仕組みを設計・実装する」/ 03 Embed「使われ続ける状態へ育てる」 |
| データ | マーカー `fde-cross` + `fde-steps` ← `content/pillars.json` の `crossSection`（/fde/ の `fde-steps-detail` も同じデータから生成される） |
| CTA | `.btn-fde` 「FDE・AI実装支援の詳細を見る」→ `/fde/`、`data-ga-event="click_fde_service"` |
| 挙動 | 初期可視。`gsap.from` の reveal のみ（once）。要件どおり**4本目の柱ではなく3事業を横断する帯**として配置 |

## 6. #business（3本柱 → 7カード → 提供サービス）

```
┌──────────────────────────────────────────────────────────┐
│ AI-DRIVEN / BLUE-COLLAR / BUILD-UP                        │
│ OUR BUSINESS                    lead: AI × 現場。…7つの領域│
│ ── THREE PILLARS / 3つの事業領域 ──                       │
│ ┌────────────┐┌────────────┐┌────────────┐               │
│ │#pillar-     ││#pillar-    ││#pillar-    │               │
│ │construction ││creative    ││lifestyle   │               │
│ │建設・インフラ││クリエイティ ││ライフスタイル│              │
│ │+FDEつながり注││ブ・テック  ││            │               │
│ │+下層リンク5 ││+リンク6    ││+リンク2    │               │
│ └────────────┘└────────────┘└────────────┘               │
│ ── SERVICE LIST / 各事業のご紹介 ──                       │
│ ┌────┐┌────┐┌────┐┌────┐┌────┐┌────┐┌────┐→ 横スクロール │
│ │ 01 ││ 02 ││ 03 ││ 04 ││ 05 ││ 06 ││ 07 │  #biz-scroller│
│ └────┘└────┘└────┘└────┘└────┘└────┘└────┘               │
│ ━━━━━━━━━━━ #biz-line（進捗）  01 feat. AI … 07 DOG      │
│ ── WHAT WE PROVIDE / 提供サービス ──                      │
│ ・FDE・AI実装支援 ・業務フロー・DX診断 …（8件リスト）      │
│ （+ 同一データの JSON-LD Service 8件）                    │
└──────────────────────────────────────────────────────────┘
```

| 項目 | 実装 |
|---|---|
| 要素 | `section#business`。eyebrow「AI-DRIVEN / BLUE-COLLAR / BUILD-UP」、h2 `#biz-title` 「OUR <em>BUSINESS</em>」、lead「AI × 現場。建設・インフラからライフスタイルまで、AIを駆使してブルーカラーの仕事をビルドアップする——ククルFM合同会社の7つの領域。」 |
| 3本柱 | 小見出し「THREE PILLARS / 3つの事業領域」。マーカー `pillars` ← `content/pillars.json`（`pillars` + `fdeNoteLabel`）。`#pillar-construction`「建設・インフラ」/ `#pillar-creative`「クリエイティブ・テック」/ `#pillar-lifestyle`「ライフスタイル」。各カードに「FDE・AI実装支援とのつながり」注記と下層 `/services/*/` リンク |
| 7カード | 小見出し「SERVICE LIST / 各事業のご紹介」。`#biz-scroller` > `.biz-grid` > `.biz-card`（**直書き・マーカーなし**）。01 DX SYSTEMS(/services/ai/・feat.AIバッジ) / 02 CONSTRUCTION / 03 INSPECTION & CLEANING / 04 TOOLS & CRAFT / 05 VIDEO & DOCUMENTS / 06 WEB & 3D DESIGN / 07 DOG SERVICES |
| 提供サービス | 小見出し「WHAT WE PROVIDE / 提供サービス」（h3 `#svc-title`）。マーカー `services` ← `site.config.json` の `services`（8件、id は `svc-fde` 〜 `svc-lifestyle`）。**直後の `jsonld-services` マーカーと必ずセット**（画面に出していない内容を構造化データに書かないため、同一データから両方生成する） |
| CTA計測 | なし（カードは通常リンク） |
| 挙動 | 進捗線 `#biz-line` はデスクトップ(≥1200px)が ScrollTrigger scrub、モバイルは `initBizProgressMobile()` が scrollLeft 比率で更新。カード reveal は `.pillar-in` / `.biz-scroller` / `.svc-in` トリガーの `gsap.from`（once） |

## 7. #challenges（課題提起）

```
┌──────────────────────────────────────────────────────────┐
│ CHALLENGES                                                │
│ COMMON ISSUES              lead: こんな課題はありませんか。│
│ ┌──────┐┌──────┐┌──────┐┌──────┐                         │
│ │01 情報│分散  ││02 探す│時間  │ …8枚（2×4）             │
│ └──────┘└──────┘└──────┘└──────┘                         │
│ ククルFMは、ツールありきでは考えません。…（締め文）        │
└──────────────────────────────────────────────────────────┘
```

| 項目 | 実装 |
|---|---|
| 要素 | `section#challenges`。eyebrow「CHALLENGES」、h2 `#chal-title` 「COMMON <em>ISSUES</em>」、lead「こんな課題はありませんか。」 |
| カード | `.chal-grid` > `.chal-card` × 8（01「現場の情報が紙、Excel、写真、チャット、メール、PDFに分散している」〜 08「事業の成長に合わせ、情報管理と仕事の進め方を整えたい」） |
| 締め文 | `.chal-closing` 「ククルFMは、ツールありきでは考えません。…無理なく続けられる仕組みから一緒につくります。」 |
| データ | マーカー `challenges` ← `content/challenges.json` |
| CTA | なし |

## 8. #roadmap（12か月ロードマップ）

```
┌──────────────────────────────────────────────────────────┐
│ 12-MONTH ROADMAP                                          │
│ HOW WE WORK   lead: 12か月で、現場の課題を使われる仕組みへ。│
│ intro: 最初から完璧な仕組みを目指すのではなく…            │
│ ▼01 1〜3か月  現場課題を、実装できる要件へ    ←details open│
│ │  ・業務フローを可視化する …（タスク列挙）                │
│ │  成果物: [現状業務フロー][KPI設計]…（チップ）            │
│ ▼02 4〜6か月  最小構成を作り、実務で動かす                │
│ ▼03 7〜9か月  現場に定着させ、利用範囲を広げる            │
│ ▼04 10〜12か月 成果を可視化し、継続改善できる体制へ       │
│           [自社に合わせた進め方を相談する]                 │
└──────────────────────────────────────────────────────────┘
```

| 項目 | 実装 |
|---|---|
| 要素 | `section#roadmap`。eyebrow「12-MONTH ROADMAP」、h2 `#roadmap-title` 「HOW WE <em>WORK</em>」、lead「12か月で、現場の課題を使われる仕組みへ。」 |
| フェーズ | `ol.rm-list` > `#roadmap-1`〜`#roadmap-4`。各 `details.rm-details` は**生成時 open**。01「現場課題を、実装できる要件へ」/ 02「最小構成を作り、実務で動かす」/ 03「現場に定着させ、利用範囲を広げる」/ 04「成果を可視化し、継続改善できる体制へ」。各フェーズにタスク `ul.rm-tasks` と成果物チップ `ul.rm-chips` |
| データ | マーカー `roadmap` ← `content/roadmap.json` |
| CTA | `.btn-roadmap` 「自社に合わせた進め方を相談する」→ `#contact`、`data-ga-event="click_roadmap"` |
| 挙動 | `initRoadmapFold()` が**幅 900px 以下でだけ**2つ目以降を畳む（1回だけ。利用者が開いたものを resize で閉じ直さない）。JS 無効でも details は open のまま全文読める |

## 9. #usecases（活用テーマ）

```
┌──────────────────────────────────────────────────────────┐
│ USE CASES                                                 │
│ WHERE TO START  lead: 現場と事業の、こんな仕事から始められます。│
│ ※実績ではなく活用イメージです                             │
│ ・現場記録、作業報告、点検情報、写真、動画、書類を…        │
│ ・Excelや紙で管理している台帳を… （計10項目）             │
└──────────────────────────────────────────────────────────┘
```

| 項目 | 実装 |
|---|---|
| 要素 | `section#usecases`。eyebrow「USE CASES」、h2 `#uc-title` 「WHERE TO <em>START</em>」、lead「現場と事業の、こんな仕事から始められます。」 |
| 注記 | `.uc-note` 「※実績ではなく活用イメージです」。**実績と誤認させないため必ず表示する**（ブリーフの方針。BANNED 語検査も build にある） |
| 項目 | `ul.uc-list` > `.uc-item` × 10 |
| データ | マーカー `usecases` ← `content/usecases.json` |
| CTA | なし |

## 10. #news（掲示板）

```
┌──────────────────────────────────────────────────────────┐
│ NEWS & INFO                                               │
│ BULLETIN BOARD  lead: 記事・採用・イベント・子犬情報。…   │
│ ┌────────┐┌────────┐┌────────┐┌────────┐                 │
│ │01      ││02      ││03      ││04      │                 │
│ │ARTICLES││RECRUIT ││EVENT   ││PUPPIES │                 │
│ │記事一覧 ││求人募集中││イベント ││子犬紹介 │                │
│ └────────┘└────────┘└────────┘└────────┘                 │
└──────────────────────────────────────────────────────────┘
```

| 項目 | 実装 |
|---|---|
| 要素 | `section#news`。eyebrow「NEWS & INFO」、h2 `#news-title` 「BULLETIN <em>BOARD</em>」、lead「記事・採用・イベント・子犬情報。ククルFMの「いま」を掲示板から。」 |
| カード | `.news-card` × 4（**直書き**）。01 ARTICLES「記事一覧」→ `/articles/` / 02 RECRUIT「好きを仕事に変えよう。求人募集中」→ `/recruit/` / 03 EVENT「イベント」→ `/event/` / 04 PUPPIES「当店で生まれた子犬たちをご紹介」→ `/services/dog/#puppies` |
| データ | マーカーなし |
| CTA | なし（通常リンク） |

## 11. #about（会社情報）

```
┌──────────────────────────────────────────────────────────┐
│ ABOUT US                 CUCUL FM.LLC / KAWAGUCHI SAITAMA │
│ COMPANY PROFILE                                           │
│ ┌─────────────────────────┐┌────────────────────┐        │
│ │テクノロジーとクリエイティ ││ Google Map iframe   │        │
│ │ビティを融合し 暮らしと未来││                    │        │
│ │をデザインする + 本文     ││ [OPEN GOOGLE MAP]  │        │
│ │ 運営会社/代表者/経歴/    ││ [IG][X]            │        │
│ │ 事業内容/所在地/連絡先   ││                    │        │
│ └─────────────────────────┘└────────────────────┘        │
└──────────────────────────────────────────────────────────┘
```

| 項目 | 実装 |
|---|---|
| 要素 | `section#about`。eyebrow「ABOUT US」、h2 `#abt-title` 「COMPANY <em>PROFILE</em>」 |
| リード | 「テクノロジーとクリエイティビティを融合し 暮らしと未来をデザインする」 |
| 表 | `dl.spec-table`。運営会社「ククルFM合同会社」/ 代表者「馬場 陽子」/ 経歴 / 事業内容（FDE・AI実装支援を筆頭に4区分）/ 所在地「〒333-0802 埼玉県川口市戸塚東４丁目３２−５ ITSUZAI community base １号室」/ 連絡先 090-6262-3842 |
| データ | **マーカーなし（直書き）**。会社概要ページ `/about/` は別で、そちらは `company-spec` マーカー ← `site.config.json` の `company` から生成。**両方に会社情報があるため、変更時は二重更新に注意**（07-update-guide.md 参照） |
| CTA | なし（tel リンクはあるが data-ga-event なし。analytics.js が `tel:` クリックを自動で `click_phone` として拾う） |
| 備考 | `404.html` / `/articles/` / `/event/` が `/#about` へ深リンクしている |

## 12. #faq（よくあるご質問）

```
┌──────────────────────────────────────────────────────────┐
│ FAQ                                                       │
│ FREQUENTLY ASKED QUESTIONS      lead: よくあるご質問      │
│ ▸ FDEとは何ですか？                        ←details       │
│ ▸ 建設・インフラ以外の業種でも相談できますか？             │
│ ▸ ITに詳しい社員がいなくても大丈夫ですか？ …（計7問）     │
│ （+ 同一データの JSON-LD FAQPage）                        │
└──────────────────────────────────────────────────────────┘
```

| 項目 | 実装 |
|---|---|
| 要素 | `section#faq`。eyebrow「FAQ」、h2 `#faq-title` 「FREQUENTLY ASKED <em>QUESTIONS</em>」、lead「よくあるご質問」 |
| 設問 | `details.faq-item` × 7。id は `faq-what-is-fde` / `faq-other-industries` / `faq-no-it-staff` / `faq-keep-existing` / `faq-ai-and-judgement` / `faq-small-start` / `faq-early-stage` |
| データ | マーカー `faq-top` ← `content/faq-top.json`。**直後の `jsonld-faq-top` マーカーと必ずセット**（同一 JSON から FAQPage 構造化データを生成。画面に無い設問が構造化データに混ざらない） |
| 挙動 | ネイティブ details なので JS 無効でも開閉できる |

## 13. #contact（お問い合わせ）

```
┌──────────────────────────────────────────────────────────┐
│ CONTACT / GET IN TOUCH                                    │
│ 困りごとが整理できていなくても、ご相談ください。           │
│ 「現場と事務所の連携をもっと良くしたい」…（本文2段落）    │
│ [📞 CALL: 090-6262-3842]                                  │
│ ┌─ MAIL CONTACT / メールでのお問い合わせ ────────────────┐│
│ │ 会社名または屋号 [____________]                        ││
│ │ お名前*         [____________]                        ││
│ │ …（下表の9項目）                                      ││
│ │ □ 個人情報保護方針への同意*                            ││
│ │              [送信する ➤]                              ││
│ └───────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────┘
```

| 項目 | 実装 |
|---|---|
| 要素 | `section#contact`。eyebrow「CONTACT」、h2 `#ct-title` 「GET IN <em>TOUCH</em>」 |
| 見出し | マーカー `contact-copy`: `.ct-heading` 「困りごとが整理できていなくても、ご相談ください。」+ 本文2段落 ← `site.config.json` の `contact.heading` / `contact.body` |
| 電話CTA | `.btn-call` 「CALL: 090-6262-3842」（番号はインラインマーカー `cfg:company.tel`）、`data-ga-event="click_phone"` |
| フォーム | `#contactForm`。`name="contact"` `method="POST"` `action="/"` `data-netlify="true"` `netlify-honeypot="bot-field"` + hidden `form-name=contact` + honeypot `bot-field`。送信は `/contact/form-handler.js` が Netlify Forms へ fetch POST（mailto 方式は廃止済み。通知先は Netlify 管理画面で `info@cucul-fm.com`） |
| 入力項目 | マーカー `contact-fields` ← `site.config.json` の `contact.fields`（下表） |
| 設定JSON | マーカー `contact-config`: `<script type="application/json" id="contact-config">`（formName / honeypot / エラー・成功・失敗文言）。form-handler.js がこれを読む |
| 計測 | `contact_form_view` / `contact_form_start`（analytics.js）、`contact_form_submit` / `contact_form_success` / `contact_form_error`（form-handler.js）。詳細は 06-analytics.md |
| 備考 | 下層ページの CTA が `/#contact` へ深リンクする（サービス16ページ（services/ 19ページ中、ai-tools と dog/breeds 配下の計3枚を除く）+ 記事ほか） |

フォーム項目（実物の name / type / 必須）:

| label | name | type | 必須 |
|---|---|---|---|
| 会社名または屋号 | `company` | text | — |
| お名前 | `name` | text | ✓ |
| 部署・役職 | `department` | text | — |
| メールアドレス | `email` | email | ✓ |
| 電話番号 | `tel` | tel | — |
| 業種 | `industry` | text | — |
| ご相談の種類 | `subject` | select | — |
| ご相談内容 | `message` | textarea | ✓ |
| 個人情報保護方針への同意 | `privacy` | checkbox（value="個人情報保護方針への同意"） | ✓ |

`subject` の選択肢: 現場業務の改善 / AI活用 / Web・業務システム / データ・情報整理 /
資料・映像制作 / 新規事業・サービス設計 / その他（← `contact.subjects`）。

## 14. footer

```
┌──────────────────────────────────────────────────────────┐
│ CUCUL FM.LLC      │ Services        │ News & Company     │
│ ククルFM合同会社   │ FDE・AI実装支援  │ INSIGHTS 現場DX…   │
│ 〒333-0802 …      │ DX・業務効率化…  │ ARTICLES/RECRUIT…  │
│ 📞090-6262-3842   │ （計10リンク）   │ （計9リンク）+SNS   │
├──────────────────────────────────────────────────────────┤
│ © 2026 CUCUL FM LLC.  CONSTRUCTION & TECH & LIFESTYLE    │
└──────────────────────────────────────────────────────────┘
```

| 項目 | 実装 |
|---|---|
| 要素 | `footer.site-footer` > `.foot-in`（3カラム / モバイル1カラム）。**マーカーなし（直書き）** |
| Services | `/fde/` を筆頭に `/services/ai/` `construction` `inspection` `tools` `craft` `video` `document` `web` `dog` の10リンク |
| News & Company | `/insights/` `/articles/` `/recruit/` `/event/` `/services/dog/#puppies` `/about/` `#about`(PROFILE) `#contact` `/privacy/` の9リンク + Instagram / X |
| 注記 | `.foot-note` 「© 2026 CUCUL FM LLC. All rights reserved.」 |

## 15. #index-overlay（全リンクインデックス）

```
┌──────────────────────────────────────────────────────────┐
│ CUCULFM.LLC / SITE INDEX                       [CLOSE ✕] │
│ ALL LINKS                                                 │
│ Services(10)      │ News & Info(5)  │ Company(5)          │
│ 01 FDE …          │ 01 INSIGHTS …   │ 01 ABOUT …          │
│                   │                 │ 住所 + [IG][X]      │
└──────────────────────────────────────────────────────────┘
```

| 項目 | 実装 |
|---|---|
| 要素 | `div.idx#index-overlay`（`role="dialog"` `aria-modal="true"`）。body 直下（pin 区間外） |
| h2 | `#idx-title` 「ALL <em>LINKS</em>」、eyebrow「CUCULFM.LLC / SITE INDEX」 |
| 開閉 | `data-idx-open` を持つ3ボタン（`#btn-index-gnav` / `#btn-index-top` / `#btn-index-hero`）が開き、`#idx-close` / Esc で閉じる。開閉は CSS transition で **GSAP が無くても動く**。Tab 巡回（フォーカストラップ）は `initIndexOverlay()` |
| 内容 | Services 10 / News & Info 5 / Company 5（+住所・SNS）。**マーカーなし（直書き）**。gnav のモバイルメニューはこれを流用 |

---

## 変更禁止事項（トップページ）

| 種別 | 対象 | 理由 |
|---|---|---|
| アンカー id | `#contact` `#business` `#about` | 下層ページ（サービス16ページ・articles・event・404 等）が `/#contact` 等で深リンクしている |
| アンカー id | `#pillar-construction` `#pillar-creative` `#pillar-lifestyle` | グローバルナビ（`site.config.json` の `nav.items`）が参照。柱カードの id は `pillars.json` 側が持つため、消すとナビが空振りする |
| フォーム属性 | `name="contact"` / `data-netlify="true"` / `netlify-honeypot="bot-field"` / hidden `form-name` | Netlify のフォーム検出とひも付けの契約。値は `site.config.json` の `contact.formName` / `honeypot` と一致させる（`test-build-content.mjs` が照合する） |
| マーカー区間 | `<!-- BEGIN:* --> … <!-- END:* -->` の中身 | `node scripts/build-content.mjs` が上書きする。直すのは `content/*.json` 側。編集後は build → `node scripts/test-build-content.mjs` 全件合格を確認 |
| ヒーロー | `#hero` の構図・寸法 | **1px も変えない**（ブリーフ確定事項11。画素比較で差分0を確認済み）。コピー追加は `#statement` 側で行う |
| `#seq` 内部 | `position:fixed` の要素を置かない | ScrollTrigger の pin が壊れる。固定表示したいものは body 直下へ（gnav / index-overlay が前例） |
| 構造化データ | `services` と `jsonld-services`、`faq-top` と `jsonld-faq-top` | 同一データから生成するセット。片方だけ消す・書き換えると「画面に無い内容が構造化データにある」状態になる |
