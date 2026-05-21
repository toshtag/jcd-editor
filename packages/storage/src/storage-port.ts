// Storage port + 型定義。本 package は port + 型 + error + contract tests のみで、
// 実 storage adapter は含まない。本 PR で導入される shape は **provisional** であり、
// 実 adapter PR (`feat/storage-indexeddb-adapter` / `feat/storage-filesystem-adapter` 等)
// で実装目線の見直しを行い、後方互換しない変更を許容する。
//
// 設計判断:
//
// - **`StoragePort`** という名前は ARCHITECTURE.md / ROADMAP.md と整合
//   (hexagonal architecture の `*Port` 命名、`PdfPort` と同じ流儀)
// - method は `saveProfile` / `loadProfile` / `listProfiles` / `deleteProfile`
//   の 4 つ (最小 CRUD)
// - `saveProfile` は単一 method (upsert): `id` の有無で create / update を区別、
//   SQL UPSERT に近い semantics
// - `id` 生成 / `createdAt` / `updatedAt` は adapter 任せ (port は generator を
//   持たない、test では injectable counter / clock で deterministic 化)
// - `listProfiles` の order は `updatedAt` 降順 を port 契約 (UI が信頼できる
//   order を持てる)
// - `loadProfile` / `deleteProfile` が missing id を渡された場合は
//   `PROFILE_NOT_FOUND` を throw (silent no-op は UI bug を隠す)
// - `metadata.schemaVersion` は `number` で受ける (literal `1` ではない、将来の
//   migration を見据えた設計、metadata だけ古い v1 のままでも store できる)
// - `StoredProfileId` は plain `string` (brand しない、surface 最小)
// - options 型は本 PR で定義しない (YAGNI、adapter が必要なら別 PR で追加)
//
// 依存方向:
//
// - `@jcd-editor/storage` → `@jcd-editor/core` (本ファイルが type-only import)
// - core から本 package への逆依存は禁止
// - renderer / pdf / templates / apps への参照禁止 (storage は app に依存しない)
//
// 本 PR で扱わないもの:
//
// - 実 storage adapter (localStorage / IndexedDB / FileSystemAccess / Node fs)
// - invalid draft (raw input) の保存 — 格納対象は parsed `CareerProfile` のみ
// - migration / versioning / encryption / compression / sync / cloud

import type { CareerProfile } from '@jcd-editor/core';

export type StoredProfileId = string;

export type StoredProfileMetadata = {
  id: StoredProfileId;
  createdAt: string;
  updatedAt: string;
  schemaVersion: number;
};

export type StoredProfile = {
  metadata: StoredProfileMetadata;
  profile: CareerProfile;
};

export type SaveProfileInput = {
  id?: StoredProfileId;
  profile: CareerProfile;
};

export type StoragePort = {
  saveProfile(input: SaveProfileInput): Promise<StoredProfile>;
  loadProfile(id: StoredProfileId): Promise<StoredProfile>;
  listProfiles(): Promise<readonly StoredProfileMetadata[]>;
  deleteProfile(id: StoredProfileId): Promise<void>;
};
