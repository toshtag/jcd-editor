// Playwright を用いた local PDF adapter。`PdfPort` を満たす。
//
// 設計判断 (本 PR 固定、変更には新 PR が必要):
//
// - factory only export (`createPlaywrightPdfAdapter`)、class は export しない
//   - `createTemplateRegistry` (renderer) と同じ流儀
//   - 状態を持たない (browser はメソッド呼び出しごとに起動・破棄)
// - options 型を定義しない (YAGNI、Playwright knob は内部 hard-coded)
// - browser pooling / caching は行わない (UI 統合時に再評価)
// - pageCount は本 PR で omit (Playwright `page.pdf()` から安く取れない)
//
// local-first 多層防御:
//
// 1. `page.setContent` のみ使用、`page.goto` は使わない
// 2. `javaScriptEnabled: false` で context 起動
// 3. request routing で `data:` / `about:` 以外を `route.abort()`
// 4. `<base>` tag を含まない HTML 生成 (`_internal/pdf-html-document.ts`)
// 5. adapter options で URL を受け付けない (options 自体無し)

import { chromium, type Browser } from 'playwright';

import type { RenderedDocument } from '@jcd-editor/renderer';

import { buildPdfHtmlDocument } from './_internal/pdf-html-document';
import { PdfError } from './errors';
import type { PdfPort, PdfRenderResult } from './pdf-port';

const renderPdfWithPlaywright = async (document: RenderedDocument): Promise<PdfRenderResult> => {
  const html = buildPdfHtmlDocument(document);

  let browser: Browser | undefined;
  try {
    browser = await chromium.launch();
    const context = await browser.newContext({ javaScriptEnabled: false });
    await context.route('**/*', (route) => {
      const url = route.request().url();
      if (url.startsWith('data:') || url.startsWith('about:')) {
        return route.continue();
      }
      return route.abort();
    });
    const page = await context.newPage();
    await page.setContent(html, { waitUntil: 'load' });
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
    });
    return {
      bytes: new Uint8Array(pdfBuffer),
      metadata: {
        documentKind: document.kind,
        ...(document.metadata.templateId !== undefined
          ? { templateId: document.metadata.templateId }
          : {}),
      },
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new PdfError(`PDF rendering failed: ${detail}`, 'PDF_RENDER_FAILED');
  } finally {
    if (browser !== undefined) {
      await browser.close().catch(() => undefined);
    }
  }
};

export const createPlaywrightPdfAdapter = (): PdfPort => ({
  renderPdf: renderPdfWithPlaywright,
});
