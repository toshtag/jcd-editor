// jcd-editor (local-web) entry point。
//
// 役割:
//   - sample CareerProfile input を safeParseCareerProfile で runtime 検証
//   - basics + workExperiences 編集 form を提供、入力ごとに raw draft を構築
//     → parse → success なら render
//   - createDefaultTemplateRegistry + renderDocument で render
//   - iframe.srcdoc に preview として表示 (buildPreviewDocument で完全 HTML 化)
//   - 履歴書 / 職務経歴書 の kind switcher
//   - manual Save / Load via IndexedDB
//
// 制約:
//   - @jcd-editor/pdf は import しない (Playwright は browser bundle に入らない)
//   - localStorage / sessionStorage / FileSystemAccess / fetch / file API なし
//   - state library / router / UI library なし
//   - IndexedDB API を app source で直接呼ばない (@jcd-editor/storage port 経由)
//   - draft は raw input、CareerProfile 型として扱わない (safeParseCareerProfile 経由で type-safe に)
//   - invalid draft は renderer に渡さない (parsed.success === true の時のみ renderDocument を呼ぶ)
//   - invalid draft 時は前回成功 preview を保持、validation issues を画面下部に表示
//   - 保存対象は last-valid profile のみ (Save button は invalid 中 disable)
//   - DOM 操作は createElement + textContent + replaceChildren のみ、innerHTML 不使用 (XSS 回避)
//
// workExperiences (本 PR で追加):
//   - DOM を state として扱う pattern: 各 entry は `<section data-index>` で表現、
//     内部 input / textarea / checkbox は `data-field` で identify。JS 側で state を
//     別途持たない。`readWorkExperiencesFromForm()` で DOM walk して values を取得
//   - UI rebuild は add / remove / load 時のみ、text input 時は rebuild しない
//     (focus 保持)
//   - event delegation: workExperiencesList container に input listener と click
//     listener を 1 つずつ
//   - 完全空の entry は `buildWorkExperiencesFromForm` で除外 (UI には残るが draft
//     / preview / 保存対象には流さない、UX ノイズ回避)
//
// draftBase 問題への対応:
//   - form input 成功時 / load 成功時に draftBase を current profile に update
//   - 初期は sampleProfileInput を base、load 後は loaded profile を base
//   - これにより load 後の form 編集で他 section が sample fixture に戻る重大バグを防止

import { safeParseCareerProfile, type CareerProfile, type ValidationIssue } from '@jcd-editor/core';
import {
  createDefaultTemplateRegistry,
  renderDocument,
  RendererError,
  type DocumentKind,
} from '@jcd-editor/renderer';
import { createIndexedDbStorageAdapter, type StoredProfileId } from '@jcd-editor/storage';

import './styles.css';

