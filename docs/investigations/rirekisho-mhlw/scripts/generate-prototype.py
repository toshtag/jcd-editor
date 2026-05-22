#!/usr/bin/env python3
"""
ground truth (PDF 300dpi 実測の罫線 + pdftotext 由来のテキスト bbox) から
公式と px 単位で一致する HTML prototype を生成する。

input:
  - ./mhlw-pdf-rules.json     (measure-pdf-rules.py が出力)
  - ./mhlw-text-bbox.json     (extract-text-bbox.py が出力)
output:
  - ../prototype-blank.html   (overlay viewer 付き、罫線は実測値、テキストも実測 bbox)

注意: 罫線は <div> で position: absolute で描画する。table ではない。
これにより、cell padding / font metric の影響を受けず、px 単位で再現される。
"""
import json, os, html as html_lib

HERE = os.path.dirname(os.path.abspath(__file__))
RULES = os.path.join(HERE, 'mhlw-pdf-rules.json')
TEXTS = os.path.join(HERE, 'mhlw-text-bbox.json')
OUT = os.path.join(HERE, '..', 'prototype-blank.html')

with open(RULES) as f:
    rules = json.load(f)
with open(TEXTS) as f:
    texts = json.load(f)

DPI = rules['dpi']
def px_to_mm(px): return px / DPI * 25.4

PAGE_W_MM = rules['page_w_mm']
PAGE_H_MM = rules['page_h_mm']

# 写真欄 (Excel autoshape として埋め込まれている dashed box、PDF 300dpi 実測値)
#
# 重要: dashed line は **gray pixel** (luminance 80-200) で描画されている。
# 通常の罫線 (luminance < 60 = solid black) とは色が違う。
# black-only マスクで検出すると氏名欄の罫線などを誤検出する。
#
# 検出方法: 「gray-only でかつ solid black がほとんどない」行/列を走査して
# dashed pattern の bbox を抽出。
# 結果:
#   top y=327px (27.69mm), bottom y=784px (66.38mm)
#   left x=1828px (154.77mm), right x=2186px (185.08mm)
PHOTO_BOX = {'x_mm': 154.77, 'y_mm': 27.69, 'w_mm': 30.31, 'h_mm': 38.69}

