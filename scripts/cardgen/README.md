# cardgen — カードアート生成パイプライン

サイトのカード画像(油彩ストローク・シミュレーション)を決定的シードで生成する。
画像生成AIは使わず、ヘッドレスChromeのcanvasで筆致を合成する自作パイプライン。

## 前提

- リポジトリルートで静的サーバを起動しておく(canvas汚染回避のため必須):
  `python3 -m http.server 8123`
- 依存の導入: `cd scripts/cardgen && npm i`(puppeteer-core / pngjs)
- システムのGoogle Chrome(`/Applications/Google Chrome.app/...`)を使用。
  起動フラグ: `--remote-allow-origins=*` 必須 / `--disable-gpu` 禁止

## 構成

- `legacy/gen-cardart.mjs` — トップBULLETIN 4枚(images/news/news-01..04.jpg、840×640)の油彩寓意画。
  パイプライン: 下絵合成 → 輝度勾配フローの筆致(mulberry32決定的シード、約1.7万筆) → 織り目+ビネット
- `legacy/gen-thumbs.mjs` + `legacy/recrop.mjs` — BUSINESS 7枚(images/biz/biz-01..07.jpg、600×1000)
- `legacy/gen-phantom-papillon.mjs` — ファントム・パピヨン肖像(character-design/phantom-papillon/、シード0x9A11)
- `legacy/preview-svg.mjs` — SVG→PNGプレビュー

## 作法(過去の教訓)

- 三日月の欠けは透明ではなく背景色で塗る(油彩パスが黒をサンプルして満月化するバグ)
- 写真ベースの油彩は `focus` 楕円で顔に筆致を集中させる(犬の目鼻の可読性)
- シード固定により再実行は常にバイト同一。シードを変えるときだけ画が変わる

検証スクリプトは `../verify/`(puppeteer-core雛形。1440×900+390×844、GSAPは実時間wait)。
