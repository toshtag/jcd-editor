// rirekisho-mhlw-a3 template の挙動を verify する test。
//
// 検証の柱:
//   - identity: id / kind / name / render
//   - 出力契約: kind 一致 / title / metadata.page (A3 landscape)
//   - 構造: ground truth 由来の罫線本数 (h_lines / v_lines の合計 element 数)
//     が HTML に含まれるか
//   - 公式ラベル: 「履歴書」「ふりがな」「学　歴・職　歴」 等の固定 phrase
//     が出力に含まれる
//   - 写真欄: profilePhoto 未指定なら guide phrase / dataUri 指定なら <img>
//   - basics.name 流し込み: 氏名が HTML に含まれる
//   - HTML escape: 危険文字を含む name を渡してもそのまま挿入されない

import { parseCareerProfile } from '@jcd-editor/core';
import { describe, expect, it } from 'vitest';

import { rirekishoMhlwA3Template } from '../templates/rirekisho-mhlw-a3';
import pdfRules from '../templates/data/mhlw-pdf-rules.json' with { type: 'json' };

const MIN_PROFILE = parseCareerProfile({
  schemaVersion: 1,
  basics: {},
});

describe('rirekishoMhlwA3Template - identity', () => {
  it('id is "rirekisho-mhlw-a3"', () => {
    expect(rirekishoMhlwA3Template.id).toBe('rirekisho-mhlw-a3');
  });

  it('kind is "rirekisho"', () => {
    expect(rirekishoMhlwA3Template.kind).toBe('rirekisho');
  });

  it('name is "履歴書（厚労省様式 A3）"', () => {
    expect(rirekishoMhlwA3Template.name).toBe('履歴書（厚労省様式 A3）');
  });

  it('render は関数', () => {
    expect(typeof rirekishoMhlwA3Template.render).toBe('function');
  });
});

describe('rirekishoMhlwA3Template - 基本契約', () => {
  it('最小 CareerProfile で throw しない', () => {
    expect(() =>
      rirekishoMhlwA3Template.render({ careerProfile: MIN_PROFILE, kind: 'rirekisho' }),
    ).not.toThrow();
  });

  it('kind が "rirekisho"', () => {
    const result = rirekishoMhlwA3Template.render({
      careerProfile: MIN_PROFILE,
      kind: 'rirekisho',
    });
    expect(result.kind).toBe('rirekisho');
  });

  it('title が "履歴書"', () => {
    const result = rirekishoMhlwA3Template.render({
      careerProfile: MIN_PROFILE,
      kind: 'rirekisho',
    });
    expect(result.title).toBe('履歴書');
  });

  it('metadata.page は A3 landscape', () => {
    const result = rirekishoMhlwA3Template.render({
      careerProfile: MIN_PROFILE,
      kind: 'rirekisho',
    });
    expect(result.metadata.page).toEqual({ size: 'A3', orientation: 'landscape' });
  });

  it('metadata.language は ja-JP', () => {
    const result = rirekishoMhlwA3Template.render({
      careerProfile: MIN_PROFILE,
      kind: 'rirekisho',
    });
    expect(result.metadata.language).toBe('ja-JP');
  });

  it('css に @page A3 landscape を含む', () => {
    const result = rirekishoMhlwA3Template.render({
      careerProfile: MIN_PROFILE,
      kind: 'rirekisho',
    });
    expect(result.css).toContain('@page { size: A3 landscape;');
  });

  it('公式 PDF と同じく明朝のみで構成され、ゴシック / 手書き風を含まない', () => {
    const result = rirekishoMhlwA3Template.render({
      careerProfile: MIN_PROFILE,
      kind: 'rirekisho',
    });
    expect(result.css).toMatch(/\.jcd-mhlw\s*\{[^}]*"Noto Serif JP"/);
    expect(result.css).not.toContain('Noto Sans JP');
    expect(result.css).not.toContain('Yu Gothic');
    expect(result.css).not.toContain('Hiragino Sans');
    expect(result.css).not.toContain('Klee One');
    expect(result.css).not.toMatch(/transform:\s*scaleY/);
  });

  it('ラベル振り分けは「タイトル」と「通常」の 2 クラスのみ (gothic 振り分けを廃止)', () => {
    const result = rirekishoMhlwA3Template.render({
      careerProfile: MIN_PROFILE,
      kind: 'rirekisho',
    });
    expect(result.html).toContain('jcd-mhlw__label--title');
    expect(result.html).not.toContain('jcd-mhlw__label--gothic');
  });
});

