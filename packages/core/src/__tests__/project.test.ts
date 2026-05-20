import { safeParse } from 'valibot';
import { describe, expect, it } from 'vitest';

import { safeParseCareerProfile } from '../domain/operations';
import { projectSchema } from '../domain/project';

const wrapProject = (project: unknown) =>
  safeParseCareerProfile({
    schemaVersion: 1,
    basics: {},
    projects: [project],
  });

describe('projectSchema (internal)', () => {
  it('全フィールド省略を受理する (draft tolerance)', () => {
    expect(safeParse(projectSchema, {}).success).toBe(true);
  });

  it('name のみを受理する', () => {
    expect(safeParse(projectSchema, { name: '在庫管理システム刷新' }).success).toBe(true);
  });

  it('name + organizationName を受理する', () => {
    expect(
      safeParse(projectSchema, {
        name: '在庫管理システム刷新',
        organizationName: '株式会社サンプル',
      }).success,
    ).toBe(true);
  });

  it.each([
    '株式会社サンプル',
    '自社内 (◯◯部)',
    '個人開発',
    'OSS - example-project',
    '非営利団体 ◯◯',
  ])('多様な organizationName (%s) を受理する', (organizationName) => {
    expect(safeParse(projectSchema, { organizationName }).success).toBe(true);
  });

  it('role を受理する', () => {
    expect(safeParse(projectSchema, { role: 'テックリード' }).success).toBe(true);
  });

  it('summary を受理する', () => {
    expect(safeParse(projectSchema, { summary: 'バックエンド全体の設計と実装' }).success).toBe(
      true,
    );
  });

  it('responsibilities を受理する', () => {
    expect(
      safeParse(projectSchema, { responsibilities: ['API 設計', 'コードレビュー'] }).success,
    ).toBe(true);
  });

  it('achievements を受理する', () => {
    expect(safeParse(projectSchema, { achievements: ['応答時間を 50% 短縮'] }).success).toBe(true);
  });

  it('technologies を受理する', () => {
    expect(
      safeParse(projectSchema, {
        technologies: ['TypeScript', 'Next.js', 'PostgreSQL'],
      }).success,
    ).toBe(true);
  });

  it('startDate < endDate を受理する', () => {
    expect(safeParse(projectSchema, { startDate: '2020-04', endDate: '2023-03' }).success).toBe(
      true,
    );
  });

  it('startDate === endDate を受理する', () => {
    expect(safeParse(projectSchema, { startDate: '2020-04', endDate: '2020-04' }).success).toBe(
      true,
    );
  });

  it('startDate > endDate を拒否する', () => {
    expect(safeParse(projectSchema, { startDate: '2023-04', endDate: '2020-03' }).success).toBe(
      false,
    );
  });

  it('isCurrent: true + endDate なしを受理する', () => {
    expect(safeParse(projectSchema, { startDate: '2023-04', isCurrent: true }).success).toBe(true);
  });

  it('isCurrent: true + endDate ありを拒否する', () => {
    expect(
      safeParse(projectSchema, {
        startDate: '2020-04',
        endDate: '2023-03',
        isCurrent: true,
      }).success,
    ).toBe(false);
  });

  it('isCurrent: false + endDate ありを受理する', () => {
    expect(
      safeParse(projectSchema, {
        startDate: '2020-04',
        endDate: '2023-03',
        isCurrent: false,
      }).success,
    ).toBe(true);
  });

  it('startDate のみを受理する (draft)', () => {
    expect(safeParse(projectSchema, { startDate: '2020-04' }).success).toBe(true);
  });

  it('endDate のみを受理する (draft)', () => {
    expect(safeParse(projectSchema, { endDate: '2023-03' }).success).toBe(true);
  });

  it('日付なしでも受理する (draft)', () => {
    expect(safeParse(projectSchema, { name: 'プロジェクト X' }).success).toBe(true);
  });

  it('name が空文字なら拒否する', () => {
    expect(safeParse(projectSchema, { name: '' }).success).toBe(false);
  });

  it('name が空白のみなら拒否する', () => {
    expect(safeParse(projectSchema, { name: '   ' }).success).toBe(false);
  });

  it('name の最大長を超えた値を拒否する', () => {
    expect(safeParse(projectSchema, { name: 'あ'.repeat(201) }).success).toBe(false);
  });

  it.each([
    ['organizationName', { organizationName: '   ' }],
    ['role', { role: '   ' }],
    ['summary', { summary: '   ' }],
  ])('%s が空白のみなら拒否する', (_label, input) => {
    expect(safeParse(projectSchema, input).success).toBe(false);
  });

  it('responsibilities の空配列を受理する', () => {
    expect(safeParse(projectSchema, { responsibilities: [] }).success).toBe(true);
  });

  it('responsibilities に空文字を含む場合は拒否する', () => {
    expect(safeParse(projectSchema, { responsibilities: [''] }).success).toBe(false);
  });

  it('responsibilities に空白のみの要素を含む場合は拒否する', () => {
    expect(safeParse(projectSchema, { responsibilities: ['   '] }).success).toBe(false);
  });

  it('responsibilities の配列要素最大長 (501 文字) を超える場合は拒否する', () => {
    expect(safeParse(projectSchema, { responsibilities: ['x'.repeat(501)] }).success).toBe(false);
  });

  it('responsibilities の配列件数 (51 件) が最大を超える場合は拒否する', () => {
    const tooMany = Array.from({ length: 51 }, (_, i) => `担当業務${i}`);
    expect(safeParse(projectSchema, { responsibilities: tooMany }).success).toBe(false);
  });

  it('achievements に空白のみの要素を含む場合は拒否する', () => {
    expect(safeParse(projectSchema, { achievements: ['   '] }).success).toBe(false);
  });

  it('technologies に空白のみの要素を含む場合は拒否する', () => {
    expect(safeParse(projectSchema, { technologies: ['   '] }).success).toBe(false);
  });

  it('technologies の配列要素最大長 (101 文字) を超える場合は拒否する', () => {
    expect(safeParse(projectSchema, { technologies: ['x'.repeat(101)] }).success).toBe(false);
  });

  it('technologies の配列件数 (101 件) が最大を超える場合は拒否する', () => {
    const tooMany = Array.from({ length: 101 }, (_, i) => `tech${i}`);
    expect(safeParse(projectSchema, { technologies: tooMany }).success).toBe(false);
  });

  it.each([
    '2024-13',
    '2024-00',
    '1899-12',
    '2101-01',
    'not-a-date',
  ])('不正な YYYY-MM (%s) を startDate に持つ場合 reject', (value) => {
    expect(safeParse(projectSchema, { startDate: value }).success).toBe(false);
  });
});

