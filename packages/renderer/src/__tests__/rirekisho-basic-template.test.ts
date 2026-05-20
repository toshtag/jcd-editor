import { parseCareerProfile } from '@jcd-editor/core';
import { describe, expect, it } from 'vitest';

import { RendererError } from '../errors';
import { renderDocument } from '../render-document';
import { createTemplateRegistry, type TemplateDefinition } from '../template-registry';
import { rirekishoBasicTemplate } from '../templates/rirekisho-basic';

const MIN_PROFILE = parseCareerProfile({
  schemaVersion: 1,
  basics: {},
});

describe('rirekishoBasicTemplate - identity', () => {
  it('id is "rirekisho-basic"', () => {
    expect(rirekishoBasicTemplate.id).toBe('rirekisho-basic');
  });

  it('kind is "rirekisho"', () => {
    expect(rirekishoBasicTemplate.kind).toBe('rirekisho');
  });

  it('name is "履歴書（基本）"', () => {
    expect(rirekishoBasicTemplate.name).toBe('履歴書（基本）');
  });

  it('render は関数', () => {
    expect(typeof rirekishoBasicTemplate.render).toBe('function');
  });
});

describe('rirekishoBasicTemplate - 直接 render の基本契約', () => {
  it('最小 CareerProfile で throw しない', () => {
    expect(() =>
      rirekishoBasicTemplate.render({ careerProfile: MIN_PROFILE, kind: 'rirekisho' }),
    ).not.toThrow();
  });

  it('kind が "rirekisho"', () => {
    const result = rirekishoBasicTemplate.render({
      careerProfile: MIN_PROFILE,
      kind: 'rirekisho',
    });
    expect(result.kind).toBe('rirekisho');
  });

  it('title が "履歴書"', () => {
    const result = rirekishoBasicTemplate.render({
      careerProfile: MIN_PROFILE,
      kind: 'rirekisho',
    });
    expect(result.title).toBe('履歴書');
  });

  it('metadata.language が "ja-JP"', () => {
    const result = rirekishoBasicTemplate.render({
      careerProfile: MIN_PROFILE,
      kind: 'rirekisho',
    });
    expect(result.metadata.language).toBe('ja-JP');
  });

  it('metadata.page が A4 portrait', () => {
    const result = rirekishoBasicTemplate.render({
      careerProfile: MIN_PROFILE,
      kind: 'rirekisho',
    });
    expect(result.metadata.page).toEqual({ size: 'A4', orientation: 'portrait' });
  });

  it('metadata.templateId が "rirekisho-basic" (template 自身がセット)', () => {
    const result = rirekishoBasicTemplate.render({
      careerProfile: MIN_PROFILE,
      kind: 'rirekisho',
    });
    expect(result.metadata.templateId).toBe('rirekisho-basic');
  });

  it('html / css が非空 string', () => {
    const result = rirekishoBasicTemplate.render({
      careerProfile: MIN_PROFILE,
      kind: 'rirekisho',
    });
    expect(typeof result.html).toBe('string');
    expect(typeof result.css).toBe('string');
    expect(result.html.length).toBeGreaterThan(0);
    expect(result.css.length).toBeGreaterThan(0);
  });

  it('html に "undefined" / "null" / "[object Object]" 文字列が含まれない', () => {
    const result = rirekishoBasicTemplate.render({
      careerProfile: MIN_PROFILE,
      kind: 'rirekisho',
    });
    expect(result.html).not.toContain('undefined');
    expect(result.html).not.toContain('null');
    expect(result.html).not.toContain('[object Object]');
  });

  it('html が <article class="jcd-rirekisho"> を含む', () => {
    const result = rirekishoBasicTemplate.render({
      careerProfile: MIN_PROFILE,
      kind: 'rirekisho',
    });
    expect(result.html).toContain('<article class="jcd-rirekisho">');
  });

  it('html が <h1> と "履歴書" を含む', () => {
    const result = rirekishoBasicTemplate.render({
      careerProfile: MIN_PROFILE,
      kind: 'rirekisho',
    });
    expect(result.html).toMatch(/<h1[^>]*>履歴書<\/h1>/);
  });
});

