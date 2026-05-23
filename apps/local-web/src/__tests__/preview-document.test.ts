import { describe, expect, it } from 'vitest';

import type { RenderedDocument } from '@jcd-editor/renderer';

import { buildPreviewDocument } from '../preview-document';

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

describe('buildPreviewDocument', () => {
  it('<!doctype html> で始まる', () => {
    const html = buildPreviewDocument(baseDocument);
    expect(html.startsWith('<!doctype html>')).toBe(true);
  });

  it('<html lang="ja"> と <meta charset="utf-8"> を含む', () => {
    const html = buildPreviewDocument(baseDocument);
    expect(html).toContain('<html lang="ja">');
    expect(html).toContain('<meta charset="utf-8">');
  });

  it('document.title が <title> 内で escape される (& / < / > / " / \' すべて)', () => {
    const html = buildPreviewDocument({
      ...baseDocument,
      title: 'A & <script>"x"\'</script>',
    });
    expect(html).toContain(
      '<title>A &amp; &lt;script&gt;&quot;x&quot;&#39;&lt;/script&gt;</title>',
    );
    expect(html).not.toContain('<script>"x"\'</script>');
  });

  it('document.css が <style> タグ内にそのまま注入される (再 escape されない)', () => {
    const html = buildPreviewDocument({
      ...baseDocument,
      css: '@page { size: A4; margin: 15mm; } body { color: #000; }',
    });
    expect(html).toContain(
      '<style>@page { size: A4; margin: 15mm; } body { color: #000; }</style>',
    );
  });

  it('document.html が <body> 内にそのまま挿入される (再 escape されない)', () => {
    const html = buildPreviewDocument({
      ...baseDocument,
      html: '<article><h1>履歴書</h1><p>サンプル & テスト</p></article>',
    });
    expect(html).toContain(
      '<body><article><h1>履歴書</h1><p>サンプル & テスト</p></article></body>',
    );
  });

  it('<base> tag を含まない (relative URL resolution 事故防止)', () => {
    const html = buildPreviewDocument(baseDocument);
    expect(html).not.toContain('<base');
  });

  it('Google Fonts (Noto Serif JP) の <link> を含む', () => {
    const html = buildPreviewDocument(baseDocument);
    expect(html).toContain('fonts.googleapis.com/css2');
    expect(html).toContain('Noto+Serif+JP');
    expect(html).toContain('rel="preconnect"');
  });

  it('公式 PDF では使われていない Klee One / Noto Sans JP は読み込まない', () => {
    const html = buildPreviewDocument(baseDocument);
    expect(html).not.toContain('Klee+One');
    expect(html).not.toContain('Noto+Sans+JP');
  });
});
