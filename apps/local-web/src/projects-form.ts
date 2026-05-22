// Projects form helpers (apps/local-web)。
//
// 役割:
//   - projects (プロジェクト) の配列を編集する form の helper + DOM factory + DOM reader
//   - work-experiences-form.ts と最も近い pattern を踏襲する (boolean isCurrent と
//     配列 field を持つ点が共通、organizationName / technologies が追加)
//   - DOM 自体を state として扱う: 各 entry は `<section data-index="N">` で表現、
//     内部 input / textarea / checkbox は `data-field="..."` で identify する
//
// schema (packages/core/src/domain/project.ts) との対応:
//   - field 10 つ:
//     - string: name / organizationName / role / summary
//     - IsoYearMonthString: startDate / endDate
//     - boolean: isCurrent
//     - string[]: responsibilities / achievements / technologies
//   - startDate / endDate は workExperiences と同じく `<input type="month">` で取得
//   - cross-field check (core 側で判定):
//     - isCurrent === true && endDate !== undefined を reject
//     - startDate > endDate を reject
//
// 設計判断:
//
// - `ProjectFormValues` は string / boolean のみ (workExperiences と同規約)。
//   responsibilities / achievements / technologies は textarea 改行区切り raw text
//   として `responsibilitiesText` / `achievementsText` / `technologiesText` で保持する
// - 完全空 entry は flatMap で除外する (他 section と同規約)
// - splitLines は workExperiences と同様 `text.split('\n')` 後に `trim() === ''` の
//   行を filter する。各行の trailing space は保持する
// - DOM 操作は `createElement` + `appendChild` + `replaceChildren` + `textContent` のみ。
//   innerHTML 不使用 (XSS 回避)
// - field 名は const に抽出 (`FIELD_*`)。factory と reader が共有する
// - core の cross-field check (isCurrent + endDate / start > end) は UI 側で正規化
//   せず、validation issues として preview 下部に表示する設計 (workExperiences と
//   同じ責務分割)

import type { Project } from '@jcd-editor/core';

const FIELD_NAME = 'name';
const FIELD_ORGANIZATION_NAME = 'organizationName';
const FIELD_ROLE = 'role';
const FIELD_START_DATE = 'startDate';
const FIELD_END_DATE = 'endDate';
const FIELD_IS_CURRENT = 'isCurrent';
const FIELD_SUMMARY = 'summary';
const FIELD_RESPONSIBILITIES_TEXT = 'responsibilitiesText';
const FIELD_ACHIEVEMENTS_TEXT = 'achievementsText';
const FIELD_TECHNOLOGIES_TEXT = 'technologiesText';

export type ProjectFormValues = {
  name: string;
  organizationName: string;
  role: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  summary: string;
  responsibilitiesText: string;
  achievementsText: string;
  technologiesText: string;
};

export const emptyProjectFormValues = (): ProjectFormValues => ({
  name: '',
  organizationName: '',
  role: '',
  startDate: '',
  endDate: '',
  isCurrent: false,
  summary: '',
  responsibilitiesText: '',
  achievementsText: '',
  technologiesText: '',
});

export const projectToFormValues = (item: Project): ProjectFormValues => ({
  name: item.name ?? '',
  organizationName: item.organizationName ?? '',
  role: item.role ?? '',
  startDate: item.startDate ?? '',
  endDate: item.endDate ?? '',
  isCurrent: item.isCurrent ?? false,
  summary: item.summary ?? '',
  responsibilitiesText: (item.responsibilities ?? []).join('\n'),
  achievementsText: (item.achievements ?? []).join('\n'),
  technologiesText: (item.technologies ?? []).join('\n'),
});

const splitLines = (text: string): string[] =>
  text.split('\n').filter((line) => line.trim() !== '');

export const buildProjectsFromForm = (
  values: readonly ProjectFormValues[],
): Record<string, unknown>[] =>
  values.flatMap((v) => {
    const item: Record<string, unknown> = {};
    if (v.name.trim() !== '') item.name = v.name;
    if (v.organizationName.trim() !== '') item.organizationName = v.organizationName;
    if (v.role.trim() !== '') item.role = v.role;
    if (v.startDate.trim() !== '') item.startDate = v.startDate;
    if (v.endDate.trim() !== '') item.endDate = v.endDate;
    if (v.isCurrent) item.isCurrent = true;
    if (v.summary.trim() !== '') item.summary = v.summary;

    const responsibilities = splitLines(v.responsibilitiesText);
    if (responsibilities.length > 0) item.responsibilities = responsibilities;

    const achievements = splitLines(v.achievementsText);
    if (achievements.length > 0) item.achievements = achievements;

    const technologies = splitLines(v.technologiesText);
    if (technologies.length > 0) item.technologies = technologies;

    // 完全に空の entry (`{}`) は schema 的には valid だが、追加直後の空フォームを
    // draft / 保存に流すと UX 上ノイズになる。何か 1 field でも値があるときのみ残す。
    return Object.keys(item).length > 0 ? [item] : [];
  });

