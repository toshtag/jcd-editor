// jcd-editor (local-web) entry point。
//
// 役割:
//   - sample CareerProfile input を safeParseCareerProfile で runtime 検証
//   - 全 6 section の編集 form を提供する:
//     basics (氏名 / 連絡先 / 住所 / 証明写真) / workExperiences / educationHistory
//     / skills / certifications / projects
//   - 入力ごとに raw draft を構築 → safeParseCareerProfile → success なら render
//   - createDefaultTemplateRegistry + renderDocument で render
//   - iframe.srcdoc に preview として表示 (buildPreviewDocument で完全 HTML 化)
//   - 履歴書 / 職務経歴書 の kind switcher
//   - manual Save / Load / Delete via IndexedDB (StoragePort 経由)
//   - JSON export / import (ローカル file 経由、ブラウザ内で完結)
//   - 証明写真の data URI input (File → FileReader.readAsDataURL → core schema 適合)
//   - 未保存変更 (dirty state) の追跡と load / reload / import 前の confirm
//   - validation エラーの構造化表示 (summary + jump button + inline error + aria-*)
//
// 制約:
//   - @jcd-editor/pdf は import しない (Playwright は browser bundle に入らない)
//   - localStorage / sessionStorage / FileSystemAccess / fetch / XMLHttpRequest /
//     WebSocket は使わない (外部送信なし、ローカル完結)
//   - 一方で FileReader / Blob / URL.createObjectURL は明示的に使う
//     (JSON export / import、写真 data URI 化のため、いずれも user 操作起点)
//   - state library / router / UI framework は使わない
//   - IndexedDB API を app source で直接呼ばない (@jcd-editor/storage port 経由)
//   - draft は raw input、CareerProfile 型として扱わない (safeParseCareerProfile 経由で type-safe に)
//   - invalid draft は renderer に渡さない (parsed.success === true の時のみ renderDocument を呼ぶ)
//   - invalid draft 時は前回成功 preview を保持、validation issues は summary + 各 input に inline 表示
//   - 保存対象は last-valid profile のみ (Save button は invalid 中 disable)
//   - DOM 操作は createElement + textContent + replaceChildren のみ、innerHTML 不使用 (XSS 回避)
//
// 配列 section の編集 pattern (workExperiences / educationHistory / skills /
// certifications / projects 共通):
//   - DOM を state として扱う: 各 entry は `<section data-index>` で表現、内部
//     input / textarea / checkbox は `data-field` で identify。JS 側で state を
//     別途持たない。`readXxxFromForm()` で DOM walk して values を取得
//   - UI rebuild は add / remove / load 時のみ、text input 時は rebuild しない
//     (focus 保持)
//   - event delegation: 各 list container に input listener と click listener を
//     1 つずつ
//   - 完全空の entry は `buildXxxFromForm` で除外 (UI には残るが draft / preview /
//     保存対象には流さない、UX ノイズ回避)
//
// 証明写真 (currentPhoto):
//   - basics.profilePhoto は binary 起源で text input pattern に載らないため、
//     form input とは独立に currentPhoto: ProfilePhoto | undefined で保持する
//   - onFormInput で buildBasicsFromForm の結果に merge してから draft を組む
//
// draftBase 問題への対応:
//   - form input 成功時 / load 成功時に draftBase を current profile に update
//   - 初期は sampleProfileInput を base、load 後は loaded profile を base
//   - これにより load 後の form 編集で他 section が sample fixture に戻る重大バグを防止

import {
  safeParseCareerProfile,
  type CareerProfile,
  type ProfilePhoto,
  type ValidationIssue,
} from '@jcd-editor/core';
import {
  createDefaultTemplateRegistry,
  renderDocument,
  RendererError,
  type DocumentKind,
} from '@jcd-editor/renderer';
import { createIndexedDbStorageAdapter, type StoredProfileId } from '@jcd-editor/storage';

import './styles.css';

import { buildPreviewDocument } from './preview-document';
import { buildPrintDocument } from './print-document';
import {
  buildBasicsFromForm,
  buildDraft,
  buildMetaFromForm,
  buildSaveProfileInput,
  type BasicsFormValues,
  type MetaFormValues,
} from './profile-draft';
import { sampleProfileInput } from './sample-profile';
import { formatStoredProfileOption } from './storage-ui';
import {
  buildCertificationsFromForm,
  certificationItemAriaLabel,
  createCertificationItemElement,
  emptyCertificationFormValues,
  populateCertificationsForm,
  readCertificationsFromForm,
} from './certifications-form';
import {
  buildEducationFromForm,
  createEducationItemElement,
  educationItemAriaLabel,
  emptyEducationFormValues,
  populateEducationForm,
  readEducationFromForm,
} from './education-form';
import { buildExportFileName, parseJsonImport, serializeProfileToJson } from './profile-io';
import { validatePhotoFile } from './profile-photo';
import { formatTranslatedIssue } from './validation-labels';
import { buildIssueInputSelector } from './validation-inputs';
import { issueElementId, summarizeIssues } from './validation-summary';
import {
  buildProjectsFromForm,
  createProjectItemElement,
  emptyProjectFormValues,
  populateProjectsForm,
  projectItemAriaLabel,
  readProjectsFromForm,
} from './projects-form';
import {
  buildSkillsFromForm,
  createSkillItemElement,
  emptySkillFormValues,
  populateSkillsForm,
  readSkillsFromForm,
  skillItemAriaLabel,
} from './skills-form';
import {
  buildWorkExperiencesFromForm,
  createWorkExperienceItemElement,
  emptyWorkExperienceFormValues,
  populateWorkExperiencesForm,
  readWorkExperiencesFromForm,
  workExperienceItemAriaLabel,
} from './work-experiences-form';

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
const validationSummaryEl = requireElement('validation-summary', HTMLDivElement);
const validationSummaryList = requireElement('validation-summary-list', HTMLUListElement);
const saveButton = requireElement('save-button', HTMLButtonElement);
const loadButton = requireElement('load-button', HTMLButtonElement);
const deleteButton = requireElement('delete-button', HTMLButtonElement);
const profileSelect = requireElement('saved-profile-select', HTMLSelectElement);
const workExperiencesList = requireElement('work-experiences-list', HTMLDivElement);
const addWorkExperienceButton = requireElement('add-work-experience-button', HTMLButtonElement);
const educationList = requireElement('education-list', HTMLDivElement);
const addEducationButton = requireElement('add-education-button', HTMLButtonElement);
const skillsList = requireElement('skills-list', HTMLDivElement);
const addSkillButton = requireElement('add-skill-button', HTMLButtonElement);
const certificationsList = requireElement('certifications-list', HTMLDivElement);
const addCertificationButton = requireElement('add-certification-button', HTMLButtonElement);
const projectsList = requireElement('projects-list', HTMLDivElement);
const addProjectButton = requireElement('add-project-button', HTMLButtonElement);
const exportButton = requireElement('export-button', HTMLButtonElement);
const importFileInput = requireElement('import-file-input', HTMLInputElement);
const printButton = requireElement('print-button', HTMLButtonElement);
const profilePhotoInput = requireElement('profile-photo-input', HTMLInputElement);
const profilePhotoRemoveButton = requireElement('profile-photo-remove-button', HTMLButtonElement);
const profilePhotoThumbnail = requireElement('profile-photo-thumbnail', HTMLImageElement);
const profilePhotoPlaceholder = requireElement('profile-photo-placeholder', HTMLSpanElement);
const profilePhotoError = requireElement('profile-photo-error', HTMLParagraphElement);
const statusEl = document.getElementById('status');
const errorArea = document.getElementById('error-area');
const dirtyIndicator = document.getElementById('dirty-indicator');