describe('rirekishoMhlwA3Template - 罫線描画', () => {
  // ground truth の合計 rule element 数を計算 (h_lines + v_lines 各 span ごとに 1 div)
  const expectedHCount = pdfRules.h_lines.reduce(
    (sum: number, r: { spans_px: number[][] }) => sum + r.spans_px.length,
    0,
  );
  const expectedVCount = pdfRules.v_lines.reduce(
    (sum: number, r: { spans_px: number[][] }) => sum + r.spans_px.length,
    0,
  );

  it(`水平罫線 element を ground truth と同じ ${expectedHCount} 個出力する`, () => {
    const result = rirekishoMhlwA3Template.render({
      careerProfile: MIN_PROFILE,
      kind: 'rirekisho',
    });
    const matches = result.html.match(/class="jcd-mhlw__rule jcd-mhlw__rule--h"/g);
    expect(matches?.length ?? 0).toBe(expectedHCount);
  });

  it(`垂直罫線 element を ground truth と同じ ${expectedVCount} 個出力する`, () => {
    const result = rirekishoMhlwA3Template.render({
      careerProfile: MIN_PROFILE,
      kind: 'rirekisho',
    });
    const matches = result.html.match(/class="jcd-mhlw__rule jcd-mhlw__rule--v"/g);
    expect(matches?.length ?? 0).toBe(expectedVCount);
  });
});

describe('rirekishoMhlwA3Template - 公式ラベル', () => {
  it('「履歴書」タイトルを含む (kaisho クラス)', () => {
    const result = rirekishoMhlwA3Template.render({
      careerProfile: MIN_PROFILE,
      kind: 'rirekisho',
    });
    expect(result.html).toContain('jcd-mhlw__label--title');
    expect(result.html).toContain('履歴書');
  });

  it('「ふりがな」ラベルを含む (複数箇所、gothic)', () => {
    const result = rirekishoMhlwA3Template.render({
      careerProfile: MIN_PROFILE,
      kind: 'rirekisho',
    });
    const matches = result.html.match(/ふりがな/g);
    // 公式: 氏名・現住所・連絡先 の 3 箇所
    expect(matches?.length ?? 0).toBeGreaterThanOrEqual(3);
  });

  it('「学　歴・職　歴」を含む', () => {
    const result = rirekishoMhlwA3Template.render({
      careerProfile: MIN_PROFILE,
      kind: 'rirekisho',
    });
    expect(result.html).toContain('学');
    expect(result.html).toContain('歴・職');
  });

  it('「免　許・資　格」を含む', () => {
    const result = rirekishoMhlwA3Template.render({
      careerProfile: MIN_PROFILE,
      kind: 'rirekisho',
    });
    expect(result.html).toContain('免');
    expect(result.html).toContain('許・資');
    expect(result.html).toContain('格');
  });

  it('「志望の動機、特技、好きな学科、アピールポイントなど」を含む', () => {
    const result = rirekishoMhlwA3Template.render({
      careerProfile: MIN_PROFILE,
      kind: 'rirekisho',
    });
    expect(result.html).toContain('志望の動機');
  });

  it('「本人希望記入欄」を含む', () => {
    const result = rirekishoMhlwA3Template.render({
      careerProfile: MIN_PROFILE,
      kind: 'rirekisho',
    });
    expect(result.html).toContain('本人希望記入欄');
  });

  it('「※「性別」欄」 注釈 (page footer) を含む', () => {
    const result = rirekishoMhlwA3Template.render({
      careerProfile: MIN_PROFILE,
      kind: 'rirekisho',
    });
    expect(result.html).toContain('性別');
  });
});

