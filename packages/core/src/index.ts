export type {
  CareerProfile,
  EmailAddress,
  IsoDateString,
  IsoYearMonthString,
  ParseResult,
  PersonKana,
  PersonName,
  PhoneNumber,
  PostalAddress,
  SchemaVersion,
  ValidationIssue,
} from './domain';
export {
  parseCareerProfile,
  safeParseCareerProfile,
  SCHEMA_VERSION,
  ValidationError,
} from './domain';
