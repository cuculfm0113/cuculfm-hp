# 09. 月夜のUI改修 — 判断と検証

2026-09-17。対象はトップ、FDE、会社概要、Insights一覧と共通の操作UI。
既存の黄色・月・星空・濃紺を主軸とし、紫を主体とする面を青灰色へ寄せた。
3Dキャラクターのモデル、色、照明、カメラ経路、歩行・ターンは保持する。
静的HTMLと `content/` からのマーカー同期方式を維持し、新しいフレームワークは導入しない。

## 1. デザインの判断

参考は今回確認したデザイン名で記録する。以下は各サイト全体の再現ではなく、採用した役割の範囲を示す。

| 判断 | 主な根拠・参考 | 採用する役割 |
|---|---|---|
| 黄色＋月夜の濃紺、既存フォント・3Dを維持 | ユーザー指定、既存CUCUL FM | 全体のブランド。参考デザインの配色やキャラへ置き換えない |
| 薄い輪郭、わずかな内側の光、奥行きのある濃紺面 | AuthKit | ナビ・フォーム・情報面。強いぼかしや多色グラデーションを本文へ広げない |
| 読む順番、余白、番号、メタ情報の揃え方 | Linear | 事業・課題・記事の情報階層。すべてを同じカードにしない |
| ラベル、必須／任意、送信状態と結果の近接 | Asana / Runway | フォームの見通しと操作後のフィードバック。項目・同意・送信契約は維持 |

トップは「3事業の入口 → 個別事業の画像 → 提供する支援内容」を違う面積・構造で見せる。
FDEは長い説明に目次を付け、会社概要はミッションと事実情報を分ける。
Insights一覧は先頭記事を入口として強調し、続く記事はカテゴリ・タイトル・概要を並べて比較しやすくする。
既存の事業・掲示板画像を利用し、架空の実績・顧客ロゴ・数字は追加しない。

## 2. 実装の境界

- 新UIのトークンは `css/brand.css`。本文は原則16px、補助は14px、フォーム入力は16px以上、主要操作領域は44px以上。
- トップは `css/home.css` が演出基盤、`css/home-ui.css` が情報・操作UI。`js/home.js` と `js/character.js` にUI調整と3D描画を分離した。
- 主要下層は `body.moonlight-page` と `css/pages.css` に限定。`services/style.css` の共通修正はフォーカス、戻るリンク、ヘッダー操作領域、reduced-motion、補助文字と背景オーバーレイの可読性。
- 生成クラス・マーカーは `scripts/build-content.mjs` と連動。FAQとServiceの可視内容・JSON-LD、フォームの名前・項目名、既存の計測イベントを維持。
- 問い合わせは送信中の重複を防止し、20秒の通信タイムアウトを設定。失敗時は入力を残し、自動再送しない。結果は送信ボタン付近で通知する。

ファイルごとの編集先・CSS読み込み順は [05-design-system.md](05-design-system.md)、日々の更新手順とNetlifyの通知設定は [07-update-guide.md](07-update-guide.md) を参照。

## 3. 保護するもの

- `#hero` / `#seq`、キャラ配置と親子関係、GLB本体、`CFG3D` / `GLOW` / `DECALS` / `LINING` / `RIGS` / `SEQ_KEYS` / `SEQ_TURN`。
- シーケンスのpin距離・カメラ経路を維持。3DとSVGは同じ進捗を共有し、GLBの遅延・WebGLの喪失で本文やスクロールを待たせない。
- `#contact` / `#business` / `#about` / `#pillar-*` の深リンク。INDEXからのページ内移動では先にモーダルと背景ロックを解除する。
- Netlifyの `name="contact"` / `data-netlify` / hidden `form-name` / honeypot、フォーム項目名、プライバシー同意。
- 重要本文はHTMLに残す。JSなし、GSAP/CDNの失敗、reduced-motion、3D未読込でも閲覧・問い合わせ導線を保つ。

