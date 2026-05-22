# local-web accessibility 監査 (2026-05 時点)

ROADMAP の「次に着手するもの」リストにあった `accessibility audit` の作業記録。

## 目的と射程

apps/local-web の form / validation summary / save-load / 写真入力 / 削除 / import-export の各 UI について、現状の accessibility 対応を棚卸しし、低コストで明確な改善余地に絞って一次対応する。

**意図的に射程外** (本 PR では対応せず、必要になった時点で別 PR):
- WCAG color contrast の数値監査 (Lighthouse / axe を CI に組み込むまで先送り)
- NVDA / JAWS / VoiceOver での実 SR テスト (人手)
- input ごとの `aria-invalid` / `aria-describedby` 連携 (現状は validation-summary が主動線として機能、追加すると state 管理が増える)

## 現状の強み (一次対応で触らない、既に良い)

- `<html lang="ja">` で言語が明示されている
- すべての form input に `<label for=...>` で association が貼られている
- すべての button が `<button type="button">` (form submit を意図しない)
- heading 階層が h1 → h2 → h3 で skip なし
- `role="status"` `aria-live="polite"` が status / dirty-indicator / validation-summary / profile-photo-error に付いている
- 各 `<section>` に `aria-label` が付いている (基本情報フォーム / 職務経歴 / 学歴 / スキル / 資格 / プロジェクト / プレビュー)
- preview iframe に `title="ドキュメントプレビュー"` と `sandbox=""`
- 写真 file input は visible label でラップされており、accept で対応形式を絞っている
- validation-summary の jump button (PR #46) で error → 該当 section への動線が確保されている

## 改善ポイントと本 PR の対応

### A. 本 PR で対応する (低コスト・高インパクト)

#### A-1. `error-area` に `role="alert"` を付ける

現状: render エラー / storage エラー / import エラーを表示する `<pre id="error-area">` に role がない。これらは "polite" ではなく **即時通知すべきエラー** だが、announce されない。

対応: `role="alert"` を追加 (assertive 相当、自動的に `aria-live="assertive"` `aria-atomic="true"` 扱い)。

#### A-2. 装飾の `profile-photo-placeholder` に `aria-hidden="true"`

現状: 写真未選択時に表示する「証明写真」placeholder span は、隣接の hint や section ラベルで context が既に与えられているため SR には重複情報。

対応: `aria-hidden="true"` を追加。

#### A-3. 写真選択 label の `:focus-visible` 視覚 indicator

現状: 写真 file input は `display: none` で隠れているため、Tab で focus が当たるのは label。しかし label には `:focus-visible` style がなく、キーボードユーザーは focus 位置が見えない。

対応: `.profile-photo__select-label:focus-visible` で `outline` を追加。同じ問題が `.app__io-import` (JSON インポート label) にもあるので両方対応する。

#### A-4. skip link (skip to preview / skip to form)

現状: form が 6 section + 写真と長く、キーボードユーザーが preview に到達するには Tab を多数回押す必要がある。

対応: `<body>` 直下に visually-hidden な `<a href="#preview-frame">プレビューにスキップ</a>` を追加。`:focus` で見えるようにする。

#### A-5. entry section の `aria-labelledby`

現状: 各 entry (`work-experience-item` / `education-item` / `skill-item` / `certification-item` / `project-item`) は `<section data-index="N">` で h3 を内包する。SR は implicit に h3 を section の名前として announce することが多いが、すべての SR / version で安定するわけではない。

対応: factory で h3 に動的 id を付与して section に `aria-labelledby` で参照させる方向で当初検討したが、renumber (削除後の index 詰め) 時の id 同期コストを避けるため **`aria-label` 直接設定** に変更した。各 form factory に `xxxItemAriaLabel(index)` helper を追加し、section に `aria-label="職歴 1"` のように index 連動の文字列を直接持たせる方式。

→ **PR #48 で対応済み**。本 PR (一次対応) の射程外。

### B. 本 PR で対応する (focus 管理)

主要操作のあとに focus を妥当な位置に戻す。

#### B-1. 削除成功後

現状: delete-button を押した直後、profile-select の選択が空に戻り、delete-button が disabled になる。focus は disabled になった delete-button に残り、Tab で次の要素まで進む必要がある。

対応: 削除成功後に focus を `saved-profile-select` に移す。次に何かする (別 profile を選ぶ / form を編集) ことが多いため。

#### B-2. 読み込み成功後

現状: load-button click 後、form に内容が反映されるが focus は load-button のまま。ユーザーは多くの場合 form を編集したい。

対応: 読み込み成功後に form の最初の input (`name-family`) に focus。

#### B-3. import 成功後

現状: import file 選択後の処理は async で進み、completion 時に focus はファイル選択ダイアログから戻ったブラウザ既定位置にある (環境依存)。

対応: import 成功後に form の最初の input (`name-family`) に focus。

#### B-4. 写真選択 / 削除後

- 写真 **選択成功** 後: 削除ボタンに focus を移す (次にユーザーがしたいのは「気に入らなければ削除」)
- 写真 **削除** 後: 選択 label に focus を戻す (次にしたいのは「別の写真を選ぶ」)

ただし label に直接 focus する API はないため、内部の file input または label 自体に `tabindex="-1"` + `.focus()` の組み合わせで対応する。

#### B-5. save 成功後

現状: save 後は currentProfileId が更新され、save ボタンは valid のままなら enabled。focus を移動する必要は薄い。

→ **本 PR では変更しない** (save は同じ場所で繰り返したい操作のため)。

### C. 一次対応 PR (#47) の後に別 PR で対応した項目

audit doc 作成時は別 PR としていたが、後続で次の通り完了している:

- ✅ **各 entry section の `aria-label`** (PR #48): aria-labelledby ではなく aria-label を採用 (renumber 時の id 同期コストを避ける判断)
- ✅ **`aria-invalid="true"` を validation エラーを持つ input に付ける** (PR #49)
- ✅ **`aria-describedby` で input と該当 summary item を連結する** (PR #50)
- ✅ **input 直下に inline error message を表示する** (PR #51): sighted user / 低視力ユーザーが該当 input のすぐ下で error を視認できる
- ✅ **`<input type="file">` の visually-hidden パターン化** (PR #53): `display: none` だと keyboard focus が機能しないため
- ✅ **axe-core を CI で自動検出する** (PR #52): 上記の regression を防ぐ

### D. 引き続き本 PR / 後続 PR でも対応しないもの

- color contrast の WCAG 数値監査 (Lighthouse / Playwright での実描画が必要、jsdom + axe では検査不能)
- 実 SR (NVDA / JAWS / VoiceOver / TalkBack) でのテスト (人手)
- focus trap (modal がそもそも無い、`window.confirm` は browser ネイティブのため考慮不要)
- 高コントラストモード / dark mode 対応 (UI 全体の design system を持つタイミングで)
- 各種 SR (NVDA / JAWS / VoiceOver / TalkBack) での実テスト (人手)

## 観測方法 (将来の CI 化候補)

本 PR 時点では手動 + コード読みベースの audit。今後 CI で自動化する場合の候補:

- `axe-core` を vitest test に組み込む (各 importMain 後に `axe.run(document)` を呼ぶ)
- Playwright 経由で Lighthouse Accessibility score を測る (CI 時間と複雑性の trade-off)
- chrome-devtools-mcp / Playwright で実 browser 起動の手動 QA

これらは本 PR の射程外で、必要になった時点で別 PR で計画する。

## 変更前後の比較 (実測値ではなく構造的変化)

| 項目 | Before | After |
|------|--------|-------|
| error-area の SR announce | なし (role 未設定) | 即時 announce (role="alert") |
| 写真 placeholder の SR | 重複読み上げ | aria-hidden で除外 |
| 写真 / import label の keyboard focus 視認性 | なし | `:focus-visible` で outline |
| 長い form の preview への到達 | Tab 数十回 | skip link で 1 hop |
| 削除成功後 focus | 直前の disabled button | profile-select |
| 読み込み成功後 focus | load-button | name-family |
| import 成功後 focus | 環境依存 | name-family |
| 写真選択後 focus | file input ダイアログから戻った位置 | 削除ボタン |
| 写真削除後 focus | 削除 (disabled) ボタン | 選択 label |

## 関連ドキュメント

- [docs/PRIVACY.md](../PRIVACY.md) — 個人情報の取り扱い
- [docs/data-format.md](../data-format.md) — JSON 形式仕様
- [docs/investigations/preview-pagination.md](preview-pagination.md) — 既存の調査 (改ページ)
