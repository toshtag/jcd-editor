import * as v from 'valibot';

declare const isoDateBrand: unique symbol;
declare const isoYearMonthBrand: unique symbol;

export type IsoDateString = string & { readonly [isoDateBrand]: 'IsoDateString' };
export type IsoYearMonthString = string & { readonly [isoYearMonthBrand]: 'IsoYearMonthString' };

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const ISO_YEAR_MONTH_REGEX = /^\d{4}-\d{2}$/;

const isLeapYear = (year: number): boolean =>
  year % 400 === 0 || (year % 4 === 0 && year % 100 !== 0);

const getDaysInMonth = (year: number, month: number): number => {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  if (month === 4 || month === 6 || month === 9 || month === 11) return 30;
  return 31;
};

const isValidIsoDate = (value: string): boolean => {
  if (!ISO_DATE_REGEX.test(value)) return false;
  const year = Number(value.substring(0, 4));
  const month = Number(value.substring(5, 7));
  const day = Number(value.substring(8, 10));
  if (year < 1900 || year > 2100) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > getDaysInMonth(year, month)) return false;
  return true;
};

const isValidIsoYearMonth = (value: string): boolean => {
  if (!ISO_YEAR_MONTH_REGEX.test(value)) return false;
  const year = Number(value.substring(0, 4));
  const month = Number(value.substring(5, 7));
  if (year < 1900 || year > 2100) return false;
  if (month < 1 || month > 12) return false;
  return true;
};

/** @internal */
export const isoDateStringSchema = v.pipe(
  v.string(),
  v.regex(ISO_DATE_REGEX, 'YYYY-MM-DD 形式で入力してください'),
  v.check(isValidIsoDate, '実在しない日付、または許可範囲外 (1900-2100) の年です'),
  v.transform((value): IsoDateString => value as IsoDateString),
);

/** @internal */
export const isoYearMonthStringSchema = v.pipe(
  v.string(),
  v.regex(ISO_YEAR_MONTH_REGEX, 'YYYY-MM 形式で入力してください'),
  v.check(isValidIsoYearMonth, '実在しない月、または許可範囲外 (1900-2100) の年です'),
  v.transform((value): IsoYearMonthString => value as IsoYearMonthString),
);
