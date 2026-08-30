# 03. FDE・AI実装支援ページ 詳細ワイヤーフレーム（/fde/）

実装済みの `fde/index.html`（728行、2026-08-30 時点）を上から順にドキュメント化したもの。
このファイルは**実装の写し**であり、`00-implementation-brief.md` の計画と食い違う箇所は
末尾の「計画との差分」に明記した。文言・id・クラス名はすべて実ファイルから引き写している。

---

## ページの基本情報

| 項目 | 内容 |
|---|---|
| URL / canonical | `https://cucul-fm.com/fde/` |
| ファイル | `fde/index.html` |
| `<title>` | FDE・AI実装支援（現場伴走型のAI・DX実装支援） \| CUCUL FM.LLC |
| CSS | `/services/style.css` を継承。FDE/About 専用のコンポーネントは同ファイル末尾（2478行目〜のブロック「/fde/ ・/about/ のコンポーネント（改修フェーズ5で追加）」）に追記 |
| フォント | Bebas Neue / Noto Sans JP / Orbitron（Google Fonts） |
| OGP | `og:image` は共通の `/images/ogp/ogp-default.png`。og:title / og:description は `<title>` / meta description と同文 |
| favicon | `/logo/cuculfm.svg` + `/images/icons/favicon-192.png` + `/site.webmanifest`（全ページ共通） |
| 計測 | `<!-- BEGIN:analytics -->` 区間。GA4 直接（gtag.js、G-RGHFB3LGED）+ `/js/analytics.js`。`window.CUCULFM.directGa4=true` |
| JSON-LD | WebPage / BreadcrumbList / Service（`<head>` 内）+ FAQPage（FAQ セクション末尾）。**Article は使っていない**（Insights 記事用） |

`site.config.json` の `pages["fde/index.html"]` に path / name / description / breadcrumb が
定義されており、`jsonld-webpage`・`breadcrumb`・`jsonld-breadcrumb` はここから生成される。

---

## セクション構成（上から順）

| # | section id | マーカー | 見出し（実文言） | データソース |
|---|---|---|---|---|
| 0 | — (header) | なし（静的） | ヘッダー: 「TOP に戻る」+ ロゴ + 「相談する」（`.header-cta`） | — |
| 1 | — (`.service-hero.fde-hero`) | `breadcrumb` / `fde-lead` | H1「現場を知るから、変革を動かせる。」 | site.config.json（messaging.fdeMain / fdeSub、pages[].breadcrumb） |
| 2 | `#philosophy` | `philosophy` | 「支援の前提にしている考え方」→ blockquote「AIはAIらしく、人は人らしく。」 | site.config.json（messaging.philosophy） |
| 3 | `#position` | `service-fde`（末尾の dl のみ） | 「ククルFMの立ち位置」 | NOT対比・pos-claim は静的。svc-def の dl は site.config.json（services[id="fde"]） |
| 4 | `#industries` | なし（静的） | 「対象とする業種」 | — |
| 5 | `#steps` | `fde-steps-detail` | 「進め方の3ステップ」 | pillars.json（crossSection.steps） |
| 6 | `#roadmap` | `roadmap` | 「HOW WE *WORK*」（12-MONTH ROADMAP） | roadmap.json |
| 7 | `#usecases` | `usecases` | 「WHERE TO *START*」（USE CASES） | usecases.json |
| 8 | `#data-policy` | なし（静的） | 「AI・データの取扱い方針」 | — |
| 9 | `#faq` | `faq-fde` / `jsonld-faq-fde` | 「FREQUENTLY ASKED *QUESTIONS*」 | faq-fde.json |
| 10 | `#insights` | なし（静的） | 「進め方の詳細は、記事にまとめています」 | — |
| 11 | `#cta`（`.cta-section`） | `cfg:company.tel` / `cfg:company.email` | 「困りごとが整理できていなくても、ご相談ください。」 | site.config.json（company.tel / company.email） |
| 12 | — (footer) | なし（静的） | © 2026 CUCUL FM LLC. All rights reserved. | — |

