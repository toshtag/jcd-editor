import { parseCareerProfile } from '@jcd-editor/core';
import { describe, expect, it } from 'vitest';

import { RendererError } from '../errors';
import { renderDocument } from '../render-document';
import { createTemplateRegistry } from '../template-registry';
import { rirekishoMhlwA4Template } from '../templates/rirekisho-mhlw-a4';
import { shokumukeirekishoBasicTemplate } from '../templates/shokumukeirekisho-basic';

const MIN_PROFILE = parseCareerProfile({
  schemaVersion: 1,
  basics: {},
});

describe('shokumukeirekishoBasicTemplate - identity', () => {
  it('id is "shokumukeirekisho-basic"', () => {
    expect(shokumukeirekishoBasicTemplate.id).toBe('shokumukeirekisho-basic');
  });

  it('kind is "shokumukeirekisho"', () => {
    expect(shokumukeirekishoBasicTemplate.kind).toBe('shokumukeirekisho');
  });

  it('name is "職務経歴書（基本）"', () => {
    expect(shokumukeirekishoBasicTemplate.name).toBe('職務経歴書（基本）');
  });

  it('render は関数', () => {
    expect(typeof shokumukeirekishoBasicTemplate.render).toBe('function');
  });
});

describe('shokumukeirekishoBasicTemplate - 直接 render の基本契約', () => {
  it('最小 CareerProfile で throw しない', () => {
    expect(() =>
      shokumukeirekishoBasicTemplate.render({
        careerProfile: MIN_PROFILE,
        kind: 'shokumukeirekisho',
      }),
    ).not.toThrow();
  });

  it('kind が "shokumukeirekisho"', () => {
    const result = shokumukeirekishoBasicTemplate.render({
      careerProfile: MIN_PROFILE,
      kind: 'shokumukeirekisho',
    });
    expect(result.kind).toBe('shokumukeirekisho');
  });

  it('title が "職務経歴書"', () => {
    const result = shokumukeirekishoBasicTemplate.render({
      careerProfile: MIN_PROFILE,
      kind: 'shokumukeirekisho',
    });
    expect(result.title).toBe('職務経歴書');
  });

  it('metadata.language が "ja-JP"', () => {
    const result = shokumukeirekishoBasicTemplate.render({
      careerProfile: MIN_PROFILE,
      kind: 'shokumukeirekisho',
    });
    expect(result.metadata.language).toBe('ja-JP');
  });

  it('metadata.page が A4 portrait', () => {
    const result = shokumukeirekishoBasicTemplate.render({
      careerProfile: MIN_PROFILE,
      kind: 'shokumukeirekisho',
    });
    expect(result.metadata.page).toEqual({ size: 'A4', orientation: 'portrait' });
  });

  it('metadata.templateId が "shokumukeirekisho-basic" (template 自身がセット)', () => {
    const result = shokumukeirekishoBasicTemplate.render({
      careerProfile: MIN_PROFILE,
      kind: 'shokumukeirekisho',
    });
    expect(result.metadata.templateId).toBe('shokumukeirekisho-basic');
  });

  it('html / css が非空 string', () => {
    const result = shokumukeirekishoBasicTemplate.render({
      careerProfile: MIN_PROFILE,
      kind: 'shokumukeirekisho',
    });
    expect(typeof result.html).toBe('string');
    expect(typeof result.css).toBe('string');
    expect(result.html.length).toBeGreaterThan(0);
    expect(result.css.length).toBeGreaterThan(0);
  });

  it('css に印刷時の改ページ制御が含まれる (h2 widow / li break)', () => {
    // 詳細な設計判断は docs/investigations/preview-pagination.md を参照。
    // 構造的依存を捕捉するため、CSS literal が変更されたときに test を更新する
    // 必要があることを明示する目的で regex assertion を置く。
    const result = shokumukeirekishoBasicTemplate.render({
      careerProfile: MIN_PROFILE,
      kind: 'shokumukeirekisho',
    });
    // h2 後の改ページ抑制 (heading widow 防止)
    expect(result.css).toMatch(/\.jcd-shokumukeirekisho__section\s+h2[^}]*break-after:\s*avoid/);
    expect(result.css).toMatch(
      /\.jcd-shokumukeirekisho__section\s+h2[^}]*page-break-after:\s*avoid/,
    );
    // section li (workExperiences / projects / skills / certifications entry) の途中改ページ抑制
    expect(result.css).toMatch(/\.jcd-shokumukeirekisho__section\s+li[^}]*break-inside:\s*avoid/);
    expect(result.css).toMatch(
      /\.jcd-shokumukeirekisho__section\s+li[^}]*page-break-inside:\s*avoid/,
    );
  });

  it('html に "undefined" / "null" / "[object Object]" 文字列が含まれない', () => {
    const result = shokumukeirekishoBasicTemplate.render({
      careerProfile: MIN_PROFILE,
      kind: 'shokumukeirekisho',
    });
    expect(result.html).not.toContain('undefined');
    expect(result.html).not.toContain('null');
    expect(result.html).not.toContain('[object Object]');
  });

  it('html が <article class="jcd-shokumukeirekisho"> を含む', () => {
    const result = shokumukeirekishoBasicTemplate.render({
      careerProfile: MIN_PROFILE,
      kind: 'shokumukeirekisho',
    });
    expect(result.html).toContain('<article class="jcd-shokumukeirekisho">');
  });

  it('html が jcd-shokumukeirekisho__title class を含む', () => {
    const result = shokumukeirekishoBasicTemplate.render({
      careerProfile: MIN_PROFILE,
      kind: 'shokumukeirekisho',
    });
    expect(result.html).toContain('jcd-shokumukeirekisho__title');
  });

  it('html がタイトルテキスト "職務経歴書" を含む', () => {
    const result = shokumukeirekishoBasicTemplate.render({
      careerProfile: MIN_PROFILE,
      kind: 'shokumukeirekisho',
    });
    expect(result.html).toContain('職務経歴書');
  });
});

