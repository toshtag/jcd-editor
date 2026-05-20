// Playwright integration test: 実 Chromium を起動して PDF bytes を生成する。
//
// 制約 (テスト自体が破壊しない):
// - 外部 URL を含む fixture は使わない (local-first を test 自体が遵守)
// - 実 PDF parse / layout 検証はしない (`%PDF` magic bytes と metadata shape のみ assert)
// - file 書き出しなし
// - per-test timeout 60s (初回 Chromium launch を吸収)
//
// 前提:
// - ローカル開発: `pnpm --filter @jcd-editor/pdf exec playwright install chromium` を初回実行
// - CI: `.github/workflows/ci.yml` に install step あり
// - browser 未 install の場合は test が失敗する (clear error message)

import { describe, expect, it } from 'vitest';

import type { RenderedDocument } from '@jcd-editor/renderer';

import { createPlaywrightPdfAdapter } from '../playwright-pdf-adapter';

const baseFixture: RenderedDocument = {
  kind: 'rirekisho',
  title: '履歴書',
  html: '<article><h1>履歴書</h1><p>サンプルテキスト</p></article>',
  css: '@page { size: A4; margin: 15mm; } body { font-family: sans-serif; font-size: 10.5pt; }',
  metadata: {
    language: 'ja-JP',
    page: { size: 'A4', orientation: 'portrait' },
    templateId: 'rirekisho-basic',
  },
};

const fixtureWithoutTemplateId: RenderedDocument = {
  kind: 'shokumukeirekisho',
  title: '職務経歴書',
  html: '<article><h1>職務経歴書</h1></article>',
  css: '@page { size: A4; }',
  metadata: {
    language: 'ja-JP',
    page: { size: 'A4', orientation: 'portrait' },
  },
};

const PDF_HEADER = [0x25, 0x50, 0x44, 0x46]; // '%PDF'

describe('createPlaywrightPdfAdapter', () => {
  it('PdfPort を満たし renderPdf method を持つ', () => {
    const adapter = createPlaywrightPdfAdapter();
    expect(typeof adapter.renderPdf).toBe('function');
  });

  it('renderPdf が Uint8Array bytes を返す', { timeout: 60_000 }, async () => {
    const adapter = createPlaywrightPdfAdapter();
    const result = await adapter.renderPdf(baseFixture);
    expect(result.bytes).toBeInstanceOf(Uint8Array);
    expect(result.bytes.length).toBeGreaterThan(0);
  });

  it('bytes の先頭 4 bytes が "%PDF" magic header', { timeout: 60_000 }, async () => {
    const adapter = createPlaywrightPdfAdapter();
    const result = await adapter.renderPdf(baseFixture);
    expect(Array.from(result.bytes.slice(0, 4))).toEqual(PDF_HEADER);
  });

  it('metadata.documentKind が input.kind を引き写す (rirekisho)', {
    timeout: 60_000,
  }, async () => {
    const adapter = createPlaywrightPdfAdapter();
    const result = await adapter.renderPdf(baseFixture);
    expect(result.metadata.documentKind).toBe('rirekisho');
  });

  it('metadata.templateId が引き写される (templateId 存在 fixture)', {
    timeout: 60_000,
  }, async () => {
    const adapter = createPlaywrightPdfAdapter();
    const result = await adapter.renderPdf(baseFixture);
    expect(result.metadata.templateId).toBe('rirekisho-basic');
  });

  it('templateId 無 fixture では result metadata に templateId が含まれない (omit pattern)', {
    timeout: 60_000,
  }, async () => {
    const adapter = createPlaywrightPdfAdapter();
    const result = await adapter.renderPdf(fixtureWithoutTemplateId);
    expect('templateId' in result.metadata).toBe(false);
    expect(result.metadata.documentKind).toBe('shokumukeirekisho');
  });

  it('pageCount は本 PR で omit される (metadata に含まれない)', { timeout: 60_000 }, async () => {
    const adapter = createPlaywrightPdfAdapter();
    const result = await adapter.renderPdf(baseFixture);
    expect('pageCount' in result.metadata).toBe(false);
  });
});
