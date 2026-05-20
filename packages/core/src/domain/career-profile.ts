import * as v from 'valibot';

import { SCHEMA_VERSION, type SchemaVersion } from './schema-version';
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

export type CareerProfile = {
  schemaVersion: SchemaVersion;
  basics: {
    name?: PersonName;
    nameKana?: PersonKana;
    birthDate?: IsoDateString;
    email?: EmailAddress;
    phone?: PhoneNumber;
    address?: PostalAddress;
  };
};

/** @internal */
export const careerProfileSchema = v.object({
  schemaVersion: v.literal(SCHEMA_VERSION),
  basics: v.object({
    name: v.optional(personNameSchema),
    nameKana: v.optional(personKanaSchema),
    birthDate: v.optional(isoDateStringSchema),
    email: v.optional(emailAddressSchema),
    phone: v.optional(phoneNumberSchema),
    address: v.optional(postalAddressSchema),
  }),
});