describe('rirekishoBasicTemplate - basics 描画', () => {
  it('氏名 (family + given) が描画される', () => {
    const profile = parseCareerProfile({
      schemaVersion: 1,
      basics: { name: { family: '山田', given: '太郎' } },
    });
    const result = rirekishoBasicTemplate.render({ careerProfile: profile, kind: 'rirekisho' });
    expect(result.html).toContain('山田');
    expect(result.html).toContain('太郎');
    expect(result.html).toContain('<dt>氏名</dt>');
  });

  it('フリガナが描画される', () => {
    const profile = parseCareerProfile({
      schemaVersion: 1,
      basics: { nameKana: { family: 'ヤマダ', given: 'タロウ' } },
    });
    const result = rirekishoBasicTemplate.render({ careerProfile: profile, kind: 'rirekisho' });
    expect(result.html).toContain('ヤマダ');
    expect(result.html).toContain('タロウ');
    expect(result.html).toContain('<dt>フリガナ</dt>');
  });

  it('birthDate が YYYY年M月D日 形式に変換される', () => {
    const profile = parseCareerProfile({
      schemaVersion: 1,
      basics: { birthDate: '1990-01-15' },
    });
    const result = rirekishoBasicTemplate.render({ careerProfile: profile, kind: 'rirekisho' });
    expect(result.html).toContain('1990年1月15日');
    expect(result.html).toContain('<dt>生年月日</dt>');
  });

  it('email / phone が描画される', () => {
    const profile = parseCareerProfile({
      schemaVersion: 1,
      basics: { email: 'taro@example.com', phone: '03-1234-5678' },
    });
    const result = rirekishoBasicTemplate.render({ careerProfile: profile, kind: 'rirekisho' });
    expect(result.html).toContain('taro@example.com');
    expect(result.html).toContain('03-1234-5678');
  });

  it('住所が postalCode 有り のとき "〒... " で始まり、prefecture + cityAndRest を空白なし連結', () => {
    const profile = parseCareerProfile({
      schemaVersion: 1,
      basics: {
        address: {
          postalCode: '100-0001',
          prefecture: '東京都',
          cityAndRest: '千代田区千代田1-1',
        },
      },
    });
    const result = rirekishoBasicTemplate.render({ careerProfile: profile, kind: 'rirekisho' });
    expect(result.html).toContain('〒100-0001 東京都千代田区千代田1-1');
  });

  it('住所が postalCode 無し なら prefecture + cityAndRest のみ連結', () => {
    const profile = parseCareerProfile({
      schemaVersion: 1,
      basics: {
        address: { prefecture: '東京都', cityAndRest: '千代田区千代田1-1' },
      },
    });
    const result = rirekishoBasicTemplate.render({ careerProfile: profile, kind: 'rirekisho' });
    expect(result.html).toContain('東京都千代田区千代田1-1');
    expect(result.html).not.toContain('〒');
  });

  it('basics がすべて空なら <dl> 自体が出ない', () => {
    const result = rirekishoBasicTemplate.render({
      careerProfile: MIN_PROFILE,
      kind: 'rirekisho',
    });
    expect(result.html).not.toContain('jcd-rirekisho__basics');
  });
});

describe('rirekishoBasicTemplate - 学歴・職歴 chronological table (全体構造)', () => {
  it('education / work 双方無しなら history section が出ない', () => {
    const result = rirekishoBasicTemplate.render({
      careerProfile: MIN_PROFILE,
      kind: 'rirekisho',
    });
    expect(result.html).not.toContain('jcd-rirekisho__section--history');
    expect(result.html).not.toContain('学歴・職歴');
  });

  it('education のみあれば history section が出る、heading row は 学歴 のみ', () => {
    const profile = parseCareerProfile({
      schemaVersion: 1,
      basics: {},
      educationHistory: [{ institutionName: '○○大学', startDate: '2010-04' }],
    });
    const result = rirekishoBasicTemplate.render({ careerProfile: profile, kind: 'rirekisho' });
    expect(result.html).toContain('jcd-rirekisho__section--history');
    expect(result.html).toContain('<h2>学歴・職歴</h2>');
    expect(result.html).toContain('jcd-rirekisho__history-table');
    expect(result.html).toContain('<td colspan="2">学歴</td>');
    expect(result.html).not.toContain('<td colspan="2">職歴</td>');
  });

  it('work のみあれば history section が出る、heading row は 職歴 のみ', () => {
    const profile = parseCareerProfile({
      schemaVersion: 1,
      basics: {},
      workExperiences: [{ companyName: '株式会社サンプル', period: { startDate: '2020-04' } }],
    });
    const result = rirekishoBasicTemplate.render({ careerProfile: profile, kind: 'rirekisho' });
    expect(result.html).toContain('<td colspan="2">職歴</td>');
    expect(result.html).not.toContain('<td colspan="2">学歴</td>');
  });

  it('両方あれば 学歴 heading → education rows → 職歴 heading → work rows の順', () => {
    const profile = parseCareerProfile({
      schemaVersion: 1,
      basics: {},
      educationHistory: [{ institutionName: '○○大学', startDate: '2010-04' }],
      workExperiences: [{ companyName: '株式会社サンプル', period: { startDate: '2014-04' } }],
    });
    const result = rirekishoBasicTemplate.render({ careerProfile: profile, kind: 'rirekisho' });
    const idxEduHeading = result.html.indexOf('<td colspan="2">学歴</td>');
    const idxEduRow = result.html.indexOf('○○大学');
    const idxWorkHeading = result.html.indexOf('<td colspan="2">職歴</td>');
    const idxWorkRow = result.html.indexOf('株式会社サンプル');
    expect(idxEduHeading).toBeGreaterThan(-1);
    expect(idxEduRow).toBeGreaterThan(idxEduHeading);
    expect(idxWorkHeading).toBeGreaterThan(idxEduRow);
    expect(idxWorkRow).toBeGreaterThan(idxWorkHeading);
  });

  it('table thead に 年月 / 内容 のヘッダがある', () => {
    const profile = parseCareerProfile({
      schemaVersion: 1,
      basics: {},
      educationHistory: [{ institutionName: '○○大学', startDate: '2010-04' }],
    });
    const result = rirekishoBasicTemplate.render({ careerProfile: profile, kind: 'rirekisho' });
    expect(result.html).toContain('<th>年月</th>');
    expect(result.html).toContain('<th>内容</th>');
  });
});

