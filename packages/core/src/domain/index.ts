export type { SchemaVersion } from './schema-version';
export { SCHEMA_VERSION } from './schema-version';

export type { ParseResult, ValidationIssue } from './parse-result';

export { ValidationError } from './errors';

export type { PersonName } from './value-objects/person-name';
export type { PersonKana } from './value-objects/person-kana';
export type { IsoDateString, IsoYearMonthString } from './value-objects/iso-date';
export type { EmailAddress, PhoneNumber, PostalAddress } from './value-objects/contact';

export type { WorkExperience, WorkPeriod } from './work-experience';
export type { Education } from './education';
export type { Skill } from './skill';
export type { Certification } from './certification';
export type { Project } from './project';
export type { ProfilePhoto, ProfilePhotoMediaType, ProfilePhotoSource } from './profile-photo';

export type {
  CareerProfile,
  CertificationRowEntry,
  HistoryRowEntry,
} from './career-profile';
export { parseCareerProfile, safeParseCareerProfile } from './operations';
