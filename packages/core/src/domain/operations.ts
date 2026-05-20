import { safeParse } from 'valibot';

import { careerProfileSchema, type CareerProfile } from './career-profile';
import { ValidationError } from './errors';
import { toParseResult, type ParseResult } from './parse-result';

export const safeParseCareerProfile = (input: unknown): ParseResult<CareerProfile> => {
  return toParseResult(safeParse(careerProfileSchema, input)) as ParseResult<CareerProfile>;
};

export const parseCareerProfile = (input: unknown): CareerProfile => {
  const result = safeParseCareerProfile(input);
  if (result.success) {
    return result.data;
  }
  throw new ValidationError(result.issues);
};