トップの gnav のようなグローバルヘッダーは無く、`services/` 各ページと同じ
`.service-header` に `.header-cta`（相談する）を足した形。

---

## 各セクションの詳細

### 1. ヒーロー（`.service-hero.fde-hero`）

- パンくず（`breadcrumb` マーカー）: ホーム → FDE・AI実装支援。表示用 nav と
  BreadcrumbList JSON-LD は同一データ（pages[].breadcrumb）から生成
- `.hero-label`「FDE & AI IMPLEMENTATION」
- `fde-lead` マーカー: `<h1 class="fde-main">現場を知るから、変革を動かせる。</h1>` +
  `.fde-sub`（サブコピー2段落。「ククルFMは、業務の現場に入り込み〜」「ツールを導入するだけで終わらせず〜」）
- `.hero-plain`「サイト内では「現場伴走型のAI・DX実装支援」と呼んでいます。」（静的）
- `.hero-actions`: 「相談する」→ `/#contact`（`data-ga-event="click_consultation_cta"`）、
  「12か月の進め方を見る」→ `#roadmap`（`.cta-button--ghost`）
- **公開日・監修者表記はここ**: `.page-meta`
  「公開日: 2026年8月29日　最終更新日: 2026年8月29日　監修: ククルFM合同会社 代表 馬場 陽子」（静的・手動更新）

`.fde-hero` クラスは HTML にあるが、style.css に対応ルールは無い（フック用。装飾は `.service-hero` 側）。

### 2. 思想 `#philosophy`

`philosophy` マーカー → `<blockquote class="philosophy">`。
`.philosophy-title`「AIはAIらしく、人は人らしく。」+ `.philosophy-body` 2段落。
同じ `.philosophy` コンポーネント（CSS）は `/about/` でも使われるが（`/services/style.css` 2577行のコメント「思想ブロック（/fde/ ・/about/ のミッション）」）、`/about/` 側はマーカー無しの静的HTMLで文言も別（「普段と新しい暮らしをサポートする会社」）。`messaging.philosophy` を編集して反映されるのは `/fde/` のみ。

### 3. 立ち位置 `#position`

- `.pos-grid` に `.pos-card` 4枚（静的）: 「**NOT** 単なるAIツール販売会社 / Web制作会社 /
  受託開発会社 / ITコンサルティング会社」の対比。NOT は `.pos-not-mark`
- `.pos-claim`: 「ククルFMが提供するもの」→「現場伴走型のAI・DX実装支援」。
  FDE（Forward Deployed Engineer）の語は `.pos-claim-note` 内の補足説明に留めている
- `service-fde` マーカー → `<dl class="doc-dl svc-def">`（サービス名 / 支援内容 / 提供 / 対応地域）。
  **`<head>` の `jsonld-service-fde`（Service JSON-LD）と同じ `services[id="fde"]` から生成**され、
  build-content.mjs のコメントどおり「どちらか一方だけを書き換えても食い違わない」構造

### 4. 対象業種 `#industries`（静的）

- `.service-tags.industry-tags` に 11 タグ: 下水道 / 建設 / 設備 / 保守点検 / 清掃 / 物流 /
  製造 / 不動産・施設管理 / クリエイティブ事業 / 地域事業 / サービス業
- `.industry-why`「建設・インフラを強みとしている理由」: 自社の下水道調査・清掃・建設施工の実務と、
  代表のプラント海外プロジェクト／コンサルでの DX 支援経験を根拠として記述
- `.industry-links`: `/services/inspection/`・`/services/construction/`・`/about/` への内部リンク

### 5. 3ステップ詳細 `#steps`

`fde-steps-detail` マーカー → `<ol class="fde-steps fde-steps--detail">`。
**トップの `fde-steps` マーカーと同じ pillars.json の `crossSection.steps` から描画**するが、
こちらは各ステップに `detail`（箇条書き4項目、ラベル「この段階ですること」= `crossSection.detailLabel`）が付き、
CTA は付かない（`/fde/` 自身へのリンクになるため。build-content.mjs のコメントに明記）。

