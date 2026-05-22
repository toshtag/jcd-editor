#!/usr/bin/env python3
"""
.xls の各 cell の border style (top/bottom/left/right) を JSON で出力する。
出力: ./mhlw-borders.json (key: "row,col", value: 4 sides の style code)

style 値 (XF border style):
  0=none, 1=thin, 7=hair
  (この .xls では上記 3 種類しか使われていない)
"""
import xlrd, json, os

HERE = os.path.dirname(os.path.abspath(__file__))
XLS = os.path.join(HERE, '..', 'assets', 'mhlw-rirekisho-official.xls')
OUT = os.path.join(HERE, 'mhlw-borders.json')

wb = xlrd.open_workbook(XLS, formatting_info=True)
sh = wb.sheet_by_name('履歴書様式例〔厚労省作成）')
xfs = wb.xf_list

borders = {}
for r in range(sh.nrows):
    for c in range(sh.ncols):
        try:
            xf_idx = sh.cell_xf_index(r, c)
        except Exception:
            continue
        bd = xfs[xf_idx].border
        borders[f"{r},{c}"] = {
            'top': bd.top_line_style, 'bottom': bd.bottom_line_style,
            'left': bd.left_line_style, 'right': bd.right_line_style,
        }

with open(OUT, 'w') as f:
    json.dump(borders, f, indent=2)
print(f"saved {OUT} ({len(borders)} cells)")
