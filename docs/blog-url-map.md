# ブログ URL 対応表（Wave 9：下書き公開・調査二次刷新・コンド廃止）

パスはサイトルートからの HTML。

## いま公開する（一覧 + sitemap）

- `/blog/inspection/sewer-camera-methods.html`
- `/blog/inspection/sewer-damage-report.html`
- `/blog/inspection/manhole-safety.html`
- `/blog/inspection/sewer-qualifications.html`
- `/blog/inspection/sewer-exam-study.html`
- `/blog/inspection/gutter-cleaning.html`
- `/blog/inspection/solar-panel-cleaning.html`
- `/blog/inspection/drone-wall-inspection.html`
- `/blog/inspection/aircon-cleaning.html`
- `/blog/dog/trust-relationship.html`
- `/blog/dog/puppy-preparation.html`
- `/blog/dog/home-grooming.html`
- `/blog/dog/seasonal-health-care.html`
- `/blog/video/drone-shooting.html`
- `/blog/video/fx30-a6700.html`
- `/blog/video/davinci-resolve-export.html`
- `/blog/video/fpv-safety.html`
- `/blog/video/infrared-reading.html`
- `/blog/web/corporate-site-decisions.html`
- `/blog/web/top-3d-intent.html`
- `/blog/web/pet-floor-lp.html`
- `/blog/web/breed-catalog-ui.html`
- `/blog/ai/basics/ai-introduction.html`
- `/blog/ai/basics/ai-local-business.html`
- `/blog/ai/basics/ai-tools-comparison.html`
- `/blog/ai/basics/prompt-engineering.html`
- `/blog/ai-tools/ai-learning-roadmap.html`
- `/blog/ai/chatgpt/chatgpt-basics.html`
- `/blog/ai/chatgpt/chatgpt-prompts-practical.html`
- `/blog/ai/chatgpt/chatgpt-workflows-business.html`
- `/blog/ai/chatgpt/chatgpt-excel-gas.html`
- `/blog/ai/claude/claude-basics.html`
- `/blog/ai/claude/claude-longform-writing.html`
- `/blog/ai/claude/claude-artifacts.html`
- `/blog/ai/cursor/cursor-for-non-engineers.html`
- `/blog/ai/cursor/cursor-setup.html`
- `/blog/ai/cursor/cursor-productivity-tips.html`
- `/blog/ai/gemini/gemini-basics.html`
- `/blog/ai/gemini/gemini-workspace.html`
- `/blog/ai/gemini/google-ai-automation.html`
- `/blog/ai/perplexity/perplexity-research.html`
- `/blog/ai/perplexity/perplexity-comparison.html`
- `/blog/ai/notebooklm/notebook-lm.html`
- `/blog/ai/notebooklm/notebooklm-workflows.html`

## ディスクに残す（未公開・noindex）

なし。床LPと犬図鑑は作り変えたうえで `/services/web/` の実績へ戻した。

## 廃止と 301

- `/blog/dog/dog-care-basics.html` → `/blog/dog/home-grooming.html`
- `/blog/construction/*` → `/services/construction/`
- `/blog/web/*`（汎用SEO等） → `/services/web/`
- `/blog/video/company-video.html` `/sns-video.html` `/event-coverage.html` → `/blog/video/drone-shooting.html`
- `/blog/document/*` `/blog/media/*` → `/services/video/`
- `/blog/craft/*` `/blog/tools/*` → `/services/tools/`
- `/blog/custom/*` → `/services/custom/`
- `/blog/condo/*` → `/services/condo/`
- `/blog/ai-tools/ai-tools-comparison.html` → `/blog/ai/basics/ai-tools-comparison.html`
- `/blog/ai-tools/prompt-engineering.html` → `/blog/ai/basics/prompt-engineering.html`
- `/blog/ai-tools/ai-business-cases.html` → `/blog/ai/basics/ai-introduction.html`
- ChatGPT 余剰 → `chatgpt-basics`
- Claude 余剰 → `claude-basics`
- Cursor 余剰 → `cursor-for-non-engineers`
- Gemini 余剰 → `gemini-workspace`
- Perplexity 余剰 → `perplexity-research`
- NotebookLM 余剰 → `notebooklm-workflows`
- n8n 全廃 → `/blog/ai/gemini/google-ai-automation.html`
- Manus / Obsidian / Grok / Canva / Aqua Voice / Superwhisper 全廃 → `/blog/ai/basics/ai-introduction.html`

---

# Wave 10（2026-08-20）: ブログ一旦廃止 — 調査・清掃/犬関連のみ存続

ユーザー指示により、ブログは **調査・清掃(9本)+犬関連(4本)=13本のみ公開** とし、他カテゴリ(AI学習22本・映像5本・Web4本=31本)は一旦廃止(非表示化)。

- HTML は削除、`.md` 原稿は温存(復活時は `python3 scripts/build_blog.py <md>` で単一再生成)
- `_redirects` はツリー単位の splat に集約: `/blog/ai/*`・`/blog/ai-tools/*` → `/services/ai-tools/`、`/blog/video/*` → `/services/video/`、`/blog/web/*` → `/services/web/`(condo の未リダイレクト404も `/blog/condo/*` splat で修復)
- sitemap から31 URL除去(残36 URL)。articles/index.html はカード13枚+フィルタ3種(すべて/調査・清掃/犬関連)
- リンク清掃: services/ai-tools(隠し学習タブ+シリーズJS撤去・文言刷新)/ services/video(関連記事節撤去)/ services/web(制作のノート節撤去+本文リンク2本)
