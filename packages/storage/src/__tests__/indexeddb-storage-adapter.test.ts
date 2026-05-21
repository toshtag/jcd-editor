// IndexedDB StoragePort adapter の test。
//
// `fake-indexeddb/auto` で globalThis.indexedDB / IDBKeyRange 等を populate。
// vitest default Node 環境で動作 (jsdom / Playwright 不要)。
//
// Database isolation: 各 test (or describe block) で unique databaseName を
// 使い、test 間の state を分離。
//
// deterministic timestamp / id: options.now / options.generateId を inject
// (counter ベース)。production default の crypto.randomUUID() / new Date()
// は test では使わない。
//
// 既存 in-memory contract test (storage-port.contract.test.ts) と重複する
// contract 検証があるが、別 file に分けて PR #24 を touch しない (PR #20-21
// 流儀、refactor は別 PR)。

import 'fake-indexeddb/auto';

import { describe, expect, it } from 'vitest';

import { safeParseCareerProfile, type CareerProfile } from '@jcd-editor/core';

import { createIndexedDbStorageAdapter } from '../adapters/indexeddb-storage-adapter';
import { StorageError } from '../errors';
import type { StoragePort, StoredProfileId } from '../storage-port';

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

let dbCounter = 0;
const uniqueDatabaseName = (): string => {
  dbCounter += 1;
  return `jcd-editor-test-${dbCounter}`;
};

const createAdapter = (databaseName?: string): StoragePort =>
  createIndexedDbStorageAdapter({
    databaseName: databaseName ?? uniqueDatabaseName(),
    now: createTestClock().now,
    generateId: createTestIdGenerator(),
  });

describe('createIndexedDbStorageAdapter: saveProfile', () => {
  it('id 省略時: adapter が新規 id を生成して create する (createdAt === updatedAt)', async () => {
    const port = createAdapter();
    const profile = buildValidProfile();
    const result = await port.saveProfile({ profile });
    expect(result.metadata.id).toBe('profile-1');
    expect(result.metadata.createdAt).toBe(result.metadata.updatedAt);
    expect(result.profile).toEqual(profile);
  });

  it('id 指定時 (新規): 指定 id で新規作成、createdAt === updatedAt', async () => {
    const port = createAdapter();
    const profile = buildValidProfile();
    const result = await port.saveProfile({ id: 'my-id', profile });
    expect(result.metadata.id).toBe('my-id');
    expect(result.metadata.createdAt).toBe(result.metadata.updatedAt);
  });

  it('id 指定時 (既存): update で id / createdAt を保持し updatedAt のみ変化', async () => {
    const port = createAdapter();
    const profile = buildValidProfile();
    const first = await port.saveProfile({ id: 'my-id', profile });
    const second = await port.saveProfile({ id: 'my-id', profile });
    expect(second.metadata.id).toBe('my-id');
    expect(second.metadata.createdAt).toBe(first.metadata.createdAt);
    expect(second.metadata.updatedAt).not.toBe(first.metadata.updatedAt);
  });

  it('metadata.schemaVersion が profile.schemaVersion を引き写す', async () => {
    const port = createAdapter();
    const profile = buildValidProfile();
    const result = await port.saveProfile({ profile });
    expect(result.metadata.schemaVersion).toBe(profile.schemaVersion);
  });
});

describe('createIndexedDbStorageAdapter: loadProfile', () => {
  it('存在する id を load すると直前 save した StoredProfile を返す', async () => {
    const port = createAdapter();
    const profile = buildValidProfile();
    const saved = await port.saveProfile({ id: 'my-id', profile });
    const loaded = await port.loadProfile('my-id');
    expect(loaded).toEqual(saved);
  });

  it('存在しない id を load すると StorageError(PROFILE_NOT_FOUND) を throw', async () => {
    const port = createAdapter();
    await expect(port.loadProfile('missing-id')).rejects.toBeInstanceOf(StorageError);
    await expect(port.loadProfile('missing-id')).rejects.toMatchObject({
      code: 'PROFILE_NOT_FOUND',
    });
  });
});

