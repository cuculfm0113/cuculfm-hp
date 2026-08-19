# Gemini Notebook（旧 NotebookLM）：ソースを入れて、引用を開く

**公開日**: 2026.08.19  
**カテゴリ**: AI  
**著者**: ククルFM編集部  
**概要**: 手元の資料だけを根拠にする。引用を原文と突き合わせ、資料に無い予測は別ツールへ出す。

---

## この記事でできるようになること / やらないこと

- **できること**: 今日、伏せ字の資料1点を入れ、「資料のどこにあるか」が付く質問を1回する。
- **やらないこと**: 件数上限の暗記、料金、音声概要の全解説。製品名と画面は [Gemini Notebook](https://notebooklm.google/) と [ヘルプ](https://support.google.com/notebooklm/answer/16164461?hl=ja) が正。最終確認日: 2026-08-19

公式は 2026年7月、NotebookLM を **Gemini Notebook** に改称した（同一製品。既存ノートはそのまま）。URL は [notebooklm.google](https://notebooklm.google/) 。画面に旧称が残っていても、やることは同じ。**入れたソースに根ざす**。

共通の禁止は [AI導入の始め方](../basics/ai-introduction.html)。ウェブの出典探しは [Perplexity](../perplexity/perplexity-research.html)。読み方の手順は [論点→質問](./notebooklm-workflows.html)。

## 結論

対話AIにPDFを貼るのとは別物。ここは **ソース外の一般知識で穴を埋めない** ための箱。ヘルプも、アップロードしたソースに基づいて答える、と書いている。資料に無いことは「資料にない」で止める。

## 開始前

1. 入れてよい資料か（著作権、顧客実名、未公開契約）。ダメなら入れない
2. 実名と実額は伏せる。A社・X円
3. ノートは1テーマ。資格試験と顧客案件を混ぜない

仕事用アカウントは、管理者が許可していないと使えないことがある。ヘルプが正。

## 質問（コピペ）

```
このノートのソースだけを根拠にする。
ソースに無いことは「ソースにない」と書く。推測しない。
聞きたいこと: ＿＿
出力: 答え / 引用（どの資料のどの付近か） / 不明点
```

返ってきた引用を、必ず原文で開く。引用UIの名前は変わる。変わっても **原文を開く** は変えない。

## 向く仕事 / 向かない仕事

向く: 仕様書・指針・社内マニュアルの「どこに書いてあるか」、複数PDFの共通点と食い違い。  
向かない（この箱だけ）: 今日のウェブニュース、ソースに無い市場予測、契約の最終解釈。

音声概要（Audio Overview）は全体の耳用。数字と条文はテキストと原文。ヘルプも医療・法律・金融は専門家へ、と注意している。

## 演習（1つ）

公開の短いPDF（自分のサイトの記事でも可）を1点入れる。「結論は何か。引用付き」と聞く。引用箇所を原文で確認する。確認していない文は使わない。

会議用の回し方は [論点→質問](./notebooklm-workflows.html)。

## 公式

- [Gemini Notebook](https://notebooklm.google/)
- [Gemini Notebook の詳細（ヘルプ）](https://support.google.com/notebooklm/answer/16164461?hl=ja)
- [Google 利用規約](https://policies.google.com/terms)
- [Google プライバシーポリシー](https://policies.google.com/privacy)

Google、Gemini Notebook、NotebookLM は Google LLC の商標です。本記事は公式提供ではありません。
