#!/usr/bin/env python3
"""Local visual QA only: python3 scripts/verify/moonlight-preview.py

Serves the workspace on 127.0.0.1:8125. The QA panel and fetch override exist only
in responses from this explicit CLI server; production files are not modified.
No external services or cookies are used. Screenshot uploads require same-origin
POSTs and are saved only as new, validated images in docs/redesign/review-images.
"""

import base64
import binascii
import html
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import re
import struct
import time
from urllib.parse import parse_qs, quote, urlsplit
import zlib


ROOT = Path(__file__).resolve().parents[2]
CAPTURES = ROOT / "docs" / "redesign" / "review-images"
HOST = "127.0.0.1"
PORT = 8125
ORIGIN = f"http://{HOST}:{PORT}"
MAX_IMAGE = 8 * 1024 * 1024
MAX_POST = 3 * MAX_IMAGE + 1024  # URL-encoded base64 can expand percent escapes.
MODEL = ROOT / "character-design" / "phantom-dj" / "model.glb"
SAFE_NAME = re.compile(r"[A-Za-z0-9][A-Za-z0-9_-]{0,79}\.(?:png|jpg|jpeg)\Z")


def validate_png(data):
    """Validate PNG chunk structure/CRCs without decompressing untrusted pixels."""
    if len(data) > MAX_IMAGE:
        raise ValueError("PNG must be 8 MB or smaller.")
    if not data.startswith(b"\x89PNG\r\n\x1a\n"):
        raise ValueError("The screenshot is not a PNG.")
    offset, first, image_data = 8, True, False
    while offset + 12 <= len(data):
        length = struct.unpack_from(">I", data, offset)[0]
        end = offset + 12 + length
        if end > len(data):
            raise ValueError("Truncated PNG chunk.")
        kind = data[offset + 4:offset + 8]
        payload = data[offset + 8:offset + 8 + length]
        crc = struct.unpack_from(">I", data, offset + 8 + length)[0]
        if zlib.crc32(kind + payload) & 0xFFFFFFFF != crc:
            raise ValueError("Invalid PNG checksum.")
        if first:
            if kind != b"IHDR" or length != 13:
                raise ValueError("Missing PNG header.")
            width, height = struct.unpack_from(">II", payload)
            if not width or not height:
                raise ValueError("Invalid PNG dimensions.")
            first = False
        elif kind == b"IHDR":
            raise ValueError("Duplicate PNG header.")
        if kind == b"IDAT":
            image_data = True
        if kind == b"IEND":
            if length or end != len(data) or not image_data:
                raise ValueError("Invalid PNG ending.")
            return width, height
        offset = end
    raise ValueError("Missing PNG ending.")


def validate_jpeg(data):
    """Validate JPEG framing, header segments and dimensions without decoding."""
    if len(data) > MAX_IMAGE:
        raise ValueError("JPEG must be 8 MB or smaller.")
    if not data.startswith(b"\xff\xd8") or not data.endswith(b"\xff\xd9"):
        raise ValueError("Invalid JPEG start or ending.")
    offset, dimensions = 2, None
    frame_markers = {0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7,
                     0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF}
    while offset < len(data) - 2:
        if data[offset] != 0xFF:
            raise ValueError("Invalid JPEG header marker.")
        while offset < len(data) and data[offset] == 0xFF:
            offset += 1
        if offset >= len(data):
            raise ValueError("Truncated JPEG marker.")
        marker = data[offset]
        offset += 1
        if marker in {0x00, 0xD8, 0xD9}:
            raise ValueError("Unexpected JPEG header marker.")
        if marker == 0x01 or 0xD0 <= marker <= 0xD7:
            continue
        if offset + 2 > len(data) - 2:
            raise ValueError("Truncated JPEG segment.")
        length = struct.unpack_from(">H", data, offset)[0]
        if length < 2 or offset + length > len(data) - 2:
            raise ValueError("Invalid JPEG segment length.")
        payload = data[offset + 2:offset + length]
        if marker in frame_markers:
            if len(payload) < 6:
                raise ValueError("Truncated JPEG frame.")
            height, width = struct.unpack_from(">HH", payload, 1)
            components = payload[5]
            if not width or not height or not components or len(payload) != 6 + 3 * components:
                raise ValueError("Invalid JPEG frame dimensions or components.")
            dimensions = width, height
        if marker == 0xDA:
            if not dimensions or len(payload) < 4 or offset + length >= len(data) - 2:
                raise ValueError("Missing JPEG frame or image data.")
            return dimensions
        offset += length
    raise ValueError("Missing JPEG image scan.")


