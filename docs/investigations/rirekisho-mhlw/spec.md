# 厚労省 履歴書様式例 (シンプル版) — 完全再現のための spec

## Phase 0 達成記録

ground truth-driven approach により、罫線レベルでの完全一致を達成:

| 項目 | 結果 |
|---|---|
| 水平罫線 (41 本) | mean 0.00mm / max 0.00mm / ±1mm 内 100% |
| 垂直罫線 (10 本) | mean 0.00mm / max 0.00mm / ±1mm 内 100% |

達成手段:
- `measure-pdf-rules.py` で公式 PDF を 300dpi PNG にレンダリングし、ピクセル単位で罫線座標を実測 → `mhlw-pdf-rules.json`
- `extract-text-bbox.py` で `pdftotext -bbox-layout` を使い、テキストブロックの bbox を実測 → `mhlw-text-bbox.json`
- `generate-prototype.py` がこの 2 つの ground truth から `position: absolute` で直接 HTML を生成 (table/grid を使わない)

Web font (Noto Serif JP / Klee One) と公式の MS 系/HG正楷書体 では字形が異なるため、文字の細部 (太さ・字幅) は完全一致しない。これは Web 環境の原理的制約であり、Phase 1 でも改善できない。

## このドキュメントの位置付け

本ドキュメントは Phase 0 の調査成果物である。`docs/CONCEPT.md` で宣言した「日本式の書類 (JIS 様式)」スコープを正しく満たすために、現行の `packages/renderer/src/templates/rirekisho-basic.ts` を **厚労省履歴書様式例 (2021年公開)** と寸法レベルで一致するよう Phase 1 で再実装する、その準拠仕様を定義する。

JIS Z 8303 の履歴書様式は 2020年7月に日本規格協会が削除した。後継として厚生労働省が 2021年4月に公開したのが本様式例であり、現在公的に最も「公式」とされる履歴書フォーマットである。

## 出所 (Provenance)