import { buildPreviewDocument } from './preview-document';
import {
  buildBasicsFromForm,
  buildDraft,
  buildSaveProfileInput,
  type BasicsFormValues,
} from './profile-draft';
import { sampleProfileInput } from './sample-profile';
import { formatStoredProfileOption } from './storage-ui';
import {
  buildEducationFromForm,
  createEducationItemElement,
  emptyEducationFormValues,
  populateEducationForm,
  readEducationFromForm,
} from './education-form';
import { buildExportFileName, parseJsonImport, serializeProfileToJson } from './profile-io';
import {
  buildSkillsFromForm,
  createSkillItemElement,
  emptySkillFormValues,
  populateSkillsForm,
  readSkillsFromForm,
} from './skills-form';
import {
  buildWorkExperiencesFromForm,
  createWorkExperienceItemElement,
  emptyWorkExperienceFormValues,
  populateWorkExperiencesForm,
  readWorkExperiencesFromForm,
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
const validationIssuesPre = requireElement('basics-validation-issues', HTMLPreElement);
const saveButton = requireElement('save-button', HTMLButtonElement);
const loadButton = requireElement('load-button', HTMLButtonElement);
const profileSelect = requireElement('saved-profile-select', HTMLSelectElement);
const workExperiencesList = requireElement('work-experiences-list', HTMLDivElement);
const addWorkExperienceButton = requireElement('add-work-experience-button', HTMLButtonElement);
const educationList = requireElement('education-list', HTMLDivElement);
const addEducationButton = requireElement('add-education-button', HTMLButtonElement);
const skillsList = requireElement('skills-list', HTMLDivElement);
const addSkillButton = requireElement('add-skill-button', HTMLButtonElement);
const exportButton = requireElement('export-button', HTMLButtonElement);
const importFileInput = requireElement('import-file-input', HTMLInputElement);
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

const populateForm = (basics: CareerProfile['basics']): void => {
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
  let profile: CareerProfile = parsed.data;
  let currentKind: DocumentKind = 'rirekisho';
  let currentProfileId: StoredProfileId | undefined;
  let draftBase: Record<string, unknown> = sampleProfileInput;
  let isCurrentDraftValid = true;
  let isStorageBusy = false;

  const registry = createDefaultTemplateRegistry();
  const storage = createIndexedDbStorageAdapter();

  const populateAll = (loaded: CareerProfile): void => {
    populateForm(loaded.basics);
    populateWorkExperiencesForm(workExperiencesList, loaded.workExperiences);
    populateEducationForm(educationList, loaded.educationHistory);
    populateSkillsForm(skillsList, loaded.skills);
  };

  populateAll(profile);

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

  const updateButtonStates = (): void => {
    saveButton.disabled = !isCurrentDraftValid || isStorageBusy;
    loadButton.disabled = profileSelect.value === '' || isStorageBusy;
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
    const basics = buildBasicsFromForm(readFormValues());
    const workExperiences = buildWorkExperiencesFromForm(
      readWorkExperiencesFromForm(workExperiencesList),
    );
    const educationHistory = buildEducationFromForm(readEducationFromForm(educationList));
    const skills = buildSkillsFromForm(readSkillsFromForm(skillsList));
    const draft = buildDraft({ basics, workExperiences, educationHistory, skills }, draftBase);
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
      showStatus('import して保存しました');
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
      showStatus('保存済みプロフィールを読み込みました');
    } catch (error) {
      handleStorageError(error, '読み込みに失敗しました');
    } finally {
      isStorageBusy = false;
      updateButtonStates();
    }
  };

  const renumberWorkExperienceItems = (): void => {
    workExperiencesList.querySelectorAll<HTMLElement>('[data-index]').forEach((el, i) => {
      el.dataset.index = String(i);
      const legend = el.querySelector('.work-experience-item__legend');
      if (legend !== null) {
        legend.textContent = `職歴 ${i + 1}`;
      }
    });
  };

  const renumberEducationItems = (): void => {
    educationList.querySelectorAll<HTMLElement>('[data-index]').forEach((el, i) => {
      el.dataset.index = String(i);
      const legend = el.querySelector('.education-item__legend');
      if (legend !== null) {
        legend.textContent = `学歴 ${i + 1}`;
      }
    });
  };

  const renumberSkillItems = (): void => {
    skillsList.querySelectorAll<HTMLElement>('[data-index]').forEach((el, i) => {
      el.dataset.index = String(i);
      const legend = el.querySelector('.skill-item__legend');
      if (legend !== null) {
        legend.textContent = `スキル ${i + 1}`;
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

  profileSelect.addEventListener('change', updateButtonStates);

  exportButton.addEventListener('click', () => {
    onExport();
  });

  importFileInput.addEventListener('change', () => {
    const file = importFileInput.files?.[0];
    if (file === undefined) return;
    // 同じファイルを再度選択できるよう、処理後に input をリセット
    void onImportFile(file).finally(() => {
      importFileInput.value = '';
    });
  });

  renderAndUpdate(currentKind);
  updateButtonStates();
  void refreshSavedProfileList();
}
