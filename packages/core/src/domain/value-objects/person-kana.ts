import * as v from 'valibot';

const KANA_REGEX = /^[゠-ヿ　]+$/;

export type PersonKana = {
  readonly family: string;
  readonly given: string;
};

const kanaFieldSchema = v.pipe(
  v.string(),
  v.minLength(1),
  v.maxLength(50),
  v.regex(KANA_REGEX, '全角カタカナ、長音符、中点、全角スペースのみ使用できます'),
  v.check((value) => value.replace(/[　・]/g, '').length > 0, '空白や中点のみの値は許可されません'),
);

/** @internal */
export const personKanaSchema = v.object({
  family: kanaFieldSchema,
  given: kanaFieldSchema,
});
