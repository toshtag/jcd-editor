# ロードマップ

本ロードマップは意図的に粗く保ちます。各フェーズは独自のブランチ・独自のプラン・独自の未確定論点を持ちます。フェーズに対して期日は約束しません。これはあくまでスコープが拡散しないようにするためのものです。

フェーズはブランチのプランに完了基準が記載され、`main` にマージされた時点で終了とします。複数フェーズの並行進行は境界が綺麗な場合に限り許容しますが、ほとんどのフェーズは逐次進行します。

## Phase 0 — リポジトリ整備とドキュメント整備

コードを書く前に、思想的基盤・アーキテクチャ境界・プライバシー方針を確立します。

**成果物:** `.gitignore`、`LICENSE` (MIT)、`README.md`、本ロードマップ、`docs/CONCEPT.md`、`docs/ARCHITECTURE.md`、`docs/BRANCHING.md`、`docs/PRIVACY.md`、`docs/adr/0001-local-first.md`、`docs/adr/0002-framework-independent-core.md`、`packages/` および `apps/local-web/` 配下のプレースホルダーディレクトリ。

**Phase 0 では行わないこと:** `tsconfig.json`、`package.json`、TypeScript の足回り、いかなるコードも書きません。

## Phase 1 — Core キャリアデータモデル (完了)

`CareerProfile` とその値オブジェクトを Vanilla TypeScript で定義します。Core は UI フレームワーク / DOM / ストレージ実装 / PDF 実装 / AI 実装に依存してはなりません。

**ステータス: 完了。`CareerProfile` の全ドメインモデル (basics / workExperiences / educationHistory / skills / certifications / projects / basics.profilePhoto) と Phase 1 完了後の負債整理 (`refactor/core-shared-text-validators`) が main にマージ済み。**

### 完了済み

