// Internal text validation helpers.
// Not part of the public API. Used only by domain modules within packages/core
// that need shared non-blank text validation.
// Do not re-export from packages/core/src/index.ts or
// packages/core/src/domain/index.ts.

import * as v from 'valibot';

/** @internal */
export const isNonBlankText = (value: string): boolean => value.trim().length > 0;

/** @internal */
export const createNonBlankTextSchema = (maxLength: number, label: string) =>
  v.pipe(
    v.string(),
    v.minLength(1, `${label}を入力してください`),
    v.check(isNonBlankText, `${label}に空白のみは指定できません`),
    v.maxLength(maxLength, `${label}が長すぎます`),
  );