- 一次入手元: 厚生労働省 埼玉労働局 [履歴書様式について](https://jsite.mhlw.go.jp/saitama-roudoukyoku/hourei_seido_tetsuzuki/shokugyou_taisaku/rirekisyo-yoshiki.html)
- 公開元解説: 厚生労働省 [新たな履歴書の様式例の作成について](https://www.mhlw.go.jp/stf/newpage_kouseisaiyou030416.html) (2021年4月16日)
- バリエーション選択: **希望職種記入欄なし (シンプル版)** — `assets/mhlw-rirekisho-official.{pdf,xls}` に保存
  - 確認: PDF は A3 横 1190.52×841.92 pts (420.04×297.04 mm)、Excel 由来 (`Microsoft Excel 2016` 出力)
  - 別バージョン (希望職種あり) も同サイトで配布されているが、本テンプレートは扱わない (将来必要になったら別 template として追加)

## 紙サイズと座標系

- **A3 横、見開き 1 ページ**。A4 縦に折ってもよいが原版は A3
- 起点は左上 (0, 0) mm、x は右方向、y は下方向
- 左ページ content 領域: x = 23.62 〜 196.13 mm (幅 172.5 mm)
- 右ページ content 領域: x = 228.85 〜 401.45 mm (幅 172.6 mm)
- 左右ページ間スペース: 32.7 mm
- ページ上下マージン: 約 3.25 mm (top) / 約 3.27 mm (bottom)
- 上記座標は `scripts/measure-pdf-rules.py` が PDF を 300dpi PNG にレンダリングして実測した値 (`mhlw-pdf-rules.json` 参照)

## レイアウト構成 (左ページ → 右ページ)

### 左ページ
1. **タイトル「履 歴 書」** — フォント HG正楷書体-PRO 28pt、左上
2. **「年 月 日現在」** — 記入欄、タイトル右隣
3. **写真欄** — dashed border の四角 (約 35.6 × 29.2 mm)、左 144.5mm/上 32.1mm。box 内に見出し「写真をはる位置」+ 補足「写真をはる必要がある場合 / 1. 縦 横 / 2. 本人単身胸から上 / 3. 裏面のりづけ」
4. **ふりがな / 氏名** (氏名欄は記入領域として大きい)
5. **生年月日 (満　歳) / ※性別** — 性別は任意記載 (page footer に注釈)
6. **ふりがな / 現住所 〒 / 電話**
7. **ふりがな / 連絡先 〒 (現住所以外に連絡を希望する場合のみ記入) / 電話**
8. **学歴・職歴 (各別にまとめて書く)** 表 — 年/月/内容、左ページに約 11 行 (右ページに続く)

### 右ページ
1. **学歴・職歴の続き** — 年/月/内容、約 8 行 (左ページからの合計で 19 行)
2. **免許・資格** 表 — 年/月/内容、約 7 行
3. **志望の動機、特技、好きな学科、アピールポイントなど** — 大きいフリーテキスト欄
4. **本人希望記入欄 (特に給料・職種・勤務時間・勤務地・その他についての希望などがあれば記入)** — 中サイズフリーテキスト欄

### page footer (左ページ下)
- 注釈: 「※「性別」欄: 記載は任意です。未記載とすることも可能です。」

## 寸法データ

### Excel 由来の column / row 寸法

`scripts/mhlw-rirekisho-dims.json` を参照。Excel column width (1/256 char 単位) を 96dpi pixel → pt → mm に換算した値。

| 種別 | 列/行数 | 合計 (mm) | 備考 |
|---|---|---|---|
| 列 | 16 | 382.06 | 左右ページのコンテンツ幅合計 (実測 345.1mm に対し 36.9mm 大きい — Excel 計算式の近似誤差) |
| 行 | 52 | 290.51 | ページ全高 297.04mm に対し 6.5mm 小さい |

→ **真値が必要なら `mhlw-pdf-rules.json` (実測) を使う**。

### 罫線スタイル (Excel 由来)

`scripts/mhlw-borders.json` を参照。XF border style は以下の 3 種類のみ使用:

| code | 意味 | CSS 換算 (推奨) |
|---|---|---|
| 0 | none | (なし) |
| 1 | thin | `0.5pt solid #000` |
| 7 | hair | `0.25pt solid #000` |

写真欄の点線囲み (dashed) は cell border ではなく **Excel autoshape として描画** されており、xlrd では抽出できない。手動で `0.75pt dashed #000` で描画する。

## フォント方針

| 用途 | 公式 | Web 代替 | Note |
|---|---|---|---|
| タイトル「履　歴　書」「年 月 日現在」 | HG正楷書体-PRO 28pt | `"Klee One", "Hiragino Mincho ProN", serif` (weight 500, letter-spacing 0.15em) | HG正楷書体は OS 標準ではない。Klee One は Google Fonts で配布されている近似楷書体。完全一致ではない |
| 見出し (ふりがな / 氏名 / 学歴・職歴 等) | ＭＳ Ｐ明朝 11pt | `"Noto Serif JP", "Yu Mincho", "MS Mincho", serif` | |
| 注釈 (※性別 注、写真欄説明) | ＭＳ Ｐゴシック 6-9pt | `"Noto Sans JP", "Yu Gothic", sans-serif` | |
| ※「性別」欄 注釈 | ＭＳ Ｐゴシック 11pt | `"Noto Sans JP", sans-serif` | |

**font metric の差**: Excel は ＭＳ Ｐ系プロポーショナル前提でセル幅ギリギリにテキストを配置している。Web font (Noto 系) は字幅が異なるため、そのまま流すとはみ出す。Phase 1 では以下のいずれかで対応する:
- `font-size-adjust` で字幅を物理的に揃える (推奨、ただしブラウザ対応に注意)
- `transform: scaleX(0.95)` でセル幅以内に縮小
- セルごとに `max-width` + `text-overflow: ellipsis` (避けるべき、情報欠落)

## CareerProfile データモデルとの対応

現行の `@jcd-editor/core` の `CareerProfile` 型と、本様式の入力欄の対応:

| 様式の入力欄 | CareerProfile field | 備考 |
|---|---|---|
| ふりがな (氏名) | `basics.nameKana.{family, given}` | family/given を 全角スペース 連結 |
| 氏名 | `basics.name.{family, given}` | 同上 |
| 年 月 日生 (満　歳) | `basics.birthDate` | 「生」「満X歳」は基準日 (年月日現在欄の日付) から計算 |
| ※性別 | `basics.gender` (未定義) | **データモデルにフィールドなし — Phase 1 で追加** または `undefined` を許容 |
| ふりがな (現住所) | `basics.addressKana` (未定義) | **データモデルにフィールドなし — Phase 1 で追加** |
| 現住所 〒 | `basics.address.{postalCode, region, locality, ...}` | 〒記号は固定描画、postalCode のみ流し込む |
| 電話 (現住所) | `basics.phone` | |
| ふりがな (連絡先) | `basics.contactAddressKana` (未定義) | **データモデルにフィールドなし — Phase 1 で追加** |
| 連絡先 〒 | `basics.contactAddress` (未定義) | **データモデルにフィールドなし — Phase 1 で追加** |
| 電話 (連絡先) | `basics.contactPhone` (未定義) | **データモデルにフィールドなし — Phase 1 で追加** |
| 学歴・職歴 表 | `educationHistory[]` + `workExperiences[]` | 既存 `rirekisho-basic.ts` の row 分解ロジック流用可 |
| 免許・資格 表 | `certifications[]` | acquiredDate/name のみ。`credentialId/credentialUrl/expirationDate/description` は本様式では描画しない |
| 志望の動機、特技、好きな学科、アピールポイントなど | `basics.summary` (未定義) または専用フィールド | **データモデルにフィールドなし — Phase 1 で追加** |
| 本人希望記入欄 | `basics.personalRequest` (未定義) | **データモデルにフィールドなし — Phase 1 で追加** |
| 年月日現在 (右上) | `meta.preparedOn` (未定義) | **データモデルにフィールドなし — Phase 1 で追加**。default は「今日」 |

### Phase 1 で `@jcd-editor/core` に追加が必要なフィールド

1. `basics.gender?: string` (任意、空文字許容)
2. `basics.addressKana?: { postalCode?, region?, locality?, ... }` — 現住所のふりがな
3. `basics.contactAddress?` / `basics.contactAddressKana?` / `basics.contactPhone?` — 連絡先
4. `basics.summary?: string` — 志望動機・自己 PR フリーテキスト
5. `basics.personalRequest?: string` — 本人希望
6. `meta.preparedOn?: { year, month, day }` または `Date` — 「年月日現在」

### Phase 1 で「履歴書では描画しない」と決めたもの (CONCEPT との整合)

- `WorkExperience.responsibilities` / `achievements` / `summary` / `tags`
- `Project.*` 全般 (履歴書側では projects section ごと削除)
- `Skill.*` 全般 (履歴書側では skills section ごと削除)
- `Certification.credentialId` / `credentialUrl` / `expirationDate` / `description`

これらは職務経歴書 (shokumukeirekisho-basic) の責務として明確に役割分担する。

## レンダリング戦略 (Phase 1)

### 推奨: CSS Grid + 名前付き grid-area による絶対配置

理由:
- 公式様式は「方眼の交点に罫線とテキストを配置」する設計であり、HTML table の自動レイアウトとは思想が逆
- mm 単位の絶対指定 (`grid-template-columns: <list of mm>`) で罫線位置を正確に制御
- セル内 padding/font 差で隣接セルが押されない (table とは異なる)

### CSS 設計の骨子

```css
@page { size: A3 landscape; margin: 0; }
.rirekisho-mhlw {
  width: 420.04mm; height: 297.04mm;
  position: relative;
  font-family: "Noto Serif JP", "Yu Mincho", serif;
  font-size: 11pt;
  color: #000;
}
.rirekisho-mhlw__cell {
  position: absolute; box-sizing: border-box;
  padding: 0.5mm 1mm;
  line-height: 1.1;
}
/* 罫線は cell ごとに border-{top|bottom|left|right} で付ける。
   隣接 cell 重複は許容 (描画上は同位置 1pt 線になる) */
```

### PDF 出力 (`packages/pdf`)

- Playwright の `page.pdf({ format: 'A3', landscape: true, printBackground: true })` を使う
- フォント埋め込み: PDF 出力時に Noto Sans JP / Noto Serif JP / Klee One を embed
- Phase 1 でフォント file (.woff2) を `assets/fonts/` に同梱し、CSS で `@font-face` 宣言する

### テスト戦略

1. **構造テスト** (既存 vitest): HTML 出力に必須セレクタが含まれるか
2. **寸法テスト** (新規): `mhlw-pdf-rules.json` の各罫線が、生成された HTML を Playwright でレンダリングした PNG 上で同じ px 位置にあるか
3. **regression baseline**: 公式 PDF と 1:1 で重ねた状態の screenshot を baseline として保持、Phase 2 以降の変更で diff があれば検知

## 既知の課題 / Phase 1 で詰めるべき項目

1. **写真欄の正確な位置** — Excel autoshape を xlrd で読めないため、PDF 実測 (左 144.5mm / 上 32.1mm / 幅 35.6mm / 高 29.2mm) を hardcode
2. **「年月日現在」の数字入りパターン** — Excel 原本では空欄。実データを入れた時の位置は未検証
3. **多ページ展開** — 学歴・職歴が 19 件を超えた場合の挙動 (本様式は固定行数で「あふれた分は切り捨て or 2 枚目に追加」のどちらか) → ユーザー判断待ち
4. **A4 縦折りで印刷したい人への対応** — A3 を半分に折る運用が標準。CSS は A3 で出力し、ユーザー側で印刷時の用紙設定で A4 縮小印刷を選んでもらう
5. **写真の実画像挿入** — CareerProfile `profilePhoto.source.dataUri` を写真欄内に貼り付ける機構が必要
6. **罫線の hairline (0.25pt)** — Web では 1 device pixel 未満になり、ブラウザ/ディスプレイ DPI により消える場合がある。PDF 出力では問題ないが、preview UI では `min-height: 1px` 補強を検討

## prototype の使い方

[prototype-blank.html](./prototype-blank.html) をブラウザで開く。右上の checkbox で:
- 「公式を半透明 (40%) で重ねる」 → 罫線位置のずれが視覚的にわかる
- 「公式を multiply で重ねる」 → 一致部分は黒・ずれた部分は灰で残るため微小ずれの検出に有効

ローカル file URL から開く場合: 画像参照のため CORS 問題が出ることがある。その場合は:

```sh
python3 -m http.server -d docs/investigations/rirekisho-mhlw 8000
# → http://localhost:8000/prototype-blank.html
```

## 参考リンク

- 厚生労働省: [新たな履歴書の様式例の作成について](https://www.mhlw.go.jp/stf/newpage_kouseisaiyou030416.html)
- ハローワークインターネットサービス: [履歴書・職務経歴書の書き方](https://www.hellowork.mhlw.go.jp/member/career_doc01.html)
- JIS Z 8303 (削除済み): 日本規格協会、2020年7月削除