def qa_script(profile):
    # profile is allowlisted by the request handler before insertion.
    return """<script>
(function () {
  'use strict';
  var profile = PROFILE;
  if (profile === 'delay' || profile === 'fail') {
    var originalFetch = window.fetch.bind(window);
    window.fetch = function (input, init) {
      var url = new URL(input instanceof Request ? input.url : String(input), location.href);
      if (url.origin === location.origin && url.pathname === '/character-design/phantom-dj/model.glb') {
        var mapped = location.origin + '/__qa__/' + profile + '.glb';
        return originalFetch(input instanceof Request ? new Request(mapped, input) : mapped, init);
      }
      return originalFetch(input, init);
    };
  }
  function bootPanel() {
    var panel = document.createElement('aside');
    panel.id = 'qa-panel';
    panel.setAttribute('aria-label', 'Local QA controls');
    panel.style.cssText = 'position:fixed;right:12px;top:12px;z-index:2147483647;width:340px;max-width:calc(100vw - 24px);max-height:48vh;overflow:auto;padding:12px;background:#111827;color:#fff;border:1px solid #f5e100;border-radius:8px;font:12px/1.45 monospace;box-sizing:border-box';
    panel.innerHTML = '<strong>LOCAL QA — ' + profile + '</strong><div style="display:flex;gap:8px;margin:8px 0"><button type="button" id="qa-lose">Lose WebGL</button><button type="button" id="qa-restore">Restore WebGL</button></div><p id="qa-status" role="status" style="margin:4px 0"></p><pre id="qa-state" style="white-space:pre-wrap;overflow-wrap:anywhere;margin:0"></pre>';
    document.body.appendChild(panel);
    var toggle = document.createElement('button');
    toggle.id = 'qa-toggle';
    toggle.type = 'button';
    toggle.textContent = 'Hide diagnostics';
    toggle.setAttribute('aria-controls', 'qa-panel');
    toggle.setAttribute('aria-expanded', 'true');
    toggle.style.cssText = 'position:fixed;right:12px;bottom:12px;z-index:2147483647;padding:8px 12px;background:#111827;color:#fff;border:1px solid #f5e100;border-radius:6px;font:12px/1.4 monospace;cursor:pointer';
    toggle.onclick = function () {
      var show = panel.style.display === 'none';
      panel.style.display = show ? '' : 'none';
      toggle.textContent = show ? 'Hide diagnostics' : 'Show diagnostics';
      toggle.setAttribute('aria-expanded', show ? 'true' : 'false');
    };
    document.body.appendChild(toggle);
    function act(method) {
      var character = window.__char3d;
      var status = document.getElementById('qa-status');
      if (!character || !character.renderer) { status.textContent = '3D renderer not ready'; return; }
      character.renderer[method]();
      status.textContent = method === 'forceContextLoss' ? 'Context loss requested; restore within 4 s to recover.' : 'Context restore requested.';
    }
    document.getElementById('qa-lose').onclick = function () { act('forceContextLoss'); };
    document.getElementById('qa-restore').onclick = function () { act('forceContextRestore'); };
    function paint() {
      var character = window.__char3d;
      var canvas = document.querySelector('#char3d canvas');
      var container = document.getElementById('char3d');
      var trigger = window.ScrollTrigger && window.ScrollTrigger.getAll().find(function (item) {
        return item.pin && item.trigger && item.trigger.id === 'seq';
      });
      var rect = trigger && trigger.pin.getBoundingClientRect();
      var spacerRect = trigger && trigger.spacer && trigger.spacer.getBoundingClientRect();
      var section = document.getElementById('seq');
      var sectionRect = section && section.getBoundingClientRect();
      document.getElementById('qa-state').textContent = JSON.stringify({
        profile: profile,
        viewport: { width: innerWidth, height: innerHeight, scrollY: scrollY, isTouch: window.ScrollTrigger && window.ScrollTrigger.isTouch },
        state: character ? character.state : null,
        canvasParentId: canvas && canvas.parentElement.id,
        characterParentId: container && container.parentElement.id,
        characterParentClass: container && container.parentElement.className,
        pin: trigger ? { start: trigger.start, end: trigger.end, progress: trigger.progress,
          active: trigger.isActive, width: rect.width, height: rect.height,
          spacerHeight: trigger.spacer && trigger.spacer.offsetHeight,
          spacerDocumentTop: spacerRect && spacerRect.top + scrollY } : null,
        section: section ? { top: sectionRect.top, bottom: sectionRect.bottom, position: getComputedStyle(section).position } : null
      }, null, 2);
    }
    paint();
    setInterval(paint, 250);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootPanel);
  else bootPanel();
})();
</script>""".replace("PROFILE", json.dumps(profile), 1)


