// Profile I/O helpers: CareerProfile を JSON で export / import するための pure
// 関数群。
//
// 責務分離 (重要):
//   - 本 module は pure function に限定。DOM API (Blob / URL.createObjectURL /
//     a.download / FileReader / confirm) は **触らない**
//   - main.ts 側で Blob 化と FileReader を扱い、本 module の関数を呼び出す
//   - これにより test が容易になり、責務が分かれる
//
// import 側の信頼境界:
//   - 外部から渡された JSON 文字列は必ず safeParseCareerProfile を通してから
//     CareerProfile として扱う
//   - JSON.parse 失敗時と schema 不一致時を discriminated union で区別、UI 側で
//     エラー文言を出し分けられるようにする
//
// schema:
//   - export 時の JSON 構造は CareerProfile の生 object (parse 後の branded type
//     が含まれる場合も plain JSON 化される、JSON.stringify が string 化する)
//   - import 時は plain object → safeParseCareerProfile で type-safe CareerProfile
//     に戻す。round-trip 不変条件は test で確認

import { safeParseCareerProfile, type CareerProfile, type ValidationIssue } from '@jcd-editor/core';

export type ImportResult =
  | { readonly ok: true; readonly profile: CareerProfile }
  | { readonly ok: false; readonly kind: 'invalid-json'; readonly message: string }
  | {
      readonly ok: false;
      readonly kind: 'schema-mismatch';
      readonly issues: readonly ValidationIssue[];
    };

/**
 * CareerProfile を indent 2 の JSON 文字列に直列化する pure 関数。
 * DOM API は触らない。caller (main.ts) が Blob 化と download を担当する。
 */
export const serializeProfileToJson = (profile: CareerProfile): string =>
  JSON.stringify(profile, null, 2);

/**
 * 外部から渡された JSON 文字列を CareerProfile に復元する pure 関数。
 * 失敗は invalid-json (JSON.parse 失敗) と schema-mismatch (Valibot 失敗) で区別。
 *
 * 設計判断: 外部入力なので **必ず** safeParseCareerProfile を通す。生 JSON を
 * UI / draft に直接流さない。
 */
export const parseJsonImport = (text: string): ImportResult => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, kind: 'invalid-json', message };
  }

  const result = safeParseCareerProfile(parsed);
  if (!result.success) {
    return { ok: false, kind: 'schema-mismatch', issues: result.issues };
  }
  return { ok: true, profile: result.data };
};

/**
 * export ファイル名を組み立てる pure 関数。
 *
 * - profileId 先頭 8 文字 + 日付 (YYYY-MM-DD)
 * - profileId 未保存 (undefined) の場合は 'draft' prefix
 * - date は caller が new Date() を渡す (test 時に固定日付を渡せる)
 */
export const buildExportFileName = (profileId: string | undefined, date: Date): string => {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const dateStr = `${yyyy}-${mm}-${dd}`;
  const idPart = profileId === undefined ? 'draft' : profileId.slice(0, 8);
  return `profile-${idPart}-${dateStr}.json`;
};
