// sample-profile fixture drift 検出。compile-time の型互換性に頼らず
// safeParseCareerProfile で runtime validation する。

import { describe, expect, it } from 'vitest';

import { safeParseCareerProfile } from '@jcd-editor/core';

import { sampleProfileInput } from '../sample-profile';

describe('sampleProfileInput', () => {
  it('safeParseCareerProfile が success を返す (現行 schema と一致、drift なし)', () => {
    const result = safeParseCareerProfile(sampleProfileInput);
    expect(result.success).toBe(true);
  });

  it('schemaVersion === 1', () => {
    expect(sampleProfileInput.schemaVersion).toBe(1);
  });
});
