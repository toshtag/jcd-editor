// Validation issue path → 該当 input element の CSS selector への変換 (pure)。
//
// 役割:
//   - aria-invalid="true" を付けるべき input element の selector を返す
//   - validation-summary.ts の `buildIssueAnchor` (section / entry レベル)
//     より細かい粒度 = 「個別 input」までを target にする
//
// 責務分離:
//   - DOM API は触らない (pure)。selector を文字列で返すまでが本 module
//     の責務。`aria-invalid` 属性の付与は main.ts 側
//
// 設計判断:
//
// - basics の input は id がそれぞれ固有のため、path → id の static map を持つ
// - 配列 entry は `#<list-id> [data-index="N"] [data-field="<dataField>"]` で
//   動的 DOM を querySelector で拾う
// - core schema の field 名と form input の data-field 名が一致しない箇所
//   (period.startDate → 'startDate' / responsibilities → 'responsibilitiesText'
//   等) があるため、section ごとに mapping table を持つ
// - 解決できない (entry level / 未知 / schemaVersion 等) は null を返し、
//   UI 側は何もしない
// - 配列 string[] item (responsibilities.2 等) は個別 input 単位がないため、
//   wrap している textarea を target にする (改行区切り raw text 全体)

import type { ValidationIssue } from '@jcd-editor/core';

// === basics: path → input id ===
//
// 例: 'birthDate' → '#birth-date'、'name.family' → '#name-family'
// profilePhoto は dataUri が validation 対象 (5 MB 上限等)。input file element
// を target にする。altText は input UI を持たないため null。
const BASICS_INPUT_ID: Record<string, string> = {
  'name.family': 'name-family',
  'name.given': 'name-given',
  'nameKana.family': 'name-kana-family',
  'nameKana.given': 'name-kana-given',
  birthDate: 'birth-date',
  email: 'email',
  phone: 'phone',
  'address.postalCode': 'postal-code',
  'address.prefecture': 'prefecture',
  'address.cityAndRest': 'city-and-rest',
  'profilePhoto.source.dataUri': 'profile-photo-input',
};

// === section: section key → entries を持つ list div の id ===
const SECTION_LIST_ID: Record<string, string> = {
  workExperiences: 'work-experiences-list',
  educationHistory: 'education-list',
  skills: 'skills-list',
  certifications: 'certifications-list',
  projects: 'projects-list',
};

// === section ごとに: core schema 上の field path → form input の data-field 値 ===
//
// 大半は同名だが、以下が「形が異なる」箇所:
// - workExperiences.period.startDate → 'startDate' (form 上は flat)
// - workExperiences.responsibilities[] → 'responsibilitiesText' (textarea で改行区切り raw text)
// - 同様に achievements / technologies → '...Text'

const WORK_FIELD_TO_DATA_FIELD: Record<string, string> = {
  companyName: 'companyName',
  position: 'position',
  employmentType: 'employmentType',
  'period.startDate': 'startDate',
  'period.endDate': 'endDate',
  'period.isCurrent': 'isCurrent',
  summary: 'summary',
  responsibilities: 'responsibilitiesText',
  achievements: 'achievementsText',
};

const EDUCATION_FIELD_TO_DATA_FIELD: Record<string, string> = {
  institutionName: 'institutionName',
  faculty: 'faculty',
  department: 'department',
  degree: 'degree',
  startDate: 'startDate',
  endDate: 'endDate',
  status: 'status',
  description: 'description',
};

const SKILL_FIELD_TO_DATA_FIELD: Record<string, string> = {
  name: 'name',
  category: 'category',
  level: 'level',
  description: 'description',
};

const CERTIFICATION_FIELD_TO_DATA_FIELD: Record<string, string> = {
  name: 'name',
  issuer: 'issuer',
  acquiredDate: 'acquiredDate',
  expirationDate: 'expirationDate',
  credentialId: 'credentialId',
  credentialUrl: 'credentialUrl',
  description: 'description',
};

const PROJECT_FIELD_TO_DATA_FIELD: Record<string, string> = {
  name: 'name',
  organizationName: 'organizationName',
  role: 'role',
  startDate: 'startDate',
  endDate: 'endDate',
  isCurrent: 'isCurrent',
  summary: 'summary',
  responsibilities: 'responsibilitiesText',
  achievements: 'achievementsText',
  technologies: 'technologiesText',
};

const SECTION_FIELD_MAP: Record<string, Record<string, string>> = {
  workExperiences: WORK_FIELD_TO_DATA_FIELD,
  educationHistory: EDUCATION_FIELD_TO_DATA_FIELD,
  skills: SKILL_FIELD_TO_DATA_FIELD,
  certifications: CERTIFICATION_FIELD_TO_DATA_FIELD,
  projects: PROJECT_FIELD_TO_DATA_FIELD,
};

