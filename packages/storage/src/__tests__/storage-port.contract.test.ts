// StoragePort contract tests。
//
// 本 PR は port + 型 + error + contract のみで、実 storage adapter は含まない。
// contract を表現するため test 内に in-memory fake adapter を実装する。
// fake は public export せず本 file 内に閉じる (PR #20 流儀)。
//
// deterministic に: injectable counter ベースの clock / id generator を使い、
// timestamp / id を `Date.now()` / `crypto.randomUUID()` 等の non-deterministic
// API から切り離す。
//
// minimal CareerProfile fixture は safeParseCareerProfile({ schemaVersion: 1, basics: {} })
// で inline 生成 (apps/local-web の sample-profile を import しない、
// packages → apps 依存禁止)。

import { describe, expect, it } from 'vitest';

import { safeParseCareerProfile, type CareerProfile } from '@jcd-editor/core';

import { StorageError } from '../errors';
import { isCommitted } from '../storage-port';
import type {
  SaveProfileInput,
  StoragePort,
  StoredProfile,
  StoredProfileId,
  StoredProfileMetadata,
} from '../storage-port';

// minimal valid CareerProfile を 1 度だけ生成 (テスト間で参照共有、mutate しない)
const buildValidProfile = (): CareerProfile => {
  const result = safeParseCareerProfile({ schemaVersion: 1, basics: {} });
  if (!result.success) {
    throw new Error(`test fixture invalid: ${JSON.stringify(result.issues)}`);
  }
  return result.data;
};

const createTestClock = (): { now: () => string } => {
  let counter = 0;
  return {
    now: () => {
      counter += 1;
      return `2026-01-01T00:00:${String(counter).padStart(2, '0')}.000Z`;
    },
  };
};

const createTestIdGenerator = (): (() => StoredProfileId) => {
  let counter = 0;
  return () => {
    counter += 1;
    return `profile-${counter}`;
  };
};

const createInMemoryStoragePort = (options: {
  now: () => string;
  generateId: () => StoredProfileId;
}): StoragePort => {
  const store = new Map<StoredProfileId, StoredProfile>();
  return {
    async saveProfile(input) {
      const id = input.id ?? options.generateId();
      const nowIso = options.now();
      const existing = store.get(id);
      const existingCommittedAt = existing?.metadata.committedAt;
      const stored: StoredProfile = {
        metadata: {
          id,
          name: input.name ?? existing?.metadata.name ?? '',
          createdAt: existing?.metadata.createdAt ?? nowIso,
          updatedAt: nowIso,
          ...(existingCommittedAt !== undefined ? { committedAt: existingCommittedAt } : {}),
          schemaVersion: input.profile.schemaVersion,
        },
        profile: input.profile,
      };
      store.set(id, stored);
      return stored;
    },
    async commitProfile(id) {
      const stored = store.get(id);
      if (stored === undefined) {
        throw new StorageError(`Profile not found: ${id}`, 'PROFILE_NOT_FOUND');
      }
      const updated: StoredProfile = {
        metadata: { ...stored.metadata, committedAt: stored.metadata.updatedAt },
        profile: stored.profile,
      };
      store.set(id, updated);
      return updated;
    },
    async renameProfile(id, name) {
      const stored = store.get(id);
      if (stored === undefined) {
        throw new StorageError(`Profile not found: ${id}`, 'PROFILE_NOT_FOUND');
      }
      const updated: StoredProfile = {
        metadata: { ...stored.metadata, name },
        profile: stored.profile,
      };
      store.set(id, updated);
      return updated;
    },
    async loadProfile(id) {
      const stored = store.get(id);
      if (stored === undefined) {
        throw new StorageError(`Profile not found: ${id}`, 'PROFILE_NOT_FOUND');
      }
      return stored;
    },
    async listProfiles() {
      // updatedAt 降順 (port 契約)
      return [...store.values()]
        .map((s) => s.metadata)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    },
    async deleteProfile(id) {
      if (!store.has(id)) {
        throw new StorageError(`Profile not found: ${id}`, 'PROFILE_NOT_FOUND');
      }
      store.delete(id);
    },
  };
};

const createPort = (): StoragePort =>
  createInMemoryStoragePort({
    now: createTestClock().now,
    generateId: createTestIdGenerator(),
  });

