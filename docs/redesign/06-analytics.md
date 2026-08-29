# 06. 計測イベント設計

計測は「イベントを `window.dataLayer` に積む」処理と「タグ（GA4 / GTM）を読み込む」処理を
分けている。タグが1つも入っていなくてもサイトは普通に動き、イベントは静かに積まれるだけになる。

- 積む側: `js/analytics.js`（全公開ページで読み込み）、`contact/form-handler.js`（送信まわり）
- 読み込む側: 各HTMLの `<!-- BEGIN:analytics -->` 区間。
  `content/site.config.json` の `analytics` にIDが入ったときだけ `scripts/build-content.mjs` が書き出す

## タグの入れ方（2通り。設定は content/site.config.json）

| `analytics` の設定 | 出力されるタグ | 管理画面での作業 |
|---|---|---|
| どちらも空（現状） | なし | — |
| `ga4MeasurementId` のみ | gtag.js（Google タグ） | **不要**。下記イベントがそのまま GA4 に届く |
| `gtmId` のみ | GTM コンテナ | GTM でGA4設定タグ＋イベントトリガーを作る |
| 両方 | GTM のみ（gtag.js は出さない） | 同上。二重計測を避けるため GA4 は GTM 側で設定する |

`ga4MeasurementId` を使う構成では、生成タグが `window.CUCULFM.directGa4 = true` を立てる。
`js/analytics.js` はこのフラグが立っているときだけ `gtag('event', …)` も呼ぶ。
GTM 運用時に無条件で呼ぶと GTM のトリガーと二重に計上されるため、このガードは外さないこと。

## イベント一覧

| イベント名 | 発火条件 | 実装 |
|---|---|---|
| `contact_form_view` | お問い合わせセクション `#contact` が画面に入った（IntersectionObserver / 1回だけ） | `js/analytics.js` |
| `contact_form_start` | フォームに最初のフォーカスが入った（1回だけ） | `js/analytics.js`（`focusin`） |
| `contact_form_submit` | 送信ボタン押下で、入力チェックを通過した | `contact/form-handler.js` |
| `contact_form_success` | 送信が成功した（HTTP 2xx） | `contact/form-handler.js` |
| `contact_form_error` | 送信が失敗した（要件の一覧には無いが、失敗が無言で消えるのを避けるため追加） | `contact/form-handler.js` |
| `click_phone` | `tel:` リンクのクリック | `js/analytics.js`（自動判定）＋ `data-ga-event` |
| `click_email` | `mailto:` リンクのクリック | 同上 |
| `click_consultation_cta` | ヘッダーの「相談する」／`/privacy/` の CTA | `data-ga-event`（トップ・`/privacy/`） |
| `click_fde_service` | 「FDE・AI実装支援を見る」「FDE・AI実装支援の詳細を見る」 | `data-ga-event`（トップに2か所） |
| `click_roadmap` | 「自社に合わせた進め方を相談する」 | `data-ga-event`（トップ） |
| `scroll_depth_50` | ページを50%まで読み進めた（1回だけ） | `js/analytics.js` |
| `scroll_depth_90` | 90%まで読み進めた（1回だけ。以降はスクロール購読を解除） | `js/analytics.js` |

送信するパラメータ:

- クリック系: `link_url`（href）、`link_text`（表示文言・先頭80文字）
- フォーム系: `form_name`（`contact`）、失敗時は `error_message`

## クリック計測の付け方

リンクに `data-ga-event="イベント名"` を付けるだけでよい。href を変えても計測が外れない。

```html
<a href="/fde/" data-ga-event="click_fde_service">FDE・AI実装支援を見る</a>
```

`data-ga-event` が無くても、`tel:` と `mailto:` は自動で `click_phone` / `click_email` になる。
両方ある場合は `data-ga-event` が優先され、二重には送られない。

## 確認方法

**GA4 だけの構成のとき**

1. GA4 の管理画面 → 左メニュー「レポート」→「リアルタイム」
2. 別タブで https://cucul-fm.com/ を開き、下までスクロールしてフォームに触る
3. リアルタイムの「イベント数（イベント名）」に `scroll_depth_50` や `contact_form_start` が出れば成功

ブラウザの開発者ツールでも確認できる。コンソールで `dataLayer` と入力すると、積まれたイベントが並ぶ。

**GTM の構成のとき**

GTM のプレビューモードで、上記イベント名の「カスタムイベント」が発火しているかを見る。
GA4 へ送るには、GTM 側で以下を作る。

- GA4 設定タグ（測定IDを指定・All Pages）
- 各イベント名のカスタムイベントトリガー
- そのトリガーで発火する GA4 イベントタグ

## 変更するときの注意

- イベント名を増減したら、この表と `js/analytics.js` の冒頭コメントを合わせて直す
- 計測は本文機能を止めないよう、送出をすべて `try/catch` で囲んでいる。この方針は変えないこと
- GTM ID / 測定ID は生成タグへそのまま埋め込むので、`scripts/build-content.mjs` の
  `validate()` が書式（`GTM-…` / `G-…`）を検査している。検査を外さないこと
