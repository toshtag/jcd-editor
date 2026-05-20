import { describe, expect, it } from 'vitest';

import { RendererError, type RendererErrorCode } from '../errors';

describe('RendererError', () => {
  it('name が "RendererError"', () => {
    const error = new RendererError('message', 'TEMPLATE_NOT_FOUND');
    expect(error.name).toBe('RendererError');
  });

  it('message プロパティを保持する', () => {
    const error = new RendererError('something happened', 'TEMPLATE_NOT_FOUND');
    expect(error.message).toBe('something happened');
  });

  it('code プロパティを保持する', () => {
    const error = new RendererError('message', 'TEMPLATE_KIND_MISMATCH');
    expect(error.code).toBe('TEMPLATE_KIND_MISMATCH');
  });

  it('instanceof Error が true', () => {
    const error = new RendererError('message', 'TEMPLATE_NOT_FOUND');
    expect(error).toBeInstanceOf(Error);
  });

  it('instanceof RendererError が true', () => {
    const error = new RendererError('message', 'TEMPLATE_NOT_FOUND');
    expect(error).toBeInstanceOf(RendererError);
  });

  it('throw / catch で instanceof が安定する', () => {
    try {
      throw new RendererError('thrown', 'TEMPLATE_AMBIGUOUS');
    } catch (e) {
      expect(e).toBeInstanceOf(RendererError);
      expect(e).toBeInstanceOf(Error);
      if (e instanceof RendererError) {
        expect(e.code).toBe('TEMPLATE_AMBIGUOUS');
      }
    }
  });

  it('5 codes すべてを受け付ける', () => {
    const codes: RendererErrorCode[] = [
      'TEMPLATE_NOT_FOUND',
      'TEMPLATE_KIND_MISMATCH',
      'TEMPLATE_AMBIGUOUS',
      'TEMPLATE_RENDER_KIND_MISMATCH',
      'TEMPLATE_DUPLICATE_ID',
    ];
    for (const code of codes) {
      const error = new RendererError(`message for ${code}`, code);
      expect(error.code).toBe(code);
    }
  });
});
