import { safeParse } from 'valibot';
import { describe, expect, it } from 'vitest';

import { personKanaSchema } from '../domain/value-objects/person-kana';

describe('personKanaSchema', () => {
  it('全角カタカナの氏名を受理する', () => {
    const result = safeParse(personKanaSchema, { family: 'ヤマダ', given: 'タロウ' });
    expect(result.success).toBe(true);
  });

  it('小書きカナを含む氏名を受理する', () => {
    const result = safeParse(personKanaSchema, { family: 'ジョン', given: 'スミス' });
    expect(result.success).toBe(true);
  });

  it('長音符 (ー) を含む氏名を受理する', () => {
    const result = safeParse(personKanaSchema, { family: 'マーシャル', given: 'ジョージ' });
    expect(result.success).toBe(true);
  });

  it('中点 (・) を含む氏名を受理する', () => {
    const result = safeParse(personKanaSchema, { family: 'ジョン・ロバート', given: 'スミス' });
    expect(result.success).toBe(true);
  });

  it('全角スペースを含む氏名を受理する', () => {
    const result = safeParse(personKanaSchema, { family: 'ヤマダ　タロウ', given: 'タロウ' });
    expect(result.success).toBe(true);
  });

  it('ヴ (濁点付き) を含む氏名を受理する', () => {
    const result = safeParse(personKanaSchema, { family: 'ヴァージン', given: 'タロウ' });
    expect(result.success).toBe(true);
  });

  it('ひらがなを拒否する', () => {
    const result = safeParse(personKanaSchema, { family: 'やまだ', given: 'タロウ' });
    expect(result.success).toBe(false);
  });

  it('半角カタカナを拒否する', () => {
    const result = safeParse(personKanaSchema, { family: 'ﾔﾏﾀﾞ', given: 'タロウ' });
    expect(result.success).toBe(false);
  });

  it('英数字を拒否する', () => {
    const result = safeParse(personKanaSchema, { family: 'Yamada', given: 'タロウ' });
    expect(result.success).toBe(false);
  });

  it('全角スペースのみは拒否する', () => {
    const result = safeParse(personKanaSchema, { family: '　　', given: 'タロウ' });
    expect(result.success).toBe(false);
  });

  it('中点のみは拒否する', () => {
    const result = safeParse(personKanaSchema, { family: '・・', given: 'タロウ' });
    expect(result.success).toBe(false);
  });
});
