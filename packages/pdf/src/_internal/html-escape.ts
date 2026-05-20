// Minimal HTML escape helper for `<title>` text node usage in PDF html assembly.
// Not exported from `@jcd-editor/pdf`. 5-character escape (& < > " '),
// matching renderer's `_internal/html-escape.ts` policy.
//
// 適用範囲: HTML text node (本 package では `<title>` 内のみ)。
// quoted attribute / CSS / URL / JavaScript context への適用は想定しない。

export const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
