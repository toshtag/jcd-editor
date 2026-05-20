// Internal HTML escape helper. Not part of the public API.
// Used by renderer implementations within @jcd-editor/renderer.
//
// Scope:
//   - HTML text node
//   - quoted attribute value
//
// 適用しないコンテキスト:
//   - CSS context
//   - URL context (例: <a href="..."> の href 属性 URL の安全な構築)
//   - JavaScript context
//   - raw <style> / <script> の中身
//
// これらのコンテキストは別 policy / 別ヘルパが必要となる。本ヘルパは
// HTML text node と quoted attribute value のみを対象とする。
//
// 既存 entity (例: `&amp;`) は raw user text として扱い、常に escape する
// (二重 escape 回避はしない)。
// 例: `&amp;` を渡すと `&amp;amp;` になる。これは「raw user text を
// 信用しない方が安全側」という意図した挙動。

/** @internal */
export const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
