// Print / PDF 用の完全な HTML document を組み立てる helper。
// `window.open` で開く新規 window/tab の Blob URL 用 source として使う。
//
// buildPreviewDocument との違い:
//   - 末尾に <script> を埋め込み、`onload` で `window.print()` を自動呼び出し
//   - `afterprint` event で `window.close()` を試みる
//     (ブラウザ仕様上 user-initiated 以外で close できないケースあり、その場合は
//      ユーザーが自分で tab を閉じる)
//   - `<title>` は PDF 保存時のデフォルトファイル名になるため重要
//
// 信頼境界:
//   - renderer 出力 (document.html / document.css) は固定リテラル + escapeHtml
//     済みデータなので再 escape しない
//   - 埋め込む script は static literal (user data を含まない)。XSS surface 無し

import type { RenderedDocument } from '@jcd-editor/renderer';

import { escapeHtml } from './_internal/html-escape';

// load 後に print を呼ぶ small bootstrap。最小限の logic に留める。
// - `window.print()` は同期 modal を起動する。`afterprint` event で close
// - print dialog を user がキャンセルした場合も `afterprint` は発火する
const AUTO_PRINT_SCRIPT = `window.addEventListener('load', function () {
  window.addEventListener('afterprint', function () { window.close(); });
  window.print();
});`;

export const buildPrintDocument = (document: RenderedDocument): string => {
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
    `<script>${AUTO_PRINT_SCRIPT}</script>`,
    '</body>',
    '</html>',
  ].join('');
};
