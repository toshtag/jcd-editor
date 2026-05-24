import { describe, expect, it } from 'vitest';

import {
  ALLOWED_PHOTO_MIME_TYPES,
  MAX_PHOTO_FILE_BYTES,
  validatePhotoFile,
} from '../profile-photo';

// jsdom には File / Blob があるので直接使う。
const makeFile = (size: number, type: string, name = 'photo'): File => {
  const blob = new Blob([new Uint8Array(size)], { type });
  return new File([blob], name, { type });
};

describe('ALLOWED_PHOTO_MIME_TYPES', () => {
  it('image/jpeg と image/png のみを許可する', () => {
    expect(ALLOWED_PHOTO_MIME_TYPES).toEqual(['image/jpeg', 'image/png']);
  });
});

describe('MAX_PHOTO_FILE_BYTES', () => {
  it('10 MiB に設定されている (スマホ撮影の高解像度写真を受け付けるため、超過分は profile-photo-resize で自動縮小して core schema 上限内に収める。 1024 基底で揃えるのは hint 文言との一貫性のため)', () => {
    expect(MAX_PHOTO_FILE_BYTES).toBe(10 * 1024 * 1024);
  });
});

describe('validatePhotoFile', () => {
  it('image/jpeg かつ小さい size: ok=true', () => {
    const file = makeFile(100_000, 'image/jpeg');
    expect(validatePhotoFile(file)).toEqual({ ok: true });
  });

  it('image/png かつ小さい size: ok=true', () => {
    const file = makeFile(200_000, 'image/png');
    expect(validatePhotoFile(file)).toEqual({ ok: true });
  });

  it('image/gif: ok=false / reason=invalid-mime', () => {
    const file = makeFile(100_000, 'image/gif');
    const result = validatePhotoFile(file);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('invalid-mime');
      expect(result.message).toContain('image/gif');
    }
  });

  it('image/webp: ok=false / reason=invalid-mime', () => {
    const file = makeFile(100_000, 'image/webp');
    const result = validatePhotoFile(file);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('invalid-mime');
  });

  it('application/pdf: ok=false / reason=invalid-mime', () => {
    const file = makeFile(100_000, 'application/pdf');
    const result = validatePhotoFile(file);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('invalid-mime');
  });

  it('MIME type 空 (一部 OS の drop / drag): ok=false / reason=invalid-mime', () => {
    const file = makeFile(100_000, '');
    const result = validatePhotoFile(file);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('invalid-mime');
      expect(result.message).toContain('(MIME type 未指定)');
    }
  });

  it('image/jpeg かつ MAX_PHOTO_FILE_BYTES 超: ok=false / reason=too-large', () => {
    const file = makeFile(MAX_PHOTO_FILE_BYTES + 1, 'image/jpeg');
    const result = validatePhotoFile(file);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('too-large');
      expect(result.message).toContain('上限');
    }
  });

  it('image/jpeg かつ ちょうど MAX_PHOTO_FILE_BYTES: ok=true (境界包含)', () => {
    const file = makeFile(MAX_PHOTO_FILE_BYTES, 'image/jpeg');
    expect(validatePhotoFile(file)).toEqual({ ok: true });
  });

  it('size 0 の jpeg: ok=true (validation は MIME と size 上限のみ、空ファイル自体は core schema 側で reject される)', () => {
    const file = makeFile(0, 'image/jpeg');
    expect(validatePhotoFile(file)).toEqual({ ok: true });
  });

  it('message の format: 大きい size は MB で表示される', () => {
    const file = makeFile(12_582_912, 'image/jpeg'); // 12 MiB
    const result = validatePhotoFile(file);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toMatch(/12\.0 MB/);
    }
  });
});
