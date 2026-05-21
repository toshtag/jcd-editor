// jcd-editor (local-web) entry point。
//
// 役割:
//   - sample CareerProfile input を safeParseCareerProfile で runtime 検証
//   - basics 編集 form を提供、入力ごとに raw draft を構築 → parse → success なら render
//   - createDefaultTemplateRegistry + renderDocument で render
//   - iframe.srcdoc に preview として表示 (buildPreviewDocument で完全 HTML 化)
//   - 履歴書 / 職務経歴書 の kind switcher
//
// 制約:
//   - @jcd-editor/pdf は import しない (Playwright は browser bundle に入らない)
//   - localStorage / fetch / file API なし
//   - state library / router / UI library なし
//   - draft は raw input、CareerProfile 型として扱わない (safeParseCareerProfile 経由で type-safe に)
//   - invalid draft は renderer に渡さない (parsed.success === true の時のみ renderDocument を呼ぶ)
//   - invalid draft 時は前回成功 preview を保持、validation issues を画面下部に表示

import { safeParseCareerProfile, type CareerProfile, type ValidationIssue } from '@jcd-editor/core';
import {
  createDefaultTemplateRegistry,
  renderDocument,
  RendererError,
  type DocumentKind,
} from '@jcd-editor/renderer';

import './styles.css';

import { buildPreviewDocument } from './preview-document';
import { buildBasicsFromForm, buildDraft, type BasicsFormValues } from './profile-draft';
import { sampleProfileInput } from './sample-profile';

const requireElement = <T extends Element>(id: string, ctor: new () => T): T => {
  const el = document.getElementById(id);
  if (el === null || !(el instanceof ctor)) {
    throw new Error(`Required element #${id} is missing or has unexpected type.`);
  }
  return el;
};

const previewFrame = requireElement('preview-frame', HTMLIFrameElement);
const kindSelector = requireElement('kind-selector', HTMLSelectElement);
const formEl = requireElement('basics-form', HTMLFormElement);
const validationIssuesPre = requireElement('basics-validation-issues', HTMLPreElement);
const statusEl = document.getElementById('status');
const errorArea = document.getElementById('error-area');

if (statusEl === null || errorArea === null) {
  throw new Error('Required DOM elements are missing in index.html.');
}

const nameFamilyInput = requireElement('name-family', HTMLInputElement);
const nameGivenInput = requireElement('name-given', HTMLInputElement);
const nameKanaFamilyInput = requireElement('name-kana-family', HTMLInputElement);
const nameKanaGivenInput = requireElement('name-kana-given', HTMLInputElement);
const birthDateInput = requireElement('birth-date', HTMLInputElement);
const emailInput = requireElement('email', HTMLInputElement);
const phoneInput = requireElement('phone', HTMLInputElement);
const postalCodeInput = requireElement('postal-code', HTMLInputElement);
const prefectureInput = requireElement('prefecture', HTMLInputElement);
const cityAndRestInput = requireElement('city-and-rest', HTMLInputElement);

const showStatus = (text: string): void => {
  statusEl.textContent = text;
};

const hideError = (): void => {
  errorArea.hidden = true;
  errorArea.textContent = '';
  previewFrame.hidden = false;
};

const showError = (title: string, body: string): void => {
  errorArea.hidden = false;
  errorArea.textContent = `${title}\n\n${body}`;
  previewFrame.hidden = true;
};

const formatIssues = (issues: readonly ValidationIssue[]): string =>
  issues.map((issue) => `- ${issue.path}: ${issue.message}`).join('\n');

const clearValidationIssues = (): void => {
  validationIssuesPre.hidden = true;
  validationIssuesPre.textContent = '';
};

const showValidationIssues = (issues: readonly ValidationIssue[]): void => {
  validationIssuesPre.hidden = false;
  validationIssuesPre.textContent = formatIssues(issues);
};

const readFormValues = (): BasicsFormValues => ({
  nameFamily: nameFamilyInput.value,
  nameGiven: nameGivenInput.value,
  nameKanaFamily: nameKanaFamilyInput.value,
  nameKanaGiven: nameKanaGivenInput.value,
  birthDate: birthDateInput.value,
  email: emailInput.value,
  phone: phoneInput.value,
  postalCode: postalCodeInput.value,
  prefecture: prefectureInput.value,
  cityAndRest: cityAndRestInput.value,
});

const populateForm = (): void => {
  const basics = sampleProfileInput.basics;
  nameFamilyInput.value = basics.name?.family ?? '';
  nameGivenInput.value = basics.name?.given ?? '';
  nameKanaFamilyInput.value = basics.nameKana?.family ?? '';
  nameKanaGivenInput.value = basics.nameKana?.given ?? '';
  birthDateInput.value = basics.birthDate ?? '';
  emailInput.value = basics.email ?? '';
  phoneInput.value = basics.phone ?? '';
  postalCodeInput.value = basics.address?.postalCode ?? '';
  prefectureInput.value = basics.address?.prefecture ?? '';
  cityAndRestInput.value = basics.address?.cityAndRest ?? '';
};

const STATUS_LABELS: Record<DocumentKind, string> = {
  rirekisho: '履歴書を表示中',
  shokumukeirekisho: '職務経歴書を表示中',
};

const STATUS_INVALID = '入力内容にエラーがあります。プレビューは最後に有効だった内容です。';

const parsed = safeParseCareerProfile(sampleProfileInput);
if (!parsed.success) {
  showError('sample fixture が現行 schema を満たしません', formatIssues(parsed.issues));
  showStatus('fixture 不正');
  console.error('sample fixture failed to parse:', parsed.issues);
} else {
  populateForm();

  let profile: CareerProfile = parsed.data;
  let currentKind: DocumentKind = 'rirekisho';
  const registry = createDefaultTemplateRegistry();

  const renderAndUpdate = (kind: DocumentKind): void => {
    try {
      const rendered = renderDocument({ careerProfile: profile, kind }, registry);
      previewFrame.srcdoc = buildPreviewDocument(rendered);
      hideError();
      showStatus(STATUS_LABELS[kind]);
    } catch (error) {
      const message =
        error instanceof RendererError
          ? `${error.code}: ${error.message}`
          : error instanceof Error
            ? error.message
            : String(error);
      showError('レンダリングエラー', message);
      showStatus('レンダリングエラー');
      console.error('renderDocument failed:', error);
    }
  };

  const onFormInput = (): void => {
    const basics = buildBasicsFromForm(readFormValues());
    const draft = buildDraft(basics, sampleProfileInput);
    const result = safeParseCareerProfile(draft);
    if (result.success) {
      profile = result.data;
      clearValidationIssues();
      renderAndUpdate(currentKind);
    } else {
      showValidationIssues(result.issues);
      showStatus(STATUS_INVALID);
      // preview は前回成功状態を保持 (srcdoc 触らない)
    }
  };

  formEl.addEventListener('input', onFormInput);

  kindSelector.addEventListener('change', () => {
    const value = kindSelector.value;
    if (value === 'rirekisho' || value === 'shokumukeirekisho') {
      currentKind = value;
      renderAndUpdate(currentKind);
    }
  });

  renderAndUpdate(currentKind);
}
