import * as v from 'valibot';

import { educationSchema, type Education } from './education';
import { SCHEMA_VERSION, type SchemaVersion } from './schema-version';
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
  workExperiences?: WorkExperience[];
  educationHistory?: Education[];
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
  workExperiences: v.optional(
    v.pipe(
      v.array(workExperienceSchema),
      v.maxLength(WORK_EXPERIENCES_MAX, '職歴の件数が多すぎます'),
    ),
  ),
  educationHistory: v.optional(
    v.pipe(v.array(educationSchema), v.maxLength(EDUCATION_HISTORY_MAX, '学歴の件数が多すぎます')),
  ),
});
