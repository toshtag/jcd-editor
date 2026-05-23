// 履歴書 template が使う Google Fonts の <link> tag セット。
//
// preview iframe (buildPreviewDocument) と PDF 出力用新 window
// (buildPrintDocument) で同じ font が必要なので一箇所に集約する。
//
// 採用フォント:
//   - Noto Serif JP: 全ての文字 (タイトル / ラベル / 本文 すべて明朝)
//
// 公式 PDF (mhlw-rirekisho-official.pdf) を pdffonts で解析した結果、書類は
// MS-Mincho / MS-PMincho のみで構成される (ゴシック・手書き風は不使用)。
// MS-Mincho は Web Font 配信されていないため、最も近い明朝として Noto Serif JP
// を使い、fallback chain (Yu Mincho / MS Mincho / Hiragino Mincho ProN) は
// template CSS 側で既に指定されている。
//
// display=swap で fallback を先に表示し、Web Font 到着次第差し替える。
//
// 信頼境界: 文字列リテラルのみ (user data なし)。escape 不要。

export const GOOGLE_FONTS_LINKS = [
  '<link rel="preconnect" href="https://fonts.googleapis.com">',
  '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
  '<link href="https://fonts.googleapis.com/css2?family=Noto+Serif+JP&display=swap" rel="stylesheet">',
].join('');