// === string[] field の集合: head が match したら数値 index 部分を無視する ===
//
// 例: workExperiences.0.responsibilities.2 → head='responsibilities' を見て
// 'responsibilitiesText' textarea に解決する (line 2 個別の input は存在しない)。
const SECTION_ARRAY_FIELDS: Record<string, ReadonlySet<string>> = {
  workExperiences: new Set(['responsibilities', 'achievements']),
  projects: new Set(['responsibilities', 'achievements', 'technologies']),
};

const isNumericSegment = (segment: string): boolean => /^\d+$/.test(segment);

const buildBasicsInputSelector = (rest: readonly string[]): string | null => {
  if (rest.length === 0) return null;
  const key = rest.join('.');
  const id = BASICS_INPUT_ID[key];
  if (id !== undefined) return `#${id}`;
  // sub-path 未対応 (例: profilePhoto.altText) は null
  return null;
};

const buildSectionEntryInputSelector = (
  sectionKey: string,
  rest: readonly string[],
): string | null => {
  const listId = SECTION_LIST_ID[sectionKey];
  if (listId === undefined) return null;

  const indexStr = rest[0];
  if (indexStr === undefined || !isNumericSegment(indexStr)) return null;

  const fieldPath = rest.slice(1);
  if (fieldPath.length === 0) return null; // entry レベル (cross-field check 等) は対象外

  const fieldMap = SECTION_FIELD_MAP[sectionKey];
  if (fieldMap === undefined) return null;

  // string[] field の N 行目: head のみで data-field を解決
  const head = fieldPath[0];
  const arrayFields = SECTION_ARRAY_FIELDS[sectionKey] ?? new Set<string>();
  if (head !== undefined && arrayFields.has(head)) {
    const dataField = fieldMap[head];
    if (dataField === undefined) return null;
    return `#${listId} [data-index="${indexStr}"] [data-field="${dataField}"]`;
  }

  // 完全 match (例: period.startDate)
  const fullKey = fieldPath.join('.');
  const dataField = fieldMap[fullKey];
  if (dataField === undefined) return null;
  return `#${listId} [data-index="${indexStr}"] [data-field="${dataField}"]`;
};

/**
 * ValidationIssue.path から、aria-invalid を付けるべき具体的な input element の
 * CSS selector を計算する pure 関数。
 *
 * 例:
 *   ''                                      → null
 *   'schemaVersion'                         → null
 *   'basics.birthDate'                      → '#birth-date'
 *   'basics.name.family'                    → '#name-family'
 *   'basics.address.postalCode'             → '#postal-code'
 *   'basics.profilePhoto.source.dataUri'    → '#profile-photo-input'
 *   'basics.profilePhoto.altText'           → null (input UI なし)
 *   'workExperiences.0.companyName'         → '#work-experiences-list [data-index="0"] [data-field="companyName"]'
 *   'workExperiences.0.period.endDate'      → '#work-experiences-list [data-index="0"] [data-field="endDate"]'
 *   'workExperiences.0.responsibilities.2'  → '#work-experiences-list [data-index="0"] [data-field="responsibilitiesText"]'
 *   'workExperiences.0'                     → null (entry level cross-field check、個別 input 対象なし)
 *   'workExperiences.0.period'              → null (period level cross-field check、個別 input 対象なし)
 *   'projects.0.technologies.0'             → '#projects-list [data-index="0"] [data-field="technologiesText"]'
 *   'unknownSection.0.field'                → null
 */
export const buildIssueInputSelector = (path: string): string | null => {
  if (path === '' || path === 'schemaVersion') return null;

  const segments = path.split('.');
  const head = segments[0];
  if (head === undefined) return null;

  if (head === 'basics') return buildBasicsInputSelector(segments.slice(1));
  return buildSectionEntryInputSelector(head, segments.slice(1));
};

/**
 * issue 配列から、aria-invalid を付けるべき selector 集合を返す。
 *
 * - 重複 (同じ input に複数 issue) は Set で de-dup
 * - null (個別 input target なし) は除外
 * - 戻り値は `for...of` で iterate しやすいよう ReadonlySet にする
 */
export const collectInvalidInputSelectors = (
  issues: readonly ValidationIssue[],
): ReadonlySet<string> => {
  const selectors = new Set<string>();
  for (const issue of issues) {
    const selector = buildIssueInputSelector(issue.path);
    if (selector !== null) selectors.add(selector);
  }
  return selectors;
};