describe('rirekishoMhlwA3Template - 写真欄', () => {
  it('profilePhoto 未指定なら guide テキストを出す', () => {
    const result = rirekishoMhlwA3Template.render({
      careerProfile: MIN_PROFILE,
      kind: 'rirekisho',
    });
    expect(result.html).toContain('jcd-mhlw__photo');
    expect(result.html).toContain('写真をはる位置');
    expect(result.html).toContain('本人単身胸から上');
  });

  it('profilePhoto.source.kind が dataUri なら <img> を出す', () => {
    const profile = parseCareerProfile({
      schemaVersion: 1,
      basics: {
        profilePhoto: {
          source: {
            kind: 'dataUri',
            dataUri: 'data:image/png;base64,iVBORw0KGgo=',
          },
        },
      },
    });
    const result = rirekishoMhlwA3Template.render({
      careerProfile: profile,
      kind: 'rirekisho',
    });
    expect(result.html).toContain('<img class="jcd-mhlw__photo-image"');
    expect(result.html).toContain('src="data:image/png;base64,iVBORw0KGgo="');
    // 画像があるときは guide テキストは出さない
    expect(result.html).not.toContain('写真をはる位置');
  });

  it('profilePhoto.altText 指定で <img alt="..."> に反映される', () => {
    const profile = parseCareerProfile({
      schemaVersion: 1,
      basics: {
        profilePhoto: {
          source: {
            kind: 'dataUri',
            dataUri: 'data:image/png;base64,iVBORw0KGgo=',
          },
          altText: '応募者の証明写真',
        },
      },
    });
    const result = rirekishoMhlwA3Template.render({
      careerProfile: profile,
      kind: 'rirekisho',
    });
    expect(result.html).toContain('alt="応募者の証明写真"');
  });

  it('profilePhoto.altText 省略時は default "証明写真" が <img alt> に入る', () => {
    const profile = parseCareerProfile({
      schemaVersion: 1,
      basics: {
        profilePhoto: {
          source: {
            kind: 'dataUri',
            dataUri: 'data:image/png;base64,iVBORw0KGgo=',
          },
        },
      },
    });
    const result = rirekishoMhlwA3Template.render({
      careerProfile: profile,
      kind: 'rirekisho',
    });
    expect(result.html).toContain('alt="証明写真"');
  });
});

describe('rirekishoMhlwA3Template - basics.name 流し込み', () => {
  it('basics.name 未指定なら氏名欄は空', () => {
    const result = rirekishoMhlwA3Template.render({
      careerProfile: MIN_PROFILE,
      kind: 'rirekisho',
    });
    expect(result.html).not.toContain('jcd-mhlw__name"');
  });

  it('basics.name を渡すと family + given が 全角スペース で連結されて表示', () => {
    const profile = parseCareerProfile({
      schemaVersion: 1,
      basics: {
        name: { family: '山田', given: '太郎' },
      },
    });
    const result = rirekishoMhlwA3Template.render({
      careerProfile: profile,
      kind: 'rirekisho',
    });
    expect(result.html).toContain('山田　太郎');
    expect(result.html).toContain('class="jcd-mhlw__name"');
  });

  it('basics.nameKana を渡すと family + given が 全角スペース で連結されて表示', () => {
    const profile = parseCareerProfile({
      schemaVersion: 1,
      basics: {
        nameKana: { family: 'ヤマダ', given: 'タロウ' },
      },
    });
    const result = rirekishoMhlwA3Template.render({
      careerProfile: profile,
      kind: 'rirekisho',
    });
    expect(result.html).toContain('ヤマダ　タロウ');
    expect(result.html).toContain('class="jcd-mhlw__name-kana"');
  });
});