describe('shokumukeirekishoBasicTemplate - basics 描画', () => {
  it('氏名 (family + given) が描画される', () => {
    const profile = parseCareerProfile({
      schemaVersion: 1,
      basics: { name: { family: '山田', given: '太郎' } },
    });
    const result = shokumukeirekishoBasicTemplate.render({
      careerProfile: profile,
      kind: 'shokumukeirekisho',
    });
    expect(result.html).toContain('山田');
    expect(result.html).toContain('太郎');
    expect(result.html).toContain('<dt>氏名</dt>');
  });

  it('email / phone が描画される', () => {
    const profile = parseCareerProfile({
      schemaVersion: 1,
      basics: { email: 'taro@example.com', phone: '03-1234-5678' },
    });
    const result = shokumukeirekishoBasicTemplate.render({
      careerProfile: profile,
      kind: 'shokumukeirekisho',
    });
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
    const result = shokumukeirekishoBasicTemplate.render({
      careerProfile: profile,
      kind: 'shokumukeirekisho',
    });
    expect(result.html).toContain('〒100-0001 東京都千代田区千代田1-1');
  });

  it('住所が postalCode 無し なら prefecture + cityAndRest のみ連結', () => {
    const profile = parseCareerProfile({
      schemaVersion: 1,
      basics: {
        address: { prefecture: '東京都', cityAndRest: '千代田区千代田1-1' },
      },
    });
    const result = shokumukeirekishoBasicTemplate.render({
      careerProfile: profile,
      kind: 'shokumukeirekisho',
    });
    expect(result.html).toContain('東京都千代田区千代田1-1');
    expect(result.html).not.toContain('〒');
  });

  it('basics がすべて空なら <dl> 自体が出ない', () => {
    const result = shokumukeirekishoBasicTemplate.render({
      careerProfile: MIN_PROFILE,
      kind: 'shokumukeirekisho',
    });
    expect(result.html).not.toContain('jcd-shokumukeirekisho__basics');
  });
});

