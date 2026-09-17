# 07. 更新・運用ガイド

このサイトの設定変更・情報更新のやり方をまとめたもの。

2026-09-17 のUI改修後も静的HTML＋コンテンツ同期方式を維持する。CSS/JSの編集場所は
本書「4. 文言や一覧を変更する」の末尾と [05-design-system.md](05-design-system.md)、
改修の判断・検証手順は [09-moonlight-ui.md](09-moonlight-ui.md) を参照。

---

## 最初に知っておくこと: push すると本番に出る

このサイトは GitHub リポジトリ `cuculfm0113/cuculfm-hp` と連携していて、
**`main` に push した時点で自動的に本番（https://cucul-fm.com）へ反映される**。
「コミットしただけ」では出ないが、「push したら出る」。プレビュー確認をはさみたいときは
別ブランチに push すること。

デプロイの状況は Netlify の `Deploys` 画面、またはコマンドで確認できる。

```bash
netlify api listSiteDeploys --data '{"site_id":"6121d456-5d60-4371-b63c-25372f32737d","per_page":3}'
```

---

## 1. お問い合わせフォームの通知先（設定済み）

**2026-08-29 に設定・動作確認済み。** Netlify Forms に `contact` が検出され、
通知先 `info@cucul-fm.com` へのメール通知が設定されている。テスト送信1件が通り、
受信も確認済み。**送信先メールアドレスはコードのどこにも書かれていない**（mailto 方式は廃止した）。

### 通知先を変えるとき

1. https://app.netlify.com/projects/cuculfm-hp/configuration/notifications を開く
   （画面から辿る場合: `Project configuration` → `Notifications` → `Emails and webhooks`
   → **`Form submission notifications`**。Deploy notifications の「Add notification」には
   フォームのイベントが出ない。別セクションなので注意）
2. 既存の `Email notification` を編集、または追加する

### フォームが一覧に出てこないとき

Netlify は**フォーム検出をONにした後のデプロイ**でしかHTMLを走査しない。
`Forms` 画面が空のままなら、検出をONにしてから一度 push（＝再デプロイ）する。

確認コマンド:

```bash
# "contact" が返れば検出済み。[] なら未検出
netlify api listSiteForms --data '{"site_id":"6121d456-5d60-4371-b63c-25372f32737d"}'
```

**注意: 「検出されると `data-netlify` 属性が外れる」という情報は誤り。**
検出成功後も本番HTMLに属性は残る（実測）。属性の有無で検出を判断しないこと。
判定は上の `listSiteForms` で行う。

### 動作確認

https://cucul-fm.com/#contact から実際にテスト送信して、

- Netlify の `Forms` → `contact` に送信が並ぶ
- `info@cucul-fm.com` に通知メールが届く

の両方を確かめる。届かない場合は迷惑メールフォルダと、そのアドレスが実際に受信できるかを確認する。

上の受信確認は2026-08-29時点の記録。2026-09のUI改修の自動テストは通信を模擬しており、
本番Netlifyへのテスト送信やメール受信の再確認を代替するものではない。

### UI改修後の送信動作

- 入力項目・フォーム名・文言は `content/site.config.json` の `contact`、描画は
  `scripts/build-content.mjs` の `contact-fields` / `contact-config`、送信処理は
  `contact/form-handler.js` が担当する。
- 必須／任意をラベルに明記。必須の空欄、メール形式、個人情報への同意を検証し、最初の不備へフォーカスを移す。
- 送信中はボタンを無効化し、フォームを `aria-busy` にする。Enter等の重複送信も防ぐ。
- 通信は20秒で打ち切る。失敗・タイムアウト時は入力と同意を保持し、自動再送しない。
- 成功時だけ入力をリセット。成功・失敗は送信ボタン付近の結果領域に残し、そこへフォーカスを移す。
- reduced-motion設定時は結果・エラーへの移動を即時にする。fetch / AbortControllerがない環境では、標準のフォームPOSTとブラウザー検証を使う。
- `contact_form_submit` / `contact_form_success` / `contact_form_error` の既存イベント名を維持する。

