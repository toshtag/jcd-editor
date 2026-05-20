import * as v from 'valibot';

export type Skill = {
  name?: string;
  category?: string;
  level?: string;
  description?: string;
};

const NAME_MAX = 100;
const CATEGORY_MAX = 50;
const LEVEL_MAX = 50;
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
export const skillSchema = v.object({
  name: v.optional(nonBlankText(NAME_MAX, 'スキル名')),
  category: v.optional(nonBlankText(CATEGORY_MAX, 'カテゴリ')),
  level: v.optional(nonBlankText(LEVEL_MAX, 'レベル')),
  description: v.optional(nonBlankText(DESCRIPTION_MAX, '備考')),
});
