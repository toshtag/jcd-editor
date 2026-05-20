import { describe, expect, it } from 'vitest';

import { PdfError, type PdfErrorCode } from '../errors';

describe('PdfError', () => {
  it('name が "PdfError"', () => {
    const error = new PdfError('message', 'PDF_RENDER_FAILED');
    expect(error.name).toBe('PdfError');
  });

  it('message プロパティを保持する', () => {
    const error = new PdfError('something happened', 'PDF_RENDER_FAILED');
    expect(error.message).toBe('something happened');
  });

  it('code プロパティを保持する', () => {
    const error = new PdfError('message', 'PDF_RENDER_FAILED');
    expect(error.code).toBe('PDF_RENDER_FAILED');
  });

  it('instanceof Error が true', () => {
    const error = new PdfError('message', 'PDF_RENDER_FAILED');
    expect(error).toBeInstanceOf(Error);
  });

  it('instanceof PdfError が true', () => {
    const error = new PdfError('message', 'PDF_RENDER_FAILED');
    expect(error).toBeInstanceOf(PdfError);
  });

  it('throw / catch で instanceof が安定する', () => {
    try {
      throw new PdfError('thrown', 'PDF_RENDER_FAILED');
    } catch (e) {
      expect(e).toBeInstanceOf(PdfError);
      expect(e).toBeInstanceOf(Error);
      if (e instanceof PdfError) {
        expect(e.code).toBe('PDF_RENDER_FAILED');
      }
    }
  });

  it('現状すべての PdfErrorCode を受け付ける', () => {
    // 本 PR では PDF_RENDER_FAILED 1 つのみ。adapter PR で code が増えた時、
    // テストもここに追加する。
    const codes: PdfErrorCode[] = ['PDF_RENDER_FAILED'];
    for (const code of codes) {
      const error = new PdfError(`message for ${code}`, code);
      expect(error.code).toBe(code);
    }
  });
});
