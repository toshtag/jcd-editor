# preview / 印刷時の改ページに関する調査

## 1. 目的と位置付け

本ドキュメントは、計画書 `text-jcd-editor-unified-kernighan.md` の **Branch 7**
として実施した、preview / 印刷時の改ページ問題の調査レポートである。

実装ブランチではなく **調査タスク** であり、ゴールは「現状の崩れ方を確認し、
次の意思決定 (CSS 修正で対処するか、PDF 本実装フェーズに回すか、何もしないか)
の判断材料を提示すること」である。

### 着手前提

Branch 1〜6 (PR #32〜#37) で apps/local-web は CareerProfile の全 6 section
(basics / workExperiences / educationHistory / skills / certifications /
projects) を編集できる状態になった。本調査はそのうえで実データに近い長い
profile を想定して行う。

---

## 2. 現状の CSS 改ページ制御

### packages/renderer/src/templates/rirekisho-basic.ts

```css
@page { size: A4; margin: 15mm; }
```

これ以外の `page-break-*` / `break-*` / `widow` / `orphans` プロパティは
**一切定義されていない**。

`<thead>` は使われているが、`display: table-header-group` を明示していない。
(ブラウザの挙動はベンダーによって異なる: Chromium / Firefox は header の
auto 繰り返しに対応する場合があるが、印刷スタイル経由では信頼できない。)

### packages/renderer/src/templates/shokumukeirekisho-basic.ts

```css
@page { size: A4; margin: 15mm; }
```

同様に break 制御は一切なし。テーブルは使わず `<ul><li>` のみで構成。

---

## 3. 出力 HTML 構造と崩れる可能性のある箇所

### 履歴書 (rirekisho-basic) の構造

```
<article class="jcd-rirekisho">
  <header>                                      ← 1 ページ目固定
    <div class="jcd-rirekisho__header-main">
      <h1>履歴書</h1>
      <dl class="jcd-rirekisho__basics">...</dl>
    </div>
    <div class="jcd-rirekisho__photo">...</div>
  </header>

  <section class="jcd-rirekisho__section--history">
    <h2>学歴・職歴</h2>
    <table class="jcd-rirekisho__history-table">
      <thead><tr><th>年月</th><th>内容</th></tr></thead>
      <tbody>
        <tr class="jcd-rirekisho__history-heading"><td colspan="2">学歴</td></tr>
        <tr>...</tr>            ← 教育歴 row (1 entry が 1〜2 row に分解)
        <tr class="jcd-rirekisho__history-heading"><td colspan="2">職歴</td></tr>
        <tr>...</tr>            ← 職歴 row (1 entry が 1〜2 row に分解)
      </tbody>
    </table>
  </section>

  <section class="jcd-rirekisho__section--skills">
    <h2>スキル</h2>
    <ul><li>...</li></ul>                      ← 各 li は 1 行が基本
  </section>

  <section class="jcd-rirekisho__section--certifications">
    <h2>資格</h2>
    <ul><li>... + div detail 複数 + ...</li></ul>  ← 中程度
  </section>

  <section class="jcd-rirekisho__section--projects">
    <h2>プロジェクト</h2>
    <ul><li>head + summary + responsibilities ul + achievements ul + technologies ul</li></ul>
                                                ← 1 entry で 10 行を超え得る
  </section>
</article>
```

### 職務経歴書 (shokumukeirekisho-basic) の構造

```
<article>
  <header>                                      ← 1 ページ目固定
  <section --work-experiences>
    <ul><li>会社名 + 雇用形態 + 期間 + summary + responsibilities ul + achievements ul</li></ul>
                                                ← 1 entry が長い
  </section>
  <section --projects> ...                      ← 履歴書と同様
  <section --skills> ...
  <section --certifications> ...
</article>
```

### 崩れる可能性の評価

| 箇所 | 高さの幅 | 改ページ時の崩れ方 | リスク |
|---|---|---|---|
| `<header>` (basics + photo) | 固定〜小 | header は通常 1 ページ目に収まる | 低 |
| `<section> <h2>` heading | 1 行 | h2 が前ページ末尾に残り、本文が次ページ先頭に行く (orphan h2) | **中** |
| 履歴 `<table>` の `<tr>` | 1 行が基本 | tr の途中改ページは通常起きない (line-height で 1 行) | 低 |
| 履歴 `<thead>` の繰り返し | n/a | 2 ページ目以降に header が出ない可能性 (環境依存) | 中 |
| スキル `<li>` | 1 行 | 通常は 1 行 1 entry、影響小 | 低 |
| 資格 `<li>` | 数行 | description / credentialUrl があると 3〜5 行、entry 途中改ページの可能性 | 中 |
| プロジェクト `<li>` | 10 行〜 | summary + 担当 list + 成果 list + 技術 list がある entry は **確実に途中で切れる** | **高** |
| 職務経歴 `<li>` (職務経歴書) | 10 行〜 | プロジェクトと同様 | **高** |

特に **プロジェクト / 職務経歴の li** は、責任ある成果を複数行書くほど 1 entry
が長くなり、改ページ時に最も読みづらい場所で切られる可能性が高い。

---

## 4. 対処方針の比較

### 方針 A: 最小 CSS 修正で対処する (recommended)

renderer の **CSS のみ** を変更する。HTML 構造 / API 表面は無変更。

```css
/* h2 widow 防止 */
.jcd-rirekisho__section h2,
.jcd-shokumukeirekisho__section h2 {
  break-after: avoid;
  page-break-after: avoid;
}

/* 各 entry (li) を途中で切らない */
.jcd-rirekisho__section li,
.jcd-shokumukeirekisho__section li {
  break-inside: avoid;
  page-break-inside: avoid;
}

/* 表の行を途中で切らない */
.jcd-rirekisho__history-table tr {
  break-inside: avoid;
  page-break-inside: avoid;
}

/* 多ページ時に thead を 2 ページ目以降にも出す */
.jcd-rirekisho__history-table thead {
  display: table-header-group;
}
```

#### 利点
- 変更範囲: renderer の CSS literal のみ
- 既存 test 全て pass する想定 (HTML 構造無変更)
- 1 entry が極端に長くて 1 ページに収まらないケース以外、ほぼ解決する
- 印刷 / PDF 出力どちらにも効く (Playwright の `printBackground` 経由でも同じ CSS)

#### 制約
- `break-inside: avoid` を多用すると、1 ページ内で前 section の末尾に余白が残る
  ケースが増える (ページ末尾 5 cm 空いて次の li が次ページに行く等)
- 1 entry が 1 ページに収まらないほど巨大な場合は強制的に切られる
  (この場合 CSS では完全には防げない、HTML 分割が必要)

#### コスト
- renderer に 2 template 分 CSS を追加するだけ
- test 追加: CSS 文字列に regex assert を入れて構造的依存を捕捉する
- **見積もり: 1 commit / PR、半日**

#### このフェーズで実施すべきか

実施を推奨する。理由:
- 全 6 section が編集可能になり、実データを入れると確実に崩れる箇所がある
  (特にプロジェクト / 職務経歴の li)
- CSS のみで HTML 構造を触らない範囲なら、PDF 本実装フェーズの設計を狭めない
- ユーザーがブラウザ印刷で PDF を作る暫定運用が成立するレベルに引き上げる

### 方針 B: PDF 本実装フェーズまで先送りする

renderer / template には今は手を入れない。Playwright adapter 実装時に
改ページ最適化も同時に設計する。

#### 利点
- 本フェーズに新たな実装を持ち込まない
- PDF adapter のテストで実物の改ページ挙動を検証しながら CSS を調整できる

#### 欠点
- それまでの間、ユーザーがブラウザ印刷で出力した PDF はプロジェクト entry が
  途中で切れる状態のまま
- 計画書では PDF 本実装は「今フェーズの対象外」と明記。先送りは無期限化する
  リスクがある

### 方針 C: 何もしない

#### 利点
- ゼロコスト

#### 欠点
- ユーザーがいま PDF を出すと特定 entry が途中で切れる
- 個人開発でも進路相談シーンで履歴書を印刷するユースケースは現実にある
- 「local-first MVP 」の品質目標と整合しない

---

## 5. 推奨

**方針 A (最小 CSS 修正)** を推奨する。

理由:
1. **コスト対効果が高い**: CSS literal 2 箇所の追加だけで、プロジェクト entry
   が途中で切れる最大のユーザー影響をほぼ解決する
2. **PDF 本実装フェーズの設計余地を狭めない**: HTML 構造 / template API /
   renderer の public API は無変更。PDF adapter が出てきたときに同じ CSS が
   そのまま機能するか、より細かい制御を上書きするか自由に選べる
3. **失敗時のロールバック容易**: 1 PR / 1 commit にとどめれば revert が
   easy

### 推奨ブランチ

`feat/renderer-page-break-css`

### 推奨スコープ

- `packages/renderer/src/templates/rirekisho-basic.ts` の CSS literal に
  break 制御を追加
- `packages/renderer/src/templates/shokumukeirekisho-basic.ts` も同様
- 既存の template snapshot / unit test に CSS の regex assert を 1〜2 行
  追加 (構造的依存を捕捉)
- HTML 構造 / renderer API 表面 / core schema / storage / pdf adapter は
  すべて触らない
- 計画書の必須制約 (Branch 1〜6 と同じ): packages の touch 範囲は CSS literal
  のみに限定し、HTML 出力に diff が出る変更が必要になった時点で実装を止めて
  別ブランチで再計画する

### スキップする範囲

- PDF 本実装 (Playwright adapter の renderPdf 実装)
- A4 以外のページサイズ
- 印刷向け font subsetting
- footer / header / ページ番号
- 1 entry が 1 ページに収まらない巨大ケースの HTML 分割

これらは PDF 本実装フェーズの責務とする。

---

## 6. 観測方法 (実装する場合の検証手順)

CSS 修正の効果は以下で確認する。

1. `pnpm --filter @jcd-editor/local-web dev` で dev server 起動
2. ブラウザで sample fixture をベースに、各 section に entries を追加して
   profile を肥大化させる (workExperiences x 5 / educationHistory x 4 /
   skills x 10 / certifications x 5 / projects x 5)。各 project には
   responsibilities / achievements / technologies を 3〜5 件ずつ入れる
3. preview iframe を右クリック → 「印刷プレビュー」(Chrome の場合)
4. 「PDF として保存」で出力した PDF を開き、改ページ位置を確認する
5. 修正前後で次を比較:
   - プロジェクト entry の途中改ページが消えるか
   - section heading (`<h2>`) がページ末尾に取り残されないか
   - 履歴書テーブルの `<thead>` が 2 ページ目以降に再表示されるか
6. unit test では CSS 文字列に対する regex assert で構造的依存を捕捉する
   (例: `expect(css).toMatch(/break-inside:\s*avoid/);`)

---

## 7. 本調査では実施しなかったこと

- Playwright adapter 経由の実 PDF レンダリング (PDF 本実装フェーズ対象)
- 1 entry が 1 ページに収まらないケースの HTML 分割
- chrome-devtools-mcp などのブラウザ自動化による screenshot 比較
  (静的な構造分析で改善点は十分特定できたため省略)
- 印刷時の font / color / margin 調整

これらは本調査の射程外であり、CSS 修正実装時の手動 QA、または PDF 本実装
フェーズで扱う。

---

## 8. まとめ

| 項目 | 結論 |
|---|---|
| 現状 | renderer に break 制御 CSS なし、プロジェクト / 職務経歴 entry が途中改ページする可能性が高い |
| 推奨 | 方針 A: 最小 CSS 修正 (1 ブランチ / 数時間) |
| 推奨ブランチ名 | `feat/renderer-page-break-css` |
| HTML 構造 | 変更不要 |
| renderer / template API | 変更不要 |
| core / storage / pdf adapter | 変更不要 |
| 先送り対象 | PDF 本実装、巨大 entry の HTML 分割、印刷向け font / margin 調整 |

本 PR (調査ブランチ) では実装は行わない。次の意思決定 = 方針 A を実施する
別 PR を立てるかどうかは、ユーザー判断に委ねる。
