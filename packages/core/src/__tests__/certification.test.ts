import { safeParse } from 'valibot';
import { describe, expect, it } from 'vitest';

import { certificationSchema } from '../domain/certification';
import { safeParseCareerProfile } from '../domain/operations';

const wrapCertification = (certification: unknown) =>
  safeParseCareerProfile({
    schemaVersion: 1,
    basics: {},
    certifications: [certification],
  });

describe('certificationSchema (internal)', () => {
  it('全フィールド省略を受理する (draft tolerance)', () => {
    expect(safeParse(certificationSchema, {}).success).toBe(true);
  });

  it('name のみを受理する', () => {
    expect(
      safeParse(certificationSchema, {
        name: 'AWS Certified Solutions Architect',
      }).success,
    ).toBe(true);
  });

  it('name + issuer を受理する', () => {
    expect(
      safeParse(certificationSchema, {
        name: 'AWS Certified Solutions Architect',
        issuer: 'Amazon Web Services',
      }).success,
    ).toBe(true);
  });

  it('acquiredDate のみを受理する', () => {
    expect(safeParse(certificationSchema, { acquiredDate: '2024-03' }).success).toBe(true);
  });

  it('expirationDate のみを受理する (draft)', () => {
    expect(safeParse(certificationSchema, { expirationDate: '2027-03' }).success).toBe(true);
  });

  it('acquiredDate < expirationDate を受理する', () => {
    expect(
      safeParse(certificationSchema, {
        acquiredDate: '2024-03',
        expirationDate: '2027-03',
      }).success,
    ).toBe(true);
  });

  it('acquiredDate === expirationDate を受理する', () => {
    expect(
      safeParse(certificationSchema, {
        acquiredDate: '2024-03',
        expirationDate: '2024-03',
      }).success,
    ).toBe(true);
  });

  it('acquiredDate > expirationDate を拒否する', () => {
    expect(
      safeParse(certificationSchema, {
        acquiredDate: '2027-03',
        expirationDate: '2024-03',
      }).success,
    ).toBe(false);
  });

  it('credentialId を受理する', () => {
    expect(safeParse(certificationSchema, { credentialId: 'AWS-CSA-12345' }).success).toBe(true);
  });

  it('credentialUrl を受理する', () => {
    expect(
      safeParse(certificationSchema, {
        credentialUrl: 'https://aws.amazon.com/verification',
      }).success,
    ).toBe(true);
  });

  it('credentialUrl に怪しい文字列でも plain string 扱いで受理する', () => {
    expect(safeParse(certificationSchema, { credentialUrl: 'not-really-a-url' }).success).toBe(
      true,
    );
  });

  it('description を受理する', () => {
    expect(safeParse(certificationSchema, { description: 'クラウド設計の認定' }).success).toBe(
      true,
    );
  });

  it('name が空文字なら拒否する', () => {
    expect(safeParse(certificationSchema, { name: '' }).success).toBe(false);
  });

  it('name が空白のみなら拒否する', () => {
    expect(safeParse(certificationSchema, { name: '   ' }).success).toBe(false);
  });

  it('name の最大長を超えた値を拒否する', () => {
    expect(safeParse(certificationSchema, { name: 'あ'.repeat(201) }).success).toBe(false);
  });

  it.each([
    ['issuer', { issuer: '   ' }],
    ['credentialId', { credentialId: '   ' }],
    ['credentialUrl', { credentialUrl: '   ' }],
    ['description', { description: '   ' }],
  ])('%s が空白のみなら拒否する', (_label, input) => {
    expect(safeParse(certificationSchema, input).success).toBe(false);
  });

  it('credentialUrl の最大長 (2001 文字) を超えた値を拒否する', () => {
    expect(safeParse(certificationSchema, { credentialUrl: 'x'.repeat(2001) }).success).toBe(false);
  });

  it.each([
    '2024-13',
    '2024-00',
    '1899-12',
    '2101-01',
    'not-a-date',
  ])('不正な YYYY-MM (%s) を acquiredDate に持つ場合 reject', (value) => {
    expect(safeParse(certificationSchema, { acquiredDate: value }).success).toBe(false);
  });
});

describe('Certification via safeParseCareerProfile (public API)', () => {
  it('有効な完全 Certification を含む CareerProfile を受理する', () => {
    const result = safeParseCareerProfile({
      schemaVersion: 1,
      basics: {},
      certifications: [
        {
          name: 'AWS Certified Solutions Architect',
          issuer: 'Amazon Web Services',
          acquiredDate: '2024-03',
          expirationDate: '2027-03',
          credentialId: 'AWS-CSA-12345',
          credentialUrl: 'https://aws.amazon.com/verification',
          description: 'クラウド設計の認定',
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('name が不正な場合に dot path certifications.0.name を含む', () => {
    const result = wrapCertification({ name: '' });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.issues.find((i) => i.path === 'certifications.0.name');
      expect(issue).toBeDefined();
    }
  });

  it('acquiredDate が不正な YYYY-MM の場合に dot path certifications.0.acquiredDate を含む', () => {
    const result = wrapCertification({
      name: '資格X',
      acquiredDate: '2024-13',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.issues.find((i) => i.path === 'certifications.0.acquiredDate');
      expect(issue).toBeDefined();
    }
  });

  it('expirationDate が不正な場合に dot path certifications.0.expirationDate を含む', () => {
    const result = wrapCertification({
      name: '資格X',
      expirationDate: '1899-12',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.issues.find((i) => i.path === 'certifications.0.expirationDate');
      expect(issue).toBeDefined();
    }
  });

  it('acquiredDate > expirationDate で certifications.0 レベルの issue を出す', () => {
    const result = wrapCertification({
      name: '資格X',
      acquiredDate: '2024-03',
      expirationDate: '2020-03',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.issues.find((i) => i.path === 'certifications.0');
      expect(issue).toBeDefined();
    }
  });

  it('複数要素のうち一部だけ不正の場合、該当インデックスのみ issue が出る', () => {
    const result = safeParseCareerProfile({
      schemaVersion: 1,
      basics: {},
      certifications: [{ name: '正常な資格1' }, { name: '' }, { name: '正常な資格2' }],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const badPaths = result.issues.map((i) => i.path);
      expect(badPaths).toContain('certifications.1.name');
      expect(badPaths.every((p) => !p.startsWith('certifications.0.'))).toBe(true);
      expect(badPaths.every((p) => !p.startsWith('certifications.2.'))).toBe(true);
    }
  });
});
