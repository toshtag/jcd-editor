// Skills form helpers (apps/local-web)。
//
// 役割:
//   - skills (配列) を編集する form の helper + DOM factory + DOM reader
//   - work-experiences-form.ts / education-form.ts と同じ pattern を踏襲
//   - DOM 自体を state として扱う pattern: 各 entry は
//     `<section data-index="N">` で表現、内部 input / textarea は
//     `data-field="..."` で identify する
//
// schema (packages/core/src/domain/skill.ts) との対応:
//   - field 4 つ全て optional: name / category / level / description
//   - 全て string 値、date / 配列 / boolean なし。最もシンプルな section
//
// 設計判断:
//
// - `SkillFormValues` は string のみ (schema 通り)
// - 完全空 entry は flatMap で **除外** (workExperiences / education と同規約)
// - DOM 操作は `createElement` + `appendChild` + `replaceChildren` + `textContent`
//   のみ。innerHTML 不使用 (XSS 回避)
// - field 名は const に抽出 (`FIELD_*`)。factory と reader が共有

import type { Skill } from '@jcd-editor/core';

const FIELD_NAME = 'name';
const FIELD_CATEGORY = 'category';
const FIELD_LEVEL = 'level';
const FIELD_DESCRIPTION = 'description';

export type SkillFormValues = {
  name: string;
  category: string;
  level: string;
  description: string;
};

export const emptySkillFormValues = (): SkillFormValues => ({
  name: '',
  category: '',
  level: '',
  description: '',
});

export const skillToFormValues = (item: Skill): SkillFormValues => ({
  name: item.name ?? '',
  category: item.category ?? '',
  level: item.level ?? '',
  description: item.description ?? '',
});

export const buildSkillsFromForm = (
  values: readonly SkillFormValues[],
): Record<string, unknown>[] =>
  values.flatMap((v) => {
    const item: Record<string, unknown> = {};
    if (v.name.trim() !== '') item.name = v.name;
    if (v.category.trim() !== '') item.category = v.category;
    if (v.level.trim() !== '') item.level = v.level;
    if (v.description.trim() !== '') item.description = v.description;

    // 完全に空の entry (`{}`) は schema 的には valid だが、追加直後の空フォーム
    // を draft / 保存に流すと UX 上ノイズ。何か 1 field でも値があるときのみ残す。
    return Object.keys(item).length > 0 ? [item] : [];
  });

const createTextField = (label: string, field: string, value: string): HTMLElement => {
  const wrapper = document.createElement('div');
  wrapper.className = 'skill-item__field';

  const labelEl = document.createElement('label');
  labelEl.className = 'skill-item__label';
  labelEl.textContent = label;

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'skill-item__input';
  input.dataset.field = field;
  input.value = value;
  input.autocomplete = 'off';
  input.spellcheck = false;

  labelEl.appendChild(input);
  wrapper.appendChild(labelEl);
  return wrapper;
};

const createTextareaField = (label: string, field: string, value: string): HTMLElement => {
  const wrapper = document.createElement('div');
  wrapper.className = 'skill-item__field';

  const labelEl = document.createElement('label');
  labelEl.className = 'skill-item__label';
  labelEl.textContent = label;

  const textarea = document.createElement('textarea');
  textarea.className = 'skill-item__textarea';
  textarea.dataset.field = field;
  textarea.value = value;
  textarea.rows = 2;
  textarea.spellcheck = false;

  labelEl.appendChild(textarea);
  wrapper.appendChild(labelEl);
  return wrapper;
};

export const createSkillItemElement = (index: number, values: SkillFormValues): HTMLElement => {
  const section = document.createElement('section');
  section.className = 'skill-item';
  section.dataset.index = String(index);

  const header = document.createElement('header');
  header.className = 'skill-item__header';

  const legend = document.createElement('h3');
  legend.className = 'skill-item__legend';
  legend.textContent = `スキル ${index + 1}`;
  header.appendChild(legend);

  const removeButton = document.createElement('button');
  removeButton.type = 'button';
  removeButton.className = 'skill-item__remove';
  removeButton.dataset.action = 'remove';
  removeButton.textContent = '削除';
  header.appendChild(removeButton);

  section.appendChild(header);

  section.appendChild(createTextField('スキル名', FIELD_NAME, values.name));
  section.appendChild(createTextField('カテゴリ', FIELD_CATEGORY, values.category));
  section.appendChild(createTextField('レベル', FIELD_LEVEL, values.level));
  section.appendChild(createTextareaField('備考', FIELD_DESCRIPTION, values.description));

  return section;
};

export const readSkillsFromForm = (container: HTMLElement): SkillFormValues[] => {
  const items = container.querySelectorAll<HTMLElement>('[data-index]');
  return Array.from(items).map((itemEl) => {
    const readField = (field: string): string => {
      const el = itemEl.querySelector<HTMLInputElement | HTMLTextAreaElement>(
        `[data-field="${field}"]`,
      );
      return el?.value ?? '';
    };
    return {
      name: readField(FIELD_NAME),
      category: readField(FIELD_CATEGORY),
      level: readField(FIELD_LEVEL),
      description: readField(FIELD_DESCRIPTION),
    };
  });
};

export const populateSkillsForm = (
  container: HTMLElement,
  skills: readonly Skill[] | undefined,
): void => {
  container.replaceChildren();
  const items = skills ?? [];
  items.forEach((item, index) => {
    const element = createSkillItemElement(index, skillToFormValues(item));
    container.appendChild(element);
  });
};
