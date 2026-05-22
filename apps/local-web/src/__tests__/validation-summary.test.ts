import { describe, expect, it } from 'vitest';

import { buildIssueAnchor, issueElementId, summarizeIssues } from '../validation-summary';

describe('buildIssueAnchor', () => {
  describe('null cases (jump 不能)', () => {
    it('空 path: null', () => {
      expect(buildIssueAnchor('')).toBeNull();
    });

    it('schemaVersion: null', () => {
      expect(buildIssueAnchor('schemaVersion')).toBeNull();
    });

    it('未知 section: null', () => {
      expect(buildIssueAnchor('unknownSection.0.field')).toBeNull();
    });
  });

  describe('basics', () => {
    it('basics.birthDate → [data-section="basics"]', () => {
      expect(buildIssueAnchor('basics.birthDate')).toEqual({
        selector: '[data-section="basics"]',
        description: '基本情報 form',
      });
    });

    it('basics.name.family → [data-section="basics"]', () => {
      expect(buildIssueAnchor('basics.name.family')).toEqual({
        selector: '[data-section="basics"]',
        description: '基本情報 form',
      });
    });

    it('basics.profilePhoto.* → [data-section="profilePhoto"] (独立 block 優先)', () => {
      expect(buildIssueAnchor('basics.profilePhoto.source.dataUri')).toEqual({
        selector: '[data-section="profilePhoto"]',
        description: '証明写真 block',
      });
      expect(buildIssueAnchor('basics.profilePhoto.altText')).toEqual({
        selector: '[data-section="profilePhoto"]',
        description: '証明写真 block',
      });
    });
  });

  describe('section entries (index あり)', () => {
    it('workExperiences.0.companyName → #work-experiences-list [data-index="0"]', () => {
      expect(buildIssueAnchor('workExperiences.0.companyName')).toEqual({
        selector: '#work-experiences-list [data-index="0"]',
        description: 'workExperiences entry 0',
      });
    });

    it('educationHistory.2.endDate → #education-list [data-index="2"]', () => {
      expect(buildIssueAnchor('educationHistory.2.endDate')).toEqual({
        selector: '#education-list [data-index="2"]',
        description: 'educationHistory entry 2',
      });
    });

    it('skills.5.name → #skills-list [data-index="5"]', () => {
      expect(buildIssueAnchor('skills.5.name')).toEqual({
        selector: '#skills-list [data-index="5"]',
        description: 'skills entry 5',
      });
    });

    it('certifications.0.issuer → #certifications-list [data-index="0"]', () => {
      expect(buildIssueAnchor('certifications.0.issuer')).toEqual({
        selector: '#certifications-list [data-index="0"]',
        description: 'certifications entry 0',
      });
    });

    it('projects.0.technologies.0 → #projects-list [data-index="0"]', () => {
      expect(buildIssueAnchor('projects.0.technologies.0')).toEqual({
        selector: '#projects-list [data-index="0"]',
        description: 'projects entry 0',
      });
    });
  });

  describe('section level (index なし)', () => {
    it('workExperiences → [data-section="workExperiences"]', () => {
      expect(buildIssueAnchor('workExperiences')).toEqual({
        selector: '[data-section="workExperiences"]',
        description: 'workExperiences section',
      });
    });

    it('workExperiences.foo (index が数値でない) → section level', () => {
      expect(buildIssueAnchor('workExperiences.foo.bar')).toEqual({
        selector: '[data-section="workExperiences"]',
        description: 'workExperiences section',
      });
    });

    it('projects → [data-section="projects"]', () => {
      expect(buildIssueAnchor('projects')).toEqual({
        selector: '[data-section="projects"]',
        description: 'projects section',
      });
    });
  });
});

describe('summarizeIssues', () => {
  it('空配列: 空配列を返す', () => {
    expect(summarizeIssues([])).toEqual([]);
  });

  it('複数 issue: 元の順序を保ったまま translate + anchor を付ける', () => {
    const result = summarizeIssues([
      { path: 'basics.birthDate', message: '実在しない日付' },
      { path: 'workExperiences.0.companyName', message: '会社名が長すぎます' },
      { path: 'schemaVersion', message: 'バージョン不一致' },
    ]);
    expect(result).toEqual([
      {
        pathLabel: '基本情報 > 生年月日',
        message: '実在しない日付',
        anchor: { selector: '[data-section="basics"]', description: '基本情報 form' },
      },
      {
        pathLabel: '職務経歴 1 件目 > 会社名',
        message: '会社名が長すぎます',
        anchor: {
          selector: '#work-experiences-list [data-index="0"]',
          description: 'workExperiences entry 0',
        },
      },
      {
        pathLabel: 'スキーマバージョン',
        message: 'バージョン不一致',
        anchor: null,
      },
    ]);
  });

  it('section level issue (index なし): anchor は section wrapping element', () => {
    const result = summarizeIssues([
      { path: 'workExperiences', message: '職歴の件数が多すぎます' },
    ]);
    expect(result[0]?.anchor).toEqual({
      selector: '[data-section="workExperiences"]',
      description: 'workExperiences section',
    });
  });
});

describe('issueElementId', () => {
  it('0 → validation-issue-0', () => {
    expect(issueElementId(0)).toBe('validation-issue-0');
  });

  it('3 → validation-issue-3', () => {
    expect(issueElementId(3)).toBe('validation-issue-3');
  });
});
