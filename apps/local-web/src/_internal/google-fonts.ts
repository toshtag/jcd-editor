// 履歴書 template が使う Google Fonts の <link> tag セット。
//
// preview iframe (buildPreviewDocument) と PDF 出力用新 window
// (buildPrintDocument) で同じ font が必要なので一箇所に集約する。
//
// 採用フォント:
//   - Noto Serif JP: 本文明朝 (氏名 / 住所 / 学歴職歴 / 志望動機 …)
//   - Noto Sans JP: ゴシック系ラベル (ふりがな / ※性別 / 写真欄案内 …)
//   - Klee One: 「履歴書」タイトル (手書き風)
//
// 1 つの css2 endpoint で 3 family まとめて取得。display=swap で fallback
// chain (Yu Mincho / Hiragino / Times) を先に表示し、Web Font 到着次第差し替える。
//
// 信頼境界: 文字列リテラルのみ (user data なし)。escape 不要。

export const GOOGLE_FONTS_LINKS = [
  '<link rel="preconnect" href="https://fonts.googleapis.com">',
  '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
  '<link href="https://fonts.googleapis.com/css2?family=Klee+One&family=Noto+Sans+JP&family=Noto+Serif+JP&display=swap" rel="stylesheet">',
].join('');
