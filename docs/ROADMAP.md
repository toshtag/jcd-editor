# ロードマップ

本ロードマップは意図的に粗く保ちます。各フェーズは独自のブランチ・独自のプラン・独自の未確定論点を持ちます。フェーズに対して期日は約束しません。これはあくまでスコープが拡散しないようにするためのものです。

フェーズはブランチのプランに完了基準が記載され、`main` にマージされた時点で終了とします。複数フェーズの並行進行は境界が綺麗な場合に限り許容しますが、ほとんどのフェーズは逐次進行します。

## Phase 0 — リポジトリ整備とドキュメント整備

コードを書く前に、思想的基盤・アーキテクチャ境界・プライバシー方針を確立します。

**成果物:** `.gitignore`、`LICENSE` (MIT)、`README.md`、本ロードマップ、`docs/CONCEPT.md`、`docs/ARCHITECTURE.md`、`docs/BRANCHING.md`、`docs/PRIVACY.md`、`docs/adr/0001-local-first.md`、`docs/adr/0002-framework-independent-core.md`、`packages/` および `apps/local-web/` 配下のプレースホルダーディレクトリ。

**Phase 0 では行わないこと:** `tsconfig.json`、`package.json`、TypeScript の足回り、いかなるコードも書きません。

## Phase 1 — Core キャリアデータモデル (進行中)

`CareerProfile` とその値オブジェクトを Vanilla TypeScript で定義します。Core は UI フレームワーク / DOM / ストレージ実装 / PDF 実装 / AI 実装に依存してはなりません。

**ステータス: foundations は PR #3 で完了。残りの増分は後続 PR で順次追加。**

### 完了済み

