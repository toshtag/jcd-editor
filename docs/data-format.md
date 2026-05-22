# データ形式仕様: `CareerProfile` JSON

本ドキュメントは、jcd-editor が import / export する `CareerProfile` JSON 形式の **正式仕様** です。`apps/local-web` の JSON エクスポート機能 (PR #33) および `apps/cli` の render コマンド (PR #43) が読み書きする JSON は、この仕様に従います。

実装上の正本は [packages/core/src/domain/career-profile.ts](../packages/core/src/domain/career-profile.ts) およびその参照先です。仕様と実装に齟齬がある場合は実装が優先されます (バグとして報告してください)。

## 想定読者

- jcd-editor の CLI / local-web を使ってデータをエクスポート / インポートするユーザー
- 別ツール (スプレッドシート / 他履歴書ジェネレーター) から JSON を生成して jcd-editor に流し込みたい開発者
- jcd-editor のテンプレートや出力フォーマットを拡張したい contributor

## 設計原則 (背景)

- **schema は core パッケージで一元定義** ([Valibot](https://valibot.dev/)) され、UI / storage / PDF はその validated output を消費する
- **field の追加には schemaVersion の bump が必要** (今後の予定。現在は `schemaVersion: 1`)
- **個人情報を含むファイル** であるため、リポジトリへのコミットは禁止です ([docs/PRIVACY.md](PRIVACY.md))

---

## 全体構造

```jsonc
{
  "schemaVersion": 1,
  "basics": { /* 必須 (空 object 可) */ },
  "workExperiences": [ /* optional */ ],
  "educationHistory": [ /* optional */ ],
  "skills": [ /* optional */ ],
  "certifications": [ /* optional */ ],
  "projects": [ /* optional */ ]
}
```

| field | 型 | 必須 | 件数上限 | 説明 |
|-------|----|------|----------|------|
| `schemaVersion` | `1` (literal) | ✓ | — | スキーマのバージョン。現在は `1` のみ |
| `basics` | object | ✓ | — | 基本情報。各 inner field は optional |
| `workExperiences` | `WorkExperience[]` | — | 100 | 職務経歴 |
| `educationHistory` | `Education[]` | — | 30 | 学歴 |
| `skills` | `Skill[]` | — | 200 | スキル |
| `certifications` | `Certification[]` | — | 100 | 資格 |
| `projects` | `Project[]` | — | 200 | プロジェクト |

不要な section は **キーごと省略可** です (`null` や空配列を必ず書く必要はありません)。

---

## `basics` (基本情報)

```jsonc
{
  "name": { "family": "山田", "given": "太郎" },
  "nameKana": { "family": "ヤマダ", "given": "タロウ" },
  "birthDate": "1993-04-01",
  "email": "taro.yamada@example.com",
  "phone": "090-0000-0000",
  "address": {
    "postalCode": "100-0001",
    "prefecture": "東京都",
    "cityAndRest": "サンプル区サンプル町 1-2-3"
  },
  "profilePhoto": {
    "source": { "kind": "dataUri", "dataUri": "data:image/png;base64,iVBORw0KGgo...", "mediaType": "image/png" },
    "altText": "証明写真"
  }
}
```

すべての inner field は optional です。`basics: {}` (空 object) も valid。

| field | 型 | 制約 |
|-------|----|------|
| `name` | [`PersonName`](#personname) | 後述 |
| `nameKana` | [`PersonKana`](#personkana) | 後述 |
| `birthDate` | [`IsoDateString`](#isodatestring) | `YYYY-MM-DD` (1900〜2100 年、実在日付) |
| `email` | string | RFC 準拠の email 形式、最大 254 文字 |
| `phone` | string | 非空、最大 50 文字 (形式チェックなし) |
| `address` | [`PostalAddress`](#postaladdress) | 後述 |
| `profilePhoto` | [`ProfilePhoto`](#profilephoto) | 後述 |

---

## 配列 section の各 entry

### `WorkExperience` (職務経歴の 1 エントリ)

```jsonc
{
  "companyName": "株式会社サンプル",
  "position": "ソフトウェアエンジニア",
  "employmentType": "正社員",
  "period": {
    "startDate": "2020-04",
    "endDate": "2023-03",
    "isCurrent": false
  },
  "summary": "Web application 開発に従事",
  "responsibilities": ["設計", "実装", "レビュー"],
  "achievements": ["性能改善で応答時間を 40% 短縮"]
}
```

| field | 型 | 最大長 / 件数 |
|-------|----|----------------|
| `companyName` | string (非空) | 200 文字 |
| `position` | string (非空) | 100 文字 |
| `employmentType` | string (非空) | 50 文字 |
| `period` | object | 後述 |
| `summary` | string (非空) | 1000 文字 |
| `responsibilities` | string[] | 各 500 文字 / 最大 50 件 |
| `achievements` | string[] | 各 500 文字 / 最大 50 件 |

**`period` の型** (`WorkPeriod`)

| field | 型 | 制約 |
|-------|----|------|
| `startDate` | [`IsoYearMonthString`](#isoyearmonthstring) | `YYYY-MM` |
| `endDate` | [`IsoYearMonthString`](#isoyearmonthstring) | `YYYY-MM` |
| `isCurrent` | boolean | `true` の場合 `endDate` を指定不可 |

**cross-field 制約**:
- `isCurrent === true` のとき `endDate` を持つと reject
- `startDate > endDate` のとき reject

### `Education` (学歴の 1 エントリ)

```jsonc
{
  "institutionName": "サンプル大学",
  "faculty": "情報工学部",
  "department": "情報科学科",
  "degree": "学士 (工学)",
  "startDate": "2014-04",
  "endDate": "2018-03",
  "status": "卒業",
  "description": "機械学習を専攻"
}
```

| field | 型 | 最大長 |
|-------|----|--------|
| `institutionName` | string (非空) | 200 |
| `faculty` | string (非空) | 100 |
| `department` | string (非空) | 100 |
| `degree` | string (非空) | 100 |
| `startDate` | [`IsoYearMonthString`](#isoyearmonthstring) | — |
| `endDate` | [`IsoYearMonthString`](#isoyearmonthstring) | — |
| `status` | string (非空) | 50 (例: 在学中 / 卒業 / 修了 / 中退 / 卒業見込み) |
| `description` | string (非空) | 1000 |

**cross-field 制約**:
- `startDate > endDate` のとき reject

### `Skill` (スキルの 1 エントリ)

```jsonc
{
  "name": "TypeScript",
  "category": "プログラミング言語",
  "level": "上級",
  "description": "Web フロントエンド / Node.js 双方で利用"
}
```

| field | 型 | 最大長 |
|-------|----|--------|
| `name` | string (非空) | 100 |
| `category` | string (非空) | 50 |
| `level` | string (非空) | 50 |
| `description` | string (非空) | 1000 |

### `Certification` (資格の 1 エントリ)

```jsonc
{
  "name": "基本情報技術者試験",
  "issuer": "IPA",
  "acquiredDate": "2018-06",
  "expirationDate": "2028-06",
  "credentialId": "FE-2018-00000",
  "credentialUrl": "https://example.com/verify/00000",
  "description": "春期試験合格"
}
```

| field | 型 | 最大長 |
|-------|----|--------|
| `name` | string (非空) | 200 |
| `issuer` | string (非空) | 200 |
| `acquiredDate` | [`IsoYearMonthString`](#isoyearmonthstring) | — |
| `expirationDate` | [`IsoYearMonthString`](#isoyearmonthstring) | — |
| `credentialId` | string (非空) | 100 |
| `credentialUrl` | string (非空) | 2000 (形式チェックなし、plain text として保持) |
| `description` | string (非空) | 1000 |

**cross-field 制約**:
- `acquiredDate > expirationDate` のとき reject

### `Project` (プロジェクトの 1 エントリ)

```jsonc
{
  "name": "サンプルプロジェクト",
  "organizationName": "株式会社サンプル",
  "role": "設計・実装担当",
  "startDate": "2021-01",
  "endDate": "2021-12",
  "isCurrent": false,
  "summary": "社内向けツールの開発",
  "responsibilities": ["要件整理", "実装"],
  "achievements": ["手作業を自動化し作業時間を月 10 時間削減"],
  "technologies": ["TypeScript", "Node.js"]
}
```

| field | 型 | 最大長 / 件数 |
|-------|----|----------------|
| `name` | string (非空) | 200 |
| `organizationName` | string (非空) | 200 |
| `role` | string (非空) | 100 |
| `startDate` | [`IsoYearMonthString`](#isoyearmonthstring) | — |
| `endDate` | [`IsoYearMonthString`](#isoyearmonthstring) | — |
| `isCurrent` | boolean | — |
| `summary` | string (非空) | 1000 |
| `responsibilities` | string[] | 各 500 / 最大 50 件 |
| `achievements` | string[] | 各 500 / 最大 50 件 |
| `technologies` | string[] | 各 100 / 最大 100 件 |

**cross-field 制約**:
- `isCurrent === true` のとき `endDate` を持つと reject
- `startDate > endDate` のとき reject

---

## Value Objects

### `PersonName`

```json
{ "family": "山田", "given": "太郎" }
```

両 field とも 1〜50 文字の非空文字列。

### `PersonKana`

```json
{ "family": "ヤマダ", "given": "タロウ" }
```

両 field とも 1〜50 文字。**全角カタカナ + 長音符 (ー) + 中点 (・) + 全角スペース のみ** 受け入れます (regex `^[゠-ヿ　]+$`)。空白や中点のみは reject。

### `IsoDateString`

`YYYY-MM-DD` 形式。

- year: 1900〜2100
- 実在する日付のみ (`2024-02-30` などは reject、閏年も判定)

例: `"1993-04-01"`

### `IsoYearMonthString`

`YYYY-MM` 形式。

- year: 1900〜2100
- month: 01〜12

例: `"2020-04"`

### `PostalAddress`

```json
{ "postalCode": "100-0001", "prefecture": "東京都", "cityAndRest": "サンプル区サンプル町 1-2-3" }
```

すべての inner field optional。

| field | 型 | 最大長 |
|-------|----|--------|
| `postalCode` | string | 20 |
| `prefecture` | string | 50 |
| `cityAndRest` | string | 200 |

### `ProfilePhoto`

```jsonc
{
  "source": {
    "kind": "dataUri",
    "dataUri": "data:image/png;base64,iVBORw0KGgo...",
    "mediaType": "image/png"
  },
  "altText": "証明写真"
}
```

| field | 型 | 制約 |
|-------|----|------|
| `source` | object | `kind: "dataUri"` または `kind: "relativePath"` |
| `altText` | string (非空) | 最大 200 文字 |

**`source.kind: "dataUri"` の場合**

| field | 型 | 制約 |
|-------|----|------|
| `dataUri` | string | `^data:image/(jpeg\|png);base64,.+$`、最大 5,000,000 文字 |
| `mediaType` | `"image/jpeg" \| "image/png"` | optional |

**`source.kind: "relativePath"` の場合**

| field | 型 | 制約 |
|-------|----|------|
| `path` | string | 1〜1000 文字、絶対パス禁止、外部 URL 禁止、`..` を含むパス禁止 |
| `mediaType` | `"image/jpeg" \| "image/png"` | optional |

**注**: 現状の `apps/local-web` の写真 input は `dataUri` のみ出力します。`relativePath` は core スキーマ上は valid ですが、`packages/renderer` の rirekisho テンプレートは描画しません (asset resolution 未実装のため)。

---

## 完全な最小例

```json
{
  "schemaVersion": 1,
  "basics": {}
}
```

これは valid です (parse error にならない)。preview は空ですが、CLI / local-web 双方で受け入れられます。

## 完全な例 (全 section 入り)

CLI test の fixture をそのまま使えます: [apps/cli/src/__tests__/fixtures/long-profile.json](../apps/cli/src/__tests__/fixtures/long-profile.json)

---

## バリデーションの責務

入力 JSON は次の 2 段で検証されます:

1. **`JSON.parse`**: 文法エラーは即時 reject (CLI なら exit code 2 / `INVALID_JSON`)
2. **`safeParseCareerProfile`**: schema 適合性、文字数制限、regex、cross-field 制約 (CLI なら exit code 2 / `SCHEMA_MISMATCH`)

エラーは構造化された `ValidationIssue[]` として返ります:

```ts
type ValidationIssue = {
  readonly path: string;   // 例: "educationHistory.0.endDate"
  readonly message: string;
};
```

`path` は dot-separated で、array index も含みます。CLI は全 issue を stderr に出力します。

---

## バージョニング

現状 `schemaVersion: 1` のみが valid です。`literal(1)` で検証されるため、他の値は schema-mismatch となります。

将来 schema が変わった場合の方針:

- 後方互換しない変更 → `schemaVersion: 2` を新設し、`safeParseCareerProfile` を multi-version 対応に変更
- 既存の v1 JSON は migration utility で v2 に変換する
- migration policy は変更が現実化した時点で別途設計する (今は YAGNI、ROADMAP の「次に着手するもの」にも含めない)

---

## Privacy

エクスポートされた JSON は次を **平文で** 含みます:

- 氏名、フリガナ、生年月日
- メールアドレス、電話番号、住所
- 全職務経歴 (会社名、期間、業務内容)
- 学歴、資格、スキル、プロジェクト
- 証明写真 (`profilePhoto.source.dataUri` に base64 画像データ)

このため:

- **リポジトリにコミットしない** (`*.local.json` / `private/` / `data.local/` で `.gitignore`)
- 第三者と共有する際は内容を双方で認識した上で扱う
- クラウド同期 / チャット添付 / メール経路では保管期間と削除手順を事前に決める
- 写真入り profile は特に容量が大きく (1 MB 超になり得る)、扱いに注意

詳細: [docs/PRIVACY.md](PRIVACY.md)

---

## 消費する側からの呼び出し

### CLI で生成

[docs/cli.md](cli.md) 参照。

```sh
pnpm --filter @jcd-editor/cli start render ./profile.json ./profile.pdf
```

### プログラム内で型安全に消費する場合

```ts
import { safeParseCareerProfile } from '@jcd-editor/core';

const raw: unknown = JSON.parse(jsonText);
const result = safeParseCareerProfile(raw);
if (result.success) {
  // result.data: CareerProfile (型安全 + branded)
} else {
  // result.issues: readonly ValidationIssue[]
}
```

`@jcd-editor/core` は UI / DOM / Node 依存を持たないため、ブラウザ / Node / Deno / Bun いずれの環境でも使えます。

---

## 関連ドキュメント

- [docs/ARCHITECTURE.md](ARCHITECTURE.md) — パッケージ境界規則
- [docs/VALIDATION.md](VALIDATION.md) — バリデーション責務の整理
- [docs/PRIVACY.md](PRIVACY.md) — 個人情報の取り扱い規則
- [docs/cli.md](cli.md) — CLI 利用ガイド
- [docs/adr/0003-isodate-internal-representation.md](adr/0003-isodate-internal-representation.md) — 日付表現の ADR
- [docs/adr/0004-validation-library-valibot.md](adr/0004-validation-library-valibot.md) — Valibot 採用の ADR
