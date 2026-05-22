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
