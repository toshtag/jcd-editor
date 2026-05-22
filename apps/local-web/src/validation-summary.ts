// Validation issue → summary 変換 (pure)。
//
// 役割:
//   - ValidationIssue を「日本語 label + メッセージ + jump 先 CSS selector」
//     を含む `IssueSummary` に変換する
//   - validation-labels.ts の `translateIssuePath` を使い、anchor 計算は
//     本 module に閉じ込める
//
// 責務分離:
//   - DOM API は触らない (pure)。selector を文字列で返すまでが本 module
//     の責務。実際の `scrollIntoView` 呼び出しは main.ts 側
//
// 設計判断:
//
// - selector は **HTML 側で `data-section="<name>"` 属性を打って** 拾う
//   (id では section が複数存在しうる将来拡張に弱い)
// - 配列 entry レベルは `#<list-id> [data-index="N"]` を使い、既存の
//   add/remove で動的に追加される entry にも追随できる selector とする
// - top-level (path === '' / 'schemaVersion') と、未知 section は
//   `anchor: null` とし、UI 側は jump button を出さない
// - 戻り値は readonly、IssueSummary 配列は元の順序を保つ (user が dot path
//   順で issues を読むのと一貫)

import type { ValidationIssue } from '@jcd-editor/core';

import { translateIssuePath } from './validation-labels';

export type IssueAnchor = {
  /** scrollIntoView 対象の CSS selector */
  readonly selector: string;
  /** test / debug 用の人間可読 description */
  readonly description: string;
};

export type IssueSummary = {
  /** 翻訳済み path label (e.g., `学歴 1 件目 > 卒業・終了月`) */
  readonly pathLabel: string;
  /** core が返した日本語 message */
  readonly message: string;
  /** jump 先 (top-level / unknown は null) */
  readonly anchor: IssueAnchor | null;
};

// section key → entries を持つ list div の id
const SECTION_LIST_ID: Record<string, string> = {
  workExperiences: 'work-experiences-list',
  educationHistory: 'education-list',
  skills: 'skills-list',
  certifications: 'certifications-list',
  projects: 'projects-list',
};

const isNumericSegment = (segment: string): boolean => /^\d+$/.test(segment);

/**
 * Issue path から jump 先 CSS selector を計算する pure 関数。
 *
 * 例:
 *   ''                                  → null
 *   'schemaVersion'                     → null
 *   'basics.birthDate'                  → [data-section="basics"]
 *   'basics.profilePhoto.source.dataUri'→ [data-section="profilePhoto"]
 *   'workExperiences.0.companyName'     → #work-experiences-list [data-index="0"]
 *   'educationHistory.2.endDate'        → #education-list [data-index="2"]
 *   'workExperiences' (section level)   → [data-section="workExperiences"]
 *   'unknownSection.0.x'                → null
 */
export const buildIssueAnchor = (path: string): IssueAnchor | null => {
  if (path === '' || path === 'schemaVersion') return null;

  const segments = path.split('.');
  const head = segments[0];
  if (head === undefined) return null;

  if (head === 'basics') {
    // profilePhoto は basics-form 内の独立 UI block。優先的に拾う。
    if (segments[1] === 'profilePhoto') {
      return { selector: '[data-section="profilePhoto"]', description: '証明写真 block' };
    }
    return { selector: '[data-section="basics"]', description: '基本情報 form' };
  }

  const listId = SECTION_LIST_ID[head];
  if (listId === undefined) return null;

  // section 配列 entry の index がある: 該当 entry に jump
  const indexStr = segments[1];
  if (indexStr !== undefined && isNumericSegment(indexStr)) {
    return {
      selector: `#${listId} [data-index="${indexStr}"]`,
      description: `${head} entry ${indexStr}`,
    };
  }

  // section level: section の wrapping element に jump
  return {
    selector: `[data-section="${head}"]`,
    description: `${head} section`,
  };
};

/**
 * ValidationIssue 配列を IssueSummary 配列に変換する pure 関数。
 *
 * - 元の order を保つ (core が返す issue 順 = user が dot path 順に読むのと一貫)
 * - path 翻訳は `translateIssuePath` を委譲
 * - jump 不能な issue は `anchor: null` (UI 側で表現を分ける)
 */
export const summarizeIssues = (issues: readonly ValidationIssue[]): readonly IssueSummary[] =>
  issues.map((issue) => ({
    pathLabel: translateIssuePath(issue.path),
    message: issue.message,
    anchor: buildIssueAnchor(issue.path),
  }));

/**
 * Validation summary 内の各 item に振る element id。
 *
 * - index は issues 配列上の位置 (0-based)
 * - main.ts はこの id を `<li>` 内の button / span に付け、対応する input
 *   element の `aria-describedby` から参照する
 * - 値は render cycle ごとに再生成されて使われるため stable な必要はない
 *   が、UI / test の両方で同一関数を経由することで形式を一元化する
 */
export const issueElementId = (index: number): string => `validation-issue-${index}`;