- `feat/core-schema` (PR #3): `CareerProfile` foundations、`schemaVersion`、値オブジェクト (`PersonName`, `PersonKana`, `IsoDateString`, `IsoYearMonthString`, `EmailAddress`, `PhoneNumber`, `PostalAddress`)、parse / safeParse、ISO 8601 検証、ADR 0003 / 0004 を導入
- `feat/core-work-experience` (PR #5): `WorkExperience` ドメインモデルと `WorkPeriod` (`startDate` / `endDate` / `isCurrent`)、`CareerProfile.workExperiences` を追加。`companyName` 等は optional (draft tolerance)、`isCurrent` は明示フィールド
- `feat/core-education` (PR #6): `Education` ドメインモデルと `CareerProfile.educationHistory` を追加。`institutionName` / `faculty` / `department` / `degree` / `startDate` / `endDate` / `status` / `description` を持つ。`WorkPeriod` は再利用せず、Education 専用の日付フィールドを inline で持つ。在学中等の状態は free string の `status` で表現 (`isCurrent` 不採用)

### 未確定論点の現状

- **`schemaVersion`**: v1 の表現は数値リテラル `1` で確定。migration strategy 全体は依然未確定であり、`schemaVersion` が上がるタイミング (`feat/core-migration-v1-to-v2` 等) で設計する
- **日付内部表現**: ISO 8601 で確定 ([ADR 0003](adr/0003-isodate-internal-representation.md))。和暦変換は core 不採用
- **日本語固有フィールド (フリガナ)**: 全角カタカナ + 小書きカナ + 長音符 + 中点 + 全角スペースを許容、空白のみ/中点のみは reject で確定
- **証明写真**: 未着手 (`feat/core-attachments` で対応予定)
- **ポート配置**: 暫定方針 (`packages/core/src/application/`)。最初の port を入れる PR で ADR 0005 として正式決定

### 残りの Phase 1 増分 PR 候補

- `feat/core-skills-and-certifications` (**次の推奨**): `Skill` 列挙、`Certification` (資格名、取得日、認定団体)
- `feat/core-projects`: `Project` (プロジェクト名、期間、役割、技術スタック)
- `feat/core-attachments`: 証明写真の参照型 (data URI vs file path)

3 つ目のドメインモデル (Skill / Certification / Project のいずれか) で `nonBlankText` のような共通 text validator パターンが繰り返し必要になった場合、`domain/_internal/text-validators.ts` のような場所への抽出を別 refactor PR で検討する。同様に、期間表現が共通化できる場合は `refactor(core): extract Period value object` を検討する。

### `feat/core-validation` 単独 PR は不要

Foundation validation は PR #3 でカバー済みです。template / export 固有の strict validation は Phase 2 以降に延期します (具体テンプレートが存在しないと仕様化できないため)。詳細は [docs/VALIDATION.md](VALIDATION.md) を参照。

## Phase 2 — HTML/CSS テンプレートレンダラー

検証済みの `CareerProfile` を `RenderedDocument` (HTML / CSS / メタデータ) に変換します。テンプレートは `packages/templates/` に置き、プレーンな HTML + CSS + `manifest.json` で構成し、React / Vue / Svelte のランタイムを必要としてはなりません。

**未確定論点:**

- テンプレートのプレースホルダー構文とエスケープ規則
- 共通 CSS とテンプレート個別 CSS の方針
- テンプレート `manifest.json` のスキーマ
- テンプレートの検証戦略 (Core スキーマとの整合)

## Phase 3 — ローカルファイルストレージ

`StoragePort` と `FileStorageAdapter` を実装し、`CareerProfile` をユーザー指定ディレクトリの JSON ファイルとして永続化します。SQLite は将来候補であり、Phase 3 の対象ではありません。

## Phase 4 — 最小ローカル Web UI (A4 HTML プレビューを含む)

バックエンドなしでローカル実行できる最小限のブラウザベースエディタ。左ペイン: 構造化入力フォーム。右ペイン: `packages/renderer` を通した A4 サイズの HTML プレビュー。上部: 保存 / 読み込み / エクスポート。

**初期候補:** Vite + Vanilla TypeScript。これは不可逆な決定ではなく、UI フレームワーク選定は `chore/repo-setup` または本フェーズ着手時に再検討する余地があります。

## Phase 5 — ローカル PDF 生成

A4 HTML プレビューを完全ローカルで PDF 化します。Playwright を用いた `PdfPort` + `PlaywrightPdfAdapter` で実装します。PDF 生成は外部サービスへデータを送信してはなりません。

**未確定論点:**

- 日本語フォントの選定 (Noto Sans JP、Noto Serif JP、システムフォント) と埋め込み挙動
- 典型的な履歴書におけるファイルサイズ制約
- 印刷互換性 (余白、改ページ、写真配置)

## Phase 6 — インポート / エクスポート

ユーザーが自分のデータを持ち出せるようにします。サポートする形式:

- JSON のエクスポートとインポート (正規形式)
- Markdown エクスポート
- HTML エクスポート
- PDF エクスポート (Phase 5 経由)

## Phase 7 — Optional AI アダプタ

AI はデフォルトで無効です。将来のプロバイダ候補として Ollama (ローカル) と外部 API を想定します。アダプタは以下を満たさなければなりません。

- 明示的なユーザー opt-in を経て読み込まれる
- 送信前に送信先 (ローカル vs 外部) を提示する
- 既定では、ユーザーが選択した範囲のみを送信する
- 全文送信には明示的な確認を必須とする

## Phase 8 — Optional デスクトップアプリ

既存のローカル Web UI をデスクトップアプリにラップします。候補: Tauri (フットプリントの観点で推奨) または Electron。Core およびレンダリングパッケージへの変更を必要としてはなりません。

## Phase 9 — Optional クラウド同期 / SaaS

クラウド機能は完全に optional であり、ローカル利用の前提条件にしてはなりません。同期・マルチデバイス・ホスティング版を作る場合も、それはローカルファースト・スタックの「上に重ねる」ものであり、「前に置く」ものであってはなりません。
