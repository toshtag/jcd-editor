// rirekisho-mhlw-a4 の editable mode (Phase 2.1a) を検証する test。
//
// editable=true のとき:
//   - user data div に contenteditable="plaintext-only" + data-field 属性
//   - 値が undefined でも空 div を出力 (= 空の編集可能セル)
//   - 氏名は family + given を全角スペースで連結した 1 セル
//   - 学歴職歴 / 免許資格 表は editable 未対応 (Phase 2.1b 担当)
//
// editable=false / 未指定のとき: 従来通り (= 値なしなら div を出さない)

import { parseCareerProfile } from '@jcd-editor/core';
import { describe, expect, it } from 'vitest';

import { rirekishoMhlwA4Template } from '../templates/rirekisho-mhlw-a4';

const MIN_PROFILE = parseCareerProfile({ schemaVersion: 1, basics: {} });

describe('rirekishoMhlwA4Template - editable mode (Phase 2.1a)', () => {
  it('editable: false (default) のとき contenteditable 属性は出ない', () => {
    const profile = parseCareerProfile({
      schemaVersion: 1,
      basics: { name: { family: '山田', given: '太郎' } },
    });
    const r = rirekishoMhlwA4Template.render({ careerProfile: profile, kind: 'rirekisho' });
    expect(r.html).not.toContain('contenteditable');
  });

  it('editable: true のとき名前セルに contenteditable と data-field="name" が付く', () => {
    const profile = parseCareerProfile({
      schemaVersion: 1,
      basics: { name: { family: '山田', given: '太郎' } },
    });
    const r = rirekishoMhlwA4Template.render({
      careerProfile: profile,
      kind: 'rirekisho',
      editable: true,
    });
    expect(r.html).toMatch(/<div class="jcd-mhlw-a4__name"[^>]+contenteditable="plaintext-only"/);
    expect(r.html).toContain('data-field="name"');
  });

  it('editable: true で name が undefined でも空セルを出力する', () => {
    const r = rirekishoMhlwA4Template.render({
      careerProfile: MIN_PROFILE,
      kind: 'rirekisho',
      editable: true,
    });
    expect(r.html).toContain('data-field="name"');
  });

  it('editable: false で name が undefined のときは name セル自体を出さない', () => {
    const r = rirekishoMhlwA4Template.render({
      careerProfile: MIN_PROFILE,
      kind: 'rirekisho',
    });
    expect(r.html).not.toContain('jcd-mhlw-a4__name"');
  });

  it('氏名は family + 全角スペース + given の 1 セルとして連結される (editable / read-only 共通)', () => {
    const profile = parseCareerProfile({
      schemaVersion: 1,
      basics: { name: { family: '山田', given: '太郎' } },
    });
    const ro = rirekishoMhlwA4Template.render({ careerProfile: profile, kind: 'rirekisho' });
    const ed = rirekishoMhlwA4Template.render({
      careerProfile: profile,
      kind: 'rirekisho',
      editable: true,
    });
    expect(ro.html).toContain('山田　太郎');
    expect(ed.html).toContain('山田　太郎');
  });

  it('editable: true で nameKana セルにも data-field="nameKana" が付く', () => {
    const r = rirekishoMhlwA4Template.render({
      careerProfile: MIN_PROFILE,
      kind: 'rirekisho',
      editable: true,
    });
    expect(r.html).toContain('data-field="nameKana"');
  });

  it('editable: true で birthDate は年/月/日 3 セルに分割され、それぞれ data-field が付く', () => {
    const profile = parseCareerProfile({
      schemaVersion: 1,
      basics: { birthDate: '1993-04-01' },
    });
    const r = rirekishoMhlwA4Template.render({
      careerProfile: profile,
      kind: 'rirekisho',
      editable: true,
    });
    expect(r.html).toContain('data-field="birthDate.year"');
    expect(r.html).toContain('data-field="birthDate.month"');
    expect(r.html).toContain('data-field="birthDate.day"');
    expect(r.html).toContain('>1993<');
    expect(r.html).toContain('>4<');
    expect(r.html).toContain('>1<');
  });

  it('editable: false で birthDate は従来通り年/月/日 に分解される', () => {
    const profile = parseCareerProfile({
      schemaVersion: 1,
      basics: { birthDate: '1993-04-01' },
    });
    const r = rirekishoMhlwA4Template.render({ careerProfile: profile, kind: 'rirekisho' });
    expect(r.html).toContain('jcd-mhlw-a4__birth-year');
    expect(r.html).toContain('>1993<');
    expect(r.html).toContain('>4<');
    expect(r.html).toContain('>1<');
    expect(r.html).not.toContain('data-field="birthDate"');
  });

  it('editable: true で gender / preparedOn (.year/.month/.day) / summary / personalRequest にも data-field が付く', () => {
    const r = rirekishoMhlwA4Template.render({
      careerProfile: MIN_PROFILE,
      kind: 'rirekisho',
      editable: true,
    });
    expect(r.html).toContain('data-field="gender"');
    expect(r.html).toContain('data-field="preparedOn.year"');
    expect(r.html).toContain('data-field="preparedOn.month"');
    expect(r.html).toContain('data-field="preparedOn.day"');
    expect(r.html).toContain('data-field="summary"');
    expect(r.html).toContain('data-field="personalRequest"');
  });

  it('editable: true で住所 / 連絡先 セルに data-field が付く (郵便番号と住所本文を別セル)', () => {
    const r = rirekishoMhlwA4Template.render({
      careerProfile: MIN_PROFILE,
      kind: 'rirekisho',
      editable: true,
    });
    expect(r.html).toContain('data-field="address.postalCode"');
    expect(r.html).toContain('data-field="address.full"');
    expect(r.html).toContain('data-field="addressKana"');
    expect(r.html).toContain('data-field="phone"');
    expect(r.html).toContain('data-field="contactAddress.postalCode"');
    expect(r.html).toContain('data-field="contactAddress.full"');
    expect(r.html).toContain('data-field="contactAddressKana"');
    expect(r.html).toContain('data-field="contactPhone"');
  });

  it('editable: true で historyRows があれば row セルに data-field="historyRows.{idx}.{field}" が付く', () => {
    const profile = parseCareerProfile({
      schemaVersion: 1,
      basics: {},
      historyRows: [
        { year: '2016', month: '4', content: 'サンプル大学 入学' },
        { year: '2020', month: '3', content: 'サンプル大学 卒業' },
      ],
    });
    const r = rirekishoMhlwA4Template.render({
      careerProfile: profile,
      kind: 'rirekisho',
      editable: true,
    });
    expect(r.html).toContain('data-field="historyRows.0.year"');
    expect(r.html).toContain('data-field="historyRows.0.month"');
    expect(r.html).toContain('data-field="historyRows.0.content"');
    expect(r.html).toContain('data-field="historyRows.1.content"');
    expect(r.html).toContain('サンプル大学 入学');
    expect(r.html).toContain('サンプル大学 卒業');
  });

  it('editable: true で certificationRows があれば row セルに data-field="certificationRows.{idx}.{field}" が付く', () => {
    const profile = parseCareerProfile({
      schemaVersion: 1,
      basics: {},
      certificationRows: [{ year: '2020', month: '4', content: '基本情報技術者試験' }],
    });
    const r = rirekishoMhlwA4Template.render({
      careerProfile: profile,
      kind: 'rirekisho',
      editable: true,
    });
    expect(r.html).toContain('data-field="certificationRows.0.year"');
    expect(r.html).toContain('data-field="certificationRows.0.month"');
    expect(r.html).toContain('data-field="certificationRows.0.content"');
    expect(r.html).toContain('基本情報技術者試験');
  });

  it('historyRows が無くて educationHistory のみのとき: 旧来通り合成して描画 (editable 属性は出ない)', () => {
    const profile = parseCareerProfile({
      schemaVersion: 1,
      basics: {},
      educationHistory: [{ institutionName: 'サンプル大学', startDate: '2016-04' }],
    });
    const r = rirekishoMhlwA4Template.render({
      careerProfile: profile,
      kind: 'rirekisho',
      editable: true,
    });
    // historyRows が無いので合成された row の data-field は付かない
    expect(r.html).not.toContain('data-field="historyRows');
    // 表は通常通り描画される
    expect(r.html).toContain('サンプル大学');
  });

  it('editable: true で article に data-editable="true" が付く', () => {
    const r = rirekishoMhlwA4Template.render({
      careerProfile: MIN_PROFILE,
      kind: 'rirekisho',
      editable: true,
    });
    expect(r.html).toMatch(/<article class="jcd-mhlw-a4" data-editable="true"/);
  });

  it('editable: true で contenteditable[plaintext-only]::empty placeholder CSS が含まれる', () => {
    const r = rirekishoMhlwA4Template.render({
      careerProfile: MIN_PROFILE,
      kind: 'rirekisho',
      editable: true,
    });
    expect(r.css).toContain('[contenteditable="plaintext-only"]:empty::before');
  });

  it('editable: true で WYSIWYG ガイド装飾 CSS (非アクティブ時の薄い背景色) が含まれる', () => {
    const r = rirekishoMhlwA4Template.render({
      careerProfile: MIN_PROFILE,
      kind: 'rirekisho',
      editable: true,
    });
    // contenteditable に常時薄い背景 (PC 版での入力可能箇所可視化)
    expect(r.css).toMatch(
      /\[contenteditable="plaintext-only"\][^{]*\{[^}]*background:\s*rgba\(120,\s*170,\s*255/,
    );
  });

  it('editable: true で各セルに data-placeholder 属性 (入力ヒント) が付く', () => {
    const r = rirekishoMhlwA4Template.render({
      careerProfile: MIN_PROFILE,
      kind: 'rirekisho',
      editable: true,
    });
    // 主要セルの placeholder
    expect(r.html).toContain('data-placeholder="氏 名"');
    expect(r.html).toContain('data-placeholder="シメイ ふりがな"');
    expect(r.html).toContain('data-placeholder="YYYY"');
    expect(r.html).toContain('data-placeholder="M"');
    expect(r.html).toContain('data-placeholder="D"');
    expect(r.html).toContain('data-placeholder="000-0000"');
    expect(r.html).toContain('data-placeholder="都道府県 市区町村 番地"');
  });

  it('editable: false (PDF 出力等) では contenteditable 属性 / data-editable / data-placeholder すべて出ない', () => {
    const r = rirekishoMhlwA4Template.render({
      careerProfile: MIN_PROFILE,
      kind: 'rirekisho',
    });
    // article に data-editable="true" は付かない
    expect(r.html).not.toContain('data-editable="true"');
    // 各セル div に contenteditable 属性 / data-placeholder 属性は付かない
    // (CSS 内の selector としては存在するが、要素属性として書き出されない)
    expect(r.html).not.toMatch(/ contenteditable="/);
    expect(r.html).not.toMatch(/ data-placeholder="/);
  });
});