# === Build CSS ===
css = f"""
@page {{ size: A3 landscape; margin: 0; }}
html, body {{ margin: 0; padding: 0; }}
body {{
  background: #ddd;
  font-family: "Noto Serif JP", "Yu Mincho", "MS Mincho", "Hiragino Mincho ProN", serif;
}}
.page {{
  position: relative;
  width: {PAGE_W_MM}mm;
  height: {PAGE_H_MM}mm;
  margin: 10mm auto;
  background: #fff;
  color: #000;
  box-shadow: 0 2px 12px rgba(0,0,0,0.2);
}}
.page .overlay {{
  position: absolute; inset: 0;
  background-image: url("./assets/mhlw-rirekisho-official-150dpi.png");
  background-size: 100% 100%;
  background-repeat: no-repeat;
  opacity: 0; pointer-events: none; z-index: 1000;
}}
body.overlay-on .page .overlay {{ opacity: 0.4; }}
body.lines-only .page .overlay {{ opacity: 1; mix-blend-mode: multiply; }}

/* 罫線 — 実測値で直接 div として描画 */
.rule {{
  position: absolute;
  background: #000;
  z-index: 2;
}}
.rule.h {{ height: 0.5pt; }}     /* 水平線 (高さ ~0.5pt) */
.rule.v {{ width: 0.5pt; }}      /* 垂直線 (幅 ~0.5pt) */

/* テキストブロック */
.tb {{
  position: absolute;
  z-index: 3;
  font-size: 11pt;
  line-height: 1.15;
  white-space: nowrap;
  color: #000;
}}
.tb.gothic {{
  font-family: "Noto Sans JP", "Yu Gothic", "Hiragino Sans", sans-serif;
}}
.tb.kaisho {{
  font-family: "Klee One", "Hiragino Mincho ProN", "Yu Mincho", serif;
  font-weight: 500;
  letter-spacing: 0.2em;  /* Klee One 28pt + 0.2em で width 35.56mm = 公式と一致 */
}}
/* 「履歴書」タイトル専用
   Klee One 28pt は HG正楷書体より字高が大きい (12.24pt vs 10.08pt)。
   transform: scaleY で 公式と同じ glyph 高さに揃え、合わせて y を補正。
   公式 glyph: y=28.53-32.09mm, 高さ 10.08pt
   私の glyph (補正前): y=30.06-34.40mm, 高さ 12.24pt */
.tb.title-rirekisho {{
  transform: scaleY(0.823);     /* 12.24pt → 10.08pt */
  transform-origin: top left;
  margin-top: -1.5mm;          /* glyph top を公式に揃える */
}}

/* 写真欄 — Excel autoshape (dashed)
   公式は黒ではなく薄い gray で dashed を描画している (luminance ~128) */
.photo-box {{
  position: absolute;
  box-sizing: border-box;
  border: 0.75pt dashed #808080;
  padding: 2.5mm 1.5mm 1.5mm;
  font-family: "Noto Sans JP", "Yu Gothic", sans-serif;
  font-size: 7.5pt;
  line-height: 1.5;
  z-index: 2;
  color: #000;
}}
.photo-box .heading {{
  text-align: center;
  font-size: 8.5pt;
  margin-bottom: 1.5mm;
  letter-spacing: 0.08em;
}}
.photo-box .body {{ font-size: 7pt; }}

.controls {{
  position: fixed; top: 10px; left: 10px; z-index: 10000;
  background: #fff; padding: 10px 14px; border: 1px solid #888;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; font-size: 13px;
  border-radius: 6px; box-shadow: 0 2px 8px rgba(0,0,0,0.2);
}}
.controls h3 {{ margin: 0 0 8px; font-size: 13px; }}
.controls label {{ display: block; margin: 4px 0; cursor: pointer; }}
.controls input {{ margin-right: 6px; }}
.controls .stat {{ margin-top: 6px; padding-top: 6px; border-top: 1px solid #eee; font-size: 11px; color: #666; }}
"""

# === Build HTML ===
parts = []
parts.append('<!DOCTYPE html>')
parts.append('<html lang="ja"><head><meta charset="UTF-8">')
parts.append('<title>厚労省 履歴書様式例 prototype (faithful)</title>')
parts.append('<link rel="preconnect" href="https://fonts.googleapis.com">')
parts.append('<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>')
parts.append('<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&family=Noto+Serif+JP:wght@400;500;700&family=Klee+One:wght@400;600&display=swap" rel="stylesheet">')
parts.append(f'<style>{css}</style>')
parts.append('<script>')
parts.append('''
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
''')
parts.append('</script>')
parts.append('</head><body>')

parts.append(f'''<div class="controls">
<h3>公式 PDF との比較</h3>
<label><input type="checkbox" id="overlay-toggle"> 公式を半透明 (40%) で重ねる</label>
<label><input type="checkbox" id="lines-only-toggle"> 公式を multiply で重ねる</label>
<div class="stat">罫線 H: {len(rules['h_lines'])} 本 / V: {len(rules['v_lines'])} 本<br>テキスト: {len(texts)} 個</div>
</div>''')
parts.append('<div class="page">')
parts.append('<div class="overlay"></div>')

# === 罫線描画 ===
for h in rules['h_lines']:
    y_mm = h['y_mm']
    for s_px, e_px in h['spans_px']:
        x_mm = px_to_mm(s_px)
        w_mm = px_to_mm(e_px - s_px)
        parts.append(f'<div class="rule h" style="left:{x_mm:.3f}mm;top:{y_mm:.3f}mm;width:{w_mm:.3f}mm;"></div>')

