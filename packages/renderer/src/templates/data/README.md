# renderer/templates/data/

公式厚労省履歴書様式例 (シンプル版) から実測した ground truth データ。

## ファイル

- `mhlw-pdf-rules.json` — 公式 PDF (A3 横) を 300dpi PNG にレンダリングして、ピクセル単位で罫線座標を実測した結果。`h_lines` (水平 41 本) / `v_lines` (垂直 10 本) を含む
- `mhlw-text-bbox.json` — 公式 PDF から `pdftotext -bbox-layout` で抽出した text + bbox (mm 座標)。42 個のテキストブロック

## 出所と再生成

これらは `docs/investigations/rirekisho-mhlw/scripts/` で生成される。再生成手順は同ディレクトリの README.md を参照。

## 改変禁止

これらのファイルは template 実装で参照される ground truth。手で編集してはならない。改変が必要な場合は generator script を直して再生成すること。
