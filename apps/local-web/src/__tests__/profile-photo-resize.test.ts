// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';

import { resizePhotoToDataUri } from '../profile-photo-resize';

const makeFile = (size: number, type: string, name = 'photo'): File => {
  const blob = new Blob([new Uint8Array(size)], { type });
  return new File([blob], name, { type });
};

describe('resizePhotoToDataUri', () => {
  it('小さい file (< 3MB) は decode 経由せず即 data URI を返す (resized=false)', async () => {
    // 100KB の "PNG" (中身は valid ではないが、 fast-path は size 判定のみで
    // 通過するので問題ない)
    const file = makeFile(100_000, 'image/png', 'small.png');
    const result = await resizePhotoToDataUri(file);
    expect(result.resized).toBe(false);
    expect(result.mediaType).toBe('image/png');
    expect(result.dataUri.startsWith('data:image/png;base64,')).toBe(true);
  });

  it('JPEG の小さい file: mediaType=image/jpeg を保つ', async () => {
    const file = makeFile(500_000, 'image/jpeg', 'small.jpg');
    const result = await resizePhotoToDataUri(file);
    expect(result.resized).toBe(false);
    expect(result.mediaType).toBe('image/jpeg');
  });

  it('返される data URI の length が core schema 上限 (5,000,000 chars) 未満', async () => {
    // SKIP_DECODE_MAX_BYTES (3MB) ちょうど。base64 化で約 4MB chars。
    const file = makeFile(3_000_000, 'image/jpeg', 'borderline.jpg');
    const result = await resizePhotoToDataUri(file);
    expect(result.dataUri.length).toBeLessThan(5_000_000);
  });
});
