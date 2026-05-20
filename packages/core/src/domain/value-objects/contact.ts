import * as v from 'valibot';

declare const emailBrand: unique symbol;
declare const phoneBrand: unique symbol;

export type EmailAddress = string & { readonly [emailBrand]: 'EmailAddress' };
export type PhoneNumber = string & { readonly [phoneBrand]: 'PhoneNumber' };

export type PostalAddress = {
  readonly postalCode?: string;
  readonly prefecture?: string;
  readonly cityAndRest?: string;
};

/** @internal */
export const emailAddressSchema = v.pipe(
  v.string(),
  v.email('正しいメールアドレス形式で入力してください'),
  v.maxLength(254, 'メールアドレスが長すぎます'),
  v.transform((value): EmailAddress => value as EmailAddress),
);

/** @internal */
export const phoneNumberSchema = v.pipe(
  v.string(),
  v.minLength(1, '電話番号を入力してください'),
  v.maxLength(50, '電話番号が長すぎます'),
  v.transform((value): PhoneNumber => value as PhoneNumber),
);

/** @internal */
export const postalAddressSchema = v.object({
  postalCode: v.optional(v.pipe(v.string(), v.maxLength(20))),
  prefecture: v.optional(v.pipe(v.string(), v.maxLength(50))),
  cityAndRest: v.optional(v.pipe(v.string(), v.maxLength(200))),
});
