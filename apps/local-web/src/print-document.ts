// Print / PDF 用の完全な HTML document を組み立てる helper。
// `window.open` で開く新規 window/tab の Blob URL 用 source として使う。
//
// buildPreviewDocument との違い:
//   - 末尾に <script> を埋め込み、`onload` で `window.print()` を自動呼び出し
//   - `afterprint` event で `window.close()` を試みる
//     (ブラウザ仕様上 user-initiated 以外で close できないケースあり、その場合は
//      ユーザーが自分で tab を閉じる)
//   - `<title>` は PDF 保存時のデフォルトファイル名になるため重要
//   - 親 document の Google Fonts <link> は新 window に継承されないので、
//     `<head>` 内に同じ link 群を入れて自前で fetch する
//   - `document.fonts.ready` を await してから print を呼ぶ (Web Font が
//     未到着のまま print が走ると Times fallback で PDF 化される)
//
// 信頼境界:
//   - renderer 出力 (document.html / document.css) は固定リテラル + escapeHtml
//     済みデータなので再 escape しない
//   - 埋め込む script は static literal (user data を含まない)。XSS surface 無し

import type { RenderedDocument } from '@jcd-editor/renderer';

import { GOOGLE_FONTS_LINKS } from './_internal/google-fonts';
import { escapeHtml } from './_internal/html-escape';

// load 後、フォント読み込み完了を待ってから print を呼ぶ。
// - document.fonts.ready は Web Font の読み込み完了を表す Promise (FontFaceSet)
// - 古い Safari 等で document.fonts が undefined のケースは Promise.resolve()
//   で fallback。フォント無しでもとりあえず print は起動する。
// - print dialog を user がキャンセルした場合も `afterprint` は発火する
const AUTO_PRINT_SCRIPT = `window.addEventListener('load', function () {
  window.addEventListener('afterprint', function () { window.close(); });
  var fontsReady = (document.fonts && document.fonts.ready) || Promise.resolve();
  fontsReady.then(function () { window.print(); });
});`;

export const buildPrintDocument = (document: RenderedDocument): string => {
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
    `<script>${AUTO_PRINT_SCRIPT}</script>`,
    '</body>',
    '</html>',
  ].join('');
};