if (statusEl === null || errorArea === null || dirtyIndicator === null) {
  throw new Error('Required DOM elements are missing in index.html.');
}

const nameFamilyInput = requireElement('name-family', HTMLInputElement);
const nameGivenInput = requireElement('name-given', HTMLInputElement);
const nameKanaFamilyInput = requireElement('name-kana-family', HTMLInputElement);
const nameKanaGivenInput = requireElement('name-kana-given', HTMLInputElement);
const birthDateInput = requireElement('birth-date', HTMLInputElement);
const genderInput = requireElement('gender', HTMLInputElement);
const emailInput = requireElement('email', HTMLInputElement);
const phoneInput = requireElement('phone', HTMLInputElement);
const addressKanaInput = requireElement('address-kana', HTMLInputElement);
const postalCodeInput = requireElement('postal-code', HTMLInputElement);
const prefectureInput = requireElement('prefecture', HTMLInputElement);
const cityAndRestInput = requireElement('city-and-rest', HTMLInputElement);
const contactAddressKanaInput = requireElement('contact-address-kana', HTMLInputElement);
const contactPostalCodeInput = requireElement('contact-postal-code', HTMLInputElement);
const contactPrefectureInput = requireElement('contact-prefecture', HTMLInputElement);
const contactCityAndRestInput = requireElement('contact-city-and-rest', HTMLInputElement);
const contactPhoneInput = requireElement('contact-phone', HTMLInputElement);
const summaryInput = requireElement('summary', HTMLTextAreaElement);
const personalRequestInput = requireElement('personal-request', HTMLTextAreaElement);
const preparedOnInput = requireElement('prepared-on', HTMLInputElement);

// === Phase 2.1b WYSIWYG エディタ ===
//
// 履歴書 kind 選択時のみ visible になる WYSIWYG container。renderer
// (editable=true) の出力 HTML をそのまま innerHTML として注入する。
// 各 [data-field] が contenteditable="plaintext-only" になっており、ユーザーが
// 直接タイプして CareerProfile を更新できる。
const wysiwygPane = requireElement('wysiwyg-editor', HTMLElement);
const addHistoryRowButton = requireElement('add-history-row-button', HTMLButtonElement);
const addCertificationRowButton = requireElement('add-certification-row-button', HTMLButtonElement);

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
  issues.map(formatTranslatedIssue).join('\n');

// aria-invalid / aria-describedby を付けた input element を覚えておき、次回
// issues 更新時に一括 clear する。本 Set は「主に self が触った input」を
// 表す: clear するときも removeAttribute('aria-invalid') と removeAttribute
// ('aria-describedby') を同じ Set 経由で行うことで、自分が触ったものだけを
// 戻す (将来 hint 用の describedby が別系統で付いたときに上書き合戦に
// ならないように)。
const currentInvalidInputs = new Set<HTMLElement>();

// inline error <p> として挿入した element を覚えておき、次回 issues 更新時に
// remove する。これらは self が createElement で作って append した element
// なので、参照を保持していれば確実に remove できる。
const currentInlineErrorEls = new Set<HTMLElement>();

// input 直上の wrapper class 一覧。closest で input が属する wrapper を
// 探すのに使う。basics + 各 section entry の field wrapper を網羅する。
// profile-photo は別個の error 領域 (profile-photo-error) を持つため対象外
// (CareerProfile schema validation は summary + aria-describedby で対応)。
const FIELD_WRAPPER_SELECTOR = [
  '.basics-form__field',
  '.work-experience-item__field',
  '.education-item__field',
  '.skill-item__field',
  '.certification-item__field',
  '.project-item__field',
].join(', ');

const clearInlineErrors = (): void => {
  for (const el of currentInlineErrorEls) {
    el.remove();
  }
  currentInlineErrorEls.clear();
};

const renderInlineError = (input: HTMLElement, messages: readonly string[]): void => {
  const wrapper = input.closest(FIELD_WRAPPER_SELECTOR);
  if (wrapper === null) return; // wrapper 不在は profile-photo input 等
  const errorEl = document.createElement('p');
  errorEl.className = 'field-error';
  // 同 input に複数 issue がある場合は「 / 」で連結 (改行は CSS で扱わない)
  errorEl.textContent = messages.join(' / ');
  wrapper.appendChild(errorEl);
  currentInlineErrorEls.add(errorEl);
};

const clearInvalidInputMarks = (): void => {
  for (const el of currentInvalidInputs) {
    el.removeAttribute('aria-invalid');
    el.removeAttribute('aria-describedby');
  }
  currentInvalidInputs.clear();
  clearInlineErrors();
};

const markInputsInvalid = (issues: readonly ValidationIssue[]): void => {
  clearInvalidInputMarks();
  // selector ごとに、対応する summary item id とメッセージを集める。
  // - ids: aria-describedby に半角 space 区切りで全 id を出す
  // - messages: input 直下に inline 表示する (同 input 複数 issue は連結)
  const selectorToIds = new Map<string, string[]>();
  const selectorToMessages = new Map<string, string[]>();
  issues.forEach((issue, index) => {
    const selector = buildIssueInputSelector(issue.path);
    if (selector === null) return;
    const id = issueElementId(index);
    const existingIds = selectorToIds.get(selector);
    if (existingIds === undefined) {
      selectorToIds.set(selector, [id]);
    } else {
      existingIds.push(id);
    }
    const existingMessages = selectorToMessages.get(selector);
    if (existingMessages === undefined) {
      selectorToMessages.set(selector, [issue.message]);
    } else {
      existingMessages.push(issue.message);
    }
  });

  for (const [selector, ids] of selectorToIds) {
    const el = document.querySelector(selector);
    if (el instanceof HTMLElement) {
      el.setAttribute('aria-invalid', 'true');
      el.setAttribute('aria-describedby', ids.join(' '));
      currentInvalidInputs.add(el);
      const messages = selectorToMessages.get(selector) ?? [];
      renderInlineError(el, messages);
    }
  }
};

const clearValidationIssues = (): void => {
  validationSummaryEl.hidden = true;
  validationSummaryList.replaceChildren();
  clearInvalidInputMarks();
};

