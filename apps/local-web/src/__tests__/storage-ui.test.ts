import { describe, expect, it } from 'vitest';

import type { StoredProfileMetadata } from '@jcd-editor/storage';

import { formatStoredProfileOption } from '../storage-ui';

const buildMetadata = (overrides: Partial<StoredProfileMetadata>): StoredProfileMetadata => ({
  id: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
  name: '',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-05-21T14:30:45.000Z',
  schemaVersion: 1,
  ...overrides,
});

describe('formatStoredProfileOption', () => {
  it('名前を主軸に表示する', () => {
    const result = formatStoredProfileOption(buildMetadata({ name: 'A 社用' }));
    expect(result.startsWith('A 社用')).toBe(true);
  });

  it('名前が空なら (名称未設定)', () => {
    const result = formatStoredProfileOption(buildMetadata({ name: '' }));
    expect(result).toContain('(名称未設定)');
  });

  it('未確定 (committedAt 無し) なら ● 未確定 マークと更新日時', () => {
    const result = formatStoredProfileOption(buildMetadata({ name: 'A 社用' }));
    expect(result).toContain('● 未確定');
    expect(result).toContain('更新');
  });

  it('未確定 (committedAt < updatedAt) でも ● 未確定', () => {
    const result = formatStoredProfileOption(
      buildMetadata({ name: 'A 社用', committedAt: '2026-05-20T00:00:00.000Z' }),
    );
    expect(result).toContain('● 未確定');
  });

  it('確定済み (committedAt >= updatedAt) なら マーク無しで確定日時', () => {
    const result = formatStoredProfileOption(
      buildMetadata({ name: 'A 社用', committedAt: '2026-05-21T14:30:45.000Z' }),
    );
    expect(result).not.toContain('● 未確定');
    expect(result).toContain('確定');
  });

  it('日時は YYYY-MM-DD HH:MM 形式 (0 padding)', () => {
    const result = formatStoredProfileOption(
      buildMetadata({ name: 'x', updatedAt: '2026-01-02T03:04:05.000Z' }),
    );
    expect(result).toMatch(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}/);
  });
});
