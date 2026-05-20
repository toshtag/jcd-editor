import { safeParse } from 'valibot';
import { describe, expect, it } from 'vitest';

import { safeParseCareerProfile } from '../domain/operations';
import { workExperienceSchema, workPeriodSchema } from '../domain/work-experience';

const wrap = (workExperience: unknown) =>
  safeParseCareerProfile({
    schemaVersion: 1,
    basics: {},
    workExperiences: [workExperience],
  });

describe('workPeriodSchema (internal)', () => {
  it('全フィールド省略を受理する', () => {
    expect(safeParse(workPeriodSchema, {}).success).toBe(true);
  });

  it('startDate のみを受理する', () => {
    expect(safeParse(workPeriodSchema, { startDate: '2020-04' }).success).toBe(true);
  });

  it('endDate のみを受理する (draft tolerance)', () => {
    expect(safeParse(workPeriodSchema, { endDate: '2023-03' }).success).toBe(true);
  });

  it('startDate < endDate を受理する', () => {
    expect(safeParse(workPeriodSchema, { startDate: '2020-04', endDate: '2023-03' }).success).toBe(
      true,
    );
  });

  it('startDate === endDate を受理する (同月入退社)', () => {
    expect(safeParse(workPeriodSchema, { startDate: '2020-04', endDate: '2020-04' }).success).toBe(
      true,
    );
  });

  it('startDate > endDate を拒否する', () => {
    expect(safeParse(workPeriodSchema, { startDate: '2023-04', endDate: '2020-03' }).success).toBe(
      false,
    );
  });

  it('isCurrent: true + endDate なしを受理する', () => {
    expect(safeParse(workPeriodSchema, { startDate: '2020-04', isCurrent: true }).success).toBe(
      true,
    );
  });

  it('isCurrent: true + endDate ありを拒否する', () => {
    expect(
      safeParse(workPeriodSchema, {
        startDate: '2020-04',
        endDate: '2023-03',
        isCurrent: true,
      }).success,
    ).toBe(false);
  });

  it('isCurrent: false + endDate ありを受理する', () => {
    expect(
      safeParse(workPeriodSchema, {
        startDate: '2020-04',
        endDate: '2023-03',
        isCurrent: false,
      }).success,
    ).toBe(true);
  });

  it('isCurrent: false + endDate なしを受理する', () => {
    expect(safeParse(workPeriodSchema, { startDate: '2020-04', isCurrent: false }).success).toBe(
      true,
    );
  });

  it.each([
    '2024-13',
    '2024-00',
    '1899-12',
    '2101-01',
  ])('不正な YYYY-MM (%s) を startDate に持つ場合 reject', (value) => {
    expect(safeParse(workPeriodSchema, { startDate: value }).success).toBe(false);
  });
});

describe('workExperienceSchema (internal)', () => {
  it('全フィールド省略を受理する (draft tolerance)', () => {
    expect(safeParse(workExperienceSchema, {}).success).toBe(true);
  });

  it('companyName のみを受理する', () => {
    expect(safeParse(workExperienceSchema, { companyName: '株式会社サンプル' }).success).toBe(true);
  });

  it('companyName が空文字なら拒否する', () => {
    expect(safeParse(workExperienceSchema, { companyName: '' }).success).toBe(false);
  });

  it('companyName が空白のみなら拒否する', () => {
    expect(safeParse(workExperienceSchema, { companyName: '   ' }).success).toBe(false);
  });

  it('companyName の最大長を超えた値を拒否する', () => {
    expect(safeParse(workExperienceSchema, { companyName: 'あ'.repeat(201) }).success).toBe(false);
  });

  it('responsibilities の空配列を受理する', () => {
    expect(safeParse(workExperienceSchema, { responsibilities: [] }).success).toBe(true);
  });

  it('responsibilities に空文字を含む場合は拒否する', () => {
    expect(safeParse(workExperienceSchema, { responsibilities: [''] }).success).toBe(false);
  });

  it('responsibilities に空白のみの要素を含む場合は拒否する', () => {
    expect(safeParse(workExperienceSchema, { responsibilities: ['   '] }).success).toBe(false);
  });

  it('responsibilities の配列要素最大長を超える場合は拒否する', () => {
    expect(safeParse(workExperienceSchema, { responsibilities: ['x'.repeat(501)] }).success).toBe(
      false,
    );
  });

  it('responsibilities の配列件数が最大を超える場合は拒否する', () => {
    const tooMany = Array.from({ length: 51 }, (_, i) => `項目${i}`);
    expect(safeParse(workExperienceSchema, { responsibilities: tooMany }).success).toBe(false);
  });

  it('period に不正な順序を含む場合は拒否する', () => {
    expect(
      safeParse(workExperienceSchema, {
        period: { startDate: '2023-04', endDate: '2020-03' },
      }).success,
    ).toBe(false);
  });
});

describe('WorkExperience via safeParseCareerProfile (public API)', () => {
  it('有効な WorkExperience を含む CareerProfile を受理する', () => {
    const result = safeParseCareerProfile({
      schemaVersion: 1,
      basics: {},
      workExperiences: [
        {
          companyName: '株式会社サンプル',
          position: 'シニアエンジニア',
          employmentType: '正社員',
          period: { startDate: '2020-04', endDate: '2023-03' },
          summary: 'バックエンド開発を担当',
          responsibilities: ['API 設計', 'コードレビュー'],
          achievements: ['応答時間を 50% 短縮'],
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('在職中 (isCurrent: true) の WorkExperience を受理する', () => {
    const result = safeParseCareerProfile({
      schemaVersion: 1,
      basics: {},
      workExperiences: [
        {
          companyName: '株式会社サンプル',
          period: { startDate: '2023-04', isCurrent: true },
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('在職中 + endDate ありで拒否し、dot path を含む', () => {
    const result = wrap({
      companyName: '株式会社サンプル',
      period: { startDate: '2023-04', endDate: '2024-03', isCurrent: true },
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.issues.find((i) => i.path.startsWith('workExperiences.0.period'));
      expect(issue).toBeDefined();
    }
  });

  it('空文字の companyName で拒否し、dot path workExperiences.0.companyName を含む', () => {
    const result = wrap({ companyName: '' });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.issues.find((i) => i.path === 'workExperiences.0.companyName');
      expect(issue).toBeDefined();
    }
  });

  it('responsibilities.0 の異常を dot path で報告する', () => {
    const result = wrap({ responsibilities: [''] });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.issues.find((i) => i.path === 'workExperiences.0.responsibilities.0');
      expect(issue).toBeDefined();
    }
  });

  it('複数要素のうち一部だけ不正の場合、該当インデックスのみ issue が出る', () => {
    const result = safeParseCareerProfile({
      schemaVersion: 1,
      basics: {},
      workExperiences: [
        { companyName: '正常な会社' },
        { companyName: '' },
        { companyName: '別の正常な会社' },
      ],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const badPaths = result.issues.map((i) => i.path);
      expect(badPaths).toContain('workExperiences.1.companyName');
      expect(badPaths.every((p) => !p.startsWith('workExperiences.0.'))).toBe(true);
      expect(badPaths.every((p) => !p.startsWith('workExperiences.2.'))).toBe(true);
    }
  });
});
