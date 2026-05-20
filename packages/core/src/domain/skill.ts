import * as v from 'valibot';

import { createNonBlankTextSchema } from './_internal/text-validation';

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

/** @internal */
export const skillSchema = v.object({
  name: v.optional(createNonBlankTextSchema(NAME_MAX, 'スキル名')),
  category: v.optional(createNonBlankTextSchema(CATEGORY_MAX, 'カテゴリ')),
  level: v.optional(createNonBlankTextSchema(LEVEL_MAX, 'レベル')),
  description: v.optional(createNonBlankTextSchema(DESCRIPTION_MAX, '備考')),
});
