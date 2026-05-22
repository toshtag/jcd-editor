#!/usr/bin/env python3
"""
厚労省 履歴書様式例 .xls から column width / row height を mm 換算して
シート全体の geometry を出力する。出力: ./mhlw-rirekisho-dims.json

入力: ../assets/mhlw-rirekisho-official.xls

mm 換算式 (近似):
  Excel column width unit = 1/256 char width of "0" in default font.
  default font: ＭＳ Ｐゴシック 11pt → max digit width ≈ 7px at 96dpi.
  → width_px = int(chars * 7 + 5)
  → width_mm = width_px / 96 * 25.4

注意: この近似は実 PDF 出力と 1-3mm 程度ずれる。
「真値」が必要な場面では measure-pdf-rules.py の出力を使うこと。
"""
import xlrd, json, os

HERE = os.path.dirname(os.path.abspath(__file__))
XLS = os.path.join(HERE, '..', 'assets', 'mhlw-rirekisho-official.xls')
OUT = os.path.join(HERE, 'mhlw-rirekisho-dims.json')

wb = xlrd.open_workbook(XLS, formatting_info=True)
sh = wb.sheet_by_name('履歴書様式例〔厚労省作成）')

col_widths_pt = []
for col in range(sh.ncols):
    w_units = sh.computed_column_width(col)
    if w_units == 0:
        col_widths_pt.append(0)
    else:
        chars = w_units / 256
        px = int(chars * 7 + 5)
        col_widths_pt.append(px * 72 / 96)

col_widths_mm = [pt / 72 * 25.4 for pt in col_widths_pt]

row_heights_pt = []
default_row_pt = sh.default_row_height / 20
for row in range(sh.nrows):
    ri = sh.rowinfo_map.get(row)
    if ri and ri.height_mismatch:
        row_heights_pt.append(ri.height / 20)
    else:
        row_heights_pt.append(default_row_pt)
row_heights_mm = [pt / 72 * 25.4 for pt in row_heights_pt]

data = {
    'page': {'width_pt': 1190.52, 'height_pt': 841.92,
              'width_mm': 420.04, 'height_mm': 297.04},
    'columns_pt': col_widths_pt,
    'columns_mm': col_widths_mm,
    'rows_pt': row_heights_pt,
    'rows_mm': row_heights_mm,
    'total_content_width_pt': sum(col_widths_pt),
    'total_content_height_pt': sum(row_heights_pt),
    'merged_cells': [list(m) for m in sh.merged_cells],
}
with open(OUT, 'w') as f:
    json.dump(data, f, indent=2)
print(f"saved {OUT}")
print(f"  page: {data['page']['width_mm']}x{data['page']['height_mm']}mm (A3 landscape)")
print(f"  content width: {sum(col_widths_mm):.2f}mm")
print(f"  content height: {sum(row_heights_mm):.2f}mm")
print(f"  cells (incl. covered): {sh.nrows * sh.ncols}")
print(f"  merged regions: {len(sh.merged_cells)}")
