// Validation issue path → 日本語 label への変換 (pure)。
//
// 役割:
//   - core から返る ValidationIssue.path (dot-separated、例
//     `educationHistory.0.endDate`) を user-facing な日本語 label
//     (例 `学歴 1 件目 > 卒業・終了月`) に変換する
//   - issue.message 自体は core 側で既に日本語化されているので触らない
//
// 責務分離:
//   - 本 module は pure 関数のみ。DOM / state / network には触れない
//   - field 名対応表は本 module 内に集中させる (core schema のキー名と
//     UI 表示名の境界を 1 箇所に閉じ込める)
//
// 設計判断:
//
// - 配列 entry は **1-indexed** で表示する (人間が読む数え方)
// - dot path に追従できない (= 表で定義していない) field は raw segment を
//   そのまま表示する。生 path よりは何かしらの context が付くので可読性が
//   上がる。schema 変更で field が増えた場合の fallback としても機能する
// - field 名の表記は apps/local-web の各 form helper / index.html label と
//   一致させる (例: 「卒業・終了月」は education form の label と同一)
// - section 内の string[] field (workExperiences.responsibilities など)
//   は `<entry label> > <field label> (N 行目)` 形式

import type { ValidationIssue } from '@jcd-editor/core';

const SECTION_LABEL: Record<string, string> = {
  workExperiences: '職務経歴',
  educationHistory: '学歴',
  skills: 'スキル',
  certifications: '資格',
  projects: 'プロジェクト',
};

const BASICS_FIELD_LABEL: Record<string, string> = {
  name: '氏名',
  'name.family': '氏名 (姓)',
  'name.given': '氏名 (名)',
  nameKana: 'フリガナ',
  'nameKana.family': 'フリガナ (セイ)',
  'nameKana.given': 'フリガナ (メイ)',
  birthDate: '生年月日',
  email: 'メールアドレス',
  phone: '電話番号',
  address: '住所',
  'address.postalCode': '住所 (郵便番号)',
  'address.prefecture': '住所 (都道府県)',
  'address.cityAndRest': '住所 (市区町村以下)',
  profilePhoto: '証明写真',
  'profilePhoto.altText': '証明写真 (代替テキスト)',
  'profilePhoto.source': '証明写真 (data source)',
  'profilePhoto.source.dataUri': '証明写真 (data URI)',
  'profilePhoto.source.path': '証明写真 (ファイルパス)',
  'profilePhoto.source.mediaType': '証明写真 (MIME type)',
  'profilePhoto.source.kind': '証明写真 (source 種別)',
};

const WORK_FIELD_LABEL: Record<string, string> = {
  companyName: '会社名',
  position: '役職',
  employmentType: '雇用形態',
  period: '期間',
  'period.startDate': '開始月',
  'period.endDate': '終了月',
  'period.isCurrent': '在職中フラグ',
  summary: '概要',
  responsibilities: '担当業務',
  achievements: '実績',
};

const EDUCATION_FIELD_LABEL: Record<string, string> = {
  institutionName: '学校名',
  faculty: '学部',
  department: '学科・専攻',
  degree: '学位',
  startDate: '入学・編入月',
  endDate: '卒業・終了月',
  status: '在籍状況',
  description: '備考',
};

const SKILL_FIELD_LABEL: Record<string, string> = {
  name: 'スキル名',
  category: 'カテゴリ',
  level: 'レベル',
  description: '備考',
};

const CERTIFICATION_FIELD_LABEL: Record<string, string> = {
  name: '資格名',
  issuer: '発行機関',
  acquiredDate: '取得月',
  expirationDate: '失効月',
  credentialId: '認定 ID',
  credentialUrl: '認定 URL',
  description: '備考',
};

const PROJECT_FIELD_LABEL: Record<string, string> = {
  name: 'プロジェクト名',
  organizationName: '所属組織',
  role: '役割',
  startDate: '開始月',
  endDate: '終了月',
  isCurrent: '進行中フラグ',
  summary: '概要',
  responsibilities: '担当業務',
  achievements: '成果',
  technologies: '使用技術',
};

const SECTION_FIELD_LABELS: Record<string, Record<string, string>> = {
  workExperiences: WORK_FIELD_LABEL,
  educationHistory: EDUCATION_FIELD_LABEL,
  skills: SKILL_FIELD_LABEL,
  certifications: CERTIFICATION_FIELD_LABEL,
  projects: PROJECT_FIELD_LABEL,
};

// section 内の string[] 系 field (改行区切り入力)。配列 index は「N 行目」表示。
const SECTION_ARRAY_FIELDS: Record<string, ReadonlySet<string>> = {
  workExperiences: new Set(['responsibilities', 'achievements']),
  projects: new Set(['responsibilities', 'achievements', 'technologies']),
};

