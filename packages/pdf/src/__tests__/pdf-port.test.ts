// PdfPort contract test: local fake adapter で port の型契約と metadata 引き写し
// 挙動を検証する。実 PDF は生成しない、ファイルも書き出さない、Playwright /
// Puppeteer / DOM / fetch も一切使わない。
//
// `PdfRenderMetadata` の optional field (templateId / pageCount) は
// `exactOptionalPropertyTypes: true` 制約のため、値がある時だけ conditional
// spread で出す方針を adapter 側 (本テストの fake / 将来の実 adapter) で統一する。

import { describe, expect, it } from 'vitest';

import type { RenderedDocument } from '@jcd-editor/renderer';

import type { PdfPort, PdfRenderResult } from '../pdf-port';

const baseDocument: RenderedDocument = {
  kind: 'rirekisho',
  title: '履歴書',
  html: '<article>test</article>',
  css: 'body {}',
  metadata: {
    language: 'ja-JP',
    page: { size: 'A4', orientation: 'portrait' },
    templateId: 'rirekisho-basic',
  },
};

const documentWithoutTemplateId: RenderedDocument = {
  kind: 'shokumukeirekisho',
  title: '職務経歴書',
  html: '<article>test</article>',
  css: 'body {}',
  metadata: {
    language: 'ja-JP',
    page: { size: 'A4', orientation: 'portrait' },
  },
};

// 「%PDF」 magic bytes を返すだけの fake (実 PDF と主張しない、shape 検証用)。
const PDF_MAGIC_BYTES = new Uint8Array([0x25, 0x50, 0x44, 0x46]);

const fakePortWithPageCount: PdfPort = {
  async renderPdf(document) {
    return {
      bytes: PDF_MAGIC_BYTES,
      metadata: {
        documentKind: document.kind,
        ...(document.metadata.templateId !== undefined
          ? { templateId: document.metadata.templateId }
          : {}),
        pageCount: 1,
      },
    };
  },
};

const fakePortWithoutPageCount: PdfPort = {
  async renderPdf(document) {
    return {
      bytes: PDF_MAGIC_BYTES,
      metadata: {
        documentKind: document.kind,
        ...(document.metadata.templateId !== undefined
          ? { templateId: document.metadata.templateId }
          : {}),
      },
    };
  },
};

describe('PdfPort contract', () => {
  it('renderPdf は Promise<PdfRenderResult> を返す', async () => {
    const result: PdfRenderResult = await fakePortWithPageCount.renderPdf(baseDocument);
    expect(result).toBeDefined();
  });

  it('bytes が Uint8Array であること', async () => {
    const result = await fakePortWithPageCount.renderPdf(baseDocument);
    expect(result.bytes).toBeInstanceOf(Uint8Array);
  });

  it('metadata.documentKind が input の kind と一致する (rirekisho)', async () => {
    const result = await fakePortWithPageCount.renderPdf(baseDocument);
    expect(result.metadata.documentKind).toBe('rirekisho');
  });

  it('metadata.documentKind が input の kind と一致する (shokumukeirekisho)', async () => {
    const result = await fakePortWithPageCount.renderPdf(documentWithoutTemplateId);
    expect(result.metadata.documentKind).toBe('shokumukeirekisho');
  });

  it('metadata.templateId が RenderedDocument.metadata.templateId を引き写す', async () => {
    const result = await fakePortWithPageCount.renderPdf(baseDocument);
    expect(result.metadata.templateId).toBe('rirekisho-basic');
  });

  it('RenderedDocument.metadata.templateId が undefined なら、結果 metadata に templateId が含まれない (omit pattern)', async () => {
    const result = await fakePortWithPageCount.renderPdf(documentWithoutTemplateId);
    expect('templateId' in result.metadata).toBe(false);
  });

  it('metadata.pageCount は adapter 任意 (省略する fake)', async () => {
    const result = await fakePortWithoutPageCount.renderPdf(baseDocument);
    expect('pageCount' in result.metadata).toBe(false);
  });

  it('metadata.pageCount を返す fake', async () => {
    const result = await fakePortWithPageCount.renderPdf(baseDocument);
    expect(result.metadata.pageCount).toBe(1);
  });
});