describe('shokumukeirekishoBasicTemplate - nameKana / birthDate は意図的にスキップ', () => {
  it('nameKana を含む profile を render しても html にフリガナが描画されない', () => {
    const profile = parseCareerProfile({
      schemaVersion: 1,
      basics: {
        name: { family: '山田', given: '太郎' },
        nameKana: { family: 'ヤマダ', given: 'タロウ' },
      },
    });
    const result = shokumukeirekishoBasicTemplate.render({
      careerProfile: profile,
      kind: 'shokumukeirekisho',
    });
    expect(result.html).not.toContain('ヤマダ');
    expect(result.html).not.toContain('タロウ');
    expect(result.html).not.toContain('フリガナ');
  });

  it('birthDate を含む profile を render しても html に生年月日が描画されない', () => {
    const profile = parseCareerProfile({
      schemaVersion: 1,
      basics: { birthDate: '1990-01-15' },
    });
    const result = shokumukeirekishoBasicTemplate.render({
      careerProfile: profile,
      kind: 'shokumukeirekisho',
    });
    expect(result.html).not.toContain('1990');
    expect(result.html).not.toContain('生年月日');
  });
});

describe('shokumukeirekishoBasicTemplate - workExperiences 描画 (メインコンテンツ)', () => {
  it('セクションヘッダが "職務経歴" であり、companyName / position / summary / period が描画される', () => {
    const profile = parseCareerProfile({
      schemaVersion: 1,
      basics: {},
      workExperiences: [
        {
          companyName: '株式会社サンプル',
          position: 'シニアエンジニア',
          employmentType: '正社員',
          period: { startDate: '2018-04', endDate: '2022-03' },
          summary: 'バックエンド開発を担当。',
        },
      ],
    });
    const result = shokumukeirekishoBasicTemplate.render({
      careerProfile: profile,
      kind: 'shokumukeirekisho',
    });
    expect(result.html).toContain('<h2>職務経歴</h2>');
    expect(result.html).toContain('株式会社サンプル');
    expect(result.html).toContain('シニアエンジニア');
    expect(result.html).toContain('正社員');
    expect(result.html).toContain('2018年4月');
    expect(result.html).toContain('2022年3月');
    expect(result.html).toContain('バックエンド開発を担当。');
  });

  it('period.isCurrent === true で end date が "現在"', () => {
    const profile = parseCareerProfile({
      schemaVersion: 1,
      basics: {},
      workExperiences: [
        {
          companyName: '株式会社サンプル',
          period: { startDate: '2020-01', isCurrent: true },
        },
      ],
    });
    const result = shokumukeirekishoBasicTemplate.render({
      careerProfile: profile,
      kind: 'shokumukeirekisho',
    });
    expect(result.html).toContain('2020年1月');
    expect(result.html).toContain('現在');
  });

  it('responsibilities / achievements が <ul> で描画される', () => {
    const profile = parseCareerProfile({
      schemaVersion: 1,
      basics: {},
      workExperiences: [
        {
          companyName: '株式会社サンプル',
          responsibilities: ['設計', '実装', 'コードレビュー'],
          achievements: ['チームのデプロイ頻度を 5 倍に向上'],
        },
      ],
    });
    const result = shokumukeirekishoBasicTemplate.render({
      careerProfile: profile,
      kind: 'shokumukeirekisho',
    });
    expect(result.html).toContain('担当業務');
    expect(result.html).toContain('設計');
    expect(result.html).toContain('実装');
    expect(result.html).toContain('コードレビュー');
    expect(result.html).toContain('成果');
    expect(result.html).toContain('チームのデプロイ頻度を 5 倍に向上');
  });

  it('空 entry / 空配列 / undefined で section ごとスキップ', () => {
    const empty = shokumukeirekishoBasicTemplate.render({
      careerProfile: parseCareerProfile({
        schemaVersion: 1,
        basics: {},
        workExperiences: [{}],
      }),
      kind: 'shokumukeirekisho',
    });
    const emptyArr = shokumukeirekishoBasicTemplate.render({
      careerProfile: parseCareerProfile({
        schemaVersion: 1,
        basics: {},
        workExperiences: [],
      }),
      kind: 'shokumukeirekisho',
    });
    const undef = shokumukeirekishoBasicTemplate.render({
      careerProfile: MIN_PROFILE,
      kind: 'shokumukeirekisho',
    });
    expect(empty.html).not.toContain('jcd-shokumukeirekisho__section--work');
    expect(emptyArr.html).not.toContain('jcd-shokumukeirekisho__section--work');
    expect(undef.html).not.toContain('jcd-shokumukeirekisho__section--work');
  });
});