describe('rirekishoBasicTemplate - 学歴 row 生成', () => {
  it('startDate と endDate 両方で 2 row (入学 / 卒業)', () => {
    const profile = parseCareerProfile({
      schemaVersion: 1,
      basics: {},
      educationHistory: [
        {
          institutionName: '○○大学',
          faculty: '工学部',
          department: '情報工学科',
          startDate: '2010-04',
          endDate: '2014-03',
        },
      ],
    });
    const result = rirekishoBasicTemplate.render({ careerProfile: profile, kind: 'rirekisho' });
    expect(result.html).toContain('2010年4月');
    expect(result.html).toContain('2014年3月');
    expect(result.html).toContain('○○大学 工学部 情報工学科 入学');
    expect(result.html).toContain('○○大学 工学部 情報工学科 卒業');
  });

  it('status が non-empty なら endDate row の ending phrase になる', () => {
    const profile = parseCareerProfile({
      schemaVersion: 1,
      basics: {},
      educationHistory: [{ institutionName: '○○大学', endDate: '2025-03', status: '卒業見込み' }],
    });
    const result = rirekishoBasicTemplate.render({ careerProfile: profile, kind: 'rirekisho' });
    expect(result.html).toContain('○○大学 卒業見込み');
    expect(result.html).not.toContain('○○大学 卒業<');
  });

  it('status が無ければ endDate row は 卒業 で終わる', () => {
    const profile = parseCareerProfile({
      schemaVersion: 1,
      basics: {},
      educationHistory: [{ institutionName: '○○大学', endDate: '2014-03' }],
    });
    const result = rirekishoBasicTemplate.render({ careerProfile: profile, kind: 'rirekisho' });
    expect(result.html).toContain('○○大学 卒業');
  });

  it('startDate のみなら 入学 row 1 つだけ', () => {
    const profile = parseCareerProfile({
      schemaVersion: 1,
      basics: {},
      educationHistory: [{ institutionName: '○○大学', startDate: '2010-04' }],
    });
    const result = rirekishoBasicTemplate.render({ careerProfile: profile, kind: 'rirekisho' });
    expect(result.html).toContain('○○大学 入学');
    expect(result.html).not.toContain('○○大学 卒業');
  });

  it('endDate のみなら ending row 1 つだけ', () => {
    const profile = parseCareerProfile({
      schemaVersion: 1,
      basics: {},
      educationHistory: [{ institutionName: '○○大学', endDate: '2014-03' }],
    });
    const result = rirekishoBasicTemplate.render({ careerProfile: profile, kind: 'rirekisho' });
    expect(result.html).toContain('○○大学 卒業');
    expect(result.html).not.toContain('入学');
  });

  it('両 date 無しでも institutionName 等があれば no-date row が出る', () => {
    const profile = parseCareerProfile({
      schemaVersion: 1,
      basics: {},
      educationHistory: [{ institutionName: '○○大学', status: '在学中' }],
    });
    const result = rirekishoBasicTemplate.render({ careerProfile: profile, kind: 'rirekisho' });
    expect(result.html).toContain('○○大学 在学中');
    // date cell は空のはず
    expect(result.html).toMatch(/<tr><td><\/td><td>○○大学 在学中<\/td><\/tr>/);
  });

  it('完全に空の education entry は row を生成しない', () => {
    const profile = parseCareerProfile({
      schemaVersion: 1,
      basics: {},
      educationHistory: [{}],
    });
    const result = rirekishoBasicTemplate.render({ careerProfile: profile, kind: 'rirekisho' });
    expect(result.html).not.toContain('jcd-rirekisho__section--history');
  });

  it('institutionName / faculty / department / degree が空白区切りで連結される', () => {
    const profile = parseCareerProfile({
      schemaVersion: 1,
      basics: {},
      educationHistory: [
        {
          institutionName: '○○大学',
          faculty: '工学部',
          department: '情報工学科',
          degree: '学士',
          endDate: '2014-03',
        },
      ],
    });
    const result = rirekishoBasicTemplate.render({ careerProfile: profile, kind: 'rirekisho' });
    expect(result.html).toContain('○○大学 工学部 情報工学科 学士 卒業');
  });

  it('dated row では description が出力されない', () => {
    const profile = parseCareerProfile({
      schemaVersion: 1,
      basics: {},
      educationHistory: [
        {
          institutionName: '○○大学',
          startDate: '2010-04',
          endDate: '2014-03',
          description: '機械学習を研究',
        },
      ],
    });
    const result = rirekishoBasicTemplate.render({ careerProfile: profile, kind: 'rirekisho' });
    expect(result.html).not.toContain('機械学習を研究');
  });

  it('no-date row では description が （...） で末尾に含まれる', () => {
    const profile = parseCareerProfile({
      schemaVersion: 1,
      basics: {},
      educationHistory: [{ institutionName: '○○大学', description: '機械学習を研究' }],
    });
    const result = rirekishoBasicTemplate.render({ careerProfile: profile, kind: 'rirekisho' });
    expect(result.html).toContain('○○大学（機械学習を研究）');
  });
});

