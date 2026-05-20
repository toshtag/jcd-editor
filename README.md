# jcd-editor

構造化されたキャリア情報から、履歴書・職務経歴書をローカルで作成・管理・出力するための local-first ドキュメントエディタです。

**ステータス: Phase 1 進行中 — Core foundations 完了 (PR #3)。学歴・職歴・スキル等は順次増分中。**

> 実在する個人の履歴書データは、本リポジトリにコミットしないでください。詳細は [docs/PRIVACY.md](docs/PRIVACY.md) を参照してください。

## 概要

転職活動・キャリア記録における、履歴書 (JIS 様式) および職務経歴書の生成・編集を、ユーザーのローカル環境で完結させることを目的としたツールです。

データはユーザー自身のマシンに留まります。クラウド・SaaS・外部 AI は、いずれも optional であり、利用の前提条件ではありません。

## なぜ local-first か

履歴書や職務経歴書は、氏名・連絡先・職歴・希望条件など、高度にセンシティブな個人情報を含みます。これらのデータを SaaS 上に置くと、ベンダーロックイン、サービス終了リスク、広告型ビジネスモデルへの暗黙の同意などをユーザーに負わせることになります。

jcd-editor は、ユーザーが自分のキャリア情報を自分のマシンで管理できる前提を最優先します。クラウド同期や複数デバイス共有を将来追加する場合も、ローカル単独利用を壊さない形で重ねます。

詳細: ADR 0001 ([docs/adr/0001-local-first.md](docs/adr/0001-local-first.md))

## なぜ Core を UI フレームワーク非依存にするか

UI フレームワークの世代交代はプロダクトの寿命より短いことが多く、ドメインモデルを特定のフレームワークに結びつけると将来コストが大きくなります。jcd-editor は `packages/core` を Vanilla TypeScript で実装し、UI / DOM / Electron / Tauri / 各種実装に依存させません。

これにより、将来 React / Vue / Svelte / デスクトップ / CLI などを追加しても、core を書き換えずに済むようにします。

詳細: ADR 0002 ([docs/adr/0002-framework-independent-core.md](docs/adr/0002-framework-independent-core.md))

## なぜ AI / Cloud / SaaS を optional にするか

- **AI**: 中核価値は構造化された執筆と信頼できるレンダリングであり、AI 生成ではありません。AI は補助機能として後付けし、デフォルトで無効、外部 AI への送信は明示確認の対象です
- **Cloud**: クラウド同期や SaaS 派生はローカル利用の前提条件にしません。ローカルファースト・スタックの「上に重ねる」ものであり、「前に置く」ものではありません
- **SaaS**: 広告型・データ収集型のビジネスモデルを前提とした設計を採用しません。扱うデータの性質と相容れないためです

## Non-goals in early phases

初期フェーズで意図的に対象外とする事項です。後にこれらが必要になった時点で、独立した議論を行います。

- ユーザーアカウント
- 認証 / 認可
- クラウドデータベース
- 広告型ビジネスモデルを前提とした設計
- 外部 AI のデフォルト有効化
- Core およびテンプレートでの React / Vue / Svelte 依存
- Phase 0 における DOCX / XLSX 互換
- Phase 0 における Western CV / résumé 対応
- Phase 0 におけるモバイル優先 WYSIWYG エディタ

## ドキュメント

| ドキュメント | 内容 |
| --- | --- |
| [docs/CONCEPT.md](docs/CONCEPT.md) | プロダクト思想と原則 |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Phase 0〜9 のロードマップ |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | パッケージ構成と境界規則 |
| [docs/VALIDATION.md](docs/VALIDATION.md) | バリデーション責務の整理 |
| [docs/BRANCHING.md](docs/BRANCHING.md) | ブランチ運用とコミット規約 |
| [docs/PRIVACY.md](docs/PRIVACY.md) | リポジトリ運用のプライバシー規則 |
| [docs/adr/0001-local-first.md](docs/adr/0001-local-first.md) | ADR: Local-first 採用 |
| [docs/adr/0002-framework-independent-core.md](docs/adr/0002-framework-independent-core.md) | ADR: Core をフレームワーク非依存に |
| [docs/adr/0003-isodate-internal-representation.md](docs/adr/0003-isodate-internal-representation.md) | ADR: 日付の内部表現を ISO 8601 文字列に統一 |
| [docs/adr/0004-validation-library-valibot.md](docs/adr/0004-validation-library-valibot.md) | ADR: バリデーションライブラリとして Valibot を採用 |

## 開発

Node 22 LTS + pnpm 10 を前提とします。

```bash
pnpm install
pnpm test       # root から全パッケージのテストを実行
pnpm typecheck
pnpm lint
pnpm format
```

ブランチ運用とコミット規約は [docs/BRANCHING.md](docs/BRANCHING.md) を参照してください。

## ライセンス

[MIT License](LICENSE)。法的に有効なのは英語原文です。LICENSE ファイル内には日本語参考訳を併記しています。
