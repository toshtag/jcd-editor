// IndexedDB を使った StoragePort adapter。browser / fake-indexeddb 環境で動作。
//
// 設計判断 (本 PR 固定):
//
// - factory only export (`createIndexedDbStorageAdapter`)、class export なし
// - options で `databaseName` / `storeName` / `now` / `generateId` を injectable に
//   (test の deterministic 化、production safe defaults)
// - production default: 'jcd-editor' / 'profiles' / new Date().toISOString() /
//   crypto.randomUUID()
// - raw IndexedDB API のみ使用、idb / dexie / localforage 等の wrapper 不採用
// - profile store keyPath: 'metadata.id' (nested path)
// - metadata store keyPath: 'id'
// - listProfiles は metadata store のみを読み、profile body を展開しない
//
// transaction lifecycle (重要、auto-commit 回避):
//
// IndexedDB transaction は auto-commit がシビアで、`get` の結果を `await` してから
// 次 request を発行すると、microtask を挟んだ時点で transaction が inactive
// 化される可能性がある (real Chromium / fake-indexeddb 双方で発生しうる)。
//
// 対策:
// - saveProfile / deleteProfile では、get request の onsuccess callback **内で**
//   (synchronous tick で) put / delete を発行する
// - transaction 全体の完了は oncomplete / onerror / onabort を Promise 化
//   (`waitForTransaction`) して 1 度だけ await する
// - loadProfile / listProfiles は readonly + 単一 request のため
//   `promisifyRequest` で OK (連続 request がない → auto-commit 問題なし)
//
// error 戦略:
//
// - PROFILE_NOT_FOUND / PROFILE_CORRUPT は StorageError で wrap
// - DOMException (IDB API failure、quota exceeded、blocked 等) は wrap せず bubble

import { safeParseCareerProfile } from '@jcd-editor/core';

import { StorageError } from '../errors';
import type {
  SaveProfileInput,
  StoragePort,
  StoredProfile,
  StoredProfileId,
  StoredProfileMetadata,
} from '../storage-port';

const DEFAULT_DATABASE_NAME = 'jcd-editor';
const DEFAULT_STORE_NAME = 'profiles';
const DATABASE_VERSION = 2;

export type IndexedDbStorageAdapterOptions = {
  /** Database name. Default: 'jcd-editor' */
  databaseName?: string;
  /** Object store name. Default: 'profiles' */
  storeName?: string;
  /** Timestamp generator. Default: () => new Date().toISOString() */
  now?: () => string;
  /** ID generator for new profiles. Default: () => crypto.randomUUID() */
  generateId?: () => StoredProfileId;
};

const metadataStoreNameFor = (storeName: string): string => `${storeName}__metadata`;

const hasStoredProfileMetadata = (value: unknown): value is StoredProfile => {
  if (typeof value !== 'object' || value === null) return false;
  if (!('metadata' in value)) return false;
  const metadata = value.metadata;
  return (
    typeof metadata === 'object' &&
    metadata !== null &&
    'id' in metadata &&
    typeof metadata.id === 'string'
  );
};

