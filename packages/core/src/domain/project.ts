// Project は、業務・副業・個人開発・OSS・ボランティア等を含みうる
// プロジェクト型の経験を表す。現時点では WorkExperience とは独立して保持する。
// 「どの組織での仕事か」の context は organizationName で表現する
// (例: 「株式会社サンプル」「個人開発」「OSS - example-project」)。

import * as v from 'valibot';

import { isoYearMonthStringSchema, type IsoYearMonthString } from './value-objects/iso-date';

export type Project = {
  name?: string;
  organizationName?: string;
  role?: string;
  startDate?: IsoYearMonthString;
  endDate?: IsoYearMonthString;
  isCurrent?: boolean;
  summary?: string;
  responsibilities?: string[];
  achievements?: string[];
  technologies?: string[];
};

const NAME_MAX = 200;
const ORGANIZATION_NAME_MAX = 200;
const ROLE_MAX = 100;
const SUMMARY_MAX = 1000;
const TEXT_ITEM_MAX = 500;
const TECHNOLOGY_ITEM_MAX = 100;
const RESPONSIBILITIES_ARRAY_MAX = 50;
const ACHIEVEMENTS_ARRAY_MAX = 50;
const TECHNOLOGIES_ARRAY_MAX = 100;

const isNonBlank = (value: string): boolean => value.trim().length > 0;

const nonBlankText = (max: number, label: string) =>
  v.pipe(
    v.string(),
    v.minLength(1, `${label}を入力してください`),
    v.check(isNonBlank, `${label}に空白のみは指定できません`),
    v.maxLength(max, `${label}が長すぎます`),
  );

const responsibilitiesSchema = v.pipe(
  v.array(nonBlankText(TEXT_ITEM_MAX, '担当業務')),
  v.maxLength(RESPONSIBILITIES_ARRAY_MAX, '担当業務の項目数が多すぎます'),
);

const achievementsSchema = v.pipe(
  v.array(nonBlankText(TEXT_ITEM_MAX, '成果')),
  v.maxLength(ACHIEVEMENTS_ARRAY_MAX, '成果の項目数が多すぎます'),
);

const technologiesSchema = v.pipe(
  v.array(nonBlankText(TECHNOLOGY_ITEM_MAX, '使用技術')),
  v.maxLength(TECHNOLOGIES_ARRAY_MAX, '使用技術の項目数が多すぎます'),
);

/** @internal */
export const projectSchema = v.pipe(
  v.object({
    name: v.optional(nonBlankText(NAME_MAX, 'プロジェクト名')),
    organizationName: v.optional(nonBlankText(ORGANIZATION_NAME_MAX, '所属組織')),
    role: v.optional(nonBlankText(ROLE_MAX, '役割')),
    startDate: v.optional(isoYearMonthStringSchema),
    endDate: v.optional(isoYearMonthStringSchema),
    isCurrent: v.optional(v.boolean()),
    summary: v.optional(nonBlankText(SUMMARY_MAX, '概要')),
    responsibilities: v.optional(responsibilitiesSchema),
    achievements: v.optional(achievementsSchema),
    technologies: v.optional(technologiesSchema),
  }),
  v.check(
    (project) => !(project.isCurrent === true && project.endDate !== undefined),
    '進行中の場合は終了月を指定できません',
  ),
  v.check(
    (project) =>
      project.startDate === undefined ||
      project.endDate === undefined ||
      project.startDate <= project.endDate,
    '開始月は終了月以前である必要があります',
  ),
);
