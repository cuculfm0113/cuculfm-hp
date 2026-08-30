# 04. ページ別コピーとSEO一覧

固定コピー（要件原文と一字一句一致させる文言）の掲載場所と、全公開ページの
title / meta description / og:image をまとめたもの。**2026-08-30（フェーズ1〜8完了）時点の実ファイルから抽出**。
食い違いが出たら実ファイルが正で、この文書を直す。

---

## 1. 固定コピーの台帳

要件原文は [00-implementation-brief.md](00-implementation-brief.md) 第8章。文言のデータは
`content/site.config.json` の `messaging` と `content/pillars.json` の `crossSection` が持ち、
`scripts/build-content.mjs` が `<!-- BEGIN:マーカー名 -->` 区間へ書き出す。
**要件原文の「行そのもの」と完全一致するかをテストが検査している**
（`scripts/test-build-content.mjs` の `lineExact()`。切り詰め・欠落を検出）。
HTML側を手で直しても次回の同期で消えるので、直すのはデータ側。

| コピー | 掲載場所 | データ / マーカー |
|---|---|---|
| 既存キャッチ「普段と新しい暮らしをサポートする会社」 | トップ `<title>` と、ヒーローのコーナーコピー（`.corner--c` 内 `.corner-ja`。静的HTML） | `messaging.existingTagline` |
| 補強キャッチ「現場と事業に、技術を定着させる。」 | トップ `#statement` の `h2.stm-title`（ヒーロー直後の独立セクション） | `messaging.heroTagline` / `hero-copy` |
| ヒーローリード「建設・インフラ、クリエイティブ・テック、ライフスタイル。〜仕組みをつくります。」（3行） | `#statement` の `p.stm-lead` | `messaging.heroLead` / `hero-copy` |
| ヒーローCTA「ククルFMの事業を見る」（→`#business`）「FDE・AI実装支援を見る」（→`/fde/`、`click_fde_service`） | `#statement` の `.stm-cta` | `messaging.heroCtas` / `hero-copy` |
| FDEページのメインコピー「現場を知るから、変革を動かせる。」 | `/fde/` の `h1.fde-main` | `messaging.fdeMain` / `fde-lead` |
| FDEページのサブコピー「ククルFMは、業務の現場に入り込み、〜」（2段落） | `/fde/` の `.fde-sub` | `messaging.fdeSub` / `fde-lead` |
| 思想文「AIはAIらしく、人は人らしく。」＋本文2段落 | `/fde/` の `#philosophy` セクション `blockquote.philosophy` | `messaging.philosophy` / `philosophy` |
| 横断セクション名「FDE & AI IMPLEMENTATION」 | トップ `#fde-cross` の `p.eyebrow`（マーカー `fde-cross`）、`/fde/` ヒーローの `p.hero-label`（こちらは静的HTML直書き。マーカー対象外なので変えるときは両方直す） | `pillars.json crossSection.sectionName` |
| 横断見出し「技術を、現場で使われる仕組みへ。」 | `#fde-cross` の `h2.fde-heading` | `crossSection.heading` / `fde-cross` |
| 横断本文3段落（結び「事業と現場に、技術を定着させます。」） | `#fde-cross` の `.fde-body` | `crossSection.body` / `fde-cross` |
| 3ステップ「01 Understand 現場と事業を理解する」「02 Build 仕組みを設計・実装する」「03 Embed 使われ続ける状態へ育てる」 | `#fde-cross` の `ol.fde-steps` | `crossSection.steps` / `fde-steps` |
| 横断CTA「FDE・AI実装支援の詳細を見る」（→`/fde/`、`click_fde_service`） | `#fde-cross` の `a.btn-fde` | `crossSection.cta` / `fde-steps` |

### 計画との差分・補足

- **補足コピー「AI・データ・クリエイティブを、使われ続ける仕組みへ。」は画面のどこにも表示していない**。
  データとしては `messaging.siteTaglineSupport` に保持され、テストの原文一致検査の対象にはなっているが、
  どのHTMLにも出力されていない（要件は掲載場所を指定していなかった）。使うときはマーカーを足すこと
- 補強キャッチは要件では「ファーストビューの下またはアニメーション切り替え要素」だったが、
  実装は `#hero` の内側ではなく直後の独立セクション `#statement`（2026-08-29 フェーズ2の確定事項）
