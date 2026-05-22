import { describe, expect, it } from 'vitest';

import { formatTranslatedIssue, translateIssuePath } from '../validation-labels';

describe('translateIssuePath', () => {
  describe('edge cases', () => {
    it('空 path: "全体"', () => {
      expect(translateIssuePath('')).toBe('全体');
    });

    it('schemaVersion: "スキーマバージョン"', () => {
      expect(translateIssuePath('schemaVersion')).toBe('スキーマバージョン');
    });

    it('未知の top-level: raw path をそのまま返す (fallback)', () => {
      expect(translateIssuePath('unknownSection.0.field')).toBe('unknownSection.0.field');
    });
  });

  describe('basics', () => {
    it('basics.birthDate', () => {
      expect(translateIssuePath('basics.birthDate')).toBe('基本情報 > 生年月日');
    });

    it('basics.email', () => {
      expect(translateIssuePath('basics.email')).toBe('基本情報 > メールアドレス');
    });

    it('basics.name.family', () => {
      expect(translateIssuePath('basics.name.family')).toBe('基本情報 > 氏名 (姓)');
    });

    it('basics.nameKana.given', () => {
      expect(translateIssuePath('basics.nameKana.given')).toBe('基本情報 > フリガナ (メイ)');
    });

    it('basics.address.postalCode', () => {
      expect(translateIssuePath('basics.address.postalCode')).toBe('基本情報 > 住所 (郵便番号)');
    });

    it('basics.profilePhoto.source.dataUri', () => {
      expect(translateIssuePath('basics.profilePhoto.source.dataUri')).toBe(
        '基本情報 > 証明写真 (data URI)',
      );
    });

    it('basics 単独: "基本情報"', () => {
      expect(translateIssuePath('basics')).toBe('基本情報');
    });

    it('basics の未知 field: head label + raw rest を返す (fallback)', () => {
      expect(translateIssuePath('basics.name.middle')).toBe('基本情報 > 氏名 > middle');
    });
  });

  describe('workExperiences', () => {
    it('section + index のみ: "職務経歴 N 件目"', () => {
      expect(translateIssuePath('workExperiences.0')).toBe('職務経歴 1 件目');
      expect(translateIssuePath('workExperiences.2')).toBe('職務経歴 3 件目');
    });

    it('section のみ (index なし): section label のみ', () => {
      expect(translateIssuePath('workExperiences')).toBe('職務経歴');
    });

    it('companyName', () => {
      expect(translateIssuePath('workExperiences.0.companyName')).toBe('職務経歴 1 件目 > 会社名');
    });

    it('period.startDate / period.endDate', () => {
      expect(translateIssuePath('workExperiences.1.period.startDate')).toBe(
        '職務経歴 2 件目 > 開始月',
      );
      expect(translateIssuePath('workExperiences.0.period.endDate')).toBe(
        '職務経歴 1 件目 > 終了月',
      );
    });

    it('period 単独 (cross-field check)', () => {
      expect(translateIssuePath('workExperiences.0.period')).toBe('職務経歴 1 件目 > 期間');
    });

    it('responsibilities.N → "担当業務 (N+1 行目)"', () => {
      expect(translateIssuePath('workExperiences.0.responsibilities.0')).toBe(
        '職務経歴 1 件目 > 担当業務 (1 行目)',
      );
      expect(translateIssuePath('workExperiences.0.responsibilities.4')).toBe(
        '職務経歴 1 件目 > 担当業務 (5 行目)',
      );
    });

    it('achievements.N → "実績 (N+1 行目)"', () => {
      expect(translateIssuePath('workExperiences.0.achievements.2')).toBe(
        '職務経歴 1 件目 > 実績 (3 行目)',
      );
    });

    it('index が数値でない: section label にとどめる', () => {
      expect(translateIssuePath('workExperiences.foo.bar')).toBe('職務経歴');
    });
  });

  describe('educationHistory', () => {
    it('institutionName', () => {
      expect(translateIssuePath('educationHistory.0.institutionName')).toBe('学歴 1 件目 > 学校名');
    });

    it('endDate', () => {
      expect(translateIssuePath('educationHistory.0.endDate')).toBe('学歴 1 件目 > 卒業・終了月');
    });

    it('section + index のみ', () => {
      expect(translateIssuePath('educationHistory.0')).toBe('学歴 1 件目');
    });
  });

  describe('skills', () => {
    it('name', () => {
      expect(translateIssuePath('skills.0.name')).toBe('スキル 1 件目 > スキル名');
    });

    it('level', () => {
      expect(translateIssuePath('skills.3.level')).toBe('スキル 4 件目 > レベル');
    });
  });

  describe('certifications', () => {
    it('issuer', () => {
      expect(translateIssuePath('certifications.0.issuer')).toBe('資格 1 件目 > 発行機関');
    });

    it('acquiredDate', () => {
      expect(translateIssuePath('certifications.0.acquiredDate')).toBe('資格 1 件目 > 取得月');
    });

    it('credentialUrl', () => {
      expect(translateIssuePath('certifications.0.credentialUrl')).toBe('資格 1 件目 > 認定 URL');
    });
  });

  describe('projects', () => {
    it('name', () => {
      expect(translateIssuePath('projects.0.name')).toBe('プロジェクト 1 件目 > プロジェクト名');
    });

    it('organizationName', () => {
      expect(translateIssuePath('projects.0.organizationName')).toBe(
        'プロジェクト 1 件目 > 所属組織',
      );
    });

    it('technologies.N → "使用技術 (N+1 行目)"', () => {
      expect(translateIssuePath('projects.0.technologies.0')).toBe(
        'プロジェクト 1 件目 > 使用技術 (1 行目)',
      );
      expect(translateIssuePath('projects.2.technologies.5')).toBe(
        'プロジェクト 3 件目 > 使用技術 (6 行目)',
      );
    });

    it('responsibilities.N (projects 側)', () => {
      expect(translateIssuePath('projects.0.responsibilities.1')).toBe(
        'プロジェクト 1 件目 > 担当業務 (2 行目)',
      );
    });

    it('isCurrent', () => {
      expect(translateIssuePath('projects.0.isCurrent')).toBe('プロジェクト 1 件目 > 進行中フラグ');
    });
  });

  describe('unknown field fallback', () => {
    it('section 既知 / field 未知: entry label + raw field name', () => {
      expect(translateIssuePath('skills.0.unknownField')).toBe('スキル 1 件目 > unknownField');
    });

    it('section 既知 / field head 既知 / sub-field 未知', () => {
      // period の sub-field に未知が来る (仮定的なケース)
      expect(translateIssuePath('workExperiences.0.period.unknownSub')).toBe(
        '職務経歴 1 件目 > 期間 > unknownSub',
      );
    });
  });
});

describe('formatTranslatedIssue', () => {
  it('"- <label>: <message>" 形式に整形', () => {
    expect(
      formatTranslatedIssue({
        path: 'basics.birthDate',
        message: '実在しない日付、または許可範囲外 (1900-2100) の年です',
      }),
    ).toBe('- 基本情報 > 生年月日: 実在しない日付、または許可範囲外 (1900-2100) の年です');
  });

  it('空 path でも整形できる', () => {
    expect(formatTranslatedIssue({ path: '', message: '何らかのエラー' })).toBe(
      '- 全体: 何らかのエラー',
    );
  });
});