describe('rirekishoBasicTemplate - 職歴 row 生成', () => {
  it('startDate と endDate 両方で 2 row (入社 / 退職)', () => {
    const profile = parseCareerProfile({
      schemaVersion: 1,
      basics: {},
      workExperiences: [
        {
          companyName: '株式会社サンプル',
          period: { startDate: '2014-04', endDate: '2020-03' },
        },
      ],
    });
    const result = rirekishoBasicTemplate.render({ careerProfile: profile, kind: 'rirekisho' });
    expect(result.html).toContain('2014年4月');
    expect(result.html).toContain('株式会社サンプル 入社');
    expect(result.html).toContain('2020年3月');
    expect(result.html).toContain('株式会社サンプル 退職');
  });

  it('isCurrent === true なら 退職 row は生成されず、末尾に 現在に至る row が 1 つ追加される', () => {
    const profile = parseCareerProfile({
      schemaVersion: 1,
      basics: {},
      workExperiences: [
        {
          companyName: '株式会社サンプル',
          period: { startDate: '2020-04', isCurrent: true },
        },
      ],
    });
    const result = rirekishoBasicTemplate.render({ careerProfile: profile, kind: 'rirekisho' });
    expect(result.html).toContain('株式会社サンプル 入社');
    expect(result.html).not.toContain('退職');
    expect(result.html).toContain('現在に至る');
  });

  it('isCurrent === true で endDate が同時にあっても 退職 row は出ない', () => {
    const profile = parseCareerProfile({
      schemaVersion: 1,
      basics: {},
      workExperiences: [
        {
          companyName: '株式会社サンプル',
          period: { startDate: '2020-04', isCurrent: true },
        },
      ],
    });
    const result = rirekishoBasicTemplate.render({ careerProfile: profile, kind: 'rirekisho' });
    expect(result.html).not.toContain('退職');
  });

  it('複数の current entries があっても 現在に至る row は 1 つだけ', () => {
    const profile = parseCareerProfile({
      schemaVersion: 1,
      basics: {},
      workExperiences: [
        { companyName: 'A社', period: { startDate: '2018-04', isCurrent: true } },
        { companyName: 'B社', period: { startDate: '2020-04', isCurrent: true } },
      ],
    });
    const result = rirekishoBasicTemplate.render({ careerProfile: profile, kind: 'rirekisho' });
    const matches = result.html.match(/現在に至る/g);
    expect(matches).not.toBeNull();
    expect(matches?.length).toBe(1);
  });

  it('position と employmentType 両方ある場合 入社 row の末尾に （employmentType / position） を付与', () => {
    const profile = parseCareerProfile({
      schemaVersion: 1,
      basics: {},
      workExperiences: [
        {
          companyName: '株式会社サンプル',
          position: 'ソフトウェアエンジニア',
          employmentType: '正社員',
          period: { startDate: '2014-04' },
        },
      ],
    });
    const result = rirekishoBasicTemplate.render({ careerProfile: profile, kind: 'rirekisho' });
    expect(result.html).toContain('株式会社サンプル 入社（正社員 / ソフトウェアエンジニア）');
  });

  it('position のみなら （position）', () => {
    const profile = parseCareerProfile({
      schemaVersion: 1,
      basics: {},
      workExperiences: [
        {
          companyName: '株式会社サンプル',
          position: 'エンジニア',
          period: { startDate: '2014-04' },
        },
      ],
    });
    const result = rirekishoBasicTemplate.render({ careerProfile: profile, kind: 'rirekisho' });
    expect(result.html).toContain(
      '株式会社サンプル 入社(エンジニア)'.replace(/[()]/g, (m) => (m === '(' ? '（' : '）')),
    );
  });

  it('employmentType のみなら （employmentType）', () => {
    const profile = parseCareerProfile({
      schemaVersion: 1,
      basics: {},
      workExperiences: [
        {
          companyName: '株式会社サンプル',
          employmentType: '正社員',
          period: { startDate: '2014-04' },
        },
      ],
    });
    const result = rirekishoBasicTemplate.render({ careerProfile: profile, kind: 'rirekisho' });
    expect(result.html).toContain('株式会社サンプル 入社（正社員）');
  });

  it('position も employmentType も無ければ annotation なし', () => {
    const profile = parseCareerProfile({
      schemaVersion: 1,
      basics: {},
      workExperiences: [{ companyName: '株式会社サンプル', period: { startDate: '2014-04' } }],
    });
    const result = rirekishoBasicTemplate.render({ careerProfile: profile, kind: 'rirekisho' });
    // entry には括弧付き annotation が含まれない (entry row の content がちょうど `株式会社サンプル 入社` で終わる)
    expect(result.html).toMatch(/<td>株式会社サンプル 入社<\/td>/);
  });

  it('完全に空の work entry は row を生成しない', () => {
    const profile = parseCareerProfile({
      schemaVersion: 1,
      basics: {},
      workExperiences: [{}],
    });
    const result = rirekishoBasicTemplate.render({ careerProfile: profile, kind: 'rirekisho' });
    expect(result.html).not.toContain('jcd-rirekisho__section--history');
  });

  it('date 無しでも companyName があれば no-date row が出る (phrase なし)', () => {
    const profile = parseCareerProfile({
      schemaVersion: 1,
      basics: {},
      workExperiences: [{ companyName: '株式会社サンプル' }],
    });
    const result = rirekishoBasicTemplate.render({ careerProfile: profile, kind: 'rirekisho' });
    expect(result.html).toMatch(/<tr><td><\/td><td>株式会社サンプル<\/td><\/tr>/);
    expect(result.html).not.toContain('入社');
    expect(result.html).not.toContain('退職');
  });

  it('period.isCurrent のみで throw しない', () => {
    const profile = parseCareerProfile({
      schemaVersion: 1,
      basics: {},
      workExperiences: [{ period: { isCurrent: true } }],
    });
    expect(() =>
      rirekishoBasicTemplate.render({ careerProfile: profile, kind: 'rirekisho' }),
    ).not.toThrow();
  });
});