| No | en | ja |
|---|---|---|
| 01 | Understand | 現場と事業を理解する |
| 02 | Build | 仕組みを設計・実装する |
| 03 | Embed | 使われ続ける状態へ育てる |

### 6. 12か月ロードマップ `#roadmap`

`roadmap` マーカー → roadmap.json の `phases` 4件。見出しは「HOW WE *WORK*」+
リード「12か月で、現場の課題を使われる仕組みへ。」。
各フェーズは `<details class="rm-details" open>` で、`rm-tasks`（作業項目）+ `rm-chips`（成果物）を持つ。
各 `li.rm-item` に `id="roadmap-1"`〜`roadmap-4"`。

| id | 期間 | タイトル |
|---|---|---|
| `#roadmap-1` | 1〜3か月 | 現場課題を、実装できる要件へ |
| `#roadmap-2` | 4〜6か月 | 最小構成を作り、実務で動かす |
| `#roadmap-3` | 7〜9か月 | 現場に定着させ、利用範囲を広げる |
| `#roadmap-4` | 10〜12か月 | 成果を可視化し、継続改善できる体制へ |

末尾 CTA: `.btn-roadmap`「自社に合わせた進め方を相談する」→ `/#contact`（`data-ga-event="click_roadmap"`）。

**トップの `#roadmap` と同一マーカー・同一 JSON・同一レンダラー**。出力の差は
リンクの書き換えだけ（トップでは `/#contact` → `#contact` + `data-scroll` に落とす。linkAttrs 参照）。
つまり「フル版/簡略版」の区別は無く、両ページとも同じフル版が出る。

### 7. 活用テーマ `#usecases`

`usecases` マーカー → usecases.json の `items` 10件を `.uc-list` に列挙。
見出し「WHERE TO *START*」+ リード「現場と事業の、こんな仕事から始められます。」+
注記 `.uc-note`「※実績ではなく活用イメージです」。トップと同一マーカー・同一 JSON。

### 8. AI・データの取扱い方針 `#data-policy`（静的）

`.policy-grid` に `.policy-card` **4枚**:

1. AIに入力してよい情報
2. 扱うべきでない情報
3. 人による確認・承認
4. お客様のデータの取扱い

末尾 `.policy-note` で顧客側セキュリティ基準への追従と `/privacy/` への導線。
このセクションは content/ に対応 JSON が無く、`fde/index.html` を直接編集する。

### 9. FAQ `#faq`

- `faq-fde` マーカー → faq-fde.json の 11 問を `<details class="faq-item">` で列挙。
  各 item の id は `faq-` + JSON の id（`#faq-what-is-fde` 〜 `#faq-data-security`）
- 11 問の id: what-is-fde / other-industries / no-it-staff / keep-existing / ai-and-judgement /
  small-start / early-stage / how-to-start / cost / area / data-security
- `jsonld-faq-fde` マーカー → 同じ faq-fde.json から FAQPage JSON-LD を生成
  （セクション末尾、`</section>` 直前に置かれている）
- build-content.mjs は faq-top.json と共通の設問 id が文言までずれていないかを検証する
  （ずれると警告。共通設問は同じ文言に揃える運用）

### 10. Insights 導線 `#insights`（静的・フェーズ7で追加）

見出し「進め方の詳細は、記事にまとめています」。`.industry-links` を流用し
`/insights/fde-toha/`・`/insights/dx-roadmap/`・`/insights/`（一覧）の3リンク。
記事が増えたらここは手で追記する（insights.json とは連動しない）。

### 11. CTA `#cta`（`.cta-section`）

- 見出し「困りごとが整理できていなくても、ご相談ください。」+ 「相談する」→ `/#contact`
- `.contact-direct` に TEL / MAIL 直通リンク。番号・アドレスの文字列部分だけ
  `cfg:company.tel` / `cfg:company.email` マーカー（site.config.json の company から注入。
  `href` 属性は静的なので、変更時は build だけでなく href も確認すること）

