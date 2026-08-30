# 08. 公開前チェックリスト

管理者（発注者）が公開前後に確認するためのチェックリスト。
項目の文言は要件原文（[00-implementation-brief.md](00-implementation-brief.md) の「9. 公開前チェックリスト」）から
一字一句そのまま引き写し、各項目の下に実装側で確認した現状を添えた。

> 本ファイル作成時点（2026-08-30）では、フェーズ5以降の4コミット
> （`04291e0` `2b90f58` `2b80cb6` `85cd7e7`）が **未push**。
> そのため /fde/ や /insights/ などは本番ではまだ404になる。push すると自動で本番に出る。

---

## 1. 公開前チェック（要件原文の全17項目）

- [ ] 各ページに明確なH1、title、meta descriptionがある
  - 現状: 実装済み。改修で新設したページ（/fde/・/about/・/insights/一覧+記事8本・/privacy/）は、テストが H1 が1つであること、title / meta description が `content/site.config.json` と一字一句一致することを突き合わせている。既存ページ（トップ・services・blog 等）は canonical / OGP のみ全数を機械検査、H1・title は目視確認
- [ ] 各ページの内容と構造化データが一致している
  - 現状: FAQ・記事・会社情報の JSON-LD は画面表示と同じデータ（`content/*.json`）から生成される。`scripts/test-build-content.mjs`（217件）が突き合わせ済み
- [ ] 会社名・サービス名・説明文に表記ゆれがない
  - 現状: 会社情報は `content/site.config.json` の1か所から全ページへ注入。表記は CUCUL FM.LLC / ククルFM合同会社 / ククルFM で統一
- [ ] 重要な本文がHTMLとして取得できる
  - 現状: 全コンテンツはマーカー注入方式で静的HTMLに直接書き込まれ、JS無効でも初期状態で読める
- [ ] robots.txt、sitemap.xml、canonical、noindex設定を確認した
  - 現状: robots.txt は全許可＋AIクローラー明示許可＋Sitemap行あり。sitemap.xml は48 URL（`scripts/generate-sitemap.mjs` が生成）。canonical は全公開ページで自身のURLを指すことをテスト済み。404.html のみ noindex で sitemap 外
- [ ] モバイルでCTAとフォームが正常に機能する
  - 現状: レスポンシブ実装済み。実機での最終確認は発注者確認
- [ ] フォーム送信後の計測イベントが発火する
  - 現状: `contact_form_submit` / `contact_form_success` を `contact/form-handler.js` が発火。GA4 への送信は本番で実測済み（2026-08-29）。詳細は [06-analytics.md](06-analytics.md)
- [ ] 404ページとリダイレクト方針を確認した
  - 現状: 404.html あり（noindex）。`_redirects` は docs/redesign/ 等の社内向けファイルの配信停止に使用
- [ ] OGP画像とSNS共有時の表示を確認した
  - 現状: `/images/ogp/ogp-default.png`（1200×630 PNG）作成済み・全ページに OGP メタ設置済み。SNSでの実表示は公開後に要確認（下記「3. 公開直後にやること」）
- [ ] Google Search Consoleに登録した
  - 現状: 検証メタタグ（`google-site-verification`）はトップページ（index.html）に設置済み（ルート検証なのでトップのみで機能する）。プロパティ登録の完了状態は発注者確認
- [ ] Google Analytics 4を設定した
  - 現状: 設定済み（測定ID `G-RGHFB3LGED`、gtag.js 直接構成）。本番で page_view とカスタムイベントの送信を実測済み（2026-08-29）
- [ ] Bing Webmaster Toolsに登録した
  - 現状: 未着手（発注者作業。Search Console 連携インポート可）
- [ ] Google Business Profileの登録・情報整合性を確認した
  - 現状: 未着手（発注者作業）
- [ ] 会社概要、プライバシーポリシー、問い合わせ先を掲載した
  - 現状: /about/ と /privacy/ を新設済み。問い合わせはトップ `#contact`（Netlify Forms）
- [ ] AIに関する表現に、過度な性能保証や誤認表現がない
  - 現状: テストが「必ず／完全／100%」等の断定表現を機械検査している。最終的な読み合わせは発注者確認
- [ ] 架空の事例、実績、顧客ロゴ、数値を掲載していない
  - 現状: 掲載なし。`company.achievements` は空配列のまま（推測で埋めない方針）。テストでも禁止表現を検査
- [ ] 実在する一次情報、写真、図解、判断基準、運用ノウハウを掲載している
  - 現状: 自社の考え方・判断基準を記事8本・FAQ・ロードマップとして掲載済み。写真・図解の追加は発注者確認

> 計画との差分: 引き継ぎ指示では「18項目」とされていたが、要件原文（00-implementation-brief.md 1047〜1063行）の項目は上記の17項目がすべて。

---

## 2. push 前の機械検証

`main` に push すると本番に出るため、push 前に必ず以下を通す。

