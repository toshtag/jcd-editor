// Education form helpers (apps/local-web)。
//
// 役割:
//   - educationHistory (配列) を編集する form の helper + DOM factory + DOM reader
//   - workExperiences と同じ「form 入力 → raw input object → safeParseCareerProfile」
//     の流れを educationHistory でも扱うため、`EducationFormValues` (form 入力を
//     表す中間型) と pure な変換関数を提供する
//   - DOM 自体を state として扱う pattern: 各 entry は
//     `<section data-index="N">` で表現、内部 input / textarea は
//     `data-field="..."` で identify する。JS 側で state を別途持たない
//
// schema (packages/core/src/domain/education.ts) との対応:
//   - field 8 つ全て optional: institutionName / faculty / department / degree
//                              / startDate / endDate / status / description
//   - startDate / endDate は `IsoYearMonthString` (`YYYY-MM`)。workExperiences
//     と同じく `<input type="month">` で取得 (date 変換は発明しない)
//   - status は free string (在学中 / 卒業 / 修了 / 中退 / 卒業見込み 等)
//   - cross-field check: startDate <= endDate (core 側で判定、UI 側で正規化しない)
//
// 設計判断:
//
// - `EducationFormValues` は string のみで構成 (workExperiences の boolean field
//   `isCurrent` 相当が education には無いため、string-only でちょうど揃う)。
// - 完全空 entry は flatMap で **除外**。workExperiences と同規約。
//   「学歴を追加」直後の空フォームは UI に残るが draft / 保存に流さない。
// - DOM 操作は `createElement` + `appendChild` + `replaceChildren` + `textContent`
//   のみ。innerHTML 不使用 (XSS 回避)。
// - workExperiences と同様、field 名は const に抽出 (`FIELD_*`)。factory と
//   reader が同じ identifier を共有。

import type { Education } from '@jcd-editor/core';

const FIELD_INSTITUTION_NAME = 'institutionName';
const FIELD_FACULTY = 'faculty';
const FIELD_DEPARTMENT = 'department';
const FIELD_DEGREE = 'degree';
const FIELD_START_DATE = 'startDate';
const FIELD_END_DATE = 'endDate';
const FIELD_STATUS = 'status';
const FIELD_DESCRIPTION = 'description';

export type EducationFormValues = {
  institutionName: string;
  faculty: string;
  department: string;
  degree: string;
  startDate: string;
  endDate: string;
  status: string;
  description: string;
};

export const emptyEducationFormValues = (): EducationFormValues => ({
  institutionName: '',
  faculty: '',
  department: '',
  degree: '',
  startDate: '',
  endDate: '',
  status: '',
  description: '',
});

export const educationToFormValues = (item: Education): EducationFormValues => ({
  institutionName: item.institutionName ?? '',
  faculty: item.faculty ?? '',
  department: item.department ?? '',
  degree: item.degree ?? '',
  startDate: item.startDate ?? '',
  endDate: item.endDate ?? '',
  status: item.status ?? '',
  description: item.description ?? '',
});

export const buildEducationFromForm = (
  values: readonly EducationFormValues[],
): Record<string, unknown>[] =>
  values.flatMap((v) => {
    const item: Record<string, unknown> = {};
    if (v.institutionName.trim() !== '') item.institutionName = v.institutionName;
    if (v.faculty.trim() !== '') item.faculty = v.faculty;
    if (v.department.trim() !== '') item.department = v.department;
    if (v.degree.trim() !== '') item.degree = v.degree;
    if (v.startDate.trim() !== '') item.startDate = v.startDate;
    if (v.endDate.trim() !== '') item.endDate = v.endDate;
    if (v.status.trim() !== '') item.status = v.status;
    if (v.description.trim() !== '') item.description = v.description;

    // 完全に空の entry (`{}`) は schema 的には valid だが、追加直後の空フォーム
    // を draft / 保存に流すと UX 上ノイズ。何か 1 field でも値があるときのみ残す。
    return Object.keys(item).length > 0 ? [item] : [];
  });

const createTextField = (
  label: string,
  field: string,
  value: string,
  inputType: 'text' | 'month',
): HTMLElement => {
  const wrapper = document.createElement('div');
  wrapper.className = 'education-item__field';

  const labelEl = document.createElement('label');
  labelEl.className = 'education-item__label';
  labelEl.textContent = label;

  const input = document.createElement('input');
  input.type = inputType;
  input.className = 'education-item__input';
  input.dataset.field = field;
  input.value = value;
  if (inputType === 'text') {
    input.autocomplete = 'off';
    input.spellcheck = false;
  }

  labelEl.appendChild(input);
  wrapper.appendChild(labelEl);
  return wrapper;
};

