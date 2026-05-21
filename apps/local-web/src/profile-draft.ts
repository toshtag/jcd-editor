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
// - buildDraft は `{ ...baseFixture, basics }` の shallow spread のみ。
//   section 名 (workExperiences / educationHistory / 等) を helper 側で再列挙
//   **しない** ことで、core schema / sample fixture の将来変更に対する drift
//   リスクを排除する。

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

export const buildDraft = (
  basics: Record<string, unknown>,
  baseFixture: Record<string, unknown>,
): Record<string, unknown> => ({
  ...baseFixture,
  basics,
});
