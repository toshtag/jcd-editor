import { describe, expect, it } from 'vitest';

import { ValidationError } from '../domain/errors';

describe('ValidationError', () => {
  it('name が "ValidationError"', () => {
    const error = new ValidationError([]);
    expect(error.name).toBe('ValidationError');
  });

  it('issues プロパティを保持する', () => {
    const issues = [{ path: 'basics.name', message: 'Required' }];
    const error = new ValidationError(issues);
    expect(error.issues).toEqual(issues);
  });

  it('instanceof Error が true', () => {
    const error = new ValidationError([]);
    expect(error).toBeInstanceOf(Error);
  });

  it('instanceof ValidationError が true', () => {
    const error = new ValidationError([]);
    expect(error).toBeInstanceOf(ValidationError);
  });

  it('throw / catch で instanceof が安定する', () => {
    try {
      throw new ValidationError([{ path: '', message: 'test' }]);
    } catch (e) {
      expect(e).toBeInstanceOf(ValidationError);
      expect(e).toBeInstanceOf(Error);
    }
  });
});
