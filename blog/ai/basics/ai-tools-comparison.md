# 用途で選ぶ：ChatGPT・Claude・Gemini・調べものAI

**公開日**: 2026.08.18  
**カテゴリ**: AI  
**著者**: ククルFM編集部  
**概要**: 最強を決めず、今週の仕事5つに先に試すツールを割り当てる。料金とモデル名は公式を正とする。

---

## この記事でできるようになること / やらないこと

- **できること**: 今週の仕事5つに対して「先に試すツール」を3行で決める。
- **やらないこと**: ベンチマークの優勝、全機能の解説、料金の保証。料金・モデル名は公式が正。最終確認日: 2026-08-18

導入の安全ルールは先に [AI導入の始め方](./ai-introduction.html) を読む。

## 結論

最強を1つ決めない。仕事の種類で切り替える。迷ったら **文章の下書きは対話AI、根拠の必要な調べものは出典が出る検索AI、長い資料の読み込みは資料専用、コードやサイト修正はエディタ**。

## 今週の仕事に印を付ける（コピペ用）

自分の仕事を5つ書く。例:

1. 問い合わせメールの下書き
2. 調査報告書の構成
3. 法規や製品仕様の確認（出典が要る）
4. 複数PDFから論点だけ抜き出す
5. ホームページの文言修正

印の付け方:

- 日本語の文を整える → ChatGPT または Claude
- 長い資料を壊さず要約 → Claude
- Gmail / Docs / Sheets の中で済ませたい → Gemini
- 「いつの情報か」「どこ出典か」が要る → Perplexity
- 資料をアップロードして何度も質問 → [Gemini Notebook](../notebooklm/notebook-lm.html)（旧称 NotebookLM）
- サイトや文書ファイルを直す → [非エンジニア向けCursor](../cursor/cursor-for-non-engineers.html)（バックアップしてから）

2週間、同じ質問を2製品に投げて、読みやすさと手戻りだけ記録する。スペック表よりその記録を正にする。

## 使い分けの目安

**ChatGPT（OpenAI）**  
会話の往復、たたき台、短い自動化の相談。最初の成功体験を作りやすい。

**Claude（Anthropic）**  
長い文、トーンの調整、規程や報告書の整合。CUCULの調査報告ドラフト向き。

**Gemini（Google）**  
すでに Google アカウントでメールと表計算を回している事務所。

**Perplexity**  
調べものの入口。出たリンクを必ず自分で開く。[出典を1本開く](../perplexity/perplexity-research.html)。

**NotebookLM（Gemini Notebook）**  
手元のPDF・メモだけを根拠にしたいとき。資料にないことは「資料にない」と言わせる。[ソースを入れて引用を開く](../notebooklm/notebook-lm.html)。

**Cursor**  
このホームページのようなファイルを、範囲を決めて直す。非エンジニアはバックアップ必須。[1ファイルだけ直す](../cursor/cursor-for-non-engineers.html)。

## 自分用ルール3行（例）

外向けメールの下書きはA。長い要約はB。出典が要る調べものはC。  
機密と実名はどのツールにも入れない。  
有料化するのは、週に10回以上同じ型を回してから。

## チェックリスト

- [ ] 仕事5つに印を付けた
- [ ] デフォルトツールを3行で書いた
- [ ] 料金は公式で確認した（この記事の数字は使わない）

## 次に読む

- [プロンプトの型](./prompt-engineering.html)
- [学習の順](../../ai-tools/ai-learning-roadmap.html)
- 対話で回すなら [ChatGPTの始め方](../chatgpt/chatgpt-basics.html)。長文の骨子は [Claudeの始め方](../claude/claude-basics.html)。サイトの1ファイル修正は [Cursor（非エンジニア）](../cursor/cursor-for-non-engineers.html)。
- Gmail / Docs の中で済ませるなら [Gemini×Workspace](../gemini/gemini-workspace.html)。受付フォームは [フォーム→シート](../gemini/google-ai-automation.html)。
- 出典が要る調べものは [Perplexity](../perplexity/perplexity-research.html)。手元PDFは [Gemini Notebook](../notebooklm/notebook-lm.html)。

## 公式

- [ChatGPT](https://chatgpt.com/)
- [Claude](https://claude.ai/)
- [Gemini](https://gemini.google.com/)
- [Perplexity](https://www.perplexity.ai/)
- [NotebookLM](https://notebooklm.google/)
- [Cursor](https://cursor.com/)

本記事は各社の公式提供ではありません。
