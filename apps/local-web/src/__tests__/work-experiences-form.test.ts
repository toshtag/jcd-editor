import { describe, expect, it } from 'vitest';

import { parseCareerProfile, type WorkExperience } from '@jcd-editor/core';

import {
  buildWorkExperiencesFromForm,
  emptyWorkExperienceFormValues,
  type WorkExperienceFormValues,
  workExperienceToFormValues,
} from '../work-experiences-form';

// branded IsoYearMonthString を直接 literal 構築できないため、parseCareerProfile
// 経由で型安全な WorkExperience を取得して test fixture とする。
const buildParsedWorkExperience = (raw: Record<string, unknown>): WorkExperience => {
  const parsed = parseCareerProfile({
    schemaVersion: 1,
    basics: {},
    workExperiences: [raw],
  });
  const item = parsed.workExperiences?.[0];
  if (item === undefined) {
    throw new Error('test fixture: parsed workExperience is undefined');
  }
  return item;
};

const fullyPopulated: WorkExperienceFormValues = {
  companyName: '株式会社サンプル',
  position: 'ソフトウェアエンジニア',
  employmentType: '正社員',
  startDate: '2020-04',
  endDate: '2023-03',
  isCurrent: false,
  summary: 'Web application 開発に従事',
  responsibilitiesText: '設計\n実装\nレビュー',
  achievementsText: '性能改善で応答時間を 40% 短縮',
};

describe('emptyWorkExperienceFormValues', () => {
  it('全 string field は空文字列、isCurrent は false を返す', () => {
    expect(emptyWorkExperienceFormValues()).toEqual({
      companyName: '',
      position: '',
      employmentType: '',
      startDate: '',
      endDate: '',
      isCurrent: false,
      summary: '',
      responsibilitiesText: '',
      achievementsText: '',
    });
  });
});

describe('workExperienceToFormValues', () => {
  it('全 field 値あり: 全 field を form 値に展開 (responsibilities / achievements は改行 join)', () => {
    const item = buildParsedWorkExperience({
      companyName: '株式会社サンプル',
      position: 'ソフトウェアエンジニア',
      employmentType: '正社員',
      period: { startDate: '2020-04', endDate: '2023-03', isCurrent: false },
      summary: 'Web application 開発に従事',
      responsibilities: ['設計', '実装', 'レビュー'],
      achievements: ['性能改善で応答時間を 40% 短縮'],
    });
    expect(workExperienceToFormValues(item)).toEqual(fullyPopulated);
  });

  it('全 field optional な空 WorkExperience: 全 string 空、isCurrent false', () => {
    const item = buildParsedWorkExperience({});
    expect(workExperienceToFormValues(item)).toEqual(emptyWorkExperienceFormValues());
  });
});

describe('buildWorkExperiencesFromForm', () => {
  it('全 field 値あり (isCurrent false): 該当 field を含む item を 1 つ返す', () => {
    expect(buildWorkExperiencesFromForm([fullyPopulated])).toEqual([
      {
        companyName: '株式会社サンプル',
        position: 'ソフトウェアエンジニア',
        employmentType: '正社員',
        period: { startDate: '2020-04', endDate: '2023-03' },
        summary: 'Web application 開発に従事',
        responsibilities: ['設計', '実装', 'レビュー'],
        achievements: ['性能改善で応答時間を 40% 短縮'],
      },
    ]);
  });

  it('values が空配列: 空配列を返す (全削除を表現、core は valid と判定)', () => {
    expect(buildWorkExperiencesFromForm([])).toEqual([]);
  });

  it('partial 入力: 値ありの field のみ含む、他 field は omit', () => {
    const values: WorkExperienceFormValues = {
      ...emptyWorkExperienceFormValues(),
      companyName: '株式会社サンプル',
      summary: '概要のみ記載',
    };
    expect(buildWorkExperiencesFromForm([values])).toEqual([
      { companyName: '株式会社サンプル', summary: '概要のみ記載' },
    ]);
  });

  it('period 全 field empty (isCurrent false 含む): period 自体を omit', () => {
    const values: WorkExperienceFormValues = {
      ...emptyWorkExperienceFormValues(),
      companyName: '株式会社サンプル',
      startDate: '',
      endDate: '',
      isCurrent: false,
    };
    expect(buildWorkExperiencesFromForm([values])).toEqual([{ companyName: '株式会社サンプル' }]);
  });

  it('responsibilitiesText が複数行 + 空行 / 空白のみ行: 空行を filter して string[] に変換', () => {
    const values: WorkExperienceFormValues = {
      ...emptyWorkExperienceFormValues(),
      companyName: '株式会社サンプル',
      responsibilitiesText: '設計\n\n   \n実装\nレビュー\n',
    };
    expect(buildWorkExperiencesFromForm([values])).toEqual([
      {
        companyName: '株式会社サンプル',
        responsibilities: ['設計', '実装', 'レビュー'],
      },
    ]);
  });

  it('responsibilitiesText が全空 / 空白のみ: responsibilities 自体を omit', () => {
    const values: WorkExperienceFormValues = {
      ...emptyWorkExperienceFormValues(),
      companyName: '株式会社サンプル',
      responsibilitiesText: '\n\n   \n',
    };
    expect(buildWorkExperiencesFromForm([values])).toEqual([{ companyName: '株式会社サンプル' }]);
  });

  it('isCurrent: true だけ (startDate / endDate 空): period: { isCurrent: true } のみ', () => {
    const values: WorkExperienceFormValues = {
      ...emptyWorkExperienceFormValues(),
      isCurrent: true,
    };
    expect(buildWorkExperiencesFromForm([values])).toEqual([{ period: { isCurrent: true } }]);
  });

  it('emptyWorkExperienceFormValues 1 件だけ: [] を返す (追加直後の空フォームは draft に流さない)', () => {
    expect(buildWorkExperiencesFromForm([emptyWorkExperienceFormValues()])).toEqual([]);
  });

  it('empty entry と non-empty entry の混在: empty entry は除外、non-empty entry のみ残る', () => {
    const nonEmpty: WorkExperienceFormValues = {
      ...emptyWorkExperienceFormValues(),
      companyName: '株式会社サンプル',
    };
    expect(
      buildWorkExperiencesFromForm([
        emptyWorkExperienceFormValues(),
        nonEmpty,
        emptyWorkExperienceFormValues(),
      ]),
    ).toEqual([{ companyName: '株式会社サンプル' }]);
  });
});
