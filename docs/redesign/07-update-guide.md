# 07. 更新・運用ガイド

このサイトの設定変更・情報更新のやり方をまとめたもの。

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

## 1. お問い合わせフォームの通知先を設定する

送信内容は Netlify に保存され、そこからメールで通知が届く。
**送信先メールアドレスはコードのどこにも書かれていない**（mailto 方式は廃止した）。
設定は Netlify の管理画面で行う。

### 手順

1. https://app.netlify.com/projects/cuculfm-hp/configuration/notifications を開く
   （画面から辿る場合: `Project configuration` → `Notifications` → `Emails and webhooks`）
2. `Form submission notifications` の `Add notification` → `Email notification`
3. 通知先に **`info@cucul-fm.com`** を入力し、対象フォームは `contact` を選ぶ
4. 保存

### フォームが一覧に出てこないとき

Netlify は**フォーム検出をONにした後のデプロイ**でしかHTMLを走査しない。
`Forms` 画面が空のままなら、検出をONにしてから一度 push（＝再デプロイ）する。

確認コマンド:

```bash
# "contact" が返れば検出済み。[] なら未検出
netlify api listSiteForms --data '{"site_id":"6121d456-5d60-4371-b63c-25372f32737d"}'

# 検出されると Netlify が data-netlify 属性を外す。0 になっていれば成功
curl -s https://cucul-fm.com/ | grep -c 'data-netlify'
```

### 動作確認

https://cucul-fm.com/#contact から実際にテスト送信して、

- Netlify の `Forms` → `contact` に送信が並ぶ
- `info@cucul-fm.com` に通知メールが届く

の両方を確かめる。届かない場合は迷惑メールフォルダと、そのアドレスが実際に受信できるかを確認する。

---

## 2. アクセス解析（GA4）を有効にする

**GTM の設定作業は不要。** GA4 の測定IDを1つ設定ファイルに書くだけでよい。

### 測定IDの取得

1. https://analytics.google.com/ を開く
2. 管理（歯車）→ `プロパティを作成` → 名前は「CUCUL FM」など
3. データストリームを作成 → `ウェブ` → URL に `https://cucul-fm.com`、ストリーム名は任意
4. 作成後に表示される **測定ID `G-` で始まる文字列**（例 `G-ABCD123456`）をコピー

### サイトへの反映

`content/site.config.json` の `analytics` を書き換える。

```json
"analytics": {
  "gtmId": "",
  "ga4MeasurementId": "G-ABCD123456",
  "googleSiteVerification": "…"
}
```

そのあとコマンドを実行して push する。

```bash
node scripts/build-content.mjs        # 全ページの計測タグを書き換える
git add . && git commit -m "chore: GA4の測定IDを設定" && git push
```

反映されると、全ページの `<head>` に Google タグが入る。
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
| ナビ・問い合わせフォームの項目・提供サービス | `content/site.config.json` |

編集後は必ず:

```bash
node scripts/build-content.mjs        # HTMLへ反映
node scripts/test-build-content.mjs   # 壊れていないか確認（全件合格すること）
```

FAQ を直すと、画面の表示と構造化データ（FAQPage）が同じデータから作り直されるので、
両者が食い違うことはない。

---

## 5. 困ったときの確認コマンド

```bash
# HTML と content/ がずれていないか（差分0なら同期済み）
node scripts/build-content.mjs --check

# 使えるマーカーの一覧
node scripts/build-content.mjs --list

# 本番の状態を見る
curl -s -o /dev/null -w "%{http_code}\n" https://cucul-fm.com/
netlify status
```

---

## 6. 触らないほうがよいところ

- `index.html` の `id="contact"` `id="business"` `id="about"`
  … 下層ページから深リンクされている。変えるとリンク切れになる
- `id="pillar-construction"` `id="pillar-creative"` `id="pillar-lifestyle"`
  … グローバルナビが指している
- フォームの `name="contact"` / `data-netlify` / hidden の `form-name` / `bot-field`
  … Netlify のフォーム検出とひも付けの契約
- `<!-- BEGIN:… -->` 〜 `<!-- END:… -->` の区間
  … 同期コマンドが上書きする。中を手で直しても次回実行で消える。直すのはデータ側
- `/character-design/phantom-dj/model.glb`
  … トップの3Dキャラクター本体