describe('StoragePort contract: saveProfile', () => {
  it('id 省略時: adapter が新規 id を生成して create する', async () => {
    const port = createPort();
    const profile = buildValidProfile();
    const result = await port.saveProfile({ profile });
    expect(result.metadata.id).toBe('profile-1');
    expect(result.metadata.createdAt).toBe(result.metadata.updatedAt);
    expect(result.profile).toBe(profile);
  });

  it('id 指定時 (新規): 指定 id で新規作成、createdAt === updatedAt', async () => {
    const port = createPort();
    const profile = buildValidProfile();
    const input: SaveProfileInput = { id: 'my-id', profile };
    const result = await port.saveProfile(input);
    expect(result.metadata.id).toBe('my-id');
    expect(result.metadata.createdAt).toBe(result.metadata.updatedAt);
  });

  it('id 指定時 (既存): update で id / createdAt を保持し updatedAt のみ変化', async () => {
    const port = createPort();
    const profile = buildValidProfile();
    const first = await port.saveProfile({ id: 'my-id', profile });
    const second = await port.saveProfile({ id: 'my-id', profile });
    expect(second.metadata.id).toBe('my-id');
    expect(second.metadata.createdAt).toBe(first.metadata.createdAt);
    expect(second.metadata.updatedAt).not.toBe(first.metadata.updatedAt);
  });

  it('metadata.schemaVersion が profile.schemaVersion を引き写す', async () => {
    const port = createPort();
    const profile = buildValidProfile();
    const result = await port.saveProfile({ profile });
    expect(result.metadata.schemaVersion).toBe(profile.schemaVersion);
  });

  it('name 指定時は metadata.name に保存される', async () => {
    const port = createPort();
    const profile = buildValidProfile();
    const result = await port.saveProfile({ name: 'A 社用', profile });
    expect(result.metadata.name).toBe('A 社用');
  });

  it('name 省略時 (新規) は空文字', async () => {
    const port = createPort();
    const profile = buildValidProfile();
    const result = await port.saveProfile({ profile });
    expect(result.metadata.name).toBe('');
  });

  it('update で name 省略時は既存 name を保持する (自動保存で名前が消えない)', async () => {
    const port = createPort();
    const profile = buildValidProfile();
    await port.saveProfile({ id: 'my-id', name: 'A 社用', profile });
    const second = await port.saveProfile({ id: 'my-id', profile });
    expect(second.metadata.name).toBe('A 社用');
  });

  it('saveProfile は committedAt を更新しない (新規は undefined のまま)', async () => {
    const port = createPort();
    const profile = buildValidProfile();
    const result = await port.saveProfile({ profile });
    expect(result.metadata.committedAt).toBeUndefined();
  });
});

describe('isCommitted', () => {
  const base: StoredProfileMetadata = {
    id: 'x',
    name: '',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:05.000Z',
    schemaVersion: 1,
  };

  it('committedAt 未設定なら未確定 (false)', () => {
    expect(isCommitted(base)).toBe(false);
  });

  it('committedAt < updatedAt なら未確定 (確定後に自動保存された)', () => {
    expect(isCommitted({ ...base, committedAt: '2026-01-01T00:00:01.000Z' })).toBe(false);
  });

  it('committedAt === updatedAt なら確定済み', () => {
    expect(isCommitted({ ...base, committedAt: base.updatedAt })).toBe(true);
  });

  it('committedAt > updatedAt でも確定済み (rename 等で起こりうる)', () => {
    expect(isCommitted({ ...base, committedAt: '2026-01-01T00:00:09.000Z' })).toBe(true);
  });
});

describe('StoragePort contract: loadProfile', () => {
  it('存在する id を load すると直前 save した StoredProfile を返す', async () => {
    const port = createPort();
    const profile = buildValidProfile();
    const saved = await port.saveProfile({ id: 'my-id', profile });
    const loaded = await port.loadProfile('my-id');
    expect(loaded).toEqual(saved);
  });

  it('存在しない id を load すると StorageError(PROFILE_NOT_FOUND) を throw', async () => {
    const port = createPort();
    await expect(port.loadProfile('missing-id')).rejects.toBeInstanceOf(StorageError);
    await expect(port.loadProfile('missing-id')).rejects.toMatchObject({
      code: 'PROFILE_NOT_FOUND',
    });
  });
});

describe('StoragePort contract: commitProfile', () => {
  it('committedAt を現在の updatedAt に設定し isCommitted=true になる', async () => {
    const port = createPort();
    const profile = buildValidProfile();
    const saved = await port.saveProfile({ id: 'my-id', name: 'A 社用', profile });
    expect(isCommitted(saved.metadata)).toBe(false);
    const committed = await port.commitProfile('my-id');
    expect(committed.metadata.committedAt).toBe(committed.metadata.updatedAt);
    expect(isCommitted(committed.metadata)).toBe(true);
  });

  it('確定後に saveProfile すると updatedAt が進み再び未確定になる', async () => {
    const port = createPort();
    const profile = buildValidProfile();
    await port.saveProfile({ id: 'my-id', profile });
    await port.commitProfile('my-id');
    const resaved = await port.saveProfile({ id: 'my-id', profile });
    expect(isCommitted(resaved.metadata)).toBe(false);
  });

  it('存在しない id で PROFILE_NOT_FOUND', async () => {
    const port = createPort();
    await expect(port.commitProfile('missing')).rejects.toMatchObject({
      code: 'PROFILE_NOT_FOUND',
    });
  });
});

