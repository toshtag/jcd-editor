import { describe, expect, it } from 'vitest';

import { ValidationError } from '../domain/errors';
import { parseCareerProfile, safeParseCareerProfile } from '../domain/operations';

describe('safeParseCareerProfile', () => {
  it('最小構造 (空の basics) を受理する', () => {
    const result = safeParseCareerProfile({ schemaVersion: 1, basics: {} });
    expect(result.success).toBe(true);
  });

  it('basics に有効な値を含む構造を受理する', () => {
    const result = safeParseCareerProfile({
      schemaVersion: 1,
      basics: {
        name: { family: '山田', given: '太郎' },
        nameKana: { family: 'ヤマダ', given: 'タロウ' },
        birthDate: '1993-04-01',
        email: 'taro@example.com',
        phone: '090-1234-5678',
        address: { postalCode: '100-0001', prefecture: '東京都', cityAndRest: '千代田区' },
      },
    });
    expect(result.success).toBe(true);
  });

  it('schemaVersion: 2 を拒否する', () => {
    const result = safeParseCareerProfile({ schemaVersion: 2, basics: {} });
    expect(result.success).toBe(false);
  });

  it('basics が無い場合を拒否する', () => {
    const result = safeParseCareerProfile({ schemaVersion: 1 });
    expect(result.success).toBe(false);
  });

  it('basics 内の不正値で失敗する場合に dot path を含む issues を返す', () => {
    const result = safeParseCareerProfile({
      schemaVersion: 1,
      basics: { name: { family: '', given: '太郎' } },
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.issues.find((i) => i.path.includes('family'));
      expect(issue?.path).toBe('basics.name.family');
    }
  });

  it('workExperiences を省略しても受理する', () => {
    const result = safeParseCareerProfile({ schemaVersion: 1, basics: {} });
    expect(result.success).toBe(true);
  });

  it('workExperiences が空配列でも受理する', () => {
    const result = safeParseCareerProfile({
      schemaVersion: 1,
      basics: {},
      workExperiences: [],
    });
    expect(result.success).toBe(true);
  });

  it('workExperiences 内の不正値で失敗する場合に dot path を含む issues を返す', () => {
    const result = safeParseCareerProfile({
      schemaVersion: 1,
      basics: {},
      workExperiences: [{ companyName: '   ' }],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.issues.find((i) => i.path === 'workExperiences.0.companyName');
      expect(issue).toBeDefined();
    }
  });

  it('educationHistory を省略しても受理する', () => {
    const result = safeParseCareerProfile({ schemaVersion: 1, basics: {} });
    expect(result.success).toBe(true);
  });

  it('educationHistory が空配列でも受理する', () => {
    const result = safeParseCareerProfile({
      schemaVersion: 1,
      basics: {},
      educationHistory: [],
    });
    expect(result.success).toBe(true);
  });

  it('workExperiences と educationHistory の両方を含む CareerProfile を受理する', () => {
    const result = safeParseCareerProfile({
      schemaVersion: 1,
      basics: {},
      workExperiences: [{ companyName: '株式会社サンプル' }],
      educationHistory: [{ institutionName: '◯◯大学' }],
    });
    expect(result.success).toBe(true);
  });

  it('educationHistory の配列要素最大数を超えた場合は拒否する', () => {
    const tooMany = Array.from({ length: 31 }, (_, i) => ({
      institutionName: `学校${i}`,
    }));
    const result = safeParseCareerProfile({
      schemaVersion: 1,
      basics: {},
      educationHistory: tooMany,
    });
    expect(result.success).toBe(false);
  });

  it('educationHistory 内の不正値で失敗する場合に dot path を含む issues を返す', () => {
    const result = safeParseCareerProfile({
      schemaVersion: 1,
      basics: {},
      educationHistory: [{ institutionName: '   ' }],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.issues.find((i) => i.path === 'educationHistory.0.institutionName');
      expect(issue).toBeDefined();
    }
  });

  it('skills / certifications を省略しても受理する', () => {
    const result = safeParseCareerProfile({ schemaVersion: 1, basics: {} });
    expect(result.success).toBe(true);
  });

  it('skills が空配列でも受理する', () => {
    const result = safeParseCareerProfile({
      schemaVersion: 1,
      basics: {},
      skills: [],
    });
    expect(result.success).toBe(true);
  });

  it('certifications が空配列でも受理する', () => {
    const result = safeParseCareerProfile({
      schemaVersion: 1,
      basics: {},
      certifications: [],
    });
    expect(result.success).toBe(true);
  });

  it('skills の配列要素最大数 (200) を超えた場合は拒否する', () => {
    const tooMany = Array.from({ length: 201 }, (_, i) => ({ name: `スキル${i}` }));
    const result = safeParseCareerProfile({
      schemaVersion: 1,
      basics: {},
      skills: tooMany,
    });
    expect(result.success).toBe(false);
  });

  it('certifications の配列要素最大数 (100) を超えた場合は拒否する', () => {
    const tooMany = Array.from({ length: 101 }, (_, i) => ({ name: `資格${i}` }));
    const result = safeParseCareerProfile({
      schemaVersion: 1,
      basics: {},
      certifications: tooMany,
    });
    expect(result.success).toBe(false);
  });

  it('skills 内の不正値で失敗する場合に dot path を含む issues を返す', () => {
    const result = safeParseCareerProfile({
      schemaVersion: 1,
      basics: {},
      skills: [{ name: '   ' }],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.issues.find((i) => i.path === 'skills.0.name');
      expect(issue).toBeDefined();
    }
  });

  it('certifications 内の不正値で失敗する場合に dot path を含む issues を返す', () => {
    const result = safeParseCareerProfile({
      schemaVersion: 1,
      basics: {},
      certifications: [{ acquiredDate: '2024-13' }],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.issues.find((i) => i.path === 'certifications.0.acquiredDate');
      expect(issue).toBeDefined();
    }
  });

  it('workExperiences + educationHistory + skills + certifications を全て含む CareerProfile を受理する', () => {
    const result = safeParseCareerProfile({
      schemaVersion: 1,
      basics: { name: { family: '山田', given: '太郎' } },
      workExperiences: [{ companyName: '株式会社サンプル' }],
      educationHistory: [{ institutionName: '◯◯大学' }],
      skills: [{ name: 'TypeScript' }],
      certifications: [{ name: '基本情報技術者試験' }],
    });
    expect(result.success).toBe(true);
  });

  it('projects を省略しても受理する', () => {
    const result = safeParseCareerProfile({ schemaVersion: 1, basics: {} });
    expect(result.success).toBe(true);
  });

  it('projects が空配列でも受理する', () => {
    const result = safeParseCareerProfile({
      schemaVersion: 1,
      basics: {},
      projects: [],
    });
    expect(result.success).toBe(true);
  });

  it('projects の配列要素最大数 (200) を超えた場合は拒否する', () => {
    const tooMany = Array.from({ length: 201 }, (_, i) => ({ name: `プロジェクト${i}` }));
    const result = safeParseCareerProfile({
      schemaVersion: 1,
      basics: {},
      projects: tooMany,
    });
    expect(result.success).toBe(false);
  });

  it('projects 内の不正値で失敗する場合に dot path を含む issues を返す', () => {
    const result = safeParseCareerProfile({
      schemaVersion: 1,
      basics: {},
      projects: [{ name: '   ' }],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.issues.find((i) => i.path === 'projects.0.name');
      expect(issue).toBeDefined();
    }
  });

  it('workExperiences + educationHistory + skills + certifications + projects をすべて含む完全な CareerProfile を受理する', () => {
    const result = safeParseCareerProfile({
      schemaVersion: 1,
      basics: { name: { family: '山田', given: '太郎' } },
      workExperiences: [{ companyName: '株式会社サンプル' }],
      educationHistory: [{ institutionName: '◯◯大学' }],
      skills: [{ name: 'TypeScript' }],
      certifications: [{ name: '基本情報技術者試験' }],
      projects: [
        {
          name: '在庫管理システム刷新',
          organizationName: '株式会社サンプル',
          technologies: ['TypeScript', 'Next.js'],
        },
      ],
    });
    expect(result.success).toBe(true);
  });
});

describe('parseCareerProfile', () => {
  it('正常データを CareerProfile として返す', () => {
    const data = parseCareerProfile({ schemaVersion: 1, basics: {} });
    expect(data.schemaVersion).toBe(1);
    expect(data.basics).toEqual({});
  });

  it('不正データで ValidationError を throw する', () => {
    expect(() => parseCareerProfile({ schemaVersion: 2, basics: {} })).toThrow(ValidationError);
  });

  it('throw された ValidationError は issues を保持する', () => {
    try {
      parseCareerProfile({ schemaVersion: 2, basics: {} });
    } catch (e) {
      expect(e).toBeInstanceOf(ValidationError);
      if (e instanceof ValidationError) {
        expect(e.issues.length).toBeGreaterThan(0);
      }
    }
  });
});
