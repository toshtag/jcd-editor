// Profile photo helpers (apps/local-web)。
//
// 役割:
//   - 証明写真 (basics.profilePhoto.source) の input 検証を pure function で提供する
//   - 受け入れ可能な MIME type / ファイルサイズの判定
//
// 責務分離 (profile-io.ts と同じ):
//   - 本 module は pure function に限定。FileReader / DOM API は触らない
//   - main.ts 側で FileReader.readAsDataURL を実行し、本 module の validatePhotoFile
//     を事前検証として呼び出す
//
// schema (packages/core/src/domain/profile-photo.ts) との関係:
//   - core の dataUri は max 5,000,000 chars
//   - base64 化で raw bytes が約 4/3 倍に膨らむため、raw file 上限は ~3.75 MB
//   - 安全側に倒し 3 MB を local-web 側の上限とする (典型的な 履歴書 写真の
//     必要サイズ 100〜500 KB に対し十分。リサイズせず phone 撮影画像を投入
//     したケースは reject される)
//   - MIME type は core の ProfilePhotoMediaType ('image/jpeg' | 'image/png')
//     と同期する

import type { ProfilePhotoMediaType } from '@jcd-editor/core';

export const ALLOWED_PHOTO_MIME_TYPES: readonly ProfilePhotoMediaType[] = [
  'image/jpeg',
  'image/png',
];

export const MAX_PHOTO_FILE_BYTES = 3_000_000;

export type PhotoValidationResult =
  | { ok: true }
  | {
      ok: false;
      reason: 'invalid-mime' | 'too-large';
      message: string;
    };

const isAllowedMimeType = (value: string): value is ProfilePhotoMediaType =>
  (ALLOWED_PHOTO_MIME_TYPES as readonly string[]).includes(value);

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

/**
 * File を読み込む前の事前検証 pure 関数。
 *
 * MIME type と file size を確認し、不適合なら理由付きで reject する。
 * data URI 化は caller (main.ts) が FileReader.readAsDataURL で行う。
 */
export const validatePhotoFile = (file: File): PhotoValidationResult => {
  if (!isAllowedMimeType(file.type)) {
    return {
      ok: false,
      reason: 'invalid-mime',
      message: `${file.type === '' ? '(MIME type 未指定)' : file.type} は対応していません。image/jpeg または image/png を選んでください。`,
    };
  }
  if (file.size > MAX_PHOTO_FILE_BYTES) {
    return {
      ok: false,
      reason: 'too-large',
      message: `ファイルサイズ ${formatBytes(file.size)} は上限 ${formatBytes(MAX_PHOTO_FILE_BYTES)} を超えています。リサイズしてから再度お試しください。`,
    };
  }
  return { ok: true };
};
