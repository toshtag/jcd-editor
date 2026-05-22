#!/usr/bin/env python3
"""
厚労省 履歴書様式例 .xls から merged cell を解決して全 visible cell の
x/y/w/h を mm 単位で出力する。出力: ./mhlw-cells.json

依存: pip install xlrd==2.0.2  (note: xlrd 2.0.x は .xls のみ対応、.xlsx は openpyxl)

input:
  - ../assets/mhlw-rirekisho-official.xls
  - ./mhlw-rirekisho-dims.json (extract-dims.py が事前に生成)

ASSUMPTION:
  - sheet 名は固定の '履歴書様式例〔厚労省作成）'
  - mm 換算は extract-dims.py 由来 (Excel column-width unit → pt → mm の近似)
  - 「真値」が必要な場面では measure-pdf-rules.py の出力 (300dpi 画像から実測) を使うこと
"""
import xlrd, json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
XLS = os.path.join(HERE, '..', 'assets', 'mhlw-rirekisho-official.xls')
DIMS = os.path.join(HERE, 'mhlw-rirekisho-dims.json')
OUT = os.path.join(HERE, 'mhlw-cells.json')

if not os.path.exists(DIMS):
    print(f"missing {DIMS} — run extract-dims.py first", file=sys.stderr)
    sys.exit(1)

wb = xlrd.open_workbook(XLS, formatting_info=True)
sh = wb.sheet_by_name('履歴書様式例〔厚労省作成）')

with open(DIMS) as f:
    dims = json.load(f)

cols_mm = dims['columns_mm']
rows_mm = dims['rows_mm']
merged = [tuple(m) for m in dims['merged_cells']]

covered = set()
merge_primary = {}
for (rlo, rhi, clo, chi) in merged:
    text = sh.cell_value(rlo, clo)
    merge_primary[(rlo, clo)] = (rhi - rlo, chi - clo, text)
    for r in range(rlo, rhi):
        for c in range(clo, chi):
            if (r, c) != (rlo, clo):
                covered.add((r, c))

col_offsets = [0.0]
for w in cols_mm:
    col_offsets.append(col_offsets[-1] + w)
row_offsets = [0.0]
for h in rows_mm:
    row_offsets.append(row_offsets[-1] + h)

cells = []
for r in range(sh.nrows):
    for c in range(sh.ncols):
        if (r, c) in covered:
            continue
        if (r, c) in merge_primary:
            rspan, cspan, txt = merge_primary[(r, c)]
        else:
            rspan, cspan = 1, 1
            try:
                txt = sh.cell_value(r, c)
            except Exception:
                txt = ''
        x = col_offsets[c]
        y = row_offsets[r]
        w = col_offsets[c + cspan] - x
        h = row_offsets[r + rspan] - y
        cells.append({'row': r, 'col': c, 'rspan': rspan, 'cspan': cspan,
                      'x_mm': round(x, 3), 'y_mm': round(y, 3),
                      'w_mm': round(w, 3), 'h_mm': round(h, 3),
                      'text': txt if isinstance(txt, str) else str(txt)})

with open(OUT, 'w') as f:
    json.dump(cells, f, ensure_ascii=False, indent=2)
print(f"saved {OUT} ({len(cells)} cells)")
