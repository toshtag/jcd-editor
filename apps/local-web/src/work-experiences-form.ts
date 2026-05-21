// Work experiences form helpers (apps/local-web)。
//
// 役割:
//   - workExperiences (配列) を編集する form の helper + DOM factory + DOM reader
//   - basics と同じ「form 入力 → raw input object → safeParseCareerProfile」の
//     流れを workExperiences でも扱うため、`WorkExperienceFormValues` (form 入力
//     を表す中間型) と pure な変換関数を提供する
//   - DOM 自体を state として扱う pattern: 各 entry は
//     `<section data-index="N">` で表現、内部 input / textarea / checkbox は
//     `data-field="..."` で identify する。JS 側で state を別途持たない
//
// 設計判断:
//
// - `WorkExperienceFormValues` は string / boolean のみで構成 (form input の生値)。
//   `WorkExperience` 型 (core) ではなく form 表現に閉じる。
//   `responsibilities` / `achievements` は textarea 改行区切り raw text として保持
//   (`responsibilitiesText` / `achievementsText`)。
//
// - `buildWorkExperiencesFromForm` は flatMap で完全空 entry を **除外** する。
//   `WorkExperience` schema は `{}` を valid と判定するが、空の職歴 entry を
//   draft / 保存に流すと UX 上ノイズ。
//   「職歴を追加」直後の空フォームは UI に残るが draft には現れない、何か
//   1 field でも値を入れた時点で初めて draft に流れる、という挙動を意図する。
//
// - `splitLines` は `text.split('\n')` 後に `trim() === ''` の行を filter する。
//   core の `createNonBlankTextSchema` (空白のみ reject、空文字列も reject) と整合。
//   各行の trailing space は **保持** (`trim` しない、user の意図的 space は core が判定)。
//
// - `<input type="month">` を使うことで `YYYY-MM` value を取得、`IsoYearMonthString`
//   regex (`^\d{4}-\d{2}$`) と完全互換。
//
// - DOM 操作は `createElement` + `appendChild` + `replaceChildren` + `textContent`
//   のみ。innerHTML 不使用 (XSS 回避)。
//
// - `createWorkExperienceItemElement` (factory) と `readWorkExperiencesFromForm`
//   (reader) は同じ data-field 名を share する。typo 防止のため field 名を
//   const に抽出 (`FIELD_*`)。
//
// - core schema 制約 (`isCurrent === true && endDate !== undefined` reject、
//   `startDate > endDate` reject) は UI 側で正規化せず、validation issues として
//   表示する設計。本 PR では `isCurrent` チェック時に endDate を disable する等の
//   UX 改善は行わない (scope を絞る、core 制約に任せる)。

import type { WorkExperience } from '@jcd-editor/core';

const FIELD_COMPANY_NAME = 'companyName';
const FIELD_POSITION = 'position';
const FIELD_EMPLOYMENT_TYPE = 'employmentType';
const FIELD_START_DATE = 'startDate';
const FIELD_END_DATE = 'endDate';
const FIELD_IS_CURRENT = 'isCurrent';
const FIELD_SUMMARY = 'summary';
const FIELD_RESPONSIBILITIES_TEXT = 'responsibilitiesText';
const FIELD_ACHIEVEMENTS_TEXT = 'achievementsText';

export type WorkExperienceFormValues = {
  companyName: string;
  position: string;
  employmentType: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  summary: string;
  responsibilitiesText: string;
  achievementsText: string;
};

export const emptyWorkExperienceFormValues = (): WorkExperienceFormValues => ({
  companyName: '',
  position: '',
  employmentType: '',
  startDate: '',
  endDate: '',
  isCurrent: false,
  summary: '',
  responsibilitiesText: '',
  achievementsText: '',
});

export const workExperienceToFormValues = (item: WorkExperience): WorkExperienceFormValues => ({
  companyName: item.companyName ?? '',
  position: item.position ?? '',
  employmentType: item.employmentType ?? '',
  startDate: item.period?.startDate ?? '',
  endDate: item.period?.endDate ?? '',
  isCurrent: item.period?.isCurrent ?? false,
  summary: item.summary ?? '',
  responsibilitiesText: (item.responsibilities ?? []).join('\n'),
  achievementsText: (item.achievements ?? []).join('\n'),
});

const splitLines = (text: string): string[] =>
  text.split('\n').filter((line) => line.trim() !== '');

