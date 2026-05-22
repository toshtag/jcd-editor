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

  it('basics.profilePhoto 省略を受理する', () => {
    const result = safeParseCareerProfile({ schemaVersion: 1, basics: {} });
    expect(result.success).toBe(true);
  });

  it('basics.profilePhoto: {} (draft) を受理する', () => {
    const result = safeParseCareerProfile({
      schemaVersion: 1,
      basics: { profilePhoto: {} },
    });
    expect(result.success).toBe(true);
  });

  it('有効な basics.profilePhoto を含む CareerProfile を受理する', () => {
    const result = safeParseCareerProfile({
      schemaVersion: 1,
      basics: {
        profilePhoto: {
          source: { kind: 'relativePath', path: 'photos/profile.jpg' },
        },
      },
    });
    expect(result.success).toBe(true);
  });

  it('全ドメイン (workExperiences + educationHistory + skills + certifications + projects + basics.profilePhoto) を含む完全な CareerProfile を受理する', () => {
    const result = safeParseCareerProfile({
      schemaVersion: 1,
      basics: {
        name: { family: '山田', given: '太郎' },
        nameKana: { family: 'ヤマダ', given: 'タロウ' },
        birthDate: '1993-04-01',
        email: 'taro@example.com',
        phone: '090-1234-5678',
        address: { postalCode: '100-0001', prefecture: '東京都', cityAndRest: '千代田区' },
        profilePhoto: {
          source: { kind: 'relativePath', path: 'photos/profile.jpg' },
          altText: '証明写真',
        },
      },
      workExperiences: [{ companyName: '株式会社サンプル' }],
      educationHistory: [{ institutionName: '◯◯大学' }],
      skills: [{ name: 'TypeScript' }],
      certifications: [{ name: '基本情報技術者試験' }],
      projects: [{ name: '在庫管理システム刷新', technologies: ['TypeScript'] }],
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

// ===== Phase 1.2 で追加されたフィールド =====
//
// 厚労省履歴書様式例の各欄に対応するフィールド (gender / addressKana /
// contactAddress / contactAddressKana / contactPhone / summary /
// personalRequest) と、文書属性として meta.preparedOn を追加した。
//
// 全て optional で、未指定でも parse は成功する (公式様式の「未記載可」と整合)。

describe('basics.gender (Phase 1.2)', () => {
  it('未指定でも受理する', () => {
    const result = safeParseCareerProfile({ schemaVersion: 1, basics: {} });
    expect(result.success).toBe(true);
  });

  it('任意 phrase ("男性", "女性", "その他", "記載しない" など) を受理する', () => {
    for (const value of ['男性', '女性', 'その他', '記載しない', 'X']) {
      const result = safeParseCareerProfile({
        schemaVersion: 1,
        basics: { gender: value },
      });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.basics.gender).toBe(value);
    }
  });

  it('50 字を超える gender は拒否する', () => {
    const result = safeParseCareerProfile({
      schemaVersion: 1,
      basics: { gender: 'あ'.repeat(51) },
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.issues.find((i) => i.path === 'basics.gender')).toBeDefined();
    }
  });
});

describe('basics.addressKana / contactAddressKana (Phase 1.2)', () => {
  it('addressKana を 1 行フリーテキストとして受理する', () => {
    const result = safeParseCareerProfile({
      schemaVersion: 1,
      basics: { addressKana: 'トウキョウト チヨダク マルノウチ' },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.basics.addressKana).toBe('トウキョウト チヨダク マルノウチ');
    }
  });

  it('contactAddressKana を 1 行フリーテキストとして受理する', () => {
    const result = safeParseCareerProfile({
      schemaVersion: 1,
      basics: { contactAddressKana: 'オオサカフ ナンバ' },
    });
    expect(result.success).toBe(true);
  });

  it('200 字を超える addressKana は拒否する', () => {
    const result = safeParseCareerProfile({
      schemaVersion: 1,
      basics: { addressKana: 'ア'.repeat(201) },
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.issues.find((i) => i.path === 'basics.addressKana')).toBeDefined();
    }
  });
});

describe('basics.contactAddress / contactPhone (Phase 1.2)', () => {
  it('contactAddress は PostalAddress と同じ構造を受理する', () => {
    const result = safeParseCareerProfile({
      schemaVersion: 1,
      basics: {
        contactAddress: {
          postalCode: '530-0001',
          prefecture: '大阪府',
          cityAndRest: '大阪市北区梅田',
        },
      },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.basics.contactAddress?.prefecture).toBe('大阪府');
    }
  });

  it('contactPhone は phoneNumberSchema と同じ規則で validate される', () => {
    const result = safeParseCareerProfile({
      schemaVersion: 1,
      basics: { contactPhone: '06-1234-5678' },
    });
    expect(result.success).toBe(true);
  });

  it('contactPhone が空文字列なら拒否する', () => {
    const result = safeParseCareerProfile({
      schemaVersion: 1,
      basics: { contactPhone: '' },
    });
    expect(result.success).toBe(false);
  });
});

describe('basics.summary / personalRequest (Phase 1.2)', () => {
  it('summary はフリーテキストとして受理する', () => {
    const result = safeParseCareerProfile({
      schemaVersion: 1,
      basics: { summary: '志望動機: 御社の技術力に魅力を感じ...' },
    });
    expect(result.success).toBe(true);
  });

  it('summary は改行を含むテキストも受理する', () => {
    const result = safeParseCareerProfile({
      schemaVersion: 1,
      basics: { summary: '1 行目\n2 行目\n3 行目' },
    });
    expect(result.success).toBe(true);
  });

  it('2000 字を超える summary は拒否する', () => {
    const result = safeParseCareerProfile({
      schemaVersion: 1,
      basics: { summary: 'あ'.repeat(2001) },
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.issues.find((i) => i.path === 'basics.summary')).toBeDefined();
    }
  });

  it('personalRequest はフリーテキストとして受理する', () => {
    const result = safeParseCareerProfile({
      schemaVersion: 1,
      basics: { personalRequest: '勤務地: 都内希望、リモート可' },
    });
    expect(result.success).toBe(true);
  });

  it('1000 字を超える personalRequest は拒否する', () => {
    const result = safeParseCareerProfile({
      schemaVersion: 1,
      basics: { personalRequest: 'あ'.repeat(1001) },
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.issues.find((i) => i.path === 'basics.personalRequest')).toBeDefined();
    }
  });
});

describe('meta.preparedOn (Phase 1.2)', () => {
  it('meta 全体が省略されていても受理する', () => {
    const result = safeParseCareerProfile({ schemaVersion: 1, basics: {} });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.meta).toBeUndefined();
  });

  it('meta が空 object でも受理する', () => {
    const result = safeParseCareerProfile({ schemaVersion: 1, basics: {}, meta: {} });
    expect(result.success).toBe(true);
  });

  it('preparedOn が ISO date string なら受理する', () => {
    const result = safeParseCareerProfile({
      schemaVersion: 1,
      basics: {},
      meta: { preparedOn: '2026-05-22' },
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.meta?.preparedOn).toBe('2026-05-22');
  });

  it('preparedOn が ISO date 形式以外なら拒否する', () => {
    const result = safeParseCareerProfile({
      schemaVersion: 1,
      basics: {},
      meta: { preparedOn: '令和8年5月22日' },
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.issues.find((i) => i.path === 'meta.preparedOn')).toBeDefined();
    }
  });
});

describe('Phase 1.2 - 全フィールド込みの round-trip', () => {
  it('全フィールドを含む構造を parse できる', () => {
    const result = safeParseCareerProfile({
      schemaVersion: 1,
      basics: {
        name: { family: '山田', given: '太郎' },
        nameKana: { family: 'ヤマダ', given: 'タロウ' },
        birthDate: '1993-04-01',
        gender: '男性',
        email: 'taro@example.com',
        phone: '090-1234-5678',
        address: { postalCode: '100-0001', prefecture: '東京都', cityAndRest: '千代田区' },
        addressKana: 'トウキョウト チヨダク',
        contactAddress: { postalCode: '530-0001', prefecture: '大阪府', cityAndRest: '北区' },
        contactAddressKana: 'オオサカフ キタク',
        contactPhone: '06-1234-5678',
        summary: '志望の動機: ...',
        personalRequest: '勤務地希望: 関東圏',
      },
      meta: { preparedOn: '2026-05-22' },
    });
    expect(result.success).toBe(true);
  });
});
