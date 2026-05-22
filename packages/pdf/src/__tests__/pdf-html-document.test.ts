import { describe, expect, it } from 'vitest';

import type { RenderedDocument } from '@jcd-editor/renderer';

import { buildPdfHtmlDocument } from '../_internal/pdf-html-document';

const baseDocument: RenderedDocument = {
  kind: 'rirekisho',
  title: '履歴書',
  html: '<article><h1>履歴書</h1></article>',
  css: 'body { font-family: sans-serif; }',
  metadata: {
    language: 'ja-JP',
    page: { size: 'A4', orientation: 'portrait' },
    templateId: 'rirekisho-mhlw-a4',
  },
};

describe('buildPdfHtmlDocument', () => {
  it('<!doctype html> で始まる', () => {
    const html = buildPdfHtmlDocument(baseDocument);
    expect(html.startsWith('<!doctype html>')).toBe(true);
  });

  it('<html lang="ja"> を含む', () => {
    const html = buildPdfHtmlDocument(baseDocument);
    expect(html).toContain('<html lang="ja">');
  });

  it('<meta charset="utf-8"> を含む', () => {
    const html = buildPdfHtmlDocument(baseDocument);
    expect(html).toContain('<meta charset="utf-8">');
  });

  it('document.title が <title> 内に escape されて挿入される', () => {
    const html = buildPdfHtmlDocument(baseDocument);
    expect(html).toContain('<title>履歴書</title>');
  });

  it('document.title に & / < / > / " / \' を含む場合 escape される', () => {
    const html = buildPdfHtmlDocument({
      ...baseDocument,
      title: 'A & <script>"x"\'</script>',
    });
    expect(html).toContain(
      '<title>A &amp; &lt;script&gt;&quot;x&quot;&#39;&lt;/script&gt;</title>',
    );
    expect(html).not.toContain('<script>"x"\'</script>');
  });

  it('document.css が <style> タグ内にそのまま注入される (再 escape されない)', () => {
    const html = buildPdfHtmlDocument({
      ...baseDocument,
      css: '@page { size: A4; margin: 15mm; } body { color: #000; }',
    });
    expect(html).toContain(
      '<style>@page { size: A4; margin: 15mm; } body { color: #000; }</style>',
    );
  });

  it('document.html が <body> 内にそのまま挿入される (再 escape されない)', () => {
    const html = buildPdfHtmlDocument({
      ...baseDocument,
      html: '<article><h1>履歴書</h1><p>サンプル & テスト</p></article>',
    });
    // renderer 出力は safe HTML、再 escape しない
    expect(html).toContain(
      '<body><article><h1>履歴書</h1><p>サンプル & テスト</p></article></body>',
    );
  });

  it('<base> tag を含まない (relative URL resolution 事故防止)', () => {
    const html = buildPdfHtmlDocument(baseDocument);
    expect(html).not.toContain('<base');
  });

  it('</html> で終わる', () => {
    const html = buildPdfHtmlDocument(baseDocument);
    expect(html.endsWith('</html>')).toBe(true);
  });

  it('shokumukeirekisho kind の document も同じ shape で wrap される', () => {
    const html = buildPdfHtmlDocument({
      kind: 'shokumukeirekisho',
      title: '職務経歴書',
      html: '<article>x</article>',
      css: 'body {}',
      metadata: {
        language: 'ja-JP',
        page: { size: 'A4', orientation: 'portrait' },
      },
    });
    expect(html).toContain('<title>職務経歴書</title>');
    expect(html).toContain('<body><article>x</article></body>');
  });
});
