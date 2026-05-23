// Preview 用の完全な HTML document を組み立てる helper。iframe.srcdoc に渡す。
//
// 責務:
//   - `<!doctype html>` から `</html>` までの完全な HTML を生成
//   - `document.title` は `<title>` 内に escape して挿入
//   - `document.css` は `<style>` 内にそのまま注入 (renderer が固定リテラル
//     CSS のみ出力する信頼境界、`</style>` を含む CSS は生成されない前提)
//   - `document.html` は renderer 出力 safe HTML、再 escape しない
//   - `<base>` tag は含めない (relative URL resolution の事故防止)
//   - 親 document の Google Fonts <link> は iframe (srcdoc) に継承されないので
//     `<head>` 内に同じ link 群を入れて自前で fetch する
//
// Not exported from `@jcd-editor/local-web` 公開 (app 内のみ、`private: true`)。

import type { RenderedDocument } from '@jcd-editor/renderer';

import { GOOGLE_FONTS_LINKS } from './_internal/google-fonts';
import { escapeHtml } from './_internal/html-escape';

export const buildPreviewDocument = (document: RenderedDocument): string => {
  return [
    '<!doctype html>',
    '<html lang="ja">',
    '<head>',
    '<meta charset="utf-8">',
    `<title>${escapeHtml(document.title)}</title>`,
    GOOGLE_FONTS_LINKS,
    `<style>${document.css}</style>`,
    '</head>',
    '<body>',
    document.html,
    '</body>',
    '</html>',
  ].join('');
};