describe('rirekishoMhlwA3Template - HTML escape', () => {
  it('basics.name に含まれる危険文字 (<, >, &, ", \') が escape される', () => {
    // PersonName 値は valibot で sanitize されるが、defensive に確認
    const profile = parseCareerProfile({
      schemaVersion: 1,
      basics: {
        name: { family: '山田<script>', given: 'a&b"c' },
      },
    });
    const result = rirekishoMhlwA3Template.render({
      careerProfile: profile,
      kind: 'rirekisho',
    });
    expect(result.html).not.toContain('<script>');
    expect(result.html).toContain('&lt;script&gt;');
    expect(result.html).toContain('a&amp;b&quot;c');
  });
});

// ===== Phase 1.3-a で追加されたユーザーデータ流し込み =====

describe('rirekishoMhlwA3Template - 生年月日・年齢', () => {
  it('basics.birthDate を渡すと年月日が分解されて表示', () => {
    const profile = parseCareerProfile({
      schemaVersion: 1,
      basics: { birthDate: '1993-04-15' },
    });
    const result = rirekishoMhlwA3Template.render({
      careerProfile: profile,
      kind: 'rirekisho',
    });
    expect(result.html).toContain('jcd-mhlw__birth-year');
    expect(result.html).toContain('>1993<');
    expect(result.html).toContain('>4<');
    expect(result.html).toContain('>15<');
  });

  it('meta.preparedOn を渡すと満年齢が計算されて表示', () => {
    const profile = parseCareerProfile({
      schemaVersion: 1,
      basics: { birthDate: '1993-04-15' },
      meta: { preparedOn: '2026-05-22' },
    });
    const result = rirekishoMhlwA3Template.render({
      careerProfile: profile,
      kind: 'rirekisho',
    });
    // 1993-04-15 を基準 2026-05-22 → 33 歳
    expect(result.html).toContain('jcd-mhlw__age');
    expect(result.html).toContain('>33<');
  });

  it('preparedOn が誕生日より前なら 32 歳 (まだ誕生日が来ていない)', () => {
    const profile = parseCareerProfile({
      schemaVersion: 1,
      basics: { birthDate: '1993-04-15' },
      meta: { preparedOn: '2026-03-01' },
    });
    const result = rirekishoMhlwA3Template.render({
      careerProfile: profile,
      kind: 'rirekisho',
    });
    expect(result.html).toContain('>32<');
  });

  it('birthDate が無ければ年齢欄も出ない', () => {
    const profile = parseCareerProfile({
      schemaVersion: 1,
      basics: {},
      meta: { preparedOn: '2026-05-22' },
    });
    const result = rirekishoMhlwA3Template.render({
      careerProfile: profile,
      kind: 'rirekisho',
    });
    expect(result.html).not.toContain('jcd-mhlw__age');
  });
});

describe('rirekishoMhlwA3Template - 性別', () => {
  it('basics.gender を渡すと表示する', () => {
    const profile = parseCareerProfile({
      schemaVersion: 1,
      basics: { gender: '男性' },
    });
    const result = rirekishoMhlwA3Template.render({
      careerProfile: profile,
      kind: 'rirekisho',
    });
    expect(result.html).toContain('jcd-mhlw__gender');
    expect(result.html).toContain('男性');
  });

  it('gender 未指定なら欄ごと出ない', () => {
    const result = rirekishoMhlwA3Template.render({
      careerProfile: MIN_PROFILE,
      kind: 'rirekisho',
    });
    expect(result.html).not.toContain('jcd-mhlw__gender');
  });
});

