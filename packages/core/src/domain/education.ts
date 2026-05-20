// Education は履歴書に表示される 1 行のイベントを表すモデルではなく、
// 1 つの教育機関における在籍エピソードを表す。
//
// - startDate: 入学・編入・転入など、その教育機関に在籍を始めた年月
// - endDate:   卒業・修了・中退・卒業見込み等の終了または予定年月
// - status:    在学中 / 卒業 / 修了 / 中退 / 卒業見込み等の現在状態または終了状態 (free string)
//
// renderer / template は将来、startDate から「入学」行を、endDate + status から
// 「卒業」「修了」「中退」「卒業見込み」等の行を生成する想定。
// 本ファイルでは renderer / template-specific validation や行生成ロジックは持たない。

import * as v from 'valibot';

import { isoYearMonthStringSchema, type IsoYearMonthString } from './value-objects/iso-date';

export type Education = {
  institutionName?: string;
  faculty?: string;
  department?: string;
  degree?: string;
  startDate?: IsoYearMonthString;
  endDate?: IsoYearMonthString;
  status?: string;
  description?: string;
};

const INSTITUTION_NAME_MAX = 200;
const FACULTY_MAX = 100;
const DEPARTMENT_MAX = 100;
const DEGREE_MAX = 100;
const STATUS_MAX = 50;
const DESCRIPTION_MAX = 1000;

const isNonBlank = (value: string): boolean => value.trim().length > 0;

const nonBlankText = (max: number, label: string) =>
  v.pipe(
    v.string(),
    v.minLength(1, `${label}を入力してください`),
    v.check(isNonBlank, `${label}に空白のみは指定できません`),
    v.maxLength(max, `${label}が長すぎます`),
  );

/** @internal */
export const educationSchema = v.pipe(
  v.object({
    institutionName: v.optional(nonBlankText(INSTITUTION_NAME_MAX, '学校名')),
    faculty: v.optional(nonBlankText(FACULTY_MAX, '学部')),
    department: v.optional(nonBlankText(DEPARTMENT_MAX, '学科・専攻')),
    degree: v.optional(nonBlankText(DEGREE_MAX, '学位')),
    startDate: v.optional(isoYearMonthStringSchema),
    endDate: v.optional(isoYearMonthStringSchema),
    status: v.optional(nonBlankText(STATUS_MAX, '在籍状況')),
    description: v.optional(nonBlankText(DESCRIPTION_MAX, '備考')),
  }),
  v.check(
    (education) =>
      education.startDate === undefined ||
      education.endDate === undefined ||
      education.startDate <= education.endDate,
    '入学月は終了月以前である必要があります',
  ),
);
