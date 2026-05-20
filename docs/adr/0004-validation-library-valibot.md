# ADR 0004: バリデーションライブラリとして Valibot を採用する

## Status

Accepted (2026-05-20)

## Context

`packages/core` は pure domain として、`CareerProfile` と値オブジェクトに対する型レベルとランタイムレベルの両方の検証が必要です。永続化データの読み込み、外部入力 (インポート)、UI からの入力、いずれの経路でも、不正データが core 内部に流入することを防ぐ必要があります。

候補は以下です。

| 候補 | 特徴 |
| --- | --- |
| **Valibot** | Modular / tree-shakable。`pipe` で validation を組み立てる。schema から型推論可能。新興だがエコシステム拡大中 |
| Zod | デファクト。実績豊富、ナレッジが多い。サイズは Valibot より大きい |
| Effect Schema | Effect ecosystem の一部。強力だが学習コストが高い |
| ArkType | Type-first DSL。表現力が高いが学習コストあり |
| 自前実装 | 依存ゼロだが、スキーマが増えるとコストが膨大 |

本プロジェクトは local-first を志向し、Phase 4 以降ではブラウザ UI (`apps/local-web`) のバンドルにバリデーションロジックを含めます。バンドルサイズとツリーシェイカビリティが重要です。同時に、外部依存を最小化し、長期保守性を確保したい思想 ([docs/CONCEPT.md](../CONCEPT.md), [ADR 0002](./0002-framework-independent-core.md)) と整合する必要があります。

## Decision

`packages/core` のバリデーションライブラリとして **Valibot** を採用します。

ただし、以下の境界条件を厳守します。

- **Valibot 由来の型は `packages/core` の公開 API に一切露出させない**
  - brand 型は project-owned (`unique symbol` ベース) で定義し、Valibot の `v.brand()` は使わない
  - Valibot schema は `v.transform()` で project-owned brand 型に変換する
- **Valibot 由来の schema 値 (`*Schema` オブジェクト) も公開 API に露出させない**
  - source module 内では schema を export してよい (合成に必要なため) が、`packages/core/src/index.ts` および `packages/core/src/domain/index.ts` からは re-export しない
- **`safeParse` の結果は独自 `ParseResult<T>` / `ValidationIssue` で wrap する**
- **失敗時の error は独自 `ValidationError` クラス**を使う

これにより、Valibot を将来別のライブラリに差し替えても、`packages/core` の公開 API を利用するコードには影響を与えない。

## Consequences

**良い結果:**

- Valibot は modular / tree-shakable な設計であり、ブラウザで動く local-first アプリに向く
- 型と schema を Single Source of Truth として保てる (`v.InferOutput` パターン)
- 公開 API に Valibot を露出させない設計により、ライブラリ差し替えコストが局所化される

**負担となる結果:**

- Valibot のエコシステムは Zod よりも小さい。記事・StackOverflow の情報が見つからない場面で、自分で詰める必要がある
- 公開 API を独自型に揃えるため、薄いラッパー層 (parse-result, errors) を保守する必要がある
- バンドルサイズの実測は Phase 4 (UI 導入時) まで定量できない

**これにより制約される後続判断:**

- 各値オブジェクトモジュールは、schema を `internal` プレフィックスや `/** @internal */` コメントで識別し、公開 index には re-export しない
- バリデーション結果の操作 (失敗の構造化、ローカライズ) は独自層で行い、Valibot の API を直接公開しない
- Valibot の重大な問題や仕様変更が判明した場合、本 ADR を見直して別ライブラリへの移行を検討する

## Related

- ADR 0002 (Framework-independent core) — 外部実装から core を守る原則と整合
- [docs/ARCHITECTURE.md](../ARCHITECTURE.md)
