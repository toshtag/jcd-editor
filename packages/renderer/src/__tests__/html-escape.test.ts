import { describe, expect, it } from 'vitest';

import { escapeHtml } from '../_internal/html-escape';

describe('escapeHtml', () => {
  it('<script> タグを含む文字列を安全に escape する', () => {
    expect(escapeHtml('<script>alert("x")</script>')).toBe(
      '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;',
    );
  });

  it('単独の & を &amp; に escape する', () => {
    expect(escapeHtml('&')).toBe('&amp;');
  });

  it('単独の < を &lt; に escape する', () => {
    expect(escapeHtml('<')).toBe('&lt;');
  });

  it('単独の > を &gt; に escape する', () => {
    expect(escapeHtml('>')).toBe('&gt;');
  });

  it('単独の " を &quot; に escape する', () => {
    expect(escapeHtml('"')).toBe('&quot;');
  });

  it("単独の ' を &#39; に escape する", () => {
    expect(escapeHtml("'")).toBe('&#39;');
  });

  it('既存 entity (&amp;) も raw user text として扱い、二重 escape する', () => {
    // escape の適用範囲は HTML text node / quoted attribute value に限定し、
    // 既存 entity も raw user text として扱う意図した挙動。
    expect(escapeHtml('&amp;')).toBe('&amp;amp;');
  });

  it('日本語テキストはそのまま保持する', () => {
    expect(escapeHtml('山田太郎')).toBe('山田太郎');
    expect(escapeHtml('株式会社サンプル')).toBe('株式会社サンプル');
  });

  it('改行は escape の対象外として保持する', () => {
    expect(escapeHtml('line1\nline2')).toBe('line1\nline2');
  });

  it('空文字列を空文字列として返す', () => {
    expect(escapeHtml('')).toBe('');
  });

  it('複数の特殊文字を含む混在文字列を正しく escape する', () => {
    expect(escapeHtml(`<a href="x" data-y='z'>A&B</a>`)).toBe(
      '&lt;a href=&quot;x&quot; data-y=&#39;z&#39;&gt;A&amp;B&lt;/a&gt;',
    );
  });
});
