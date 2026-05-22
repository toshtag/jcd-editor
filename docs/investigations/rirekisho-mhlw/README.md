# rirekisho-mhlw — Phase 0 調査

## 目的

現行の `packages/renderer/src/templates/rirekisho-basic.ts` は「履歴書っぽい Web レイアウト」になっているが、`docs/CONCEPT.md` のスコープは **「日本式の書類 (JIS 様式)」** と明記されており、両者が乖離している。

本ディレクトリはその是正のための調査成果である。具体的には、厚労省が JIS 様式の後継として 2021年4月に公開した **履歴書様式例 (シンプル版・希望職種記入欄なし)** を、罫線レベルで完全再現するための準拠仕様と作業成果物をまとめる。

## 達成された一致レベル (Phase 0 完了基準)

| 項目 | 結果 |
|---|---|
| 水平罫線 (41 本) のずれ | **mean 0.00mm / max 0.00mm / ±1mm 内 100%** |
| 垂直罫線 (10 本) のずれ | **mean 0.00mm / max 0.00mm / ±1mm 内 100%** |
| 写真欄 (dashed) 位置 | PDF 300dpi 画像から 1px 単位で実測 |
| テキスト位置 | pdftotext -bbox-layout で実測した bbox に直接配置 |
| フォント字形 | Web fallback (Noto / Klee One) のため公式と完全一致しない (原理的に Phase 1 でも改善不可) |

## ディレクトリ構成

```
rirekisho-mhlw/
├── README.md                     ← (この file)
├── spec.md                       ← 準拠仕様。Phase 1 実装の参照元
├── prototype-blank.html          ← 空白の様式を 1:1 再現した HTML プロトタイプ (overlay viewer 付き)
├── assets/
│   ├── mhlw-rirekisho-official.pdf        ← 一次資料 (厚労省配布 PDF、A3 横)
│   ├── mhlw-rirekisho-official.xls        ← 一次資料 (厚労省配布 Excel)
│   ├── mhlw-rirekisho-official-150dpi.png ← overlay viewer の比較背景
│   ├── prototype-render.png               ← prototype の 300dpi レンダリング (この PR の見た目)
│   └── prototype-vs-official-multiply.png ← prototype × 公式 PDF の multiply 合成 (ずれ検出用)
└── scripts/
    ├── measure-pdf-rules.py     ← 公式 PDF を 300dpi 化して罫線座標を実測 (ground truth)
    ├── extract-text-bbox.py     ← 公式 PDF から text + bbox を実測
    ├── generate-prototype.py    ← 上の 2 つの JSON から prototype-blank.html を生成
    ├── mhlw-pdf-rules.json      ← measure-pdf-rules.py の出力 (41 horizontal + 10 vertical)
    ├── mhlw-text-bbox.json      ← extract-text-bbox.py の出力 (42 text block)
    │
    │ --- 参考: 初期の Excel 由来アプローチ (現 generator では未使用、Phase 1 参考) ---
    ├── extract-dims.py / extract-cells.py / extract-borders.py
    └── mhlw-rirekisho-dims.json / mhlw-cells.json / mhlw-borders.json
```

## prototype-blank.html の使い方

ブラウザで [prototype-blank.html](./prototype-blank.html) を開く。
画面左上の checkbox で公式 PDF を背景に重ねて、罫線・テキスト位置のずれを目視確認できる。

ローカル `file://` 経由で画像が表示されない場合は、ローカル HTTP server を立てる:

```sh
python3 -m http.server -d docs/investigations/rirekisho-mhlw 8000
# → http://localhost:8000/prototype-blank.html
```

「公式を multiply で重ねる」モードで、罫線が二重に見えなければ完全一致 (= Phase 0 達成済み)。

## スクリプトの再実行

入力 (Excel / PDF) は `assets/` に固定で同梱されており、以下を実行すれば JSON と HTML を再生成できる。

```sh
cd docs/investigations/rirekisho-mhlw/scripts
pip install --user Pillow numpy xlrd==2.0.2   # 初回のみ (xlrd は参考用)
brew install poppler                           # 初回のみ (pdftoppm / pdftotext 用)

# 現用の faithful generator パイプライン:
python3 measure-pdf-rules.py    # 罫線実測 → mhlw-pdf-rules.json
python3 extract-text-bbox.py    # テキスト実測 → mhlw-text-bbox.json
python3 generate-prototype.py   # ../prototype-blank.html を再生成

# 参考用 (Excel 由来、現 generator では未使用):
python3 extract-dims.py
python3 extract-cells.py
python3 extract-borders.py
```

## Phase 1 への引き継ぎ

本ディレクトリは **調査成果物** であり、本番コードではない。Phase 1 で `packages/renderer/src/templates/rirekisho-basic.ts` を spec.md に従って再実装する際は:

1. `spec.md` の「データモデルとの対応」「フォント方針」を参照
2. `mhlw-pdf-rules.json` の罫線座標を `position: absolute` で直接 div として描画 (CSS Grid よりこの方が px 一致しやすい)
3. `mhlw-text-bbox.json` は「公式テンプレートが配置するラベル類」(ふりがな / 氏名 / 学　歴・職　歴 など) の正規座標として使う。**ユーザー入力データ**は CareerProfile から流し込み、罫線で区切られた各セル領域に配置する
4. `prototype-blank.html` を Playwright で screenshot → 公式 PDF と pixel diff を取り、罫線位置のずれが ±1mm 以内であることを CI で保証

Phase 1 完了後、本ディレクトリの prototype は廃止可能だが、`assets/` と `spec.md` は永続的に参照する。

## A4 縦 2 ページ版 (Phase 1 で追加)

公式様式は A3 横 1 枚だが、実運用では A4 縦 2 ページに分割して印刷・PDF 配布されるのが一般的。Phase 1 では同じ罫線データから A4 縦 2 ページ版テンプレートも生成する:

- A3 横の左半分 (x: 0-210mm) → A4 page 1 (210mm 幅をそのまま)
- A3 横の右半分 (x: 210-420mm) → A4 page 2 (x 座標から 210mm を引いて配置)

CSS の `@page { size: A4 portrait }` + 2 つの `.page` div で実装可能。
