# アーキテクチャ

本ドキュメントは、コードベースが守るべきパッケージ構成と依存規則を記述します。意図的に簡潔にしています。将来の変更がここで定めた規則を破りそうに感じた場合、その変更には本ドキュメントの明示的な更新、もしくは別の設計が必要です。

## パッケージ構成

```
packages/
  core/        Pure domain: CareerProfile、値オブジェクト、バリデーション、
               純粋なドメイン関数。I/O・UI・アダプタを含まない。
  renderer/    CareerProfile を RenderedDocument (HTML + CSS + メタデータ)
               に変換する。PDF は生成しない。
  templates/   HTML + CSS + manifest.json のテンプレート資産。
               React / Vue / Svelte のランタイムを必要としない。
  storage/     StoragePort と、CareerProfile を永続化するアダプタ。
  pdf/         PdfPort と、RenderedDocument を PDF 化するアダプタ。
  ai/          AiPort とアダプタ。デフォルトで無効。

apps/
  local-web/   最小のブラウザベースエディタ (初期候補: Vite + Vanilla TS)。
               上記パッケージを組み合わせて local-first 体験を提供する。
```

`apps/desktop/` および `apps/cloud/` は将来のフェーズ用に予約しており、Phase 0 では作成しません。

## レイヤー図

```
apps/local-web (将来: apps/desktop、apps/cloud)
      │
      ▼
application layer
   ├── packages/core (pure domain) を利用する
   ├── ポートを所有する:
   │     ├── StoragePort
   │     ├── RendererPort
   │     ├── PdfPort
   │     └── AiPort
   ▼
adapters
   ├── FileStorageAdapter
   ├── PlaywrightPdfAdapter
   ├── OllamaAdapter
   └── ...

packages/core
   └── pure domain: CareerProfile、値オブジェクト、
                    バリデーション、純粋なドメイン関数
```

## 境界規則

1. `packages/core` は純粋ドメインロジックのみを含みます。`PdfPort`、`AiPort`、`StoragePort`、DOM、UI フレームワーク、いかなるアダプタ実装にも依存**してはなりません**。
2. `AddWorkExperience` や `UpdateCareerSummary` のようなアプリケーションコマンドは、純粋かつフレームワーク非依存に保てる場合を除き `packages/core` に置きません。正確な配置場所 (`packages/core/application` 内 vs 別パッケージの `packages/application`) は Phase 1 で決定します。
3. ポート (`StoragePort`、`RendererPort`、`PdfPort`、`AiPort`) の正確な配置場所は **Phase 0 では決定しません**。これらは application layer に属します。当該レイヤーを `packages/core` に同梱するか、独立した `packages/application` に分離するかは Phase 1 の判断事項です。
4. `packages/renderer` は `RenderedDocument` (HTML + CSS + メタデータ) を生成します。PDF は生成**しません**。
5. `packages/pdf` は `RenderedDocument` を受け取って PDF を生成します。`CareerProfile` に直接依存**しません**。
6. `packages/storage` はデータの永続化方法を知っています。`packages/core` はストレージ形式を知**りません**。
7. `packages/templates` のテンプレートは HTML + CSS + `manifest.json` で構成します。React、Vue、Svelte のランタイムを必要**としません**。
8. `apps/local-web` はパッケージとアダプタを組み合わせる役割を持ちます。ドメインロジックを含**みません**。
9. `packages/core` は **foundation parsing と domain validation を所有します**。`parseCareerProfile` / `safeParseCareerProfile` が外部入力および永続化との境界です。これらの parse 関数を通っていないオブジェクトを `CareerProfile` 型として扱ってはなりません。
10. `packages/core` は **template-specific な export readiness を所有しません**。「特定の履歴書テンプレートに対して提出可能か」のような判定は、テンプレートが具体化する `packages/renderer` または template 側で実装します。core に export-specific validation 関数を追加してはなりません。
11. `packages/core` の validation 実装に使う Valibot は **internal implementation detail** です。公開 API に Valibot 型 (`InferOutput`、`GenericSchema` 等) も schema 値 (`*Schema`) も露出してはなりません ([ADR 0004](adr/0004-validation-library-valibot.md) と整合)。

validation 責務の詳細は [docs/VALIDATION.md](VALIDATION.md) を参照してください。

## 依存方向 (まとめ)

```
UI ──► application ──► core
         │
         ├──► ポートを定義する
         └──► ポートを実装するアダプタを利用する
```

アダプタはポートに依存します。逆ではありません。Core はそれ自身以外の何にも依存しません。