describe('rirekishoMhlwA3Template - 年月日現在 (preparedOn)', () => {
  it('preparedOn を渡すと年月日が分解されて表示', () => {
    const profile = parseCareerProfile({
      schemaVersion: 1,
      basics: {},
      meta: { preparedOn: '2026-05-22' },
    });
    const result = rirekishoMhlwA3Template.render({
      careerProfile: profile,
      kind: 'rirekisho',
    });
    expect(result.html).toContain('jcd-mhlw__prepared-year');
    expect(result.html).toContain('>2026<');
    expect(result.html).toContain('>5<');
    expect(result.html).toContain('>22<');
  });

  it('preparedOn 未指定なら欄に流し込まない', () => {
    const result = rirekishoMhlwA3Template.render({
      careerProfile: MIN_PROFILE,
      kind: 'rirekisho',
    });
    expect(result.html).not.toContain('jcd-mhlw__prepared-year');
  });
});

describe('rirekishoMhlwA3Template - 現住所 / 連絡先', () => {
  it('basics.address (郵便番号・都道府県・以降) を formatAddress 経由で流し込む', () => {
    const profile = parseCareerProfile({
      schemaVersion: 1,
      basics: {
        address: {
          postalCode: '100-0001',
          prefecture: '東京都',
          cityAndRest: '千代田区千代田 1-1',
        },
      },
    });
    const result = rirekishoMhlwA3Template.render({
      careerProfile: profile,
      kind: 'rirekisho',
    });
    expect(result.html).toContain('jcd-mhlw__address');
    expect(result.html).toContain('〒100-0001');
    expect(result.html).toContain('東京都');
    expect(result.html).toContain('千代田区千代田 1-1');
  });

  it('basics.addressKana を現住所ふりがな欄に流し込む', () => {
    const profile = parseCareerProfile({
      schemaVersion: 1,
      basics: { addressKana: 'トウキョウト チヨダク' },
    });
    const result = rirekishoMhlwA3Template.render({
      careerProfile: profile,
      kind: 'rirekisho',
    });
    expect(result.html).toContain('jcd-mhlw__address-kana');
    expect(result.html).toContain('トウキョウト チヨダク');
  });

  it('basics.phone を現住所電話欄に流し込む', () => {
    const profile = parseCareerProfile({
      schemaVersion: 1,
      basics: { phone: '03-1234-5678' },
    });
    const result = rirekishoMhlwA3Template.render({
      careerProfile: profile,
      kind: 'rirekisho',
    });
    expect(result.html).toContain('jcd-mhlw__address-phone');
    expect(result.html).toContain('03-1234-5678');
  });

  it('contactAddress / contactAddressKana / contactPhone を連絡先欄に流し込む', () => {
    const profile = parseCareerProfile({
      schemaVersion: 1,
      basics: {
        contactAddress: {
          postalCode: '530-0001',
          prefecture: '大阪府',
          cityAndRest: '大阪市北区梅田',
        },
        contactAddressKana: 'オオサカフ オオサカシ',
        contactPhone: '06-9999-8888',
      },
    });
    const result = rirekishoMhlwA3Template.render({
      careerProfile: profile,
      kind: 'rirekisho',
    });
    expect(result.html).toContain('jcd-mhlw__contact-address');
    expect(result.html).toContain('大阪府');
    expect(result.html).toContain('オオサカフ');
    expect(result.html).toContain('06-9999-8888');
  });
});

