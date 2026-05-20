# バリデーション責務の整理

本ドキュメントは、jcd-editor における validation (検証) の責務分担を整理します。「どの層で何を検証するか」を明確にし、責務が混ざることを防ぐためのものです。

## 中心的な責務分離

> **Foundation parse は permissive、Strict export validation は別レイヤ**

`packages/core` の foundation validation は「保存可能なユーザーデータ」を許容するため、編集途中の不完全な状態を意図的に許します。一方、「特定テンプレートに対して提出可能か」を判定する strict export validation は、テンプレートが具体化する Phase 2 以降に別レイヤで実装します。

## 1. Foundation validation (実装済み)

外部入力 / 永続化データを `CareerProfile` 型に parse する **境界層** の責務です。`packages/core` に実装されています。

### 担当者
- `packages/core/src/domain/operations.ts`
  - `parseCareerProfile(input: unknown): CareerProfile`
  - `safeParseCareerProfile(input: unknown): ParseResult<CareerProfile>`

### カバーする検証

- `schemaVersion` が `1` であること (それ以外は reject)
- `IsoDateString` / `IsoYearMonthString` の妥当性 (実在日付、年範囲 1900〜2100、手動 leap year 判定)
- `EmailAddress` の RFC 準拠ベース検証
- `PhoneNumber` の長さ範囲 (フォーマット制約なし、緩い文字列)
- `PersonName` の長さ範囲 (文字種制約なし)
- `PersonKana` の文字種 (全角カタカナ + 小書きカナ + 長音符 + 中点 + 全角スペース、空白のみ/中点のみは reject)
- 各 brand 型 (`IsoDateString` 等) は project-owned (`unique symbol`) で、`v.transform()` 経由でのみ生成される

### Valibot は internal

Valibot は内部実装として利用されますが、core の公開 API には Valibot 型 / schema 値を露出しません。`ParseResult<T>` / `ValidationIssue` / `ValidationError` の独自レイヤで wrap されます。詳細は [ADR 0004](adr/0004-validation-library-valibot.md) を参照。

## 2. Editing / draft tolerance (実装済み)

`CareerProfile` は **ユーザーのキャリアデータ** であり、「特定テンプレートへの提出可能なドキュメント」ではありません。

このため:
- `basics.*` (`name`, `nameKana`, `birthDate`, `email`, `phone`, `address`) はすべて optional
- 空 (`{ schemaVersion: 1, basics: {} }`) でも valid
- 値が入っているフィールドは型と spec を満たしていなければならない (空文字 → reject、不正日付 → reject)

これは「ユーザーが履歴書を書き始めて、まだ名前しか入力していない状態」のような編集途中データを許容するための設計です。

## 3. Export / template-specific validation (未実装、Phase 2 以降)

「特定の履歴書 / 職務経歴書テンプレートに対して、このデータは提出可能か?」を判定する責務です。**現在は未実装です**。

### 想定する関数

- `validateForTemplate(profile, template): ParseResult<...>`
- `validateForExport(profile, exportTarget): ParseResult<...>`
- `validateResumeRequirements(profile): ParseResult<...>`
- `validateCareerHistoryRequirements(profile): ParseResult<...>`

### 配置候補

配置場所は **未定** です。候補:

- `packages/renderer` (テンプレートが要求するフィールドを知っているため)
- `packages/templates` (テンプレート自身が必須要件を宣言)
- 将来の export / validation 専用パッケージ

### `packages/core` は候補に含めない

[`docs/ARCHITECTURE.md`](ARCHITECTURE.md) の境界規則により、`packages/core` は template-specific export readiness を所有しません。`packages/core` には export-specific validation を**追加しないでください**。

### Phase 2 以降で設計する理由

具体的なテンプレートが存在しないと validation 仕様が決まらないため、Phase 2 で renderer / template が具体化したタイミングで設計します。

## 4. UI validation (未実装、Phase 4 以降)

フィールド単位の即時フィードバック (例: 入力中に「メール形式が不正です」と表示) は **UX 層の責務** です。

### 原則

- UI validation は core parsing を **置き換えない**
- 永続化 / インポート時には、UI を通っていないルートを含めて core parse を必ず通す
- UI は UX の上塗りとしての即時性を提供する役割であり、データ整合性の最終ゲートではない

これにより、UI を経由しないインポートや別環境からのファイル読み込みでもデータ整合性が保たれます。

## 5. Future validation work (handoff)

将来必要になった時点で別 PR で追加する予定の検証項目:

- **value-object-level parse helper**: `parseIsoDateString` / `safeParseIsoDateString` / `parseEmailAddress` 等。文字列リテラルから brand 型を直接生成する経路が必要になった時点で追加
- **`ValidationIssue.code`**: 構造化エラーやローカライズが必要になった時点で `code` フィールドを追加
- **template-specific strict validation**: Phase 2 で具体テンプレートが導入されたタイミング
- **schema migration validation**: `schemaVersion` v2 以降が必要になったタイミング (`feat/core-migration-v1-to-v2` 等)

## まとめ

| レベル | 状態 | 担当 |
| --- | --- | --- |
| 1. Foundation parse | 実装済み | `packages/core` |
| 2. Draft tolerance | 実装済み (型レベル) | `packages/core` の optional 設計 |
| 3. Export / template-specific | 未実装 | `packages/renderer` / `packages/templates` / 将来の専用パッケージ (core は不可) |
| 4. UI validation | 未実装 | 将来の UI 層 (core parse の置き換えではない) |
| 5. Future work | 未着手 | 必要になった時点で別 PR |

ジェネリックな結論: **core は「データを受け取って正しく取り込めるか」を判定する**。**「特定の用途で十分か」は core 外の責務**。
