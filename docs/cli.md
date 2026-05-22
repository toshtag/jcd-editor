# jcd-editor CLI

`apps/cli` は、JSON 形式の `CareerProfile` から履歴書 / 職務経歴書の PDF を完全にローカルで生成するための CLI です。

入力 JSON の形式仕様は [docs/data-format.md](data-format.md) を参照してください。

## 想定する利用フロー

1. `apps/local-web` で profile を編集し、「JSON エクスポート」ボタンで `profile-*.json` を出力する
2. その JSON を本 CLI に渡して PDF を生成する

local-web に PDF ボタンを直接生やさないのは、`@jcd-editor/pdf` (Playwright) を browser bundle に含めない方針 (詳細は `apps/local-web/src/main.ts` の冒頭コメント) のためです。

## 前提

- Node 22 LTS
- pnpm 10
- 初回のみ Chromium のインストールが必要:

  ```sh
  pnpm --filter @jcd-editor/pdf exec playwright install chromium
  ```

## 使い方

```sh
pnpm --filter @jcd-editor/cli start render <input.json> <output.pdf> [--kind rirekisho|shokumukeirekisho]
```

### Options

- `--kind <kind>` (default: `rirekisho`)
  - `rirekisho`: 履歴書
  - `shokumukeirekisho`: 職務経歴書
- `--help`, `-h`: usage を表示する

### Examples

履歴書を生成する (default):

```sh
pnpm --filter @jcd-editor/cli start render ./profile.json ./rirekisho.pdf
```

職務経歴書を生成する:

```sh
pnpm --filter @jcd-editor/cli start render ./profile.json ./shokumukeirekisho.pdf --kind shokumukeirekisho
```

## 終了 code

| code | 意味 |
|------|------|
| 0 | success |
| 1 | usage error (引数不足、unknown option など) |
| 2 | 入力ファイルのエラー (read 失敗、JSON parse 失敗、schema 不一致) |
| 3 | PDF 生成 / 書き出しの失敗 |

## ローカル動作確認

```sh
# サンプル profile を short-profile fixture から生成して試す
pnpm --filter @jcd-editor/cli start render \
  apps/cli/src/__tests__/fixtures/short-profile.json \
  /tmp/short-profile.pdf

# 全 section 入りの長い profile を試す
pnpm --filter @jcd-editor/cli start render \
  apps/cli/src/__tests__/fixtures/long-profile.json \
  /tmp/long-profile.pdf

pnpm --filter @jcd-editor/cli start render \
  apps/cli/src/__tests__/fixtures/long-profile.json \
  /tmp/long-shokumukeirekisho.pdf \
  --kind shokumukeirekisho
```

## privacy / セキュリティ

- 入力 JSON は **完全にローカルで処理** されます。外部送信はありません
- Playwright adapter は次の多層防御を持ちます (`packages/pdf/src/playwright-pdf-adapter.ts` 参照):
  - `page.setContent` のみ使用、`page.goto` は使わない
  - `javaScriptEnabled: false` で Chromium context を起動
  - `data:` / `about:` 以外の URL を `route.abort()` で遮断
  - `<base>` tag を含まない HTML 生成
- 入力 JSON に含まれる写真 (`basics.profilePhoto.source.dataUri`) は data URI として生成 PDF に埋め込まれます。PDF も実履歴書データと同等の機密として扱ってください (詳細は `docs/PRIVACY.md`)

## 制限 (現状の MVP)

- 出力は単一 PDF (履歴書または職務経歴書のどちらか 1 種)
- ページ番号 / footer 等のカスタム要素はサポートしない
- 1 entry が 1 ページに収まらない巨大ケースは強制改ページされる (詳細は `docs/investigations/preview-pagination.md`)
- DOCX / XLSX 出力は対象外

これらは将来の独立 PR で対応する候補です。
