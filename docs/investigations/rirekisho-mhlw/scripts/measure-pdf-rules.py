#!/usr/bin/env python3
"""
公式 PDF を 300dpi PNG にレンダリングし、画像から「実物の罫線座標」を実測する。
これが ground truth (Excel から計算した近似値より信頼できる)。

入力: ../assets/mhlw-rirekisho-official.pdf
中間: /tmp/full_300-1.png (pdftoppm で生成)
出力: ./mhlw-pdf-rules.json (clustered h_lines / v_lines、px と mm 両方)

依存:
  - pdftoppm (poppler 由来) — `brew install poppler`
  - pip install Pillow numpy
"""
from PIL import Image
import numpy as np, json, os, subprocess, tempfile, sys

HERE = os.path.dirname(os.path.abspath(__file__))
PDF = os.path.join(HERE, '..', 'assets', 'mhlw-rirekisho-official.pdf')
OUT = os.path.join(HERE, 'mhlw-pdf-rules.json')
DPI = 300

with tempfile.TemporaryDirectory() as tmp:
    prefix = os.path.join(tmp, 'page')
    subprocess.run(['pdftoppm', '-r', str(DPI), PDF, prefix, '-png'], check=True)
    pngs = sorted(p for p in os.listdir(tmp) if p.endswith('.png'))
    if not pngs:
        print("pdftoppm produced no PNG", file=sys.stderr); sys.exit(1)
    img = Image.open(os.path.join(tmp, pngs[0])).convert('L')

arr = np.array(img)
H, W = arr.shape
def to_mm(px): return px / DPI * 25.4
mask = arr < 100

def detect_rules(orientation):
    """orientation: 'h' or 'v'"""
    raw = []
    if orientation == 'h':
        loop = range(H); line = lambda i: mask[i]
    else:
        loop = range(W); line = lambda i: mask[:, i]
    for i in loop:
        ln = line(i)
        if not ln.any(): continue
        diff = np.diff(np.concatenate([[0], ln.astype(int), [0]]))
        starts = np.where(diff == 1)[0]
        ends = np.where(diff == -1)[0]
        for s, e in zip(starts, ends):
            if e - s >= 200:
                raw.append((i, int(s), int(e)))
    return raw

def cluster(raw, tol=4):
    raw_sorted = sorted(raw)
    clusters = []
    cur = []
    last_pos = None
    for pos, s, e in raw_sorted:
        if last_pos is not None and pos - last_pos > tol:
            clusters.append(cur); cur = []
        cur.append((pos, s, e)); last_pos = pos
    if cur: clusters.append(cur)
    return clusters

def reduce_cluster(clusters, axis_key):
    lines = []
    for c in clusters:
        pos = min(x[0] for x in c)
        spans = sorted([(x[1], x[2]) for x in c])
        merged = [list(spans[0])]
        for s, e in spans[1:]:
            if s <= merged[-1][1] + 10:
                merged[-1][1] = max(merged[-1][1], e)
            else:
                merged.append([s, e])
        lines.append({f'{axis_key}_px': pos, f'{axis_key}_mm': round(to_mm(pos), 2),
                       'spans_px': [tuple(m) for m in merged]})
    return lines

h_lines = reduce_cluster(cluster(detect_rules('h')), 'y')
v_lines = reduce_cluster(cluster(detect_rules('v')), 'x')

with open(OUT, 'w') as f:
    json.dump({'h_lines': h_lines, 'v_lines': v_lines,
               'dpi': DPI, 'page_w_px': W, 'page_h_px': H,
               'page_w_mm': round(to_mm(W), 2), 'page_h_mm': round(to_mm(H), 2)}, f, indent=2)
print(f"saved {OUT}  ({len(h_lines)} horizontal, {len(v_lines)} vertical rules)")
