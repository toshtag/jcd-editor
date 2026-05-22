# rirekisho-mhlw — Phase 0 調査

## 目的

現行の `packages/renderer/src/templates/rirekisho-basic.ts` は「履歴書っぽい Web レイアウト」になっているが、`docs/CONCEPT.md` のスコープは **「日本式の書類 (JIS 様式)」** と明記されており、両者が乖離している。

本ディレクトリはその是正のための調査成果である。具体的には、厚労省が JIS 様式の後継として 2021年4月に公開した **履歴書様式例 (シンプル版・希望職種記入欄なし)** を、寸法レベルで完全再現するための準拠仕様と作業成果物をまとめる。

## ディレクトリ構成

```
rirekisho-mhlw/
├── README.md                     ← (この file)
├── spec.md                       ← 準拠仕様。Phase 1 実装の参照元
├── prototype-blank.html          ← 空白の様式を 1:1 再現した HTML プロトタイプ (overlay viewer 付き)
├── assets/
│   ├── mhlw-rirekisho-official.pdf       ← 一次資料 (厚労省配布 PDF、A3 横)
│   ├── mhlw-rirekisho-official.xls       ← 一次資料 (厚労省配布 Excel)
│   └── mhlw-rirekisho-official-150dpi.png ← PDF を 150dpi で PNG 化 (overlay viewer の比較背景に使う)
└── scripts/
    ├── extract-dims.py           ← Excel から列幅 / 行高を mm 換算
    ├── extract-cells.py          ← merged cell を解決して全 visible cell の geometry を出力
    ├── extract-borders.py        ← cell ごとの border style を抽出
    ├── measure-pdf-rules.py      ← 公式 PDF を 300dpi PNG 化して罫線座標を実測 (ground truth)
    ├── generate-prototype.py     ← 上記成果物から prototype-blank.html を生成
    ├── mhlw-rirekisho-dims.json  ← extract-dims.py の出力
    ├── mhlw-cells.json           ← extract-cells.py の出力 (448 cell)
    ├── mhlw-borders.json         ← extract-borders.py の出力 (832 cell)
    └── mhlw-pdf-rules.json       ← measure-pdf-rules.py の出力 (41 horizontal + 10 vertical)
```

## prototype-blank.html の使い方

ブラウザで [prototype-blank.html](./prototype-blank.html) を開く。
画面左上の checkbox で公式 PDF を背景に重ねて、罫線・テキスト位置のずれを目視確認できる。

ローカル file:// 経由で画像が表示されない場合は、ローカル HTTP server を立てる:

```sh
python3 -m http.server -d docs/investigations/rirekisho-mhlw 8000
# → http://localhost:8000/prototype-blank.html
```

## スクリプトの再実行

入力 (Excel / PDF) は `assets/` に固定で同梱されており、以下を実行すれば中間 JSON と HTML を再生成できる:

```sh
cd docs/investigations/rirekisho-mhlw/scripts
pip install --user xlrd==2.0.2 Pillow numpy   # 初回のみ
brew install poppler                           # 初回のみ (measure-pdf-rules.py 用の pdftoppm)

python3 extract-dims.py
python3 extract-cells.py
python3 extract-borders.py
python3 measure-pdf-rules.py
python3 generate-prototype.py
```

## Phase 1 への引き継ぎ

本ディレクトリは **調査成果物** であり、本番コードではない。Phase 1 で `packages/renderer/src/templates/rirekisho-basic.ts` を spec.md に従って再実装する際は:

1. `spec.md` の「寸法データ」「フォント方針」「CareerProfile データモデルとの対応」を参照
2. `mhlw-pdf-rules.json` の罫線座標を CSS Grid template の根拠として使う
3. `prototype-blank.html` を Playwright で screenshot → 公式 PDF と pixel diff を取り、許容差以内 (推奨: ±2px @ 300dpi = ±0.17mm) であることを CI で保証

Phase 1 完了後、本ディレクトリの prototype は廃止可能だが、`assets/` と `spec.md` は永続的に参照する。
