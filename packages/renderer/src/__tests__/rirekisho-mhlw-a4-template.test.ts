// rirekisho-mhlw-a4 template 用 test。
//
// A3 版 (rirekisho-mhlw-a3-template.test.ts) と機能差分はなく、検証する挙動は
// ほぼ同じ。違うのは:
//   - metadata.page = A4 portrait
//   - 罫線 / テキスト座標が A3 → A4 座標変換 (x≥210 のものは y に +297mm)
//   - css class prefix が `jcd-mhlw-a4__` (A3 は `jcd-mhlw__`)
//
// 本 test は A4 固有の挙動 (座標変換 + 2 ページ container + CSS @page A4)
// に焦点を当てる。共通挙動 (HistoryRow 構築ロジック等) は shared.ts で
// 検証済み + A3 test で検証済みなので、ここでは「A4 として正しく出力される」
// ことだけを確認する。

import { parseCareerProfile } from '@jcd-editor/core';
import { describe, expect, it } from 'vitest';

import { rirekishoMhlwA4Template } from '../templates/rirekisho-mhlw-a4';
import pdfRules from '../templates/data/mhlw-pdf-rules.json' with { type: 'json' };

const MIN_PROFILE = parseCareerProfile({ schemaVersion: 1, basics: {} });

describe('rirekishoMhlwA4Template - identity', () => {
  it('id is "rirekisho-mhlw-a4"', () => {
    expect(rirekishoMhlwA4Template.id).toBe('rirekisho-mhlw-a4');
  });

  it('kind is "rirekisho"', () => {
    expect(rirekishoMhlwA4Template.kind).toBe('rirekisho');
  });

  it('name は "履歴書（厚労省様式 A4 縦 2 ページ）"', () => {
    expect(rirekishoMhlwA4Template.name).toBe('履歴書（厚労省様式 A4 縦 2 ページ）');
  });
});

describe('rirekishoMhlwA4Template - 基本契約', () => {
  it('最小 CareerProfile で throw しない', () => {
    expect(() =>
      rirekishoMhlwA4Template.render({ careerProfile: MIN_PROFILE, kind: 'rirekisho' }),
    ).not.toThrow();
  });

  it('metadata.page は A4 portrait', () => {
    const r = rirekishoMhlwA4Template.render({ careerProfile: MIN_PROFILE, kind: 'rirekisho' });
    expect(r.metadata.page).toEqual({ size: 'A4', orientation: 'portrait' });
  });

  it('css に @page A4 portrait を含む', () => {
    const r = rirekishoMhlwA4Template.render({ careerProfile: MIN_PROFILE, kind: 'rirekisho' });
    expect(r.css).toContain('@page { size: A4 portrait;');
  });

  it('container は高さ 594mm (A4 × 2 ページ分)', () => {
    const r = rirekishoMhlwA4Template.render({ careerProfile: MIN_PROFILE, kind: 'rirekisho' });
    expect(r.css).toContain('height: 594mm');
  });

  it('css class prefix は jcd-mhlw-a4__ (A3 の jcd-mhlw__ と衝突しない)', () => {
    const r = rirekishoMhlwA4Template.render({ careerProfile: MIN_PROFILE, kind: 'rirekisho' });
    expect(r.html).toContain('class="jcd-mhlw-a4"');
    expect(r.html).toContain('jcd-mhlw-a4__rule');
    expect(r.html).not.toContain('class="jcd-mhlw"'); // A3 prefix が紛れ込まない
  });

  it('罫線と写真欄に print-color-adjust:exact が適用される (PDF 出力時に消えない)', () => {
    const r = rirekishoMhlwA4Template.render({ careerProfile: MIN_PROFILE, kind: 'rirekisho' });
    // 罫線 (.jcd-mhlw-a4__rule): background:#000 を print 時にも保持
    expect(r.css).toMatch(/\.jcd-mhlw-a4__rule\s*\{[^}]*print-color-adjust:\s*exact/);
    expect(r.css).toMatch(/\.jcd-mhlw-a4__rule\s*\{[^}]*-webkit-print-color-adjust:\s*exact/);
    // 写真欄 (.jcd-mhlw-a4__photo): dashed border と案内テキストを print 時にも保持
    expect(r.css).toMatch(/\.jcd-mhlw-a4__photo\s*\{[^}]*print-color-adjust:\s*exact/);
  });

  it('公式 PDF と同じく明朝のみで構成され、ゴシック (Noto Sans JP) や手書き風 (Klee One) を含まない', () => {
    const r = rirekishoMhlwA4Template.render({ careerProfile: MIN_PROFILE, kind: 'rirekisho' });
    // 本文 article は Noto Serif JP スタック (明朝)
    expect(r.css).toMatch(/\.jcd-mhlw-a4\s*\{[^}]*"Noto Serif JP"/);
    // ゴシック (Noto Sans JP / Yu Gothic / Hiragino Sans) は CSS から完全に除去
    expect(r.css).not.toContain('Noto Sans JP');
    expect(r.css).not.toContain('Yu Gothic');
    expect(r.css).not.toContain('Hiragino Sans');
    // 手書き風 (Klee One) も使わない
    expect(r.css).not.toContain('Klee One');
    // 「履歴書」タイトルの scaleY アレンジも公式に無いので削除済み
    expect(r.css).not.toMatch(/transform:\s*scaleY/);
  });

  it('ラベル振り分けは「タイトル」と「通常」の 2 クラスのみ (gothic 振り分けを廃止)', () => {
    const r = rirekishoMhlwA4Template.render({ careerProfile: MIN_PROFILE, kind: 'rirekisho' });
    expect(r.html).toContain('jcd-mhlw-a4__label--title'); // 「履歴書」用
    expect(r.html).not.toContain('jcd-mhlw-a4__label--gothic');
  });
});