3D回帰テストの基準は改修前コミット `da391902e0de9762de1807c255633377347927c8`。
現在のHEADとの比較に変えると退行が基準へ混入するため、意図した外観変更の承認なしに更新しない。

## 4. 再現・検証

プロジェクトルートで実行する。

```bash
# content/・レンダラーを編集した場合のみ生成物へ反映
node scripts/build-content.mjs

# コンテンツ・SEO・固定コピー・生成同期
node scripts/test-build-content.mjs
node scripts/build-content.mjs --check
node scripts/generate-sitemap.mjs --check

# 通信を模擬したフォーム検証と、3Dの数値・切替・障害時処理
node --test scripts/test-contact-form.mjs scripts/test-home-motion.mjs

# ローカル画面確認。停止は Ctrl+C
python3 -m http.server 8000
```

3Dの状態・障害時の切替を確認する専用プレビューも用意している。

```bash
# 127.0.0.1:8125 にローカルQAパネル付きで配信。停止は Ctrl+C
python3 scripts/verify/moonlight-preview.py
```

| URL | 確認内容 |
|---|---|
| `http://127.0.0.1:8125/` | 3Dのready・camera・yaw・進捗・canvasの親・pin状態を表示 |
| `http://127.0.0.1:8125/?qa=delay` | GLBの応答を15秒遅らせる |
| `http://127.0.0.1:8125/?qa=fail` | GLBへ503を返す |
| `http://127.0.0.1:8125/__qa__/capture` | PNG・JPEGの保存フォーム |

QAパネルの `Lose WebGL` / `Restore WebGL` でcontextの喪失・復帰を再現する。
パネルと障害模擬はこのCLIサーバーの応答にだけ注入され、本番HTMLには追加しない。
スクリーンショットの保存先は `docs/redesign/review-images/`。保存フォームは同一originからのPNG・JPEGのみを受け付け、既存ファイルを上書きしない。
比較・主要画面の証跡はJPEG12枚を保存済み。[UIレビューギャラリー](review-images/review.html) でheroとstatementの改修前後、トップ本文、FDE、会社概要、Insights、モバイルのフォームを確認できる。
ファイル名の1440/390は撮影時の幅区分。保存画像の実寸はデスクトップ1425×891、モバイル375×812。
全確認項目の画像が揃ったことを意味するものではなく、動作の結果は以下の実測記録と合わせて扱う。

フォームテストは本番へ送信しない。3Dテストは設定・カメラ数値、遅延GLBの合流、context喪失・復帰、
非表示タブ、reduced-motion、連番アセット欠損等を検証するが、GPU上の見た目や全端末の描画品質は保証しない。

ブラウザー確認対象は `http://localhost:8000/`、`/fde/`、`/about/`、`/insights/`。
共有CSSの影響確認には `/services/ai/`、`/services/inspection/`、`/services/dog/pet-floor/`、Insights記事を用いる。

## 5. 実測できた範囲（2026-09-17〜18）

デスクトップChromeのローカルプレビューで確認した。幅の変更はブラウザーのビューポートによるもので、実機のiOS/Android検証とは区別する。

