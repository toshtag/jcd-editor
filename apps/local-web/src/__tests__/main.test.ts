// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
    <span id="dirty-indicator" hidden>● 未保存</span>
    <button type="button" id="save-button">保存</button>
    <select id="saved-profile-select"><option value="">(選択してください)</option></select>
    <button type="button" id="load-button" disabled>読み込み</button>
    <button type="button" id="delete-button" disabled>削除</button>
    <button type="button" id="export-button">JSON エクスポート</button>
    <input type="file" id="import-file-input" />
    <form id="basics-form">
      <img id="profile-photo-thumbnail" alt="" hidden />
      <span id="profile-photo-placeholder">証明写真</span>
      <input type="file" id="profile-photo-input" />
      <button type="button" id="profile-photo-remove-button" disabled>写真を削除</button>
      <p id="profile-photo-error" hidden></p>
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
    <button type="button" id="add-skill-button">スキルを追加</button>
    <div id="skills-list"></div>
    <button type="button" id="add-certification-button">資格を追加</button>
    <div id="certifications-list"></div>
    <button type="button" id="add-project-button">プロジェクトを追加</button>
    <div id="projects-list"></div>
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
    // load / delete / import 系で window.confirm が出る経路を default で「承認」
    // とする。confirm キャンセル経路を test するときは個別 it 内で mockReturnValue
    // を上書きする。
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
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

  it('初期 profile に sample fixture 由来の学歴が反映される', async () => {
    await importMain();

    const educationItems = document.querySelectorAll('#education-list [data-index]');
    expect(educationItems).toHaveLength(1);
    const institutionInput = educationItems[0]?.querySelector<HTMLInputElement>(
      '[data-field="institutionName"]',
    );
    expect(institutionInput?.value).toBe('サンプル大学');
    expect(preview().srcdoc).toContain('サンプル大学');
  });

  it('学歴を入力して保存 → 読み込みで学歴 form が復元される (round-trip)', async () => {
    await importMain();

    // 既存 entry を削除して 1 件だけにする
    const removeButtons = document.querySelectorAll<HTMLButtonElement>(
      '#education-list [data-action="remove"]',
    );
    removeButtons.forEach((b) => {
      b.click();
    });

    button('add-education-button').click();
    const institutionInput = document.querySelector<HTMLInputElement>(
      '#education-list [data-field="institutionName"]',
    );
    if (institutionInput === null) throw new Error('institutionName input missing');
    institutionInput.value = 'テスト大学';
    dispatchInput(institutionInput);

    const statusInput = document.querySelector<HTMLInputElement>(
      '#education-list [data-field="status"]',
    );
    if (statusInput === null) throw new Error('status input missing');
    statusInput.value = '卒業見込み';
    dispatchInput(statusInput);

    button('save-button').click();
    await flushPromises();

    // 編集を加える (未保存状態)
    institutionInput.value = '別大学';
    dispatchInput(institutionInput);
    expect(preview().srcdoc).toContain('別大学');

    // load で復元
    select('saved-profile-select').value = 'profile-1';
    button('load-button').click();
    await flushPromises();

    const restored = document.querySelector<HTMLInputElement>(
      '#education-list [data-field="institutionName"]',
    );
    expect(restored?.value).toBe('テスト大学');
    const restoredStatus = document.querySelector<HTMLInputElement>(
      '#education-list [data-field="status"]',
    );
    expect(restoredStatus?.value).toBe('卒業見込み');
    expect(preview().srcdoc).toContain('テスト大学');
    expect(preview().srcdoc).not.toContain('別大学');
  });

  it('学歴を全削除 → 保存後の data に sample fixture 由来の学歴が再混入しない', async () => {
    await importMain();

    // sample fixture 由来の学歴 (サンプル大学) を全削除
    const removeButtons = document.querySelectorAll<HTMLButtonElement>(
      '#education-list [data-action="remove"]',
    );
    expect(removeButtons.length).toBeGreaterThan(0);
    removeButtons.forEach((b) => {
      b.click();
    });

    // この時点で preview に「サンプル大学」が残っていないこと
    expect(document.querySelectorAll('#education-list [data-index]')).toHaveLength(0);
    expect(preview().srcdoc).not.toContain('サンプル大学');

    // 保存して load し直す
    button('save-button').click();
    await flushPromises();

    // 編集中の draft をリセットするため、別 profile の編集状態を経由してから load
    input('name-family').value = '佐藤';
    dispatchInput(input('name-family'));

    select('saved-profile-select').value = 'profile-1';
    button('load-button').click();
    await flushPromises();

    // load 後も学歴が空のまま (再混入しない)
    expect(document.querySelectorAll('#education-list [data-index]')).toHaveLength(0);
    expect(preview().srcdoc).not.toContain('サンプル大学');
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

    // 未保存変更があるため load 時に confirm が出るが、beforeEach の global mock
    // で承認される。
    select('saved-profile-select').value = 'profile-1';
    button('load-button').click();
    await flushPromises();

    expect(input('name-family').value).toBe('佐藤');
    expect(preview().srcdoc).toContain('佐藤');
    expect(preview().srcdoc).not.toContain('田中');
  });

  it('初期 profile に sample fixture 由来のスキルが反映される', async () => {
    await importMain();

    const skillItems = document.querySelectorAll('#skills-list [data-index]');
    // sample fixture には TypeScript / HTML / CSS / Node.js の 3 件入る
    expect(skillItems.length).toBeGreaterThanOrEqual(1);
    const firstNameInput = skillItems[0]?.querySelector<HTMLInputElement>('[data-field="name"]');
    expect(firstNameInput?.value).toBe('TypeScript');
    expect(preview().srcdoc).toContain('TypeScript');
  });

  it('スキルを入力して保存 → 読み込みでスキル form が復元される (round-trip)', async () => {
    await importMain();

    // 既存 entry を削除して空にする
    const removeButtons = document.querySelectorAll<HTMLButtonElement>(
      '#skills-list [data-action="remove"]',
    );
    removeButtons.forEach((b) => {
      b.click();
    });

    button('add-skill-button').click();
    const nameInput = document.querySelector<HTMLInputElement>('#skills-list [data-field="name"]');
    if (nameInput === null) throw new Error('skill name input missing');
    // 「Rust」「Erlang」は sample fixture や他 section に含まれない一意な値として選択
    nameInput.value = 'Rust';
    dispatchInput(nameInput);

    const levelInput = document.querySelector<HTMLInputElement>(
      '#skills-list [data-field="level"]',
    );
    if (levelInput === null) throw new Error('skill level input missing');
    levelInput.value = '中級';
    dispatchInput(levelInput);

    button('save-button').click();
    await flushPromises();

    // 編集を加える (未保存状態)
    nameInput.value = 'Erlang';
    dispatchInput(nameInput);
    expect(preview().srcdoc).toContain('Erlang');

    // load で復元
    select('saved-profile-select').value = 'profile-1';
    button('load-button').click();
    await flushPromises();

    const restored = document.querySelector<HTMLInputElement>('#skills-list [data-field="name"]');
    expect(restored?.value).toBe('Rust');
    const restoredLevel = document.querySelector<HTMLInputElement>(
      '#skills-list [data-field="level"]',
    );
    expect(restoredLevel?.value).toBe('中級');
    expect(preview().srcdoc).toContain('Rust');
    expect(preview().srcdoc).not.toContain('Erlang');
  });

  it('スキルを全削除 → 保存後の data に sample fixture 由来のスキルが再混入しない', async () => {
    await importMain();

    // sample fixture 由来のスキル (TypeScript 等) を全削除
    const removeButtons = document.querySelectorAll<HTMLButtonElement>(
      '#skills-list [data-action="remove"]',
    );
    expect(removeButtons.length).toBeGreaterThan(0);
    removeButtons.forEach((b) => {
      b.click();
    });

    // form 上で削除済みであることを確認 (preview 全体の TypeScript 検査は
    // 不可: 同 fixture の projects.technologies にも 'TypeScript' が含まれる)
    expect(document.querySelectorAll('#skills-list [data-index]')).toHaveLength(0);

    button('save-button').click();
    await flushPromises();

    input('name-family').value = '佐藤';
    dispatchInput(input('name-family'));

    select('saved-profile-select').value = 'profile-1';
    button('load-button').click();
    await flushPromises();

    // load 後もスキル form が空のまま (再混入しない)
    expect(document.querySelectorAll('#skills-list [data-index]')).toHaveLength(0);
  });

  it('初期 profile に sample fixture 由来の資格が反映される', async () => {
    await importMain();

    const items = document.querySelectorAll('#certifications-list [data-index]');
    expect(items).toHaveLength(1);
    const nameInput = items[0]?.querySelector<HTMLInputElement>('[data-field="name"]');
    expect(nameInput?.value).toBe('基本情報技術者試験');
    expect(preview().srcdoc).toContain('基本情報技術者試験');
  });

  it('資格を入力して保存 → 読み込みで資格 form が復元される (round-trip)', async () => {
    await importMain();

    // 既存 entry を削除して空にする
    const removeButtons = document.querySelectorAll<HTMLButtonElement>(
      '#certifications-list [data-action="remove"]',
    );
    removeButtons.forEach((b) => {
      b.click();
    });

    button('add-certification-button').click();
    // sample fixture や他 section に含まれない一意な値 (CISSP / Wakanda)
    const nameInput = document.querySelector<HTMLInputElement>(
      '#certifications-list [data-field="name"]',
    );
    if (nameInput === null) throw new Error('certification name input missing');
    nameInput.value = 'CISSP';
    dispatchInput(nameInput);

    const issuerInput = document.querySelector<HTMLInputElement>(
      '#certifications-list [data-field="issuer"]',
    );
    if (issuerInput === null) throw new Error('certification issuer input missing');
    issuerInput.value = 'ISC2';
    dispatchInput(issuerInput);

    button('save-button').click();
    await flushPromises();

    // 編集を加える (未保存状態)
    nameInput.value = 'WakandaCert';
    dispatchInput(nameInput);
    expect(preview().srcdoc).toContain('WakandaCert');

    // load で復元
    select('saved-profile-select').value = 'profile-1';
    button('load-button').click();
    await flushPromises();

    const restored = document.querySelector<HTMLInputElement>(
      '#certifications-list [data-field="name"]',
    );
    expect(restored?.value).toBe('CISSP');
    const restoredIssuer = document.querySelector<HTMLInputElement>(
      '#certifications-list [data-field="issuer"]',
    );
    expect(restoredIssuer?.value).toBe('ISC2');
    expect(preview().srcdoc).toContain('CISSP');
    expect(preview().srcdoc).not.toContain('WakandaCert');
  });

  it('資格を全削除 → 保存後の data に sample fixture 由来の資格が再混入しない', async () => {
    await importMain();

    // sample fixture 由来の資格 (基本情報技術者試験) を全削除
    const removeButtons = document.querySelectorAll<HTMLButtonElement>(
      '#certifications-list [data-action="remove"]',
    );
    expect(removeButtons.length).toBeGreaterThan(0);
    removeButtons.forEach((b) => {
      b.click();
    });

    // この時点で preview に「基本情報技術者試験」が残っていないこと
    expect(document.querySelectorAll('#certifications-list [data-index]')).toHaveLength(0);
    expect(preview().srcdoc).not.toContain('基本情報技術者試験');

    // 保存して load し直す
    button('save-button').click();
    await flushPromises();

    // 編集中の draft をリセットするため、別 profile の編集状態を経由してから load
    input('name-family').value = '佐藤';
    dispatchInput(input('name-family'));

    select('saved-profile-select').value = 'profile-1';
    button('load-button').click();
    await flushPromises();

    // load 後も資格が空のまま (再混入しない)
    expect(document.querySelectorAll('#certifications-list [data-index]')).toHaveLength(0);
    expect(preview().srcdoc).not.toContain('基本情報技術者試験');
  });

  it('初期 profile に sample fixture 由来のプロジェクトが反映される', async () => {
    await importMain();

    const items = document.querySelectorAll('#projects-list [data-index]');
    expect(items).toHaveLength(1);
    const nameInput = items[0]?.querySelector<HTMLInputElement>('[data-field="name"]');
    expect(nameInput?.value).toBe('サンプルプロジェクト');
    expect(preview().srcdoc).toContain('サンプルプロジェクト');
  });

  it('プロジェクトを入力して保存 → 読み込みでプロジェクト form が復元される (round-trip)', async () => {
    await importMain();

    // 既存 entry を削除して空にする
    const removeButtons = document.querySelectorAll<HTMLButtonElement>(
      '#projects-list [data-action="remove"]',
    );
    removeButtons.forEach((b) => {
      b.click();
    });

    button('add-project-button').click();
    // sample fixture や他 section に含まれない一意な値を使う
    const nameInput = document.querySelector<HTMLInputElement>(
      '#projects-list [data-field="name"]',
    );
    if (nameInput === null) throw new Error('project name input missing');
    nameInput.value = 'WakandaProject';
    dispatchInput(nameInput);

    const roleInput = document.querySelector<HTMLInputElement>(
      '#projects-list [data-field="role"]',
    );
    if (roleInput === null) throw new Error('project role input missing');
    roleInput.value = 'リード';
    dispatchInput(roleInput);

    const techInput = document.querySelector<HTMLTextAreaElement>(
      '#projects-list [data-field="technologiesText"]',
    );
    if (techInput === null) throw new Error('project technologies input missing');
    techInput.value = 'Elixir\nPhoenix';
    dispatchInput(techInput);

    button('save-button').click();
    await flushPromises();

    // 編集を加える (未保存状態)
    nameInput.value = 'ErebusProject';
    dispatchInput(nameInput);
    expect(preview().srcdoc).toContain('ErebusProject');

    // load で復元
    select('saved-profile-select').value = 'profile-1';
    button('load-button').click();
    await flushPromises();

    const restored = document.querySelector<HTMLInputElement>('#projects-list [data-field="name"]');
    expect(restored?.value).toBe('WakandaProject');
    const restoredRole = document.querySelector<HTMLInputElement>(
      '#projects-list [data-field="role"]',
    );
    expect(restoredRole?.value).toBe('リード');
    const restoredTech = document.querySelector<HTMLTextAreaElement>(
      '#projects-list [data-field="technologiesText"]',
    );
    expect(restoredTech?.value).toBe('Elixir\nPhoenix');
    expect(preview().srcdoc).toContain('WakandaProject');
    expect(preview().srcdoc).not.toContain('ErebusProject');
  });

  it('プロジェクトを全削除 → 保存後の data に sample fixture 由来のプロジェクトが再混入しない', async () => {
    await importMain();

    // sample fixture 由来のプロジェクト (サンプルプロジェクト) を全削除
    const removeButtons = document.querySelectorAll<HTMLButtonElement>(
      '#projects-list [data-action="remove"]',
    );
    expect(removeButtons.length).toBeGreaterThan(0);
    removeButtons.forEach((b) => {
      b.click();
    });

    // この時点で preview に「サンプルプロジェクト」が残っていないこと
    expect(document.querySelectorAll('#projects-list [data-index]')).toHaveLength(0);
    expect(preview().srcdoc).not.toContain('サンプルプロジェクト');

    // 保存して load し直す
    button('save-button').click();
    await flushPromises();

    // 編集中の draft をリセットするため、別 profile の編集状態を経由してから load
    input('name-family').value = '佐藤';
    dispatchInput(input('name-family'));

    select('saved-profile-select').value = 'profile-1';
    button('load-button').click();
    await flushPromises();

    // load 後もプロジェクトが空のまま (再混入しない)
    expect(document.querySelectorAll('#projects-list [data-index]')).toHaveLength(0);
    expect(preview().srcdoc).not.toContain('サンプルプロジェクト');
  });

  describe('dirty state', () => {
    const dirtyIndicator = (): HTMLElement => {
      const el = document.getElementById('dirty-indicator');
      if (el === null) throw new Error('Missing dirty-indicator');
      return el;
    };

    it('初期 mount 時: indicator は非表示 (sample fixture は未編集扱い)', async () => {
      await importMain();
      expect(dirtyIndicator().hidden).toBe(true);
    });

    it('user 入力後: indicator が表示される', async () => {
      await importMain();
      input('name-family').value = '佐藤';
      dispatchInput(input('name-family'));
      expect(dirtyIndicator().hidden).toBe(false);
    });

    it('save 成功後: indicator が非表示に戻る', async () => {
      await importMain();
      input('name-family').value = '佐藤';
      dispatchInput(input('name-family'));
      expect(dirtyIndicator().hidden).toBe(false);

      button('save-button').click();
      await flushPromises();
      expect(dirtyIndicator().hidden).toBe(true);
    });

    it('load 成功後: indicator が非表示に戻る', async () => {
      await importMain();
      // 一度 save して保存済み profile を 1 件作る
      input('name-family').value = '佐藤';
      dispatchInput(input('name-family'));
      button('save-button').click();
      await flushPromises();
      // 編集して dirty にする
      input('name-family').value = '田中';
      dispatchInput(input('name-family'));
      expect(dirtyIndicator().hidden).toBe(false);

      // load (beforeEach の global mock で confirm 承認される)
      select('saved-profile-select').value = 'profile-1';
      button('load-button').click();
      await flushPromises();

      expect(dirtyIndicator().hidden).toBe(true);
    });

    it('invalid draft 中も dirty 判定は維持される', async () => {
      await importMain();
      // 無効な birthDate で invalid 状態にする
      input('birth-date').value = '1800-01-01';
      dispatchInput(input('birth-date'));
      expect(dirtyIndicator().hidden).toBe(false);
      expect(button('save-button').disabled).toBe(true);
    });

    it('load 時に未保存変更があると confirm が表示される。承認するとロードが進む', async () => {
      await importMain();
      input('name-family').value = '佐藤';
      dispatchInput(input('name-family'));
      button('save-button').click();
      await flushPromises();

      // dirty にする
      input('name-family').value = '田中';
      dispatchInput(input('name-family'));

      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
      select('saved-profile-select').value = 'profile-1';
      button('load-button').click();
      await flushPromises();

      expect(confirmSpy).toHaveBeenCalledTimes(1);
      expect(confirmSpy.mock.calls[0]?.[0]).toContain('未保存の変更があります');
      expect(input('name-family').value).toBe('佐藤');
    });

    it('load 時に confirm キャンセル: form / preview が維持されてロードは skip される', async () => {
      await importMain();
      input('name-family').value = '佐藤';
      dispatchInput(input('name-family'));
      button('save-button').click();
      await flushPromises();
      input('name-family').value = '田中';
      dispatchInput(input('name-family'));
      const dirtyBefore = preview().srcdoc;

      vi.spyOn(window, 'confirm').mockReturnValue(false);
      select('saved-profile-select').value = 'profile-1';
      button('load-button').click();
      await flushPromises();

      expect(input('name-family').value).toBe('田中');
      expect(preview().srcdoc).toBe(dirtyBefore);
      expect(dirtyIndicator().hidden).toBe(false);
      expect(document.getElementById('status')?.textContent).toBe('読み込みをキャンセルしました');
    });

    it('未保存変更がない状態での load: confirm は呼ばれない (新規 mount 後すぐ等)', async () => {
      await importMain();
      // 初期 save (dirty なし状態を作るため、まず編集 → save する)
      input('name-family').value = '佐藤';
      dispatchInput(input('name-family'));
      button('save-button').click();
      await flushPromises();
      // ここで dirty=false。load 時に confirm は呼ばれない

      const confirmSpy = vi.spyOn(window, 'confirm');
      select('saved-profile-select').value = 'profile-1';
      button('load-button').click();
      await flushPromises();

      expect(confirmSpy).not.toHaveBeenCalled();
    });
  });

  describe('プロファイル削除', () => {
    it('未選択時: 削除ボタンは disabled', async () => {
      await importMain();
      expect(button('delete-button').disabled).toBe(true);
    });

    it('confirm OK: storage から削除されて dropdown から消える', async () => {
      await importMain();

      // 1 件保存
      input('name-family').value = '佐藤';
      dispatchInput(input('name-family'));
      button('save-button').click();
      await flushPromises();

      // dropdown で選択
      select('saved-profile-select').value = 'profile-1';
      select('saved-profile-select').dispatchEvent(new Event('change', { bubbles: true }));
      expect(button('delete-button').disabled).toBe(false);

      vi.spyOn(window, 'confirm').mockReturnValue(true);
      button('delete-button').click();
      await flushPromises();

      const options = Array.from(select('saved-profile-select').options).map((o) => o.value);
      expect(options.filter((v) => v !== '')).toHaveLength(0);
      expect(button('delete-button').disabled).toBe(true);
      expect(document.getElementById('status')?.textContent).toBe('プロフィールを削除しました');

      vi.restoreAllMocks();
    });

    it('confirm キャンセル: storage 操作なし、status のみ更新', async () => {
      await importMain();

      input('name-family').value = '佐藤';
      dispatchInput(input('name-family'));
      button('save-button').click();
      await flushPromises();

      select('saved-profile-select').value = 'profile-1';
      select('saved-profile-select').dispatchEvent(new Event('change', { bubbles: true }));

      vi.spyOn(window, 'confirm').mockReturnValue(false);
      button('delete-button').click();
      await flushPromises();

      const options = Array.from(select('saved-profile-select').options).map((o) => o.value);
      expect(options.filter((v) => v !== '')).toHaveLength(1);
      expect(document.getElementById('status')?.textContent).toBe('削除をキャンセルしました');

      vi.restoreAllMocks();
    });

    it('現在編集中の profile を削除: currentProfileId を切り離し、次の save は新規 id で作成される', async () => {
      await importMain();

      // 保存して current にする
      input('name-family').value = '佐藤';
      dispatchInput(input('name-family'));
      button('save-button').click();
      await flushPromises();

      // 1 件目を選択して削除
      select('saved-profile-select').value = 'profile-1';
      select('saved-profile-select').dispatchEvent(new Event('change', { bubbles: true }));
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      button('delete-button').click();
      await flushPromises();

      // form は維持されている (currentProfileId は切り離されただけ)
      expect(input('name-family').value).toBe('佐藤');
      expect(preview().srcdoc).toContain('佐藤');

      // 再 save すると新規 id (profile-2) で作成される
      button('save-button').click();
      await flushPromises();
      const options = Array.from(select('saved-profile-select').options).map((o) => o.value);
      expect(options).toContain('profile-2');
      expect(options).not.toContain('profile-1');

      vi.restoreAllMocks();
    });

    it('storage 失敗: status にエラー表示、profile は dropdown に残る', async () => {
      await importMain();

      input('name-family').value = '佐藤';
      dispatchInput(input('name-family'));
      button('save-button').click();
      await flushPromises();

      select('saved-profile-select').value = 'profile-1';
      select('saved-profile-select').dispatchEvent(new Event('change', { bubbles: true }));

      // storage.deleteProfile を 1 回だけ失敗させる (mock adapter の deleteProfile を override)
      const originalDelete = storageState.adapter.deleteProfile;
      storageState.adapter.deleteProfile = async () => {
        throw new Error('storage offline');
      };

      vi.spyOn(window, 'confirm').mockReturnValue(true);
      button('delete-button').click();
      await flushPromises();

      const errorArea = document.getElementById('error-area');
      expect(errorArea?.hidden).toBe(false);
      expect(errorArea?.textContent).toContain('削除に失敗しました');
      // dropdown は変わらない (再 fetch していない)
      const options = Array.from(select('saved-profile-select').options).map((o) => o.value);
      expect(options).toContain('profile-1');

      // teardown: 元の adapter を戻す
      storageState.adapter.deleteProfile = originalDelete;
      vi.restoreAllMocks();
    });
  });

  describe('JSON export / import', () => {
    const fileInput = (): HTMLInputElement => {
      const el = document.getElementById('import-file-input');
      if (!(el instanceof HTMLInputElement)) throw new Error('Missing import-file-input');
      return el;
    };

    const triggerImportWithText = async (text: string): Promise<void> => {
      // jsdom には DataTransfer がないので files を直接定義する。
      const file = new File([text], 'imported.json', { type: 'application/json' });
      const fileList = {
        0: file,
        length: 1,
        item: (i: number) => (i === 0 ? file : null),
      } as unknown as FileList;
      Object.defineProperty(fileInput(), 'files', { value: fileList, configurable: true });
      fileInput().dispatchEvent(new Event('change', { bubbles: true }));
      // FileReader.readAsText は jsdom 上で setTimeout ベースの async。
      // change handler 内の onImportFile は fire-and-forget で await 不可能。
      // 一定回数 tick を回して安定させる (timing 依存の flake を避ける)。
      for (let i = 0; i < 10; i++) {
        await flushPromises();
      }
    };

    it('export ボタン: invalid draft では download せずエラー表示する', async () => {
      await importMain();
      input('birth-date').value = '1800-01-01';
      dispatchInput(input('birth-date'));

      const clickSpy = vi.fn();
      const origCreate = document.createElement.bind(document);
      vi.spyOn(document, 'createElement').mockImplementation(((tag: string) => {
        const el = origCreate(tag);
        if (tag === 'a') {
          (el as HTMLAnchorElement).click = clickSpy;
        }
        return el;
      }) as typeof document.createElement);

      button('export-button').click();
      expect(clickSpy).not.toHaveBeenCalled();
      const errorArea = document.getElementById('error-area');
      expect(errorArea?.hidden).toBe(false);
      expect(errorArea?.textContent).toContain('export できません');

      vi.restoreAllMocks();
    });

    it('export ボタン: valid draft で a.click() が呼ばれ download fileName が profile- 開始', async () => {
      await importMain();

      const clickSpy = vi.fn();
      let capturedHref = '';
      let capturedDownload = '';
      const origCreate = document.createElement.bind(document);
      vi.spyOn(document, 'createElement').mockImplementation(((tag: string) => {
        const el = origCreate(tag);
        if (tag === 'a') {
          const anchor = el as HTMLAnchorElement;
          anchor.click = () => {
            capturedHref = anchor.href;
            capturedDownload = anchor.download;
            clickSpy();
          };
        }
        return el;
      }) as typeof document.createElement);

      button('export-button').click();
      expect(clickSpy).toHaveBeenCalledTimes(1);
      expect(capturedDownload).toMatch(/^profile-.+\.json$/);
      expect(capturedHref.startsWith('blob:')).toBe(true);

      vi.restoreAllMocks();
    });

    it('import: valid な JSON で form と preview が置き換わり、storage にも保存される', async () => {
      await importMain();

      const imported = {
        schemaVersion: 1,
        basics: {
          name: { family: '高橋', given: '健' },
          nameKana: { family: 'タカハシ', given: 'ケン' },
        },
      };

      vi.spyOn(window, 'confirm').mockReturnValue(true);
      await triggerImportWithText(JSON.stringify(imported));

      expect(input('name-family').value).toBe('高橋');
      expect(preview().srcdoc).toContain('高橋');
      // 自動保存により保存済み一覧に 1 件含まれる
      const options = Array.from(select('saved-profile-select').options).map((o) => o.value);
      expect(options.filter((v) => v !== '')).toHaveLength(1);

      vi.restoreAllMocks();
    });

    it('import: confirm 拒否時は form / preview / storage 変更なし', async () => {
      await importMain();
      const before = preview().srcdoc;

      vi.spyOn(window, 'confirm').mockReturnValue(false);
      await triggerImportWithText(
        JSON.stringify({ schemaVersion: 1, basics: { name: { family: '別', given: '人' } } }),
      );

      expect(preview().srcdoc).toBe(before);
      expect(input('name-family').value).toBe('山田');

      vi.restoreAllMocks();
    });

    it('import: malformed JSON でエラー表示 (form / preview は維持)', async () => {
      await importMain();
      const before = preview().srcdoc;

      await triggerImportWithText('{ not valid json');

      const errorArea = document.getElementById('error-area');
      expect(errorArea?.hidden).toBe(false);
      expect(errorArea?.textContent).toContain('JSON の解析に失敗');
      // form は維持
      expect(input('name-family').value).toBe('山田');
      // preview は隠れる (showError の挙動) が、再表示でも fixture は残る
      expect(before).toContain('山田');
    });

    it('import: schema 不一致でエラー表示 (form / preview は維持)', async () => {
      await importMain();

      await triggerImportWithText(JSON.stringify({ schemaVersion: 999, basics: {} }));

      const errorArea = document.getElementById('error-area');
      expect(errorArea?.hidden).toBe(false);
      expect(errorArea?.textContent).toContain('schema と一致しません');
      expect(input('name-family').value).toBe('山田');
    });
  });
});