const createTextareaField = (label: string, field: string, value: string): HTMLElement => {
  const wrapper = document.createElement('div');
  wrapper.className = 'education-item__field';

  const labelEl = document.createElement('label');
  labelEl.className = 'education-item__label';
  labelEl.textContent = label;

  const textarea = document.createElement('textarea');
  textarea.className = 'education-item__textarea';
  textarea.dataset.field = field;
  textarea.value = value;
  textarea.rows = 3;
  textarea.spellcheck = false;

  labelEl.appendChild(textarea);
  wrapper.appendChild(labelEl);
  return wrapper;
};

const createPeriodRow = (values: EducationFormValues): HTMLElement => {
  const row = document.createElement('div');
  row.className = 'education-item__period-row';

  const startWrapper = document.createElement('label');
  startWrapper.className = 'education-item__label';
  startWrapper.textContent = '入学・編入月';
  const startInput = document.createElement('input');
  startInput.type = 'month';
  startInput.className = 'education-item__input';
  startInput.dataset.field = FIELD_START_DATE;
  startInput.value = values.startDate;
  startWrapper.appendChild(startInput);
  row.appendChild(startWrapper);

  const endWrapper = document.createElement('label');
  endWrapper.className = 'education-item__label';
  endWrapper.textContent = '卒業・終了月';
  const endInput = document.createElement('input');
  endInput.type = 'month';
  endInput.className = 'education-item__input';
  endInput.dataset.field = FIELD_END_DATE;
  endInput.value = values.endDate;
  endWrapper.appendChild(endInput);
  row.appendChild(endWrapper);

  return row;
};

export const createEducationItemElement = (
  index: number,
  values: EducationFormValues,
): HTMLElement => {
  const section = document.createElement('section');
  section.className = 'education-item';
  section.dataset.index = String(index);

  const header = document.createElement('header');
  header.className = 'education-item__header';

  const legend = document.createElement('h3');
  legend.className = 'education-item__legend';
  legend.textContent = `学歴 ${index + 1}`;
  header.appendChild(legend);

  const removeButton = document.createElement('button');
  removeButton.type = 'button';
  removeButton.className = 'education-item__remove';
  removeButton.dataset.action = 'remove';
  removeButton.textContent = '削除';
  header.appendChild(removeButton);

  section.appendChild(header);

  section.appendChild(
    createTextField('学校名', FIELD_INSTITUTION_NAME, values.institutionName, 'text'),
  );
  section.appendChild(createTextField('学部', FIELD_FACULTY, values.faculty, 'text'));
  section.appendChild(createTextField('学科・専攻', FIELD_DEPARTMENT, values.department, 'text'));
  section.appendChild(createTextField('学位', FIELD_DEGREE, values.degree, 'text'));
  section.appendChild(createPeriodRow(values));
  section.appendChild(createTextField('在籍状況', FIELD_STATUS, values.status, 'text'));
  section.appendChild(createTextareaField('備考', FIELD_DESCRIPTION, values.description));

  return section;
};

export const readEducationFromForm = (container: HTMLElement): EducationFormValues[] => {
  const items = container.querySelectorAll<HTMLElement>('[data-index]');
  return Array.from(items).map((itemEl) => {
    const readField = (field: string): string => {
      const el = itemEl.querySelector<HTMLInputElement | HTMLTextAreaElement>(
        `[data-field="${field}"]`,
      );
      return el?.value ?? '';
    };
    return {
      institutionName: readField(FIELD_INSTITUTION_NAME),
      faculty: readField(FIELD_FACULTY),
      department: readField(FIELD_DEPARTMENT),
      degree: readField(FIELD_DEGREE),
      startDate: readField(FIELD_START_DATE),
      endDate: readField(FIELD_END_DATE),
      status: readField(FIELD_STATUS),
      description: readField(FIELD_DESCRIPTION),
    };
  });
};

export const populateEducationForm = (
  container: HTMLElement,
  educationHistory: readonly Education[] | undefined,
): void => {
  container.replaceChildren();
  const items = educationHistory ?? [];
  items.forEach((item, index) => {
    const element = createEducationItemElement(index, educationToFormValues(item));
    container.appendChild(element);
  });
};
