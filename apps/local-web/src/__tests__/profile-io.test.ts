import { describe, expect, it } from 'vitest';

import { parseCareerProfile, type CareerProfile } from '@jcd-editor/core';

import {
  buildExportFileName,
  parseJsonImport,
  serializeProfileToJson,
  type ImportResult,
} from '../profile-io';

const validProfileInput = {
  schemaVersion: 1,
  basics: {
    name: { family: '山田', given: '太郎' },
    nameKana: { family: 'ヤマダ', given: 'タロウ' },
    email: 'taro.yamada@example.com',
  },
  workExperiences: [
    {
      companyName: '株式会社サンプル',
      period: { startDate: '2020-04', isCurrent: true },
    },
  ],
  educationHistory: [
    {
      institutionName: 'サンプル大学',
      startDate: '2016-04',
      endDate: '2020-03',
      status: '卒業',
    },
  ],
};

const buildValidProfile = (): CareerProfile => parseCareerProfile(validProfileInput);

describe('serializeProfileToJson', () => {
  it('CareerProfile を indent 2 の JSON 文字列に直列化する', () => {
    const profile = buildValidProfile();
    const text = serializeProfileToJson(profile);
    expect(text).toContain('"schemaVersion": 1');
    expect(text).toContain('"family": "山田"');
    // indent 2 の存在確認 (2 空白の前置)
    expect(text).toMatch(/\n {2}"basics":/);
  });

  it('出力は JSON.parse 可能で round-trip しても plain object として一致する', () => {
    const profile = buildValidProfile();
    const text = serializeProfileToJson(profile);
    const reparsed = JSON.parse(text);
    expect(reparsed).toEqual(JSON.parse(JSON.stringify(profile)));
  });
});

describe('parseJsonImport', () => {
  it('valid な CareerProfile JSON: ok=true で profile を返す', () => {
    const text = JSON.stringify(validProfileInput);
    const result = parseJsonImport(text);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.profile.basics.name?.family).toBe('山田');
      expect(result.profile.workExperiences?.[0]?.companyName).toBe('株式会社サンプル');
    }
  });

  it('serializeProfileToJson との round-trip で同じ内容に復元される', () => {
    const profile = buildValidProfile();
    const text = serializeProfileToJson(profile);
    const result = parseJsonImport(text);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(JSON.parse(JSON.stringify(result.profile))).toEqual(
        JSON.parse(JSON.stringify(profile)),
      );
    }
  });

  it('malformed JSON: ok=false / kind=invalid-json / message を返す', () => {
    const result = parseJsonImport('{ not valid json');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.kind).toBe('invalid-json');
      if (result.kind === 'invalid-json') {
        expect(result.message.length).toBeGreaterThan(0);
      }
    }
  });

  it('JSON は valid だが schema 不一致: ok=false / kind=schema-mismatch / issues を返す', () => {
    // birthDate は IsoDateString のみ受け入れる。invalid な値で reject させる。
    const invalidInput = {
      schemaVersion: 1,
      basics: { birthDate: '1800-01-01' },
    };
    const result = parseJsonImport(JSON.stringify(invalidInput));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.kind).toBe('schema-mismatch');
      if (result.kind === 'schema-mismatch') {
        expect(result.issues.length).toBeGreaterThan(0);
        expect(result.issues[0]?.path).toBeDefined();
      }
    }
  });

  it('schemaVersion 不一致: ok=false / kind=schema-mismatch', () => {
    const result = parseJsonImport(JSON.stringify({ schemaVersion: 999, basics: {} }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.kind).toBe('schema-mismatch');
    }
  });

  it('完全な空 string: ok=false / kind=invalid-json', () => {
    const result = parseJsonImport('');
    const expected: Pick<Extract<ImportResult, { ok: false }>, 'ok' | 'kind'> = {
      ok: false,
      kind: 'invalid-json',
    };
    expect(result.ok).toBe(expected.ok);
    if (!result.ok) {
      expect(result.kind).toBe(expected.kind);
    }
  });
});

describe('buildExportFileName', () => {
  it('profileId 指定あり: 先頭 8 文字 + 日付', () => {
    const date = new Date(2026, 4, 21); // 2026-05-21 (month は 0-indexed)
    expect(buildExportFileName('abcdef01234567890', date)).toBe('profile-abcdef01-2026-05-21.json');
  });

  it('profileId undefined (未保存): draft prefix', () => {
    const date = new Date(2026, 4, 21);
    expect(buildExportFileName(undefined, date)).toBe('profile-draft-2026-05-21.json');
  });

  it('日付の月日が 1 桁: zero-pad される', () => {
    const date = new Date(2026, 0, 5); // 2026-01-05
    expect(buildExportFileName('abc', date)).toBe('profile-abc-2026-01-05.json');
  });

  it('profileId が 8 文字未満: そのまま使う', () => {
    const date = new Date(2026, 4, 21);
    expect(buildExportFileName('abc', date)).toBe('profile-abc-2026-05-21.json');
  });
});
