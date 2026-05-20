// PDF rendering 用の完全な HTML document を組み立てる helper。
//
// 責務:
//   - `<!doctype html>` から `</html>` までの完全な HTML を生成
//   - `document.title` は `<title>` 内に escape して挿入
//   - `document.css` は `<style>` 内に**そのまま**注入 (renderer が固定リテラル
//     CSS のみ出力する信頼境界、`</style>` を含む CSS は生成されない前提)
//   - `document.html` は renderer 出力の safe HTML、**再 escape しない**
//   - `<base>` tag は含めない (relative URL resolution の事故防止)
//
// Not exported from `@jcd-editor/pdf` (`_internal/` 配下、private)。

import type { RenderedDocument } from '@jcd-editor/renderer';

import { escapeHtml } from './html-escape';

export const buildPdfHtmlDocument = (document: RenderedDocument): string => {
  return [
    '<!doctype html>',
    '<html lang="ja">',
    '<head>',
    '<meta charset="utf-8">',
    `<title>${escapeHtml(document.title)}</title>`,
    `<style>${document.css}</style>`,
    '</head>',
    '<body>',
    document.html,
    '</body>',
    '</html>',
  ].join('');
};
