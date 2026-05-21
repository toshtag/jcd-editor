export { StorageError, type StorageErrorCode } from './errors';
export type {
  SaveProfileInput,
  StoragePort,
  StoredProfile,
  StoredProfileId,
  StoredProfileMetadata,
} from './storage-port';
export {
  createIndexedDbStorageAdapter,
  type IndexedDbStorageAdapterOptions,
} from './adapters/indexeddb-storage-adapter';
