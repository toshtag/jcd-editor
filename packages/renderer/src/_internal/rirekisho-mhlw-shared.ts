// rirekisho-mhlw-a3 / rirekisho-mhlw-a4 両 template で共有する pure logic。
//
// 共有しているのは **page layout に依存しない計算ロジック** のみ:
//   - HistoryRow の構築 (学歴 / 職歴 の row 分解)
//   - CertificationRow の構築 (年月 + name + (issuer))
//   - 満年齢計算
//   - splitYearMonth (formatYearMonth 由来の string を年セル / 月セルに分解)
//
// 共有していないもの (page layout 依存):
//   - 座標定数 (HISTORY_LAYOUT / CERTIFICATION_LAYOUT / PHOTO_BOX_MM / 各 free box)
//   - 罫線描画 (h_lines / v_lines の x オフセット計算)
//   - 公式ラベル描画 (text bbox の x オフセット計算)
//   - 各 user data の x 座標 (氏名 / 連絡先 etc.)
//   - CSS
//
// これらは A3 / A4 で根本的に違うので template 側に閉じる。

import type { Certification, Education, WorkExperience } from '@jcd-editor/core';

import { formatYearMonth, isNonEmpty } from './template-format';

export type HistoryRow =
  | { kind: 'heading'; label: '学歴' | '職歴' }
  | { kind: 'entry'; year: string; month: string; content: string };

export type CertificationRow = { year: string; month: string; content: string };

/**
 * `2024年4月` のような formatYearMonth 出力を { year: '2024', month: '4' } に分解。
 * パターンに合わなければ raw string を year に入れ month を空にする (defensive)。
 */
export const splitYearMonth = (yearMonth: string): { year: string; month: string } => {
  const m = yearMonth.match(/^(\d{4})年(\d{1,2})月$/);
  if (m === null) return { year: yearMonth, month: '' };
  return { year: m[1] as string, month: m[2] as string };
};

export const educationSubject = (entry: Education): string => {
  const parts: string[] = [];
  if (isNonEmpty(entry.institutionName)) parts.push(entry.institutionName);
  if (isNonEmpty(entry.faculty)) parts.push(entry.faculty);
  if (isNonEmpty(entry.department)) parts.push(entry.department);
  if (isNonEmpty(entry.degree)) parts.push(entry.degree);
  return parts.join(' ');
};

export const workAnnotation = (entry: WorkExperience): string => {
  const parts: string[] = [];
  if (isNonEmpty(entry.employmentType)) parts.push(entry.employmentType);
  if (isNonEmpty(entry.position)) parts.push(entry.position);
  if (parts.length === 0) return '';
  return `（${parts.join(' / ')}）`;
};

export const buildEducationRows = (entries: Education[] | undefined): HistoryRow[] => {
  if (entries === undefined || entries.length === 0) return [];
  const rows: HistoryRow[] = [];
  for (const entry of entries) {
    const subject = educationSubject(entry);
    const description = isNonEmpty(entry.description) ? entry.description : '';

    if (entry.startDate !== undefined) {
      const { year, month } = splitYearMonth(formatYearMonth(entry.startDate));
      const content = subject === '' ? '入学' : `${subject} 入学`;
      rows.push({ kind: 'entry', year, month, content });
    }
    if (entry.endDate !== undefined) {
      const { year, month } = splitYearMonth(formatYearMonth(entry.endDate));
      const ending = isNonEmpty(entry.status) ? entry.status : '卒業';
      const content = subject === '' ? ending : `${subject} ${ending}`;
      rows.push({ kind: 'entry', year, month, content });
    }
    if (entry.startDate === undefined && entry.endDate === undefined) {
      const contentParts: string[] = [];
      if (subject !== '') contentParts.push(subject);
      if (isNonEmpty(entry.status)) contentParts.push(entry.status);
      let content = contentParts.join(' ');
      if (description !== '') {
        content = content === '' ? `（${description}）` : `${content}（${description}）`;
      }
      if (content !== '') {
        rows.push({ kind: 'entry', year: '', month: '', content });
      }
    }
  }
  if (rows.length === 0) return [];
  return [{ kind: 'heading', label: '学歴' }, ...rows];
};

export const buildWorkRows = (entries: WorkExperience[] | undefined): HistoryRow[] => {
  if (entries === undefined || entries.length === 0) return [];
  const rows: HistoryRow[] = [];
  let hasCurrent = false;
  for (const entry of entries) {
    const company = isNonEmpty(entry.companyName) ? entry.companyName : '';
    const annotation = workAnnotation(entry);
    const startDate = entry.period?.startDate;
    const endDate = entry.period?.endDate;
    const isCurrent = entry.period?.isCurrent === true;
    if (isCurrent) hasCurrent = true;

    if (startDate !== undefined) {
      const { year, month } = splitYearMonth(formatYearMonth(startDate));
      const content = company === '' ? `入社${annotation}` : `${company} 入社${annotation}`;
      rows.push({ kind: 'entry', year, month, content });
    }
    if (!isCurrent && endDate !== undefined) {
      const { year, month } = splitYearMonth(formatYearMonth(endDate));
      const content = company === '' ? '退職' : `${company} 退職`;
      rows.push({ kind: 'entry', year, month, content });
    }
    if (startDate === undefined && endDate === undefined && !isCurrent) {
      const contentParts: string[] = [];
      if (company !== '') contentParts.push(company);
      const content = contentParts.join('') + annotation;
      if (content !== '') {
        rows.push({ kind: 'entry', year: '', month: '', content });
      }
    }
  }
  if (hasCurrent) {
    rows.push({ kind: 'entry', year: '', month: '', content: '現在に至る' });
  }
  if (rows.length === 0) return [];
  return [{ kind: 'heading', label: '職歴' }, ...rows];
};

export const buildCertificationRows = (
  entries: Certification[] | undefined,
): CertificationRow[] => {
  if (entries === undefined || entries.length === 0) return [];
  const rows: CertificationRow[] = [];
  for (const entry of entries) {
    const parts: string[] = [];
    if (isNonEmpty(entry.name)) parts.push(entry.name);
    if (isNonEmpty(entry.issuer)) parts.push(`（${entry.issuer}）`);
    const content = parts.join(' ');
    if (entry.acquiredDate !== undefined) {
      const { year, month } = splitYearMonth(formatYearMonth(entry.acquiredDate));
      rows.push({ year, month, content });
    } else if (content !== '') {
      rows.push({ year: '', month: '', content });
    }
  }
  return rows;
};

/**
 * 基準日 (baseDate) 時点での満年齢を返す。誕生日未到来なら 1 引く。
 * 値が ISO date 形式でないか年齢が負になる場合は undefined を返す。
 */
export const computeAgeOnDate = (birthDate: string, baseDate: string): number | undefined => {
  const b = birthDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const t = baseDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (b === null || t === null) return undefined;
  const by = Number(b[1]);
  const bm = Number(b[2]);
  const bd = Number(b[3]);
  const ty = Number(t[1]);
  const tm = Number(t[2]);
  const td = Number(t[3]);
  let age = ty - by;
  if (tm < bm || (tm === bm && td < bd)) age -= 1;
  return age >= 0 ? age : undefined;
};
