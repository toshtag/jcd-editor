import { safeParse } from 'valibot';
import { describe, expect, it } from 'vitest';

import { educationSchema } from '../domain/education';
import { safeParseCareerProfile } from '../domain/operations';

const wrapEducation = (education: unknown) =>
  safeParseCareerProfile({
    schemaVersion: 1,
    basics: {},
    educationHistory: [education],
  });

describe('educationSchema (internal)', () => {
  it('全フィールド省略を受理する (draft tolerance)', () => {
    expect(safeParse(educationSchema, {}).success).toBe(true);
  });

  it('institutionName のみを受理する', () => {
    expect(safeParse(educationSchema, { institutionName: '◯◯大学' }).success).toBe(true);
  });

  it('institutionName + faculty + department を受理する', () => {
    expect(
      safeParse(educationSchema, {
        institutionName: '◯◯大学',
        faculty: '工学部',
        department: '情報工学科',
      }).success,
    ).toBe(true);
  });

  it('startDate と endDate がある場合を受理する', () => {
    expect(safeParse(educationSchema, { startDate: '2016-04', endDate: '2020-03' }).success).toBe(
      true,
    );
  });

  it('startDate === endDate を受理する (同月入退学)', () => {
    expect(safeParse(educationSchema, { startDate: '2020-03', endDate: '2020-03' }).success).toBe(
      true,
    );
  });

  it('startDate > endDate を拒否する', () => {
    expect(safeParse(educationSchema, { startDate: '2020-04', endDate: '2016-03' }).success).toBe(
      false,
    );
  });

  it('startDate のみを受理する (draft)', () => {
    expect(safeParse(educationSchema, { startDate: '2016-04' }).success).toBe(true);
  });

  it('endDate のみを受理する (draft)', () => {
    expect(safeParse(educationSchema, { endDate: '2020-03' }).success).toBe(true);
  });

  it('日付なしでも受理する (draft)', () => {
    expect(safeParse(educationSchema, { institutionName: '◯◯大学' }).success).toBe(true);
  });

  it.each([
    '在学中',
    '卒業',
    '卒業見込み',
    '修了',
    '中退',
    '休学',
    '転入',
    '編入',
  ])('status: %s を受理する', (status) => {
    expect(safeParse(educationSchema, { status }).success).toBe(true);
  });

  it('description を受理する', () => {
    expect(safeParse(educationSchema, { description: '機械学習を中心に研究' }).success).toBe(true);
  });

  it('institutionName が空文字なら拒否する', () => {
    expect(safeParse(educationSchema, { institutionName: '' }).success).toBe(false);
  });

  it('institutionName が空白のみなら拒否する', () => {
    expect(safeParse(educationSchema, { institutionName: '   ' }).success).toBe(false);
  });

  it('institutionName の最大長を超えた値を拒否する', () => {
    expect(safeParse(educationSchema, { institutionName: 'あ'.repeat(201) }).success).toBe(false);
  });

  it.each([
    ['faculty', { faculty: '   ' }],
    ['department', { department: '   ' }],
    ['degree', { degree: '   ' }],
    ['status', { status: '   ' }],
    ['description', { description: '   ' }],
  ])('%s が空白のみなら拒否する', (_label, input) => {
    expect(safeParse(educationSchema, input).success).toBe(false);
  });

  it.each([
    '2024-13',
    '2024-00',
    '1899-12',
    '2101-01',
    'not-a-date',
  ])('不正な YYYY-MM (%s) を startDate に持つ場合 reject', (value) => {
    expect(safeParse(educationSchema, { startDate: value }).success).toBe(false);
  });
});

describe('Education via safeParseCareerProfile (public API)', () => {
  it('有効な完全 Education を含む CareerProfile を受理する', () => {
    const result = safeParseCareerProfile({
      schemaVersion: 1,
      basics: {},
      educationHistory: [
        {
          institutionName: '◯◯大学',
          faculty: '工学部',
          department: '情報工学科',
          degree: '学士 (工学)',
          startDate: '2016-04',
          endDate: '2020-03',
          status: '卒業',
          description: '機械学習を専攻',
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('在学中の Education を受理する', () => {
    const result = safeParseCareerProfile({
      schemaVersion: 1,
      basics: {},
      educationHistory: [
        {
          institutionName: '◯◯大学院',
          startDate: '2023-04',
          status: '在学中',
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('institutionName が不正な場合に dot path educationHistory.0.institutionName を含む', () => {
    const result = wrapEducation({ institutionName: '' });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.issues.find((i) => i.path === 'educationHistory.0.institutionName');
      expect(issue).toBeDefined();
    }
  });

  it('endDate が不正な YYYY-MM の場合に dot path educationHistory.0.endDate を含む', () => {
    const result = wrapEducation({
      institutionName: '◯◯大学',
      endDate: '2024-13',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.issues.find((i) => i.path === 'educationHistory.0.endDate');
      expect(issue).toBeDefined();
    }
  });

  it('startDate > endDate で educationHistory.0 レベルの issue を出す', () => {
    const result = wrapEducation({
      institutionName: '◯◯大学',
      startDate: '2020-04',
      endDate: '2016-03',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.issues.find((i) => i.path === 'educationHistory.0');
      expect(issue).toBeDefined();
    }
  });

  it('複数要素のうち一部だけ不正の場合、該当インデックスのみ issue が出る', () => {
    const result = safeParseCareerProfile({
      schemaVersion: 1,
      basics: {},
      educationHistory: [
        { institutionName: '正常な大学' },
        { institutionName: '' },
        { institutionName: '別の正常な大学' },
      ],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const badPaths = result.issues.map((i) => i.path);
      expect(badPaths).toContain('educationHistory.1.institutionName');
      expect(badPaths.every((p) => !p.startsWith('educationHistory.0.'))).toBe(true);
      expect(badPaths.every((p) => !p.startsWith('educationHistory.2.'))).toBe(true);
    }
  });
});