---

## GA4 イベント（data-ga-event）

| イベント名 | 場所 |
|---|---|
| `click_consultation_cta` | ヘッダー「相談する」/ ヒーロー「相談する」/ CTA セクション「相談する」 |
| `click_roadmap` | ロードマップ末尾「自社に合わせた進め方を相談する」 |
| `click_phone` / `click_email` | CTA セクションの TEL / MAIL |

送出の仕組みは `06-analytics.md` を参照。

---

## マーカー一覧（このページに存在する全マーカー）

`content/` を触ったら `node scripts/build-content.mjs` で注入し、
`node scripts/test-build-content.mjs` の全件合格を確認する（07-update-guide.md 参照）。

| マーカー | 生成物 | データソース |
|---|---|---|
| `jsonld-webpage` | WebPage JSON-LD | site.config.json pages["fde/index.html"] |
| `jsonld-breadcrumb` | BreadcrumbList JSON-LD | 同上（breadcrumb） |
| `jsonld-service-fde` | Service JSON-LD | site.config.json services[id="fde"] |
| `analytics` | dataLayer + gtag.js + /js/analytics.js | site.config.json analytics |
| `breadcrumb` | 表示用パンくず nav | site.config.json pages[].breadcrumb |
| `fde-lead` | H1 + サブコピー | site.config.json messaging.fdeMain / fdeSub |
| `philosophy` | 思想 blockquote | site.config.json messaging.philosophy |
| `service-fde` | サービス定義 dl（可視） | site.config.json services[id="fde"]（jsonld-service-fde と対） |
| `fde-steps-detail` | 3ステップ詳細 | pillars.json crossSection.steps（トップの `fde-steps` と同源） |
| `roadmap` | 12か月ロードマップ | roadmap.json（トップと共通） |
| `usecases` | 活用テーマ10件 | usecases.json（トップと共通） |
| `faq-fde` | FAQ 11問 | faq-fde.json |
| `jsonld-faq-fde` | FAQPage JSON-LD | faq-fde.json（faq-fde と対） |
| `cfg:company.tel` / `cfg:company.email` | 電話番号・メールの文字列 | site.config.json company |

マーカー外（= `fde/index.html` を直接編集する箇所）: ヘッダー / `.hero-plain` / `.page-meta`（公開日・監修者）/
`#position` の NOT 対比と pos-claim / `#industries` 全体 / `#data-policy` 全体 / `#insights` 全体 /
`#cta` の見出し・本文と href / フッター。

---

## 外部から深リンクされているアンカー（id を変えない）

| アンカー | リンク元 |
|---|---|
| `/fde/#roadmap` | insights/gyomu-flow, insights/dx-roadmap（+ ページ内ヒーローの ghost CTA） |
| `/fde/#data-policy` | insights/ai-teichaku, about/index.html |

`html { scroll-padding-top: 88px }`（services/style.css）で固定ヘッダー下に潜らないようにしている。

---

## 計画（00-implementation-brief.md）との差分

| 項目 | 計画 | 実装 |
|---|---|---|
| Insights 導線 | 構成10項目に無い | `#insights` セクションをフェーズ7で追加（FAQ と CTA の間） |
| FAQ 問数 | 「トップ7問を基に必要に応じ拡張」 | 11問に拡張済み |
| ロードマップ「フル版」 | 「フル版・トップと同一データソース」 | データソースだけでなくレンダラーも同一で、トップにも同じフル版が出る（フル/簡略の区別は存在しない） |
| CTA + 問い合わせ導線 | 記載のみ | `/#contact` への CTA に加え、TEL / MAIL 直通（`cfg:company.*` マーカー）を実装 |

構成の順序（H1 → 思想 → 立ち位置 → 対象業種 → 3ステップ → ロードマップ → 活用テーマ →
データ取扱い方針 → FAQ → CTA）は計画どおり。
