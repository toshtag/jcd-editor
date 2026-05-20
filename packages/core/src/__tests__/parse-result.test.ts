import { object, safeParse, string } from 'valibot';
import { describe, expect, it } from 'vitest';

import { toParseResult } from '../domain/parse-result';

describe('toParseResult', () => {
  it('成功結果を ParseResult.success: true として返す', () => {
    const schema = string();
    const result = toParseResult(safeParse(schema, 'hello'));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe('hello');
    }
  });

  it('失敗結果を ParseResult.success: false として返す', () => {
    const schema = string();
    const result = toParseResult(safeParse(schema, 123));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.issues[0]).toHaveProperty('message');
      expect(result.issues[0]).toHaveProperty('path');
    }
  });

  it('ルートレベルの error には空文字の path を付与する', () => {
    const result = toParseResult(safeParse(string(), 123));
    if (!result.success) {
      expect(result.issues[0]?.path).toBe('');
    }
  });

  it('ネストした issue の path を dot path 形式で構築する', () => {
    const schema = object({
      basics: object({
        name: object({
          family: string(),
        }),
      }),
    });
    const result = toParseResult(safeParse(schema, { basics: { name: { family: 123 } } }));
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.issues.find((i) => i.path.includes('family'));
      expect(issue?.path).toBe('basics.name.family');
    }
  });
});
