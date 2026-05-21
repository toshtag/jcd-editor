# ロードマップ

本ロードマップは、jcd-editor の公開スコープと現在地を示すためのものです。詳細な作業ブランチ、PR 番号、CI 手順、実装メモはここには置きません。公開ドキュメントは「何を作るか」「何をまだ作っていないか」「どの原則を守るか」に集中させます。

フェーズには期日を置きません。各フェーズは、local-first、framework-independent core、外部 AI / Cloud / SaaS optional という原則を壊さない範囲で進めます。

## Phase 0 — リポジトリと方針の整備

**状態:** 完了

思想的基盤、アーキテクチャ境界、プライバシー方針、ブランチ運用、ADR の初期セットを整備します。

主な成果物:

- `.gitignore`
- `LICENSE`
- `README.md`
- `docs/CONCEPT.md`
- `docs/ARCHITECTURE.md`
- `docs/BRANCHING.md`
- `docs/PRIVACY.md`
- 初期 ADR

## Phase 1 — Core キャリアデータモデル

**状態:** 完了

`CareerProfile` と値オブジェクトを Vanilla TypeScript で定義します。Core は UI、DOM、Storage、PDF、AI、特定 UI フレームワークに依存しません。

実装済みの主な領域:

- 基本情報
- 職歴
- 学歴
- スキル
- 資格
- プロジェクト
- 証明写真の参照表現
- foundation parse / validation

未確定または将来対応:

- schema migration policy
- 期間表現の共通化
- value-object 単体 parse helper

## Phase 2 — HTML/CSS レンダラー

**状態:** 進行中

検証済みの `CareerProfile` を `RenderedDocument` に変換します。renderer は HTML / CSS / メタデータを生成し、PDF は生成しません。

実装済み:

- renderer の公開 API と template registry
- 履歴書の基本テンプレート
- 職務経歴書の基本テンプレート
- built-in template bundle
- HTML escape と user data の安全な埋め込み
- 履歴書テンプレートでの data URI 証明写真描画
- 印刷時の改ページ制御 CSS (h2 widow / li / table tr / thead 再表示)

残課題:

- `relativePath` 写真の asset resolution と URL policy
- template-specific export readiness validation
- テンプレート資産を `packages/templates` に分離するかどうかの判断
- テンプレート出力の versioning policy
- 和暦表示など、日本式書類としての表現強化
- 1 entry が 1 ページに収まらない巨大ケースの HTML 分割

## Phase 3 — ローカル保存

**状態:** 進行中

`StoragePort` とローカル保存アダプタを提供します。保存対象は core parse 済みの `CareerProfile` です。

実装済み:

- `StoragePort`
- `StorageError` (`PROFILE_NOT_FOUND` / `PROFILE_CORRUPT`)
- IndexedDB adapter (DB v2、metadata store 分離)
- 保存済み profile の save / load / list / delete
- 保存済みデータの load 時 validation (corrupt 時は `PROFILE_CORRUPT` で明示)
- 一覧表示向け metadata store (body を展開しない最適化)

残課題:

- 本格的な schema migration policy (v2 が必要になった時点で着手)
- quota / locked / generic storage failure の error code 設計
- multi-tab consistency
- autosave / draft storage の扱い
- Node fs adapter
- 暗号化や compression の要否判断

## Phase 4 — local-web UI

**状態:** 進行中 (全 section 編集 + JSON I/O + 削除 UI まで完了)

バックエンドなしでローカル実行できるブラウザ UI を提供します。左側で構造化入力、右側で HTML プレビューを表示します。

実装済み:

- Vite + Vanilla TypeScript の UI
- basics / work experiences / education / skills / certifications / projects の編集
- renderer 経由の live preview (履歴書 / 職務経歴書 切替)
- IndexedDB 経由の manual save / load
- 保存済み profile の削除 UI (confirm 必須 / undo なし)
- JSON export / import (`safeParseCareerProfile` で検証、上書き confirm 必須)
- invalid draft 時の preview 保持
- DOM 結合テスト (round-trip / sample fixture 残留防止 / 削除フロー / JSON I/O)
- `@jcd-editor/pdf` を browser bundle に含めない境界