describe('rirekishoMhlwA3Template - 学歴・職歴 表', () => {
  it('education / work が無ければ history 欄に row を出さない', () => {
    const result = rirekishoMhlwA3Template.render({
      careerProfile: MIN_PROFILE,
      kind: 'rirekisho',
    });
    expect(result.html).not.toContain('jcd-mhlw__history-heading');
  });

  it('education entry を「学歴」 heading 付きで入学 / 卒業 row に分解して描画', () => {
    const profile = parseCareerProfile({
      schemaVersion: 1,
      basics: {},
      educationHistory: [
        {
          institutionName: '◯◯大学',
          faculty: '工学部',
          department: '情報工学科',
          startDate: '2011-04',
          endDate: '2015-03',
        },
      ],
    });
    const result = rirekishoMhlwA3Template.render({
      careerProfile: profile,
      kind: 'rirekisho',
    });
    // 学歴 heading
    expect(result.html).toContain('jcd-mhlw__history-heading');
    expect(result.html).toContain('学歴');
    // 入学 row
    expect(result.html).toContain('◯◯大学 工学部 情報工学科 入学');
    expect(result.html).toContain('>2011<');
    // 卒業 row (default status)
    expect(result.html).toContain('◯◯大学 工学部 情報工学科 卒業');
    expect(result.html).toContain('>2015<');
  });

  it('education entry の status が指定されればそれを使う', () => {
    const profile = parseCareerProfile({
      schemaVersion: 1,
      basics: {},
      educationHistory: [
        {
          institutionName: '◯◯大学',
          endDate: '2027-03',
          status: '卒業見込み',
        },
      ],
    });
    const result = rirekishoMhlwA3Template.render({
      careerProfile: profile,
      kind: 'rirekisho',
    });
    expect(result.html).toContain('◯◯大学 卒業見込み');
  });

  it('work entry を「職歴」 heading 付きで入社 / 退職 row に分解して描画', () => {
    const profile = parseCareerProfile({
      schemaVersion: 1,
      basics: {},
      workExperiences: [
        {
          companyName: '株式会社サンプル',
          position: 'エンジニア',
          period: { startDate: '2015-04', endDate: '2020-03' },
        },
      ],
    });
    const result = rirekishoMhlwA3Template.render({
      careerProfile: profile,
      kind: 'rirekisho',
    });
    expect(result.html).toContain('職歴');
    expect(result.html).toContain('株式会社サンプル 入社');
    expect(result.html).toContain('エンジニア');
    expect(result.html).toContain('株式会社サンプル 退職');
  });

  it('work entry の isCurrent: true なら退職 row を抑制し、末尾に「現在に至る」を出す', () => {
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
    const result = rirekishoMhlwA3Template.render({
      careerProfile: profile,
      kind: 'rirekisho',
    });
    expect(result.html).toContain('株式会社サンプル 入社');
    expect(result.html).not.toContain('株式会社サンプル 退職');
    expect(result.html).toContain('現在に至る');
  });

  it('学歴 + 職歴 合計が 20 件 (左 9 + 右 11) を超える分は切り捨てる', () => {
    const educations = Array.from({ length: 15 }, (_, i) => ({
      institutionName: `学校${i + 1}`,
      startDate: '2000-04',
      endDate: '2004-03',
    }));
    const profile = parseCareerProfile({
      schemaVersion: 1,
      basics: {},
      educationHistory: educations,
    });
    const result = rirekishoMhlwA3Template.render({
      careerProfile: profile,
      kind: 'rirekisho',
    });
    // 15 件 × 2 row + 学歴 heading = 31 行 → 20 行までしか描画されない
    expect(result.html).toContain('学校1');
    expect(result.html).toContain('学校10');
    // 学校 15 の 卒業 row は溢れる
    expect(result.html).not.toContain('学校15 卒業');
  });
});

