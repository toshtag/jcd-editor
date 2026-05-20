// PDF 生成に関連する error。
//
// 本 package は port / 型 / error のみを定義し、実 PDF 生成 (Playwright / pdf-lib
// 等の adapter 実装) は行わない。adapter PR で必要な error code を追加していく。
// `RendererError` と同じ流儀 (constructor signature / name 設定 / setPrototypeOf
// による instanceof 安定化) を踏襲する。

export type PdfErrorCode = 'PDF_RENDER_FAILED';

export class PdfError extends Error {
  readonly code: PdfErrorCode;

  constructor(message: string, code: PdfErrorCode) {
    super(message);
    this.name = 'PdfError';
    this.code = code;
    Object.setPrototypeOf(this, PdfError.prototype);
  }
}
