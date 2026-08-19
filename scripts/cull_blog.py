#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Wave 1: cull surplus blog files, write _redirects, filter sitemap, noindex drafts.

ワンショット。再実行は既存の301を消すので、通常は走らせない（--force が必要）。
"""

from __future__ import annotations

import re
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BLOG = ROOT / "blog"
TODAY = date.today().isoformat()

PUBLIC_STEMS = {
    "blog/inspection/gutter-cleaning",
    "blog/inspection/solar-panel-cleaning",
    "blog/inspection/drone-wall-inspection",
    "blog/inspection/aircon-cleaning",
    "blog/inspection/sewer-camera-methods",
    "blog/inspection/sewer-damage-report",
    "blog/inspection/manhole-safety",
    "blog/inspection/sewer-qualifications",
    "blog/inspection/sewer-exam-study",
    "blog/dog/trust-relationship",
    "blog/dog/puppy-preparation",
    "blog/dog/home-grooming",
    "blog/dog/seasonal-health-care",
    "blog/video/drone-shooting",
    "blog/video/fx30-a6700",
    "blog/video/davinci-resolve-export",
    "blog/video/fpv-safety",
    "blog/video/infrared-reading",
    "blog/web/corporate-site-decisions",
    "blog/web/top-3d-intent",
    "blog/ai/basics/ai-introduction",
    "blog/ai/basics/ai-tools-comparison",
    "blog/ai/basics/prompt-engineering",
    "blog/ai-tools/ai-learning-roadmap",
    "blog/ai/chatgpt/chatgpt-basics",
    "blog/ai/chatgpt/chatgpt-prompts-practical",
    "blog/ai/chatgpt/chatgpt-workflows-business",
    "blog/ai/chatgpt/chatgpt-excel-gas",
    "blog/ai/claude/claude-basics",
    "blog/ai/claude/claude-longform-writing",
    "blog/ai/claude/claude-artifacts",
    "blog/ai/cursor/cursor-for-non-engineers",
    "blog/ai/cursor/cursor-setup",
    "blog/ai/cursor/cursor-productivity-tips",
    "blog/ai/gemini/gemini-workspace",
    "blog/ai/gemini/google-ai-automation",
    "blog/ai/perplexity/perplexity-research",
    "blog/ai/perplexity/perplexity-comparison",
    "blog/ai/notebooklm/notebook-lm",
    "blog/ai/notebooklm/notebooklm-workflows",
}

DRAFT_STEMS = {
    "blog/ai/basics/ai-local-business",
    "blog/ai/gemini/gemini-basics",
    "blog/condo/interior-design",
    "blog/condo/amusement-lifestyle",
    "blog/condo/second-house",
    "blog/condo/investment-condo",
}

KEEP_STEMS = PUBLIC_STEMS | DRAFT_STEMS


def stem_of(path: Path) -> str:
    return str(path.relative_to(ROOT).with_suffix("")).replace("\\", "/")


def redirect_target(stem: str) -> str:
    if stem.startswith("blog/construction/"):
        return "/services/construction/"
    if stem.startswith("blog/web/"):
        return "/services/web/"
    if stem.startswith("blog/video/"):
        return "/blog/video/drone-shooting.html"
    if stem.startswith("blog/document/") or stem.startswith("blog/media/"):
        return "/services/video/"
    if stem.startswith("blog/craft/") or stem.startswith("blog/tools/"):
        return "/services/tools/"
    if stem.startswith("blog/custom/"):
        return "/services/custom/"
    if stem == "blog/ai-tools/ai-tools-comparison":
        return "/blog/ai/basics/ai-tools-comparison.html"
    if stem == "blog/ai-tools/prompt-engineering":
        return "/blog/ai/basics/prompt-engineering.html"
    if stem.startswith("blog/ai-tools/"):
        return "/blog/ai/basics/ai-introduction.html"
    if stem.startswith("blog/ai/chatgpt/"):
        return "/blog/ai/chatgpt/chatgpt-basics.html"
    if stem.startswith("blog/ai/claude/"):
        return "/blog/ai/claude/claude-basics.html"
    if stem.startswith("blog/ai/cursor/"):
        return "/blog/ai/cursor/cursor-for-non-engineers.html"
    if stem.startswith("blog/ai/gemini/"):
        return "/blog/ai/gemini/gemini-workspace.html"
    if stem.startswith("blog/ai/perplexity/"):
        return "/blog/ai/perplexity/perplexity-research.html"
    if stem.startswith("blog/ai/notebooklm/"):
        return "/blog/ai/notebooklm/notebooklm-workflows.html"
    if stem.startswith("blog/ai/n8n/"):
        return "/blog/ai/gemini/google-ai-automation.html"
    if stem.startswith("blog/ai/"):
        return "/blog/ai/basics/ai-introduction.html"
    return "/articles/"


def ensure_noindex(html_path: Path) -> None:
    text = html_path.read_text(encoding="utf-8")
    if 'name="robots"' in text:
        return
    snippet = '  <meta name="robots" content="noindex,follow">\n'
    if "<head>" in text:
        text = text.replace("<head>", "<head>\n" + snippet, 1)
    else:
        text = snippet + text
    html_path.write_text(text, encoding="utf-8")


def main() -> None:
    redirects_path = ROOT / "_redirects"
    if "--force" not in sys.argv and redirects_path.exists():
        existing = redirects_path.read_text(encoding="utf-8")
        if "# ブログ統廃合" in existing:
            raise SystemExit(
                "cull_blog.py はワンショットです。再実行すると既存の301が消えます。"
                "意図があるときだけ --force を付けてください。"
            )

    html_files = sorted(BLOG.rglob("*.html"))
    md_files = sorted(BLOG.rglob("*.md"))
    deleted_stems: list[str] = []

    for path in html_files + md_files:
        if path.name == "style.css" or path.suffix == ".css":
            continue
        stem = stem_of(path)
        if stem in KEEP_STEMS:
            continue
        path.unlink()
        if path.suffix == ".html":
            deleted_stems.append(stem)

    for d in sorted(BLOG.rglob("*"), reverse=True):
        if d.is_dir() and not any(d.iterdir()):
            d.rmdir()

    redirects = ["# 旧プレビューURL(トップ昇格に伴い本体へ)", "/top-v2/* / 301", "", "# ブログ統廃合 (2026-08-18)"]
    seen: set[str] = set()
    for stem in sorted(set(deleted_stems)):
        src = f"/{stem}.html"
        dest = redirect_target(stem)
        if src in seen:
            continue
        seen.add(src)
        redirects.append(f"{src} {dest} 301")
    (ROOT / "_redirects").write_text("\n".join(redirects) + "\n", encoding="utf-8")

    for stem in sorted(DRAFT_STEMS):
        html = ROOT / f"{stem}.html"
        if html.exists():
            ensure_noindex(html)

    sm_path = ROOT / "sitemap.xml"
    raw = sm_path.read_text(encoding="utf-8")
    public_locs = {f"https://cucul-fm.com/{stem}.html" for stem in PUBLIC_STEMS}
    blocks = re.findall(r"  <url>\n.*?</url>\n", raw, flags=re.S)
    kept: list[str] = []
    for block in blocks:
        m = re.search(r"<loc>(.*?)</loc>", block)
        if not m:
            continue
        loc = m.group(1)
        if "/blog/" in loc:
            if loc in public_locs:
                kept.append(block)
            continue
        kept.append(block)

    header = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    body = "".join(kept)
    body = body.replace(
        "<loc>https://cucul-fm.com/articles/</loc>\n    <lastmod>2025-03-12</lastmod>",
        f"<loc>https://cucul-fm.com/articles/</loc>\n    <lastmod>{TODAY}</lastmod>",
    )
    sm_path.write_text(header + body + "</urlset>\n", encoding="utf-8")

    print(f"deleted html stems: {len(set(deleted_stems))}")
    print(f"redirects: {len(seen)}")
    print(f"sitemap url blocks: {len(kept)}")


if __name__ == "__main__":
    main()