def capture_page(saved="", error=""):
    message = ""
    if saved and SAFE_NAME.fullmatch(saved):
        message = f'<p role="status">Saved: <a href="/docs/redesign/review-images/{quote(saved)}">{html.escape(saved)}</a></p>'
    if error:
        message = f'<p role="alert">{html.escape(error)}</p>'
    return f"""<!doctype html><html lang="en"><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Local QA screenshot capture</title>
<style>body{{font:16px/1.5 system-ui;max-width:760px;margin:40px auto;padding:0 20px;background:#f5f5f5;color:#111}}label{{display:block;font-weight:600;margin:20px 0 6px}}input,textarea{{box-sizing:border-box;width:100%;padding:10px;font:14px monospace}}button{{padding:12px 20px;margin-top:18px}}textarea{{min-height:240px}}code{{overflow-wrap:anywhere}}</style>
<h1>Local QA screenshot capture</h1>
<p>Only this local CLI server accepts captures. No external service or cookies. PNG or JPEG, at most 8 MB. Existing files are never overwritten.</p>
{message}
<form method="POST" action="/__qa__/capture">
<label for="screenshot-filename">Filename</label>
<input id="screenshot-filename" name="filename" placeholder="home-desktop-moon.jpg" required pattern="[A-Za-z0-9][A-Za-z0-9_-]{{0,79}}\\.(png|jpg|jpeg)" autocomplete="off">
<label for="screenshot-data">Image base64</label>
<textarea id="screenshot-data" name="image" required spellcheck="false" placeholder="Paste PNG/JPEG base64 or a data:image/png;base64 / data:image/jpeg;base64 URL"></textarea>
<button type="submit">Save screenshot</button>
</form><p>Destination: <code>docs/redesign/review-images/</code></p></html>"""


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def local_request(self):
        return self.headers.get("Host") == f"{HOST}:{PORT}"

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        super().end_headers()

    def respond(self, content, status=200, content_type="text/html; charset=utf-8"):
        data = content.encode("utf-8") if isinstance(content, str) else content
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        try:
            self.wfile.write(data)
        except (BrokenPipeError, ConnectionResetError):
            pass

    def do_GET(self):
        if not self.local_request():
            self.send_error(403, "Use the explicit 127.0.0.1 QA origin")
            return
        url = urlsplit(self.path)
        query = parse_qs(url.query)
        if url.path == "/__qa__/capture":
            self.respond(capture_page(query.get("saved", [""])[0]))
        elif url.path == "/__qa__/delay.glb":
            time.sleep(15)
            self.respond(MODEL.read_bytes(), content_type="model/gltf-binary")
        elif url.path == "/__qa__/fail.glb":
            self.respond("QA: deliberate model failure", 503, "text/plain; charset=utf-8")
        elif url.path.startswith("/__qa__/"):
            self.send_error(404)
        elif url.path in ("/", "/index.html"):
            profile = query.get("qa", ["normal"])[0]
            if profile not in ("normal", "delay", "fail"):
                self.send_error(400, "Unknown QA profile")
                return
            source = (ROOT / "index.html").read_text(encoding="utf-8")
            self.respond(source.replace("<head>", "<head>\n" + qa_script(profile), 1))
        else:
            super().do_GET()

    def do_POST(self):
        if not self.local_request() or self.headers.get("Origin") != ORIGIN:
            self.send_error(403, "Same-origin local POST required")
            return
        if urlsplit(self.path).path != "/__qa__/capture":
            self.send_error(404)
            return
        if self.headers.get_content_type() != "application/x-www-form-urlencoded":
            self.send_error(415, "Use the screenshot capture form")
            return
        try:
            size = int(self.headers.get("Content-Length", "0"))
            if not 0 < size <= MAX_POST:
                raise ValueError("Invalid or oversized screenshot upload.")
            fields = parse_qs(self.rfile.read(size).decode("utf-8"), max_num_fields=2)
            if set(fields) != {"filename", "image"} or any(len(v) != 1 for v in fields.values()):
                raise ValueError("One filename and one image are required.")
            name, encoded = fields["filename"][0], fields["image"][0]
            if not SAFE_NAME.fullmatch(name):
                raise ValueError("Use letters, digits, underscores or hyphens, ending in .png, .jpg or .jpeg.")
            if encoded.startswith(("data:image/png;base64,", "data:image/jpeg;base64,")):
                encoded = encoded.split(",", 1)[1]
            data = base64.b64decode(re.sub(r"\s+", "", encoded), validate=True)
            if name.endswith(".png"):
                validate_png(data)
            else:
                validate_jpeg(data)
            CAPTURES.mkdir(parents=True, exist_ok=True)
            destination = CAPTURES / name
            if CAPTURES.resolve() != ROOT / "docs" / "redesign" / "review-images":
                raise ValueError("Screenshot destination must not be a symlink.")
            with destination.open("xb") as target:
                target.write(data)
        except FileExistsError:
            self.respond(capture_page(error="That filename already exists. Choose a new filename."), 409)
            return
        except (ValueError, UnicodeError, binascii.Error) as error:
            self.respond(capture_page(error=str(error)), 400)
            return
        self.send_response(303)
        self.send_header("Location", "/__qa__/capture?saved=" + quote(name))
        self.send_header("Content-Length", "0")
        self.end_headers()


if __name__ == "__main__":
    print(f"Local QA: {ORIGIN}/ | ?qa=delay | ?qa=fail", flush=True)
    print(f"Screenshot capture: {ORIGIN}/__qa__/capture", flush=True)
    with ThreadingHTTPServer((HOST, PORT), Handler) as server:
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass
