#!/usr/bin/env python3
"""Turn dist-single/index.html into an Artifact page body (+ a CSP-wrapped local preview).

usage: python3 scripts/artifact-page.py OUT_DIR
  OUT_DIR/kira-kira-overdrive.html  - page content (the Artifact host adds the document skeleton)
  OUT_DIR/preview-csp.html          - local preview wrapped in a skeleton WITH a Content-Security-Policy
                                      approximating the Artifact sandbox (no fetch/XHR, data:/blob: images
                                      and fonts only), so CSP-only failures reproduce locally.
"""
import re, sys
out = sys.argv[1]
s = open("dist-single/index.html").read()
head = s[s.index("<head>") + 6 : s.index("</head>")]
body = s[s.index("<body>") + 6 : s.index("</body>")]
styles = [re.sub(r"<style[^>]*>", "<style>", st, count=1) for st in re.findall(r"<style[^>]*>.*?</style>", head, flags=re.S)]
scripts = [sc.replace(" crossorigin", "", 1) for sc in re.findall(r"<script[^>]*>.*?</script>", head, flags=re.S)]
page = (
    '<title>Kira Kira Overdrive</title>\n'
    '<meta name="description" content="A cute, chaotic anime pixel-art survivors-like. Survive the nightmare plushie stampede until dawn." />\n'
    '<style>:root{color-scheme:dark;background:#140c22}</style>\n'
    + "\n".join(styles) + "\n" + body.strip() + "\n" + "\n".join(scripts) + "\n"
)
ext = re.findall(r"https?://[A-Za-z0-9.-]+", page)
if ext:
    sys.exit(f"external URLs found: {ext[:5]}")
open(f"{out}/kira-kira-overdrive.html", "w").write(page)
csp = ("default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval' blob:; style-src 'unsafe-inline'; "
       "img-src data: blob:; font-src data:; media-src data: blob:; worker-src blob:; connect-src 'none'")
wrap = ('<!doctype html><html><head><meta charset="utf-8">'
        f'<meta http-equiv="Content-Security-Policy" content="{csp}">'
        '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">'
        '<style>body{margin:0}</style></head><body>' + page + "</body></html>")
open(f"{out}/preview-csp.html", "w").write(wrap)
print(f"page {len(page)} bytes -> {out}")
