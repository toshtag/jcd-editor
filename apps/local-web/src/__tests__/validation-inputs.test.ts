import { describe, expect, it } from 'vitest';

import { buildIssueInputSelector, collectInvalidInputSelectors } from '../validation-inputs';

describe('buildIssueInputSelector', () => {
  describe('null cases', () => {
    it('空 path: null', () => {
      expect(buildIssueInputSelector('')).toBeNull();
    });

    it('schemaVersion: null', () => {
      expect(buildIssueInputSelector('schemaVersion')).toBeNull();
    });

    it('basics 単独: null (個別 input 対象なし)', () => {
      expect(buildIssueInputSelector('basics')).toBeNull();
    });

    it('basics の未知 sub-path: null', () => {
      expect(buildIssueInputSelector('basics.unknownField')).toBeNull();
    });

    it('section 単独: null', () => {
      expect(buildIssueInputSelector('workExperiences')).toBeNull();
    });

    it('section + 数値でない index: null', () => {
      expect(buildIssueInputSelector('workExperiences.foo.companyName')).toBeNull();
    });

    it('section entry level (index のみ): null (cross-field check)', () => {
      expect(buildIssueInputSelector('workExperiences.0')).toBeNull();
    });

    it('period 単独 (cross-field check): null', () => {
      expect(buildIssueInputSelector('workExperiences.0.period')).toBeNull();
    });

    it('未知 section: null', () => {
      expect(buildIssueInputSelector('unknownSection.0.field')).toBeNull();
    });

    it('basics.profilePhoto.altText (input UI なし): null', () => {
      expect(buildIssueInputSelector('basics.profilePhoto.altText')).toBeNull();
    });
  });

  describe('basics', () => {
    it('basics.birthDate → #birth-date', () => {
      expect(buildIssueInputSelector('basics.birthDate')).toBe('#birth-date');
    });

    it('basics.email → #email', () => {
      expect(buildIssueInputSelector('basics.email')).toBe('#email');
    });

    it('basics.phone → #phone', () => {
      expect(buildIssueInputSelector('basics.phone')).toBe('#phone');
    });

    it('basics.name.family → #name-family', () => {
      expect(buildIssueInputSelector('basics.name.family')).toBe('#name-family');
    });

    it('basics.name.given → #name-given', () => {
      expect(buildIssueInputSelector('basics.name.given')).toBe('#name-given');
    });

    it('basics.nameKana.family → #name-kana-family', () => {
      expect(buildIssueInputSelector('basics.nameKana.family')).toBe('#name-kana-family');
    });

    it('basics.nameKana.given → #name-kana-given', () => {
      expect(buildIssueInputSelector('basics.nameKana.given')).toBe('#name-kana-given');
    });

    it('basics.address.postalCode → #postal-code', () => {
      expect(buildIssueInputSelector('basics.address.postalCode')).toBe('#postal-code');
    });

    it('basics.address.prefecture → #prefecture', () => {
      expect(buildIssueInputSelector('basics.address.prefecture')).toBe('#prefecture');
    });

    it('basics.address.cityAndRest → #city-and-rest', () => {
      expect(buildIssueInputSelector('basics.address.cityAndRest')).toBe('#city-and-rest');
    });

    it('basics.profilePhoto.source.dataUri → #profile-photo-input', () => {
      expect(buildIssueInputSelector('basics.profilePhoto.source.dataUri')).toBe(
        '#profile-photo-input',
      );
    });
  });

  describe('workExperiences', () => {
    it('companyName', () => {
      expect(buildIssueInputSelector('workExperiences.0.companyName')).toBe(
        '#work-experiences-list [data-index="0"] [data-field="companyName"]',
      );
    });

    it('period.startDate → flat startDate', () => {
      expect(buildIssueInputSelector('workExperiences.1.period.startDate')).toBe(
        '#work-experiences-list [data-index="1"] [data-field="startDate"]',
      );
    });

    it('period.endDate → flat endDate', () => {
      expect(buildIssueInputSelector('workExperiences.0.period.endDate')).toBe(
        '#work-experiences-list [data-index="0"] [data-field="endDate"]',
      );
    });

    it('period.isCurrent → flat isCurrent', () => {
      expect(buildIssueInputSelector('workExperiences.0.period.isCurrent')).toBe(
        '#work-experiences-list [data-index="0"] [data-field="isCurrent"]',
      );
    });

    it('responsibilities.N → responsibilitiesText (textarea)', () => {
      expect(buildIssueInputSelector('workExperiences.0.responsibilities.2')).toBe(
        '#work-experiences-list [data-index="0"] [data-field="responsibilitiesText"]',
      );
    });

    it('responsibilities (index なし) → responsibilitiesText', () => {
      expect(buildIssueInputSelector('workExperiences.0.responsibilities')).toBe(
        '#work-experiences-list [data-index="0"] [data-field="responsibilitiesText"]',
      );
    });

    it('achievements.N → achievementsText', () => {
      expect(buildIssueInputSelector('workExperiences.0.achievements.4')).toBe(
        '#work-experiences-list [data-index="0"] [data-field="achievementsText"]',
      );
    });
  });

  describe('educationHistory', () => {
    it('institutionName', () => {
      expect(buildIssueInputSelector('educationHistory.0.institutionName')).toBe(
        '#education-list [data-index="0"] [data-field="institutionName"]',
      );
    });

    it('endDate', () => {
      expect(buildIssueInputSelector('educationHistory.2.endDate')).toBe(
        '#education-list [data-index="2"] [data-field="endDate"]',
      );
    });
  });

  describe('skills', () => {
    it('name', () => {
      expect(buildIssueInputSelector('skills.5.name')).toBe(
        '#skills-list [data-index="5"] [data-field="name"]',
      );
    });
  });

  describe('certifications', () => {
    it('credentialUrl', () => {
      expect(buildIssueInputSelector('certifications.0.credentialUrl')).toBe(
        '#certifications-list [data-index="0"] [data-field="credentialUrl"]',
      );
    });
  });

  describe('projects', () => {
    it('name', () => {
      expect(buildIssueInputSelector('projects.0.name')).toBe(
        '#projects-list [data-index="0"] [data-field="name"]',
      );
    });

    it('technologies.N → technologiesText', () => {
      expect(buildIssueInputSelector('projects.0.technologies.0')).toBe(
        '#projects-list [data-index="0"] [data-field="technologiesText"]',
      );
    });

    it('isCurrent', () => {
      expect(buildIssueInputSelector('projects.1.isCurrent')).toBe(
        '#projects-list [data-index="1"] [data-field="isCurrent"]',
      );
    });
  });
});

describe('collectInvalidInputSelectors', () => {
  it('空配列: 空 Set', () => {
    expect(collectInvalidInputSelectors([])).toEqual(new Set());
  });

  it('複数 issue: selector 集合を返す (null は除外)', () => {
    const result = collectInvalidInputSelectors([
      { path: 'basics.birthDate', message: 'X' },
      { path: 'workExperiences.0.companyName', message: 'Y' },
      { path: 'schemaVersion', message: 'Z' },
      { path: 'workExperiences.0', message: 'W' },
    ]);
    expect(result).toEqual(
      new Set([
        '#birth-date',
        '#work-experiences-list [data-index="0"] [data-field="companyName"]',
      ]),
    );
  });

  it('同じ input に複数 issue: Set で de-dup される', () => {
    const result = collectInvalidInputSelectors([
      { path: 'basics.birthDate', message: 'X' },
      { path: 'basics.birthDate', message: 'Y' },
    ]);
    expect(result.size).toBe(1);
    expect(result.has('#birth-date')).toBe(true);
  });
});
