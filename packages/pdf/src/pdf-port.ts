// PDF 生成 port + 型定義。本 package は実 PDF 生成 (Playwright / pdf-lib 等) を
// 含まない。本 PR で導入される shape は **provisional** であり、実 adapter PR
// (`feat/pdf-playwright-adapter`) で実装目線の見直しを行い、後方互換しない変更
// を許容する。
//
// 設計判断:
//
// - **`PdfPort`** という名前は `docs/ARCHITECTURE.md` / `docs/ROADMAP.md` Phase 5
//   と整合する (hexagonal architecture の `*Port` 命名)。
// - method 名は **`renderPdf`** (renderer の `renderDocument` と対の動詞)。
// - 引数は `document: RenderedDocument` の **positional 1 引数のみ**。options は
//   本 PR で定義しない (YAGNI)。必要になった adapter PR で第 2 引数として追加。
// - 戻り値 bytes は **`Uint8Array`** (Node `fs.writeFile` / Web `Blob` / `Response`
//   いずれにも適合)。
// - `PdfRenderMetadata` の optional field (`templateId` / `pageCount`) は
//   `exactOptionalPropertyTypes: true` 制約のため、adapter 実装側で「値がある時
//   だけ spread する」conditional spread を使う (直接 `string | undefined` を
//   `string` 型 field に代入できない)。
//
// 依存方向:
//
// - `@jcd-editor/pdf` → `@jcd-editor/renderer` (本ファイルが type-only import)
// - renderer から本 package への逆依存は禁止 (ARCHITECTURE.md 規則 12)
// - `CareerProfile` への直接依存も禁止 (ARCHITECTURE.md line 57)

import type { DocumentKind, RenderedDocument } from '@jcd-editor/renderer';

export type PdfRenderMetadata = {
  documentKind: DocumentKind;
  templateId?: string;
  pageCount?: number;
};

export type PdfRenderResult = {
  bytes: Uint8Array;
  metadata: PdfRenderMetadata;
};

export type PdfPort = {
  renderPdf(document: RenderedDocument): Promise<PdfRenderResult>;
};