describe('shokumukeirekishoBasicTemplate - projects 描画', () => {
  it('name / organizationName / role / summary / period が描画される', () => {
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
    const result = shokumukeirekishoBasicTemplate.render({
      careerProfile: profile,
      kind: 'shokumukeirekisho',
    });
    expect(result.html).toContain('<h2>プロジェクト</h2>');
    expect(result.html).toContain('jcd-editor');
    expect(result.html).toContain('個人開発');
    expect(result.html).toContain('メイン開発者');
    expect(result.html).toContain('local-first 履歴書エディタの開発');
  });

  it('isCurrent: true で "現在"', () => {
    const profile = parseCareerProfile({
      schemaVersion: 1,
      basics: {},
      projects: [{ name: 'jcd-editor', startDate: '2024-01', isCurrent: true }],
    });
    const result = shokumukeirekishoBasicTemplate.render({
      careerProfile: profile,
      kind: 'shokumukeirekisho',
    });
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
    const result = shokumukeirekishoBasicTemplate.render({
      careerProfile: profile,
      kind: 'shokumukeirekisho',
    });
    expect(result.html).toContain('使用技術');
    expect(result.html).toContain('TypeScript');
    expect(result.html).toContain('Vitest');
    expect(result.html).toContain('Biome');
  });

  it('空 entry / 空配列 / undefined で section ごとスキップ', () => {
    const empty = shokumukeirekishoBasicTemplate.render({
      careerProfile: parseCareerProfile({
        schemaVersion: 1,
        basics: {},
        projects: [{}],
      }),
      kind: 'shokumukeirekisho',
    });
    expect(empty.html).not.toContain('jcd-shokumukeirekisho__section--projects');
  });
});

describe('shokumukeirekishoBasicTemplate - skills 描画', () => {
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
    const result = shokumukeirekishoBasicTemplate.render({
      careerProfile: profile,
      kind: 'shokumukeirekisho',
    });
    expect(result.html).toContain('<h2>スキル</h2>');
    expect(result.html).toContain('TypeScript');
    expect(result.html).toContain('プログラミング言語');
    expect(result.html).toContain('上級');
    expect(result.html).toContain('5 年以上の実務経験');
  });

  it('空 entry はスキップ', () => {
    const result = shokumukeirekishoBasicTemplate.render({
      careerProfile: parseCareerProfile({
        schemaVersion: 1,
        basics: {},
        skills: [{}],
      }),
      kind: 'shokumukeirekisho',
    });
    expect(result.html).not.toContain('jcd-shokumukeirekisho__section--skills');
  });
});

describe('shokumukeirekishoBasicTemplate - certifications 描画', () => {
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
    const result = shokumukeirekishoBasicTemplate.render({
      careerProfile: profile,
      kind: 'shokumukeirekisho',
    });
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
    const result = shokumukeirekishoBasicTemplate.render({
      careerProfile: profile,
      kind: 'shokumukeirekisho',
    });
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
    const result = shokumukeirekishoBasicTemplate.render({
      careerProfile: profile,
      kind: 'shokumukeirekisho',
    });
    expect(result.html).toContain('TC-12345');
    expect(result.html).toContain('2027年12月');
    expect(result.html).toContain('失効');
  });

  it('空 entry はスキップ', () => {
    const result = shokumukeirekishoBasicTemplate.render({
      careerProfile: parseCareerProfile({
        schemaVersion: 1,
        basics: {},
        certifications: [{}],
      }),
      kind: 'shokumukeirekisho',
    });
    expect(result.html).not.toContain('jcd-shokumukeirekisho__section--certifications');
  });
});