| 確認 | 結果・根拠 |
|---|---|
| トップのhero配置 | 幅320 / 390 / 768 / 1280 / 1440pxの5条件で、`#hero`・`.hero-stage`・`.giant-type`・`.hero-char-wrap` のDOMRectが固定した改修前基準と完全一致 |
| 主要下層3ページ | 同じ5幅で全DOMを検査し、ページの横はみ出し、および見出し・段落のクリップなし |
| モバイル幅の操作UI | 幅320 / 390pxでトップの入力文字16px、ナビの44px操作領域を確認 |
| 200%ズーム | ChromeでinnerWidth `720` / devicePixelRatio `2`、横はみ出し・見出しや段落のクリップなし。確認後100%へ復帰 |
| reduced-motion | Chrome DevToolsで設定を変更し、pin解除、running false、contactへのフォーカス移動後の上端88pxを確認。通常設定へ戻すと元のpin位置へ復帰 |
| 共有CSSの既存ページ | `/services/inspection/`を幅390px、`/services/web/`を幅1280pxで描画し、横はみ出しなし |
| WebGL喪失・即時復帰 | 専用プレビューの進捗`0.217778`で喪失させるとreadyがfalseになりSVGへ切替。直後の復帰で同じ進捗・カメラへ戻り、pinのstart `1392` / end `4092` は不変 |
| GLB失敗・遅延 | 専用プレビューで503と15秒遅延を実ブラウザーで確認。遅延時、進捗`0.317778`では読込前の3D stateはnull、読込後はseqで同じ進捗・pin位置へ合流 |
| 順方向／逆方向のカメラ | 進捗`0.684444`でカメラ`[0.5432671445, 1.1354083931, 3.6344370520]`、yaw `1.707065002`が両方向で一致 |
| ターン完了・区間退出 | 進捗1でyaw `2π`を維持。scrollY `5310`の完全退出ではcanvasがheroへ戻り、runningはfalse |
| タブ復帰・キーボード移動 | ChromeでQAタブ→AuthKitタブ→QAタブと切替後、ready true / running true / mode hero、canvasの親`char-zoom`を確認。VIEW BUSINESSをEnterで操作するとbusinessへフォーカスが移り、上端は87.96px |
| テーマ・INDEX | moon→red→moonの切替とaria-pressedを確認。INDEXのEscapeで開くボタンへ復帰、Tab／Shift+Tabの循環、事業リンクからの閉鎖・対象へのフォーカス移動を確認 |
| フォームの入力確認 | 未入力の送信操作で4項目のエラーと名前欄へのフォーカスを確認。成功・失敗・20秒タイムアウト・二重送信は模擬応答の自動テストで確認 |
| 自動回帰 | コンテンツ220件、モーション13件、フォーム9件が成功 |

DOMRectの一致は構図・寸法の保護を示すもので、配色を含む画素比較の一致ではない。
pinの座標や退出位置は測定時のビューポートとレイアウトの値であり、すべての画面幅の固定値ではない。

リサイズ確認では、ページ全体の `scroll-behavior:smooth` がScrollTriggerのrefresh中の位置補正と競合する不具合を再現した。
トップのhtmlを `scroll-behavior:auto` にし、ユーザーが選んだ `[data-scroll]` リンクの移動だけをJSでsmoothにする形へ修正。
修正前後を再現して位置補正を確認した。reduced-motionの場合はリンク移動も即時にする。
タブレット幅の事業画像カードは768〜999pxを2列へ調整し、1000px以上の4列、767px以下の横スクロールと分けた。
既存サービスページの補助文字は `#b5bdcb`、背景ビネットのopacityは`.18`へ調整し、暗いオーバーレイが本文のコントラストを弱める状態を改善した。レイアウトは維持し、主要下層3ページではこのビネットを無効にしている。
非表示中の描画ループ停止は自動テストで確認した。タブ操作の自動化にはフォーカス上の制約があるため、実ブラウザーの証跡は復帰後の描画・操作までとする。

## 6. 引き続き確認する範囲

- Safari・Firefox、実機iOS/Android。未記録の幅375 / 1024pxも必要に応じて補完する。
- `/#contact` 直アクセスを含む各ブラウザーの深リンク操作。moon/red・INDEXのChrome操作確認は上表のとおり。
- `/?nochar3d=1`、外部CDNの遅延・失敗を実ブラウザーで確認する。GLB503・遅延、reduced-motion、タブ復帰のChrome実測は上表に記録済みだが、全ブラウザーの全組合せ確認済みとは扱わない。
- 本番のNetlify Forms受信。ローカルサーバーはNetlify Formsを処理しないため、今回の通信結果は模擬している。

**確認状況の扱い**：全ブラウザー・全端末の確認完了を宣言するものではない。
本番のForms受信・GA4稼働は2026-08-29の運用記録と区別する。
`main` へのpushは本番反映になる。プレビューが必要な変更は別ブランチを使う。
