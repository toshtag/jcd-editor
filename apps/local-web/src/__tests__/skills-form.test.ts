import { describe, expect, it } from 'vitest';

import { parseCareerProfile, type Skill } from '@jcd-editor/core';

import {
  buildSkillsFromForm,
  emptySkillFormValues,
  skillToFormValues,
  type SkillFormValues,
} from '../skills-form';

const buildParsedSkill = (raw: Record<string, unknown>): Skill => {
  const parsed = parseCareerProfile({
    schemaVersion: 1,
    basics: {},
    skills: [raw],
  });
  const item = parsed.skills?.[0];
  if (item === undefined) {
    throw new Error('test fixture: parsed skill is undefined');
  }
  return item;
};

const fullyPopulated: SkillFormValues = {
  name: 'TypeScript',
  category: 'プログラミング言語',
  level: '上級',
  description: 'Web フロントエンド / Node.js 双方で利用',
};

describe('emptySkillFormValues', () => {
  it('全 string field は空文字列を返す', () => {
    expect(emptySkillFormValues()).toEqual({
      name: '',
      category: '',
      level: '',
      description: '',
    });
  });
});

describe('skillToFormValues', () => {
  it('全 field 値あり: 全 field を form 値に展開', () => {
    const item = buildParsedSkill({
      name: 'TypeScript',
      category: 'プログラミング言語',
      level: '上級',
      description: 'Web フロントエンド / Node.js 双方で利用',
    });
    expect(skillToFormValues(item)).toEqual(fullyPopulated);
  });

  it('全 field optional な空 Skill: 全 string 空', () => {
    const item = buildParsedSkill({});
    expect(skillToFormValues(item)).toEqual(emptySkillFormValues());
  });
});

describe('buildSkillsFromForm', () => {
  it('全 field 値あり: 該当 field を含む item を 1 つ返す', () => {
    expect(buildSkillsFromForm([fullyPopulated])).toEqual([
      {
        name: 'TypeScript',
        category: 'プログラミング言語',
        level: '上級',
        description: 'Web フロントエンド / Node.js 双方で利用',
      },
    ]);
  });

  it('values が空配列: 空配列を返す (全削除を表現、core は valid と判定)', () => {
    expect(buildSkillsFromForm([])).toEqual([]);
  });

  it('partial 入力: 値ありの field のみ含む、他 field は omit', () => {
    const values: SkillFormValues = {
      ...emptySkillFormValues(),
      name: 'Go',
      level: '中級',
    };
    expect(buildSkillsFromForm([values])).toEqual([{ name: 'Go', level: '中級' }]);
  });

  it('emptySkillFormValues 1 件だけ: [] を返す (追加直後の空フォームは draft に流さない)', () => {
    expect(buildSkillsFromForm([emptySkillFormValues()])).toEqual([]);
  });

  it('空白のみ field: 全 field 空白のみなら entry を除外', () => {
    const values: SkillFormValues = {
      name: '   ',
      category: '',
      level: '',
      description: '\n\n',
    };
    expect(buildSkillsFromForm([values])).toEqual([]);
  });

  it('description に値 (空白以外): description 含む item を返す (trim せず原文を渡す)', () => {
    const values: SkillFormValues = {
      ...emptySkillFormValues(),
      name: 'Python',
      description: '  データ分析  ',
    };
    expect(buildSkillsFromForm([values])).toEqual([
      { name: 'Python', description: '  データ分析  ' },
    ]);
  });

  it('empty entry と non-empty entry の混在: empty entry は除外、non-empty entry のみ残る', () => {
    const nonEmpty: SkillFormValues = {
      ...emptySkillFormValues(),
      name: 'Rust',
    };
    expect(buildSkillsFromForm([emptySkillFormValues(), nonEmpty, emptySkillFormValues()])).toEqual(
      [{ name: 'Rust' }],
    );
  });
});
