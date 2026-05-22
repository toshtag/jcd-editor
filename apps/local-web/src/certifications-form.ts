// Certifications form helpers (apps/local-web)。
//
// 役割:
//   - certifications (資格) の配列を編集する form の helper + DOM factory + DOM reader
//   - work-experiences-form.ts / education-form.ts / skills-form.ts と同じ pattern を踏襲する
//   - DOM 自体を state として扱う: 各 entry は `<section data-index="N">` で表現、
//     内部 input / textarea は `data-field="..."` で identify する
//
// schema (packages/core/src/domain/certification.ts) との対応:
//   - field 7 つすべて optional:
//     name / issuer / acquiredDate / expirationDate / credentialId / credentialUrl / description
//   - acquiredDate / expirationDate は IsoYearMonthString (`YYYY-MM`)。
//     workExperiences と同じく `<input type="month">` で取得する (date 変換は発明しない)
//   - credentialUrl は plain string (URL らしさの判定は schema / UI 側でしない)
//   - cross-field check: acquiredDate <= expirationDate (core 側で判定、UI 側で正規化しない)
//
// 設計判断:
//
// - `CertificationFormValues` は string のみ (boolean / 配列なし)
// - 完全空 entry は flatMap で除外する (workExperiences / education / skills と同規約)
// - DOM 操作は `createElement` + `appendChild` + `replaceChildren` + `textContent` のみ。
//   innerHTML 不使用 (XSS 回避)
// - field 名は const に抽出 (`FIELD_*`)。factory と reader が共有する

import type { Certification } from '@jcd-editor/core';

const FIELD_NAME = 'name';
const FIELD_ISSUER = 'issuer';
const FIELD_ACQUIRED_DATE = 'acquiredDate';
const FIELD_EXPIRATION_DATE = 'expirationDate';
const FIELD_CREDENTIAL_ID = 'credentialId';
const FIELD_CREDENTIAL_URL = 'credentialUrl';
const FIELD_DESCRIPTION = 'description';

export type CertificationFormValues = {
  name: string;
  issuer: string;
  acquiredDate: string;
  expirationDate: string;
  credentialId: string;
  credentialUrl: string;
  description: string;
};

export const emptyCertificationFormValues = (): CertificationFormValues => ({
  name: '',
  issuer: '',
  acquiredDate: '',
  expirationDate: '',
  credentialId: '',
  credentialUrl: '',
  description: '',
});

export const certificationToFormValues = (item: Certification): CertificationFormValues => ({
  name: item.name ?? '',
  issuer: item.issuer ?? '',
  acquiredDate: item.acquiredDate ?? '',
  expirationDate: item.expirationDate ?? '',
  credentialId: item.credentialId ?? '',
  credentialUrl: item.credentialUrl ?? '',
  description: item.description ?? '',
});

export const buildCertificationsFromForm = (
  values: readonly CertificationFormValues[],
): Record<string, unknown>[] =>
  values.flatMap((v) => {
    const item: Record<string, unknown> = {};
    if (v.name.trim() !== '') item.name = v.name;
    if (v.issuer.trim() !== '') item.issuer = v.issuer;
    if (v.acquiredDate.trim() !== '') item.acquiredDate = v.acquiredDate;
    if (v.expirationDate.trim() !== '') item.expirationDate = v.expirationDate;
    if (v.credentialId.trim() !== '') item.credentialId = v.credentialId;
    if (v.credentialUrl.trim() !== '') item.credentialUrl = v.credentialUrl;
    if (v.description.trim() !== '') item.description = v.description;

    // 完全に空の entry (`{}`) は schema 的には valid だが、追加直後の空フォームを
    // draft / 保存に流すと UX 上ノイズになる。何か 1 field でも値があるときのみ残す。
    return Object.keys(item).length > 0 ? [item] : [];
  });

const createTextField = (
  label: string,
  field: string,
  value: string,
  inputType: 'text' | 'month' | 'url',
): HTMLElement => {
  const wrapper = document.createElement('div');
  wrapper.className = 'certification-item__field';

  const labelEl = document.createElement('label');
  labelEl.className = 'certification-item__label';
  labelEl.textContent = label;

  const input = document.createElement('input');
  input.type = inputType;
  input.className = 'certification-item__input';
  input.dataset.field = field;
  input.value = value;
  if (inputType === 'text' || inputType === 'url') {
    input.autocomplete = 'off';
    input.spellcheck = false;
  }

  labelEl.appendChild(input);
  wrapper.appendChild(labelEl);
  return wrapper;
};