describe('shokumukeirekishoBasicTemplate - educationHistory (optional final section)', () => {
  it('educationHistory がある場合 section が出る', () => {
    const profile = parseCareerProfile({
      schemaVersion: 1,
      basics: {},
      educationHistory: [
        {
          institutionName: '○○大学',
          faculty: '工学部',
          status: '卒業',
          startDate: '2010-04',
          endDate: '2014-03',
        },
      ],
    });
    const result = shokumukeirekishoBasicTemplate.render({
      careerProfile: profile,
      kind: 'shokumukeirekisho',
    });
    expect(result.html).toContain('<h2>学歴</h2>');
    expect(result.html).toContain('○○大学');
    expect(result.html).toContain('工学部');
    expect(result.html).toContain('卒業');
    expect(result.html).toContain('2010年4月');
  });

  it('educationHistory が最後の section として出る (work / certifications より後)', () => {
    const profile = parseCareerProfile({
      schemaVersion: 1,
      basics: {},
      workExperiences: [{ companyName: 'X社' }],
      certifications: [{ name: 'TOEIC' }],
      educationHistory: [{ institutionName: 'Y大学' }],
    });
    const result = shokumukeirekishoBasicTemplate.render({
      careerProfile: profile,
      kind: 'shokumukeirekisho',
    });
    const idxWork = result.html.indexOf('--work');
    const idxCertifications = result.html.indexOf('--certifications');
    const idxEducation = result.html.indexOf('--education');
    expect(idxWork).toBeGreaterThan(-1);
    expect(idxCertifications).toBeGreaterThan(-1);
    expect(idxEducation).toBeGreaterThan(-1);
    expect(idxEducation).toBeGreaterThan(idxWork);
    expect(idxEducation).toBeGreaterThan(idxCertifications);
  });

  it('educationHistory が undefined / 空 でも他 section は普通に出る', () => {
    const profile = parseCareerProfile({
      schemaVersion: 1,
      basics: {},
      workExperiences: [{ companyName: 'X社' }],
    });
    const result = shokumukeirekishoBasicTemplate.render({
      careerProfile: profile,
      kind: 'shokumukeirekisho',
    });
    expect(result.html).toContain('jcd-shokumukeirekisho__section--work');
    expect(result.html).not.toContain('jcd-shokumukeirekisho__section--education');
  });

  it('educationHistory: [{}] (空 entry のみ) で section スキップ', () => {
    const result = shokumukeirekishoBasicTemplate.render({
      careerProfile: parseCareerProfile({
        schemaVersion: 1,
        basics: {},
        educationHistory: [{}],
      }),
      kind: 'shokumukeirekisho',
    });
    expect(result.html).not.toContain('jcd-shokumukeirekisho__section--education');
  });
});