ローカルでの回帰確認は `node --test scripts/test-contact-form.mjs`。実データを送らず、成功、
重複送信、HTTPエラー、通信失敗、タイムアウト、再送、入力検証、計測失敗を確認する。
Pythonの簡易サーバーはNetlify Formsを受け付けないため、画面プレビューで送信成功を判定しない。

---

## 2. アクセス解析（GA4・設定済み）

**2026-08-29 に設定・稼働確認済み。** 測定ID `G-RGHFB3LGED` が
`content/site.config.json` の `analytics.ga4MeasurementId` に入っており、
全ページの `<head>` に Google タグが出力されている。本番で page_view と
カスタムイベントの送信を実測確認済み。**GTM は使っていない**（設定作業も不要）。

### 測定IDを変えるとき

`content/site.config.json` の `analytics` を書き換える。

```json
"analytics": {
  "gtmId": "",
  "ga4MeasurementId": "G-RGHFB3LGED",
  "googleSiteVerification": "…"
}
```

そのあとコマンドを実行して push する。

```bash
node scripts/build-content.mjs        # 全ページの計測タグを書き換える
git add . && git commit -m "chore: GA4の測定IDを変更" && git push
```

どのイベントが取れるかは [06-analytics.md](06-analytics.md) を参照。

### GTM を使いたくなったら

`gtmId` に `GTM-…` を入れて同じ手順を踏む。GTM が入っているときは gtag.js を出さない
（二重計測になるため）ので、GA4 の設定は GTM 側で行うことになる。

---

## 3. 会社情報を更新する

会社名・代表者・住所・電話番号・メール・SNS などは
**`content/site.config.json` の1か所**にまとまっている。ここを直して同期コマンドを走らせると、
トップの会社情報・プライバシーポリシー・構造化データ（JSON-LD）まで一度に更新される。

```bash
# 1. content/site.config.json を編集
# 2. 全HTMLへ反映
node scripts/build-content.mjs
# 3. 反映内容を確認してから push
git add . && git commit -m "chore: 会社情報を更新" && git push
```

### まだ空欄になっている項目

| 項目 | 場所 | 備考 |
|---|---|---|
| 法人番号 | `company.corporateNumber` | 空欄のあいだは画面にも構造化データにも出ない |
| 設立年月日 | `company.foundingDate` | 同上。`"2024-04-01"` の形式で書く |
| 営業時間 | `company.businessHours` | 同上 |

**推測で埋めないこと。** 空欄なら出力されない作りになっている。

### 支援実績を載せられるようになったら

`company.achievements` が空の配列で用意してある。顧客の承諾・守秘義務・匿名化の方針に沿って
書ける内容が出てきたら、ここに追加する。架空の実績・数値は入れない。

---

## 4. 文言や一覧を変更する

手打ちでHTMLを直すのではなく、データファイルを直して同期コマンドを走らせる。

| 変えたいもの | ファイル |
|---|---|
| FAQ（トップ / FDEページ） | `content/faq-top.json` / `content/faq-fde.json` |
| 12か月ロードマップ | `content/roadmap.json` |
| 活用テーマ | `content/usecases.json` |
| 課題提起のカード | `content/challenges.json` |
| 3本柱・FDE横断セクション | `content/pillars.json` |
| 記事（Insights）の一覧・著者・公開日・関連記事 | `content/insights.json` |
| ナビ・問い合わせフォームの項目・提供サービス | `content/site.config.json` |

編集後は必ず:

```bash
node scripts/build-content.mjs        # HTMLへ反映
node scripts/test-build-content.mjs   # 壊れていないか確認（全件合格すること）
```

FAQ を直すと、画面の表示と構造化データ（FAQPage）が同じデータから作り直されるので、
両者が食い違うことはない。

