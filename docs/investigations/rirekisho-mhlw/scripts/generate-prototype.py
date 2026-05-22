#!/usr/bin/env python3
"""
mhlw-cells.json + mhlw-borders.json + extract-dims.py 由来の wb 情報を使い、
absolute positioning で 448 cell を配置した HTML prototype を生成する。

output: ../prototype-blank.html  (overlay viewer 付きで PDF と重ね比較できる)

prerequisites:
  - extract-dims.py / extract-cells.py / extract-borders.py を先に実行
"""
import xlrd, json, html as html_lib, os

HERE = os.path.dirname(os.path.abspath(__file__))
XLS = os.path.join(HERE, '..', 'assets', 'mhlw-rirekisho-official.xls')
DIMS = os.path.join(HERE, 'mhlw-rirekisho-dims.json')
CELLS = os.path.join(HERE, 'mhlw-cells.json')
BORDERS = os.path.join(HERE, 'mhlw-borders.json')
OUT = os.path.join(HERE, '..', 'prototype-blank.html')

with open(DIMS) as f:
    dims = json.load(f)
with open(CELLS) as f:
    cells = json.load(f)
with open(BORDERS) as f:
    borders = json.load(f)

wb = xlrd.open_workbook(XLS, formatting_info=True)
sh = wb.sheet_by_name('履歴書様式例〔厚労省作成）')
xfs = wb.xf_list
fonts = wb.font_list

OFFSET_X = 20.0
OFFSET_Y = 3.25

PAGE_W = dims['page']['width_mm']
PAGE_H = dims['page']['height_mm']

HALIGN = {0: 'left', 1: 'left', 2: 'center', 3: 'right', 4: 'left', 5: 'justify', 6: 'center', 7: 'left'}
VALIGN = {0: 'flex-start', 1: 'center', 2: 'flex-end'}

def cell_meta(r, c):
    try:
        xf_idx = sh.cell_xf_index(r, c)
    except Exception:
        return None
    xf = xfs[xf_idx]
    fnt = fonts[xf.font_index]
    return {
        'font_name': fnt.name,
        'font_size_pt': (fnt.height or 220) / 20,
        'bold': bool(fnt.bold),
        'align_h': xf.alignment.hor_align,
        'align_v': xf.alignment.vert_align,
        'wrap': bool(xf.alignment.text_wrapped),
    }

parts = []
parts.append('<!DOCTYPE html>')
parts.append('<html lang="ja"><head><meta charset="UTF-8">')
parts.append('<title>厚労省 履歴書様式例 prototype</title>')
parts.append('''
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&family=Noto+Serif+JP:wght@400;500;700&family=Klee+One:wght@400;600&display=swap" rel="stylesheet">
<style>
@page { size: A3 landscape; margin: 0; }
html, body { margin: 0; padding: 0; }
body { background: #ddd; font-family: "Noto Serif JP", "Yu Mincho", "MS Mincho", "Hiragino Mincho ProN", serif; }
.page {
  position: relative;
  width: 420.04mm;
  height: 297.04mm;
  margin: 10mm auto;
  background: #fff;
  color: #000;
  page-break-after: always;
  box-shadow: 0 2px 12px rgba(0,0,0,0.2);
}
.page .overlay {
  position: absolute; inset: 0;
  background-image: url("./assets/mhlw-rirekisho-official-150dpi.png");
  background-size: 100% 100%;
  background-repeat: no-repeat;
  opacity: 0; pointer-events: none; z-index: 1000;
}
body.overlay-on .page .overlay { opacity: 0.4; }
body.lines-only .page .overlay { opacity: 1; mix-blend-mode: multiply; }
.cell {
  position: absolute;
  box-sizing: border-box;
  padding: 1px 2px;
  font-size: 8pt;
  line-height: 1.1;
  overflow: hidden;
}
.cell.t { border-top: 0.5pt solid #000; }
.cell.b { border-bottom: 0.5pt solid #000; }
.cell.l { border-left: 0.5pt solid #000; }
.cell.r { border-right: 0.5pt solid #000; }
.cell.hair-t { border-top: 0.25pt solid #000; }
.cell.hair-b { border-bottom: 0.25pt solid #000; }
.cell.hair-l { border-left: 0.25pt solid #000; }
.cell.hair-r { border-right: 0.25pt solid #000; }
/* 写真をはる位置 (Excel では shape として描画されている dashed box) */
.photo-box {
  position: absolute;
  box-sizing: border-box;
  border: 0.75pt dashed #000;
  padding: 2mm 1.5mm;
  font-family: "Noto Sans JP", "Yu Gothic", sans-serif;
  font-size: 6.5pt;
  line-height: 1.4;
  z-index: 2;
  pointer-events: none;
  color: #000;
}
.photo-box .heading {
  text-align: center;
  font-size: 7pt;
  margin-bottom: 1mm;
  letter-spacing: 0.1em;
}
.photo-box .body { font-size: 6pt; }
.controls {
  position: fixed; top: 10px; left: 10px; z-index: 10000;
  background: #fff; padding: 10px 14px; border: 1px solid #888;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; font-size: 13px;
  border-radius: 6px; box-shadow: 0 2px 8px rgba(0,0,0,0.2);
}
.controls h3 { margin: 0 0 8px; font-size: 13px; }
.controls label { display: block; margin: 4px 0; cursor: pointer; }
.controls input { margin-right: 6px; }
</style>
<script>
window.addEventListener('DOMContentLoaded', () => {
  const overlay = document.getElementById('overlay-toggle');
  const linesOnly = document.getElementById('lines-only-toggle');
  overlay?.addEventListener('change', () => {
    document.body.classList.toggle('overlay-on', overlay.checked);
    if (overlay.checked) { linesOnly.checked = false; document.body.classList.remove('lines-only'); }
  });
  linesOnly?.addEventListener('change', () => {
    document.body.classList.toggle('lines-only', linesOnly.checked);
    if (linesOnly.checked) { overlay.checked = false; document.body.classList.remove('overlay-on'); }
  });
});
</script>
''')
parts.append('</head><body>')
parts.append('''<div class="controls">
<h3>公式 PDF との比較</h3>
<label><input type="checkbox" id="overlay-toggle"> 公式を半透明 (40%) で重ねる</label>
<label><input type="checkbox" id="lines-only-toggle"> 公式を multiply で重ねる (罫線ずれ検出用)</label>
</div>''')
parts.append('<div class="page">')
parts.append('<div class="overlay"></div>')

