# 10. 解説記事テンプレート（/blog/ai-guide/）— 判断と更新手順

2026-09-24。対象は `/blog/ai-guide/` の解説記事（AIツールの特徴・料金・比較など）。
既存の `/blog/inspection/`・`/blog/dog/` は `scripts/build_blog.py` のまま変更していない。

## 1. なぜ別テンプレートにしたか

解説記事は、既存のブログ記事より長く、比較表・画面のスクショ・図が多い。
既存テンプレートのまま載せると、次の問題が出た（2026-09-24、ローカルで確認）。

- 本文中の画像に幅の上限がなく、ページが横に約2,950pxまで広がる
- スマホ幅で比較表がはみ出す
- 画像の説明文が、ただの斜体の段落になる
- 見出しが多く、目次がないと目的の箇所を探しにくい

## 2. デザインの判断（Refero MCPで調査）

参考は Refero MCP で確認したデザイン名で記録する。各サイト全体の再現ではなく、採用した役割の範囲を示す。

| 判断 | 参考（Refero） | 採用した役割 |
|---|---|---|
| 暗い面の段差と細い線で区切り、影に頼らない。本文優先で装飾を抑える | Linear Changelog（style） | 面・線・余白の基本。見出しは太らせすぎない |
| 黄色は機能にだけ使う（主CTA・見出し番号・目次の現在地・フォーカス） | LogoArchive（style） | アクセントの使い方。スクショは枠に収めて見せる |
| 本文列＋右の追従目次、目次の下に小さな相談カード | Leonardo.ai、Huddlekit（screens：暗色の長文記事） | デスクトップの2列構成 |
| 記事末の相談導線、関連記事カード | Rox、Huddlekit（screens） | 読み終えた人の次の行動 |
| 比較表は細い罫線と見出し行の面で区切る | Leonardo.ai（screen：比較表） | 表の見た目 |

**採らなかったもの**：多色のアクセント、光るグラデーション、全面の大きな写真、英字の巨大見出し。
色は `css/brand.css` のトークン（`--ui-*`）だけを使い、紫・シアンを新しく足していない。

## 3. 実装の境界

| 役割 | ファイル |
|---|---|
| HTMLの出力 | `scripts/build_blog_guide.py`（`build_blog.py` の `parse_md` / `md_to_html` を再利用） |
| 見た目 | `blog/ai-guide/guide.css`（読み込み順：`blog/style.css` → `css/brand.css` → `guide.css`） |
| 補助スクリプト | `blog/ai-guide/guide.js`（目次の現在地、狭い画面で目次を閉じる、表の横スクロール案内） |
| 記事一覧のカード | `scripts/cardgen/gen-mtg-cards.mjs` の `ai-guide` カテゴリ |

- クラス名（`g-*`）は `build_blog_guide.py` との契約。出力にないクラスへスタイルを足さない。
- `build_blog.py` は `blog/ai-guide/` を読み飛ばす（`--all` を付けても上書きしない）。
- 公開URLは `.html` を外した形（例：`https://cucul-fm.com/blog/ai-guide/cursor-2026-09`）。canonical・og:url・構造化データ・sitemap.xml はすべてこの形にそろえる（2026-09-25）。本番はNetlifyのPretty URLsで、サイト内リンクの `.html` も自動で外れる
- JSがなくても、本文・目次・表はすべて読める。reduced-motion ではスムーズスクロールと動きを止める。
- 操作領域は44px以上、主CTAは48px。フォーカスは黄色の輪郭。

## 4. 記事の追加手順

1. `blog/ai-guide/<slug>.md` を置く（見出しブロックは既存記事と同じ：`# タイトル`、アイキャッチ画像、`**公開日**`・`**カテゴリ**`・`**著者**`・`**概要**`、`---`）
2. 画像は `images/blog/<slug>/` に置き、本文からは `../../images/blog/<slug>/ファイル名` で参照する
   - 画像の直後の行を `*説明文*` にすると、図の説明（figcaption）になる
   - 末尾の「問い合わせリンクだけの段落」とその直前の段落は、相談導線の枠になる
   - `## 関連記事` の箇条書きは、関連記事カードになる
   - 文字の多い図（年表など）は幅760pxで作る。本文幅（最大720px）でもスマホ幅（約350px）でも読める大きさになる。幅1200pxの図はスマホで文字が5px前後まで縮む
3. `python3 scripts/build_blog_guide.py blog/ai-guide/<slug>.md`
4. 記事一覧 `articles/index.html` にカードを追加し、カード画像を生成する
   `python3 -m http.server 8123` を起動した状態で `cd scripts/cardgen && node gen-mtg-cards.mjs <slug>`
5. `node scripts/generate-sitemap.mjs` → `node scripts/test-build-content.mjs`
6. 別ブランチにpushしてプレビューを確認してから `main` へ

## 5. 確認した範囲（2026-09-24）

Chromium（Playwright）で幅1440 / 1024 / 768 / 390 / 320pxを描画し、2記事とも横はみ出しなし、見出し・段落のクリップなし。
目次の現在地の切り替え、スマホ幅での目次の開閉、表の横スクロール案内の表示を確認。
外部フォント・GA4は検証環境から読み込めないため、フォントは代替表示で確認している。
Safari・Firefox・実機は未確認。

## 6. 記事の更新（改訂版を出すとき）

2026-09-24 追加。AIツールの記事は、2週間ごとに公式の更新履歴・料金ページを確認し、大きな変更があれば改訂版を出す（台帳：Claudeプロジェクトの `claude/記事更新台帳.md`）。

1. `blog/ai-guide/<slug>.md` の見出しブロックに、`**公開日**` の次の行として `**更新日**: YYYY.MM.DD` を足す（公開日は変えない）
2. 本文を直し、`python3 scripts/build_blog_guide.py blog/ai-guide/<slug>.md`
   - 更新日は、記事上部の「更新日」と、構造化データの `dateModified` に入る。`**更新日**` がない記事は、今までどおり公開日だけを表示する
3. `node scripts/generate-sitemap.mjs` → `node scripts/test-build-content.mjs`
4. `main` に反映したあと、Google Search Consoleの「URL検査」に `.html` を外したURLを貼り、「インデックス登録をリクエスト」を押す