describe('rirekishoMhlwA4Template - 罫線描画 (A3 → A4 座標変換)', () => {
  const expectedHCount = pdfRules.h_lines.reduce(
    (sum: number, r: { spans_px: number[][] }) => sum + r.spans_px.length,
    0,
  );
  const expectedVCount = pdfRules.v_lines.reduce(
    (sum: number, r: { spans_px: number[][] }) => sum + r.spans_px.length,
    0,
  );

  it(`水平罫線 ${expectedHCount} 本を出力する (A3 と同じ本数、座標は変換される)`, () => {
    const r = rirekishoMhlwA4Template.render({ careerProfile: MIN_PROFILE, kind: 'rirekisho' });
    const matches = r.html.match(/class="jcd-mhlw-a4__rule jcd-mhlw-a4__rule--h"/g);
    expect(matches?.length ?? 0).toBe(expectedHCount);
  });

  it(`垂直罫線 ${expectedVCount} 本を出力する`, () => {
    const r = rirekishoMhlwA4Template.render({ careerProfile: MIN_PROFILE, kind: 'rirekisho' });
    const matches = r.html.match(/class="jcd-mhlw-a4__rule jcd-mhlw-a4__rule--v"/g);
    expect(matches?.length ?? 0).toBe(expectedVCount);
  });

  it('A3 の右ページ罫線 (x≥210mm) が A4 page 2 (y≥297mm) に変換される', () => {
    const r = rirekishoMhlwA4Template.render({ careerProfile: MIN_PROFILE, kind: 'rirekisho' });
    // 公式 A3 の右ページ列の左罫線は x=228.85mm 付近にあるが、A4 では x オフセット
    // -205.23mm が引かれて 23.62mm 付近になる。y は +297mm されている。
    // 罫線 div の "top:" に 297 以上の mm 値が現れるはず。
    const topMatches = r.html.match(/top:(\d+\.\d+)mm/g) ?? [];
    const yValues = topMatches.map((s) => Number(s.replace(/top:|mm/g, '')));
    const hasPage2 = yValues.some((y) => y >= 297);
    expect(hasPage2).toBe(true);
  });
});