残課題:

- dirty state / autosave
- 未保存変更がある状態での load / delete / reload 時の confirm
- 写真入力 (data URI 化、サイズ上限、MIME type 限定)
- new / rename / duplicate
- A4 preview sizing
- validation issues の section 単位での集約表示
- section 単位の navigation
- accessibility audit (aria 属性、キーボード操作、focus 管理)
- PDF export UI

## Phase 5 — ローカル PDF 生成

**状態:** 基盤実装済み、UI 統合未実装

`RenderedDocument` を完全ローカルで PDF 化します。外部サービスへキャリア情報を送信しません。

実装済み:

- `PdfPort`
- Playwright adapter
- JavaScript 無効化
- `data:` / `about:` 以外の request blocking
- `<base>` を含めない HTML 生成

残課題:

- local-web / desktop / CLI からの呼び出し設計
- 日本語フォントと印刷互換性の検証
- PDF options
- browser lifecycle / pooling の判断
- page count 取得の要否

## Phase 6 — インポート / エクスポート

**状態:** 部分実装済み (JSON のみ完了)

ユーザーが自分のデータを持ち出せるようにします。

実装済み:

- JSON export (現在 draft profile を対象、`safeParseCareerProfile` validation 必須)
- JSON import (`safeParseCareerProfile` validation 必須、上書き confirm 必須、import 後は既存 `saveProfile` で永続化)

残課題:

- Markdown export
- HTML export
- PDF export (Phase 5 と連動、まずは CLI 経由を想定)
- JSON export schema の公開ドキュメント化

## Phase 7 — Optional AI アダプタ

**状態:** 未着手

AI は中核ではなく補助機能です。導入する場合も optional adapter として扱い、デフォルト無効にします。

必須条件:

- 明示的な opt-in
- 送信先と送信内容の提示
- 既定では選択範囲のみ送信
- 全文送信には明示確認
- ローカルモデルへの切り替え可能性

## Phase 8 — Optional デスクトップアプリ

**状態:** 未着手

既存の local-web 体験をデスクトップアプリとして提供する可能性を検討します。Core と renderer を特定デスクトップ技術に結びつけません。

## Phase 9 — Optional クラウド同期 / SaaS

**状態:** 未着手

クラウド同期や SaaS 派生は optional です。ローカル単独利用を前提条件として維持し、その上に opt-in で重ねる設計にします。

---

## 次の優先事項 (MVP 実用品質固定)

Phase 4 (local-web UI) と Phase 5 (PDF) の間を埋める、MVP の信頼性・実用性を上げるための具体的な次ステップです。Phase 区切りに沿って整理した上記とは別に、直近の実装順序を明示します。

### 直近で着手するもの (順序固定)

1. **dirty state** — 未保存変更の追跡と、load / delete / reload / import 前の confirm。section が増えたことで「未保存編集の喪失」リスクが顕在化したため、PDF / 写真 / template 切替の前に固める
2. **profile photo input** — 日本式履歴書において写真は構造的に必須レベル。renderer 側で data URI 対応は既にあるため、local-web 側で input + size limit + MIME type 限定を実装する。写真は個人情報として UI / docs に明記
3. **CLI PDF** — JSON file → `safeParseCareerProfile` → renderer → Playwright PDF。local-web に PDF ボタンを生やすより先に CLI 経由で出力できる導線を作る。short / long / 写真あり fixture で最低限 QA を含める

### QA / 実データ運用後に判断するもの

実際に手動 QA や実データでの利用を経てから着手判断するもの。先に設計しない。

- validation issues の section 単位での集約表示と該当 section への jump
- section 単位の form navigation
- accessibility audit (aria, keyboard, focus)
- error message の user-facing 化 (dot path から日本語表記へ)
- JSON export schema の公開ドキュメント化

### 当面着手しないもの

- 本格的な schema migration (v2 が必要になるまで)
- 配布チャネル (GitHub Pages / static build / Electron / Tauri) — 機能 MVP とは別軸
- AI 連携、SaaS、認証、クラウド同期
- DOCX / XLSX 出力
- Western CV 対応
