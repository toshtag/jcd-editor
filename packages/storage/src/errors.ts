// Storage に関連する error。
//
// 本 package は port / 型 / error / contract tests のみを定義し、実 storage
// adapter (localStorage / IndexedDB / FileSystemAccess / Node fs 等) は含まない。
// adapter PR で必要な error code を追加していく。
//
// `PdfError` / `RendererError` と同じ流儀:
//   - constructor (message, code) のみ、cause field なし
//   - `name` 明示設定 + `Object.setPrototypeOf` で instanceof 安定化
//
// 本 PR の error code は `PROFILE_NOT_FOUND` の 1 個のみ。
// `STORAGE_OPERATION_FAILED` 等の汎用 IO failure code は本 PR で実 IO を行わない
// ため public API に出さず、adapter PR で実際に必要になった段階で追加する。
// 本 package はまだ内部利用前提かつ shape は provisional のため、adapter PR で
// 見直しを許容する。

export type StorageErrorCode = 'PROFILE_NOT_FOUND';

export class StorageError extends Error {
  readonly code: StorageErrorCode;

  constructor(message: string, code: StorageErrorCode) {
    super(message);
    this.name = 'StorageError';
    this.code = code;
    Object.setPrototypeOf(this, StorageError.prototype);
  }
}
