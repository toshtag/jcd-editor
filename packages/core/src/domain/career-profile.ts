import * as v from 'valibot';

import { certificationSchema, type Certification } from './certification';
import { educationSchema, type Education } from './education';
import { profilePhotoSchema, type ProfilePhoto } from './profile-photo';
import { projectSchema, type Project } from './project';
import { SCHEMA_VERSION, type SchemaVersion } from './schema-version';
import { skillSchema, type Skill } from './skill';
import { workExperienceSchema, type WorkExperience } from './work-experience';
import {
  emailAddressSchema,
  phoneNumberSchema,
  postalAddressSchema,
  type EmailAddress,
  type PhoneNumber,
  type PostalAddress,
} from './value-objects/contact';
import { isoDateStringSchema, type IsoDateString } from './value-objects/iso-date';
import { personKanaSchema, type PersonKana } from './value-objects/person-kana';
import { personNameSchema, type PersonName } from './value-objects/person-name';

const WORK_EXPERIENCES_MAX = 100;
const EDUCATION_HISTORY_MAX = 30;
const SKILLS_MAX = 200;
const CERTIFICATIONS_MAX = 100;
const PROJECTS_MAX = 200;

// 厚労省履歴書様式例 (Phase 1.2 で追加されたフィールド) の上限
//
// gender: 任意 phrase (「男性」「女性」「その他」「記載しない」 などのフリー入力許可、
//   公式注釈「※「性別」欄: 記載は任意です。未記載とすることも可能です。」を尊重)
// addressKana / contactAddressKana: 住所のふりがな (氏名のふりがなと違い、自由
//   フォームの 1 行テキスト)
// summary: 志望の動機 / 自己 PR の自由記述。公式様式の対応欄の物理サイズから
//   実用上 2000 字程度
// personalRequest: 本人希望記入欄。同じく自由記述、公式欄サイズから 1000 字程度
const GENDER_MAX_LENGTH = 50;
const ADDRESS_KANA_MAX_LENGTH = 200;
const SUMMARY_MAX_LENGTH = 2000;
const PERSONAL_REQUEST_MAX_LENGTH = 1000;

export type CareerProfile = {
  schemaVersion: SchemaVersion;
  basics: {
    name?: PersonName;
    nameKana?: PersonKana;
    birthDate?: IsoDateString;
    /** 性別 (任意記載、未記載可。フリー入力 phrase) */
    gender?: string;
    email?: EmailAddress;
    phone?: PhoneNumber;
    /** 現住所 */
    address?: PostalAddress;
    /** 現住所のふりがな (1 行フリーテキスト) */
    addressKana?: string;
    /** 連絡先住所 (現住所以外を希望する場合のみ) */
    contactAddress?: PostalAddress;
    /** 連絡先住所のふりがな */
    contactAddressKana?: string;
    /** 連絡先電話番号 (現住所以外を希望する場合のみ) */
    contactPhone?: PhoneNumber;
    profilePhoto?: ProfilePhoto;
    /** 志望の動機・特技・好きな学科・アピールポイントなど (フリー記述) */
    summary?: string;
    /** 本人希望記入欄 (給料・職種・勤務時間・勤務地・その他、フリー記述) */
    personalRequest?: string;
  };
  workExperiences?: WorkExperience[];
  educationHistory?: Education[];
  skills?: Skill[];
  certifications?: Certification[];
  projects?: Project[];
  /** 文書属性。本人プロフィールではない、文書そのもののメタ情報。 */
  meta?: {
    /** 「年 月 日現在」欄の日付。未指定なら template 側で default 描画する。 */
    preparedOn?: IsoDateString;
  };
};

/** @internal */
export const careerProfileSchema = v.object({
  schemaVersion: v.literal(SCHEMA_VERSION),
  basics: v.object({
    name: v.optional(personNameSchema),
    nameKana: v.optional(personKanaSchema),
    birthDate: v.optional(isoDateStringSchema),
    gender: v.optional(v.pipe(v.string(), v.maxLength(GENDER_MAX_LENGTH, '性別欄が長すぎます'))),
    email: v.optional(emailAddressSchema),
    phone: v.optional(phoneNumberSchema),
    address: v.optional(postalAddressSchema),
    addressKana: v.optional(
      v.pipe(v.string(), v.maxLength(ADDRESS_KANA_MAX_LENGTH, '住所のふりがなが長すぎます')),
    ),
    contactAddress: v.optional(postalAddressSchema),
    contactAddressKana: v.optional(
      v.pipe(v.string(), v.maxLength(ADDRESS_KANA_MAX_LENGTH, '連絡先のふりがなが長すぎます')),
    ),
    contactPhone: v.optional(phoneNumberSchema),
    profilePhoto: v.optional(profilePhotoSchema),
    summary: v.optional(
      v.pipe(v.string(), v.maxLength(SUMMARY_MAX_LENGTH, '志望動機が長すぎます')),
    ),
    personalRequest: v.optional(
      v.pipe(v.string(), v.maxLength(PERSONAL_REQUEST_MAX_LENGTH, '本人希望記入欄が長すぎます')),
    ),
  }),
  workExperiences: v.optional(
    v.pipe(
      v.array(workExperienceSchema),
      v.maxLength(WORK_EXPERIENCES_MAX, '職歴の件数が多すぎます'),
    ),
  ),
  educationHistory: v.optional(
    v.pipe(v.array(educationSchema), v.maxLength(EDUCATION_HISTORY_MAX, '学歴の件数が多すぎます')),
  ),
  skills: v.optional(
    v.pipe(v.array(skillSchema), v.maxLength(SKILLS_MAX, 'スキルの件数が多すぎます')),
  ),
  certifications: v.optional(
    v.pipe(v.array(certificationSchema), v.maxLength(CERTIFICATIONS_MAX, '資格の件数が多すぎます')),
  ),
  projects: v.optional(
    v.pipe(v.array(projectSchema), v.maxLength(PROJECTS_MAX, 'プロジェクトの件数が多すぎます')),
  ),
  meta: v.optional(
    v.object({
      preparedOn: v.optional(isoDateStringSchema),
    }),
  ),
});
