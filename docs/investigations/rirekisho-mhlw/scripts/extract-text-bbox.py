#!/usr/bin/env python3
"""
公式 PDF から text + bounding box を抽出して mm 座標で JSON 出力する。
pdftotext -bbox-layout が吐く XHTML を parse する。

入力: ../assets/mhlw-rirekisho-official.pdf
中間: pdftotext で /tmp/mhlw_rirekisho_001.bbox.html を生成
出力: ./mhlw-text-bbox.json
"""
from xml.etree import ElementTree as ET
import json, re, os, subprocess, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
PDF = os.path.join(HERE, '..', 'assets', 'mhlw-rirekisho-official.pdf')
OUT = os.path.join(HERE, 'mhlw-text-bbox.json')

with tempfile.NamedTemporaryFile(suffix='.html', delete=False) as tmp:
    bbox_path = tmp.name
subprocess.run(['pdftotext', '-layout', '-bbox-layout', PDF, bbox_path], check=True)

with open(bbox_path) as f:
    raw = f.read()
os.unlink(bbox_path)

raw = re.sub(r'\sxmlns="[^"]+"', '', raw, count=1)
root = ET.fromstring(raw)

def pt_to_mm(pt): return pt / 72 * 25.4

texts = []
for block in root.iter('block'):
    xmin = float(block.attrib['xMin'])
    ymin = float(block.attrib['yMin'])
    xmax = float(block.attrib['xMax'])
    ymax = float(block.attrib['yMax'])
    lines = []
    for line in block.iter('line'):
        words = []
        for w in line.iter('word'):
            words.append((w.text or ''))
        lines.append(''.join(words))
    text = '\n'.join(lines)
    if not text.strip(): continue
    texts.append({
        'x_mm': round(pt_to_mm(xmin), 3),
        'y_mm': round(pt_to_mm(ymin), 3),
        'w_mm': round(pt_to_mm(xmax - xmin), 3),
        'h_mm': round(pt_to_mm(ymax - ymin), 3),
        'text': text,
    })

with open(OUT, 'w') as f:
    json.dump(texts, f, ensure_ascii=False, indent=2)
print(f"saved {OUT} ({len(texts)} text blocks)")
