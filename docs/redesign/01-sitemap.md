# 01. 改修後サイトマップ

フェーズ8完了時点（2026-08-30）の公開URL構成。
**正となるデータは sitemap.xml**（`node scripts/generate-sitemap.mjs` で自動生成）。
以下のツリーは `node scripts/generate-sitemap.mjs --list` の実行結果（48件）を全数掲載したもの。

計画書（00-implementation-brief.md「改修後サイトマップ」）との差分:

- 計画では `/services/*` を「既存20ページ」と書いていたが、sitemap 掲載は **19 URL**
  （ディレクトリ18 + `/services/dog/breeds/detail.html` 1件）
- `/privacy/` は計画上「新規」扱いだが、実装はフェーズ4（Netlify Forms化）のコミット
  `a374031` で追加済み。それ以外のURL集合は計画どおり

---

## 1. URLツリー（sitemap.xml の48件・全数）

★新設 = 今回の改修（2026-08-29〜）で追加したページ。

```
/                                        トップ
├─ /fde/                                 FDE・AI実装支援 ★新設
├─ /about/                               会社概要 ★新設
├─ /privacy/                             プライバシーポリシー ★新設
├─ /insights/                            Insights 記事一覧 ★新設
│   ├─ /insights/fde-toha/               FDEとは何か ★新設
│   ├─ /insights/genba-dx/               現場DXとは何か ★新設
│   ├─ /insights/ai-teichaku/            AI導入が現場に定着しない理由 ★新設
│   ├─ /insights/gyomu-flow/             業務フロー診断の進め方 ★新設
│   ├─ /insights/saas-vs-custom/         SaaS導入と個別開発の選び方 ★新設
│   ├─ /insights/ai-usecases/            現場・バックオフィスのAI活用例 ★新設
│   ├─ /insights/data-foundation/        散らばる情報を業務データへ変える方法 ★新設
│   └─ /insights/dx-roadmap/             中小企業がDXを進める12か月ロードマップ ★新設
├─ /services/                            （一覧ページなし。各サービスは直下ディレクトリ）
│   ├─ /services/ai/                     DX・業務効率化システム開発
│   ├─ /services/ai-tools/               AIツール紹介 / 学習
│   ├─ /services/construction/           建設業
│   ├─ /services/inspection/             調査・清掃
│   ├─ /services/tools/                  工具販売
│   ├─ /services/craft/                  オリジナルクラフト販売
│   ├─ /services/custom/                 オーダーメイド製品販売
│   ├─ /services/video/                  映像制作・編集
│   ├─ /services/document/               資料作成
│   ├─ /services/media/                  メディア運営
│   ├─ /services/web/                    Web制作・3D・アプリ開発
│   ├─ /services/dog/                    犬に携わる業務
│   │   ├─ /services/dog/breeds/         犬図鑑
│   │   │   └─ /services/dog/breeds/detail.html   犬種詳細（services 配下で唯一の .html 直URL）
│   │   └─ /services/dog/pet-floor/      CUCULペットの床
│   └─ /services/condo/                  オーナーズコモン
│       ├─ /services/condo/garage/       プライベートガレージ
│       ├─ /services/condo/hideaway/     共有型隠れ家
│       └─ /services/condo/mahjong/      高級麻雀スペース
├─ /blog/                                （一覧ページなし。存続13本のみ・すべて .html）
│   ├─ /blog/dog/home-grooming.html
│   ├─ /blog/dog/puppy-preparation.html
│   ├─ /blog/dog/seasonal-health-care.html
│   ├─ /blog/dog/trust-relationship.html
│   ├─ /blog/inspection/aircon-cleaning.html
│   ├─ /blog/inspection/drone-wall-inspection.html
│   ├─ /blog/inspection/gutter-cleaning.html
│   ├─ /blog/inspection/manhole-safety.html
│   ├─ /blog/inspection/sewer-camera-methods.html
│   ├─ /blog/inspection/sewer-damage-report.html
│   ├─ /blog/inspection/sewer-exam-study.html
│   ├─ /blog/inspection/sewer-qualifications.html
│   └─ /blog/inspection/solar-panel-cleaning.html
├─ /articles/                            記事一覧（旧）
├─ /event/                               イベント告知
└─ /recruit/                             アルバイト募集
```

内訳: トップ1 + 新設12（fde / about / privacy / insights 9）+ services 19 + blog 13 + articles / event / recruit 3 = **48**。

changefreq / priority は `scripts/generate-sitemap.mjs` の `RULES` 配列が一元管理している
（トップ 1.0、insights 一覧・fde・services 0.9、記事・about 0.8、privacy 0.3 など）。

---

## 2. トップページ（index.html）のアンカー一覧

`<main>` 内の section id を上から順に。**変更禁止**＝下層ページ・ナビから深リンクされているもの。

| id | 内容 | 変更禁止 |
|---|---|---|
| `#hero` | ファーストビュー（キャラクター・音声・テーマ切替） | |
| `#statement` | 「現場と事業に、技術を定着させる。」 | |
| `#seq` | シネマティックシーケンス（canvas + 3D） | |
| `#fde-cross` | FDE横断セクション「技術を、現場で使われる仕組みへ。」 | |
| `#business` | OUR BUSINESS（3本柱 + サービスカード） | ✔ |
| `#challenges` | COMMON ISSUES | |
| `#roadmap` | HOW WE WORK（4ステップ） | |
| `#usecases` | WHERE TO START | |
| `#news` | BULLETIN BOARD | |
| `#about` | 会社情報 | ✔ |
| `#faq` | FAQ | |
| `#contact` | お問い合わせ（Netlify Forms） | ✔ |

`#business` 内の3本柱カード（`<article>` の id）もナビが参照するため**変更禁止**:

