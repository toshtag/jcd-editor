import { describe, expect, it } from 'vitest';

import { parseCareerProfile, type Education } from '@jcd-editor/core';

import {
  buildEducationFromForm,
  emptyEducationFormValues,
  educationToFormValues,
  type EducationFormValues,
} from '../education-form';

// branded IsoYearMonthString を直接 literal 構築できないため、parseCareerProfile
// 経由で型安全な Education を取得して test fixture とする。
const buildParsedEducation = (raw: Record<string, unknown>): Education => {
  const parsed = parseCareerProfile({
    schemaVersion: 1,
    basics: {},
    educationHistory: [raw],
  });
  const item = parsed.educationHistory?.[0];
  if (item === undefined) {
    throw new Error('test fixture: parsed education is undefined');
  }
  return item;
};

const fullyPopulated: EducationFormValues = {
  institutionName: 'サンプル大学',
  faculty: '情報工学部',
  department: '情報科学科',
  degree: '学士 (工学)',
  startDate: '2016-04',
  endDate: '2020-03',
  status: '卒業',
  description: '機械学習を中心に研究',
};

describe('emptyEducationFormValues', () => {
  it('全 string field は空文字列を返す', () => {
    expect(emptyEducationFormValues()).toEqual({
      institutionName: '',
      faculty: '',
      department: '',
      degree: '',
      startDate: '',
      endDate: '',
      status: '',
      description: '',
    });
  });
});

describe('educationToFormValues', () => {
  it('全 field 値あり: 全 field を form 値に展開', () => {
    const item = buildParsedEducation({
      institutionName: 'サンプル大学',
      faculty: '情報工学部',
      department: '情報科学科',
      degree: '学士 (工学)',
      startDate: '2016-04',
      endDate: '2020-03',
      status: '卒業',
      description: '機械学習を中心に研究',
    });
    expect(educationToFormValues(item)).toEqual(fullyPopulated);
  });

  it('全 field optional な空 Education: 全 string 空', () => {
    const item = buildParsedEducation({});
    expect(educationToFormValues(item)).toEqual(emptyEducationFormValues());
  });
});

describe('buildEducationFromForm', () => {
  it('全 field 値あり: 該当 field を含む item を 1 つ返す', () => {
    expect(buildEducationFromForm([fullyPopulated])).toEqual([
      {
        institutionName: 'サンプル大学',
        faculty: '情報工学部',
        department: '情報科学科',
        degree: '学士 (工学)',
        startDate: '2016-04',
        endDate: '2020-03',
        status: '卒業',
        description: '機械学習を中心に研究',
      },
    ]);
  });

  it('values が空配列: 空配列を返す (全削除を表現、core は valid と判定)', () => {
    expect(buildEducationFromForm([])).toEqual([]);
  });

  it('partial 入力: 値ありの field のみ含む、他 field は omit', () => {
    const values: EducationFormValues = {
      ...emptyEducationFormValues(),
      institutionName: 'サンプル大学',
      status: '卒業見込み',
    };
    expect(buildEducationFromForm([values])).toEqual([
      { institutionName: 'サンプル大学', status: '卒業見込み' },
    ]);
  });

  it('startDate のみ (endDate なし): startDate のみ含む', () => {
    const values: EducationFormValues = {
      ...emptyEducationFormValues(),
      institutionName: 'サンプル大学',
      startDate: '2016-04',
    };
    expect(buildEducationFromForm([values])).toEqual([
      { institutionName: 'サンプル大学', startDate: '2016-04' },
    ]);
  });

  it('emptyEducationFormValues 1 件だけ: [] を返す (追加直後の空フォームは draft に流さない)', () => {
    expect(buildEducationFromForm([emptyEducationFormValues()])).toEqual([]);
  });

  it('空白のみ field: 全 field 空白のみなら entry を除外', () => {
    const values: EducationFormValues = {
      institutionName: '   ',
      faculty: '',
      department: '',
      degree: '',
      startDate: '',
      endDate: '',
      status: '   ',
      description: '\n\n',
    };
    expect(buildEducationFromForm([values])).toEqual([]);
  });

  it('description に値 (空白以外): description 含む item を返す (trim せず原文を渡す)', () => {
    const values: EducationFormValues = {
      ...emptyEducationFormValues(),
      institutionName: 'サンプル大学',
      description: '  研究テーマ  ',
    };
    expect(buildEducationFromForm([values])).toEqual([
      { institutionName: 'サンプル大学', description: '  研究テーマ  ' },
    ]);
  });

  it('empty entry と non-empty entry の混在: empty entry は除外、non-empty entry のみ残る', () => {
    const nonEmpty: EducationFormValues = {
      ...emptyEducationFormValues(),
      institutionName: 'サンプル大学',
    };
    expect(
      buildEducationFromForm([emptyEducationFormValues(), nonEmpty, emptyEducationFormValues()]),
    ).toEqual([{ institutionName: 'サンプル大学' }]);
  });
});
