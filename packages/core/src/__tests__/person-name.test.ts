import { safeParse } from 'valibot';
import { describe, expect, it } from 'vitest';

import { personNameSchema } from '../domain/value-objects/person-name';

describe('personNameSchema', () => {
  it('正常な氏名を受理する', () => {
    const result = safeParse(personNameSchema, { family: '山田', given: '太郎' });
    expect(result.success).toBe(true);
  });

  it('空文字の family を拒否する', () => {
    const result = safeParse(personNameSchema, { family: '', given: '太郎' });
    expect(result.success).toBe(false);
  });

  it('空文字の given を拒否する', () => {
    const result = safeParse(personNameSchema, { family: '山田', given: '' });
    expect(result.success).toBe(false);
  });

  it('最大長 50 を超える名前を拒否する', () => {
    const longName = 'あ'.repeat(51);
    const result = safeParse(personNameSchema, { family: longName, given: '太郎' });
    expect(result.success).toBe(false);
  });

  it('英文字の氏名を受理する (PersonName は文字種を制約しない)', () => {
    const result = safeParse(personNameSchema, { family: 'Smith', given: 'John' });
    expect(result.success).toBe(true);
  });
});
