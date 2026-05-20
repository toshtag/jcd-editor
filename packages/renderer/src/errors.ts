// RendererError は renderer 内部で発生する template 選択・整合性違反を
// 表す。consumer は `err instanceof RendererError && err.code === '...'` の
// 形でプログラマブルに分岐できる。code は string literal union のため、
// 追加は non-breaking、削除は breaking となる。

export type RendererErrorCode =
  | 'TEMPLATE_NOT_FOUND'
  | 'TEMPLATE_KIND_MISMATCH'
  | 'TEMPLATE_AMBIGUOUS'
  | 'TEMPLATE_RENDER_KIND_MISMATCH'
  | 'TEMPLATE_DUPLICATE_ID';

export class RendererError extends Error {
  readonly code: RendererErrorCode;

  constructor(message: string, code: RendererErrorCode) {
    super(message);
    this.name = 'RendererError';
    this.code = code;
    Object.setPrototypeOf(this, RendererError.prototype);
  }
}