const isNumericSegment = (segment: string): boolean => /^\d+$/.test(segment);

const lookupBasicsLabel = (rest: readonly string[]): string => {
  if (rest.length === 0) return '基本情報';
  const key = rest.join('.');
  const label = BASICS_FIELD_LABEL[key];
  if (label !== undefined) return `基本情報 > ${label}`;
  // 1 段目だけ match する場合も拾う (例: 未知 nested key で head のみ既知)
  const head = rest[0];
  if (head !== undefined && BASICS_FIELD_LABEL[head] !== undefined) {
    const headLabel = BASICS_FIELD_LABEL[head];
    return `基本情報 > ${headLabel} > ${rest.slice(1).join('.')}`;
  }
  return `基本情報 > ${key}`;
};

const lookupSectionFieldLabel = (sectionKey: string, fieldPath: readonly string[]): string => {
  const fieldLabels = SECTION_FIELD_LABELS[sectionKey];
  if (fieldLabels === undefined) return fieldPath.join('.');
  if (fieldPath.length === 0) return '';

  // string[] field の N 行目表記 (例: responsibilities.2 → 担当業務 (3 行目))
  const head = fieldPath[0];
  const arrayFields = SECTION_ARRAY_FIELDS[sectionKey] ?? new Set<string>();
  if (head !== undefined && arrayFields.has(head) && fieldPath.length >= 2) {
    const lineIndexStr = fieldPath[1];
    if (lineIndexStr !== undefined && isNumericSegment(lineIndexStr)) {
      const headLabel = fieldLabels[head] ?? head;
      return `${headLabel} (${Number(lineIndexStr) + 1} 行目)`;
    }
  }

  // 完全 match (例: period.startDate)
  const fullKey = fieldPath.join('.');
  const fullLabel = fieldLabels[fullKey];
  if (fullLabel !== undefined) return fullLabel;

  // head のみ match (未知 sub-field の fallback)
  if (head !== undefined && fieldLabels[head] !== undefined) {
    const headLabel = fieldLabels[head];
    const rest = fieldPath.slice(1).join('.');
    return rest === '' ? headLabel : `${headLabel} > ${rest}`;
  }

  return fullKey;
};

/**
 * Validation issue の dot path を日本語 label に変換する pure 関数。
 *
 * 例:
 *   ''                                      → '全体'
 *   'schemaVersion'                         → 'スキーマバージョン'
 *   'basics.birthDate'                      → '基本情報 > 生年月日'
 *   'basics.name.family'                    → '基本情報 > 氏名 (姓)'
 *   'workExperiences.0.companyName'         → '職務経歴 1 件目 > 会社名'
 *   'workExperiences.0.period.endDate'      → '職務経歴 1 件目 > 終了月'
 *   'workExperiences.0.responsibilities.2'  → '職務経歴 1 件目 > 担当業務 (3 行目)'
 *   'educationHistory.0'                    → '学歴 1 件目'
 *   'projects.0.technologies.0'             → 'プロジェクト 1 件目 > 使用技術 (1 行目)'
 *
 * 未知の path は raw segment を残し、可能な限り context を付けて返す
 * (生 path よりは可読性が高い fallback)。
 */
export const translateIssuePath = (path: string): string => {
  if (path === '') return '全体';
  if (path === 'schemaVersion') return 'スキーマバージョン';

  const segments = path.split('.');
  const head = segments[0];
  if (head === undefined) return path;

  if (head === 'basics') {
    return lookupBasicsLabel(segments.slice(1));
  }

  const sectionLabel = SECTION_LABEL[head];
  if (sectionLabel === undefined) return path;

  // section 配列 entry の index
  const indexStr = segments[1];
  if (indexStr === undefined || !isNumericSegment(indexStr)) {
    return sectionLabel;
  }
  const entryLabel = `${sectionLabel} ${Number(indexStr) + 1} 件目`;

  const fieldPath = segments.slice(2);
  if (fieldPath.length === 0) return entryLabel;

  const fieldLabel = lookupSectionFieldLabel(head, fieldPath);
  return fieldLabel === '' ? entryLabel : `${entryLabel} > ${fieldLabel}`;
};

/**
 * 1 件の ValidationIssue を `- <path label>: <message>` 形式に整形する。
 * main.ts の `formatIssues` から呼ばれる。
 */
export const formatTranslatedIssue = (issue: ValidationIssue): string =>
  `- ${translateIssuePath(issue.path)}: ${issue.message}`;