- `/fde/` ヒーローには要件原文にない一文「サイト内では『現場伴走型のAI・DX実装支援』と呼んでいます。」
  （`p.hero-plain`、静的HTML）を追加している。FDEを前面に出しすぎない方針の反映

---

## 2. 全公開ページのSEO一覧（48ページ）

> 2026-08-30 追記: このうち8ページ（ai-tools / media / condo×4 / custom / craft）は
> 発注者指示で**一時掲載停止**（noindex・_redirects 404・sitemap 除外・全導線撤去）。
> head の canonical / OGP はファイルに残してあり、再開時はそのまま使える。

公開URLの正は `sitemap.xml`（`scripts/generate-sitemap.mjs` の結果と一致することをテストが検査）。
`404.html` は `noindex, nofollow` で sitemap 外。内訳:

| 区分 | ページ数 |
|---|---|
| トップ / fde / about / privacy | 4 |
| insights（一覧 + 記事8本） | 9 |
| services | 19 |
| blog（dog 4 + inspection 9） | 13 |
| articles / event / recruit | 3 |
| **計** | **48** |

以下は実HTMLから機械抽出したもの（`|` は `\|` にエスケープ。og:image は既定
`/images/ogp/ogp-default.png` を「既定PNG」、それ以外を「個別(パス)」と略記）。
文言を変えたら再抽出して貼り替える:

