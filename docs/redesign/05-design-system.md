# 05. デザインシステム

2026-09-17 更新。黄色と月夜の濃紺を中心に、既存の世界観と3Dキャラクターを保ちながら、本文・導線・フォームを整理した。判断の根拠と確認手順は [09-moonlight-ui.md](09-moonlight-ui.md) を参照。

## 1. ファイルの役割と適用範囲

| 役割 | ファイル | 適用範囲 |
|---|---|---|
| 共通UIトークン | `css/brand.css` | トップ、FDE、会社概要、Insights一覧 |
| トップの演出基盤 | `css/home.css` | hero、seq、星空・月、SVG/3D配置、テーマ、INDEX |
| トップの情報・操作UI | `css/home-ui.css` | statement以降、固定ナビ、問い合わせ、フッター、INDEXの補足UI |
| 下層の既存基盤 | `services/style.css` | FDE、会社概要、privacy、Insights一覧・記事、サービスなど29ページ |
| 主要下層の新UI | `css/pages.css` | `/fde/`、`/about/`、`/insights/` の3ページのみ |
| トップのUI・演出制御 | `js/home.js` | ナビ、INDEX、音、テーマ、スクロール・GSAP、3D/SVGの切替調整 |
| 3D描画 | `js/character.js` | GLB、マテリアル・照明、カメラ、歩行、描画停止・復帰 |
| 問い合わせ | `contact/form-handler.js` | 検証、Netlify Forms POST、送信状態、結果通知 |

CSSの読み込み順は、トップが **brand → home → home-ui**、主要下層が **brand → services/style → pages**。
主要下層には `body.moonlight-page` と `page-fde` / `page-about` / `page-insights` を付ける。
`pages.css` を他のページに追加しただけで改修対象を広げないこと。

トップは以前のインラインCSS/JSを外部ファイルへ分離した。静的HTMLと生成マーカー方式は維持しており、フレームワークや実行時ビルドは不要。

**別系統のまま維持するページ**:

- ルート `style.css`：404とイベント。
- `articles/style.css`：従来の記事一覧。
- `blog/style.css`：ブログ記事。
- `blog/ai-guide/guide.css`：解説記事（AIツール）。`blog/style.css` の上に `css/brand.css` のトークンで重ねる。出力元は `scripts/build_blog_guide.py`。判断と手順は [10-blog-guide-ui.md](10-blog-guide-ui.md)。
- `services/dog/breeds/style.css`：犬図鑑。
- `services/dog/pet-floor/pet-floor.css`：サービス共通CSSに重ねる独自UI。
- `/recruit/`：ページ内CSS。

`services/style.css` の共通変更は、フォーカス、ヘッダー操作領域、モバイルの戻るリンク、reduced-motionに限定。本文・写真・個別サービスの全面改修は今回の範囲に含めない。

## 2. 共通トークンと役割

`css/brand.css` が新UIの正。色は役割で選び、紫やシアンを新しい主要アクセントにしない。

| トークン | 既定値 | 用途 |
|---|---|---|
| `--ui-bg` | `#000510` | ページの夜空の土台 |
| `--ui-surface` | `#0b1220` | 本文カード・フォーム |
| `--ui-surface-raised` | `#111c2c` | 強調する情報面 |
| `--ui-accent` | `#f5e100` | 主CTA、番号、選択・フォーカス |
| `--ui-text` | `#fffde8` | 見出し・主要ラベル |
| `--ui-body` | `#e7eaf0` | 本文 |
| `--ui-muted` | `#adb5c4` | 補足・メタ情報 |
| `--ui-line` | `rgba(255,253,232,.13)` | 区切り・輪郭 |
| `--ui-glass` / `--ui-edge` | 共通CSSのグラデーション／内側シャドウ | 控えめな面の奥行き。本文全体のぼかしには使わない |
| `--ui-radius` / `--ui-pill` | `16px` / `999px` | 面／CTA |
| `--ui-container` | `1200px` | 新UIの最大外幅（内側余白を含む） |
| `--ui-gutter` | `clamp(20px,4vw,48px)` | トップ本文の左右余白 |
| `--ui-section` | `clamp(64px,8vw,120px)` | トップのセクション間隔 |
| `--ui-fast` / `--ui-motion` / `--ui-slow` | `120ms` / `200ms` / `320ms` | UIの状態変化。reduced-motion時は0ms |

`html[data-theme="red"]` は既存の代替テーマとして維持する。`brand.css` には赤テーマ用の面・文字色の上書きがあるが、主要下層にはテーマ切替を追加していない。

### 既存トークンとの境界

- トップの `--c-*`（既存ブランド色）と `--t-*`（演出・テーマ）は `home.css` に残す。heroの1440pxコンテナ、`--pad`、キャラクター配置は本文用1200pxコンテナとは別。
- moonの `--t-bg-0/-1/-2` は `#000510 / #080e1b / #111a2a`、`--t-accent` は黄色。星空レイヤーの背景は `.theme-layer--moon` も確認する。変数だけ変えても、固定値のグラデーションには反映されない。
- 3Dの色・光・マテリアルは `js/character.js` の `CFG3D`、`GLOW`、`DECALS`、`LINING`、`RIGS` が管理する。UI配色の変更目的でこれらを変更しない。
- 既存下層は `services/style.css` の `--color-*` と1000pxコンテナを維持。同ファイルには基礎と「シネマティック統一」の2つの `:root` があり、後者の上書きに注意。
- 主要下層だけは `.moonlight-page` で `--color-*` を `--ui-*` に対応付け、1200pxコンテナへ変更する。主要下層の左右余白は `clamp(22px,4vw,48px)`。

