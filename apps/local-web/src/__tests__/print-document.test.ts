import { describe, expect, it } from 'vitest';

import type { RenderedDocument } from '@jcd-editor/renderer';

import { buildPrintDocument } from '../print-document';

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

describe('buildPrintDocument', () => {
  it('<!doctype html> で始まる', () => {
    const html = buildPrintDocument(baseDocument);
    expect(html.startsWith('<!doctype html>')).toBe(true);
  });

  it('document.title が <title> 内で escape される', () => {
    const html = buildPrintDocument({
      ...baseDocument,
      title: 'A & <script>',
    });
    expect(html).toContain('<title>A &amp; &lt;script&gt;</title>');
  });

  it('document.css が <style> タグ内にそのまま注入される', () => {
    const html = buildPrintDocument({
      ...baseDocument,
      css: '@page { size: A4; } body { color: #000; }',
    });
    expect(html).toContain('<style>@page { size: A4; } body { color: #000; }</style>');
  });

  it('document.html が <body> 内にそのまま挿入される', () => {
    const html = buildPrintDocument({
      ...baseDocument,
      html: '<article><h1>履歴書</h1></article>',
    });
    expect(html).toContain('<body><article><h1>履歴書</h1></article>');
  });

  it('window.print() を自動呼び出しする <script> を末尾に含む', () => {
    const html = buildPrintDocument(baseDocument);
    expect(html).toMatch(/<script>[\s\S]*window\.print\(\)[\s\S]*<\/script>/);
  });

  it('afterprint で window.close を試みる', () => {
    const html = buildPrintDocument(baseDocument);
    expect(html).toContain("addEventListener('afterprint'");
    expect(html).toContain('window.close()');
  });

  it('<base> tag を含まない', () => {
    const html = buildPrintDocument(baseDocument);
    expect(html).not.toContain('<base');
  });

  it('Google Fonts (Klee One / Noto Sans JP / Noto Serif JP) の <link> を含む', () => {
    const html = buildPrintDocument(baseDocument);
    expect(html).toContain('fonts.googleapis.com/css2');
    expect(html).toContain('Klee+One');
    expect(html).toContain('Noto+Sans+JP');
    expect(html).toContain('Noto+Serif+JP');
  });

  it('print 前に document.fonts.ready を await する (Web Font 未到着での print を防ぐ)', () => {
    const html = buildPrintDocument(baseDocument);
    expect(html).toContain('document.fonts');
    expect(html).toContain('.ready');
    // fontsReady.then(...).then(... window.print()) のフロー
    expect(html).toMatch(/fontsReady[\s\S]*\.then[\s\S]*window\.print\(\)/);
  });
});