- `feat/core-schema` (PR #3): `CareerProfile` foundations、`schemaVersion`、値オブジェクト (`PersonName`, `PersonKana`, `IsoDateString`, `IsoYearMonthString`, `EmailAddress`, `PhoneNumber`, `PostalAddress`)、parse / safeParse、ISO 8601 検証、ADR 0003 / 0004 を導入
- `feat/core-work-experience` (PR #5): `WorkExperience` ドメインモデルと `WorkPeriod` (`startDate` / `endDate` / `isCurrent`)、`CareerProfile.workExperiences` を追加。`companyName` 等は optional (draft tolerance)、`isCurrent` は明示フィールド
- `feat/core-education` (PR #6): `Education` ドメインモデルと `CareerProfile.educationHistory` を追加。`institutionName` / `faculty` / `department` / `degree` / `startDate` / `endDate` / `status` / `description` を持つ。`WorkPeriod` は再利用せず、Education 専用の日付フィールドを inline で持つ。在学中等の状態は free string の `status` で表現 (`isCurrent` 不採用)
- `feat/core-skills-and-certifications` (PR #7): `Skill` と `Certification` ドメインモデル、`CareerProfile.skills` / `CareerProfile.certifications` を追加。`Skill` は技術に限定せず category / level / description で表現。`Certification` は IsoYearMonthString の `acquiredDate` / `expirationDate` を持ち、`credentialUrl` は plain string + 最大長で保持。`yearsOfExperience` および URL value object は採用しない
- `feat/core-projects` (PR #8): `Project` ドメインモデルと `CareerProfile.projects` を追加。`Project` は業務・副業・個人開発・OSS・ボランティア等を含みうるプロジェクト型の経験を表し、WorkExperience とは独立して保持する (top-level 配列、ID 参照なし)。`organizationName` で context を保持、`isCurrent` 採用 (binary 状態)、`technologies` は Skill と無関係な `string[]`。`teamSize` および ID 参照は採用しない
- `feat/core-profile-photo` (PR #9): `ProfilePhoto` / `ProfilePhotoSource` / `ProfilePhotoMediaType` 型と `CareerProfile.basics.profilePhoto` を追加。`source` は `dataUri` または `relativePath` の discriminated union。絶対パス / Windows root / UNC / `file://` / 外部 URL / parent traversal はすべて reject (privacy / local-first)。汎用 `Attachment[]` システムは導入しない

### 未確定論点の現状

- **`schemaVersion`**: v1 の表現は数値リテラル `1` で確定。migration strategy 全体は依然未確定であり、`schemaVersion` が上がるタイミング (`feat/core-migration-v1-to-v2` 等) で設計する
- **日付内部表現**: ISO 8601 で確定 ([ADR 0003](adr/0003-isodate-internal-representation.md))。和暦変換は core 不採用
- **日本語固有フィールド (フリガナ)**: 全角カタカナ + 小書きカナ + 長音符 + 中点 + 全角スペースを許容、空白のみ/中点のみは reject で確定
- **証明写真**: 未着手 (`feat/core-attachments` で対応予定)
- **ポート配置**: 暫定方針 (`packages/core/src/application/`)。最初の port を入れる PR で ADR 0005 として正式決定

### Phase 1 完了後の負債整理

- `refactor/core-shared-text-validators` (PR #10): `nonBlankText` / `isNonBlank` の 6 モジュール重複を `packages/core/src/domain/_internal/text-validation.ts` に抽出。`createNonBlankTextSchema(maxLength, label)` と `isNonBlankText(value)` の 2 つを internal helper として提供する。behavior preservation を厳守 (公開 API・ドメイン型・エラーメッセージ・テスト挙動はすべて不変)

期間表現 (WorkPeriod / Education / Project / Certification の date 系) の共通化は引き続き検討候補。Phase 2 (renderer) で domain model を扱う頻度が増えた時点で再評価する。

### `feat/core-validation` 単独 PR は不要

Foundation validation は PR #3 でカバー済みです。template / export 固有の strict validation は Phase 2 以降に延期します (具体テンプレートが存在しないと仕様化できないため)。詳細は [docs/VALIDATION.md](VALIDATION.md) を参照。

## Phase 2 — HTML/CSS テンプレートレンダラー (進行中)

検証済みの `CareerProfile` を `RenderedDocument` (HTML / CSS / メタデータ) に変換します。テンプレートは `packages/templates/` に置き、プレーンな HTML + CSS + `manifest.json` で構成し、React / Vue / Svelte のランタイムを必要としてはなりません。

### 完了済み

- `feat/renderer-foundation` (PR #11): renderer パッケージの境界と出力契約 (`RenderedDocument` / `DocumentKind` / `RenderedDocumentMetadata`) を確立。internal helper として `escapeHtml` を追加 (公開しない)
- `feat/renderer-template-registry` (PR #13): template contract (`RenderInput` / `TemplateId` / `TemplateRenderer` / `TemplateDefinition` / `TemplateRegistry`) + `createTemplateRegistry` / `renderDocument` + `RendererError` を最小構成で確立 (fake template で挙動を検証)
- `feat/renderer-rirekisho-template` (PR #14): 最初の built-in テンプレート `rirekishoBasicTemplate` (id `rirekisho-basic` / 名前『履歴書（基本）』) を `packages/renderer/src/templates/` に追加
- `feat/renderer-shokumukeirekisho-template` (PR #15): 2 個目の built-in テンプレート `shokumukeirekishoBasicTemplate` (id `shokumukeirekisho-basic` / 名前『職務経歴書（基本）』) を追加。重複 format helper を `_internal/template-format.ts` に抽出 (`rirekishoBasicTemplate` の挙動は完全保持)
- `feat/renderer-builtin-templates-bundle` (PR #16): built-in テンプレートを束ねる公開 API として `builtinTemplates: readonly TemplateDefinition[]` (Object.freeze で shallow freeze、append-only semantics) と `createDefaultTemplateRegistry(): TemplateRegistry` (createTemplateRegistry の薄い wrapper) を追加
- `feat/renderer-rirekisho-chronological-table` (PR #17): `rirekishoBasicTemplate` の学歴 / 職歴を年表テーブル形式に in-place で書き換え。2 列構造 (年月 / 内容)、入力順保持、`現在に至る` は aggregate で 1 行

### 進行中 / 直近マージ予定

- `feat/renderer-rirekisho-photo`: `rirekishoBasicTemplate` に dataUri 限定で profilePhoto 描画を in-place 追加 (`<img>` の src / alt は escapeHtml 経由で double-quoted attribute、header に flex layout の photo container 追加)。relativePath は本 PR では一切 render しない (asset resolution / URL policy 未確定のため別 PR)。`templateId` / 公開 API / `builtinTemplates` / `createDefaultTemplateRegistry` / `shokumukeirekisho-basic` はすべて無変更

### 次 PR 候補

- `feat/renderer-relativepath-asset-resolution`: `RenderInput` に asset resolver port を追加し、`profilePhoto.source.kind === 'relativePath'` を解決できるようにする (privacy / scheme allowlist を含む URL policy 設計を含む)
- `feat/renderer-html-renderer`: template-agnostic な HTML 生成ヘルパー (見出し / リスト / 表) の追加抽出 (3 個目の template で更なる重複が見えた時点で着手)

どの PR を先にやるかは `feat/renderer-rirekisho-photo` マージ後に別途決定します。

### 未確定論点

- 共通 CSS の方針 (現在 rirekisho / shokumukeirekisho 共に独立 CSS、3 個目の template で共通化を再評価)
- テンプレート `manifest.json` のスキーマ (`packages/templates` を立てるタイミングと併せて議論)
- テンプレートの検証戦略 (Core スキーマとの整合、template-specific export readiness)
- `packages/templates` を導入するタイミング (現在 2 個の built-in が `packages/renderer/src/templates/` 内に住む、3 個目以降で moving を再検討)
- URL policy (`credentialUrl` の `<a href>` 化、scheme allowlist) — 別 PR で扱う
- 和暦変換 — 必要になれば別 PR で table-based variant として追加
- core import policy: 既存 `rirekisho-basic.ts` の direct core import を indexed access types に揃えるか (本 PR で `ProfilePhoto` は indexed access に切り替え済み、残り CareerProfile / Certification 等の整理は別 clean-up PR で)
- `builtinTemplates` の deep freeze (template 本体の field 書き換えを防ぐか) — 必要になれば別 PR で対応
- `createDefaultTemplateRegistry` の caching (現状無キャッシュで毎回新規インスタンス、有用な利用パターンが見えた時点で再評価)
- rirekisho 年表の 3 列化 (`年 / 月 / 事項` の JIS 風) — 別 PR (`feat/renderer-rirekisho-jis-table` 等) で年・月分割の helper 設計を含めて議論
- テンプレート出力の後方互換性 / versioning policy: 現在は Phase 2 改善フェーズで in-place 変更を許容、出力安定性を固定する段階で新規 templateId / versioning / migration policy を検討
- `profilePhoto.source.kind === 'relativePath'` の render を担う **asset resolution 設計** (`feat/renderer-relativepath-asset-resolution` で `RenderInput` に asset resolver port を追加する形を検討)
- `shokumukeirekisho` に将来 photo を追加するかどうか (現状は伝統的に入れない、要件が出れば別 PR で議論)

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