| id | 柱 |
|---|---|
| `#pillar-construction` | Construction & Infrastructure |
| `#pillar-creative` | Creative & Tech |
| `#pillar-lifestyle` | Lifestyle |

section 以外の主要 id: `#gnav`（ヘッダー）、`#index-overlay`（INDEXオーバーレイ。`<main>` 外・body 直下）、
`#site-bgm`（BGM audio）、`#loader`。

---

## 3. 主要導線の対応表

### グローバルヘッダー（`#gnav`。`<!-- BEGIN:nav -->` 区間 = build-content.mjs が注入）

| 表示 | リンク先 |
|---|---|
| CUCULFM.LLC（ブランド） | `#hero` |
| Our Service | `#business` |
| FDE・AI実装支援 | `/fde/` |
| Construction & Infrastructure | `#pillar-construction` |
| Creative & Tech | `#pillar-creative` |
| Lifestyle | `#pillar-lifestyle` |
| Insights | `/insights/` |
| About Us | `/about/` |
| Contact | `#contact` |
| 相談する（CTA。`data-ga-event="click_consultation_cta"`） | `#contact` |
| MENU（`#btn-index-gnav`） | `#index-overlay` を開く |

### フッター（`.site-footer`）

| 列 | リンク |
|---|---|
| Services | `/fde/`・`/services/ai/`・`/services/construction/`・`/services/inspection/`・`/services/tools/`・`/services/craft/`・`/services/video/`・`/services/document/`・`/services/web/`・`/services/dog/` |
| News & Company | `/insights/`・`/articles/`・`/recruit/`・`/event/`・`/services/dog/#puppies`・`/about/`・`#about`・`#contact`・`/privacy/` |
| SNS | Instagram（cuculfm_llc）・X（madarame365） |

### INDEXオーバーレイ（`#index-overlay`。3グループ）

| グループ | リンク |
|---|---|
| Services（10件） | フッター Services 列と同一の10件（`/fde/` 〜 `/services/dog/`） |
| News & Info（5件） | `/insights/`・`/articles/`・`/recruit/`・`/event/`・`/services/dog/#puppies` |
| Company（5件） | `/about/`・`#about`・`#contact`・`tel:09062623842`・`/privacy/` |

---

## 4. sitemap から除外しているもの

`scripts/generate-sitemap.mjs` 冒頭の `SKIP_DIRS` / `SKIP_FILES` に列挙。

| 除外 | 対象 |
|---|---|
| `SKIP_DIRS` | `.git` `.netlify` `.claude` `node_modules` `__pycache__` `scripts` `docs` `note` `documents` `terminals` `character-design` `content` `images` `audio` `videos` `logo` |
| `SKIP_FILES` | `404.html` |
| メタタグ | `<meta name="robots" content="noindex">` のページ（404.html が該当） |

補足:

- `character-design/` は sitemap 外だが**配信は生きている**（トップの3Dキャラが
  `/character-design/phantom-dj/model.glb` を読むため。_redirects で塞ぐのは開発用ビューア2ファイルのみ）
- `index.html` はディレクトリURL（末尾スラッシュ）へ正規化、それ以外は `.html` のまま掲載
- lastmod は git 最終コミット日（未コミット・git 管理外は mtime）

---

## 5. _redirects の概要

役割は2つ。詳細・経緯コメントは `_redirects` 実ファイル参照。

### 配信停止（`404!` force。社内向けファイルの公開防止・2026-08-29）

| パス | 備考 |
|---|---|
| `/docs/*` `/content/*` `/scripts/*` | ディレクトリごと停止 |
| `/AGENTS.md` `/CLAUDE.md` `/SEO_LMO_BEST_PRACTICES.md` | ルート直下の .md |
| `/character-design/phantom-dj/viewer.html` `viewer-procedural.html` | 開発用ビューアのみ（model.glb は配信継続） |

末尾の `!`（force）が無いと実在ファイルが優先されてルールが効かない（実測済み）。
日本語ファイル名（会社内容.md）はパス一致が効かなかったため docs/ へ移動して対応した。

### 301 リダイレクト（統廃合の受け皿）

| 旧 | 新 |
|---|---|
| `/top-v2/*` | `/`（トップ昇格に伴う） |
| `/blog/dog/dog-care-basics.html` | `/blog/dog/home-grooming.html` |
| `/blog/construction/*` | `/services/construction/` |
| `/blog/craft/*` `/blog/tools/*` | `/services/tools/` |
| `/blog/custom/*` | `/services/custom/` |
| `/blog/document/*` `/blog/media/*` `/blog/video/*` | `/services/video/` |
| `/blog/condo/*` | `/services/condo/` |
| `/blog/ai-tools/*` `/blog/ai/*` | `/services/ai-tools/` |
| `/blog/web/*` | `/services/web/` |

---

## 6. URL設計のルール

| ルール | 内容 |
|---|---|
| 基本形 | ディレクトリURL + 末尾スラッシュ（`/fde/` `/insights/fde-toha/`）。実体は各ディレクトリの `index.html` |
| `.html` 直URLの例外 | `/blog/` 配下の記事13本と `/services/dog/breeds/detail.html` のみ |
| 文字種 | 英小文字 + ハイフン（`saas-vs-custom` `pet-floor`）。アンダースコア・大文字・日本語は使わない |
| 記事スラッグ | ローマ字/英語の意味が通る短い語（`fde-toha` `genba-dx`）。計画時の `sas-vs-custom` は `saas-vs-custom` に修正済み |
| 新設ページ | ルート直下（`/fde/` `/about/`）または `/insights/` 配下。`/services/` 配下は既存事業のみ |
| sitemap への反映 | ページ追加・削除後に `node scripts/generate-sitemap.mjs` を実行して sitemap.xml を再生成する |