describe('rirekishoBasicTemplate - responsibilities / achievements / summary は rirekisho 年表には描画されない', () => {
  it('responsibilities を含む WorkExperience を render しても 担当業務 / item が現れない', () => {
    const profile = parseCareerProfile({
      schemaVersion: 1,
      basics: {},
      workExperiences: [
        {
          companyName: '株式会社サンプル',
          period: { startDate: '2014-04' },
          responsibilities: ['設計', '実装'],
        },
      ],
    });
    const result = rirekishoBasicTemplate.render({ careerProfile: profile, kind: 'rirekisho' });
    expect(result.html).not.toContain('担当業務');
    expect(result.html).not.toContain('設計');
    expect(result.html).not.toContain('実装');
  });

  it('achievements を含む WorkExperience を render しても 成果 / item が現れない', () => {
    const profile = parseCareerProfile({
      schemaVersion: 1,
      basics: {},
      workExperiences: [
        {
          companyName: '株式会社サンプル',
          period: { startDate: '2014-04' },
          achievements: ['コードレビュー文化を確立'],
        },
      ],
    });
    const result = rirekishoBasicTemplate.render({ careerProfile: profile, kind: 'rirekisho' });
    expect(result.html).not.toContain('成果');
    expect(result.html).not.toContain('コードレビュー文化を確立');
  });

  it('summary を含む WorkExperience を render しても summary text が現れない', () => {
    const profile = parseCareerProfile({
      schemaVersion: 1,
      basics: {},
      workExperiences: [
        {
          companyName: '株式会社サンプル',
          period: { startDate: '2014-04' },
          summary: 'Web アプリケーション開発に従事。',
        },
      ],
    });
    const result = rirekishoBasicTemplate.render({ careerProfile: profile, kind: 'rirekisho' });
    expect(result.html).not.toContain('Web アプリケーション開発に従事。');
  });
});

describe('rirekishoBasicTemplate - input order 保持', () => {
  it('educationHistory 内の複数 entry が input order で描画される', () => {
    const profile = parseCareerProfile({
      schemaVersion: 1,
      basics: {},
      educationHistory: [
        { institutionName: '○○高校', endDate: '2010-03' },
        { institutionName: '△△大学', startDate: '2010-04' },
      ],
    });
    const result = rirekishoBasicTemplate.render({ careerProfile: profile, kind: 'rirekisho' });
    const idxHigh = result.html.indexOf('○○高校');
    const idxUniv = result.html.indexOf('△△大学');
    expect(idxHigh).toBeGreaterThan(-1);
    expect(idxUniv).toBeGreaterThan(idxHigh);
  });

  it('workExperiences 内の複数 entry が input order で描画される', () => {
    const profile = parseCareerProfile({
      schemaVersion: 1,
      basics: {},
      workExperiences: [
        { companyName: 'A社', period: { startDate: '2014-04' } },
        { companyName: 'B社', period: { startDate: '2018-04' } },
      ],
    });
    const result = rirekishoBasicTemplate.render({ careerProfile: profile, kind: 'rirekisho' });
    const idxA = result.html.indexOf('A社');
    const idxB = result.html.indexOf('B社');
    expect(idxA).toBeGreaterThan(-1);
    expect(idxB).toBeGreaterThan(idxA);
  });
});

describe('rirekishoBasicTemplate - skills 描画', () => {
  it('name / category / level / description が描画される', () => {
    const profile = parseCareerProfile({
      schemaVersion: 1,
      basics: {},
      skills: [
        {
          name: 'TypeScript',
          category: 'プログラミング言語',
          level: '上級',
          description: '5 年以上の実務経験',
        },
      ],
    });
    const result = rirekishoBasicTemplate.render({ careerProfile: profile, kind: 'rirekisho' });
    expect(result.html).toContain('<h2>スキル</h2>');
    expect(result.html).toContain('TypeScript');
    expect(result.html).toContain('プログラミング言語');
    expect(result.html).toContain('上級');
    expect(result.html).toContain('5 年以上の実務経験');
  });
});

describe('rirekishoBasicTemplate - certifications 描画', () => {
  it('name / issuer / acquiredDate が描画される', () => {
    const profile = parseCareerProfile({
      schemaVersion: 1,
      basics: {},
      certifications: [
        {
          name: '基本情報技術者',
          issuer: 'IPA',
          acquiredDate: '2015-10',
        },
      ],
    });
    const result = rirekishoBasicTemplate.render({ careerProfile: profile, kind: 'rirekisho' });
    expect(result.html).toContain('<h2>資格</h2>');
    expect(result.html).toContain('基本情報技術者');
    expect(result.html).toContain('IPA');
    expect(result.html).toContain('2015年10月');
  });

  it('credentialUrl は escape された plain text で描画 (<a href> ではない)', () => {
    const profile = parseCareerProfile({
      schemaVersion: 1,
      basics: {},
      certifications: [
        {
          name: 'AWS Certified',
          credentialUrl: 'https://example.com/cert/12345',
        },
      ],
    });
    const result = rirekishoBasicTemplate.render({ careerProfile: profile, kind: 'rirekisho' });
    expect(result.html).toContain('https://example.com/cert/12345');
    expect(result.html).not.toContain('<a ');
    expect(result.html).not.toContain('href=');
  });

  it('expirationDate / credentialId が描画される', () => {
    const profile = parseCareerProfile({
      schemaVersion: 1,
      basics: {},
      certifications: [
        {
          name: 'TOEIC',
          credentialId: 'TC-12345',
          expirationDate: '2027-12',
        },
      ],
    });
    const result = rirekishoBasicTemplate.render({ careerProfile: profile, kind: 'rirekisho' });
    expect(result.html).toContain('TC-12345');
    expect(result.html).toContain('2027年12月');
    expect(result.html).toContain('失効');
  });
});

