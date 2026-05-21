import { describe, expect, it } from 'vitest';

import type { StoredProfileMetadata } from '@jcd-editor/storage';

import { formatStoredProfileOption } from '../storage-ui';

// regex で構造のみ assert (timezone 依存を避けるため厳密な文字列一致はしない)
const FORMAT_PATTERN = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} \([0-9a-fA-F-]{1,8}\)$/;

const buildMetadata = (overrides: Partial<StoredProfileMetadata>): StoredProfileMetadata => ({
  id: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-05-21T14:30:45.000Z',
  schemaVersion: 1,
  ...overrides,
});

describe('formatStoredProfileOption', () => {
  it('updatedAt と id 先頭 8 文字を含む YYYY-MM-DD HH:MM:SS (idPrefix) 形式に format', () => {
    const result = formatStoredProfileOption(buildMetadata({}));
    expect(result).toMatch(FORMAT_PATTERN);
    // id 先頭 8 文字が含まれる
    expect(result).toContain('a1b2c3d4');
  });

  it('month / day / hour / minute / second の 0 padding (single digit を保つ)', () => {
    const result = formatStoredProfileOption(
      buildMetadata({ updatedAt: '2026-01-02T03:04:05.000Z' }),
    );
    expect(result).toMatch(FORMAT_PATTERN);
    // local timezone により時刻部分は変動するが、date 部分 (2026-01-02) は UTC midnight 以降の
    // local timezone 差分次第。最低限 0 padding 形式 (YYYY-MM-DD) になることを構造で確認
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}/);
  });

  it('id の先頭 8 文字のみ抽出される (full UUID 36 文字を含まない)', () => {
    const result = formatStoredProfileOption(buildMetadata({}));
    // full id (36 文字、ハイフン込み) は含まれない
    expect(result).not.toContain('a1b2c3d4-e5f6-7890-1234-567890abcdef');
    // 先頭 8 文字のみ含む
    expect(result).toContain('(a1b2c3d4)');
  });

  it('異なる id でも同じ format pattern を保つ (構造の安定性)', () => {
    const r1 = formatStoredProfileOption(buildMetadata({ id: '11111111-2222-...' }));
    const r2 = formatStoredProfileOption(buildMetadata({ id: 'ffffffff-0000-...' }));
    expect(r1).toMatch(FORMAT_PATTERN);
    expect(r2).toMatch(FORMAT_PATTERN);
    expect(r1).toContain('(11111111)');
    expect(r2).toContain('(ffffffff)');
  });
});