const createTextField = (
  label: string,
  field: string,
  value: string,
  inputType: 'text' | 'month',
): HTMLElement => {
  const wrapper = document.createElement('div');
  wrapper.className = 'project-item__field';

  const labelEl = document.createElement('label');
  labelEl.className = 'project-item__label';
  labelEl.textContent = label;

  const input = document.createElement('input');
  input.type = inputType;
  input.className = 'project-item__input';
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
  wrapper.className = 'project-item__field';

  const labelEl = document.createElement('label');
  labelEl.className = 'project-item__label';
  labelEl.textContent = label;

  const hintEl = document.createElement('span');
  hintEl.className = 'project-item__hint';
  hintEl.textContent = hint;
  labelEl.appendChild(hintEl);

  const textarea = document.createElement('textarea');
  textarea.className = 'project-item__textarea';
  textarea.dataset.field = field;
  textarea.value = value;
  textarea.rows = 3;
  textarea.spellcheck = false;

  labelEl.appendChild(textarea);
  wrapper.appendChild(labelEl);
  return wrapper;
};

const createPeriodRow = (values: ProjectFormValues): HTMLElement => {
  const row = document.createElement('div');
  row.className = 'project-item__period-row';

  const startWrapper = document.createElement('label');
  startWrapper.className = 'project-item__label';
  startWrapper.textContent = '開始月';
  const startInput = document.createElement('input');
  startInput.type = 'month';
  startInput.className = 'project-item__input';
  startInput.dataset.field = FIELD_START_DATE;
  startInput.value = values.startDate;
  startWrapper.appendChild(startInput);
  row.appendChild(startWrapper);

  const endWrapper = document.createElement('label');
  endWrapper.className = 'project-item__label';
  endWrapper.textContent = '終了月';
  const endInput = document.createElement('input');
  endInput.type = 'month';
  endInput.className = 'project-item__input';
  endInput.dataset.field = FIELD_END_DATE;
  endInput.value = values.endDate;
  endWrapper.appendChild(endInput);
  row.appendChild(endWrapper);

  const isCurrentWrapper = document.createElement('label');
  isCurrentWrapper.className = 'project-item__checkbox-wrapper';
  const isCurrentInput = document.createElement('input');
  isCurrentInput.type = 'checkbox';
  isCurrentInput.className = 'project-item__checkbox';
  isCurrentInput.dataset.field = FIELD_IS_CURRENT;
  isCurrentInput.checked = values.isCurrent;
  const isCurrentText = document.createTextNode(' 現在進行中');
  isCurrentWrapper.appendChild(isCurrentInput);
  isCurrentWrapper.appendChild(isCurrentText);
  row.appendChild(isCurrentWrapper);

  return row;
};

// a11y: entry section の SR announce 用 aria-label。
// remove / renumber 時にも更新する (main.ts の renumberProjectItems 参照)。
export const projectItemAriaLabel = (index: number): string => `プロジェクト ${index + 1}`;

export const createProjectItemElement = (index: number, values: ProjectFormValues): HTMLElement => {
  const section = document.createElement('section');
  section.className = 'project-item';
  section.dataset.index = String(index);
  section.setAttribute('aria-label', projectItemAriaLabel(index));

  const header = document.createElement('header');
  header.className = 'project-item__header';

  const legend = document.createElement('h3');
  legend.className = 'project-item__legend';
  legend.textContent = projectItemAriaLabel(index);
  header.appendChild(legend);

  const removeButton = document.createElement('button');
  removeButton.type = 'button';
  removeButton.className = 'project-item__remove';
  removeButton.dataset.action = 'remove';
  removeButton.textContent = '削除';
  header.appendChild(removeButton);

  section.appendChild(header);

  section.appendChild(createTextField('プロジェクト名', FIELD_NAME, values.name, 'text'));
  section.appendChild(
    createTextField('所属組織', FIELD_ORGANIZATION_NAME, values.organizationName, 'text'),
  );
  section.appendChild(createTextField('役割', FIELD_ROLE, values.role, 'text'));
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
    createTextareaField('成果', FIELD_ACHIEVEMENTS_TEXT, values.achievementsText, ' (1 行 1 項目)'),
  );
  section.appendChild(
    createTextareaField(
      '使用技術',
      FIELD_TECHNOLOGIES_TEXT,
      values.technologiesText,
      ' (1 行 1 項目)',
    ),
  );

  return section;
};

export const readProjectsFromForm = (container: HTMLElement): ProjectFormValues[] => {
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
      name: readField(FIELD_NAME),
      organizationName: readField(FIELD_ORGANIZATION_NAME),
      role: readField(FIELD_ROLE),
      startDate: readField(FIELD_START_DATE),
      endDate: readField(FIELD_END_DATE),
      isCurrent: readCheckbox(FIELD_IS_CURRENT),
      summary: readField(FIELD_SUMMARY),
      responsibilitiesText: readField(FIELD_RESPONSIBILITIES_TEXT),
      achievementsText: readField(FIELD_ACHIEVEMENTS_TEXT),
      technologiesText: readField(FIELD_TECHNOLOGIES_TEXT),
    };
  });
};

export const populateProjectsForm = (
  container: HTMLElement,
  projects: readonly Project[] | undefined,
): void => {
  container.replaceChildren();
  const items = projects ?? [];
  items.forEach((item, index) => {
    const element = createProjectItemElement(index, projectToFormValues(item));
    container.appendChild(element);
  });
};
