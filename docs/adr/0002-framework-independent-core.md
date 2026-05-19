# ADR 0002: Core を UI フレームワーク非依存にする

## Status

Accepted (2026-05-19)

## Context

jcd-editor は長期保守を志向するツールです。具体的には、ユーザーが今後数年〜十年単位でキャリア情報を蓄積・更新していくことを想定しており、その間にも以下が起きえます。

- UI フレームワークの世代交代 (React → 何か、Vue → 何か、新興フレームワーク)
- レンダリング先の追加 (デスクトップアプリ、CLI、別の Web 環境)
- テンプレートエンジンの差し替え
- AI / クラウド連携の追加

このとき、`CareerProfile` などのドメインモデルが特定の UI フレームワーク・特定のテンプレートエンジン・特定のストレージ実装に依存していると、UI 側の世代交代やレンダラ差し替えのコストが非常に大きくなります。

ドメイン層を UI フレームワークから独立させることで、以下が可能になります。

- UI フレームワーク変更時にドメインを書き換えずに済む
- レンダラを React / Vue / Vanilla / SSR / CLI で複数同時に持てる
- テスト容易性が高まる (DOM や framework lifecycle を起こさずに検証できる)
- 別アプリ (デスクトップ、クラウド、CLI) からの再利用が現実的になる

代償としては:

- 初期に書くインターフェースが少し増える
- ドメイン層と UI 層の間に明示的なポート / アダプタの境界が必要になる
- 「ドメインを直接 React state に流す」よりは間接層が増える

## Decision

`packages/core` は **Vanilla TypeScript で実装し、UI フレームワーク・DOM・Electron・Tauri・ストレージ実装・PDF 実装・AI 実装に依存しない** ことを決定します。

具体的なルール:

1. `packages/core` は `CareerProfile`、値オブジェクト、バリデーション、純粋なドメイン関数のみを含む
2. `packages/core` は `StoragePort`、`PdfPort`、`AiPort`、`RendererPort` に直接依存しない
3. ポートは application layer に属する。`packages/core` 内に同居させるか別パッケージに切るかは Phase 1 の判断事項
4. レンダラ (`packages/renderer`) はテンプレートを React / Vue / Svelte ランタイムなしに扱う
5. テンプレート (`packages/templates`) は HTML + CSS + `manifest.json` で構成し、特定のフレームワークランタイムを必要としない

## Consequences

**良い結果:**

- UI フレームワーク選定を Phase 4 で柔軟に行える (初期候補は Vite + Vanilla TS だが拘束ではない)
- 将来 React / Vue / Tauri / Electron / CLI などを追加しても core を書き換えずに済む
- core のテストが UI 環境なしで完結する
- ドメインの再利用が容易になる (例: 別のレンダラを追加、CI 上で検証スクリプトを書く)

**負担となる結果:**

- 初期スカフォールディングのコストが「フレームワーク前提の最短実装」より高い
- インターフェース定義の責務が増える
- 抽象化の粒度を間違えると過剰設計に陥るリスクがある (これは ADR とは別に運用上で監視する)

**これにより制約される後続判断:**

- テンプレートは React コンポーネントとして実装しない
- ドメインを直接 React Context / Vuex store に詰めて UI 都合に合わせない
- 「core が即実装の都合で動かしやすいから」という理由で UI 都合をドメインに持ち込まない

## Related

- ADR 0001 (Local-first)
- [docs/ARCHITECTURE.md](../ARCHITECTURE.md)
- [docs/ROADMAP.md](../ROADMAP.md) (特に Phase 1〜4)