describe('rirekishoBasicTemplate - projects 描画', () => {
  it('name / organizationName / role / summary が描画される', () => {
    const profile = parseCareerProfile({
      schemaVersion: 1,
      basics: {},
      projects: [
        {
          name: 'jcd-editor',
          organizationName: '個人開発',
          role: 'メイン開発者',
          summary: 'local-first 履歴書エディタの開発',
          startDate: '2024-01',
          endDate: '2025-12',
        },
      ],
    });
    const result = rirekishoBasicTemplate.render({ careerProfile: profile, kind: 'rirekisho' });
    expect(result.html).toContain('<h2>プロジェクト</h2>');
    expect(result.html).toContain('jcd-editor');
    expect(result.html).toContain('個人開発');
    expect(result.html).toContain('メイン開発者');
    expect(result.html).toContain('local-first 履歴書エディタの開発');
  });

  it('isCurrent: true なら end date が "現在"', () => {
    const profile = parseCareerProfile({
      schemaVersion: 1,
      basics: {},
      projects: [
        {
          name: 'jcd-editor',
          startDate: '2024-01',
          isCurrent: true,
        },
      ],
    });
    const result = rirekishoBasicTemplate.render({ careerProfile: profile, kind: 'rirekisho' });
    expect(result.html).toContain('2024年1月');
    expect(result.html).toContain('現在');
  });

  it('technologies が <ul> で描画される', () => {
    const profile = parseCareerProfile({
      schemaVersion: 1,
      basics: {},
      projects: [
        {
          name: 'jcd-editor',
          technologies: ['TypeScript', 'Vitest', 'Biome'],
        },
      ],
    });
    const result = rirekishoBasicTemplate.render({ careerProfile: profile, kind: 'rirekisho' });
    expect(result.html).toContain('使用技術');
    expect(result.html).toContain('TypeScript');
    expect(result.html).toContain('Vitest');
    expect(result.html).toContain('Biome');
  });
});

describe('rirekishoBasicTemplate - escape / 安全性', () => {
  it('<script> タグを name に含めると escape される', () => {
    const profile = parseCareerProfile({
      schemaVersion: 1,
      basics: { name: { family: '<script>', given: 'alert("x")</script>' } },
    });
    const result = rirekishoBasicTemplate.render({ careerProfile: profile, kind: 'rirekisho' });
    expect(result.html).not.toContain('<script>');
    expect(result.html).not.toContain('</script>');
    expect(result.html).toContain('&lt;script&gt;');
    expect(result.html).toContain('&lt;/script&gt;');
  });

  it('& が companyName / institutionName に含まれると &amp; に escape される (二重 escape 込み)', () => {
    const profile = parseCareerProfile({
      schemaVersion: 1,
      basics: {},
      educationHistory: [{ institutionName: '研究 & 開発', endDate: '2020-03' }],
      workExperiences: [{ companyName: 'A & B' }],
    });
    const result = rirekishoBasicTemplate.render({ careerProfile: profile, kind: 'rirekisho' });
    expect(result.html).toContain('A &amp; B');
    expect(result.html).toContain('研究 &amp; 開発');
  });

  it('quote が escape される', () => {
    const profile = parseCareerProfile({
      schemaVersion: 1,
      basics: {},
      workExperiences: [{ companyName: `"quoted" and 'single'` }],
    });
    const result = rirekishoBasicTemplate.render({ careerProfile: profile, kind: 'rirekisho' });
    expect(result.html).toContain('&quot;quoted&quot;');
    expect(result.html).toContain('&#39;single&#39;');
  });

  it('日本語テキストは preserve される', () => {
    const profile = parseCareerProfile({
      schemaVersion: 1,
      basics: { name: { family: '山田', given: '太郎' } },
      workExperiences: [{ companyName: '株式会社サンプル' }],
    });
    const result = rirekishoBasicTemplate.render({ careerProfile: profile, kind: 'rirekisho' });
    expect(result.html).toContain('山田');
    expect(result.html).toContain('太郎');
    expect(result.html).toContain('株式会社サンプル');
  });

  it('html に literal <script> / <iframe> / <object> / <embed> が含まれない', () => {
    const profile = parseCareerProfile({
      schemaVersion: 1,
      basics: { name: { family: '<script>', given: '<iframe>' } },
      workExperiences: [{ summary: '<object data="x"></object><embed src="y">' }],
    });
    const result = rirekishoBasicTemplate.render({ careerProfile: profile, kind: 'rirekisho' });
    expect(result.html).not.toContain('<script>');
    expect(result.html).not.toContain('<iframe>');
    expect(result.html).not.toContain('<object');
    expect(result.html).not.toContain('<embed');
  });
});

