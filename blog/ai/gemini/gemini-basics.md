# Geminiの始め方：アプリとWorkspaceは別物、禁止は同じ

**公開日**: 2026.08.19  
**カテゴリ**: AI  
**著者**: ククルFM編集部  
**概要**: gemini.google.com で禁止1行を固定し、要約・たたき台・チェックのどれかを今日1回回す。Gmailの中のGeminiとは別物として扱う。

---

## この記事でできるようになること / やらないこと

- **できること**: [Gemini](https://gemini.google.com/) を開き、禁止1行を付けたうえで、要約・たたき台・チェックのどれかを1回回す。
- **やらないこと**: 料金表、モデル名の優勝、画像生成の全機能、API。画面と可否は [Gemini アプリを使用する](https://support.google.com/gemini/answer/13275745?hl=ja) が正。最終確認日: 2026-08-19

共通の禁止は [AI導入の始め方](../basics/ai-introduction.html)。依頼の骨格は [プロンプトの型](../basics/prompt-engineering.html)。Gmail・Docsの中で使う日は [Gemini×Workspace](./gemini-workspace.html)。

## 結論

Geminiアプリ（ [gemini.google.com](https://gemini.google.com/) ）と、Gmailの横の「Gemini に相談」は **別物**。ここはアプリ側。禁止リストは ChatGPT と同じ文でよい。ツールを替えても、入れてよい情報は替えない。

仕事用アカウントでアイコンが無い、ログインできない、は故障ではなくプランか管理者。推測しない。[ログインに必要なもの](https://support.google.com/gemini/answer/13278668?hl=ja) を正とする。

## 開始前の1行

「氏名・住所・顧客の実名、実額、契約文、パスワードは貼らない。A社・X円に置き換える。」

この1行をチャットの先頭に固定してよい。ファイルを添付する日も、同じ禁止が先。

## 向く仕事 / 向かない仕事

向く: 伏せ字メモの要約、メールのたたき台、自分が書いた文のチェック。Google検索やYouTubeを日常で使っている人の入口。  
向かない（この記事）: 宛先と金額の確定、契約解釈、今日のニュースの正、医療・法律・金融の助言。調べもので出典が要る日は [Perplexity](../perplexity/perplexity-research.html)。手元PDFだけを根拠にする日は [Gemini Notebook](../notebooklm/notebook-lm.html)。

公式ヘルプも、概略・メール・投稿の **最初の下書き** と、複雑な話題の要約を用途に挙げている。完成文の送信は人。

## 3つの型

**要約**  
材料: 会議や現場のメモ（伏せ字）。出力: 決定 / 未決 / 次アクション。

**たたき台**  
材料: 相手、期限、お願い、NG。出力: 件名と本文。長さの上限を書く。

**チェック**  
材料: 自分が書いた文。出力: 誤解ポイントの列挙 → 修正案。最初から「綺麗な完成文だけ」を求めない。

ChatGPTの3型と同じ。覚え直さない。

## 手順

1. [gemini.google.com](https://gemini.google.com/) を開く（対応ブラウザはヘルプが正）
2. 禁止1行を貼る
3. 型を1つ選ぶ
4. 材料を5行以内
5. 出力形式（見出しと字数）
6. 返ってきたら、修正は1点だけ指示する
7. 固有名詞と数字を人が見てから使う

履歴を残す・ファイルを付ける、はログインが要ることがある。要否はヘルプが正。

## 演習（どれか1つ）

A: 社内メモ1枚を3見出しに要約させる。  
B: 依頼メールの下書きを出し、2回目で「200字・期限を明示・謝罪は1回」と足す。  
C: 自分の文を貼り、誤解箇所だけ先に出させる。

## つまずき

メニュー名が違う → この記事ではなく [ヘルプ](https://support.google.com/gemini/answer/13275745?hl=ja)。  
仕事用で使えない → 管理者と [ログイン条件](https://support.google.com/gemini/answer/13278668?hl=ja)。  
Gmailの横に出したい → [Workspace側](./gemini-workspace.html)。  
受付フォームを表にしたい → [フォーム→シート](./google-ai-automation.html)。

## 公式

- [Gemini](https://gemini.google.com/)
- [Gemini アプリを使用する](https://support.google.com/gemini/answer/13275745?hl=ja)
- [Gemini アプリへのログインに必要なもの](https://support.google.com/gemini/answer/13278668?hl=ja)
- [Gemini アプリ ヘルプ](https://support.google.com/gemini/?hl=ja)
- [Google 利用規約](https://policies.google.com/terms)
- [Google プライバシーポリシー](https://policies.google.com/privacy)

Google、Gemini は Google LLC の商標です。本記事は公式提供ではありません。
