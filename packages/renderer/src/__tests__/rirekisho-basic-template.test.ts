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

describe('rirekishoBasicTemplate - educationHistory 描画', () => {
  it('単一 entry が <li> として描画される', () => {
    const profile = parseCareerProfile({
      schemaVersion: 1,
      basics: {},
      educationHistory: [
        {
          institutionName: '○○大学',
          faculty: '工学部',
          department: '情報工学科',
          status: '卒業',
          startDate: '2010-04',
          endDate: '2014-03',
        },
      ],
    });
    const result = rirekishoBasicTemplate.render({ careerProfile: profile, kind: 'rirekisho' });
    expect(result.html).toContain(
      '<section class="jcd-rirekisho__section jcd-rirekisho__section--education">',
    );
    expect(result.html).toContain('<h2>学歴</h2>');
    expect(result.html).toContain('○○大学');
    expect(result.html).toContain('工学部');
    expect(result.html).toContain('情報工学科');
    expect(result.html).toContain('2010年4月');
    expect(result.html).toContain('2014年3月');
    expect(result.html).toContain('卒業');
  });

  it('status が free string ("卒業見込み") としてそのまま描画される', () => {
    const profile = parseCareerProfile({
      schemaVersion: 1,
      basics: {},
      educationHistory: [{ institutionName: '○○大学', status: '卒業見込み' }],
    });
    const result = rirekishoBasicTemplate.render({ careerProfile: profile, kind: 'rirekisho' });
    expect(result.html).toContain('卒業見込み');
  });

  it('複数 entry が順序通り描画される', () => {
    const profile = parseCareerProfile({
      schemaVersion: 1,
      basics: {},
      educationHistory: [{ institutionName: '○○高校' }, { institutionName: '△△大学' }],
    });
    const result = rirekishoBasicTemplate.render({ careerProfile: profile, kind: 'rirekisho' });
    const idxHigh = result.html.indexOf('○○高校');
    const idxUniv = result.html.indexOf('△△大学');
    expect(idxHigh).toBeGreaterThan(-1);
    expect(idxUniv).toBeGreaterThan(idxHigh);
  });

  it('空 entry ({}) は skip され、section も出ない', () => {
    const profile = parseCareerProfile({
      schemaVersion: 1,
      basics: {},
      educationHistory: [{}],
    });
    const result = rirekishoBasicTemplate.render({ careerProfile: profile, kind: 'rirekisho' });
    expect(result.html).not.toContain('jcd-rirekisho__section--education');
  });

  it('educationHistory が空配列なら section が出ない', () => {
    const profile = parseCareerProfile({
      schemaVersion: 1,
      basics: {},
      educationHistory: [],
    });
    const result = rirekishoBasicTemplate.render({ careerProfile: profile, kind: 'rirekisho' });
    expect(result.html).not.toContain('jcd-rirekisho__section--education');
  });

  it('educationHistory が undefined なら section が出ない', () => {
    const result = rirekishoBasicTemplate.render({
      careerProfile: MIN_PROFILE,
      kind: 'rirekisho',
    });
    expect(result.html).not.toContain('jcd-rirekisho__section--education');
  });
});

describe('rirekishoBasicTemplate - workExperiences 描画', () => {
  it('companyName / position / summary / period が描画される', () => {
    const profile = parseCareerProfile({
      schemaVersion: 1,
      basics: {},
      workExperiences: [
        {
          companyName: '株式会社サンプル',
          position: 'ソフトウェアエンジニア',
          employmentType: '正社員',
          period: { startDate: '2018-04', endDate: '2022-03' },
          summary: 'Web アプリケーション開発に従事。',
        },
      ],
    });
    const result = rirekishoBasicTemplate.render({ careerProfile: profile, kind: 'rirekisho' });
    expect(result.html).toContain('<h2>職歴</h2>');
    expect(result.html).toContain('株式会社サンプル');
    expect(result.html).toContain('ソフトウェアエンジニア');
    expect(result.html).toContain('正社員');
    expect(result.html).toContain('2018年4月');
    expect(result.html).toContain('2022年3月');
    expect(result.html).toContain('Web アプリケーション開発に従事。');
  });

  it('period.isCurrent === true なら end date が "現在" として描画', () => {
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
    const result = rirekishoBasicTemplate.render({ careerProfile: profile, kind: 'rirekisho' });
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
          responsibilities: ['設計', '実装'],
          achievements: ['コードレビュー文化を確立'],
        },
      ],
    });
    const result = rirekishoBasicTemplate.render({ careerProfile: profile, kind: 'rirekisho' });
    expect(result.html).toContain('担当業務');
    expect(result.html).toContain('設計');
    expect(result.html).toContain('実装');
    expect(result.html).toContain('成果');
    expect(result.html).toContain('コードレビュー文化を確立');
  });

  it('period のみ (isCurrent のみ等) で throw しない', () => {
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

  it('& が summary に含まれると &amp; に escape される (二重 escape 込み)', () => {
    const profile = parseCareerProfile({
      schemaVersion: 1,
      basics: {},
      workExperiences: [{ companyName: 'A & B', summary: '研究 & 開発' }],
    });
    const result = rirekishoBasicTemplate.render({ careerProfile: profile, kind: 'rirekisho' });
    expect(result.html).toContain('A &amp; B');
    expect(result.html).toContain('研究 &amp; 開発');
  });

  it('quote が escape される', () => {
    const profile = parseCareerProfile({
      schemaVersion: 1,
      basics: {},
      workExperiences: [{ summary: `"quoted" and 'single'` }],
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

describe('rirekishoBasicTemplate - profilePhoto', () => {
  it('basics.profilePhoto (dataUri) が含まれても html に出力されない', () => {
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
    const result = rirekishoBasicTemplate.render({ careerProfile: profile, kind: 'rirekisho' });
    expect(result.html).not.toContain('data:image');
    expect(result.html).not.toContain('<img');
    expect(result.html).not.toContain('jcd-rirekisho__photo');
  });

  it('basics.profilePhoto (relativePath) が含まれても html に出力されない', () => {
    const profile = parseCareerProfile({
      schemaVersion: 1,
      basics: {
        profilePhoto: {
          source: { kind: 'relativePath', path: 'photos/me.jpg' },
        },
      },
    });
    const result = rirekishoBasicTemplate.render({ careerProfile: profile, kind: 'rirekisho' });
    expect(result.html).not.toContain('photos/me.jpg');
    expect(result.html).not.toContain('<img');
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

  it('workExperiences の空 entry は section ごとスキップ', () => {
    const profile = parseCareerProfile({
      schemaVersion: 1,
      basics: {},
      workExperiences: [{}],
    });
    const result = rirekishoBasicTemplate.render({ careerProfile: profile, kind: 'rirekisho' });
    expect(result.html).not.toContain('jcd-rirekisho__section--work');
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