describe('shokumukeirekishoBasicTemplate - escape / 安全性', () => {
  it('<script> タグを companyName に含めると escape される', () => {
    const profile = parseCareerProfile({
      schemaVersion: 1,
      basics: {},
      workExperiences: [{ companyName: '<script>alert("x")</script>' }],
    });
    const result = shokumukeirekishoBasicTemplate.render({
      careerProfile: profile,
      kind: 'shokumukeirekisho',
    });
    expect(result.html).not.toContain('<script>');
    expect(result.html).not.toContain('</script>');
    expect(result.html).toContain('&lt;script&gt;');
  });

  it('& が summary に含まれると &amp; に escape される', () => {
    const profile = parseCareerProfile({
      schemaVersion: 1,
      basics: {},
      workExperiences: [{ companyName: 'A & B', summary: '研究 & 開発' }],
    });
    const result = shokumukeirekishoBasicTemplate.render({
      careerProfile: profile,
      kind: 'shokumukeirekisho',
    });
    expect(result.html).toContain('A &amp; B');
    expect(result.html).toContain('研究 &amp; 開発');
  });

  it('quote が escape される', () => {
    const profile = parseCareerProfile({
      schemaVersion: 1,
      basics: {},
      workExperiences: [{ summary: `"quoted" and 'single'` }],
    });
    const result = shokumukeirekishoBasicTemplate.render({
      careerProfile: profile,
      kind: 'shokumukeirekisho',
    });
    expect(result.html).toContain('&quot;quoted&quot;');
    expect(result.html).toContain('&#39;single&#39;');
  });

  it('日本語テキストは preserve される', () => {
    const profile = parseCareerProfile({
      schemaVersion: 1,
      basics: { name: { family: '山田', given: '太郎' } },
      workExperiences: [{ companyName: '株式会社サンプル' }],
    });
    const result = shokumukeirekishoBasicTemplate.render({
      careerProfile: profile,
      kind: 'shokumukeirekisho',
    });
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
    const result = shokumukeirekishoBasicTemplate.render({
      careerProfile: profile,
      kind: 'shokumukeirekisho',
    });
    expect(result.html).not.toContain('<script>');
    expect(result.html).not.toContain('<iframe>');
    expect(result.html).not.toContain('<object');
    expect(result.html).not.toContain('<embed');
  });

  it('credentialUrl の URL が plain text として出る、<a href を含まない', () => {
    const profile = parseCareerProfile({
      schemaVersion: 1,
      basics: {},
      certifications: [{ name: 'X', credentialUrl: 'https://example.com/x' }],
    });
    const result = shokumukeirekishoBasicTemplate.render({
      careerProfile: profile,
      kind: 'shokumukeirekisho',
    });
    expect(result.html).toContain('https://example.com/x');
    expect(result.html).not.toContain('<a href');
  });
});

describe('shokumukeirekishoBasicTemplate - profilePhoto は render しない', () => {
  it('dataUri profilePhoto を含む profile でも html に出力されない', () => {
    const profile = parseCareerProfile({
      schemaVersion: 1,
      basics: {
        profilePhoto: {
          source: {
            kind: 'dataUri',
            dataUri: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAEBAQEB',
          },
        },
      },
    });
    const result = shokumukeirekishoBasicTemplate.render({
      careerProfile: profile,
      kind: 'shokumukeirekisho',
    });
    expect(result.html).not.toContain('data:image');
    expect(result.html).not.toContain('<img');
  });

  it('relativePath profilePhoto を含む profile でも html に出力されない', () => {
    const profile = parseCareerProfile({
      schemaVersion: 1,
      basics: {
        profilePhoto: {
          source: { kind: 'relativePath', path: 'photos/me.jpg' },
        },
      },
    });
    const result = shokumukeirekishoBasicTemplate.render({
      careerProfile: profile,
      kind: 'shokumukeirekisho',
    });
    expect(result.html).not.toContain('photos/me.jpg');
    expect(result.html).not.toContain('<img');
  });
});

describe('shokumukeirekishoBasicTemplate - draft tolerance', () => {
  it('最小 profile で throw しない', () => {
    expect(() =>
      shokumukeirekishoBasicTemplate.render({
        careerProfile: MIN_PROFILE,
        kind: 'shokumukeirekisho',
      }),
    ).not.toThrow();
  });

  it('一部 field のみ存在する work experience で render', () => {
    const profile = parseCareerProfile({
      schemaVersion: 1,
      basics: {},
      workExperiences: [{ companyName: '株式会社サンプル' }],
    });
    const result = shokumukeirekishoBasicTemplate.render({
      careerProfile: profile,
      kind: 'shokumukeirekisho',
    });
    expect(result.html).toContain('株式会社サンプル');
  });

  it('period: { isCurrent: true } のみで throw しない', () => {
    const profile = parseCareerProfile({
      schemaVersion: 1,
      basics: {},
      workExperiences: [{ period: { isCurrent: true } }],
    });
    expect(() =>
      shokumukeirekishoBasicTemplate.render({
        careerProfile: profile,
        kind: 'shokumukeirekisho',
      }),
    ).not.toThrow();
  });
});

