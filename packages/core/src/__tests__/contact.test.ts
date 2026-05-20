import { safeParse } from 'valibot';
import { describe, expect, it } from 'vitest';

import {
  emailAddressSchema,
  phoneNumberSchema,
  postalAddressSchema,
} from '../domain/value-objects/contact';

describe('emailAddressSchema', () => {
  it('正しい形式のメールアドレスを受理する', () => {
    expect(safeParse(emailAddressSchema, 'user@example.com').success).toBe(true);
  });

  it('正しい形式のメールアドレス (サブドメインあり) を受理する', () => {
    expect(safeParse(emailAddressSchema, 'user@mail.example.co.jp').success).toBe(true);
  });

  it.each([
    'not-an-email',
    '@example.com',
    'user@',
    'user @example.com',
    '',
  ])('%s を拒否する', (value) => {
    expect(safeParse(emailAddressSchema, value).success).toBe(false);
  });

  it('254 文字を超えるメールアドレスを拒否する', () => {
    const longLocal = 'a'.repeat(250);
    const result = safeParse(emailAddressSchema, `${longLocal}@example.com`);
    expect(result.success).toBe(false);
  });
});

describe('phoneNumberSchema (緩い文字列として扱う)', () => {
  it.each([
    '090-1234-5678',
    '09012345678',
    '+81-90-1234-5678',
    '03-1234-5678',
    '(03) 1234-5678',
    '+1 (415) 555-0100',
  ])('%s を受理する', (value) => {
    expect(safeParse(phoneNumberSchema, value).success).toBe(true);
  });

  it('空文字を拒否する', () => {
    expect(safeParse(phoneNumberSchema, '').success).toBe(false);
  });

  it('50 文字を超える値を拒否する', () => {
    expect(safeParse(phoneNumberSchema, '1'.repeat(51)).success).toBe(false);
  });
});

describe('postalAddressSchema', () => {
  it('全フィールド省略を受理する (全 optional)', () => {
    expect(safeParse(postalAddressSchema, {}).success).toBe(true);
  });

  it('一部フィールドのみでも受理する', () => {
    const result = safeParse(postalAddressSchema, {
      postalCode: '100-0001',
      prefecture: '東京都',
    });
    expect(result.success).toBe(true);
  });

  it('全フィールド指定でも受理する', () => {
    const result = safeParse(postalAddressSchema, {
      postalCode: '100-0001',
      prefecture: '東京都',
      cityAndRest: '千代田区千代田1-1',
    });
    expect(result.success).toBe(true);
  });
});