describe('StoragePort contract: renameProfile', () => {
  it('name のみ変更し updatedAt / committedAt を保つ (確定状態を壊さない)', async () => {
    const port = createPort();
    const profile = buildValidProfile();
    await port.saveProfile({ id: 'my-id', name: '旧名', profile });
    const committed = await port.commitProfile('my-id');
    const renamed = await port.renameProfile('my-id', '新名');
    expect(renamed.metadata.name).toBe('新名');
    expect(renamed.metadata.updatedAt).toBe(committed.metadata.updatedAt);
    expect(renamed.metadata.committedAt).toBe(committed.metadata.committedAt);
    expect(isCommitted(renamed.metadata)).toBe(true);
  });

  it('存在しない id で PROFILE_NOT_FOUND', async () => {
    const port = createPort();
    await expect(port.renameProfile('missing', 'x')).rejects.toMatchObject({
      code: 'PROFILE_NOT_FOUND',
    });
  });
});

describe('StoragePort contract: listProfiles', () => {
  it('空状態では空配列を返す', async () => {
    const port = createPort();
    const list = await port.listProfiles();
    expect(list).toEqual([]);
  });

  it('複数 profile を updatedAt 降順で返す (新しいものが先頭)', async () => {
    const port = createPort();
    const profile = buildValidProfile();
    await port.saveProfile({ id: 'a', profile });
    await port.saveProfile({ id: 'b', profile });
    await port.saveProfile({ id: 'c', profile });
    const list = await port.listProfiles();
    expect(list.map((m) => m.id)).toEqual(['c', 'b', 'a']);
  });

  it('返り値 metadata 配列は profile body を含まない', async () => {
    const port = createPort();
    const profile = buildValidProfile();
    await port.saveProfile({ id: 'a', profile });
    const list = await port.listProfiles();
    expect(list).toHaveLength(1);
    const item = list[0];
    expect(item).toBeDefined();
    if (item !== undefined) {
      expect('profile' in item).toBe(false);
      expect('metadata' in item).toBe(false); // metadata 全体ではなく、metadata の field を直接持つ
      expect(item.id).toBe('a');
    }
  });
});

describe('StoragePort contract: deleteProfile', () => {
  it('存在する id を delete すると以後の load が PROFILE_NOT_FOUND を throw', async () => {
    const port = createPort();
    const profile = buildValidProfile();
    await port.saveProfile({ id: 'my-id', profile });
    await port.deleteProfile('my-id');
    await expect(port.loadProfile('my-id')).rejects.toMatchObject({
      code: 'PROFILE_NOT_FOUND',
    });
  });

  it('存在しない id を delete すると StorageError(PROFILE_NOT_FOUND) を throw', async () => {
    const port = createPort();
    await expect(port.deleteProfile('missing-id')).rejects.toBeInstanceOf(StorageError);
    await expect(port.deleteProfile('missing-id')).rejects.toMatchObject({
      code: 'PROFILE_NOT_FOUND',
    });
  });
});

describe('StoragePort contract: exactOptionalPropertyTypes 整合', () => {
  it('id 未指定の SaveProfileInput が conditional spread で正しく扱える (caller pattern)', async () => {
    const port = createPort();
    const profile = buildValidProfile();
    // caller pattern: id が undefined の場合に conditional spread で field を omit
    const id: string | undefined = undefined;
    const input: SaveProfileInput = {
      profile,
      ...(id !== undefined ? { id } : {}),
    };
    const result = await port.saveProfile(input);
    expect(result.metadata.id).toMatch(/^profile-\d+$/);
  });
});

// 型レベルの sanity check (compile-time のみ、test runtime には影響しない)。
// list 戻り値が readonly metadata array であることを TS でしか確認できない。
describe('StoragePort contract: type-level shape', () => {
  it('StoredProfileMetadata は id / createdAt / updatedAt / schemaVersion を持つ', async () => {
    const port = createPort();
    const profile = buildValidProfile();
    await port.saveProfile({ id: 'a', profile });
    const list: readonly StoredProfileMetadata[] = await port.listProfiles();
    const item = list[0];
    expect(item).toBeDefined();
    if (item !== undefined) {
      expect(typeof item.id).toBe('string');
      expect(typeof item.createdAt).toBe('string');
      expect(typeof item.updatedAt).toBe('string');
      expect(typeof item.schemaVersion).toBe('number');
    }
  });
});
