import { safeParse } from 'valibot';
import { describe, expect, it } from 'vitest';

import { isoDateStringSchema, isoYearMonthStringSchema } from '../domain/value-objects/iso-date';

describe('isoDateStringSchema', () => {
  describe('正常系', () => {
    it.each(['1993-04-01', '2024-02-29', '2000-02-29', '2024-12-31'])('%s を受理する', (value) => {
      const result = safeParse(isoDateStringSchema, value);
      expect(result.success).toBe(true);
    });
  });

  describe('範囲外の年', () => {
    it.each(['1899-12-31', '2101-01-01', '0001-01-01', '9999-12-31'])('%s を拒否する', (value) => {
      const result = safeParse(isoDateStringSchema, value);
      expect(result.success).toBe(false);
    });
  });

  describe('うるう年判定', () => {
    it('2000-02-29 (400 で割り切れる) を受理する', () => {
      expect(safeParse(isoDateStringSchema, '2000-02-29').success).toBe(true);
    });

    it('1900-02-29 (100 で割り切れるが 400 で割り切れない) を拒否する', () => {
      expect(safeParse(isoDateStringSchema, '1900-02-29').success).toBe(false);
    });

    it('2024-02-29 (4 で割り切れる) を受理する', () => {
      expect(safeParse(isoDateStringSchema, '2024-02-29').success).toBe(true);
    });

    it('2023-02-29 (平年) を拒否する', () => {
      expect(safeParse(isoDateStringSchema, '2023-02-29').success).toBe(false);
    });
  });

  describe('不正な日付', () => {
    it.each([
      '1993-02-30',
      '2024-13-01',
      '2024-04-31',
      '2024-00-01',
      '2024-01-00',
    ])('%s を拒否する', (value) => {
      const result = safeParse(isoDateStringSchema, value);
      expect(result.success).toBe(false);
    });
  });

  describe('フォーマット異常', () => {
    it.each([
      '1993-4-1',
      '1993/04/01',
      '1993-04',
      '93-04-01',
      'not-a-date',
      '',
    ])('%s を拒否する', (value) => {
      const result = safeParse(isoDateStringSchema, value);
      expect(result.success).toBe(false);
    });
  });
});

describe('isoYearMonthStringSchema', () => {
  describe('正常系', () => {
    it.each(['2024-01', '2024-12', '1900-01', '2100-12'])('%s を受理する', (value) => {
      const result = safeParse(isoYearMonthStringSchema, value);
      expect(result.success).toBe(true);
    });
  });

  describe('範囲外・不正系', () => {
    it.each([
      '2024-00',
      '2024-13',
      '1899-12',
      '2101-01',
      '2024-1',
      '2024-001',
      '2024',
    ])('%s を拒否する', (value) => {
      const result = safeParse(isoYearMonthStringSchema, value);
      expect(result.success).toBe(false);
    });
  });
});