const openDatabase = (
  databaseName: string,
  storeName: string,
  metadataStoreName: string,
): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, DATABASE_VERSION);
    request.onupgradeneeded = (event) => {
      const db = request.result;
      const tx = request.transaction;
      if (!db.objectStoreNames.contains(storeName)) {
        db.createObjectStore(storeName, { keyPath: 'metadata.id' });
      }
      const metadataStore = db.objectStoreNames.contains(metadataStoreName)
        ? tx?.objectStore(metadataStoreName)
        : db.createObjectStore(metadataStoreName, { keyPath: 'id' });

      if (event.oldVersion > 0 && tx !== null && metadataStore !== undefined) {
        const profileStore = tx.objectStore(storeName);
        const cursorRequest = profileStore.openCursor();
        cursorRequest.onsuccess = () => {
          const cursor = cursorRequest.result;
          if (cursor === null) return;
          if (hasStoredProfileMetadata(cursor.value)) {
            metadataStore.put(cursor.value.metadata);
          }
          cursor.continue();
        };
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

// 1 request のみの transaction で使う (readonly)
const promisifyRequest = <T>(req: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

// 連続 request の readwrite transaction で使う
const waitForTransaction = (tx: IDBTransaction): Promise<void> =>
  new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });

export const createIndexedDbStorageAdapter = (
  options: IndexedDbStorageAdapterOptions = {},
): StoragePort => {
  const databaseName = options.databaseName ?? DEFAULT_DATABASE_NAME;
  const storeName = options.storeName ?? DEFAULT_STORE_NAME;
  const metadataStoreName = metadataStoreNameFor(storeName);
  const now = options.now ?? (() => new Date().toISOString());
  const generateId = options.generateId ?? (() => crypto.randomUUID());

  let dbPromise: Promise<IDBDatabase> | undefined;
  const getDatabase = (): Promise<IDBDatabase> => {
    if (dbPromise === undefined) {
      dbPromise = openDatabase(databaseName, storeName, metadataStoreName);
    }
    return dbPromise;
  };

  const saveProfile = async (input: SaveProfileInput): Promise<StoredProfile> => {
    const db = await getDatabase();
    const tx = db.transaction([storeName, metadataStoreName], 'readwrite');
    const store = tx.objectStore(storeName);
    const metadataStore = tx.objectStore(metadataStoreName);

    const id = input.id ?? generateId();
    let stored: StoredProfile | undefined;

    const getRequest = store.get(id);
    getRequest.onsuccess = () => {
      const existing = getRequest.result as StoredProfile | undefined;
      const nowIso = now();
      // name: input 優先 → 既存保持 → '' (新規 / 旧 migration 欠損)。
      // committedAt: saveProfile では一切更新せず既存値を引き継ぐ
      //   (自動保存で updatedAt のみ進み「未確定」に転ぶ)。
      //   exactOptionalPropertyTypes 対応で conditional spread で omit する。
      const existingCommittedAt = existing?.metadata.committedAt;
      stored = {
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
      // get の onsuccess 内 (synchronous tick) で put を発行
      // → transaction が auto-commit される前に次 request がキューされる
      store.put(stored);
      metadataStore.put(stored.metadata);
    };

    await waitForTransaction(tx);

    if (stored === undefined) {
      // 通常到達しない (oncomplete までに onsuccess が走っているはず)、defensive
      throw new Error('IndexedDB save did not produce a stored profile');
    }
    return stored;
  };

  // 既存レコードの metadata を一部更新して put し直す共通ヘルパー。
  // get の onsuccess 内 (synchronous tick) で put を発行し auto-commit を回避する
  // (saveProfile / deleteProfile と同じ lifecycle)。
  const updateMetadata = async (
    id: StoredProfileId,
    updater: (metadata: StoredProfileMetadata) => StoredProfileMetadata,
  ): Promise<StoredProfile> => {
    const db = await getDatabase();
    const tx = db.transaction([storeName, metadataStoreName], 'readwrite');
    const store = tx.objectStore(storeName);
    const metadataStore = tx.objectStore(metadataStoreName);

    let updated: StoredProfile | undefined;

    const getRequest = store.get(id);
    getRequest.onsuccess = () => {
      const existing = getRequest.result as StoredProfile | undefined;
      if (existing === undefined) return; // not found は put せず、下で throw
      updated = { metadata: updater(existing.metadata), profile: existing.profile };
      store.put(updated);
      metadataStore.put(updated.metadata);
    };

    await waitForTransaction(tx);

    if (updated === undefined) {
      throw new StorageError(`Profile not found: ${id}`, 'PROFILE_NOT_FOUND');
    }
    return updated;
  };

  const commitProfile = (id: StoredProfileId): Promise<StoredProfile> =>
    // updatedAt は触らず committedAt = updatedAt にする (確定 = 「今の内容を正とする」)。
    updateMetadata(id, (m) => ({ ...m, committedAt: m.updatedAt }));

  const renameProfile = (id: StoredProfileId, name: string): Promise<StoredProfile> =>
    // name のみ変更。updatedAt / committedAt は触らない (確定状態を壊さない)。
    updateMetadata(id, (m) => ({ ...m, name }));

  const loadProfile = async (id: StoredProfileId): Promise<StoredProfile> => {
    const db = await getDatabase();
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const stored = await promisifyRequest<StoredProfile | undefined>(store.get(id));
    if (stored === undefined) {
      throw new StorageError(`Profile not found: ${id}`, 'PROFILE_NOT_FOUND');
    }
    const parsed = safeParseCareerProfile(stored.profile);
    if (!parsed.success) {
      throw new StorageError(`Stored profile is corrupt: ${id}`, 'PROFILE_CORRUPT');
    }
    return { metadata: stored.metadata, profile: parsed.data };
  };

  const listProfiles = async (): Promise<readonly StoredProfileMetadata[]> => {
    const db = await getDatabase();
    const tx = db.transaction(metadataStoreName, 'readonly');
    const store = tx.objectStore(metadataStoreName);
    const all = await promisifyRequest<StoredProfileMetadata[]>(store.getAll());
    return all.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  };

  const deleteProfile = async (id: StoredProfileId): Promise<void> => {
    const db = await getDatabase();
    const tx = db.transaction([storeName, metadataStoreName], 'readwrite');
    const store = tx.objectStore(storeName);
    const metadataStore = tx.objectStore(metadataStoreName);

    let found = false;

    const getRequest = store.get(id);
    getRequest.onsuccess = () => {
      if (getRequest.result !== undefined) {
        found = true;
        // get の onsuccess 内 (synchronous tick) で delete を発行
        store.delete(id);
        metadataStore.delete(id);
      }
      // 存在しない場合は何もしない (transaction は no-op で commit)
    };

    await waitForTransaction(tx);

    if (!found) {
      throw new StorageError(`Profile not found: ${id}`, 'PROFILE_NOT_FOUND');
    }
  };

  return { saveProfile, commitProfile, renameProfile, loadProfile, listProfiles, deleteProfile };
};
