// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

const storageState = vi.hoisted(() => {
  type Stored = {
    metadata: {
      id: string;
      createdAt: string;
      updatedAt: string;
      schemaVersion: number;
    };
    profile: {
      schemaVersion: number;
      basics: Record<string, unknown>;
      [key: string]: unknown;
    };
  };

  const state = {
    profiles: new Map<string, Stored>(),
    idCounter: 0,
    tick: 0,
  };

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
        if (stored === undefined) {
          throw new Error(`Profile not found: ${id}`);
        }
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

const setupDom = (): void => {
  document.body.innerHTML = `
    <select id="kind-selector">
      <option value="rirekisho">履歴書</option>
      <option value="shokumukeirekisho">職務経歴書</option>
    </select>
    <span id="status"></span>
    <button type="button" id="save-button">保存</button>
    <select id="saved-profile-select"><option value="">(選択してください)</option></select>
    <button type="button" id="load-button" disabled>読み込み</button>
    <form id="basics-form">
      <input id="name-family" />
      <input id="name-given" />
      <input id="name-kana-family" />
      <input id="name-kana-given" />
      <input id="birth-date" />
      <input id="email" />
      <input id="phone" />
      <input id="postal-code" />
      <input id="prefecture" />
      <input id="city-and-rest" />
      <pre id="basics-validation-issues" hidden></pre>
    </form>
    <button type="button" id="add-work-experience-button">職歴を追加</button>
    <div id="work-experiences-list"></div>
    <button type="button" id="add-education-button">学歴を追加</button>
    <div id="education-list"></div>
    <iframe id="preview-frame" sandbox=""></iframe>
    <pre id="error-area" hidden></pre>
  `;
};

const importMain = async (): Promise<void> => {
  vi.resetModules();
  setupDom();
  await import('../main');
  await flushPromises();
};

const input = (id: string): HTMLInputElement => {
  const el = document.getElementById(id);
  if (!(el instanceof HTMLInputElement)) {
    throw new Error(`Missing input #${id}`);
  }
  return el;
};

const select = (id: string): HTMLSelectElement => {
  const el = document.getElementById(id);
  if (!(el instanceof HTMLSelectElement)) {
    throw new Error(`Missing select #${id}`);
  }
  return el;
};

const button = (id: string): HTMLButtonElement => {
  const el = document.getElementById(id);
  if (!(el instanceof HTMLButtonElement)) {
    throw new Error(`Missing button #${id}`);
  }
  return el;
};

const preview = (): HTMLIFrameElement => {
  const el = document.getElementById('preview-frame');
  if (!(el instanceof HTMLIFrameElement)) {
    throw new Error('Missing preview iframe');
  }
  return el;
};

const dispatchInput = (el: HTMLElement): void => {
  el.dispatchEvent(new Event('input', { bubbles: true }));
};

describe('local-web main flow', () => {
  beforeEach(() => {
    storageState.reset();
    document.body.innerHTML = '';
  });

  it('初期 profile を form と preview に反映する', async () => {
    await importMain();

    expect(input('name-family').value).toBe('山田');
    expect(input('name-given').value).toBe('太郎');
    expect(document.querySelectorAll('#work-experiences-list [data-index]')).toHaveLength(1);
    expect(preview().srcdoc).toContain('履歴書');
    expect(preview().srcdoc).toContain('山田');
    expect(document.getElementById('status')?.textContent).toBe('履歴書を表示中');
  });

  it('invalid draft では preview を保持し save を無効化する', async () => {
    await importMain();
    const previousPreview = preview().srcdoc;

    input('birth-date').value = '1800-01-01';
    dispatchInput(input('birth-date'));

    const issues = document.getElementById('basics-validation-issues');
    expect(issues?.hidden).toBe(false);
    expect(issues?.textContent).toContain('birthDate');
    expect(preview().srcdoc).toBe(previousPreview);
    expect(button('save-button').disabled).toBe(true);
  });

  it('save 後に未保存編集を load で保存済み profile に戻せる', async () => {
    await importMain();

    input('name-family').value = '佐藤';
    dispatchInput(input('name-family'));
    button('save-button').click();
    await flushPromises();

    input('name-family').value = '田中';
    dispatchInput(input('name-family'));
    expect(preview().srcdoc).toContain('田中');

    select('saved-profile-select').value = 'profile-1';
    button('load-button').click();
    await flushPromises();

    expect(input('name-family').value).toBe('佐藤');
    expect(preview().srcdoc).toContain('佐藤');
    expect(preview().srcdoc).not.toContain('田中');
  });
});
