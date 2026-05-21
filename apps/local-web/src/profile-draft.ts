// Profile draft helpers: form 入力から raw input object を組み立てる pure functions。
//
// 設計判断:
//
// - 入力型 (BasicsFormValues) は form の各 input value (string) を property として
//   明示的に列挙。typecheck で全 field の存在を強制し、main.ts 側の漏れを防ぐ。
// - 出力型は Record<string, unknown> (raw input)、CareerProfile を **主張しない**。
//   parse 後の branded type / readonly tuple との二重の罠を避ける。
// - empty 判定は trim 後の長さで行うが、core 側に渡す value は trim **しない**
//   (user の意図的 trailing space を尊重、core の「空白のみ禁止 check」が判定)。
// - name / nameKana は両 field 空なら object 自体を omit、いずれかに値があれば
//   object として渡す (片方空でも raw 構築は試行、core schema が reject 判断)。
// - address は inner field 個別に omit、全 inner omit なら address 自体 omit。
// - buildDraft は `DraftSections` 型 (basics 必須、他 section は optional) を受け取り、
//   指定された section だけ baseFixture を override する。他 section は baseFixture
//   からそのまま引き継ぐことで draftBase 戦略 (load 後の編集で他 section が
//   sample fixture に戻らない) と整合。
//   future-proof: education / skills / certifications / projects 編集 PR で
//   `DraftSections` を拡張するだけで対応可能。
// - buildSaveProfileInput は exactOptionalPropertyTypes 制約下で
//   currentProfileId が undefined のとき id field を omit する conditional spread
//   を集約 (caller が `{ id: maybeUndefined, profile }` で型エラーになる罠を回避)。

import type { CareerProfile } from '@jcd-editor/core';
import type { SaveProfileInput, StoredProfileId } from '@jcd-editor/storage';

export type BasicsFormValues = {
  nameFamily: string;
  nameGiven: string;
  nameKanaFamily: string;
  nameKanaGiven: string;
  birthDate: string;
  email: string;
  phone: string;
  postalCode: string;
  prefecture: string;
  cityAndRest: string;
};

export const buildBasicsFromForm = (form: BasicsFormValues): Record<string, unknown> => {
  const basics: Record<string, unknown> = {};

  if (form.nameFamily.trim() !== '' || form.nameGiven.trim() !== '') {
    basics.name = { family: form.nameFamily, given: form.nameGiven };
  }

  if (form.nameKanaFamily.trim() !== '' || form.nameKanaGiven.trim() !== '') {
    basics.nameKana = { family: form.nameKanaFamily, given: form.nameKanaGiven };
  }

  if (form.birthDate.trim() !== '') basics.birthDate = form.birthDate;
  if (form.email.trim() !== '') basics.email = form.email;
  if (form.phone.trim() !== '') basics.phone = form.phone;

  const address: Record<string, string> = {};
  if (form.postalCode.trim() !== '') address.postalCode = form.postalCode;
  if (form.prefecture.trim() !== '') address.prefecture = form.prefecture;
  if (form.cityAndRest.trim() !== '') address.cityAndRest = form.cityAndRest;
  if (Object.keys(address).length > 0) basics.address = address;

  return basics;
};

export type DraftSections = {
  basics: Record<string, unknown>;
  workExperiences?: readonly Record<string, unknown>[];
  // section key は core 側の CareerProfile schema の正式キー名 (`educationHistory`)
  // に揃える。UI 上の概念名は「学歴」「education」だが、draft merge では schema
  // 側のキーを使い、中間マッピングを発明しない。
  educationHistory?: readonly Record<string, unknown>[];
  skills?: readonly Record<string, unknown>[];
  certifications?: readonly Record<string, unknown>[];
  projects?: readonly Record<string, unknown>[];
};

export const buildDraft = (
  sections: DraftSections,
  baseFixture: Record<string, unknown>,
): Record<string, unknown> => {
  const result: Record<string, unknown> = {
    ...baseFixture,
    basics: sections.basics,
  };
  if (sections.workExperiences !== undefined) {
    result.workExperiences = sections.workExperiences;
  }
  if (sections.educationHistory !== undefined) {
    result.educationHistory = sections.educationHistory;
  }
  if (sections.skills !== undefined) {
    result.skills = sections.skills;
  }
  if (sections.certifications !== undefined) {
    result.certifications = sections.certifications;
  }
  if (sections.projects !== undefined) {
    result.projects = sections.projects;
  }
  return result;
};

export const buildSaveProfileInput = (
  profile: CareerProfile,
  currentProfileId: StoredProfileId | undefined,
): SaveProfileInput => ({
  ...(currentProfileId !== undefined ? { id: currentProfileId } : {}),
  profile,
});