```bash
node -e '
const fs=require("fs");
const urls=[...fs.readFileSync("sitemap.xml","utf8").matchAll(/<loc>(.*?)<\/loc>/g)].map(m=>m[1]);
for(const u of urls){
  const p=u.replace("https://cucul-fm.com/","");
  const h=fs.readFileSync(p===""?"index.html":(p.endsWith(".html")?p:p+"index.html"),"utf8");
  const g=(re)=>((h.match(re)||[])[1]||"(なし)").trim().replace(/\s+/g," ").replace(/\|/g,"\\|");
  let og=(h.match(/<meta property="og:image" content="([^"]+)"/)||[])[1]||"(なし)";
  og=og.endsWith("/images/ogp/ogp-default.png")?"既定PNG":"個別("+og.replace("https://cucul-fm.com","")+")";
  console.log(`| \`/${p}\` | ${g(/<title>([\s\S]*?)<\/title>/)} | ${g(/<meta name="description" content="([\s\S]*?)"/)} | ${og} |`);
}'
```

| URL | `<title>` | meta description | og:image |
|---|---|---|---|
| `/` | CUCUL FM.LLC \| 普段と新しい暮らしをサポートする会社 | ククルFM合同会社。建設・インフラ、クリエイティブ・テック、ライフスタイル。テクノロジーを横串に、普段と新しい暮らしをサポートします。 | 既定PNG |
| `/about/` | 会社概要 \| CUCUL FM.LLC | ククルFM合同会社（CUCUL FM.LLC）の会社概要。建設・インフラ、クリエイティブ・テック、ライフスタイルの3つの事業と、それらを横断するFDE・AI実装支援の考え方、会社情報、対応地域、お問い合わせ方法を掲載しています。 | 既定PNG |
| `/articles/` | 記事一覧 \| CUCUL FM | CUCUL FMのブログ記事一覧。調査・清掃、犬に携わる業務の公開記事を掲載しています。 | 既定PNG |
| `/blog/dog/home-grooming.html` | 自宅ケアとサロンの境目：グルーミングの道具と手順 \| CUCUL FM | 自宅でのブラッシングや爪切りと、サロンに任せた方がいいケアの境目をご紹介します。 | 個別(/services/dog/images/bichon-white.jpg) |
| `/blog/dog/puppy-preparation.html` | 子犬を迎える前に準備すべきこと \| CUCUL FM | 子犬を迎える前に揃えたい道具と、家族で決めておきたいことをご紹介します。 | 個別(/services/dog/images/black-poodle-ribbon.jpg) |
| `/blog/dog/seasonal-health-care.html` | 季節ごとの愛犬の健康管理（関東・川口〜桐生） \| CUCUL FM | 関東の気候に合わせた愛犬の健康管理と、季節ごとのサロン利用の目安をご紹介します。 | 個別(/images/gallery/dog-run.png) |
| `/blog/dog/trust-relationship.html` | 来店・預かりの前日にやること \| CUCUL FM | トリミングやホテル利用の前日に整えておきたいことを、サロンの現場からご紹介します。 | 個別(/services/dog/images/papillon-smile.jpg) |
| `/blog/inspection/aircon-cleaning.html` | エアコン：フィルターは自分、分解洗浄は資格 \| CUCUL FM | エアコンのフィルター清掃と、自分でやってはいけない内部洗浄との境目をご紹介します。 | 既定PNG |
| `/blog/inspection/drone-wall-inspection.html` | ドローン外壁調査：打診の代わりになる条件は告示とガイドライン \| CUCUL FM | 外壁調査でドローンの赤外線を使う際に基準となる告示とガイドラインを整理します。 | 既定PNG |
| `/blog/inspection/gutter-cleaning.html` | 雨樋：溢れたあとに見る順番と、高所を無理しない \| CUCUL FM | 大雨のあと雨樋の詰まりを、地面から安全に見極めるコツをご紹介します。 | 既定PNG |
| `/blog/inspection/manhole-safety.html` | マンホール作業の安全：酸欠・硫化水素と交通誘導 \| CUCUL FM | マンホール作業の前に欠かせないガス測定と交通誘導を、法令の最低ラインと現場の実務からご紹介します。 | 個別(/images/gallery/manhole-work-site.png) |
| `/blog/inspection/sewer-camera-methods.html` | 下水道カメラ調査の方式：ミラー・TV・取付管・押し込み \| CUCUL FM | 本管・取付管・マンホール近傍で、私たちが管路調査の現場でどう方式を選び分けているかをご紹介します。 | 個別(/images/gallery/pipe-interior-camera.png) |
| `/blog/inspection/sewer-damage-report.html` | 管路の損傷判定の見方：報告書の記号と写真 \| CUCUL FM | 報告書のスパン・記号・写真の見方を、現場で実際にどう確認しているかを交えて解説します。 | 個別(/images/gallery/pipe-circular-inspection.png) |
| `/blog/inspection/sewer-exam-study.html` | 下水道資格試験：過去問の解き方と法規の覚え方 \| CUCUL FM | 管路協の過去問と法規を、現場の実務と結びつけながら覚える私たちのやり方をご紹介します。 | 個別(/images/gallery/pipe-inspection-control.png) |
| `/blog/inspection/sewer-qualifications.html` | 下水道の資格の地図：管理技術認定と管路管理技士 \| CUCUL FM | 下水道管路の仕事に関わる資格を、JS・管路協・酸欠作業主任者の違いから整理します。 | 個別(/images/gallery/sewer-training-session.png) |
| `/blog/inspection/solar-panel-cleaning.html` | 太陽光パネル清掃：取説が正、屋根に上がらない \| CUCUL FM | 太陽光パネルの汚れとメンテナンスを、屋根に上がらずに見極める考え方をご紹介します。 | 既定PNG |
| `/event/` | イベント告知 \| CUCUL FM | ククルFMのPR資料・イベント告知をご覧いただけます。 | 既定PNG |
| `/fde/` | FDE・AI実装支援（現場伴走型のAI・DX実装支援） \| CUCUL FM.LLC | ククルFMの現場伴走型のAI・DX実装支援。業務の現場に入り込み、課題整理から、AI・SaaS・データ基盤の設計と実装、運用定着、継続改善まで伴走します。進め方の3ステップ、12か月ロードマップ、AI・データの取扱い方針を掲載しています。 | 既定PNG |
| `/insights/` | Insights（現場DX・AI活用の記事） \| CUCUL FM.LLC | ククルFMが現場で使っている判断基準と手順をまとめた記事一覧。下水道の管路調査や建設・清掃の実務をもとに、現場DXの進め方、AI活用の定着、業務フロー診断、システムの選び方、情報の整理、12か月のDXロードマップを書いています。 | 既定PNG |
| `/insights/ai-teichaku/` | AI導入が現場に定着しない理由。業務設計・教育・ルール・評価から考える \| CUCUL FM.LLC | AIを試してみたものの、一部の人が使うだけで終わってしまう。その原因を、用途の絞り方、教える内容、入力してよい情報の線引き、評価のしかたという4つの観点から整理し、定着した状態をどう定義するかを説明します。 | 既定PNG |
| `/insights/ai-usecases/` | 現場・バックオフィスにおけるAI活用例と、人が最終判断すべき範囲 \| CUCUL FM.LLC | 情報検索、記録の要約、帳票の下書き、写真・書類の整理、顧客対応の補助。現場と事務のどの仕事からAIを使えるかを具体的に挙げ、あわせて人が確認・承認すべき範囲と、AIに入力してよい情報の線引きを整理します。 | 既定PNG |
| `/insights/data-foundation/` | 散らばる情報を業務データへ変える方法。紙・Excel・写真・PDF・メールの整理手順 \| CUCUL FM.LLC | 紙、Excel、CSV、写真、PDF、メール、チャット、既存システム。ばらばらに貯まった情報を、検索・集計・引き継ぎができる業務データへ変える手順を、キーの決め方、マスタ、命名、履歴の残し方から説明します。 | 既定PNG |
| `/insights/dx-roadmap/` | 中小企業がDXを進める12か月ロードマップ。課題整理から定着・横展開まで \| CUCUL FM.LLC | 限られた人手で進めるDXを、3か月ごとの4フェーズに分けて説明します。課題整理、最小構成での試験運用、現場への定着、効果測定と横展開。各期にやること、手元に残る成果物、つまずきやすい点を整理します。 | 既定PNG |
| `/insights/fde-toha/` | FDEとは何か。ITコンサル・SES・受託開発との違い \| CUCUL FM.LLC | FDE（Forward Deployed Engineer）は、現場と事業の課題を理解したうえで仕組みを設計・実装し、定着まで伴走する役割です。ITコンサルティング・SES・受託開発との違いを、責任の範囲と向いている場面から整理します。 | 既定PNG |
| `/insights/genba-dx/` | 現場DXとは何か。失敗しやすい理由と、進め方の判断基準 \| CUCUL FM.LLC | 現場DXは、現場で生まれる記録・写真・報告を、事務所や管理側がそのまま使える形にする取り組みです。失敗しやすい5つの理由と、進め方、続いているかどうかの判断基準を、下水道の管路調査の実務をもとに整理します。 | 既定PNG |
| `/insights/gyomu-flow/` | 業務フロー診断の進め方。現場・事務・管理者の仕事を可視化して改善テーマを決める \| CUCUL FM.LLC | 業務フローの可視化は、きれいな図をつくることが目的ではありません。対象の決め方、聞き取りで実際に確認していること、図の粒度、改善テーマの絞り込み方までを、手順として説明します。 | 既定PNG |
| `/insights/saas-vs-custom/` | SaaS導入と個別開発の選び方。既製SaaS・ノーコード・個別開発・既存連携の判断軸 \| CUCUL FM.LLC | 既製SaaS、ノーコード、個別開発、既存システムとの連携。どれを選ぶかは機能の比較表では決まりません。業務の型に合うか、データを取り出せるか、誰が直し続けるかという判断軸から、選び方と選んだ後の確認事項を整理します。 | 既定PNG |
| `/privacy/` | プライバシーポリシー \| CUCUL FM.LLC | ククルFM合同会社の個人情報保護方針。お問い合わせでいただく個人情報の取得目的・利用範囲・第三者提供の考え方と、アクセス解析ツールの利用について記載しています。 | 既定PNG |
| `/recruit/` | アルバイト募集 \| CUCUL FM - 好きを仕事に変えよう | ククルFMでは高校生・大学生のアルバイトを募集中！映像制作、Web開発、AI活用など、将来につながるスキルが身につく実践型インターン。 | 既定PNG |
| `/services/ai-tools/` | AIツール紹介 / 学習 \| CUCUL FM | ChatGPT / Claude / Gemini / Cursor などのAIツール紹介と、業務への導入・活用支援。用途に合わせた選び方をご案内します。 | 既定PNG |
| `/services/ai/` | DX・業務効率化システム開発 \| CUCUL FM | ククルFMのDX・業務効率化システム開発。業務課題の整理・要件定義から、業務に合わせた専用システムの設計・開発、導入後の改善・運用支援まで一貫してご支援します。 | 既定PNG |
| `/services/condo/` | オーナーズコモン \| CUCUL FM | ククルFMのオーナーズコモン。オーナー専用の共有空間。仲間と使える高級麻雀スペース、自然豊かな共有型隠れ家など、所有感と共有を両立した特別な空間を提供します。 | 既定PNG |
| `/services/condo/garage/` | プライベートガレージ \| オーナーズコモン \| CUCUL FM | 各地域に点在する、共有型プライベートガレージ。愛車を眺め、仲間と語らう。所有感と共有を両立した、新しいガレージライフ。 | 既定PNG |
| `/services/condo/hideaway/` | 共有型隠れ家 \| オーナーズコモン \| CUCUL FM | 映画に登場するスパイの隠れ家のような、自然豊かなロケーションに佇む共有型リトリート。仲間と共有することで実現する、特別なセーフハウス。 | 既定PNG |
| `/services/condo/mahjong/` | 高級麻雀スペース \| オーナーズコモン \| CUCUL FM | 仲間と共有する完全プライベートな高級麻雀ラウンジ。全自動卓完備、持ち込み自由。所有感と共有を両立した、大人のための特別空間。 | 既定PNG |
| `/services/construction/` | 建設業 \| CUCUL FM | ククルFMの建設業事業。現場監督、施工管理、土木・解体・リフォーム・外構・太陽光パネル設置まで幅広く対応。 | 既定PNG |
| `/services/craft/` | オリジナルクラフト販売 \| CUCUL FM | ククルFMのオリジナルクラフト販売事業。業務別のノウハウが詰まった手製のアイテムを製作・販売。現場経験を活かした実用的な機器をお届けします。 | 既定PNG |
| `/services/custom/` | オーダーメイド製品販売 \| CUCUL FM | ククルFMのオーダーメイド製品販売事業。お客様のご要望に合わせた特注品を製作。既製品では対応できない特殊なニーズにも柔軟に対応いたします。 | 既定PNG |
| `/services/document/` | 資料作成 \| CUCUL FM | ククルFMの資料作成サービス。社内外向けのプレゼン資料、レポート、提案書などを高品質に作成します。 | 既定PNG |
| `/services/dog/` | 犬に携わる業務 \| CUCUL FM | ククルFMの犬関連事業。ブリーディング、ペットシッター、ドッグサロンなど、愛犬家のための総合サービス。 | 既定PNG |
| `/services/dog/breeds/` | 犬図鑑 - 犬種大全 \| CUCUL FM | FCIの10グループで140犬種を検索・絞り込み。犬種ごとの写真つきで、性格とお手入れの目安をカードで比較できます。 | 既定PNG |
| `/services/dog/breeds/detail.html` | 犬図鑑 \| CUCUL FM | 犬種の性格・育て方・注意点・健康管理を詳しく解説。CUCUL FMの犬図鑑。 | 既定PNG |
| `/services/dog/pet-floor/` | CUCULペットの床 \| 犬に携わる業務 \| CUCUL FM | ククルFMの自社製品「ペットの床」。愛犬の歩行に配慮したUVフロアコーティングで、滑りにくさとお手入れのしやすさを両立。販売・施工のご相談を承ります。 | 既定PNG |
| `/services/inspection/` | 調査・清掃 \| CUCUL FM | ククルFMの調査・清掃事業。下水道管路内調査清掃を中心に、ソーラーパネル清掃、外壁調査、ドローン測量まで専門サービスをご提供。 | 既定PNG |
| `/services/media/` | メディア運営 \| CUCUL FM | ククルFMのメディア運営事業。YouTube、Instagram、ポッドキャストなど複数プラットフォームでの情報発信をサポート。 | 既定PNG |
| `/services/tools/` | 専門工具販売 \| CUCUL FM | ククルFMの専門工具販売事業。建設・インフラ現場のプロフェッショナル向け専門工具を販売。第1弾は東京都型マンホール鍵（自社製品）。 | 既定PNG |
| `/services/video/` | 映像制作・編集 \| CUCUL FM | ククルFMの映像制作。所持機材は Sony FX30 / α6700、DaVinci Resolve、ドローン・FPV。空撮から編集まで。 | 既定PNG |
| `/services/web/` | ホームページ制作・3Dデザイン・アプリ開発 \| CUCUL FM | ククルFMのWeb・3Dデザイン事業。コーポレートは領域を先に固定。実績は公式サイト、ファントムDJ、犬図鑑。 | 既定PNG |

---

## 3. title の命名規則（現状は新旧が混在）

| 系統 | 形 | 対象 |
|---|---|---|
| トップ | `CUCUL FM.LLC \| 〜`（社名が先頭） | `/` のみ |
| 改修で作った新規ページ | `〜 \| CUCUL FM.LLC` | `/fde/` `/about/` `/privacy/` `/insights/`（一覧+記事8本）の計12ページ |
| 旧ページ | `〜 \| CUCUL FM`（`.LLC` なし。condo 配下などは `子 \| 親 \| CUCUL FM` の3段） | services 19 / blog 13 / `/articles/` `/event/` の計34ページ |
| 例外 | `アルバイト募集 \| CUCUL FM - 好きを仕事に変えよう` | `/recruit/` のみ |

- 新規側のサフィックスは `content/site.config.json` の `site.titleSuffix`（`CUCUL FM.LLC`）
- テストの表記検査が「CUCUL FM .LLC」（スペース入り）を禁じているのは、content データ内・
  新規ページ・Insights 記事本文。旧ページ title の「CUCUL FM」（`.LLC` なし）は検査対象外。
  旧ページを触る機会があれば `.LLC` 形へ寄せてよいが、現状は混在のまま容認している（一括変更はしていない）

---

## 4. SEOメタ（title / description）の管理場所

| 対象 | 正とするデータ | 検査 |
|---|---|---|
| トップ / `/fde/` / `/about/` / `/insights/`（一覧） / `/privacy/` | `content/site.config.json` の `pages`（`name` / `description`） | HTML の `<title>` `<meta name="description">` `canonical` `og:title` `twitter:title` 等と**一字一句一致**するかをテストが突き合わせる |
| insights 記事8本 | `content/insights.json` の `articles`（`title` / `description`） | `pages` 定義は `title + " \| CUCUL FM.LLC"` で**自動生成**される。`site.config.json` に手書きするとテストが落ちる |
| 旧ページ（services / blog / articles / event / recruit） | HTML 直書き（データ管理なし） | 6g節の共通検査（下記）のみ |
| OGP 既定画像 | `content/site.config.json` の `site.defaultOgImage`（`/images/ogp/ogp-default.png`、1200×630） | 記事の **Article JSON-LD の `image`** もここから生成される（`build-content.mjs`）。各ページの `og:image` タグ自体はHTML直書き |

変更手順（データ編集 → `node scripts/build-content.mjs` → テスト → push）は
[07-update-guide.md](07-update-guide.md) の4節を参照。

---

## 5. 全ページ必須のSEOメタ（テスト6g節が検査）

`scripts/test-build-content.mjs` の「6g. SEOメタとアセット（フェーズ8）」が、
**全公開HTML（`404.html` は noindex のため canonical/OGP 検査から除外）**に対して以下を検査する。
新規ページを作るときも全部そろえないとテストが落ちる。

| 検査 | 内容 |
|---|---|
| canonical | 全ページに `<link rel="canonical">` があり、**自身のURL**を指す |
| OGP / Twitter Card | `og:type` `og:url` `og:title` `og:description` `og:image` `og:locale` `twitter:card` `twitter:image` が全ページにあり、`og:url` は自身のURLと一致 |
| OGP画像の実体 | `og:image` / `twitter:image` は絶対URLで、リポジトリ内に実在し、**SVG禁止**（SNSで描画されないため） |
| PNG寸法 | `ogp-default.png` = 1200×630、`favicon-192.png` = 192×192、`favicon-512.png` = 512×512 |
| manifest | `site.webmanifest` が有効なJSONで、icons の実体・寸法が `sizes` と一致 |
| リンクタグ | 全ページに PNG favicon（`/images/icons/favicon-192.png`）、`rel="manifest"`、`rel="apple-touch-icon"` |
| sitemap | `sitemap.xml` のURL集合が `generate-sitemap.mjs` の生成結果と一致（不足・残骸を検出） |

```bash
node scripts/test-build-content.mjs   # 217件すべて合格すること（2026-08-30 時点）
```