固定ナビは `nav.items` の全8項目をそのまま並べず、`renderNav` が4つの主要導線を選んで表示する。
3事業領域などの導線はINDEXに残る。ナビの構成を変更する場合はデータだけでなく、
レンダラーとINDEXの静的リンク、コンパクトナビのテストも合わせて確認する。

### 記事（Insights）を追加するとき

1. `content/insights.json` の `articles` に1件足す
   （`slug` / `category` / `navTitle` / `title` / `description` / `excerpt` /
   `datePublished` / `dateModified` / `related`）
2. `insights/<slug>/index.html` を作る。既存の記事をコピーして本文を書き換えるのが早い
   （`<!-- BEGIN:jsonld-article -->` `<!-- BEGIN:article-meta -->`
   `<!-- BEGIN:article-related -->` `<!-- BEGIN:breadcrumb -->` を必ず残す）。
   コピーした場合、`<head>` の canonical / og:url / og:title などのURL・文言を
   新しい記事のものに書き換えるのを忘れないこと（テストが自身のURLとの一致を検査する）
3. `node scripts/build-content.mjs`
4. `node scripts/generate-sitemap.mjs`（新URLを sitemap.xml へ）
5. `node scripts/test-build-content.mjs` が全件合格することを確認

一覧・パンくず・Article 構造化データ・関連記事は insights.json から作られるので、
`site.config.json` 側に記事ページを書き足す必要はない。
`<title>` と `meta description` は insights.json の `title`（＋ ` | CUCUL FM.LLC`）と
`description` に一字一句そろえる（テストが突き合わせる）。
記事本文の品質基準（文字数2,000〜3,500字・目次・FAQ・禁止表現など）もテストが検査する。

### ページを新しく作るとき

1. `content/site.config.json` の `pages` にそのHTMLの相対パスで定義を足す
   （`path` / `name` / `description`。パンくずを出すなら `breadcrumb`、
   会社概要のような下位型にするなら `type`（例: `AboutPage`）も）
   - `name` / `description` は、そのHTMLの `<title>` / `<meta name="description">` と
     一字一句そろえる。ずれているとテストが落ちる
2. `<head>` に次の一式を必ず入れる（テストが全公開ページを検査する）:
   - `<!-- BEGIN:analytics --><!-- END:analytics -->`（`</head>` 直前）
   - canonical（自身の絶対URL）
   - OGP + Twitter Card（og:type / og:url / og:title / og:description /
     og:image / og:locale / twitter:card / twitter:image。画像は
     `https://cucul-fm.com/images/ogp/ogp-default.png` を絶対URLで）
   - favicon 一式 + manifest（ICO・PNG192・apple-touch-icon・`/site.webmanifest` の4行。
     既存ページからコピーすればよい）
3. `node scripts/build-content.mjs` で中身が生成される
4. `node scripts/generate-sitemap.mjs` で sitemap.xml に追加
5. `node scripts/test-build-content.mjs` が全件合格することを確認

### OGP画像・faviconを差し替えるとき

| アセット | 場所 | 寸法（テストが検査） |
|---|---|---|
| OGP既定画像 | `images/ogp/ogp-default.png` | 1200×630 |
| ファビコン（ICO・16/32/48内包） | `favicon.ico`（リポジトリ直下） | — |
| ファビコン（PNG） | `images/icons/favicon-32.png` / `favicon-192.png` / `favicon-512.png` | 32 / 192 / 512 |
| Apple ホーム画面 | `images/icons/apple-touch-icon.png` | 180×180 |
| Android 適応アイコン | `images/icons/maskable-512.png` | 512×512 |
| ロゴ（ヘッダー画像・JSON-LD用） | `logo/cuculfm.svg` | — |

- 同じファイル名で上書きすれば、各ページの参照はそのまま使える
- 記事の Article 構造化データが使う画像は `content/site.config.json` の
  `site.defaultOgImage` → `node scripts/build-content.mjs` で反映
