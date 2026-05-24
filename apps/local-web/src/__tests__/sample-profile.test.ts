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

  it('historyRows / certificationRows を持つ (WYSIWYG 直接編集のため)', () => {
    // PC 版 WYSIWYG エディタで全行が直接編集できるよう、サンプルは
    // historyRows / certificationRows を持つ必要がある。educationHistory /
    // workExperiences / certifications も併存 (SP 版 form 入力で使う)。
    expect(Array.isArray(sampleProfileInput.historyRows)).toBe(true);
    expect((sampleProfileInput.historyRows ?? []).length).toBeGreaterThan(0);
    expect(Array.isArray(sampleProfileInput.certificationRows)).toBe(true);
    expect((sampleProfileInput.certificationRows ?? []).length).toBeGreaterThan(0);
  });

  it('historyRows の内容は educationHistory / workExperiences のサンプルと一貫している', () => {
    // drift 検出: educationHistory / workExperiences のサンプル文言が
    // historyRows 内にも含まれる (= 同じ人物の同じ経歴を表現していることを担保)
    const rows = sampleProfileInput.historyRows ?? [];
    const contents = rows.map((r) => r.content ?? '').join('\n');
    expect(contents).toContain('サンプル大学');
    expect(contents).toContain('株式会社サンプル');
    expect(contents).toContain('学歴');
    expect(contents).toContain('職歴');
  });
});
