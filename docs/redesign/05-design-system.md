# 05. デザインシステム

改修で触る CSS は主に **2系統**。どちらを触っているかを最初に確認すること。

| 系統 | 場所 | 適用ページ | トークン接頭辞 | コンテナ幅 |
|---|---|---|---|---|
| A | トップ `index.html` のインラインCSS（`:root` は136行目〜） | トップのみ（単一HTML完結） | `--c-*`（ブランド色）+ `--t-*`（テーマ連動） | `--container:1440px` |
| B | `/services/style.css`（`:root` は9行目〜） | **改修対象の下層**（/fde/ /about/ /privacy/ /insights/ /services/*） | `--color-*` | `--container-max:1000px` |

- 改修対象ページは `<link rel="stylesheet" href="/services/style.css">` を読む。トップは外部CSSを読まない
- **例外（services/style.css を編集しても変わらないページ）**:
  - ルート `/style.css`（569行）… `404.html`（14行目）と `/event/`（event/index.html 28行目）が読む。ファイル冒頭コメントにも「Shared Styles for 404.html / event/」と明記
  - `/articles/style.css`（938行）… `/articles/`（articles/index.html 28行目）が読む
  - `/blog/style.css`（448行）… blog 記事13本が `../style.css` で読む
  - `/recruit/` … ローカルCSSを一切読まず、インライン `<style>` のみで完結
- **計画との差分**: `00-implementation-brief.md` には「下層は1200px」とあるが、実際の `style.css` は `--container-max: 1000px`。実装が正
- `style.css` は末尾（2143行目〜「シネマティック統一 (2026-08-20)」）で同名セレクタの上書きを重ねる構成。
  `:root` も2箇所ある（9行目=基礎、2143行目=シネマ上書き）。**色を変えるときは末尾の `:root` が勝つ**

---

## 1. トークン一覧

### A) トップ `index.html`（インラインCSS）

ブランド色（テーマによらず固定）:

| トークン | 値 |
|---|---|
| `--c-primary` | `#f5e100` |
| `--c-primary-glow` | `rgba(245,225,0,.28)` |
| `--c-secondary` | `#7b61ff` |
| `--c-accent` | `#ff6b6b` |
| `--c-amber` | `#fac458` |
| `--c-cyan` | `#00cce6` |
| `--c-magenta` | `#e666e6` |
| `--c-grey` | `#828788` |
| `--c-mint` | `#00f5d4` |

テーマ連動トークン（`--t-*`）。既定は `<html lang="ja" data-theme="moon">` だが、
**moon 用のセレクタは存在しない**。素の `:root` の値が moon（MIDNIGHT）で、
`html[data-theme="red"]{...}`（179行目〜）が red の上書き。主要なもの:

| トークン | moon（既定 = `:root`） | red |
|---|---|---|
| `--t-bg-0` / `-1` / `-2` | `#000510` / `#0a0a1a` / `#0f0f20` | `#160208` / `#200510` / `#2a0714` |
| `--t-accent` | `#00f5d4` | `#f5e100` |
| `--t-text` | `#ffffff` | `#fff4f4` |
| `--t-muted` | `#8a8a9b` | `#c39a9a` |
| `--t-dim` | `#80809a`（WCAG AA 4.5:1 以上） | `#a87a84`（同） |
| `--t-line` | `rgba(255,255,255,.10)` | `rgba(255,190,190,.14)` |
| `--t-pill` | `rgba(255,255,255,.05)` | `rgba(255,120,120,.07)` |
| `--t-bar`（固定ヘッダー下地） | `rgba(5,7,20,.78)` | `rgba(22,4,10,.80)` |
| `--t-moon` | `#fffde8` | `#ffe8e0` |
| `--t-vignette` | `rgba(0,0,0,.55)` | `rgba(30,0,8,.65)` |

ほかに演出用の `--t-glow-a/b` `--t-title` `--t-title-glow` `--t-char-rim` `--t-particle`
`--t-moon-red` `--t-beam` `--t-media-tint` がある（値は `index.html` 136〜201行目参照）。
余白は `--pad:clamp(18px,4vw,46px)`。

### B) 下層 `/services/style.css`

基礎 `:root`（9行目〜）:

| トークン | 値 |
|---|---|
| `--color-bg-dark` | `#0a0a0f` |
| `--color-bg-darker` | `#050508` |
| `--color-bg-card` | `#12121a` |
| `--color-bg-card-hover` | `#1a1a25` |
| `--color-primary` | `rgba(245, 233, 0, 0.938)` |
| `--color-primary-glow` | `rgba(245, 233, 0, 0.3)` |
| `--color-secondary` | `#7b61ff` |
| `--color-accent` | `#ff6b6b` |
| `--color-text` | `#ffffff` |
| `--color-text-muted` | `#8a8a9b` |
| `--color-text-dim` | `#5a5a6b` |
| `--color-border` | `rgba(255, 255, 255, 0.08)` |
| `--color-border-hover` | `rgba(245, 233, 0, 0.3)` |
| `--section-padding` | `clamp(60px, 10vw, 120px)` |
| `--container-max` | `1000px` |
| `--container-padding` | `clamp(20px, 5vw, 40px)` |
| `--transition-fast` / `--transition-medium` | `0.2s ease` / `0.4s ease` |

シネマ上書き `:root`（2143行目〜。**こちらが最終的に効く**）:

| トークン | 値 |
|---|---|
| `--color-primary` | `#f5e100` |
| `--color-primary-glow` | `rgba(245, 225, 0, 0.28)` |
| `--color-border-hover` | `rgba(245, 225, 0, 0.35)` |
| `--color-bg-dark` | `#000510` |
| `--color-bg-darker` | `#02030a` |
| `--color-bg-card` | `#0d0d1c` |
| `--color-bg-card-hover` | `#131328` |
| `--c-gold` / `--c-gold-soft` / `--c-gold-line` | `rgba(212, 160, 23, 0.55)` / `(0.25)` / `(0.18)` |
| `--c-cyan` | `#00cce6` |

下層には `--t-*` は無く、テーマ切替（moon/red）も無い。

---

## 2. フォント

Google Fonts から読み込み（トップ・下層とも）。トークン名は両系統で同じ。

| トークン | フォント | 用途 |
|---|---|---|
| `--font-display` | `'Orbitron'` | 英字ラベル・eyebrow・ナビ・ピル（小さく・letter-spacing 広め・uppercase） |
| `--font-heading` | `'Bebas Neue'` | 英語の大見出し（H2 の巨大タイポ）。**和文には使わない**（後述の罠参照） |
| `--font-body` | `'Noto Sans JP'` | 本文・和文見出し |

フォールバックは実ファイルどおり
`-apple-system,BlinkMacSystemFont,sans-serif`（display/heading）、
`'Hiragino Kaku Gothic ProN','Hiragino Sans',Meiryo,sans-serif`（body）。

---

## 3. 見出しパターン

| 場所 | 構造 | 実装 |
|---|---|---|
| トップ | `.eyebrow`（Orbitron英字ラベル）→ Bebas の英語 H2（`em` でアクセント色）→ 日本語リード | `index.html` 1085行目付近のコメントどおり「eyebrow → Bebas の英語 h2 → 日本語リード」。既存 `.biz-head` / `.news-head` と同じ骨格を `#fde-cross` 以降の追加セクションでも踏襲 |
| 下層 | `.section-label`（Orbitron 0.625rem・`--color-primary`）→ `.section-title`（1.5rem・700） | `style.css` 358 / 366行目 |

トップの和文大見出し（`.stm-title` `.fde-heading` `.ct-heading`）は、句読点で区切った
`<span>` を `display:inline-block` にして「語中で割れない改行」にしている。同型を増やすときはこの扱いを揃える。

---

## 4. 改修で追加した主要コンポーネント

クラス名は `scripts/build-content.mjs` が生成する HTML と対になっているため**変えない**。
「データソース」列は `content/` の JSON とマーカーキー（`<!-- BEGIN:キー -->`）。

| 接頭辞 | 用途 | 使用ページ | CSS定義 | データソース |
|---|---|---|---|---|
| `gnav-*` | グローバルヘッダー（ナビ+相談CTA）。下層のヘッダーは別物（`.service-header` / `.header-cta`） | トップのみ | index.html | `BEGIN:nav` ← site.config.json `nav` |
| `stm-*` | ヒーロー直下 `#statement`（技術定着メッセージ+CTA2つ） | トップ | index.html | `BEGIN:hero-copy` ← site.config.json `messaging` |
| `fde-*` | FDE横断セクション `#fde-cross`（`.fde-in` `.fde-heading` `.fde-body` `.fde-steps`）と /fde/ のリード（`.fde-main` `.fde-sub`） | トップ・/fde/ | 両方 | `BEGIN:fde-cross` / `fde-steps` / `fde-steps-detail` ← pillars.json `crossSection`、`BEGIN:fde-lead` ← site.config.json `messaging` |
| `pillar-*` | 3本柱カード（アンカー `#pillar-construction` / `-creative` / `-lifestyle` は変更禁止） | トップ・/about/ | 両方 | `BEGIN:pillars` ← pillars.json |
| `chal-*` | 課題提起カード8枚 `#challenges` + 締め文 | トップ | index.html | `BEGIN:challenges` ← challenges.json |
| `rm-*` | 12か月ロードマップ4フェーズ `#roadmap` | トップ・/fde/ | 両方 | `BEGIN:roadmap` ← roadmap.json |
| `uc-*` | 活用テーマ10項目 `#usecases`（`.uc-note` = 活用イメージ注記） | トップ・/fde/ | 両方 | `BEGIN:usecases` ← usecases.json |
| `faq-*` | FAQ（`.faq-item` `.faq-q` `.faq-a`） | トップ・/fde/ | 両方 | `BEGIN:faq-top` / `faq-fde` ← faq-top.json / faq-fde.json |
| `ct-*` | 問い合わせ `#contact`（Netlify Forms。`.ct-heading` `.ct-body` `.ct-form-box`） | トップのみ | index.html | `BEGIN:contact-copy` / `contact-fields` / `contact-config` ← site.config.json `contact`。ご相談の種類の `<option>` は `contact-fields` 内で生成される（`contact-subjects` は build-content.mjs のレンダラーキーとしてのみ存在し、ページにマーカーは無い） |
| `post-*` | 記事本文（`.post-title` `.post-meta` `.post-toc` `.post-body` `.post-table` `.post-close`） | /insights/ 記事8本 | style.css（フェーズ6ブロック 3490行目〜） | 本文は各HTML直書き。メタは `BEGIN:article-meta` ← insights.json |
| `ins-*` | 記事一覧カード（`.ins-card` `.ins-cat` `.ins-title` `.ins-excerpt`） | /insights/ | style.css | `BEGIN:insights-list` ← insights.json |
| `related-*` | 記事末尾の関連記事リンク | 記事8本 | style.css | `BEGIN:article-related` ← insights.json |
| `policy-*` | 「AI・データの取扱い方針」カード（2列グリッド） | /fde/ | style.css | 静的（マーカーなし。fde/index.html 481行目〜） |
| `breadcrumb` | パンくず。表示と BreadcrumbList JSON-LD を同一データから生成 | 下層の新規ページ全部（/fde/ /about/ /privacy/ /insights/ 一覧+記事） | style.css（フェーズ4ブロック 2351行目〜） | `BEGIN:breadcrumb` ← site.config.json `pages[相対パス].breadcrumb` |
| `industry-links` | 対象領域リンク群 | /fde/ | style.css | 静的 |
| `shop-link` | 外部リンクボタン（改修前からある既存部品） | /services/dog/ /services/web/ /services/ai/ | style.css（1220行目） | 静的 |
| `cta-section` | 下層共通の締めCTA（改修前からある既存部品を新規ページでも再利用） | /fde/ /about/ /privacy/ /insights/ ほか | style.css（2003行目） | 静的。電話・メールは `BEGIN:cfg:company.tel` 等のインライン展開 |

補助: `.doc-list` `.doc-dl` `.doc-body`（読み物の最小セット、フェーズ4）、
`.step-card` `.step-body` `.step-detail`（/fde/ の3ステップ詳細、フェーズ5）も style.css にある。

---

## 5. 実装上の注意（過去に踏んだ罠）

1. **和文見出しの詳細度**。トップの `.ct-in h2` のような「セクション内 h2」指定は
   Bebas の巨大サイズ（例: `clamp(2rem,5.4vw,4.2rem)`）を持つ。和文見出しクラスを
   `.ct-heading` 単独で書くと詳細度で負けて**和文に Bebas サイズが当たり巨大化する**。
   `index.html` のコメントどおり `.ct-in .ct-heading` のように同じ詳細度以上で書くこと。
2. **下層のリストマーカー**。`style.css` には `ul { list-style:none }` の共通指定が**無い**
   （トップのインラインCSSには有る）。しかも `* { padding:0 }` でマーカーの居場所だけ消えるため、
   素の `<ul>` は「マーカーが枠外にはみ出す/消える」状態になる。新しいリストには
   `list-style:none` を明示するか、`.doc-list` 等の既存クラスを使う（style.css 2482行目のコメント参照）。
3. **`--t-*` は下層に無い**。トップのCSSを下層へ移植するときは `--color-*` へ読み替える
   （例: `--t-text` → `--color-text`、`--t-muted` → `--color-text-muted`、`--t-line` → `--color-border`）。
   style.css のフェーズ5ブロック冒頭コメントにもこの方針を明記済み。
4. **下層コンテナは1000px**。トップ（1440px）向けに `<br>` で改行位置を決めた原文を
   3列カードに流し込むと1列が狭く行が割れる。style.css は
   `.step-body br, .pillar-body br, .pillar-note-body br { display: none; }`（2841行目〜）で
   `<br>` を無効化して自然に流している（テキスト自体は1文字も変えない）。
   同様のカードを増やしたらこのセレクタに追記する。

---

## 6. 画像アセット規約

| アセット | パス | 仕様 |
|---|---|---|
| OGP画像 | `/images/ogp/ogp-default.png` | 1200×630 PNG（実測確認済み）。`og:image` / `twitter:image` は `https://cucul-fm.com/...` の絶対URLで書く |
| favicon（PNG） | `/images/icons/favicon-192.png` / `favicon-512.png` | 192×192 / 512×512。192 は `apple-touch-icon` 兼用 |
| favicon（SVG） | `/logo/cuculfm.svg` | `<link rel="icon" ... type="image/svg+xml" sizes="any">`。JSON-LD Organization の `logo` にも使用 |
| manifest | `/site.webmanifest` | 512 PNG を参照 |

禁止事項（要件・ブリーフより）:

- 安易なロボット画像・ネオン調・サイバーパンク調・安っぽいAI生成風の人物画像を使わない
- 既存ヒーロービジュアルを維持するため、新規ビジュアルは原則不要
- 下層の犬写真は無加工（`img` への `filter` 新設禁止。style.css シネマ統一ブロックの掟）
