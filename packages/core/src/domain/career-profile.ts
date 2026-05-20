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

export type CareerProfile = {
  schemaVersion: SchemaVersion;
  basics: {
    name?: PersonName;
    nameKana?: PersonKana;
    birthDate?: IsoDateString;
    email?: EmailAddress;
    phone?: PhoneNumber;
    address?: PostalAddress;
    profilePhoto?: ProfilePhoto;
  };
  workExperiences?: WorkExperience[];
  educationHistory?: Education[];
  skills?: Skill[];
  certifications?: Certification[];
  projects?: Project[];
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
    profilePhoto: v.optional(profilePhotoSchema),
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
});