# 写真をはる位置 (shape として手動配置)
# PDF text bbox から推定: heading "写真をはる位置" → x≈156.79mm y≈40.40mm
# body block → x≈156-181.5mm y≈49.32-75.32mm
# 写真欄全体は heading + dashed box で構成。dashed box は heading の下にだけ存在。
# 公式 PDF 観察: 写真欄全体の box は約 x=157mm y=39mm width=25mm height=37mm
parts.append('''<div class="photo-box" style="left:176.5mm;top:38.5mm;width:28mm;height:38mm;">
<div class="heading">写真をはる位置</div>
<div class="body">写真をはる必要が<br>ある場合<br>1.&nbsp;縦<br>&nbsp;&nbsp;&nbsp;横<br>2.本人単身胸から上<br>3.裏面のりづけ</div>
</div>''')

for cell in cells:
    r, c = cell['row'], cell['col']
    x = cell['x_mm'] + OFFSET_X
    y = cell['y_mm'] + OFFSET_Y
    w = cell['w_mm']
    h = cell['h_mm']
    bd = borders.get(f"{r},{c}", {})

    classes = ['cell']
    if bd.get('top') == 1: classes.append('t')
    elif bd.get('top') == 7: classes.append('hair-t')
    if bd.get('bottom') == 1: classes.append('b')
    elif bd.get('bottom') == 7: classes.append('hair-b')
    if bd.get('left') == 1: classes.append('l')
    elif bd.get('left') == 7: classes.append('hair-l')
    if bd.get('right') == 1: classes.append('r')
    elif bd.get('right') == 7: classes.append('hair-r')

    meta = cell_meta(r, c)
    text = cell['text'] or ''
    style = f"left:{x:.3f}mm;top:{y:.3f}mm;width:{w:.3f}mm;height:{h:.3f}mm;"
    if meta:
        fs = meta['font_size_pt']
        # Excel の フォントサイズはそのまま使う。Web font の幅差ははみ出すので
        # 一律に scale はしない (Phase 1 で字体ごとに調整する)。
        # ただし shrink-to-fit を有効化したい長文セルは wrap=true を見て分岐
        style += f"font-size:{fs}pt;"
        if meta['bold']: style += "font-weight:bold;"
        if 'ゴシック' in meta['font_name']:
            style += 'font-family:"Noto Sans JP","Yu Gothic","Hiragino Sans",sans-serif;'
        elif 'HG正楷書体' in meta['font_name']:
            style += 'font-family:"Klee One","Hiragino Mincho ProN",serif;font-weight:500;letter-spacing:0.15em;'
        halign = HALIGN.get(meta['align_h'], 'left')
        valign = VALIGN.get(meta['align_v'], 'flex-start')
        style += f"display:flex;align-items:{valign};justify-content:{halign};"
        if meta['wrap']:
            style += "white-space:normal;word-break:break-all;"
        else:
            style += "white-space:pre;"
    parts.append(f'<div class="{" ".join(classes)}" style="{style}">{html_lib.escape(text)}</div>')

parts.append('</div>')
parts.append('</body></html>')

with open(OUT, 'w') as f:
    f.write('\n'.join(parts))
print(f"wrote {OUT}")