- ブログ13本は記事ごとの写真を og:image にしている（既定PNGではない）

**アイコンに `logo/cuculfm.svg` を使わないこと**（2026-08-30 の変更点）。
このSVGは573KBあり、中身は 1062px の埋め込みPNG 4枚。さらに「CUCUL FM.LLC」の文字が
マークの中央を横幅85%で横断しているため、16pxのタブでは文字が潰れて判読不能になる。
`rel="icon"` に `sizes="any"` のSVGを置くと Chrome/Firefox/Edge がPNGより優先してしまうため、
アイコン用途からは外した（テストが退行を検知する）。SVG自体はヘッダーのロゴ画像や
JSON-LD の `Organization.logo` で使い続けている。

アイコンを作り直すときは、SVGから文字レイヤー `g[clip-path="url(#9358c3c5af)"]` を
描画時に外し、紺 `#0a0a1a` 背景の正方形として書き出す（SVGファイル自体は変更しない）。
`favicon.ico` は 16/32/48 のPNGを ICO コンテナに詰めた PNG-in-ICO 形式。

### 犬図鑑の犬種写真を差し替えるとき

犬図鑑（`services/dog/breeds/`）の写真は、犬種ごとに目視選定した固定URLの表
`BREED_IMAGES` で管理している（2026-08-30「顔が見切れる」指摘への対応。
それ以前のランダム表示は廃止）。差し替えは **`index.html` と `detail.html` の両方**の
`BREED_IMAGES` にある該当犬種のURLを書き換えるだけでよい。
URLは Dog CEO（`https://images.dog.ceo/breeds/…`）でも他の無料画像でも可。
自社撮影を使う場合は `LOCAL_PHOTOS` に追加する（こちらが最優先）。
Dog CEO に正しい写真が無い7犬種（bull-terrier / chinese-crested-dog / bearded-collie /
puli / shar-pei / cane-corso / greyhound）はプレースホルダのままにしてある。

### デザイン・UI・3Dを変更するとき

| 変更内容 | 編集場所 |
|---|---|
| トップ＋主要3ページの共通UI色・面・文字色・余白 | `css/brand.css` |
| トップの本文、固定ナビ、フォーム、事業カード、フッター | `css/home-ui.css` |
| トップのhero / seqの配置、星空・月、テーマ、INDEX基盤 | `css/home.css` |
| トップのUI、GSAP、3D/SVG切替、ページ内移動 | `js/home.js` |
| 3Dモデル・マテリアル・照明・カメラ・描画復帰 | `js/character.js` |
| FDE／会社概要／Insights一覧のレイアウト | 各HTMLのマーカー外＋`css/pages.css` |
| 既存下層共通のスタイル | `services/style.css`（29ページへ波及） |

トップのCSS/JSは `index.html` のインラインから分離済み。トップの読み込み順は
`brand.css → home.css → home-ui.css`、主要下層は `brand.css → services/style.css → pages.css`。
`pages.css` は `body.moonlight-page` とページ別クラスを前提にしている。
Insights記事本文や既存サービス全部へ新UIを適用する変更は、別途対象を確認してから行う。

UI配色の調整では3Dの色・動きの設定を変更しない。既定の3Dは本文の表示を待たせず、
遅れて読み込まれた場合も現在のスクロール進捗へ合流する。WebGLが使えない場合はSVGを表示する。
`js/home.js` の `CFG.seq.enabled` は既定で `false`。将来フレーム連番を使う場合のみ、
アセット全件の配置・回帰確認とセットで有効化する（単にファイルを置くだけでは切り替わらない）。

3D保護テストは `node --test scripts/test-home-motion.mjs`。改修前コミット
`da391902e0de9762de1807c255633377347927c8` のキャラ設定・カメラ経路と比較する。
テストが落ちたとき、通すためだけに基準コミットを現在のHEADへ変えないこと。
このコミットを含まない浅いクローンでは、まず基準履歴を取得する。