describe('rirekishoMhlwA4Template - 公式ラベル', () => {
  it('「履歴書」タイトルを page 1 (y < 297mm) に出す', () => {
    const r = rirekishoMhlwA4Template.render({ careerProfile: MIN_PROFILE, kind: 'rirekisho' });
    expect(r.html).toContain('履歴書');
    // 「履歴書」label の y は 28mm 程度 (A3 と同じ)、A4 page 1 内
    expect(r.html).toMatch(/jcd-mhlw-a4__label--title[^>]*top:2[0-9]\.\d+mm/);
  });

  it('右ページ由来のラベル「学　歴・職　歴」が A4 page 2 (y > 297mm) に配置される', () => {
    const r = rirekishoMhlwA4Template.render({ careerProfile: MIN_PROFILE, kind: 'rirekisho' });
    // 右ページの「学　歴・職　歴 (各別…)」 label は A3 で y=29.51mm にあるので、
    // A4 では y=326.51mm に配置されているはず
    // 公式 A3 右ページの「学　歴・職　歴 (各別…)」 label は y=29.51 にあり、
    // A4 では +297 - 7.88 (余白均等化) = 318.63 付近に配置される
    expect(r.html).toMatch(/top:31[0-9]\.\d+mm[^>]*>歴・職</);
  });
});

describe('rirekishoMhlwA4Template - 写真欄 (A4 page 1 に残る)', () => {
  it('photo box の top は A4 page 1 内 (y < 297mm)', () => {
    const r = rirekishoMhlwA4Template.render({ careerProfile: MIN_PROFILE, kind: 'rirekisho' });
    // PHOTO_BOX_MM.y = 27.69 → A4 で同じ y のまま
    // 左右上下余白の均等化シフト (Y: -7.88mm) 後の top
    expect(r.html).toContain('top:19.810mm');
    expect(r.html).toContain('jcd-mhlw-a4__photo');
  });
});

describe('rirekishoMhlwA4Template - データ流し込み (A3 と挙動互換)', () => {
  it('basics.name を流し込む', () => {
    const profile = parseCareerProfile({
      schemaVersion: 1,
      basics: { name: { family: '山田', given: '太郎' } },
    });
    const r = rirekishoMhlwA4Template.render({ careerProfile: profile, kind: 'rirekisho' });
    expect(r.html).toContain('山田　太郎');
    expect(r.html).toContain('class="jcd-mhlw-a4__name"');
  });

  it('basics.summary が右ページ box に変換配置される (A4 page 2 = y > 297mm)', () => {
    const profile = parseCareerProfile({
      schemaVersion: 1,
      basics: { summary: '志望の動機\nテスト' },
    });
    const r = rirekishoMhlwA4Template.render({ careerProfile: profile, kind: 'rirekisho' });
    expect(r.html).toContain('jcd-mhlw-a4__summary');
    // SUMMARY_BOX_MM.x = 230 (右ページ) → A4 で y > 297
    expect(r.html).toMatch(/jcd-mhlw-a4__summary[^>]*top:46\d\.\d+mm/);
  });

  it('学歴 entry を 左ページ (A4 page 1) の正しい行に配置する', () => {
    const profile = parseCareerProfile({
      schemaVersion: 1,
      basics: {},
      educationHistory: [
        { institutionName: 'サンプル大学', startDate: '2016-04', endDate: '2020-03' },
      ],
    });
    const r = rirekishoMhlwA4Template.render({ careerProfile: profile, kind: 'rirekisho' });
    expect(r.html).toContain('学歴');
    expect(r.html).toContain('サンプル大学 入学');
    expect(r.html).toContain('サンプル大学 卒業');
  });

  it('学歴+職歴が左ページ容量 (9 行) を超えた分は A4 page 2 に変換される', () => {
    const educations = Array.from({ length: 8 }, (_, i) => ({
      institutionName: `学校${i + 1}`,
      startDate: '2000-04',
      endDate: '2004-03',
    }));
    const profile = parseCareerProfile({
      schemaVersion: 1,
      basics: {},
      educationHistory: educations,
    });
    const r = rirekishoMhlwA4Template.render({ careerProfile: profile, kind: 'rirekisho' });
    // 学歴 heading 1 行 + 8 件 × 2 row = 17 行。最初 9 行 は左ページ、残り 8 行 は右ページ → A4 page 2
    expect(r.html).toMatch(/jcd-mhlw-a4__history-content[^>]*top:3\d\d\.\d+mm[^>]*>学校/);
  });
});

