// @vitest-environment jsdom

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import axe from 'axe-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// jsdom 上で axe-core を走らせ、a11y regression の有無を CI で自動検出する。
//
// 制約:
// - jsdom は実描画しないため `color-contrast` ルールは無効化する
// - preview-frame (iframe) は axe が inter-frame postMessage を試して jsdom
//   で失敗するため exclude する (preview の中身は renderer 側の責務)
//
// 検査対象 (3 つの dynamic state):
//   1. mount 直後 (sample fixture loaded、validation エラーなし)
//   2. validation エラー発生中 (summary + inline error 表示中)
//   3. 写真選択後 + 学歴 entry 追加後 (動的 DOM 追加で a11y が壊れないこと)

const HTML_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../index.html');

const AXE_OPTIONS: axe.RunOptions = {
  rules: {
    // 実描画が必要、jsdom では信頼できない
    'color-contrast': { enabled: false },
    // jsdom は viewport を持たないため scroll 関連は skip
    'scrollable-region-focusable': { enabled: false },
  },
};

// axe-core のスキャンは大きな DOM に対して 5〜8 秒かかることがあり、 vitest の
// 既定 timeout (5000ms) を超えて flaky に落ちる。 実 violation 検査ではなく
// スキャン時間の問題なので、 これらの test には余裕のある timeout を設定する。
const AXE_TEST_TIMEOUT_MS = 30_000;

const expectNoAxeViolations = async (): Promise<void> => {
  const context = {
    include: [document],
    // preview-frame は renderer 側の責務 (iframe 経由の axe inter-frame
    // postMessage は jsdom で機能しない)
    exclude: [['#preview-frame'] as string[]],
  };
  const results = await axe.run(context, AXE_OPTIONS);
  if (results.violations.length > 0) {
    // 詳細を test 失敗 message に出す (debug 容易性)
    const detail = results.violations
      .map((v) => `  - [${v.id}] ${v.help}\n    ${v.nodes.length} nodes\n    ${v.helpUrl}`)
      .join('\n');
    throw new Error(`axe-core violations:\n${detail}`);
  }
  expect(results.violations).toEqual([]);
};

const storageState = vi.hoisted(() => {
  type Stored = {
    metadata: { id: string; createdAt: string; updatedAt: string; schemaVersion: number };
    profile: { schemaVersion: number; basics: Record<string, unknown>; [key: string]: unknown };
  };
  const state = { profiles: new Map<string, Stored>(), idCounter: 0, tick: 0 };
  const now = (): string => {
    state.tick += 1;
    return `2026-01-01T00:00:${String(state.tick).padStart(2, '0')}.000Z`;
  };
  return {
    reset: () => {
      state.profiles.clear();
      state.idCounter = 0;
      state.tick = 0;
    },
    adapter: {
      saveProfile: async (input: { id?: string; profile: Stored['profile'] }): Promise<Stored> => {
        const id = input.id ?? `profile-${++state.idCounter}`;
        const existing = state.profiles.get(id);
        const timestamp = now();
        const stored: Stored = {
          metadata: {
            id,
            createdAt: existing?.metadata.createdAt ?? timestamp,
            updatedAt: timestamp,
            schemaVersion: input.profile.schemaVersion,
          },
          profile: input.profile,
        };
        state.profiles.set(id, stored);
        return stored;
      },
      loadProfile: async (id: string): Promise<Stored> => {
        const stored = state.profiles.get(id);
        if (stored === undefined) throw new Error(`Profile not found: ${id}`);
        return stored;
      },
      listProfiles: async (): Promise<readonly Stored['metadata'][]> =>
        Array.from(state.profiles.values())
          .map((stored) => stored.metadata)
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
      deleteProfile: async (id: string): Promise<void> => {
        state.profiles.delete(id);
      },
    },
  };
});

vi.mock('@jcd-editor/storage', () => ({
  createIndexedDbStorageAdapter: () => storageState.adapter,
}));

const flushPromises = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

const mountAppFromIndexHtml = async (): Promise<void> => {
  const html = await readFile(HTML_PATH, 'utf8');
  // DOMParser で別 document に parse → body の child を test 用 document に
  // adopt 移動する (innerHTML 直接 set を避ける)
  const parser = new DOMParser();
  const parsed = parser.parseFromString(html, 'text/html');

  // 既存 body 内容を空に
  while (document.body.firstChild !== null) {
    document.body.removeChild(document.body.firstChild);
  }
  // script tag は除外 (test runtime で実行されてしまうのを避ける)
  const sourceBody = parsed.body;
  for (const child of Array.from(sourceBody.childNodes)) {
    if (child.nodeName === 'SCRIPT') continue;
    document.body.appendChild(document.adoptNode(child));
  }

  // head の <title> と <html lang> は本物の index.html には存在するが、test
  // setup の document には自動で copy されない。axe rule (document-title /
  // html-has-lang) を通すため production と同じ値を反映する。
  const titleEl = parsed.querySelector('title');
  if (titleEl !== null && titleEl.textContent !== null) {
    document.title = titleEl.textContent;
  }
  const lang = parsed.documentElement.getAttribute('lang');
  if (lang !== null) {
    document.documentElement.setAttribute('lang', lang);
  }

  vi.resetModules();
  await import('../main');
  await flushPromises();
};

// 起動時はホーム画面。編集画面の a11y を検査するテストでは「新規作成」で
// 編集画面に入る (window.prompt を mock)。
const enterEditorFromHome = async (): Promise<void> => {
  const spy = vi.spyOn(window, 'prompt').mockReturnValue('テスト');
  const newBtn = document.getElementById('home-new-button');
  if (!(newBtn instanceof HTMLButtonElement)) throw new Error('Missing home-new-button');
  newBtn.click();
  await flushPromises();
  spy.mockRestore();
};

describe('accessibility (axe-core)', () => {
  beforeEach(() => {
    storageState.reset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it(
    'mount 直後 (ホーム画面) で axe violations なし',
    async () => {
      await mountAppFromIndexHtml();
      // 起動時はホーム画面が入口
      expect(document.getElementById('home-screen')?.hidden).toBe(false);
      await expectNoAxeViolations();
    },
    AXE_TEST_TIMEOUT_MS,
  );

  it(
    '新規作成で編集画面に入った直後で axe violations なし',
    async () => {
      await mountAppFromIndexHtml();
      await enterEditorFromHome();
      expect(document.getElementById('app-main')?.hidden).toBe(false);
      await expectNoAxeViolations();
    },
    AXE_TEST_TIMEOUT_MS,
  );

  it(
    'validation エラー発生中 (summary + inline error 表示中) で axe violations なし',
    async () => {
      await mountAppFromIndexHtml();
      await enterEditorFromHome();
      const birthInput = document.getElementById('birth-date');
      if (!(birthInput instanceof HTMLInputElement)) throw new Error('Missing birth-date');
      birthInput.value = '1800-01-01';
      birthInput.dispatchEvent(new Event('input', { bubbles: true }));

      expect(document.getElementById('validation-summary')?.hidden).toBe(false);
      await expectNoAxeViolations();
    },
    AXE_TEST_TIMEOUT_MS,
  );

  it(
    'section entry を追加した後の動的 DOM で axe violations なし',
    async () => {
      await mountAppFromIndexHtml();
      await enterEditorFromHome();
      const addBtn = document.getElementById('add-education-button');
      if (!(addBtn instanceof HTMLButtonElement)) throw new Error('Missing add-education-button');
      addBtn.click();
      await flushPromises();

      await expectNoAxeViolations();
    },
    AXE_TEST_TIMEOUT_MS,
  );
});
