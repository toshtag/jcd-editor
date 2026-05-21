// Minimal HTML escape helper for `<title>` text node usage in preview HTML
// assembly. Not exported from `@jcd-editor/local-web`. 5-character escape
// (& < > " '), matching renderer / pdf packages の policy.

export const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
