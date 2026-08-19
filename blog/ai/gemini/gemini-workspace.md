# Gemini×Workspace：下書きはサイドパネル、送信は人

**公開日**: 2026.08.19  
**カテゴリ**: AI  
**著者**: ククルFM編集部  
**概要**: Gmail・ドキュメント・スプレッドシートの中で下書きを取り、数字と宛先は人が見てから出す。アイコンが無い日は公式と管理者を正とする。

---

## この記事でできるようになること / やらないこと

- **できること**: 今日、伏せ字のメモからメール1通、または見出しだけの資料1枚を下書きする。
- **やらないこと**: 料金表、管理者設定の全解説、スライドとMeet。画面名・可否・プランは [Google Workspace with Gemini の活用](https://support.google.com/a/users/answer/15146419?hl=ja) が正。最終確認日: 2026-08-19

共通の禁止は [AI導入の始め方](../basics/ai-introduction.html)。依頼の骨格は [プロンプトの型](../basics/prompt-engineering.html)。表の式とGASのテストは [スプレッドシート×ChatGPT](../chatgpt/chatgpt-excel-gas.html)。

## 結論

GeminiをWorkspaceで使う意味は、**メールと表を開いたまま下書きできる**こと。だからこそ送信ボタンは人が押す。アイコンが無い、メニュー名が違う、は故障ではなくプランか管理者の話。推測しない。

## 開始前

1. Gmail またはドキュメントの右上付近に **「Gemini に相談」** があるか見る（正式な位置はヘルプが正）
2. 無い → [ヘルプ](https://support.google.com/a/users/answer/15146419?hl=ja) と管理者。この記事の手順はここで止める
3. ある → 禁止1行を先に書く

「氏名・住所・顧客の実名、実額、契約文、パスワードは貼らない。A社・X円に置き換える。」

会社の Workspace では、顧客契約がクラウドAIを禁じていることがある。許可は情シスと契約が正。Geminiアプリ（ [gemini.google.com](https://gemini.google.com/) ）と、Gmailの中のGeminiは別物として扱う。

## 向く仕事 / 向かない仕事

向く: 依頼・お礼・催促の下書き、Docsの見出し案、シートの列名と関数のたたき台。  
向かない（単独）: 宛先と金額の確定、契約解釈、今日のニュースの正、医療・法律・金融の助言（ヘルプもそう書いてある）。

## メール（コピペ）

相手: A社（実名は出さない）  
目的: ＿＿  
期限: ＿＿  
必須: ＿＿  
禁止: 謝罪の連打、新しい数字  
出力: 件名1、本文200字以内、次アクション1行

返ってきたら人が見る3点: 宛先、日付、金額。送信は自分。

長いスレッドは「最新の依頼だけ」を渡す。全文を要約させてから返事を書かせると、古い条件が混ざる。

## ドキュメント（コピペ）

読者: ＿＿  
目的（1行）: ＿＿  
今日出すもの: 見出し案だけ / 第1節だけ  
禁止: 新しい数字、固有名詞の変更

見出しを人が直してから本文。全文一発は使わない。

## スプレッドシート

列名とテスト3行を書いてから関数を頼む。本番列は触らない。詳細は [テストシートから](../chatgpt/chatgpt-excel-gas.html) と同じ。

「このシートを要約して」は、個人名が入ったままだと要約にも残る。渡す範囲を先に決める。

## 演習（1つ）

架空の催促メモ（伏せ字）でメール下書きを1通。件名と期限だけ人が直して、下書きフォルダに残す。送信しない。

フォームからの受付をシートに落とす仕事は [フォーム→シート](./google-ai-automation.html)。

## 公式

- [Google Workspace with Gemini の活用](https://support.google.com/a/users/answer/15146419?hl=ja)
- [Gemini in ドキュメント / スプレッドシート など](https://support.google.com/docs/answer/15123226?hl=ja)
- [Gemini](https://gemini.google.com/)
- [Google 利用規約](https://policies.google.com/terms)
- [Google プライバシーポリシー](https://policies.google.com/privacy)

Google、Gemini、Google Workspace は Google LLC の商標です。本記事は公式提供ではありません。
