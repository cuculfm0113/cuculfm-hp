#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
CUCUL FM Blog Builder

Source of truth: blog/**.md
Output (public): blog/**.html  (same basename; Plan A)

No external dependencies.
"""

from __future__ import annotations

import html as _html
import os
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Optional, Tuple, List


ROOT = Path(__file__).resolve().parents[1]
BLOG_DIR = ROOT / "blog"


@dataclass
class Article:
    title: str
    date_display: str
    date_iso: Optional[str]
    category: str
    author: str
    hero_image: Optional[Tuple[str, str]]  # (src, alt)
    description: str
    body_md: str
    rel_css: str
    rel_back: str
    rel_home: str


def _strip_markdown(text: str) -> str:
    s = text
    s = re.sub(r"!\[[^\]]*\]\([^)]+\)", "", s)
    s = re.sub(r"\[[^\]]+\]\([^)]+\)", lambda m: re.sub(r"\[[^\]]+\]\(([^)]+)\)", "", m.group(0)), s)
    s = re.sub(r"`([^`]+)`", r"\1", s)
    s = s.replace("**", "").replace("*", "")
    s = re.sub(r"\s+", " ", s).strip()
    return s


def _normalize_date_iso(date_display: str) -> Optional[str]:
    s = date_display.strip()
    # 2026.01.01
    m = re.search(r"(\d{4})\.(\d{2})\.(\d{2})", s)
    if m:
        return f"{m.group(1)}-{m.group(2)}-{m.group(3)}"
    # 2024年12月10日
    m = re.search(r"(\d{4})年\s*(\d{1,2})月\s*(\d{1,2})日", s)
    if m:
        y, mo, d = m.group(1), int(m.group(2)), int(m.group(3))
        return f"{y}-{mo:02d}-{d:02d}"
    # 2025-12-16
    m = re.search(r"(\d{4})-(\d{2})-(\d{2})", s)
    if m:
        return f"{m.group(1)}-{m.group(2)}-{m.group(3)}"
    return None


def _best_og_image(url: str) -> str:
    # If it's an Unsplash image, try to ensure it's share-friendly size.
    if "images.unsplash.com/" not in url:
        return url
    if "w=" in url or "h=" in url:
        return url
    joiner = "&" if "?" in url else "?"
    return f"{url}{joiner}w=1200&h=600&fit=crop"


def _first_paragraph(md: str) -> str:
    lines = md.splitlines()
    buf: List[str] = []
    in_code = False
    for ln in lines:
        if ln.strip().startswith("```"):
            in_code = not in_code
            continue
        if in_code:
            continue
        if not ln.strip():
            if buf:
                break
            continue
        if ln.lstrip().startswith(("#", "-", "*", ">", "|")):
            continue
        if re.match(r"^\d+\.\s+", ln.strip()):
            continue
        if ln.strip().startswith("![" ):
            continue
        buf.append(ln.strip())
        # stop paragraph on next blank in outer loop
    return _strip_markdown(" ".join(buf))


def parse_md(md_path: Path) -> Article:
    raw = md_path.read_text(encoding="utf-8")
    lines = raw.splitlines()

    title = ""
    hero: Optional[Tuple[str, str]] = None
    date_display = ""
    category = ""
    author = "ククルFM編集部"

    # Extract header block (until first ---)
    sep_idx = None
    for i, ln in enumerate(lines):
        if ln.strip() == "---":
            sep_idx = i
            break

    header_lines = lines[:sep_idx] if sep_idx is not None else lines[:20]
    body_lines = lines[sep_idx + 1 :] if sep_idx is not None else lines

    for ln in header_lines:
        if not title and ln.startswith("# "):
            title = ln[2:].strip()
            continue
        if hero is None:
            m = re.match(r"!\[(.*?)]\((.*?)\)", ln.strip())
            if m:
                hero = (m.group(2).strip(), m.group(1).strip() or title or "image")
                continue
        m = re.match(r"\*\*公開日\*\*:\s*(.+?)\s*$", ln.strip())
        if m and not date_display:
            date_display = m.group(1).strip()
            continue
        m = re.match(r"\*\*カテゴリ\*\*:\s*(.+?)\s*$", ln.strip())
        if m and not category:
            category = m.group(1).strip()
            continue
        m = re.match(r"\*\*著者\*\*:\s*(.+?)\s*$", ln.strip())
        if m:
            author = m.group(1).strip()
            continue

    if not title:
        title = md_path.stem
    if not category:
        # fallback from directory name
        category = md_path.parent.name
    if not date_display:
        date_display = ""

    body_md = "\n".join(body_lines).strip() + "\n"
    description = _first_paragraph(body_md) or title
    description = (description[:117] + "…") if len(description) > 120 else description

    date_iso = _normalize_date_iso(date_display) if date_display else None

    # Calculate relative path depth from blog directory
    # e.g., blog/ai/chatgpt/file.md -> depth 2 (ai/chatgpt/)
    try:
        rel_to_blog = md_path.relative_to(BLOG_DIR)
        depth = len(rel_to_blog.parts) - 1  # exclude filename
    except ValueError:
        depth = 1

    # Build relative paths based on depth
    up = "../" * depth
    rel_css = f"{up}style.css"
    rel_back = f"{up}../articles/index.html"
    rel_home = f"{up}../index.html"

    return Article(
        title=title,
        date_display=date_display,
        date_iso=date_iso,
        category=category,
        author=author,
        hero_image=hero,
        description=description,
        body_md=body_md,
        rel_css=rel_css,
        rel_back=rel_back,
        rel_home=rel_home,
    )


def _escape(s: str) -> str:
    return _html.escape(s, quote=True)


def _render_inlines(text: str) -> str:
    # Escape first
    s = _escape(text)

    # Inline code: `code`
    def repl_code(m):
        return f"<code>{m.group(1)}</code>"

    s = re.sub(r"`([^`]+)`", repl_code, s)

    # Links: [text](url)
    def repl_link(m):
        label = m.group(1)
        url = m.group(2)
        # already escaped
        attrs = ""
        if url.startswith("http"):
            attrs = ' target="_blank" rel="noopener"'
        return f'<a href="{url}"{attrs}>{label}</a>'

    s = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", repl_link, s)

    # Bold: **text**
    s = re.sub(r"\*\*([^*]+)\*\*", r"<strong>\1</strong>", s)
    # Italic: *text*
    s = re.sub(r"(?<!\*)\*([^*]+)\*(?!\*)", r"<em>\1</em>", s)

    return s


def md_to_html(md: str) -> str:
    lines = md.splitlines()
    out: List[str] = []

    in_code = False
    code_buf: List[str] = []

    in_ul = False
    in_ol = False

    in_blockquote = False

    table_header: Optional[List[str]] = None
    table_rows: List[List[str]] = []
    in_table = False

    def close_lists():
        nonlocal in_ul, in_ol
        if in_ul:
            out.append("</ul>")
            in_ul = False
        if in_ol:
            out.append("</ol>")
            in_ol = False

    def close_blockquote():
        nonlocal in_blockquote
        if in_blockquote:
            out.append("</blockquote>")
            in_blockquote = False

    def flush_table():
        nonlocal in_table, table_header, table_rows
        if not in_table:
            return
        out.append("<table>")
        if table_header:
            out.append("<thead><tr>" + "".join(f"<th>{_render_inlines(c.strip())}</th>" for c in table_header) + "</tr></thead>")
        if table_rows:
            out.append("<tbody>")
            for r in table_rows:
                out.append("<tr>" + "".join(f"<td>{_render_inlines(c.strip())}</td>" for c in r) + "</tr>")
            out.append("</tbody>")
        out.append("</table>")
        in_table = False
        table_header = None
        table_rows = []

    def flush_code():
        nonlocal in_code, code_buf
        if in_code:
            out.append("<pre><code>" + _escape("\n".join(code_buf)) + "</code></pre>")
            in_code = False
            code_buf = []

    paragraph_buf: List[str] = []

    def flush_paragraph():
        nonlocal paragraph_buf
        if paragraph_buf:
            txt = " ".join(paragraph_buf).strip()
            if txt:
                out.append(f"<p>{_render_inlines(txt)}</p>")
        paragraph_buf = []

    def is_table_divider(ln: str) -> bool:
        s = ln.strip()
        if "|" not in s:
            return False
        # looks like: | --- | --- |
        parts = [p.strip() for p in s.strip("|").split("|")]
        return all(re.match(r"^:?-{3,}:?$", p) for p in parts if p)

    for ln in lines:
        raw_ln = ln.rstrip("\n")
        s = raw_ln.strip()

        # fenced code
        if s.startswith("```"):
            flush_paragraph()
            close_lists()
            close_blockquote()
            flush_table()
            if in_code:
                flush_code()
            else:
                in_code = True
                code_buf = []
            continue

        if in_code:
            code_buf.append(raw_ln)
            continue

        # table detection
        if "|" in s and not s.startswith(">"):
            # candidate header row, if next line is divider we will handle when divider hits
            if in_table:
                # data row
                row = [c.strip() for c in s.strip("|").split("|")]
                table_rows.append(row)
                continue
            # start table when see header; don't emit yet until divider line comes
            if table_header is None and s.count("|") >= 2:
                # peek-ish: handle via divider recognition line; we'll buffer header and wait
                # If this line is divider (unlikely) skip
                if is_table_divider(s):
                    continue
                # store header temp and mark "pending table" using table_header but in_table False
                table_header = [c.strip() for c in s.strip("|").split("|")]
                continue

        if table_header is not None and is_table_divider(s):
            flush_paragraph()
            close_lists()
            close_blockquote()
            in_table = True
            table_rows = []
            continue

        # if we had a header buffered but table didn't start, flush it back as paragraph
        if table_header is not None and not in_table and s and not is_table_divider(s):
            # turn the buffered header into paragraph, then continue parsing current line normally
            paragraph_buf.append("| " + " | ".join(table_header) + " |")
            table_header = None

        # close table when blank line or non-table content
        if in_table and (not s or "|" not in s):
            flush_table()

        # HR
        if s == "---":
            flush_paragraph()
            close_lists()
            close_blockquote()
            flush_table()
            out.append("<hr>")
            continue

        # headings
        m = re.match(r"^(#{1,4})\s+(.*)$", s)
        if m:
            flush_paragraph()
            close_lists()
            close_blockquote()
            flush_table()
            level = len(m.group(1))
            if level == 1:
                # in-body H1 is demoted to H2 to keep template H1 unique
                level = 2
            out.append(f"<h{level}>{_render_inlines(m.group(2).strip())}</h{level}>")
            continue

        # blockquote
        if s.startswith(">"):
            flush_paragraph()
            close_lists()
            flush_table()
            if not in_blockquote:
                out.append("<blockquote>")
                in_blockquote = True
            out.append(f"<p>{_render_inlines(s.lstrip('>').strip())}</p>")
            continue
        else:
            close_blockquote()

        # images (standalone line)
        m = re.match(r"^!\[(.*?)]\((.*?)\)\s*$", s)
        if m:
            flush_paragraph()
            close_lists()
            flush_table()
            alt = _escape(m.group(1).strip() or "image")
            src = _escape(m.group(2).strip())
            out.append(f'<p><img src="{src}" alt="{alt}" loading="lazy"></p>')
            continue

        # lists
        m_ul = re.match(r"^[-*]\s+(.*)$", s)
        m_ol = re.match(r"^\d+\.\s+(.*)$", s)
        if m_ul:
            flush_paragraph()
            flush_table()
            close_blockquote()
            if in_ol:
                out.append("</ol>")
                in_ol = False
            if not in_ul:
                out.append("<ul>")
                in_ul = True
            out.append(f"<li>{_render_inlines(m_ul.group(1).strip())}</li>")
            continue
        if m_ol:
            flush_paragraph()
            flush_table()
            close_blockquote()
            if in_ul:
                out.append("</ul>")
                in_ul = False
            if not in_ol:
                out.append("<ol>")
                in_ol = True
            out.append(f"<li>{_render_inlines(m_ol.group(1).strip())}</li>")
            continue

        if not s:
            flush_paragraph()
            close_lists()
            flush_table()
            continue

        # normal paragraph
        paragraph_buf.append(s)

    flush_paragraph()
    close_lists()
    close_blockquote()
    flush_table()
    flush_code()

    return "\n".join(out).strip() + "\n"


def render_article(a: Article, out_path: Path) -> str:
    og_img = _best_og_image(a.hero_image[0]) if a.hero_image else ""
    hero_img_html = ""
    if a.hero_image:
        src, alt = a.hero_image
        hero_img_html = (
            f'<div class="article-featured-image">'
            f'<img src="{_escape(src)}" alt="{_escape(alt)}" loading="lazy">'
            f"</div>"
        )

    body_html = md_to_html(a.body_md)

    # minimal JSON-LD Article (domain omitted)
    date_published = a.date_iso or ""
    json_ld = {
        "@context": "https://schema.org",
        "@type": "Article",
        "headline": a.title,
        "datePublished": date_published,
        "dateModified": date_published,
        "author": {"@type": "Organization", "name": a.author},
        "publisher": {"@type": "Organization", "name": "CUCUL FM LLC"},
    }
    if a.hero_image:
        json_ld["image"] = [_best_og_image(a.hero_image[0])]

    import json
    json_ld_str = json.dumps(json_ld, ensure_ascii=False)
    # Avoid accidental </script> termination
    json_ld_str = json_ld_str.replace("</", "<\\/")

    # Consistent back link text
    back_text = "記事一覧へ戻る"

    time_html = f'<time class="article-date">{_escape(a.date_display)}</time>' if a.date_display else ""

    return f"""<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{_escape(a.title)} | CUCUL FM</title>
  <meta name="description" content="{_escape(a.description)}">
  <meta property="og:type" content="article">
  <meta property="og:locale" content="ja_JP">
  <meta property="og:title" content="{_escape(a.title)} | CUCUL FM">
  <meta property="og:description" content="{_escape(a.description)}">
  {('<meta property="og:image" content="' + _escape(og_img) + '">') if og_img else ""}
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="{_escape(a.title)} | CUCUL FM">
  <meta name="twitter:description" content="{_escape(a.description)}">
  {('<meta name="twitter:image" content="' + _escape(og_img) + '">') if og_img else ""}
  <script type="application/ld+json">{json_ld_str}</script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;700&family=Orbitron:wght@500;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="{_escape(a.rel_css)}">
</head>
<body>
  <header class="blog-header">
    <div class="header-container">
      <a href="{_escape(a.rel_back)}" class="back-link">
        <svg viewBox="0 0 24 24" fill="none"><path d="M19 12H5M5 12L12 19M5 12L12 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <span>{_escape(back_text)}</span>
      </a>
      <a href="{_escape(a.rel_home)}" class="header-logo">CUCUL FM</a>
    </div>
  </header>

  <article class="article-container">
    <header class="article-header">
      <span class="article-category">{_escape(a.category)}</span>
      <h1 class="article-title">{_escape(a.title)}</h1>
      <div class="article-meta">
        {time_html}
        <span class="article-author">{_escape(a.author)}</span>
      </div>
    </header>

    {hero_img_html}

    <div class="article-content">
{body_html}
    </div>
  </article>

  <footer class="blog-footer">
    <p class="footer-text">© 2026 CUCUL FM LLC. All rights reserved.</p>
  </footer>
</body>
</html>
"""


def build():
    if not BLOG_DIR.exists():
        raise SystemExit(f"blog dir not found: {BLOG_DIR}")

    md_files = sorted(BLOG_DIR.glob("**/*.md"))
    count = 0
    for md_path in md_files:
        # skip draft storage
        if "note" in md_path.parts:
            continue
        out_html = md_path.with_suffix(".html")
        a = parse_md(md_path)
        html_txt = render_article(a, out_html)
        out_html.write_text(html_txt, encoding="utf-8")
        count += 1

    print(f"Built {count} html files from md.")


if __name__ == "__main__":
    build()


