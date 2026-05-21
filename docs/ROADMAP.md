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

残課題:

- `relativePath` 写真の asset resolution と URL policy
- template-specific export readiness validation
- テンプレート資産を `packages/templates` に分離するかどうかの判断
- テンプレート出力の versioning policy
- 和暦表示など、日本式書類としての表現強化

## Phase 3 — ローカル保存

**状態:** 進行中

`StoragePort` とローカル保存アダプタを提供します。保存対象は core parse 済みの `CareerProfile` です。

実装済み:

- `StoragePort`
- `StorageError`
- IndexedDB adapter
- 保存済み profile の save / load / list / delete
- 保存済みデータの load 時 validation
- 一覧表示向け metadata store

残課題:

- schema migration / corrupt data recovery policy
- quota / locked / generic storage failure の error code 設計
- multi-tab consistency
- autosave / draft storage の扱い
- Node fs adapter
- 暗号化や compression の要否判断

## Phase 4 — 最小 local-web UI

**状態:** 進行中

バックエンドなしでローカル実行できるブラウザ UI を提供します。左側で構造化入力、右側で HTML プレビューを表示します。

実装済み:

- Vite + Vanilla TypeScript の最小 UI
- basics 編集
- work experiences 編集
- renderer 経由の live preview
- IndexedDB 経由の manual save / load
- invalid draft 時の preview 保持
- `@jcd-editor/pdf` を browser bundle に含めない境界

残課題:

- education / skills / certifications / projects の編集 UI
- new / delete / rename / duplicate
- dirty state / autosave
- A4 preview sizing
- DOM 結合テストまたは e2e テスト
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

**状態:** 未着手

ユーザーが自分のデータを持ち出せるようにします。

予定:

- JSON export / import
- Markdown export
- HTML export
- PDF export

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
