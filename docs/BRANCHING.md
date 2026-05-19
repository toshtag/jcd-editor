# ブランチ運用

## 基本方針

- `main` は常に安定状態に保ちます
- 作業ごとに専用ブランチを切ります
- **1 ブランチ = 1 目的**
- 小さく、論理単位でコミットします
- Conventional Commits を使用します

## ブランチ命名

| プレフィックス | 用途 |
| --- | --- |
| `docs/` | ドキュメントのみの変更 |
| `chore/` | リポジトリ整備、依存更新、ビルド設定 |
| `feat/` | 新機能 |
| `fix/` | バグ修正 |
| `refactor/` | 振る舞いを変えないリファクタリング |
| `test/` | テスト追加・修正のみ |

ブランチ名は短く具体的に。例:

```
docs/concept-roadmap
chore/repo-setup
feat/core-schema
feat/template-renderer
feat/file-storage
feat/local-web-ui
feat/pdf-playwright
feat/import-export
feat/ai-port
fix/render-margin
refactor/storage-port
```

## コミットメッセージ

Conventional Commits の形式に従います。

```
<type>(<scope>): <件名>

<本文 (任意)>

<フッター (任意)>
```

主な type:

- `feat`: 新機能
- `fix`: バグ修正
- `docs`: ドキュメント変更のみ
- `chore`: ビルド・補助ツール・設定
- `refactor`: 振る舞いを変えない変更
- `test`: テストの追加・修正
- `perf`: パフォーマンス改善

良い例:

```
feat(core): CareerProfile スキーマを追加
docs: アーキテクチャ概要と境界規則を追記
fix(renderer): 改ページ時の余白崩れを修正
chore: pnpm workspace の初期設定を追加
```

避けるべきコミット:

```
update files
wip
fix
さらに変更
```

## 1 ブランチで守ること

1. 目的を 1 つに絞る (関係ないリファクタを混ぜない)
2. 小さくコミットする (1 ファイル / 1 論理変更が目安)
3. 可能ならテストを併せて追加する (Phase 1 以降)
4. `main` に戻す前に、関連する `docs/` を更新する

## マージ運用

- `main` への直接コミットは Phase 0 の初期スケルトンを除き、原則行いません
- マージ方式 (merge commit / squash / rebase) はリポジトリ全体で揃えます。**Phase 0 完了時点では未確定** です。`chore/repo-setup` 以降で確定し、本ドキュメントを更新します
- 履歴の force push は `main` には行いません

## Phase 0 のブランチ系列

参考までに、Phase 0 で利用したブランチを記録します。

| 順序 | ブランチ | 目的 |
| --- | --- | --- |
| 1 | `main` 直接 | `git init` と最小スケルトン (`.gitignore`、`LICENSE`、`README` スタブ) |
| 2 | `docs/concept-roadmap` | Phase 0 の全ドキュメントとプレースホルダーディレクトリ |

Phase 0 完了後の次のブランチは `chore/repo-setup` です。ここで TypeScript ワークスペース、tsconfig、パッケージマネージャ、最小スクリプトを導入します (まだアプリケーションコードは書きません)。
