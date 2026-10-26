#!/usr/bin/env python3
"""Generate single-file photolab HTML with inlined JS/CSS (no external packages)."""
from pathlib import Path
import re
ROOT=Path(__file__).resolve().parents[1]
SRC=ROOT if (ROOT/'index.html').exists() else ROOT/'photolab'
html=(SRC/'index.html').read_text()
css=(SRC/'style.css').read_text()
html=html.replace('<link rel="stylesheet" href="style.css?v=0.3.0">',f'<style>\n{css}\n</style>')
for f in ['geometry.js','vision.js','bundle.js','store.js','app.js']:
    tag=f'<script defer src="js/{f}?v=0.3.0"></script>'
    html=html.replace(tag, f'<script>\n{(SRC/"js"/f).read_text()}\n</script>')
assert '<script defer' not in html
out=SRC/'fieldwork-standalone.html'
out.write_text(html)
print(f'{out} {out.stat().st_size:,} bytes')