// 公式 PDF (pdffonts + 罫線実測) を base にした位置検証。値セルがラベル直右
// もしくは box 境界と一致しているかを style 文字列で assert する。
// 数値は mm 値 (placeOnA4(...) の出力)。座標が変わったら test も更新する前提。
describe('rirekishoMhlwA4Template - 値セル位置 (公式 bbox / 罫線実測準拠)', () => {
  it('nameKana 値セルは「ふりがな」ラベル右端から 4mm 隙間 (left=46mm, top はラベルと baseline 一致)', () => {
    const profile = parseCareerProfile({
      schemaVersion: 1,
      basics: { nameKana: { family: 'ヤマダ', given: 'タロウ' } },
    });
    const r = rirekishoMhlwA4Template.render({ careerProfile: profile, kind: 'rirekisho' });
    // 公式値 46.0 から余白均等化シフト (X: -4.685mm) で left=41.315mm
    expect(r.html).toMatch(/jcd-mhlw-a4__name-kana[^>]*left:41\.315mm/);
    // ラベル y=39.87 から余白均等化シフト (Y: -7.88mm) で top=31.990mm
    expect(r.html).toMatch(/jcd-mhlw-a4__name-kana[^>]*top:31\.990mm/);
  });

  it('addressKana / contactAddressKana も ラベル直右 (left=46mm) + 公式ラベル y と同 top', () => {
    const profile = parseCareerProfile({
      schemaVersion: 1,
      basics: { addressKana: 'トウキョウト', contactAddressKana: 'チヨダ' },
    });
    const r = rirekishoMhlwA4Template.render({ careerProfile: profile, kind: 'rirekisho' });
    // 公式値 46.0 / 81.95 / 104.48 から余白均等化シフト後 (X: -4.685, Y: -7.88)
    expect(r.html).toMatch(/jcd-mhlw-a4__address-kana[^>]*left:41\.315mm/);
    expect(r.html).toMatch(/jcd-mhlw-a4__address-kana[^>]*top:74\.070mm/);
    expect(r.html).toMatch(/jcd-mhlw-a4__contact-address-kana[^>]*left:41\.315mm/);
    expect(r.html).toMatch(/jcd-mhlw-a4__contact-address-kana[^>]*top:96\.600mm/);
  });

  it('「ふりがな」 ラベルは font-size 10pt で描画される (公式 bbox h=3.51mm 準拠)', () => {
    const r = rirekishoMhlwA4Template.render({ careerProfile: MIN_PROFILE, kind: 'rirekisho' });
    // ふりがな の <div class="...label..."> に font-size:10pt が指定される
    expect(r.html).toMatch(/jcd-mhlw-a4__label[^>]*font-size:10pt[^>]*>ふりがな</);
  });

  it('addressPhone / contactAddressPhone 値セルは電話 box 全幅 (left=160.44, w=35.31mm) に text-align:center で X 軸中央寄せ', () => {
    const profile = parseCareerProfile({
      schemaVersion: 1,
      basics: { phone: '03-1234-5678', contactPhone: '090-1234-5678' },
    });
    const r = rirekishoMhlwA4Template.render({ careerProfile: profile, kind: 'rirekisho' });
    // 公式値 160.440 から余白均等化シフト (X: -4.685mm) で 155.755mm
    expect(r.html).toMatch(/jcd-mhlw-a4__address-phone[^>]*left:155\.755mm/);
    expect(r.html).toMatch(/jcd-mhlw-a4__address-phone[^>]*text-align:center/);
    expect(r.html).toMatch(/jcd-mhlw-a4__contact-address-phone[^>]*left:155\.755mm/);
    expect(r.html).toMatch(/jcd-mhlw-a4__contact-address-phone[^>]*text-align:center/);
  });

  it('学歴・職歴表 月セルは常に右寄せ (1 桁 / 2 桁とも text-align:right、box が左 padding 分シフトして配置)', () => {
    const profile = parseCareerProfile({
      schemaVersion: 1,
      basics: {},
      historyRows: [
        { year: '2016', month: '4', content: '入学' },
        { year: '2020', month: '12', content: '卒業' },
      ],
    });
    const r = rirekishoMhlwA4Template.render({ careerProfile: profile, kind: 'rirekisho' });
    expect(r.html).toMatch(/jcd-mhlw-a4__history-month[^>]*text-align:right[^>]*>4<\/div>/);
    expect(r.html).toMatch(/jcd-mhlw-a4__history-month[^>]*text-align:right[^>]*>12<\/div>/);
  });

  it('学歴・職歴表 内容セル: 「学歴」「職歴」 は中央寄せ、「以上」 は右寄せ、その他は左寄せ', () => {
    const profile = parseCareerProfile({
      schemaVersion: 1,
      basics: {},
      historyRows: [
        { year: '', month: '', content: '学歴' },
        { year: '2016', month: '4', content: 'サンプル大学 入学' },
        { year: '', month: '', content: '以上' },
      ],
    });
    const r = rirekishoMhlwA4Template.render({ careerProfile: profile, kind: 'rirekisho' });
    expect(r.html).toMatch(/jcd-mhlw-a4__history-content[^>]*text-align:center[^>]*>学歴<\/div>/);
    expect(r.html).toMatch(
      /jcd-mhlw-a4__history-content[^>]*text-align:left[^>]*>サンプル大学 入学<\/div>/,
    );
    expect(r.html).toMatch(/jcd-mhlw-a4__history-content[^>]*text-align:right[^>]*>以上<\/div>/);
  });

  it('学歴・職歴表の行内値テキストは box 縦中央寄せ (top に +2.4mm オフセット)', () => {
    const profile = parseCareerProfile({
      schemaVersion: 1,
      basics: {},
      historyRows: [{ year: '2016', month: '4', content: 'サンプル大学 入学' }],
    });
    const r = rirekishoMhlwA4Template.render({ careerProfile: profile, kind: 'rirekisho' });
    // sourceIndex=0 の content: 137.58 + 2.4 (中央寄せ) - 7.88 (余白均等化) = 132.100
    expect(r.html).toMatch(/jcd-mhlw-a4__history-content[^>]*top:132\.100mm[^>]*>サンプル大学/);
  });

  it('免許・資格表の行内値テキストも box 縦中央寄せ', () => {
    const profile = parseCareerProfile({
      schemaVersion: 1,
      basics: {},
      certificationRows: [{ year: '2020', month: '4', content: '基本情報技術者試験' }],
    });
    const r = rirekishoMhlwA4Template.render({ careerProfile: profile, kind: 'rirekisho' });
    // 免許・資格は A3 右ページ → A4 page 2 (+297mm) に変換される。
    // 106.6 + 2.4 (中央寄せ) + 297 - 7.88 (余白均等化) = 398.120mm
    expect(r.html).toMatch(/jcd-mhlw-a4__cert-content[^>]*top:398\.120mm[^>]*>基本情報技術者試験/);
  });

  it('写真欄の padding-top は 5mm (heading 位置を公式 y=33.10 に近づける)', () => {
    const r = rirekishoMhlwA4Template.render({ careerProfile: MIN_PROFILE, kind: 'rirekisho' });
    expect(r.css).toMatch(/\.jcd-mhlw-a4__photo\s*\{[^}]*padding:\s*5mm/);
  });

  it('「志望の動機〜」 ラベルは font-size 11pt (項目タイトルと同 size)', () => {
    const r = rirekishoMhlwA4Template.render({ careerProfile: MIN_PROFILE, kind: 'rirekisho' });
    expect(r.html).toMatch(/jcd-mhlw-a4__label[^>]*font-size:11pt[^>]*>志望の動機/);
  });

  it('「本人希望記入欄」 ラベルは 11pt、その後の括弧部分のみ inline span で 10pt に切り替わる', () => {
    const r = rirekishoMhlwA4Template.render({ careerProfile: MIN_PROFILE, kind: 'rirekisho' });
    // ラベル div の font-size は 11pt
    expect(r.html).toMatch(/jcd-mhlw-a4__label[^>]*font-size:11pt[^>]*>本人希望記入欄/);
    // 括弧部分は <span style="font-size:10pt;"> 内
    expect(r.html).toMatch(
      /本人希望記入欄<span style="font-size:10pt;">（特に給料・職種・勤務時間・勤務地・その他についての希望などがあれば記入）<\/span>/,
    );
  });

  it('「本人希望記入欄」 ラベルの x は「志望の動機」 ラベルと同じ位置に統一される', () => {
    const r = rirekishoMhlwA4Template.render({ careerProfile: MIN_PROFILE, kind: 'rirekisho' });
    // 公式 textBbox 上、志望の動機 x=233.239、本人希望記入欄 x=231.54。
    // ユーザー指示で本人希望側を志望動機側 (233.239) に上書き。
    // 233.239 - 205.23 (A4 変換) - 4.685 (余白均等化) = 23.324mm
    expect(r.html).toMatch(/jcd-mhlw-a4__label[^>]*left:23\.324mm[^>]*>本人希望記入欄/);
    expect(r.html).toMatch(/jcd-mhlw-a4__label[^>]*left:23\.324mm[^>]*>志望の動機/);
  });

  it('free-text 本文は font-size 11pt (項目タイトル本体と同サイズ)', () => {
    const r = rirekishoMhlwA4Template.render({ careerProfile: MIN_PROFILE, kind: 'rirekisho' });
    expect(r.css).toMatch(/\.jcd-mhlw-a4__free-text\s*\{[^}]*font-size:\s*11pt/);
  });

  it('本人希望記入欄の line-height は罫線間隔 (9.06mm) に揃える', () => {
    const r = rirekishoMhlwA4Template.render({ careerProfile: MIN_PROFILE, kind: 'rirekisho' });
    expect(r.css).toMatch(/\.jcd-mhlw-a4__personal-request\s*\{[^}]*line-height:\s*9\.06mm/);
  });

  it('summary / personalRequest box は罫線実測値 (x=228.85 → A4 で 23.62) に揃う', () => {
    const profile = parseCareerProfile({
      schemaVersion: 1,
      basics: { summary: '志望の動機', personalRequest: '希望' },
    });
    const r = rirekishoMhlwA4Template.render({ careerProfile: profile, kind: 'rirekisho' });
    // SUMMARY_BOX_MM.x = 228.85 → -205.23 - 4.685 = 18.935mm
    expect(r.html).toMatch(/jcd-mhlw-a4__summary[^>]*left:18\.935mm/);
    // SUMMARY_BOX_MM.y = 171.96 → +297 - 7.88 = 461.080mm
    expect(r.html).toMatch(/jcd-mhlw-a4__summary[^>]*top:461\.08\dmm/);
    // personalRequest: x=228.85 同様、y=237.49+297-7.88=526.610mm
    expect(r.html).toMatch(/jcd-mhlw-a4__personal-request[^>]*left:18\.935mm/);
    expect(r.html).toMatch(/jcd-mhlw-a4__personal-request[^>]*top:526\.61\dmm/);
  });
});
