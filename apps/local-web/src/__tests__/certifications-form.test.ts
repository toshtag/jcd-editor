import { describe, expect, it } from 'vitest';

import { parseCareerProfile, type Certification } from '@jcd-editor/core';

import {
  buildCertificationsFromForm,
  certificationToFormValues,
  emptyCertificationFormValues,
  type CertificationFormValues,
} from '../certifications-form';

// branded IsoYearMonthString を直接 literal 構築できないため、parseCareerProfile
// 経由で型安全な Certification を取得して test fixture とする。
const buildParsedCertification = (raw: Record<string, unknown>): Certification => {
  const parsed = parseCareerProfile({
    schemaVersion: 1,
    basics: {},
    certifications: [raw],
  });
  const item = parsed.certifications?.[0];
  if (item === undefined) {
    throw new Error('test fixture: parsed certification is undefined');
  }
  return item;
};

const fullyPopulated: CertificationFormValues = {
  name: '基本情報技術者試験',
  issuer: 'IPA',
  acquiredDate: '2018-06',
  expirationDate: '',
  credentialId: 'FE-2018-00000',
  credentialUrl: 'https://example.com/verify/00000',
  description: '春期試験合格',
};

describe('emptyCertificationFormValues', () => {
  it('全 string field は空文字列を返す', () => {
    expect(emptyCertificationFormValues()).toEqual({
      name: '',
      issuer: '',
      acquiredDate: '',
      expirationDate: '',
      credentialId: '',
      credentialUrl: '',
      description: '',
    });
  });
});

describe('certificationToFormValues', () => {
  it('全 field 値あり: 全 field を form 値に展開', () => {
    const item = buildParsedCertification({
      name: '基本情報技術者試験',
      issuer: 'IPA',
      acquiredDate: '2018-06',
      credentialId: 'FE-2018-00000',
      credentialUrl: 'https://example.com/verify/00000',
      description: '春期試験合格',
    });
    expect(certificationToFormValues(item)).toEqual(fullyPopulated);
  });

  it('全 field optional な空 Certification: 全 string 空', () => {
    const item = buildParsedCertification({});
    expect(certificationToFormValues(item)).toEqual(emptyCertificationFormValues());
  });
});

describe('buildCertificationsFromForm', () => {
  it('全 field 値あり: 該当 field を含む item を 1 つ返す', () => {
    expect(buildCertificationsFromForm([fullyPopulated])).toEqual([
      {
        name: '基本情報技術者試験',
        issuer: 'IPA',
        acquiredDate: '2018-06',
        credentialId: 'FE-2018-00000',
        credentialUrl: 'https://example.com/verify/00000',
        description: '春期試験合格',
      },
    ]);
  });

  it('values が空配列: 空配列を返す (全削除を表現、core は valid と判定)', () => {
    expect(buildCertificationsFromForm([])).toEqual([]);
  });

  it('partial 入力: 値ありの field のみ含む、他 field は omit', () => {
    const values: CertificationFormValues = {
      ...emptyCertificationFormValues(),
      name: 'AWS Certified Solutions Architect',
      issuer: 'AWS',
    };
    expect(buildCertificationsFromForm([values])).toEqual([
      { name: 'AWS Certified Solutions Architect', issuer: 'AWS' },
    ]);
  });

  it('expirationDate あり: 期限あり資格として 2 つの date を含む', () => {
    const values: CertificationFormValues = {
      ...emptyCertificationFormValues(),
      name: 'AWS Solutions Architect',
      acquiredDate: '2024-01',
      expirationDate: '2027-01',
    };
    expect(buildCertificationsFromForm([values])).toEqual([
      {
        name: 'AWS Solutions Architect',
        acquiredDate: '2024-01',
        expirationDate: '2027-01',
      },
    ]);
  });

  it('emptyCertificationFormValues 1 件: [] を返す (追加直後の空フォームは draft に流さない)', () => {
    expect(buildCertificationsFromForm([emptyCertificationFormValues()])).toEqual([]);
  });

  it('空白のみ field: 全 field 空白のみなら entry を除外', () => {
    const values: CertificationFormValues = {
      name: '   ',
      issuer: '',
      acquiredDate: '',
      expirationDate: '',
      credentialId: '',
      credentialUrl: '',
      description: '\n\n',
    };
    expect(buildCertificationsFromForm([values])).toEqual([]);
  });

  it('credentialUrl のみ値あり: URL らしさの検証はしない、原文を渡す', () => {
    const values: CertificationFormValues = {
      ...emptyCertificationFormValues(),
      name: 'AWS Solutions Architect',
      credentialUrl: 'not really a url',
    };
    expect(buildCertificationsFromForm([values])).toEqual([
      { name: 'AWS Solutions Architect', credentialUrl: 'not really a url' },
    ]);
  });

  it('empty entry と non-empty entry の混在: empty entry は除外、non-empty entry のみ残る', () => {
    const nonEmpty: CertificationFormValues = {
      ...emptyCertificationFormValues(),
      name: 'CISSP',
    };
    expect(
      buildCertificationsFromForm([
        emptyCertificationFormValues(),
        nonEmpty,
        emptyCertificationFormValues(),
      ]),
    ).toEqual([{ name: 'CISSP' }]);
  });
});
