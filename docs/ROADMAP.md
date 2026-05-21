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
- `feat/renderer-rirekisho-photo` (PR #18): `rirekishoBasicTemplate` に dataUri 限定で profilePhoto 描画を in-place 追加 (`<img>` の src / alt は escapeHtml 経由で double-quoted attribute、header に flex layout の photo container 追加)。relativePath は本 PR では一切 render しない (asset resolution / URL policy 未確定のため別 PR)。`templateId` / 公開 API / `builtinTemplates` / `createDefaultTemplateRegistry` / `shokumukeirekisho-basic` はすべて無変更
- `feat/renderer-html-renderer` (PR #19): output-preserving refactor。両 built-in template の重複 HTML 組み立てを `_internal/html-renderer.ts` の 4 個の helper (`renderSection` / `renderItemList` / `renderListItem` / `renderTextList`) に抽出。既存 `renderTextList` は HTML 系 helper の責務統一のため `_internal/template-format.ts` から移動。`templateId` / 公開 API / `builtinTemplates` / `createDefaultTemplateRegistry` / CSS / template 出力すべて完全無変更 (byte-for-byte 同一)

### Phase 2 残課題 (Phase 5 と並行検討)

- `feat/renderer-relativepath-asset-resolution`: `RenderInput` に asset resolver port を追加し、`profilePhoto.source.kind === 'relativePath'` を解決できるようにする (privacy / scheme allowlist を含む URL policy 設計を含む)。Phase 5 と並行で進めるか、Phase 5 完了後に着手するかは判断保留

### 未確定論点

- 共通 CSS の方針 (現在 rirekisho / shokumukeirekisho 共に独立 CSS、3 個目の template で共通化を再評価)
- `_internal/html-renderer.ts` の helper 拡張余地 (`<dl>` definition list helper / `<div class="...__detail">` wrapper helper など) — 必要性が顕在化した時点で別 PR で議論。本 PR は 4 helper (`renderSection` / `renderItemList` / `renderListItem` / `renderTextList`) に scope を絞った
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

## Phase 3 — ローカルファイルストレージ (進行中)

`StoragePort` と `FileStorageAdapter` を実装し、`CareerProfile` をユーザー指定ディレクトリの JSON ファイルとして永続化します。SQLite は将来候補であり、Phase 3 の対象ではありません。

### 完了済み

- `feat/storage-port-foundation` (PR #24): `packages/storage` に `StoragePort` / `StoredProfile` / `StoredProfileMetadata` / `SaveProfileInput` / `StoredProfileId` / `StorageError` を最小 surface で導入 (foundation only、実 adapter なし)。`StoragePort` shape は provisional、adapter PR で見直しを許容する設計だった。`storage → core` の type-only 依存。`saveProfile` 単一 method (upsert)、`listProfiles` は `updatedAt 降順`、`loadProfile` / `deleteProfile` missing は `PROFILE_NOT_FOUND` を throw。error code は `PROFILE_NOT_FOUND` 1 個のみ。in-memory fake は contract test 内に閉じる、public export しない

### 進行中 / 直近マージ予定

- `feat/storage-indexeddb-adapter` (PR #25): `packages/storage/src/adapters/indexeddb-storage-adapter.ts` に `createIndexedDbStorageAdapter` factory を追加 (browser IndexedDB 経由で `StoragePort` を満たす最初の実 adapter)。options で `databaseName` / `storeName` / `now` / `generateId` を injectable に (test deterministic + production safe defaults: `'jcd-editor'` / `'profiles'` / `new Date().toISOString()` / `crypto.randomUUID()`)。raw IDB API のみ使用、wrapper library (`idb` / `dexie`) 不採用。keyPath: `metadata.id` (nested)、index なし (listProfiles は in-memory sort)。transaction の auto-commit 回避: `saveProfile` / `deleteProfile` では `get.onsuccess` 内で `put`/`delete` を発行し `waitForTransaction(tx)` で 1 度だけ await。**`StoragePort` / `StorageError` / `StorageErrorCode` shape は完全無変更** (`PROFILE_NOT_FOUND` のみ維持、DOMException は bubble、PR #20 流儀)。DOM lib は per-package tsconfig で追加、root tsconfig から `packages/storage/**` を `exclude` (PR #22 流儀)。CI に `Typecheck storage package` step を 1 つ追加。`fake-indexeddb` を devDep として追加、`fake-indexeddb/auto` で global IDB を populate。**`apps/local-web` への統合は本 PR で扱わない** (save / load UI は別 PR `feat/local-web-save-load-profile`)

### 次 PR 候補

- `feat/local-web-save-load-profile`: app から `@jcd-editor/storage` を呼ぶ bridge (Phase 4 と並行マージ可)
- `feat/storage-filesystem-adapter`: Node fs adapter (Tauri / CLI から使う想定、`StoragePort` を満たす 2 個目の実 adapter)

### 未確定論点

- 複数 profile vs 単一 profile の UI 統合戦略
- profile の rename / metadata 編集 UI
- migration / versioning policy (`schemaVersion` が変わった時の挙動、database version 1 → 2 upgrade strategy 含む)
- 暗号化 / compression の判断 (Phase 7 AI 統合時の機密性と関連)
- draft (invalid 入力) の autosave を別 port (`DraftStorage`) として扱うか、本 port に統合するか
- port options 型の追加判断 (encryption key / namespace 等)
- `StorageErrorCode` の追加 (`SCHEMA_VERSION_MISMATCH` / `STORAGE_QUOTA_EXCEEDED` / `STORAGE_LOCKED` / `STORAGE_OPERATION_FAILED` 等) — adapter UX 問題が顕在化した段階で決定
- `cause` field の追加判断 — adapter で例外 wrap が必要になれば追加
- `StoredProfileId` の brand 化 (現在 plain string)
- `listProfiles` の order 契約 (現在 `updatedAt 降順` を in-memory sort、>1000 profile 時に IndexedDB index + cursor 最適化を検討)
- corrupt stored data の検知 / 回復 (現状未実装、adapter が trust する設計)
- multi-tab consistency / BroadcastChannel (autosave PR で検討)
- adapter の `close()` / `dispose()` method 追加 (現在 closure で lazy open、明示 close なし)
- `listProfiles` の order 契約 (現在 `updatedAt 降順`) — real adapter で守れない場合に緩めるか
- `StoredProfileId` の brand 化 (現在 plain string)

## Phase 4 — 最小ローカル Web UI (進行中)

バックエンドなしでローカル実行できる最小限のブラウザベースエディタ。左ペイン: 構造化入力フォーム。右ペイン: `packages/renderer` を通した A4 サイズの HTML プレビュー。上部: 保存 / 読み込み / エクスポート。

**stack:** Vite + Vanilla TypeScript (skeleton PR で確定)。

### 完了済み

- `feat/local-web-skeleton` (PR #22): `apps/local-web` に Vite + Vanilla TS の最小 skeleton を立て、`safeParseCareerProfile` → `renderDocument` → iframe `srcdoc` (`sandbox=""`) で A4 preview を表示。履歴書 / 職務経歴書 の kind switcher。**`@jcd-editor/pdf` は import しない** (Playwright は browser bundle に入らない)。React/Vue/Svelte/UI ライブラリ/state ライブラリ/router 一切なし。編集 / 保存 / PDF export なし。root `tsconfig.json` の `include` から `apps/*` を除外し、app は per-app tsconfig (DOM lib + `vite/client` types) + CI の app typecheck step で覆う

### 進行中 / 直近マージ予定

- `feat/local-web-edit-form-basics` (PR #23): `apps/local-web` を「sample fixture 固定表示」から「basics-only edit + live preview」に進める。編集対象は basics の **10 fields** (name 2 / nameKana 2 / birthDate / email / phone / address 3)、他 section (work / education / skills / certifications / projects) は sample fixture を維持。`<form>` input event ごとに raw draft を構築 → `safeParseCareerProfile` → success なら preview 更新、failure なら validation issues を form 下に表示 + 前回成功 preview を保持 (invalid draft は renderer に渡さない)。`profile-draft.ts` helper を `_internal/` 外に追加 (`{ ...baseFixture, basics }` shallow spread で section 名独立性を確保)。draft は raw input、`CareerProfile` 型として扱わず `as const satisfies CareerProfile` / `structuredClone` 不使用。**`@jcd-editor/pdf` は引き続き 0 行 import**。React/Vue/Svelte/UI ライブラリ/state ライブラリ/form ライブラリ/validation ライブラリ/router 一切なし。保存 / localStorage / IndexedDB / FileSystemAccess / file API / PDF export 一切なし。CI 変更なし

### 次 PR 候補

- `feat/local-web-save-load-profile`: app から `@jcd-editor/storage` を呼ぶ bridge (Phase 3 と並行マージ可、storage adapter PR とどちらが先でも可)
- `feat/local-web-edit-work-experiences`: work experience 編集 form (配列 / add/remove UI を導入する初の PR)
- `feat/local-web-preview-sizing`: A4 比率 preview / CSS aspect-ratio / iframe zoom / page break preview
- `feat/local-web-pdf-export`: server-side PDF generation 統合の architecture 設計 (`@jcd-editor/pdf` を **app から直接 import しない** で bridge 経由にする等)
- `feat/renderer-relativepath-asset-resolution`: Phase 2 残課題 (PDF rendering / preview で profilePhoto.relativePath の制限が顕在化するため優先度上がる可能性)

### 未確定論点

- A4 比率の preview sizing 戦略 (CSS aspect-ratio / iframe zoom / 印刷時の page break preview)
- sample fixture の構造化 (`packages/test-fixtures` 等への抽出を将来検討)
- app-local state management の必要性 (本 PR の判断: module-level + `let` で十分、edit field が増えたら再評価)
- input debounce の必要性 (本 PR で見送り、性能問題が顕在化したら別 PR)
- basics に profilePhoto 編集を追加する判断 (sandbox / asset-resolver 設計と連動するため別 PR)
- `name` / `nameKana` の片方空入力時の UX (本 PR では validation error 表示で受容、core schema 変更には別議論が必要)
- `apps/local-web` から `@jcd-editor/pdf` を呼ぶ architecture (Playwright は Node 専用、browser から PDF 生成を triggers するための bridge 設計 = local server / Tauri 等が別 PR の課題)
- root `tsconfig.json` から apps を除外した分の典型化 (将来 app が増えた時に root config をどう扱うか)

## Phase 5 — ローカル PDF 生成

A4 HTML プレビューを完全ローカルで PDF 化します。Playwright を用いた `PdfPort` + `PlaywrightPdfAdapter` で実装します。PDF 生成は外部サービスへデータを送信してはなりません。

### 完了済み

- `feat/pdf-port-foundation` (PR #20): `packages/pdf` に `PdfPort` / `PdfRenderResult` / `PdfRenderMetadata` / `PdfError` を最小 surface で導入。実 PDF 生成 (Playwright / Puppeteer / pdf-lib 等) は含まない。`PdfPort` の shape は provisional として、本 adapter PR で実装目線の見直しを許容する設計だった
- `feat/pdf-playwright-adapter` (PR #21): `createPlaywrightPdfAdapter` factory を `@jcd-editor/pdf` に追加し、`PdfPort` を満たす最初の実 adapter を実装。`playwright` を runtime dependency に追加、CI に `playwright install chromium --with-deps` ステップを 1 つ追加。`PdfPort` / `PdfError` / `PdfErrorCode` shape は **完全無変更** (provisional 宣言の正当性を実装で確認)。local-first 多層防御 (`setContent` 限定 / JS disable / `data:` `about:` 以外を `route.abort()` / `<base>` tag なし)。ファイル書き出し / UI / CLI / Storage 統合 / asset resolution は本 PR で扱わない

### 未確定論点

- 日本語フォントの選定 (Noto Sans JP、Noto Serif JP、システムフォント) と埋め込み挙動 (PR #21 の Playwright integration test で具体性が増した)
- 典型的な履歴書におけるファイルサイズ制約
- 印刷互換性 (余白、改ページ、写真配置)
- `PdfRenderOptions` の knob (余白 / 印刷背景 / 拡縮 / metadata 埋め込み) — ユーザー要求が顕在化したら別 PR で追加
- `PdfErrorCode` の追加 (`PDF_LAUNCH_FAILED` / `PDF_PAGE_LOAD_FAILED` 等) — 現状 `PDF_RENDER_FAILED` 1 つを維持
- `cause` field の追加判断 — 必要になれば追加
- `~/.cache/ms-playwright` CI caching の費用対効果 (`chore(ci): cache Playwright browsers` として別 PR で検討)
- `pageCount` の取得 (将来 PDF parser で対応する選択肢)
- long-lived browser process / browser pooling の検討 (UI 統合時に再評価)
- `apps/local-web` から `@jcd-editor/pdf` を呼ぶ architecture (Playwright は Node 専用、browser から PDF 生成を triggers するための bridge 設計 = local server / Tauri 等が別 PR の課題)

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