describe('createIndexedDbStorageAdapter: listProfiles', () => {
  it('空状態では空配列を返す', async () => {
    const port = createAdapter();
    const list = await port.listProfiles();
    expect(list).toEqual([]);
  });

  it('複数 profile を updatedAt 降順で返す (新しいものが先頭)', async () => {
    const port = createAdapter();
    const profile = buildValidProfile();
    await port.saveProfile({ id: 'a', profile });
    await port.saveProfile({ id: 'b', profile });
    await port.saveProfile({ id: 'c', profile });
    const list = await port.listProfiles();
    expect(list.map((m) => m.id)).toEqual(['c', 'b', 'a']);
  });

  it('返り値 metadata 配列は profile body を含まない', async () => {
    const port = createAdapter();
    const profile = buildValidProfile();
    await port.saveProfile({ id: 'a', profile });
    const list = await port.listProfiles();
    expect(list).toHaveLength(1);
    const item = list[0];
    expect(item).toBeDefined();
    if (item !== undefined) {
      expect('profile' in item).toBe(false);
      expect(item.id).toBe('a');
    }
  });
});

describe('createIndexedDbStorageAdapter: deleteProfile', () => {
  it('存在する id を delete すると以後の load が PROFILE_NOT_FOUND を throw', async () => {
    const port = createAdapter();
    const profile = buildValidProfile();
    await port.saveProfile({ id: 'my-id', profile });
    await port.deleteProfile('my-id');
    await expect(port.loadProfile('my-id')).rejects.toMatchObject({
      code: 'PROFILE_NOT_FOUND',
    });
  });

  it('存在しない id を delete すると StorageError(PROFILE_NOT_FOUND) を throw', async () => {
    const port = createAdapter();
    await expect(port.deleteProfile('missing-id')).rejects.toBeInstanceOf(StorageError);
    await expect(port.deleteProfile('missing-id')).rejects.toMatchObject({
      code: 'PROFILE_NOT_FOUND',
    });
  });
});

describe('createIndexedDbStorageAdapter: persistence across adapter instances', () => {
  it('同一 databaseName で別 adapter instance を作っても保存内容を読める (browser reload simulation)', async () => {
    const dbName = uniqueDatabaseName();
    const profile = buildValidProfile();

    // 1 つ目の adapter で save
    const firstAdapter = createIndexedDbStorageAdapter({
      databaseName: dbName,
      now: createTestClock().now,
      generateId: createTestIdGenerator(),
    });
    const saved = await firstAdapter.saveProfile({ id: 'persistent-id', profile });

    // 2 つ目の adapter (別 instance、同じ databaseName) で load
    const secondAdapter = createIndexedDbStorageAdapter({
      databaseName: dbName,
      now: createTestClock().now,
      generateId: createTestIdGenerator(),
    });
    const loaded = await secondAdapter.loadProfile('persistent-id');
    expect(loaded).toEqual(saved);
  });
});

describe('createIndexedDbStorageAdapter: default options', () => {
  it('引数なしで呼ぶと default databaseName / storeName / now / generateId を使う (smoke test)', async () => {
    // default options で adapter を作成、最小操作で動作確認
    // crypto.randomUUID / Date は deterministic でないため、assert は shape のみ
    const port = createIndexedDbStorageAdapter();
    const profile = buildValidProfile();
    const result = await port.saveProfile({ profile });
    expect(typeof result.metadata.id).toBe('string');
    expect(result.metadata.id.length).toBeGreaterThan(0);
    expect(typeof result.metadata.createdAt).toBe('string');
    expect(typeof result.metadata.updatedAt).toBe('string');
    expect(result.metadata.schemaVersion).toBe(profile.schemaVersion);
    // cleanup: 同じ default DB を他 test と共有しないよう、書いた profile を削除
    await port.deleteProfile(result.metadata.id);
  });
});