const createTextareaField = (label: string, field: string, value: string): HTMLElement => {
  const wrapper = document.createElement('div');
  wrapper.className = 'certification-item__field';

  const labelEl = document.createElement('label');
  labelEl.className = 'certification-item__label';
  labelEl.textContent = label;

  const textarea = document.createElement('textarea');
  textarea.className = 'certification-item__textarea';
  textarea.dataset.field = field;
  textarea.value = value;
  textarea.rows = 2;
  textarea.spellcheck = false;

  labelEl.appendChild(textarea);
  wrapper.appendChild(labelEl);
  return wrapper;
};

const createPeriodRow = (values: CertificationFormValues): HTMLElement => {
  const row = document.createElement('div');
  row.className = 'certification-item__period-row';

  const acquiredWrapper = document.createElement('label');
  acquiredWrapper.className = 'certification-item__label';
  acquiredWrapper.textContent = '取得月';
  const acquiredInput = document.createElement('input');
  acquiredInput.type = 'month';
  acquiredInput.className = 'certification-item__input';
  acquiredInput.dataset.field = FIELD_ACQUIRED_DATE;
  acquiredInput.value = values.acquiredDate;
  acquiredWrapper.appendChild(acquiredInput);
  row.appendChild(acquiredWrapper);

  const expirationWrapper = document.createElement('label');
  expirationWrapper.className = 'certification-item__label';
  expirationWrapper.textContent = '失効月';
  const expirationInput = document.createElement('input');
  expirationInput.type = 'month';
  expirationInput.className = 'certification-item__input';
  expirationInput.dataset.field = FIELD_EXPIRATION_DATE;
  expirationInput.value = values.expirationDate;
  expirationWrapper.appendChild(expirationInput);
  row.appendChild(expirationWrapper);

  return row;
};

// a11y: entry section の SR announce 用 aria-label。
// remove / renumber 時にも更新する (main.ts の renumberCertificationItems 参照)。
export const certificationItemAriaLabel = (index: number): string => `資格 ${index + 1}`;

export const createCertificationItemElement = (
  index: number,
  values: CertificationFormValues,
): HTMLElement => {
  const section = document.createElement('section');
  section.className = 'certification-item';
  section.dataset.index = String(index);
  section.setAttribute('aria-label', certificationItemAriaLabel(index));

  const header = document.createElement('header');
  header.className = 'certification-item__header';

  const legend = document.createElement('h3');
  legend.className = 'certification-item__legend';
  legend.textContent = certificationItemAriaLabel(index);
  header.appendChild(legend);

  const removeButton = document.createElement('button');
  removeButton.type = 'button';
  removeButton.className = 'certification-item__remove';
  removeButton.dataset.action = 'remove';
  removeButton.textContent = '削除';
  header.appendChild(removeButton);

  section.appendChild(header);

  section.appendChild(createTextField('資格名', FIELD_NAME, values.name, 'text'));
  section.appendChild(createTextField('発行機関', FIELD_ISSUER, values.issuer, 'text'));
  section.appendChild(createPeriodRow(values));
  section.appendChild(createTextField('認定 ID', FIELD_CREDENTIAL_ID, values.credentialId, 'text'));
  section.appendChild(
    createTextField('認定 URL', FIELD_CREDENTIAL_URL, values.credentialUrl, 'url'),
  );
  section.appendChild(createTextareaField('備考', FIELD_DESCRIPTION, values.description));

  return section;
};

export const readCertificationsFromForm = (container: HTMLElement): CertificationFormValues[] => {
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
      issuer: readField(FIELD_ISSUER),
      acquiredDate: readField(FIELD_ACQUIRED_DATE),
      expirationDate: readField(FIELD_EXPIRATION_DATE),
      credentialId: readField(FIELD_CREDENTIAL_ID),
      credentialUrl: readField(FIELD_CREDENTIAL_URL),
      description: readField(FIELD_DESCRIPTION),
    };
  });
};

export const populateCertificationsForm = (
  container: HTMLElement,
  certifications: readonly Certification[] | undefined,
): void => {
  container.replaceChildren();
  const items = certifications ?? [];
  items.forEach((item, index) => {
    const element = createCertificationItemElement(index, certificationToFormValues(item));
    container.appendChild(element);
  });
};
