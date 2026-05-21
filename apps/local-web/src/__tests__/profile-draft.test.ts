import { describe, expect, it } from 'vitest';

import { safeParseCareerProfile } from '@jcd-editor/core';

import { buildBasicsFromForm, buildDraft, type BasicsFormValues } from '../profile-draft';
import { sampleProfileInput } from '../sample-profile';

const emptyForm: BasicsFormValues = {
  nameFamily: '',
  nameGiven: '',
  nameKanaFamily: '',
  nameKanaGiven: '',
  birthDate: '',
  email: '',
  phone: '',
  postalCode: '',
  prefecture: '',
  cityAndRest: '',
};

const fullyPopulatedForm: BasicsFormValues = {
  nameFamily: '山田',
  nameGiven: '太郎',
  nameKanaFamily: 'ヤマダ',
  nameKanaGiven: 'タロウ',
  birthDate: '1993-04-01',
  email: 'taro.yamada@example.com',
  phone: '090-0000-0000',
  postalCode: '100-0001',
  prefecture: '東京都',
  cityAndRest: 'サンプル区サンプル町 1-2-3',
};

describe('buildBasicsFromForm', () => {
  it('全 field 値あり: name / nameKana / birthDate / email / phone / address 全て含む', () => {
    const basics = buildBasicsFromForm(fullyPopulatedForm);
    expect(basics).toEqual({
      name: { family: '山田', given: '太郎' },
      nameKana: { family: 'ヤマダ', given: 'タロウ' },
      birthDate: '1993-04-01',
      email: 'taro.yamada@example.com',
      phone: '090-0000-0000',
      address: {
        postalCode: '100-0001',
        prefecture: '東京都',
        cityAndRest: 'サンプル区サンプル町 1-2-3',
      },
    });
  });

  it('全 field 空: 空 object を返す (name / nameKana / address すべて omit)', () => {
    const basics = buildBasicsFromForm(emptyForm);
    expect(basics).toEqual({});
  });

  it('name.family のみ空、name.given 値あり: name object を含む (片方空でも raw 構築する、core が reject 判定)', () => {
    const basics = buildBasicsFromForm({ ...emptyForm, nameGiven: '太郎' });
    expect(basics).toEqual({
      name: { family: '', given: '太郎' },
    });
  });

  it('nameKana 両方空: nameKana 自体を omit', () => {
    const basics = buildBasicsFromForm({
      ...fullyPopulatedForm,
      nameKanaFamily: '',
      nameKanaGiven: '',
    });
    expect(basics.nameKana).toBeUndefined();
    expect('nameKana' in basics).toBe(false);
  });

  it('email 空: email key を omit (他 field は normal)', () => {
    const basics = buildBasicsFromForm({ ...fullyPopulatedForm, email: '' });
    expect('email' in basics).toBe(false);
    expect(basics.name).toEqual({ family: '山田', given: '太郎' });
  });

  it('address 全 inner 空: address 自体を omit', () => {
    const basics = buildBasicsFromForm({
      ...fullyPopulatedForm,
      postalCode: '',
      prefecture: '',
      cityAndRest: '',
    });
    expect('address' in basics).toBe(false);
  });

  it('address postalCode のみ値あり: address に postalCode のみ含む (他 inner は omit)', () => {
    const basics = buildBasicsFromForm({
      ...fullyPopulatedForm,
      prefecture: '',
      cityAndRest: '',
    });
    expect(basics.address).toEqual({ postalCode: '100-0001' });
  });

  it('fully-populated form の出力は safeParseCareerProfile で success になる', () => {
    const basics = buildBasicsFromForm(fullyPopulatedForm);
    const draft = buildDraft(basics, sampleProfileInput);
    const result = safeParseCareerProfile(draft);
    expect(result.success).toBe(true);
  });
});

describe('buildDraft', () => {
  it('base fixture を shallow spread し、basics だけ差し替える', () => {
    const newBasics = { name: { family: '鈴木', given: '一郎' } };
    const draft = buildDraft(newBasics, sampleProfileInput);
    expect(draft.basics).toBe(newBasics);
    expect(draft.schemaVersion).toBe(sampleProfileInput.schemaVersion);
    expect(draft.workExperiences).toBe(sampleProfileInput.workExperiences);
    expect(draft.educationHistory).toBe(sampleProfileInput.educationHistory);
    expect(draft.skills).toBe(sampleProfileInput.skills);
    expect(draft.certifications).toBe(sampleProfileInput.certifications);
    expect(draft.projects).toBe(sampleProfileInput.projects);
  });

  it('空 basics でも draft は valid (他 section は sample fixture から維持)', () => {
    const draft = buildDraft({}, sampleProfileInput);
    const result = safeParseCareerProfile(draft);
    expect(result.success).toBe(true);
  });
});