```bash
# 1. コンテンツテスト（217件すべて合格すること）
node scripts/test-build-content.mjs

# 2. HTML と content/ の同期確認（差分 0 件であること）
node scripts/build-content.mjs --check

# 3. sitemap の鮮度確認（「最新です」と出ること）
node scripts/generate-sitemap.mjs --check
```

ローカルプレビュー:

```bash
python3 -m http.server 8000
# → http://localhost:8000 でトップ・/fde/・/insights/ 等を確認
```

本番前にプレビューURLで見たい変更は、`main` ではなく別ブランチへ push する。

---

## 3. 公開直後にやること

| 作業 | やり方 |
|---|---|
| sitemap 送信 | Google Search Console → サイトマップ → `https://cucul-fm.com/sitemap.xml` を送信 |
| OGP カード確認 | 各SNSのデバッガーで https://cucul-fm.com/ と /fde/ を確認。Facebook: シェアデバッガー / X: Card Validator / LINE・Slack は実際に貼って表示を見る |
| 主要ページの200確認 | 下記コマンド |

```bash
for p in / /fde/ /about/ /privacy/ /insights/ /services/ai/ /sitemap.xml; do
  curl -s -o /dev/null -w "%{http_code} $p\n" "https://cucul-fm.com$p"
done
```

すべて `200` が返ること。あわせてトップから `#contact` のテスト送信を1回行い、
通知メールが届くことを確認する（手順は [07-update-guide.md](07-update-guide.md) の1章）。

---

## 4. 毎月の運用（要件原文）

- [ ] Google Search Consoleで検索クエリ、表示回数、クリック、インデックス状況を確認する
- [ ] GA4で問い合わせ、CTAクリック、フォーム離脱、流入ページを確認する
- [ ] Bing Webmaster Toolsで検索状況およびAI Performanceのデータを確認する
- [ ] 問い合わせで実際に使われた言葉を、FAQ・記事・サービス説明に反映する
- [ ] 古くなった記事やサービス説明を更新する

FAQ・記事・サービス説明の直し方は [07-update-guide.md](07-update-guide.md) の4章
（データファイルを直して同期コマンド）を参照。

---

## 5. 四半期ごとの運用（要件原文）

- [ ] 新しい業界別ページ、ユースケース、一次情報の記事を追加する
- [ ] 実際の支援事例を、顧客承諾・守秘義務・匿名化方針に従って公開する
- [ ] 導入前後の状況、支援範囲、判断、成果、制約を具体的に記録する
- [ ] 会社情報、サービス内容、対応領域、連絡先、構造化データの整合性を監査する

整合性の監査は機械検証コマンド（本ファイル2章）を回すだけで大半を確認できる。
支援事例は `content/site.config.json` の `company.achievements` に追加する（架空の実績・数値は入れない）。

---

## 6. 発注者の手動作業リスト

実装ブリーフ「6. 発注者の手動作業」を現状に合わせて更新したもの。

| # | 作業 | 状態 |
|---|---|---|
| 1 | Netlify Forms の通知先メール（info@cucul-fm.com）設定と受信確認 | **完了**。フォーム `contact` 検出済み・テスト送信済み・通知先設定済み |
| 2 | GA4 の設定 | **完了**。GTMコンテナは作らず GA4 直接構成で設定（測定ID `G-RGHFB3LGED`、本番送信実測済み）。GTM へ切り替えたくなったときの手順は [06-analytics.md](06-analytics.md) |
| 3 | Bing Webmaster Tools へのサイト登録（Search Console連携インポート可）と AI Performance の確認 | 未着手 |
| 4 | Google Business Profile の登録・情報整合性確認 | 未着手 |
| 5 | 法人番号・設立年月日が確定したら `content/site.config.json` に記入して `node scripts/build-content.mjs` を実行 | 未着手（現在は空欄。空欄のあいだは画面にも構造化データにも出ない） |
| 6 | 本番デプロイの承認 | **未実施**。フェーズ5以降の4コミットが未push。承認後に `git push` すれば自動で本番反映される |
| 7 | Insights記事内の自社実務の記述の事実確認 | **要確認**。「管路調査の異常ランクの候補出しを試した」「報告書作成時間などを着手前に控えている」等、社内実務を一人称で書いた箇所がある（数値・顧客名は無し）。実態と合っているかは発注者にしか確認できない |
| 8 | 補足コピー「AI・データ・クリエイティブを、使われ続ける仕組みへ。」の掲載可否 | **判断待ち**。要件の最重要メッセージに挙がっているが掲載場所の指定が無く、現状どのページにも表示していない（`content/site.config.json` の `messaging.siteTaglineSupport` にデータとして保持済み）。掲載するなら場所をご指定ください |

> 計画との差分: ブリーフ2番は「GTMコンテナ / GA4プロパティを作成し…」だったが、
> 実装は GTM を経由しない GA4 直接構成で完了した（GTM は `content/site.config.json` の
> `gtmId` を入れればいつでも有効化できる構成のまま）。