describe('rirekishoMhlwA3Template - 免許・資格', () => {
  it('certifications が無ければ row を出さない', () => {
    const result = rirekishoMhlwA3Template.render({
      careerProfile: MIN_PROFILE,
      kind: 'rirekisho',
    });
    expect(result.html).not.toContain('jcd-mhlw__cert-content');
  });

  it('certification.name と acquiredDate を年月 / 内容に分解して描画', () => {
    const profile = parseCareerProfile({
      schemaVersion: 1,
      basics: {},
      certifications: [
        {
          name: '基本情報技術者試験',
          acquiredDate: '2015-04',
        },
      ],
    });
    const result = rirekishoMhlwA3Template.render({
      careerProfile: profile,
      kind: 'rirekisho',
    });
    expect(result.html).toContain('jcd-mhlw__cert-content');
    expect(result.html).toContain('基本情報技術者試験');
    expect(result.html).toContain('>2015<');
    expect(result.html).toContain('>4<');
  });

  it('issuer が指定されていれば (issuer) として末尾に括弧書きで付ける', () => {
    const profile = parseCareerProfile({
      schemaVersion: 1,
      basics: {},
      certifications: [
        {
          name: 'TOEIC',
          issuer: 'IIBC',
          acquiredDate: '2020-06',
        },
      ],
    });
    const result = rirekishoMhlwA3Template.render({
      careerProfile: profile,
      kind: 'rirekisho',
    });
    expect(result.html).toContain('TOEIC');
    expect(result.html).toContain('（IIBC）');
  });

  it('credentialId / credentialUrl / expirationDate / description は履歴書には出さない', () => {
    const profile = parseCareerProfile({
      schemaVersion: 1,
      basics: {},
      certifications: [
        {
          name: 'AWS Certified',
          credentialId: 'ABC-123456',
          credentialUrl: 'https://example.com/cert/abc',
          expirationDate: '2030-12',
          description: '詳細説明',
          acquiredDate: '2024-01',
        },
      ],
    });
    const result = rirekishoMhlwA3Template.render({
      careerProfile: profile,
      kind: 'rirekisho',
    });
    expect(result.html).toContain('AWS Certified');
    expect(result.html).not.toContain('ABC-123456');
    expect(result.html).not.toContain('example.com');
    expect(result.html).not.toContain('2030');
    expect(result.html).not.toContain('詳細説明');
  });

  it('資格行数の上限 (6 件) を超えた分は切り捨てる', () => {
    const certs = Array.from({ length: 10 }, (_, i) => ({
      name: `資格${i + 1}`,
      acquiredDate: '2020-04',
    }));
    const profile = parseCareerProfile({
      schemaVersion: 1,
      basics: {},
      certifications: certs,
    });
    const result = rirekishoMhlwA3Template.render({
      careerProfile: profile,
      kind: 'rirekisho',
    });
    expect(result.html).toContain('資格1');
    expect(result.html).toContain('資格6');
    expect(result.html).not.toContain('資格7');
    expect(result.html).not.toContain('資格10');
  });
});

describe('rirekishoMhlwA3Template - 志望の動機 / 本人希望記入欄', () => {
  it('basics.summary が無ければ志望動機 box を出さない', () => {
    const result = rirekishoMhlwA3Template.render({
      careerProfile: MIN_PROFILE,
      kind: 'rirekisho',
    });
    expect(result.html).not.toContain('jcd-mhlw__summary');
  });

  it('basics.summary を渡すと志望動機 box に表示し、改行を <br> に変換する', () => {
    const profile = parseCareerProfile({
      schemaVersion: 1,
      basics: { summary: '志望動機:\n御社の技術力に魅力を感じ' },
    });
    const result = rirekishoMhlwA3Template.render({
      careerProfile: profile,
      kind: 'rirekisho',
    });
    expect(result.html).toContain('jcd-mhlw__summary');
    expect(result.html).toContain('志望動機:<br>御社の技術力に魅力を感じ');
  });

  it('basics.personalRequest を本人希望 box に流し込み、改行を <br> に変換する', () => {
    const profile = parseCareerProfile({
      schemaVersion: 1,
      basics: { personalRequest: '勤務地希望:\n都内' },
    });
    const result = rirekishoMhlwA3Template.render({
      careerProfile: profile,
      kind: 'rirekisho',
    });
    expect(result.html).toContain('jcd-mhlw__personal-request');
    expect(result.html).toContain('勤務地希望:<br>都内');
  });

  it('summary / personalRequest 内の HTML が escape される', () => {
    const profile = parseCareerProfile({
      schemaVersion: 1,
      basics: {
        summary: '<script>alert(1)</script>',
        personalRequest: 'a & b',
      },
    });
    const result = rirekishoMhlwA3Template.render({
      careerProfile: profile,
      kind: 'rirekisho',
    });
    expect(result.html).not.toContain('<script>alert(1)</script>');
    expect(result.html).toContain('&lt;script&gt;');
    expect(result.html).toContain('a &amp; b');
  });
});
