import * as v from 'valibot';

export type PersonName = {
  readonly family: string;
  readonly given: string;
};

const nameFieldSchema = v.pipe(v.string(), v.minLength(1), v.maxLength(50));

/** @internal */
export const personNameSchema = v.object({
  family: nameFieldSchema,
  given: nameFieldSchema,
});
