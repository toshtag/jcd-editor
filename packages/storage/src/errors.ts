// Storage に関連する error。
//
// 本 package は port / 型 / error / contract tests に加えて、IndexedDB adapter
// (`createIndexedDbStorageAdapter`) を `adapters/` 配下に含む。将来別アダプタ
// (Node fs / FileSystemAccess 等) を追加する場合は同じ port を実装する形で
// 同 package 内 (または別 package) に置く。
//
// `PdfError` / `RendererError` と同じ流儀:
//   - constructor (message, code) のみ、cause field なし
//   - `name` 明示設定 + `Object.setPrototypeOf` で instanceof 安定化
//
// `PROFILE_CORRUPT` は、永続化済み profile が現行 core schema を満たさない場合に使う
// (例: schema 進化、IndexedDB の手動編集、別バージョンからのデータ移行)。
// 汎用 IO failure code (QUOTA_EXCEEDED / LOCKED 等) は、adapter UX 問題が具体化
// した段階で追加する。

export type StorageErrorCode = 'PROFILE_NOT_FOUND' | 'PROFILE_CORRUPT';

export class StorageError extends Error {
  readonly code: StorageErrorCode;

  constructor(message: string, code: StorageErrorCode) {
    super(message);
    this.name = 'StorageError';
    this.code = code;
    Object.setPrototypeOf(this, StorageError.prototype);
  }
}
