# ブログ編集ルール（2026-08-18）

並行作業: トップ / 3Dキャラ / `services/web` のポートフォリオ（床LP・犬図鑑）は別ライン。この文書の対象は `blog/`・`articles/`・サイトマップ・リダイレクト。`index.html`・`character-design/`・`services/dog/pet-floor/`・`services/dog/breeds/` は触らない。

## 公開の合格線

- 読後にコピペできる成果物がある（手順、チェックリスト、比較表、禁止リスト）
- ツールの画面・料金は公式を正とし、本文に最終確認日を書く
- Unsplash の抽象AI画像は使わない。自社写真か表。なければヒーローなし
- 導入は「できるようになること / やらないこと」。学習ゴール見出しのコピー禁止
- `*-master` と `*-team-operations` は作らない
- 原稿は Markdown。公開HTMLは対象ファイルだけ生成する: `python3 scripts/build_blog.py blog/....md`
- 全件ビルド（`python3 scripts/build_blog.py --all`）は下書きの noindex を消すので使わない
- `scripts/cull_blog.py` はワンショット。再実行すると既存の301が消える

## 公開と下書き

- **公開**: 記事一覧に出す。sitemap に載せる
- **下書き（ディスクに残す）**: 書き直し待ち。sitemap に載せない。`<meta name="robots" content="noindex,follow">`
- **廃止**: ファイル削除。`_redirects` で 301

URL対応は [blog-url-map.md](blog-url-map.md)。