describe('Project via safeParseCareerProfile (public API)', () => {
  it('有効な完全 Project を含む CareerProfile を受理する', () => {
    const result = safeParseCareerProfile({
      schemaVersion: 1,
      basics: {},
      projects: [
        {
          name: '在庫管理システム刷新',
          organizationName: '株式会社サンプル',
          role: 'テックリード',
          startDate: '2020-04',
          endDate: '2023-03',
          isCurrent: false,
          summary: 'レガシー在庫管理を Next.js + GraphQL で刷新',
          responsibilities: ['アーキテクチャ設計', 'コードレビュー'],
          achievements: ['応答時間を 50% 短縮', 'デプロイ頻度を週 1 → 日 5 へ'],
          technologies: ['TypeScript', 'Next.js', 'GraphQL', 'PostgreSQL'],
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('進行中 (isCurrent: true) の Project を受理する', () => {
    const result = safeParseCareerProfile({
      schemaVersion: 1,
      basics: {},
      projects: [
        {
          name: '新規プロダクト開発',
          organizationName: '個人開発',
          startDate: '2024-01',
          isCurrent: true,
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('name が不正な場合に dot path projects.0.name を含む', () => {
    const result = wrapProject({ name: '' });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.issues.find((i) => i.path === 'projects.0.name');
      expect(issue).toBeDefined();
    }
  });

  it('endDate が不正な YYYY-MM の場合に dot path projects.0.endDate を含む', () => {
    const result = wrapProject({
      name: 'プロジェクト X',
      endDate: '2024-13',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.issues.find((i) => i.path === 'projects.0.endDate');
      expect(issue).toBeDefined();
    }
  });

  it('startDate > endDate で projects.0 レベルの issue を出す', () => {
    const result = wrapProject({
      name: 'プロジェクト X',
      startDate: '2023-04',
      endDate: '2020-03',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.issues.find((i) => i.path === 'projects.0');
      expect(issue).toBeDefined();
    }
  });

  it('responsibilities.0 の異常を dot path で報告する', () => {
    const result = wrapProject({ responsibilities: [''] });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.issues.find((i) => i.path === 'projects.0.responsibilities.0');
      expect(issue).toBeDefined();
    }
  });

  it('technologies.0 の異常を dot path で報告する', () => {
    const result = wrapProject({ technologies: [''] });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.issues.find((i) => i.path === 'projects.0.technologies.0');
      expect(issue).toBeDefined();
    }
  });

  it('複数要素のうち一部だけ不正の場合、該当インデックスのみ issue が出る', () => {
    const result = safeParseCareerProfile({
      schemaVersion: 1,
      basics: {},
      projects: [{ name: '正常なプロジェクト 1' }, { name: '' }, { name: '正常なプロジェクト 2' }],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const badPaths = result.issues.map((i) => i.path);
      expect(badPaths).toContain('projects.1.name');
      expect(badPaths.every((p) => !p.startsWith('projects.0.'))).toBe(true);
      expect(badPaths.every((p) => !p.startsWith('projects.2.'))).toBe(true);
    }
  });
});