## 3. タイポグラフィとコンポーネント

フォントは既存の3種類を維持する。

| フォント | 用途 |
|---|---|
| Orbitron | 短い英字ラベル・番号・ブランド表記 |
| Bebas Neue | 英語の大見出し・大きな番号 |
| Noto Sans JP | 日本語見出し・本文・読みやすさを優先するナビとCTA |

トップ・主要下層の本文は原則16px、補助情報は14pxを基本とする（短い英字ラベル・番号・バッジは別階層）。フォーム入力は16px以上。日本語見出しにBebasの巨大サイズを継承させず、和文用セレクタを明示する。

| 部品 | 現行の扱い | 編集元 |
|---|---|---|
| 固定ナビ | 事業一覧、AI・DX実装支援、Insights、会社概要と相談CTA。完全な導線はINDEXに保持 | `renderNav` / `content/site.config.json`、`home-ui.css` |
| statement / FDE横断 | 左右の情報階層、3ステップをつなぐ図解 | `messaging` / `pillars.json`、`home-ui.css` |
| 3本柱・サービス | 3領域の入口、7事業の画像カード、8支援内容の行を分けて扱う | `pillars.json` / `services`、トップの静的カード |
| 課題・活用テーマ | 番号と区切りによる一覧 | `challenges.json` / `usecases.json` |
| ロードマップ | 4フェーズのdetails。成果物は `.rm-deliv` | `roadmap.json`、トップとFDEで共有 |
| FAQ | native details / summary。Q表示はCSS疑似要素 | `faq-top.json` / `faq-fde.json`、FAQPageも同時生成 |
| お問い合わせ | 相談文とフォームの2列、必須／任意、送信ボタン付近の結果領域 | `contact.fields` / `contact.errors`、フォームJS |
| FDE下層 | 目次を常設。デスクトップは左レール、900px以下は横スクロールの目次 | `fde/index.html`、`pages.css` |
| 会社概要 | ミッション／会社情報の左右構成、価値観の一覧、3本柱 | `about/index.html` と生成マーカー、`pages.css` |
| Insights一覧 | 最初の記事を強調し、以降はカテゴリ・見出し・概要を揃えた行 | `insights.json`、`pages.css` |
| Insights記事 | 既存の `post-*` / `related-*` を維持 | 各記事HTML、`services/style.css` |

クラス名は生成側とCSSの契約。生成されたDOMに存在しないクラスへスタイルを追加しない。
`BEGIN:*` 内の構造を変える場合は `scripts/build-content.mjs` を編集し、全HTMLを同期する。

## 4. 操作・レスポンシブ・演出の保護

- ナビ・主要CTA・チェック同意ラベル等は44px以上の操作領域を確保。フォーム入力は48px以上。
- 主要下層にはmain、本文へのskip link、明確なfocusを設置。モバイルで戻るリンクのテキストを隠す場合も、アクセシブル名を残す。
- トップの事業画像カードは768px以上でグリッド、767px以下で横スクロール。プログレスのJS条件も合わせる。
- FDE目次は固定ヘッダーの高さに合わせる。主要下層は680px以下でヘッダーが2段になるため、目次とアンカー位置を同時に確認する。
- `#hero` / `#seq`、キャラクター用DOM、カメラ経路・ターン・歩行アニメーションは保護対象。`body` / `main` / `section` の祖先にtransform・filter・perspectiveを付けない。
- INDEX内の同一ページリンクは `#...` + `data-scroll`。モーダルを閉じ、背景ロックを解除してから目的位置へフォーカスを移す。
- reduced-motionはCSSとJSの両方で追従。本文を非表示にしたまま残さず、3Dが使えない場合はSVGへ戻す。主要下層の星・月・ギャラリーにも設定を適用する。
- 既存下層には全体の `ul { list-style:none }` がない。新しいリストはマーカーと余白を明示する。
- 原文の `<br>` はカード幅に合わないことがある。改行の非表示で自然に流し、固定コピー自体は変更しない。

## 5. 画像と検証

OGPは `images/ogp/ogp-default.png`（1200×630）。faviconはICOとPNG、Apple用180px、Android用maskable512pxを使用する。
`logo/cuculfm.svg` はJSON-LD等のロゴ用途を維持するが、2026-08-30以降はファビコンに使わない。詳細は [07-update-guide.md](07-update-guide.md) を参照。

既存の3Dモデル、事業・掲示板画像を利用し、架空の実績や顧客ロゴ、新しい人物画像は追加しない。犬写真を扱う既存下層へfilterを新設しない。

コード検証はコンテンツ同期、フォーム、3D保護の3系統を使う。ブラウザーでの見た目・操作確認は別工程であり、自動テストの合格だけで完了扱いにしない。再現コマンドは [09-moonlight-ui.md](09-moonlight-ui.md) に記載。