describe('rirekishoBasicTemplate - profilePhoto 描画', () => {
  const SAMPLE_DATA_URI = 'data:image/jpeg;base64,X';

  // === dataUri 描画 ===

  it('source.kind === "dataUri" で <img> が描画される', () => {
    const profile = parseCareerProfile({
      schemaVersion: 1,
      basics: {
        profilePhoto: { source: { kind: 'dataUri', dataUri: SAMPLE_DATA_URI } },
      },
    });
    const result = rirekishoBasicTemplate.render({ careerProfile: profile, kind: 'rirekisho' });
    expect(result.html).toContain('<img');
    expect(result.html).toContain('jcd-rirekisho__photo');
  });

  it('<img> の src 属性が dataUri と一致する', () => {
    const profile = parseCareerProfile({
      schemaVersion: 1,
      basics: {
        profilePhoto: { source: { kind: 'dataUri', dataUri: SAMPLE_DATA_URI } },
      },
    });
    const result = rirekishoBasicTemplate.render({ careerProfile: profile, kind: 'rirekisho' });
    expect(result.html).toContain(`src="${SAMPLE_DATA_URI}"`);
  });

  it('altText が non-empty なら alt 属性に escape して入る', () => {
    const profile = parseCareerProfile({
      schemaVersion: 1,
      basics: {
        profilePhoto: {
          source: { kind: 'dataUri', dataUri: SAMPLE_DATA_URI },
          altText: '山田太郎の証明写真',
        },
      },
    });
    const result = rirekishoBasicTemplate.render({ careerProfile: profile, kind: 'rirekisho' });
    expect(result.html).toContain('alt="山田太郎の証明写真"');
  });

  it('altText が undefined なら alt="証明写真" (default) になる', () => {
    const profile = parseCareerProfile({
      schemaVersion: 1,
      basics: {
        profilePhoto: { source: { kind: 'dataUri', dataUri: SAMPLE_DATA_URI } },
      },
    });
    const result = rirekishoBasicTemplate.render({ careerProfile: profile, kind: 'rirekisho' });
    expect(result.html).toContain('alt="証明写真"');
  });

  it('photo container と <img> に期待する class が付く', () => {
    const profile = parseCareerProfile({
      schemaVersion: 1,
      basics: {
        profilePhoto: { source: { kind: 'dataUri', dataUri: SAMPLE_DATA_URI } },
      },
    });
    const result = rirekishoBasicTemplate.render({ careerProfile: profile, kind: 'rirekisho' });
    expect(result.html).toContain('<div class="jcd-rirekisho__photo">');
    expect(result.html).toContain('<img class="jcd-rirekisho__photo-image"');
  });

  // === relativePath は描画しない ===

  it('source.kind === "relativePath" では <img> が出力されない', () => {
    const profile = parseCareerProfile({
      schemaVersion: 1,
      basics: {
        profilePhoto: { source: { kind: 'relativePath', path: 'photos/me.jpg' } },
      },
    });
    const result = rirekishoBasicTemplate.render({ careerProfile: profile, kind: 'rirekisho' });
    expect(result.html).not.toContain('<img');
  });

  it('source.kind === "relativePath" では photo class が出力されない', () => {
    const profile = parseCareerProfile({
      schemaVersion: 1,
      basics: {
        profilePhoto: { source: { kind: 'relativePath', path: 'photos/me.jpg' } },
      },
    });
    const result = rirekishoBasicTemplate.render({ careerProfile: profile, kind: 'rirekisho' });
    expect(result.html).not.toContain('jcd-rirekisho__photo');
  });

  it('source.kind === "relativePath" では path 文字列が html に出力されない', () => {
    const profile = parseCareerProfile({
      schemaVersion: 1,
      basics: {
        profilePhoto: { source: { kind: 'relativePath', path: 'photos/me.jpg' } },
      },
    });
    const result = rirekishoBasicTemplate.render({ careerProfile: profile, kind: 'rirekisho' });
    expect(result.html).not.toContain('photos/me.jpg');
    expect(result.html).not.toContain('src=');
  });

  // === 非描画ケース ===

  it('profilePhoto undefined で <img> も photo container も出ない', () => {
    const result = rirekishoBasicTemplate.render({
      careerProfile: MIN_PROFILE,
      kind: 'rirekisho',
    });
    expect(result.html).not.toContain('<img');
    expect(result.html).not.toContain('jcd-rirekisho__photo');
  });

  it('profilePhoto: {} (source 無し) で photo は描画されない', () => {
    const profile = parseCareerProfile({
      schemaVersion: 1,
      basics: { profilePhoto: {} },
    });
    const result = rirekishoBasicTemplate.render({ careerProfile: profile, kind: 'rirekisho' });
    expect(result.html).not.toContain('<img');
    expect(result.html).not.toContain('jcd-rirekisho__photo');
  });

  it('profilePhoto: { altText } のみ (source 無し) で photo は描画されない', () => {
    const profile = parseCareerProfile({
      schemaVersion: 1,
      basics: { profilePhoto: { altText: 'altのみ' } },
    });
    const result = rirekishoBasicTemplate.render({ careerProfile: profile, kind: 'rirekisho' });
    expect(result.html).not.toContain('<img');
    expect(result.html).not.toContain('jcd-rirekisho__photo');
  });

  // === escape / 安全性 ===

  it('altText の <script> タグが escape される', () => {
    const profile = parseCareerProfile({
      schemaVersion: 1,
      basics: {
        profilePhoto: {
          source: { kind: 'dataUri', dataUri: SAMPLE_DATA_URI },
          altText: '<script>alert("x")</script>',
        },
      },
    });
    const result = rirekishoBasicTemplate.render({ careerProfile: profile, kind: 'rirekisho' });
    expect(result.html).not.toContain('<script>');
    expect(result.html).not.toContain('</script>');
    expect(result.html).toContain('&lt;script&gt;');
    expect(result.html).toContain('&lt;/script&gt;');
  });

  it('altText の quote が double-quoted attribute 内で escape される', () => {
    const profile = parseCareerProfile({
      schemaVersion: 1,
      basics: {
        profilePhoto: {
          source: { kind: 'dataUri', dataUri: SAMPLE_DATA_URI },
          altText: `"quoted" and 'single'`,
        },
      },
    });
    const result = rirekishoBasicTemplate.render({ careerProfile: profile, kind: 'rirekisho' });
    expect(result.html).toContain('&quot;quoted&quot;');
    expect(result.html).toContain('&#39;single&#39;');
    // alt 属性は double-quoted で囲まれている
    expect(result.html).toContain('alt="');
  });

  // === 既存挙動の保全 ===

  it('profilePhoto があっても metadata.templateId は "rirekisho-basic" のまま', () => {
    const profile = parseCareerProfile({
      schemaVersion: 1,
      basics: {
        profilePhoto: { source: { kind: 'dataUri', dataUri: SAMPLE_DATA_URI } },
      },
    });
    const result = rirekishoBasicTemplate.render({ careerProfile: profile, kind: 'rirekisho' });
    expect(result.metadata.templateId).toBe('rirekisho-basic');
    expect(result.html).toContain('<h1 class="jcd-rirekisho__title">履歴書</h1>');
  });
});

