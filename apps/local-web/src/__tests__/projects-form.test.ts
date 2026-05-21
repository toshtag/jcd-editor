import { describe, expect, it } from 'vitest';

import { parseCareerProfile, type Project } from '@jcd-editor/core';

import {
  buildProjectsFromForm,
  emptyProjectFormValues,
  projectToFormValues,
  type ProjectFormValues,
} from '../projects-form';

// branded IsoYearMonthString を直接 literal 構築できないため、parseCareerProfile
// 経由で型安全な Project を取得して test fixture とする。
const buildParsedProject = (raw: Record<string, unknown>): Project => {
  const parsed = parseCareerProfile({
    schemaVersion: 1,
    basics: {},
    projects: [raw],
  });
  const item = parsed.projects?.[0];
  if (item === undefined) {
    throw new Error('test fixture: parsed project is undefined');
  }
  return item;
};

const fullyPopulated: ProjectFormValues = {
  name: 'サンプルプロジェクト',
  organizationName: '株式会社サンプル',
  role: '設計・実装担当',
  startDate: '2021-01',
  endDate: '2021-12',
  isCurrent: false,
  summary: '社内向けツールの開発',
  responsibilitiesText: '要件整理\n実装',
  achievementsText: '手作業を自動化し作業時間を月 10 時間削減',
  technologiesText: 'TypeScript\nNode.js',
};

describe('emptyProjectFormValues', () => {
  it('全 string field は空文字列、isCurrent は false を返す', () => {
    expect(emptyProjectFormValues()).toEqual({
      name: '',
      organizationName: '',
      role: '',
      startDate: '',
      endDate: '',
      isCurrent: false,
      summary: '',
      responsibilitiesText: '',
      achievementsText: '',
      technologiesText: '',
    });
  });
});

describe('projectToFormValues', () => {
  it('全 field 値あり: 全 field を form 値に展開 (配列 field は改行 join)', () => {
    const item = buildParsedProject({
      name: 'サンプルプロジェクト',
      organizationName: '株式会社サンプル',
      role: '設計・実装担当',
      startDate: '2021-01',
      endDate: '2021-12',
      isCurrent: false,
      summary: '社内向けツールの開発',
      responsibilities: ['要件整理', '実装'],
      achievements: ['手作業を自動化し作業時間を月 10 時間削減'],
      technologies: ['TypeScript', 'Node.js'],
    });
    expect(projectToFormValues(item)).toEqual(fullyPopulated);
  });

  it('全 field optional な空 Project: 全 string 空、isCurrent false', () => {
    const item = buildParsedProject({});
    expect(projectToFormValues(item)).toEqual(emptyProjectFormValues());
  });
});

describe('buildProjectsFromForm', () => {
  it('全 field 値あり (isCurrent false): 該当 field を含む item を 1 つ返す', () => {
    expect(buildProjectsFromForm([fullyPopulated])).toEqual([
      {
        name: 'サンプルプロジェクト',
        organizationName: '株式会社サンプル',
        role: '設計・実装担当',
        startDate: '2021-01',
        endDate: '2021-12',
        summary: '社内向けツールの開発',
        responsibilities: ['要件整理', '実装'],
        achievements: ['手作業を自動化し作業時間を月 10 時間削減'],
        technologies: ['TypeScript', 'Node.js'],
      },
    ]);
  });

  it('values が空配列: 空配列を返す (全削除を表現、core は valid と判定)', () => {
    expect(buildProjectsFromForm([])).toEqual([]);
  });

  it('partial 入力: 値ありの field のみ含む、他 field は omit', () => {
    const values: ProjectFormValues = {
      ...emptyProjectFormValues(),
      name: 'サンプルプロジェクト',
      summary: '概要のみ記載',
    };
    expect(buildProjectsFromForm([values])).toEqual([
      { name: 'サンプルプロジェクト', summary: '概要のみ記載' },
    ]);
  });

  it('responsibilitiesText が複数行 + 空行 / 空白のみ行: 空行を filter して string[] に変換', () => {
    const values: ProjectFormValues = {
      ...emptyProjectFormValues(),
      name: 'サンプルプロジェクト',
      responsibilitiesText: '要件整理\n\n   \n実装\n設計\n',
    };
    expect(buildProjectsFromForm([values])).toEqual([
      {
        name: 'サンプルプロジェクト',
        responsibilities: ['要件整理', '実装', '設計'],
      },
    ]);
  });

  it('technologiesText が複数行: 改行 split されて technologies 配列になる', () => {
    const values: ProjectFormValues = {
      ...emptyProjectFormValues(),
      name: 'サンプルプロジェクト',
      technologiesText: 'TypeScript\nReact\nVite',
    };
    expect(buildProjectsFromForm([values])).toEqual([
      {
        name: 'サンプルプロジェクト',
        technologies: ['TypeScript', 'React', 'Vite'],
      },
    ]);
  });

  it('技術配列が全空 / 空白のみ: technologies 自体を omit', () => {
    const values: ProjectFormValues = {
      ...emptyProjectFormValues(),
      name: 'サンプルプロジェクト',
      technologiesText: '\n\n   \n',
    };
    expect(buildProjectsFromForm([values])).toEqual([{ name: 'サンプルプロジェクト' }]);
  });

  it('isCurrent: true だけ (startDate / endDate 空): item には isCurrent: true のみ', () => {
    const values: ProjectFormValues = {
      ...emptyProjectFormValues(),
      isCurrent: true,
    };
    expect(buildProjectsFromForm([values])).toEqual([{ isCurrent: true }]);
  });

  it('emptyProjectFormValues 1 件: [] を返す (追加直後の空フォームは draft に流さない)', () => {
    expect(buildProjectsFromForm([emptyProjectFormValues()])).toEqual([]);
  });

  it('empty entry と non-empty entry の混在: empty entry は除外、non-empty entry のみ残る', () => {
    const nonEmpty: ProjectFormValues = {
      ...emptyProjectFormValues(),
      name: 'サンプルプロジェクト',
    };
    expect(
      buildProjectsFromForm([emptyProjectFormValues(), nonEmpty, emptyProjectFormValues()]),
    ).toEqual([{ name: 'サンプルプロジェクト' }]);
  });
});
