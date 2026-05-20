import * as v from 'valibot';

import { createNonBlankTextSchema } from './_internal/text-validation';
import { isoYearMonthStringSchema, type IsoYearMonthString } from './value-objects/iso-date';

// WorkPeriod is currently part of WorkExperience.
// Do not assume it is reusable for Education or Project until those models are designed.

export type WorkPeriod = {
  startDate?: IsoYearMonthString;
  endDate?: IsoYearMonthString;
  isCurrent?: boolean;
};

export type WorkExperience = {
  companyName?: string;
  position?: string;
  employmentType?: string;
  period?: WorkPeriod;
  summary?: string;
  responsibilities?: string[];
  achievements?: string[];
};

const COMPANY_NAME_MAX = 200;
const POSITION_MAX = 100;
const EMPLOYMENT_TYPE_MAX = 50;
const SUMMARY_MAX = 1000;
const TEXT_ITEM_MAX = 500;
const ITEM_ARRAY_MAX = 50;

const itemListSchema = v.pipe(
  v.array(createNonBlankTextSchema(TEXT_ITEM_MAX, '項目')),
  v.maxLength(ITEM_ARRAY_MAX, '項目数が多すぎます'),
);

/** @internal */
export const workPeriodSchema = v.pipe(
  v.object({
    startDate: v.optional(isoYearMonthStringSchema),
    endDate: v.optional(isoYearMonthStringSchema),
    isCurrent: v.optional(v.boolean()),
  }),
  v.check(
    (period) => !(period.isCurrent === true && period.endDate !== undefined),
    '在職中の場合は終了月を指定できません',
  ),
  v.check(
    (period) =>
      period.startDate === undefined ||
      period.endDate === undefined ||
      period.startDate <= period.endDate,
    '開始月は終了月以前である必要があります',
  ),
);

/** @internal */
export const workExperienceSchema = v.object({
  companyName: v.optional(createNonBlankTextSchema(COMPANY_NAME_MAX, '会社名')),
  position: v.optional(createNonBlankTextSchema(POSITION_MAX, '役職')),
  employmentType: v.optional(createNonBlankTextSchema(EMPLOYMENT_TYPE_MAX, '雇用形態')),
  period: v.optional(workPeriodSchema),
  summary: v.optional(createNonBlankTextSchema(SUMMARY_MAX, '概要')),
  responsibilities: v.optional(itemListSchema),
  achievements: v.optional(itemListSchema),
});