describe('rirekishoBasicTemplate - draft tolerance', () => {
  it('すべて optional が空の最小 profile で throw しない', () => {
    expect(() =>
      rirekishoBasicTemplate.render({
        careerProfile: parseCareerProfile({ schemaVersion: 1, basics: {} }),
        kind: 'rirekisho',
      }),
    ).not.toThrow();
  });

  it('一部 field のみ存在する education を描画できる', () => {
    const profile = parseCareerProfile({
      schemaVersion: 1,
      basics: {},
      educationHistory: [{ institutionName: '○○大学' }],
    });
    const result = rirekishoBasicTemplate.render({ careerProfile: profile, kind: 'rirekisho' });
    expect(result.html).toContain('○○大学');
  });

  it('workExperiences の空 entry は history section ごとスキップ', () => {
    const profile = parseCareerProfile({
      schemaVersion: 1,
      basics: {},
      workExperiences: [{}],
    });
    const result = rirekishoBasicTemplate.render({ careerProfile: profile, kind: 'rirekisho' });
    expect(result.html).not.toContain('jcd-rirekisho__section--history');
  });
});

describe('rirekishoBasicTemplate - registry 統合', () => {
  it('createTemplateRegistry に渡せる', () => {
    const registry = createTemplateRegistry([rirekishoBasicTemplate]);
    expect(registry.getTemplate('rirekisho-basic')).toBe(rirekishoBasicTemplate);
  });

  it('明示 templateId "rirekisho-basic" で renderDocument が成功する', () => {
    const registry = createTemplateRegistry([rirekishoBasicTemplate]);
    const result = renderDocument(
      { careerProfile: MIN_PROFILE, kind: 'rirekisho', templateId: 'rirekisho-basic' },
      registry,
    );
    expect(result.metadata.templateId).toBe('rirekisho-basic');
    expect(result.kind).toBe('rirekisho');
  });

  it('implicit 選択 (templateId 省略、rirekisho テンプレが 1 個のみ) で成功する', () => {
    const registry = createTemplateRegistry([rirekishoBasicTemplate]);
    const result = renderDocument({ careerProfile: MIN_PROFILE, kind: 'rirekisho' }, registry);
    expect(result.metadata.templateId).toBe('rirekisho-basic');
  });

  it('別の rirekisho テンプレートが追加されていれば implicit は TEMPLATE_AMBIGUOUS', () => {
    const other: TemplateDefinition = {
      id: 'rirekisho-other',
      kind: 'rirekisho',
      name: 'other',
      render: (input) => ({
        kind: input.kind,
        title: 'x',
        html: '',
        css: '',
        metadata: {
          language: 'ja-JP',
          page: { size: 'A4', orientation: 'portrait' },
        },
      }),
    };
    const registry = createTemplateRegistry([rirekishoBasicTemplate, other]);
    try {
      renderDocument({ careerProfile: MIN_PROFILE, kind: 'rirekisho' }, registry);
      expect.fail('expected throw');
    } catch (e) {
      expect(e).toBeInstanceOf(RendererError);
      if (e instanceof RendererError) {
        expect(e.code).toBe('TEMPLATE_AMBIGUOUS');
      }
    }
  });

  it('templateId が存在しない id なら TEMPLATE_NOT_FOUND', () => {
    const registry = createTemplateRegistry([rirekishoBasicTemplate]);
    try {
      renderDocument(
        { careerProfile: MIN_PROFILE, kind: 'rirekisho', templateId: 'missing' },
        registry,
      );
      expect.fail('expected throw');
    } catch (e) {
      expect(e).toBeInstanceOf(RendererError);
      if (e instanceof RendererError) {
        expect(e.code).toBe('TEMPLATE_NOT_FOUND');
      }
    }
  });
});
