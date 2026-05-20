import type { GenericSchema, InferOutput, SafeParseResult } from 'valibot';

export type ValidationIssue = {
  readonly path: string;
  readonly message: string;
};

export type ParseResult<T> =
  | { readonly success: true; readonly data: T }
  | { readonly success: false; readonly issues: ReadonlyArray<ValidationIssue> };

const buildPath = (issuePath: ReadonlyArray<{ readonly key?: unknown }> | undefined): string => {
  if (!issuePath || issuePath.length === 0) return '';
  return issuePath
    .map((segment) => segment.key)
    .filter((key): key is string | number => key !== undefined && key !== null)
    .map((key) => String(key))
    .join('.');
};

/** @internal */
export const toParseResult = <TSchema extends GenericSchema>(
  result: SafeParseResult<TSchema>,
): ParseResult<InferOutput<TSchema>> => {
  if (result.success) {
    return { success: true, data: result.output };
  }
  const issues: ValidationIssue[] = result.issues.map((issue) => ({
    path: buildPath(issue.path),
    message: issue.message,
  }));
  return { success: false, issues };
};