for v in rules['v_lines']:
    x_mm = v['x_mm']
    for s_px, e_px in v['spans_px']:
        y_mm = px_to_mm(s_px)
        h_mm = px_to_mm(e_px - s_px)
        parts.append(f'<div class="rule v" style="left:{x_mm:.3f}mm;top:{y_mm:.3f}mm;height:{h_mm:.3f}mm;"></div>')

# === 写真欄 ===
parts.append(f'''<div class="photo-box" style="left:{PHOTO_BOX['x_mm']}mm;top:{PHOTO_BOX['y_mm']}mm;width:{PHOTO_BOX['w_mm']}mm;height:{PHOTO_BOX['h_mm']}mm;">
<div class="heading">写真をはる位置</div>
<div class="body">写真をはる必要が<br>ある場合<br>1.&nbsp;縦<br>&nbsp;&nbsp;&nbsp;横<br>2.本人単身胸から上<br>3.裏面のりづけ</div>
</div>''')

# === テキスト ===
# Skip texts that overlap with photo box (the photo box draws its own text)
PHOTO_RIGHT = PHOTO_BOX['x_mm'] + PHOTO_BOX['w_mm']
PHOTO_BOTTOM = PHOTO_BOX['y_mm'] + PHOTO_BOX['h_mm']

def is_in_photo(t):
    return (t['x_mm'] >= PHOTO_BOX['x_mm'] - 2 and t['x_mm'] <= PHOTO_RIGHT + 2 and
            t['y_mm'] >= PHOTO_BOX['y_mm'] - 2 and t['y_mm'] <= PHOTO_BOTTOM + 2)

# Heuristic font assignment based on text content / size
def font_class(t):
    text = t['text']
    # タイトル「履歴書」は HG正楷書体-PRO (28pt) → kaisho
    if text == '履歴書':
        return 'kaisho'
    # 「ふりがな」「※性別」「写真をはる位置」「(現住所以外...)」 などはゴシック
    if 'ふりがな' in text or '※性別' in text or '現住所以外' in text or '※' in text or '写真' in text or '性別' in text:
        return 'gothic'
    # 「年」「月」「日現在」「日生」「(満」「歳）」など 単独漢字 → 明朝
    return ''  # default = mincho

def font_size_pt(t):
    text = t['text']
    h_mm = t['h_mm']
    # 「履歴書」 28pt
    if text == '履歴書': return 28
    # 「学　歴・職　歴 (各別にまとめて書く)」「免　許・資　格」「志望の動機…」「本人希望記入欄…」 など大見出し
    if '学' in text and ('歴' in text and '職' in text):
        return 11
    # 「写真をはる位置」「写真をはる必要が…」など写真欄テキストはここでは出さない
    # 「※「性別」欄: ...」 など脚注
    if text.startswith('※「性別」'):
        return 11
    if '現住所以外' in text:
        return 9
    if '(満' in text or '歳）' in text:
        return 12
    # default 11pt
    return 11

for t in texts:
    if is_in_photo(t):
        continue
    fclass = font_class(t)
    fsize = font_size_pt(t)
    text_html = html_lib.escape(t['text']).replace('\n', '<br>')
    extra_class = ''
    if t['text'] == '履歴書':
        extra_class = ' title-rirekisho'
    cls = f'tb {fclass}{extra_class}'.strip()
    style = f'left:{t["x_mm"]:.3f}mm;top:{t["y_mm"]:.3f}mm;font-size:{fsize}pt;'
    parts.append(f'<div class="{cls}" style="{style}">{text_html}</div>')

parts.append('</div>')
parts.append('</body></html>')

with open(OUT, 'w') as f:
    f.write('\n'.join(parts))
print(f"wrote {OUT}")
print(f"  rules: {len(rules['h_lines'])} h + {len(rules['v_lines'])} v")
print(f"  texts: {len(texts)} ({sum(1 for t in texts if not is_in_photo(t))} drawn, rest skipped as inside photo-box)")
