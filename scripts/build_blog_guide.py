#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
CUCUL FM Blog Builder — 解説記事テンプレート（blog/ai-guide/）

Source of truth: blog/ai-guide/*.md（build_blog.py と同じ見出しブロック形式）
Output (public):  同じ場所の .html

既存記事（blog/inspection・blog/dog）は build_blog.py のまま変えない。
このスクリプトは、長い解説記事向けに以下を足した別テンプレートを出力する。
  - 目次（デスクトップは右の追従サイドバー、900px以下は本文前の折りたたみ）
  - 見出し番号、図とキャプション（figure / figcaption）、横スクロールできる表
  - 記事末の相談導線、関連記事カード、パンくず（表示 + BreadcrumbList）
デザインの根拠は docs/redesign/10-blog-guide-ui.md。

外部依存なし。実行: python3 scripts/build_blog_guide.py blog/ai-guide/<slug>.md ...
"""

from __future__ import annotations

import html as _html
import json
import re
import struct
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import build_blog as bb  # noqa: E402

ROOT = bb.ROOT
SITE = "https://cucul-fm.com"
CATEGORY_LABELS = {"ai-guide": "AIツール"}
CONTACT_HREF = "../../index.html#contact"
REFERENCE_HTML = ROOT / "blog" / "inspection" / "sewer-camera-methods.html"


def esc(s: str) -> str:
    return _html.escape(s, quote=True)


def png_size(path: Path):
    """PNG/JPEG の幅・高さ（標準ライブラリのみ）。読めなければ None。"""
    try:
        data = path.read_bytes()
    except OSError:
        return None
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        w, h = struct.unpack(">II", data[16:24])
        return w, h
    if data[:2] == b"\xff\xd8":
        i = 2
        while i < len(data):
            if data[i] != 0xFF:
                i += 1
                continue
            marker = data[i + 1]
            if marker in (0xC0, 0xC1, 0xC2):
                h, w = struct.unpack(">HH", data[i + 5:i + 9])
                return w, h
            seg = struct.unpack(">H", data[i + 2:i + 4])[0]
            i += 2 + seg
    return None


def img_attrs(src: str, md_dir: Path) -> str:
    size = png_size((md_dir / src).resolve())
    return f' width="{size[0]}" height="{size[1]}"' if size else ""


def site_url(rel_path: Path) -> str:
    """ページの公開URL。本番（Netlify の Pretty URLs）に合わせて .html を外す。"""
    rel = rel_path.relative_to(ROOT).as_posix()
    if rel.endswith("/index.html"):
        rel = rel[: -len("index.html")]
    elif rel.endswith(".html"):
        rel = rel[: -len(".html")]
    return SITE + "/" + rel


def absolute_asset(src: str, md_dir: Path) -> str:
    return SITE + "/" + (md_dir / src).resolve().relative_to(ROOT).as_posix()


# ---------------------------------------------------------------- body transforms

def to_figures(body: str, md_dir: Path) -> str:
    """<p><img></p> と直後の <p><em>キャプション</em></p> を figure にまとめる。"""
    pat = re.compile(
        r'<p><img src="([^"]+)" alt="([^"]*)" loading="lazy"></p>'
        r'(?:\n<p><em>(.+?)</em></p>)?'
    )

    def repl(m):
        src, alt, cap = m.group(1), m.group(2), m.group(3)
        fig = (
            f'<figure class="g-figure">'
            f'<img src="{src}" alt="{alt}" loading="lazy" decoding="async"{img_attrs(_html.unescape(src), md_dir)}>'
        )
        if cap:
            fig += f"<figcaption>{cap}</figcaption>"
        return fig + "</figure>"

    return pat.sub(repl, body)


def wrap_tables(body: str) -> str:
    n = 0

    def repl(m):
        nonlocal n
        n += 1
        return (f'<div class="g-table" role="region" aria-label="表{n}" tabindex="0">'
                f'<table>{m.group(1)}</table></div>')

    return re.sub(r"<table>(.*?)</table>", repl, body, flags=re.S)


def split_related(body: str):
    """末尾の「## 関連記事」と箇条書きを本文から外し、リンク一覧を返す。"""
    m = re.search(r"<h2>関連記事</h2>\s*<ul>(.*?)</ul>", body, flags=re.S)
    if not m:
        return body, []
    links = re.findall(r'<li><a href="([^"]+)"(?:[^>]*)>(.+?)</a></li>', m.group(1))
    return body[: m.start()] + body[m.end():], links


def split_cta(body: str):
    """問い合わせリンクだけの段落と、その直前の段落を相談導線として取り出す。"""
    m = re.search(
        r'<p>([^<]*(?:<(?!/?p>)[^<]*)*)</p>\s*<p><a href="([^"]*#contact)"[^>]*>(.+?)</a></p>',
        body,
    )
    if not m:
        return body, None
    cta = {"text": m.group(1), "href": m.group(2), "label": m.group(3)}
    return body[: m.start()] + body[m.end():], cta


def number_headings(body: str):
    toc = []

    def repl(m):
        n = len(toc) + 1
        text = m.group(1)
        hid = f"sec-{n:02d}"
        toc.append((hid, n, re.sub(r"<[^>]+>", "", text)))
        return f'<h2 id="{hid}"><span class="g-num" aria-hidden="true">{n:02d}</span>{text}</h2>'

    return re.sub(r"<h2>(.+?)</h2>", repl, body), toc


def reading_minutes(body_md: str) -> int:
    text = bb._strip_markdown(re.sub(r"```.*?```", "", body_md, flags=re.S))
    text = re.sub(r"[|\-#>\s]", "", text)
    return max(1, round(len(text) / 500))


def related_label(href: str) -> str:
    if "/insights/" in href:
        return "Insights"
    for key, label in CATEGORY_LABELS.items():
        if href.startswith("./") or f"/{key}/" in href:
            return label
    return "記事"


# ---------------------------------------------------------------- page

def head_shared_blocks():
    ref = REFERENCE_HTML.read_text(encoding="utf-8")
    icons = re.search(r'(  <link rel="icon" href="/favicon\.ico".*?<meta name="theme-color"[^>]*>\n)', ref, re.S).group(1)
    analytics = re.search(r"(<!-- 計測。.*?<!-- END:analytics -->\n)", ref, re.S).group(1)
    return icons, analytics


def read_updated(md_path: Path):
    """見出しブロック（最初の --- まで）の **更新日** を読む。なければ ("", None)。"""
    for ln in md_path.read_text(encoding="utf-8").splitlines():
        if ln.strip() == "---":
            break
        m = re.match(r"\*\*更新日\*\*:\s*(.+?)\s*$", ln.strip())
        if m:
            disp = m.group(1).strip()
            return disp, bb._normalize_date_iso(disp)
    return "", None


def render(md_path: Path) -> str:
    a = bb.parse_md(md_path)
    updated_display, updated_iso = read_updated(md_path)
    md_dir = md_path.parent
    out_path = md_path.with_suffix(".html")
    url = site_url(out_path)
    cat_key = md_dir.name
    cat_label = CATEGORY_LABELS.get(cat_key, a.category)

    body = bb.md_to_html(a.body_md)
    body = to_figures(body, md_dir)
    body = wrap_tables(body)
    body, related = split_related(body)
    body, cta = split_cta(body)
    body, toc = number_headings(body)
    minutes = reading_minutes(a.body_md)

    hero_html, og_img, og_size = "", "", None
    if a.hero_image:
        src, alt = a.hero_image
        og_img = absolute_asset(src, md_dir)
        og_size = png_size((md_dir / src).resolve())
        hero_html = (
            f'<figure class="g-hero"><img src="{esc(src)}" alt="{esc(alt)}" '
            f'fetchpriority="high" decoding="async"{img_attrs(src, md_dir)}></figure>'
        )

    updated_html = (
        f'        <div><dt>更新日</dt><dd><time datetime="{updated_iso or ""}">{esc(updated_display)}</time></dd></div>\n'
        if updated_display else ""
    )

    json_ld = [
        {
            "@context": "https://schema.org",
            "@type": "Article",
            "headline": a.title,
            "description": a.description,
            "datePublished": a.date_iso or "",
            "dateModified": updated_iso or a.date_iso or "",
            "author": {"@type": "Organization", "name": a.author},
            "publisher": {"@type": "Organization", "name": "CUCUL FM LLC",
                          "logo": {"@type": "ImageObject", "url": SITE + "/images/icons/favicon-512.png"}},
            "mainEntityOfPage": url,
            **({"image": [og_img]} if og_img else {}),
        },
        {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            "itemListElement": [
                {"@type": "ListItem", "position": 1, "name": "ホーム", "item": SITE + "/"},
                {"@type": "ListItem", "position": 2, "name": "記事一覧", "item": SITE + "/articles/"},
                {"@type": "ListItem", "position": 3, "name": a.title, "item": url},
            ],
        },
    ]
    ld = "\n".join(
        '  <script type="application/ld+json">' + json.dumps(d, ensure_ascii=False).replace("</", "<\\/") + "</script>"
        for d in json_ld
    )

    icons, analytics = head_shared_blocks()

    toc_items = "\n".join(
        f'          <li><a href="#{hid}"><span class="g-toc__num" aria-hidden="true">{n:02d}</span>{esc(text)}</a></li>'
        for hid, n, text in toc
    )
    cta_side = (
        '        <div class="g-side-cta">\n'
        '          <p class="g-side-cta__title">AI活用の相談</p>\n'
        '          <p class="g-side-cta__text">どの業務に、どのAIを使うか。現場の段階から一緒に考えます。</p>\n'
        f'          <a class="g-btn g-btn--sm" href="{CONTACT_HREF}" data-ga-event="click_consultation_cta">相談する</a>\n'
        "        </div>\n"
    )
    cta_html = ""
    if cta:
        cta_html = (
            '      <aside class="g-cta" aria-labelledby="g-cta-title">\n'
            '        <p class="g-eyebrow">CONSULTATION</p>\n'
            '        <h2 id="g-cta-title" class="g-cta__title">AIの業務活用を、現場から相談する</h2>\n'
            f"        <p>{cta['text']}</p>\n"
            f'        <a class="g-btn" href="{cta["href"]}" data-ga-event="click_consultation_cta">{cta["label"]}</a>\n'
            "      </aside>\n"
        )
    related_html = ""
    if related:
        cards = "\n".join(
            f'        <li><a class="g-related__item" href="{href}">'
            f'<span class="g-related__cat">{related_label(_html.unescape(href))}</span>'
            f'<span class="g-related__title">{title}</span>'
            f'<span class="g-related__arrow" aria-hidden="true">→</span></a></li>'
            for href, title in related
        )
        related_html = (
            '    <section class="g-related" aria-labelledby="g-related-title">\n'
            '      <h2 id="g-related-title" class="g-related__heading">関連記事</h2>\n'
            f'      <ul class="g-related__list">\n{cards}\n      </ul>\n'
            "    </section>\n"
        )

    og_size_html = ""
    if og_size:
        og_size_html = (f'  <meta property="og:image:width" content="{og_size[0]}">\n'
                        f'  <meta property="og:image:height" content="{og_size[1]}">\n')

    return f"""<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{esc(a.title)} | CUCUL FM</title>
  <meta name="description" content="{esc(a.description)}">
  <link rel="canonical" href="{url}">
  <meta property="og:type" content="article">
  <meta property="og:url" content="{url}">
  <meta property="og:locale" content="ja_JP">
  <meta property="og:title" content="{esc(a.title)} | CUCUL FM">
  <meta property="og:description" content="{esc(a.description)}">
  <meta property="og:image" content="{og_img}">
{og_size_html}  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="{esc(a.title)} | CUCUL FM">
  <meta name="twitter:description" content="{esc(a.description)}">
  <meta name="twitter:image" content="{og_img}">
{ld}
{icons}  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&family=Orbitron:wght@500;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="{esc(a.rel_css)}">
  <link rel="stylesheet" href="../../css/brand.css">
  <link rel="stylesheet" href="guide.css">
  <script src="guide.js" defer></script>
{analytics}</head>
<body class="guide-page">
  <a class="g-skip" href="#article-body">本文へスキップ</a>
  <header class="blog-header">
    <div class="header-container">
      <a href="{esc(a.rel_back)}" class="back-link" aria-label="記事一覧へ戻る">
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M19 12H5M5 12L12 19M5 12L12 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <span>記事一覧へ戻る</span>
      </a>
      <a href="{esc(a.rel_home)}" class="header-logo">CUCUL FM</a>
    </div>
  </header>

  <main class="g-page" id="main">
    <nav class="g-breadcrumb" aria-label="パンくずリスト">
      <ol>
        <li><a href="{esc(a.rel_home)}">ホーム</a></li>
        <li><a href="{esc(a.rel_back)}">記事一覧</a></li>
        <li><span>{esc(cat_label)}</span></li>
      </ol>
    </nav>

    <header class="g-header">
      <p class="g-tag"><span class="g-tag__en">AI GUIDE</span>{esc(cat_label)}</p>
      <h1 class="g-title">{esc(a.title)}</h1>
      <p class="g-lead">{esc(a.description)}</p>
      <dl class="g-meta">
        <div><dt>公開日</dt><dd><time datetime="{a.date_iso or ''}">{esc(a.date_display)}</time></dd></div>
{updated_html}        <div><dt>著者</dt><dd>{esc(a.author)}</dd></div>
        <div><dt>読む時間</dt><dd>約{minutes}分</dd></div>
      </dl>
      {hero_html}
    </header>

    <div class="g-layout">
      <aside class="g-side" aria-label="目次と相談">
        <details class="g-toc" open>
          <summary class="g-toc__summary"><span class="g-eyebrow">CONTENTS</span>目次</summary>
          <nav aria-label="目次">
            <ol class="g-toc__list">
{toc_items}
            </ol>
          </nav>
        </details>
{cta_side}      </aside>

      <article class="g-article" id="article-body">
        <div class="g-body">
{body}
        </div>
{cta_html}      </article>
    </div>

{related_html}  </main>

  <footer class="blog-footer">
    <p class="footer-text">© 2026 CUCUL FM LLC. All rights reserved.</p>
  </footer>
</body>
</html>
"""


def build(paths):
    for p in paths:
        md_path = Path(p)
        if not md_path.is_absolute():
            md_path = ROOT / md_path
        html_txt = render(md_path)
        md_path.with_suffix(".html").write_text(html_txt, encoding="utf-8")
        print("built", md_path.with_suffix(".html").relative_to(ROOT))


if __name__ == "__main__":
    args = sys.argv[1:]
    if not args:
        args = [str(p) for p in sorted((ROOT / "blog" / "ai-guide").glob("*.md"))]
    build(args)
