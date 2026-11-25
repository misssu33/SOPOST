#!/usr/bin/env python3
"""SOPOST — build/{body.html,style.css,js/*.js} → 단일 index.html

외부 CDN·폰트·이미지 요청이 0건이 되도록 CSS/JS/HTML을 전부 인라인한다.
빌드 후 외부 리소스 참조가 남아 있으면 실패로 처리한다.
"""
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
BUILD = ROOT / "build"

css = (BUILD / "style.css").read_text(encoding="utf-8")
body = (BUILD / "body.html").read_text(encoding="utf-8")
js_files = sorted((BUILD / "js").glob("*.js"))
if not js_files:
    raise SystemExit("build/js 에 파일이 없습니다")
js = "\n".join(f.read_text(encoding="utf-8") for f in js_files)

for name, text in (("style.css", css), ("body.html", body), ("app.js", js)):
    low = text.lower()
    if name == "app.js" and "</script" in low:
        raise SystemExit("js 안에 </script 문자열이 있어 인라인할 수 없습니다.")
    if name == "style.css" and "</style" in low:
        raise SystemExit("style.css 안에 </style 문자열이 있습니다.")
    if name == "body.html" and re.search(r"<script\b", low):
        raise SystemExit("body.html 안에 <script> 태그가 있습니다(js/로 옮기세요).")

if js.count("(function () {") < 1 or js.rstrip().count("})();") < 1:
    raise SystemExit("js 묶음이 IIFE로 열고 닫히지 않았습니다")

html = f"""<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#0a0b0e">
<meta name="description" content="SOPOST — 브랜드 보이스·카드뉴스·6채널 포스트·클립·캘린더·성과까지 한 파일에서. 설치 없이, 서버 없이, 키는 내 브라우저에만.">
<meta name="color-scheme" content="dark">
<title>SOPOST · Posteady 스타일 SNS 올인원 스튜디오</title>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' rx='24' fill='%230a0b0e'/%3E%3Cpath d='M28 72V28h22l10 18 10-18h2v44h-9V44l-9 16h-4l-9-16v28z' fill='%23c8f751'/%3E%3C/svg%3E">
<style>
{css}
</style>
</head>
<body>
{body}
<script>
{js}
</script>
</body>
</html>
"""

out = ROOT / "index.html"
out.write_text(html, encoding="utf-8")

# 외부 리소스(스크립트/스타일/폰트/이미지) 참조 검사 — <a href> 링크는 제외
ext = []
for m in re.finditer(r"<(?:script|link|img|iframe|source|video|audio)\b[^>]*?(?:src|href)\s*=\s*['\"]([^'\"]+)['\"]", html, re.I):
    url = m.group(1)
    if url.startswith("http") or url.startswith("//"):
        ext.append(url)
if ext:
    raise SystemExit(f"외부 리소스 참조가 남아 있습니다: {ext[:5]}")

# CSS 안 url(http...) 도 검사
for m in re.finditer(r"url\(\s*['\"]?(https?:)?//", css, re.I):
    raise SystemExit("CSS에 외부 url() 참조가 있습니다")

print("wrote", out, f"{len(html):,} chars (css {len(css):,} + body {len(body):,} + js {len(js):,}, js {len(js_files)} files)")
