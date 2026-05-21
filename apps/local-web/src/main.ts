// jcd-editor (local-web) entry point。
//
// 役割:
//   - sample CareerProfile input を safeParseCareerProfile で runtime 検証
//   - createDefaultTemplateRegistry + renderDocument で render
//   - iframe.srcdoc に preview として表示 (buildPreviewDocument で完全 HTML 化)
//   - 履歴書 / 職務経歴書 の kind switcher
//
// 制約:
//   - @jcd-editor/pdf は import しない (Playwright は browser bundle に入らない)
//   - localStorage / fetch / file API なし
//   - state library / router / UI library なし

import { safeParseCareerProfile, type ValidationIssue } from '@jcd-editor/core';
import {
  createDefaultTemplateRegistry,
  renderDocument,
  RendererError,
  type DocumentKind,
} from '@jcd-editor/renderer';

import './styles.css';

import { buildPreviewDocument } from './preview-document';
import { sampleProfileInput } from './sample-profile';

const previewFrame = document.getElementById('preview-frame') as HTMLIFrameElement | null;
const kindSelector = document.getElementById('kind-selector') as HTMLSelectElement | null;
const statusEl = document.getElementById('status');
const errorArea = document.getElementById('error-area');

if (previewFrame === null || kindSelector === null || statusEl === null || errorArea === null) {
  throw new Error('Required DOM elements are missing in index.html.');
}

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

const parsed = safeParseCareerProfile(sampleProfileInput);
if (!parsed.success) {
  showError('sample fixture が現行 schema を満たしません', formatIssues(parsed.issues));
  showStatus('fixture 不正');
  console.error('sample fixture failed to parse:', parsed.issues);
} else {
  const profile = parsed.data;
  const registry = createDefaultTemplateRegistry();

  const STATUS_LABELS: Record<DocumentKind, string> = {
    rirekisho: '履歴書を表示中',
    shokumukeirekisho: '職務経歴書を表示中',
  };

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

  kindSelector.addEventListener('change', () => {
    const value = kindSelector.value;
    if (value === 'rirekisho' || value === 'shokumukeirekisho') {
      renderAndUpdate(value);
    }
  });

  renderAndUpdate('rirekisho');
}
