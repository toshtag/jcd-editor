import { safeParse } from 'valibot';
import { describe, expect, it } from 'vitest';

import { safeParseCareerProfile } from '../domain/operations';
import { skillSchema } from '../domain/skill';

const wrapSkill = (skill: unknown) =>
  safeParseCareerProfile({
    schemaVersion: 1,
    basics: {},
    skills: [skill],
  });

describe('skillSchema (internal)', () => {
  it('全フィールド省略を受理する (draft tolerance)', () => {
    expect(safeParse(skillSchema, {}).success).toBe(true);
  });

  it('name のみを受理する', () => {
    expect(safeParse(skillSchema, { name: 'TypeScript' }).success).toBe(true);
  });

  it('name + category を受理する', () => {
    expect(
      safeParse(skillSchema, {
        name: 'TypeScript',
        category: 'Programming Language',
      }).success,
    ).toBe(true);
  });

  it('name + level を受理する', () => {
    expect(safeParse(skillSchema, { name: 'TypeScript', level: '上級' }).success).toBe(true);
  });

  it('description を受理する', () => {
    expect(safeParse(skillSchema, { name: 'TypeScript', description: '5 年使用' }).success).toBe(
      true,
    );
  });

  it.each([
    'マネジメント',
    '英語 (TOEIC 800)',
    'プレゼンテーション',
    'プロジェクト管理',
    'デザインシステム設計',
  ])('技術以外のスキル (%s) も受理する', (name) => {
    expect(safeParse(skillSchema, { name }).success).toBe(true);
  });

  it('name が空文字なら拒否する', () => {
    expect(safeParse(skillSchema, { name: '' }).success).toBe(false);
  });

  it('name が空白のみなら拒否する', () => {
    expect(safeParse(skillSchema, { name: '   ' }).success).toBe(false);
  });

  it('name の最大長を超えた値を拒否する', () => {
    expect(safeParse(skillSchema, { name: 'あ'.repeat(101) }).success).toBe(false);
  });

  it.each([
    ['category', { category: '   ' }],
    ['level', { level: '   ' }],
    ['description', { description: '   ' }],
  ])('%s が空白のみなら拒否する', (_label, input) => {
    expect(safeParse(skillSchema, input).success).toBe(false);
  });

  it('category の最大長を超えた値を拒否する', () => {
    expect(safeParse(skillSchema, { category: 'あ'.repeat(51) }).success).toBe(false);
  });

  it('description の最大長を超えた値を拒否する', () => {
    expect(safeParse(skillSchema, { description: 'あ'.repeat(1001) }).success).toBe(false);
  });
});

describe('Skill via safeParseCareerProfile (public API)', () => {
  it('有効な Skill を含む CareerProfile を受理する', () => {
    const result = safeParseCareerProfile({
      schemaVersion: 1,
      basics: {},
      skills: [
        {
          name: 'TypeScript',
          category: 'Programming Language',
          level: '上級',
          description: 'バックエンド・フロントエンド両方で 5 年以上',
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('name が不正な場合に dot path skills.0.name を含む', () => {
    const result = wrapSkill({ name: '' });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.issues.find((i) => i.path === 'skills.0.name');
      expect(issue).toBeDefined();
    }
  });

  it('複数要素のうち一部だけ不正の場合、該当インデックスのみ issue が出る', () => {
    const result = safeParseCareerProfile({
      schemaVersion: 1,
      basics: {},
      skills: [{ name: 'Python' }, { name: '   ' }, { name: 'Go' }],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const badPaths = result.issues.map((i) => i.path);
      expect(badPaths).toContain('skills.1.name');
      expect(badPaths.every((p) => !p.startsWith('skills.0.'))).toBe(true);
      expect(badPaths.every((p) => !p.startsWith('skills.2.'))).toBe(true);
    }
  });
});