const showValidationIssues = (issues: readonly ValidationIssue[]): void => {
  validationSummaryEl.hidden = false;
  const summaries = summarizeIssues(issues);
  const items = summaries.map((summary, index) => {
    const id = issueElementId(index);
    const li = document.createElement('li');
    li.className = 'validation-summary__item';
    if (summary.anchor === null) {
      // jump 不能 (schemaVersion / 未知 path): plain text のみ
      const span = document.createElement('span');
      span.id = id;
      span.className = 'validation-summary__static';
      span.textContent = `${summary.pathLabel}: ${summary.message}`;
      li.appendChild(span);
    } else {
      const button = document.createElement('button');
      button.type = 'button';
      button.id = id;
      button.className = 'validation-summary__jump';
      button.dataset.validationAnchor = summary.anchor.selector;
      button.textContent = `${summary.pathLabel}: ${summary.message}`;
      li.appendChild(button);
    }
    return li;
  });
  validationSummaryList.replaceChildren(...items);
  markInputsInvalid(issues);
};

// summary list 内の jump button をクリックすると、該当 section / entry へ
// scroll する。event delegation で list 全体に listener 1 つ。
validationSummaryList.addEventListener('click', (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  const button = target.closest<HTMLButtonElement>('button[data-validation-anchor]');
  if (button === null) return;
  const selector = button.dataset.validationAnchor;
  if (selector === undefined || selector === '') return;
  const destination = document.querySelector(selector);
  if (destination !== null && destination instanceof HTMLElement) {
    destination.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
});

const readFormValues = (): BasicsFormValues => ({
  nameFamily: nameFamilyInput.value,
  nameGiven: nameGivenInput.value,
  nameKanaFamily: nameKanaFamilyInput.value,
  nameKanaGiven: nameKanaGivenInput.value,
  birthDate: birthDateInput.value,
  gender: genderInput.value,
  email: emailInput.value,
  phone: phoneInput.value,
  postalCode: postalCodeInput.value,
  prefecture: prefectureInput.value,
  cityAndRest: cityAndRestInput.value,
  addressKana: addressKanaInput.value,
  contactPostalCode: contactPostalCodeInput.value,
  contactPrefecture: contactPrefectureInput.value,
  contactCityAndRest: contactCityAndRestInput.value,
  contactAddressKana: contactAddressKanaInput.value,
  contactPhone: contactPhoneInput.value,
  summary: summaryInput.value,
  personalRequest: personalRequestInput.value,
});

const readMetaFormValues = (): MetaFormValues => ({
  preparedOn: preparedOnInput.value,
});

const populateForm = (basics: CareerProfile['basics']): void => {
  nameFamilyInput.value = basics.name?.family ?? '';
  nameGivenInput.value = basics.name?.given ?? '';
  nameKanaFamilyInput.value = basics.nameKana?.family ?? '';
  nameKanaGivenInput.value = basics.nameKana?.given ?? '';
  birthDateInput.value = basics.birthDate ?? '';
  genderInput.value = basics.gender ?? '';
  emailInput.value = basics.email ?? '';
  phoneInput.value = basics.phone ?? '';
  postalCodeInput.value = basics.address?.postalCode ?? '';
  prefectureInput.value = basics.address?.prefecture ?? '';
  cityAndRestInput.value = basics.address?.cityAndRest ?? '';
  addressKanaInput.value = basics.addressKana ?? '';
  contactPostalCodeInput.value = basics.contactAddress?.postalCode ?? '';
  contactPrefectureInput.value = basics.contactAddress?.prefecture ?? '';
  contactCityAndRestInput.value = basics.contactAddress?.cityAndRest ?? '';
  contactAddressKanaInput.value = basics.contactAddressKana ?? '';
  contactPhoneInput.value = basics.contactPhone ?? '';
  summaryInput.value = basics.summary ?? '';
  personalRequestInput.value = basics.personalRequest ?? '';
};

const populateMetaForm = (meta: CareerProfile['meta']): void => {
  preparedOnInput.value = meta?.preparedOn ?? '';
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
  let profile: CareerProfile = parsed.data;
  let currentKind: DocumentKind = 'rirekisho';
  let currentProfileId: StoredProfileId | undefined;
  let draftBase: Record<string, unknown> = sampleProfileInput;
  let isCurrentDraftValid = true;
  let isStorageBusy = false;
  // isDirty: form 内容が「最後の save / load / import 成功時点」から変化したか。
  // 初期 mount 時 (sample fixture) は false。user 入力で true、save / load /
  // import 成功時に false に戻る。invalid draft 中も dirty 判定は維持する
  // (input 自体が user の保存意図とは独立)。
  let isDirty = false;

  // currentPhoto: basics.profilePhoto を form input とは独立に保持する。
  // 理由: photo は binary 起源 (File → dataUri) で、テキスト input パターンに
  // 載らない。`buildBasicsFromForm` は触らず、onFormInput で basics に merge
  // する形を取る。
  let currentPhoto: ProfilePhoto | undefined;

  // === Profile photo helpers ===
  // populateAll が updatePhotoThumbnail / hidePhotoError を参照するため、
  // populateAll の定義より前で宣言する必要がある (TDZ 回避)。

  const showPhotoError = (message: string): void => {
    profilePhotoError.hidden = false;
    profilePhotoError.textContent = message;
  };

  const hidePhotoError = (): void => {
    profilePhotoError.hidden = true;
    profilePhotoError.textContent = '';
  };

  const updatePhotoThumbnail = (): void => {
    if (currentPhoto?.source?.kind === 'dataUri') {
      profilePhotoThumbnail.src = currentPhoto.source.dataUri;
      profilePhotoThumbnail.alt = currentPhoto.altText ?? '証明写真';
      profilePhotoThumbnail.hidden = false;
      profilePhotoPlaceholder.hidden = true;
      profilePhotoRemoveButton.disabled = false;
    } else {
      profilePhotoThumbnail.removeAttribute('src');
      profilePhotoThumbnail.hidden = true;
      profilePhotoPlaceholder.hidden = false;
      profilePhotoRemoveButton.disabled = true;
    }
  };

  const readFileAsDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(reader.error ?? new Error('FileReader error'));
      reader.onload = () => {
        const text = typeof reader.result === 'string' ? reader.result : '';
        resolve(text);
      };
      reader.readAsDataURL(file);
    });

  const registry = createDefaultTemplateRegistry();
  const storage = createIndexedDbStorageAdapter();

  const populateAll = (loaded: CareerProfile): void => {
    populateForm(loaded.basics);
    populateMetaForm(loaded.meta);
    populateWorkExperiencesForm(workExperiencesList, loaded.workExperiences);
    populateEducationForm(educationList, loaded.educationHistory);
    populateSkillsForm(skillsList, loaded.skills);
    populateCertificationsForm(certificationsList, loaded.certifications);
    populateProjectsForm(projectsList, loaded.projects);
    currentPhoto = loaded.basics.profilePhoto;
    profilePhotoInput.value = '';
    hidePhotoError();
    updatePhotoThumbnail();
  };

  populateAll(profile);

  /**
   * WYSIWYG pane を再描画する。kind=rirekisho の場合に呼ばれる。
   * 設計: renderer の出力 (escapeHtml 済み) を DOMParser で parse → childNodes
   * を replaceChildren で wysiwygPane に置く (innerHTML 不使用、コードベース
   * ポリシー遵守)。DOMParser は script を実行しないので safe。
   * 入力中の cursor 保持のため、active 要素の data-field を覚えて再描画後に
   * focus 復帰する。
   */
  const renderWysiwyg = (): void => {
    const rendered = renderDocument(
      { careerProfile: profile, kind: 'rirekisho', editable: true },
      registry,
    );
    const activeField =
      document.activeElement instanceof HTMLElement
        ? document.activeElement.getAttribute('data-field')
        : null;
    const parser = new DOMParser();
    const doc = parser.parseFromString(
      `<!doctype html><html><head><style>${rendered.css}</style></head><body>${rendered.html}</body></html>`,
      'text/html',
    );
    const style = doc.head.querySelector('style');
    const article = doc.body.firstElementChild;
    if (style === null || article === null) {
      throw new Error('renderer output could not be parsed for WYSIWYG pane');
    }
    const importedStyle = document.importNode(style, true);
    const importedArticle = document.importNode(article, true);
    wysiwygPane.replaceChildren(importedStyle, importedArticle);
    if (activeField !== null) {
      const target = wysiwygPane.querySelector<HTMLElement>(`[data-field="${activeField}"]`);
      if (target !== null) {
        target.focus();
        const range = document.createRange();
        range.selectNodeContents(target);
        range.collapse(false);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
    }
  };

  const renderAndUpdate = (kind: DocumentKind): void => {
    try {
      // preview iframe は両 kind で常時更新する (履歴書 kind では WYSIWYG editor
      // との比較確認のために残す、職務経歴書 kind では従来通り)。
      const rendered = renderDocument({ careerProfile: profile, kind }, registry);
      previewFrame.srcdoc = buildPreviewDocument(rendered);

      // WYSIWYG editor は履歴書 kind のときだけ visible にする (editable HTML
      // を直接 DOM 注入)。職務経歴書 kind では編集形式が異なるので隠す。
      // 学歴・職歴 / 資格 の「1 行追加」 ボタンは編集モデル変更 (常に 公式罫線
      // 行数 20 / 6 を全て編集可能として表示) により不要になったので常に hidden
      // のまま (HTML の hidden 属性を維持)。将来的に列追加・削除 UI が必要に
      // なれば再有効化する。
      if (kind === 'rirekisho') {
        wysiwygPane.hidden = false;
        renderWysiwyg();
      } else {
        wysiwygPane.hidden = true;
      }

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

  const updateButtonStates = (): void => {
    saveButton.disabled = !isCurrentDraftValid || isStorageBusy;
    loadButton.disabled = profileSelect.value === '' || isStorageBusy;
    deleteButton.disabled = profileSelect.value === '' || isStorageBusy;
  };

  const updateDirtyIndicator = (): void => {
    dirtyIndicator.hidden = !isDirty;
  };

  const markDirty = (): void => {
    if (!isDirty) {
      isDirty = true;
      updateDirtyIndicator();
    }
  };

  const markClean = (): void => {
    if (isDirty) {
      isDirty = false;
      updateDirtyIndicator();
    }
  };

  const handleStorageError = (error: unknown, userMessage: string): void => {
    const detail = error instanceof Error ? error.message : String(error);
    showError(userMessage, detail);
    // profile data は log しない (privacy)
    console.error(`storage operation failed: ${userMessage}`);
  };

  const refreshSavedProfileList = async (): Promise<void> => {
    try {
      const list = await storage.listProfiles();
      // replaceChildren() で安全に既存 option を全削除 (innerHTML 不使用、XSS 回避)
      profileSelect.replaceChildren();

      const placeholder = document.createElement('option');
      placeholder.value = '';
      placeholder.textContent =
        list.length === 0 ? '保存済みプロフィールはありません' : '(選択してください)';
      profileSelect.appendChild(placeholder);

      for (const metadata of list) {
        const option = document.createElement('option');
        option.value = metadata.id;
        option.textContent = formatStoredProfileOption(metadata);
        profileSelect.appendChild(option);
      }
    } catch (error) {
      handleStorageError(error, '保存済みプロフィール一覧の取得に失敗しました');
    }
  };

  const onFormInput = (): void => {
    // user 入力は常に dirty 判定。invalid draft 中も維持する。
    markDirty();
    const basics = buildBasicsFromForm(readFormValues());
    if (currentPhoto !== undefined) {
      (basics as Record<string, unknown>).profilePhoto = currentPhoto;
    }
    const workExperiences = buildWorkExperiencesFromForm(
      readWorkExperiencesFromForm(workExperiencesList),
    );
    const educationHistory = buildEducationFromForm(readEducationFromForm(educationList));
    const skills = buildSkillsFromForm(readSkillsFromForm(skillsList));
    const certifications = buildCertificationsFromForm(
      readCertificationsFromForm(certificationsList),
    );
    const projects = buildProjectsFromForm(readProjectsFromForm(projectsList));
    const meta = buildMetaFromForm(readMetaFormValues());
    const draft = buildDraft(
      {
        basics,
        workExperiences,
        educationHistory,
        skills,
        certifications,
        projects,
        ...(meta !== undefined ? { meta } : {}),
      },
      draftBase,
    );
    const result = safeParseCareerProfile(draft);
    if (result.success) {
      profile = result.data;
      draftBase = result.data as unknown as Record<string, unknown>;
      isCurrentDraftValid = true;
      clearValidationIssues();
      renderAndUpdate(currentKind);
    } else {
      isCurrentDraftValid = false;
      showValidationIssues(result.issues);
      showStatus(STATUS_INVALID);
      // preview は前回成功状態を保持 (srcdoc 触らない)
    }
    updateButtonStates();
  };

  const onPhotoSelected = async (file: File): Promise<void> => {
    hidePhotoError();
    const validation = validatePhotoFile(file);
    if (!validation.ok) {
      showPhotoError(validation.message);
      return;
    }
    let dataUri: string;
    try {
      dataUri = await readFileAsDataUrl(file);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      showPhotoError(`ファイル読み込みに失敗しました: ${detail}`);
      return;
    }
    // file.type は事前検証で 'image/jpeg' | 'image/png' のみ通過済み。
    const mediaType = file.type as 'image/jpeg' | 'image/png';
    currentPhoto = { source: { kind: 'dataUri', dataUri, mediaType } };
    updatePhotoThumbnail();
    onFormInput();
    // a11y: 写真選択直後の典型的な次操作は「気に入らなければ削除」。
    // 削除ボタンに focus を移す。
    profilePhotoRemoveButton.focus();
  };

  const onPhotoRemove = (): void => {
    if (currentPhoto === undefined) return;
    currentPhoto = undefined;
    hidePhotoError();
    updatePhotoThumbnail();
    onFormInput();
    // a11y: 削除直後は削除ボタンが disabled になるため、focus を選択 file
    // input に戻す (label が clickable wrapper として動作する)。
    profilePhotoInput.focus();
  };

  const onSave = async (): Promise<void> => {
    if (!isCurrentDraftValid || isStorageBusy) return;
    isStorageBusy = true;
    updateButtonStates();
    try {
      const input = buildSaveProfileInput(profile, currentProfileId);
      const stored = await storage.saveProfile(input);
      currentProfileId = stored.metadata.id;
      await refreshSavedProfileList();
      profileSelect.value = currentProfileId;
      markClean();
      showStatus('保存しました');
    } catch (error) {
      handleStorageError(error, '保存に失敗しました');
    } finally {
      isStorageBusy = false;
      updateButtonStates();
    }
  };

  const onExport = (): void => {
    // 計画準拠: export 対象は preview 対象 profile (= 最後に valid だった profile)。
    // 未保存変更も含む。invalid 状態では download せずエラー表示。
    if (!isCurrentDraftValid) {
      showError(
        'export できません',
        'form に validation エラーがあります。修正後に再度お試しください。',
      );
      showStatus('export 失敗 (validation エラー)');
      return;
    }
    const text = serializeProfileToJson(profile);
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = buildExportFileName(currentProfileId, new Date());
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
    showStatus('JSON を export しました');
  };

  /**
   * 現在の kind / profile を renderer で描画し、新規 window/tab に Blob URL で
   * 開いて自動的に print dialog を起動する。ユーザーは print dialog 内で
   * 「PDF として保存」 を選ぶことで PDF を取得する (OS の標準機能)。
   *
   * 設計:
   *   - editable=false で render (PDF 出力時は contenteditable 属性を付けない)
   *   - Blob URL を window.open に渡す (data: URL より大きな HTML に強い)
   *   - 新 window 内の <script> が onload → window.print() → afterprint → close
   *     の流れを担当 (buildPrintDocument 参照)
   *   - popup blocker 回避のため、click handler の同期実行内で window.open を
   *     呼ぶ
   *   - URL.revokeObjectURL は新 window が読み込み終わってから (一定時間後)
   */
  const onPrint = (kind: DocumentKind): void => {
    if (!isCurrentDraftValid) {
      showError(
        'PDF 出力できません',
        'form に validation エラーがあります。修正後に再度お試しください。',
      );
      showStatus('PDF 出力失敗 (validation エラー)');
      return;
    }
    try {
      const rendered = renderDocument({ careerProfile: profile, kind }, registry);
      const html = buildPrintDocument(rendered);
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const win = window.open(url, '_blank');
      if (win === null) {
        URL.revokeObjectURL(url);
        showError(
          'PDF 出力できません',
          'ブラウザの popup blocker が新しいタブを開くのをブロックしました。ポップアップを許可してから再度お試しください。',
        );
        showStatus('PDF 出力失敗 (popup ブロック)');
        return;
      }
      // 新 window が Blob URL を fetch し終わるまでの余裕を持って revoke する。
      // 短すぎると新 window 側で load 前に URL が破棄されて空ページになる。
      window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
      showStatus('PDF 出力 (印刷ダイアログ)');
    } catch (error) {
      const message =
        error instanceof RendererError
          ? `${error.code}: ${error.message}`
          : error instanceof Error
            ? error.message
            : String(error);
      showError('PDF 出力エラー', message);
      showStatus('PDF 出力失敗 (レンダリングエラー)');
      console.error('print render failed:', error);
    }
  };

  const readFileAsText = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(reader.error ?? new Error('FileReader error'));
      reader.onload = () => {
        const text = typeof reader.result === 'string' ? reader.result : '';
        resolve(text);
      };
      reader.readAsText(file);
    });

  const onImportFile = async (file: File): Promise<void> => {
    let text: string;
    try {
      text = await readFileAsText(file);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      showError('ファイル読み込みに失敗しました', detail);
      showStatus('import 失敗');
      return;
    }

    const result = parseJsonImport(text);
    if (!result.ok) {
      if (result.kind === 'invalid-json') {
        showError('JSON の解析に失敗しました', result.message);
      } else {
        showError('JSON が schema と一致しません', formatIssues(result.issues));
      }
      showStatus('import 失敗');
      return;
    }

    // 計画準拠: 上書き確認必須。現在 draft は破棄される旨を明示。
    const confirmed = window.confirm(
      '現在の編集内容は import 後の profile で上書きされ、新しい保存済み profile として保存されます。続行しますか?',
    );
    if (!confirmed) {
      showStatus('import をキャンセルしました');
      return;
    }

    profile = result.profile;
    // import された profile は別 entity として扱う (新規 id で保存)
    currentProfileId = undefined;
    draftBase = result.profile as unknown as Record<string, unknown>;
    isCurrentDraftValid = true;
    populateAll(result.profile);
    clearValidationIssues();
    renderAndUpdate(currentKind);

    // 既存の saveProfile で永続化
    isStorageBusy = true;
    updateButtonStates();
    try {
      const input = buildSaveProfileInput(profile, currentProfileId);
      const stored = await storage.saveProfile(input);
      currentProfileId = stored.metadata.id;
      await refreshSavedProfileList();
      profileSelect.value = currentProfileId;
      markClean();
      showStatus('import して保存しました');
      // a11y: import 後は新しい profile を編集するのが自然な動線。form 先頭に focus
      nameFamilyInput.focus();
    } catch (error) {
      handleStorageError(error, 'import 後の保存に失敗しました');
    } finally {
      isStorageBusy = false;
      updateButtonStates();
    }
  };

  const onLoad = async (): Promise<void> => {
    if (isStorageBusy) return;
    const id = profileSelect.value;
    if (id === '') return;

    // 未保存変更があれば確認してから上書きする (load は form 内容を完全に
    // 置き換えるため、user の編集が失われる経路)。
    if (isDirty) {
      const confirmed = window.confirm(
        '未保存の変更があります。読み込むと現在の編集内容は失われます。続行しますか?',
      );
      if (!confirmed) {
        showStatus('読み込みをキャンセルしました');
        return;
      }
    }

    isStorageBusy = true;
    updateButtonStates();
    try {
      const stored = await storage.loadProfile(id);
      profile = stored.profile;
      currentProfileId = stored.metadata.id;
      draftBase = stored.profile as unknown as Record<string, unknown>;
      isCurrentDraftValid = true;
      populateAll(stored.profile);
      clearValidationIssues();
      renderAndUpdate(currentKind);
      markClean();
      showStatus('保存済みプロフィールを読み込みました');
      // a11y: 読み込み後は form 編集を始めることが多いため、form 先頭に focus
      nameFamilyInput.focus();
    } catch (error) {
      handleStorageError(error, '読み込みに失敗しました');
    } finally {
      isStorageBusy = false;
      updateButtonStates();
    }
  };

  const onDelete = async (): Promise<void> => {
    if (isStorageBusy) return;
    const id = profileSelect.value;
    if (id === '') return;

    // 削除対象の label を dropdown の表示文字列から取得する (ユーザーが見ている
    // のと同じ表現を confirm に出す)。option がない異常系では id を fallback。
    const selectedOption = profileSelect.options[profileSelect.selectedIndex];
    const label = selectedOption?.textContent ?? id;

    // undo なし。confirm 文言で明示する。
    const confirmed = window.confirm(
      `「${label}」を削除します。この操作は取り消せません。続行しますか?`,
    );
    if (!confirmed) {
      showStatus('削除をキャンセルしました');
      return;
    }

    isStorageBusy = true;
    updateButtonStates();
    try {
      await storage.deleteProfile(id);
      // 削除した profile が現在編集中のものなら、id を切り離して未保存 draft に
      // する (form / preview は維持: ユーザーが内容を別 profile として再保存
      // したいかもしれない)。
      if (currentProfileId === id) {
        currentProfileId = undefined;
      }
      await refreshSavedProfileList();
      profileSelect.value = '';
      showStatus('プロフィールを削除しました');
      // a11y: 削除後は delete-button が disabled になるため、focus を
      // profileSelect に移して次の選択に進めるようにする。
      profileSelect.focus();
    } catch (error) {
      handleStorageError(error, '削除に失敗しました');
    } finally {
      isStorageBusy = false;
      updateButtonStates();
    }
  };

  const renumberWorkExperienceItems = (): void => {
    workExperiencesList.querySelectorAll<HTMLElement>('[data-index]').forEach((el, i) => {
      el.dataset.index = String(i);
      const label = workExperienceItemAriaLabel(i);
      el.setAttribute('aria-label', label);
      const legend = el.querySelector('.work-experience-item__legend');
      if (legend !== null) {
        legend.textContent = label;
      }
    });
  };

  const renumberEducationItems = (): void => {
    educationList.querySelectorAll<HTMLElement>('[data-index]').forEach((el, i) => {
      el.dataset.index = String(i);
      const label = educationItemAriaLabel(i);
      el.setAttribute('aria-label', label);
      const legend = el.querySelector('.education-item__legend');
      if (legend !== null) {
        legend.textContent = label;
      }
    });
  };

  const renumberSkillItems = (): void => {
    skillsList.querySelectorAll<HTMLElement>('[data-index]').forEach((el, i) => {
      el.dataset.index = String(i);
      const label = skillItemAriaLabel(i);
      el.setAttribute('aria-label', label);
      const legend = el.querySelector('.skill-item__legend');
      if (legend !== null) {
        legend.textContent = label;
      }
    });
  };

  const renumberCertificationItems = (): void => {
    certificationsList.querySelectorAll<HTMLElement>('[data-index]').forEach((el, i) => {
      el.dataset.index = String(i);
      const label = certificationItemAriaLabel(i);
      el.setAttribute('aria-label', label);
      const legend = el.querySelector('.certification-item__legend');
      if (legend !== null) {
        legend.textContent = label;
      }
    });
  };

  const renumberProjectItems = (): void => {
    projectsList.querySelectorAll<HTMLElement>('[data-index]').forEach((el, i) => {
      el.dataset.index = String(i);
      const label = projectItemAriaLabel(i);
      el.setAttribute('aria-label', label);
      const legend = el.querySelector('.project-item__legend');
      if (legend !== null) {
        legend.textContent = label;
      }
    });
  };

  formEl.addEventListener('input', onFormInput);
  workExperiencesList.addEventListener('input', onFormInput);
  workExperiencesList.addEventListener('change', onFormInput);
  educationList.addEventListener('input', onFormInput);
  educationList.addEventListener('change', onFormInput);
  skillsList.addEventListener('input', onFormInput);
  skillsList.addEventListener('change', onFormInput);
  certificationsList.addEventListener('input', onFormInput);
  certificationsList.addEventListener('change', onFormInput);
  projectsList.addEventListener('input', onFormInput);
  projectsList.addEventListener('change', onFormInput);

  workExperiencesList.addEventListener('click', (e) => {
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.dataset.action !== 'remove') return;
    const item = target.closest<HTMLElement>('[data-index]');
    if (item === null) return;
    item.remove();
    renumberWorkExperienceItems();
    onFormInput();
  });

  educationList.addEventListener('click', (e) => {
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.dataset.action !== 'remove') return;
    const item = target.closest<HTMLElement>('[data-index]');
    if (item === null) return;
    item.remove();
    renumberEducationItems();
    onFormInput();
  });

  skillsList.addEventListener('click', (e) => {
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.dataset.action !== 'remove') return;
    const item = target.closest<HTMLElement>('[data-index]');
    if (item === null) return;
    item.remove();
    renumberSkillItems();
    onFormInput();
  });

  certificationsList.addEventListener('click', (e) => {
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.dataset.action !== 'remove') return;
    const item = target.closest<HTMLElement>('[data-index]');
    if (item === null) return;
    item.remove();
    renumberCertificationItems();
    onFormInput();
  });

  projectsList.addEventListener('click', (e) => {
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.dataset.action !== 'remove') return;
    const item = target.closest<HTMLElement>('[data-index]');
    if (item === null) return;
    item.remove();
    renumberProjectItems();
    onFormInput();
  });

  addWorkExperienceButton.addEventListener('click', () => {
    const currentCount = workExperiencesList.querySelectorAll('[data-index]').length;
    const element = createWorkExperienceItemElement(currentCount, emptyWorkExperienceFormValues());
    workExperiencesList.appendChild(element);
    onFormInput();
  });

  addEducationButton.addEventListener('click', () => {
    const currentCount = educationList.querySelectorAll('[data-index]').length;
    const element = createEducationItemElement(currentCount, emptyEducationFormValues());
    educationList.appendChild(element);
    onFormInput();
  });

  addSkillButton.addEventListener('click', () => {
    const currentCount = skillsList.querySelectorAll('[data-index]').length;
    const element = createSkillItemElement(currentCount, emptySkillFormValues());
    skillsList.appendChild(element);
    onFormInput();
  });

  addCertificationButton.addEventListener('click', () => {
    const currentCount = certificationsList.querySelectorAll('[data-index]').length;
    const element = createCertificationItemElement(currentCount, emptyCertificationFormValues());
    certificationsList.appendChild(element);
    onFormInput();
  });

  addProjectButton.addEventListener('click', () => {
    const currentCount = projectsList.querySelectorAll('[data-index]').length;
    const element = createProjectItemElement(currentCount, emptyProjectFormValues());
    projectsList.appendChild(element);
    onFormInput();
  });

  kindSelector.addEventListener('change', () => {
    const value = kindSelector.value;
    if (value === 'rirekisho' || value === 'shokumukeirekisho') {
      currentKind = value;
      renderAndUpdate(currentKind);
    }
  });

  saveButton.addEventListener('click', () => {
    void onSave();
  });

  loadButton.addEventListener('click', () => {
    void onLoad();
  });

  deleteButton.addEventListener('click', () => {
    void onDelete();
  });

  profileSelect.addEventListener('change', updateButtonStates);

  exportButton.addEventListener('click', () => {
    onExport();
  });

  printButton.addEventListener('click', () => {
    onPrint(currentKind);
  });

  importFileInput.addEventListener('change', () => {
    const file = importFileInput.files?.[0];
    if (file === undefined) return;
    // 同じファイルを再度選択できるよう、処理後に input をリセット
    void onImportFile(file).finally(() => {
      importFileInput.value = '';
    });
  });

  profilePhotoInput.addEventListener('change', () => {
    const file = profilePhotoInput.files?.[0];
    if (file === undefined) return;
    // 同じファイルを再度選択できるよう、処理後に input をリセット
    void onPhotoSelected(file).finally(() => {
      profilePhotoInput.value = '';
    });
  });

  profilePhotoRemoveButton.addEventListener('click', () => {
    onPhotoRemove();
  });

  // ページリロード / タブ閉じ時に未保存変更があれば browser の標準確認 dialog を
  // 表示する。最新ブラウザはカスタム message を表示しない (browser 既定文言)
  // が、確認 dialog 自体は出る。
  window.addEventListener('beforeunload', (e) => {
    if (isDirty) {
      e.preventDefault();
      // 一部 browser 互換のため returnValue にも空文字をセットする。
      e.returnValue = '';
    }
  });

  // === Phase 2.1b WYSIWYG エディタの input handler ===
  //
  // wysiwygPane 内の [data-field] への input event を delegation で listen し、
  // textContent を取り出して profile を再構築する。
  //
  // data-field 値は dot-separated path:
  //   - "name" / "nameKana" / "gender" / "birthDate" / "preparedOn"
  //   - "address.full" / "contactAddress.full" / "addressKana" / "contactAddressKana"
  //   - "phone" / "contactPhone"
  //   - "summary" / "personalRequest"
  //   - "historyRows.{idx}.year" / "historyRows.{idx}.month" / "historyRows.{idx}.content"
  //   - "certificationRows.{idx}.year" / ... .month / ... .content
  //
  // 入力直後に CareerProfile を再 parse し、profile state を更新する。
  // 再描画 (renderWysiwyg) は行わない (cursor が飛ぶため)。
  // 保存・読み込み・JSON エクスポートのために profile state は最新を保つ。

  /** 「山田　太郎」のような全角スペース区切り氏名を family/given に分解。 */
  const splitJapaneseName = (raw: string): { family: string; given: string } => {
    const trimmed = raw.trim();
    if (trimmed === '') return { family: '', given: '' };
    const parts = trimmed.split(/[　 ]+/);
    if (parts.length === 1) return { family: parts[0] ?? '', given: '' };
    return { family: parts[0] ?? '', given: parts.slice(1).join(' ') };
  };

  /** 「〒100-0001 東京都千代田区...」のような address.full 文字列を分解。 */
  const parseAddressFull = (
    raw: string,
  ): { postalCode?: string; prefecture?: string; cityAndRest?: string } => {
    const trimmed = raw.trim();
    if (trimmed === '') return {};
    // 〒NNN-NNNN を抽出
    const postalMatch = trimmed.match(/^〒?(\d{3}-?\d{4})\s*(.*)$/);
    let rest = trimmed;
    let postalCode: string | undefined;
    if (postalMatch !== null) {
      postalCode = postalMatch[1];
      rest = (postalMatch[2] ?? '').trim();
    }
    // 都道府県を抽出
    const prefMatch = rest.match(/^(東京都|北海道|大阪府|京都府|[^\s]+?[都道府県])\s*(.*)$/);
    let prefecture: string | undefined;
    let cityAndRest: string | undefined;
    if (prefMatch !== null) {
      prefecture = prefMatch[1];
      cityAndRest = (prefMatch[2] ?? '').trim() || undefined;
    } else {
      cityAndRest = rest || undefined;
    }
    const result: { postalCode?: string; prefecture?: string; cityAndRest?: string } = {};
    if (postalCode !== undefined) result.postalCode = postalCode;
    if (prefecture !== undefined) result.prefecture = prefecture;
    if (cityAndRest !== undefined) result.cityAndRest = cityAndRest;
    return result;
  };

  const onWysiwygInput = (event: Event): void => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const field = target.getAttribute('data-field');
    if (field === null) return;
    const value = (target.textContent ?? '').trim();

    // 学歴・職歴 内容セルは「学歴」「職歴」: 中央寄せ / 「以上」: 右寄せ /
    // その他: 左寄せ。renderer 側で同じロジックが render されているが、入力中
    // は renderWysiwyg を呼ばずに DOM だけ追従させたいため、ここで target.style
    // を直接書き換える。月セルは常に右寄せのため切替不要。
    if (/^historyRows\.\d+\.content$/.test(field)) {
      if (value === '学歴' || value === '職歴') target.style.textAlign = 'center';
      else if (value === '以上') target.style.textAlign = 'right';
      else target.style.textAlign = 'left';
    }

    // 現在 state を draft object に展開
    const draft: Record<string, unknown> = JSON.parse(JSON.stringify(profile));
    const basics = (draft.basics ?? {}) as Record<string, unknown>;
    draft.basics = basics;

    if (field === 'name') {
      const { family, given } = splitJapaneseName(value);
      if (family !== '' && given !== '') {
        basics.name = { family, given };
      } else {
        delete basics.name;
      }
    } else if (field === 'nameKana') {
      const { family, given } = splitJapaneseName(value);
      if (family !== '' && given !== '') {
        basics.nameKana = { family, given };
      } else {
        delete basics.nameKana;
      }
    } else if (field === 'gender') {
      if (value === '') delete basics.gender;
      else basics.gender = value;
    } else if (
      field === 'birthDate.year' ||
      field === 'birthDate.month' ||
      field === 'birthDate.day'
    ) {
      // 3 セル分割 birthDate: 編集中の field を更新し、3 つすべてが揃ったら
      // YYYY-MM-DD として basics.birthDate に格納、揃わなければ削除
      const subField = field.split('.')[1] as 'year' | 'month' | 'day';
      const current = (basics.birthDate as string | undefined) ?? '';
      const m = current.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      let y = m?.[1] ?? '';
      let mo = m?.[2] ?? '';
      let d = m?.[3] ?? '';
      if (subField === 'year') y = value;
      else if (subField === 'month') mo = value.padStart(2, '0');
      else d = value.padStart(2, '0');
      // 全て揃った場合のみ basics.birthDate を更新
      if (y.length === 4 && mo.length === 2 && d.length === 2) {
        basics.birthDate = `${y}-${mo}-${d}`;
      } else if (y === '' && mo === '00' && d === '00') {
        delete basics.birthDate;
      } else {
        // 部分的な入力中: 既存 birthDate を維持 (再描画で値が消えると user が
        // 数字入力中に他のセル値も消える事故になる)。新規入力中の途中状態は
        // accept できないので、basics.birthDate は削除して invalid を許容。
        delete basics.birthDate;
      }
    } else if (
      field === 'preparedOn.year' ||
      field === 'preparedOn.month' ||
      field === 'preparedOn.day'
    ) {
      const meta = (draft.meta ?? {}) as Record<string, unknown>;
      const subField = field.split('.')[1] as 'year' | 'month' | 'day';
      const current = (meta.preparedOn as string | undefined) ?? '';
      const m = current.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      let y = m?.[1] ?? '';
      let mo = m?.[2] ?? '';
      let d = m?.[3] ?? '';
      if (subField === 'year') y = value;
      else if (subField === 'month') mo = value.padStart(2, '0');
      else d = value.padStart(2, '0');
      if (y.length === 4 && mo.length === 2 && d.length === 2) {
        meta.preparedOn = `${y}-${mo}-${d}`;
      } else {
        delete meta.preparedOn;
      }
      if (Object.keys(meta).length === 0) delete draft.meta;
      else draft.meta = meta;
    } else if (field === 'address.postalCode') {
      const current = (basics.address as Record<string, string> | undefined) ?? {};
      const next = { ...current };
      if (value === '') delete next.postalCode;
      else next.postalCode = value;
      if (Object.keys(next).length === 0) delete basics.address;
      else basics.address = next;
    } else if (field === 'contactAddress.postalCode') {
      const current = (basics.contactAddress as Record<string, string> | undefined) ?? {};
      const next = { ...current };
      if (value === '') delete next.postalCode;
      else next.postalCode = value;
      if (Object.keys(next).length === 0) delete basics.contactAddress;
      else basics.contactAddress = next;
    } else if (field === 'address.full') {
      // 住所本文 (郵便番号は別セル)。parseAddressFull で 都道府県 / 残り に分解。
      const current = (basics.address as Record<string, string> | undefined) ?? {};
      const next: Record<string, string> = {};
      if (current.postalCode !== undefined) next.postalCode = current.postalCode;
      if (value !== '') {
        const parsed = parseAddressFull(value);
        if (parsed.prefecture !== undefined) next.prefecture = parsed.prefecture;
        if (parsed.cityAndRest !== undefined) next.cityAndRest = parsed.cityAndRest;
      }
      if (Object.keys(next).length === 0) delete basics.address;
      else basics.address = next;
    } else if (field === 'contactAddress.full') {
      const current = (basics.contactAddress as Record<string, string> | undefined) ?? {};
      const next: Record<string, string> = {};
      if (current.postalCode !== undefined) next.postalCode = current.postalCode;
      if (value !== '') {
        const parsed = parseAddressFull(value);
        if (parsed.prefecture !== undefined) next.prefecture = parsed.prefecture;
        if (parsed.cityAndRest !== undefined) next.cityAndRest = parsed.cityAndRest;
      }
      if (Object.keys(next).length === 0) delete basics.contactAddress;
      else basics.contactAddress = next;
    } else if (field === 'addressKana') {
      if (value === '') delete basics.addressKana;
      else basics.addressKana = value;
    } else if (field === 'contactAddressKana') {
      if (value === '') delete basics.contactAddressKana;
      else basics.contactAddressKana = value;
    } else if (field === 'phone') {
      if (value === '') delete basics.phone;
      else basics.phone = value;
    } else if (field === 'contactPhone') {
      if (value === '') delete basics.contactPhone;
      else basics.contactPhone = value;
    } else if (field === 'summary') {
      if (value === '') delete basics.summary;
      else basics.summary = value;
    } else if (field === 'personalRequest') {
      if (value === '') delete basics.personalRequest;
      else basics.personalRequest = value;
    } else {
      const histMatch = field.match(/^historyRows\.(\d+)\.(year|month|content)$/);
      const certMatch = field.match(/^certificationRows\.(\d+)\.(year|month|content)$/);
      if (histMatch !== null) {
        const idx = Number(histMatch[1]);
        const subField = histMatch[2] as 'year' | 'month' | 'content';
        const rows = ((draft.historyRows as Record<string, unknown>[]) ?? []).slice();
        while (rows.length <= idx) rows.push({});
        const row = { ...(rows[idx] as Record<string, unknown>) };
        if (value === '') delete row[subField];
        else row[subField] = value;
        rows[idx] = row;
        draft.historyRows = rows;
      } else if (certMatch !== null) {
        const idx = Number(certMatch[1]);
        const subField = certMatch[2] as 'year' | 'month' | 'content';
        const rows = ((draft.certificationRows as Record<string, unknown>[]) ?? []).slice();
        while (rows.length <= idx) rows.push({});
        const row = { ...(rows[idx] as Record<string, unknown>) };
        if (value === '') delete row[subField];
        else row[subField] = value;
        rows[idx] = row;
        draft.certificationRows = rows;
      }
    }

    // 再 parse して profile state を更新
    const parsed = safeParseCareerProfile(draft);
    if (parsed.success) {
      profile = parsed.data;
      draftBase = draft;
      isCurrentDraftValid = true;
      clearValidationIssues();
      markDirty();
      updateButtonStates();
    } else {
      isCurrentDraftValid = false;
      showValidationIssues(parsed.issues);
      showStatus(STATUS_INVALID);
      updateButtonStates();
    }
  };

  wysiwygPane.addEventListener('input', onWysiwygInput);

  // 「学歴・職歴 1 行追加」 / 「資格 1 行追加」 button — historyRows /
  // certificationRows に空 entry を push し、再描画して新しい行を出す。
  addHistoryRowButton.addEventListener('click', () => {
    const draft: Record<string, unknown> = JSON.parse(JSON.stringify(profile));
    const rows = ((draft.historyRows as Record<string, unknown>[]) ?? []).slice();
    rows.push({});
    draft.historyRows = rows;
    const parsed = safeParseCareerProfile(draft);
    if (parsed.success) {
      profile = parsed.data;
      draftBase = draft;
      markDirty();
      renderWysiwyg();
      updateButtonStates();
    }
  });

  addCertificationRowButton.addEventListener('click', () => {
    const draft: Record<string, unknown> = JSON.parse(JSON.stringify(profile));
    const rows = ((draft.certificationRows as Record<string, unknown>[]) ?? []).slice();
    rows.push({});
    draft.certificationRows = rows;
    const parsed = safeParseCareerProfile(draft);
    if (parsed.success) {
      profile = parsed.data;
      draftBase = draft;
      markDirty();
      renderWysiwyg();
      updateButtonStates();
    }
  });

  renderAndUpdate(currentKind);
  updateButtonStates();
  updateDirtyIndicator();
  void refreshSavedProfileList();
}