describe('shokumukeirekishoBasicTemplate - registry 統合', () => {
  it('createTemplateRegistry に渡せる', () => {
    const registry = createTemplateRegistry([shokumukeirekishoBasicTemplate]);
    expect(registry.getTemplate('shokumukeirekisho-basic')).toBe(shokumukeirekishoBasicTemplate);
  });

  it('明示 templateId "shokumukeirekisho-basic" で renderDocument が成功する', () => {
    const registry = createTemplateRegistry([shokumukeirekishoBasicTemplate]);
    const result = renderDocument(
      {
        careerProfile: MIN_PROFILE,
        kind: 'shokumukeirekisho',
        templateId: 'shokumukeirekisho-basic',
      },
      registry,
    );
    expect(result.metadata.templateId).toBe('shokumukeirekisho-basic');
    expect(result.kind).toBe('shokumukeirekisho');
  });

  it('implicit 選択 (templateId 省略) で成功する', () => {
    const registry = createTemplateRegistry([shokumukeirekishoBasicTemplate]);
    const result = renderDocument(
      { careerProfile: MIN_PROFILE, kind: 'shokumukeirekisho' },
      registry,
    );
    expect(result.metadata.templateId).toBe('shokumukeirekisho-basic');
  });

  it('存在しない templateId なら TEMPLATE_NOT_FOUND', () => {
    const registry = createTemplateRegistry([shokumukeirekishoBasicTemplate]);
    try {
      renderDocument(
        {
          careerProfile: MIN_PROFILE,
          kind: 'shokumukeirekisho',
          templateId: 'missing',
        },
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

describe('rirekisho と shokumukeirekisho の共存 (registry レベル)', () => {
  const bothRegistry = createTemplateRegistry([
    rirekishoMhlwA4Template,
    shokumukeirekishoBasicTemplate,
  ]);

  it('rirekisho の implicit 選択で rirekisho-mhlw-a4 が使われる', () => {
    const result = renderDocument({ careerProfile: MIN_PROFILE, kind: 'rirekisho' }, bothRegistry);
    expect(result.metadata.templateId).toBe('rirekisho-mhlw-a4');
    expect(result.kind).toBe('rirekisho');
    expect(result.title).toBe('履歴書');
  });

  it('shokumukeirekisho の implicit 選択で shokumukeirekisho-basic が使われる', () => {
    const result = renderDocument(
      { careerProfile: MIN_PROFILE, kind: 'shokumukeirekisho' },
      bothRegistry,
    );
    expect(result.metadata.templateId).toBe('shokumukeirekisho-basic');
    expect(result.kind).toBe('shokumukeirekisho');
    expect(result.title).toBe('職務経歴書');
  });

  it('明示 templateId で rirekisho-mhlw-a4 を選べる', () => {
    const result = renderDocument(
      {
        careerProfile: MIN_PROFILE,
        kind: 'rirekisho',
        templateId: 'rirekisho-mhlw-a4',
      },
      bothRegistry,
    );
    expect(result.metadata.templateId).toBe('rirekisho-mhlw-a4');
  });

  it('明示 templateId で shokumukeirekisho-basic を選べる', () => {
    const result = renderDocument(
      {
        careerProfile: MIN_PROFILE,
        kind: 'shokumukeirekisho',
        templateId: 'shokumukeirekisho-basic',
      },
      bothRegistry,
    );
    expect(result.metadata.templateId).toBe('shokumukeirekisho-basic');
  });
});