---

## 5. 一時掲載停止中のページと戻し方

2026-08-30 の発注者指示で、現状商品・提供体制の無い5サービス（8ページ）を掲載停止にしている。

| サービス | URL |
|---|---|
| AIツール紹介 / 学習 | `/services/ai-tools/` |
| メディア運営 | `/services/media/` |
| オーナーズコモン | `/services/condo/`（garage / hideaway / mahjong 含む） |
| オーダーメイド製品販売 | `/services/custom/` |
| オリジナルクラフト販売 | `/services/craft/` |

停止はファイル削除ではなく「隠す」実装（HTMLは残置）。構成要素は4つ:

1. `_redirects` の 404 行（「一時掲載停止」ブロックの5行）
2. 各ページ `<head>` の `<meta name="robots" content="noindex">`（sitemap から自動除外される）
3. 導線の撤去: `content/pillars.json` の links、`content/site.config.json` の
   `services[ai-adoption].url`（→ `/fde/` に変更済み）と construction / lifestyle の説明文、
   `index.html` のフッター・INDEXオーバーレイ・事業カード04（TOOLS）・#about 事業内容、
   `articles/index.html` のフッター、`services/ai/` の関連サービス案内（削除済み）
4. 旧ブログ301の付け替え（`/blog/custom/*`→tools、`/blog/ai-tools|ai/*`→ai、`/blog/condo/*`→/）

### 再開の手順

1. `_redirects` から該当の 404 行を消す
2. ページの noindex メタを外す
3. 3.の導線を戻す（pillars.json に links を足し、`node scripts/build-content.mjs`）
4. `node scripts/generate-sitemap.mjs` で sitemap に復帰
5. `node scripts/test-build-content.mjs` 全件合格を確認して push

---

## 6. 困ったときの確認コマンド

```bash
# テスト一式（コンテンツ整合・SEOメタ・記事品質など全件）
node scripts/test-build-content.mjs

# 問い合わせと3Dの回帰テスト（通信は模擬、本番送信なし）
node --test scripts/test-contact-form.mjs scripts/test-home-motion.mjs

# HTML と content/ がずれていないか（差分0なら同期済み）
node scripts/build-content.mjs --check

# sitemap.xml が最新か
node scripts/generate-sitemap.mjs --check

# 使えるマーカーの一覧
node scripts/build-content.mjs --list

# ローカルの画面確認（停止は Ctrl+C）
python3 -m http.server 8000

# 本番の状態を見る
curl -s -o /dev/null -w "%{http_code}\n" https://cucul-fm.com/
netlify status
```

---

## 7. 触らないほうがよいところ

- `index.html` の `id="contact"` `id="business"` `id="about"`
  … 下層ページから深リンクされている。変えるとリンク切れになる
- `id="pillar-construction"` `id="pillar-creative"` `id="pillar-lifestyle"`
  … INDEXとページ内リンクが指している
- フォームの `name="contact"` / `data-netlify` / hidden の `form-name` / `bot-field`
  … Netlify のフォーム検出とひも付けの契約
- `<!-- BEGIN:… -->` 〜 `<!-- END:… -->` の区間
  … 同期コマンドが上書きする。中を手で直しても次回実行で消える。直すのはデータ側
- `/character-design/phantom-dj/model.glb`
  … トップの3Dキャラクター本体
- `js/character.js` の `CFG3D` / `GLOW` / `DECALS` / `LINING` / `RIGS` / `SEQ_KEYS` / `SEQ_TURN`
  … 保護するキャラの外観・照明・カメラ経路。UI改修だけで変更しない
- `#hero` / `#seq` とキャラクター用DOMの親子関係
  … ひとつのcanvasをheroとseqへ付け替える。祖先にtransform・filter・perspectiveを加えない