export const buildWorkExperiencesFromForm = (
  values: readonly WorkExperienceFormValues[],
): Record<string, unknown>[] =>
  values.flatMap((v) => {
    const item: Record<string, unknown> = {};
    if (v.companyName.trim() !== '') item.companyName = v.companyName;
    if (v.position.trim() !== '') item.position = v.position;
    if (v.employmentType.trim() !== '') item.employmentType = v.employmentType;

    const period: Record<string, unknown> = {};
    if (v.startDate.trim() !== '') period.startDate = v.startDate;
    if (v.endDate.trim() !== '') period.endDate = v.endDate;
    if (v.isCurrent) period.isCurrent = true;
    if (Object.keys(period).length > 0) item.period = period;

    if (v.summary.trim() !== '') item.summary = v.summary;

    const responsibilities = splitLines(v.responsibilitiesText);
    if (responsibilities.length > 0) item.responsibilities = responsibilities;

    const achievements = splitLines(v.achievementsText);
    if (achievements.length > 0) item.achievements = achievements;

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
  wrapper.className = 'work-experience-item__field';

  const labelEl = document.createElement('label');
  labelEl.className = 'work-experience-item__label';
  labelEl.textContent = label;

  const input = document.createElement('input');
  input.type = inputType;
  input.className = 'work-experience-item__input';
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

const createTextareaField = (
  label: string,
  field: string,
  value: string,
  hint: string,
): HTMLElement => {
  const wrapper = document.createElement('div');
  wrapper.className = 'work-experience-item__field';

  const labelEl = document.createElement('label');
  labelEl.className = 'work-experience-item__label';
  labelEl.textContent = label;

  const hintEl = document.createElement('span');
  hintEl.className = 'work-experience-item__hint';
  hintEl.textContent = hint;
  labelEl.appendChild(hintEl);

  const textarea = document.createElement('textarea');
  textarea.className = 'work-experience-item__textarea';
  textarea.dataset.field = field;
  textarea.value = value;
  textarea.rows = 3;
  textarea.spellcheck = false;

  labelEl.appendChild(textarea);
  wrapper.appendChild(labelEl);
  return wrapper;
};

const createPeriodRow = (values: WorkExperienceFormValues): HTMLElement => {
  const row = document.createElement('div');
  row.className = 'work-experience-item__period-row';

  const startWrapper = document.createElement('label');
  startWrapper.className = 'work-experience-item__label';
  startWrapper.textContent = '開始月';
  const startInput = document.createElement('input');
  startInput.type = 'month';
  startInput.className = 'work-experience-item__input';
  startInput.dataset.field = FIELD_START_DATE;
  startInput.value = values.startDate;
  startWrapper.appendChild(startInput);
  row.appendChild(startWrapper);

  const endWrapper = document.createElement('label');
  endWrapper.className = 'work-experience-item__label';
  endWrapper.textContent = '終了月';
  const endInput = document.createElement('input');
  endInput.type = 'month';
  endInput.className = 'work-experience-item__input';
  endInput.dataset.field = FIELD_END_DATE;
  endInput.value = values.endDate;
  endWrapper.appendChild(endInput);
  row.appendChild(endWrapper);

  const isCurrentWrapper = document.createElement('label');
  isCurrentWrapper.className = 'work-experience-item__checkbox-wrapper';
  const isCurrentInput = document.createElement('input');
  isCurrentInput.type = 'checkbox';
  isCurrentInput.className = 'work-experience-item__checkbox';
  isCurrentInput.dataset.field = FIELD_IS_CURRENT;
  isCurrentInput.checked = values.isCurrent;
  const isCurrentText = document.createTextNode(' 現在に至る');
  isCurrentWrapper.appendChild(isCurrentInput);
  isCurrentWrapper.appendChild(isCurrentText);
  row.appendChild(isCurrentWrapper);

  return row;
};

export const createWorkExperienceItemElement = (
  index: number,
  values: WorkExperienceFormValues,
): HTMLElement => {
  const section = document.createElement('section');
  section.className = 'work-experience-item';
  section.dataset.index = String(index);

  const header = document.createElement('header');
  header.className = 'work-experience-item__header';

  const legend = document.createElement('h3');
  legend.className = 'work-experience-item__legend';
  legend.textContent = `職歴 ${index + 1}`;
  header.appendChild(legend);

  const removeButton = document.createElement('button');
  removeButton.type = 'button';
  removeButton.className = 'work-experience-item__remove';
  removeButton.dataset.action = 'remove';
  removeButton.textContent = '削除';
  header.appendChild(removeButton);

  section.appendChild(header);

  section.appendChild(createTextField('会社名', FIELD_COMPANY_NAME, values.companyName, 'text'));
  section.appendChild(createTextField('役職', FIELD_POSITION, values.position, 'text'));
  section.appendChild(
    createTextField('雇用形態', FIELD_EMPLOYMENT_TYPE, values.employmentType, 'text'),
  );
  section.appendChild(createPeriodRow(values));
  section.appendChild(createTextareaField('概要', FIELD_SUMMARY, values.summary, ''));
  section.appendChild(
    createTextareaField(
      '担当業務',
      FIELD_RESPONSIBILITIES_TEXT,
      values.responsibilitiesText,
      ' (1 行 1 項目)',
    ),
  );
  section.appendChild(
    createTextareaField('実績', FIELD_ACHIEVEMENTS_TEXT, values.achievementsText, ' (1 行 1 項目)'),
  );

  return section;
};

export const readWorkExperiencesFromForm = (container: HTMLElement): WorkExperienceFormValues[] => {
  const items = container.querySelectorAll<HTMLElement>('[data-index]');
  return Array.from(items).map((itemEl) => {
    const readField = (field: string): string => {
      const el = itemEl.querySelector<HTMLInputElement | HTMLTextAreaElement>(
        `[data-field="${field}"]`,
      );
      return el?.value ?? '';
    };
    const readCheckbox = (field: string): boolean => {
      const el = itemEl.querySelector<HTMLInputElement>(`[data-field="${field}"]`);
      return el?.checked ?? false;
    };
    return {
      companyName: readField(FIELD_COMPANY_NAME),
      position: readField(FIELD_POSITION),
      employmentType: readField(FIELD_EMPLOYMENT_TYPE),
      startDate: readField(FIELD_START_DATE),
      endDate: readField(FIELD_END_DATE),
      isCurrent: readCheckbox(FIELD_IS_CURRENT),
      summary: readField(FIELD_SUMMARY),
      responsibilitiesText: readField(FIELD_RESPONSIBILITIES_TEXT),
      achievementsText: readField(FIELD_ACHIEVEMENTS_TEXT),
    };
  });
};

export const populateWorkExperiencesForm = (
  container: HTMLElement,
  workExperiences: readonly WorkExperience[] | undefined,
): void => {
  container.replaceChildren();
  const items = workExperiences ?? [];
  items.forEach((item, index) => {
    const element = createWorkExperienceItemElement(index, workExperienceToFormValues(item));
    container.appendChild(element);
  });
};
