// Storage UI helper。`<select>` option の label format を pure function として
// 切り出し、main.ts の DOM wiring から分離 / test 可能にする。
//
// 設計判断:
//
// - format 出力は `YYYY-MM-DD HH:MM:SS (id 先頭 8 文字)`
//   - updatedAt は ISO 8601 string、Date object 経由で local timezone に整形
//   - id は full UUID (36 文字) の先頭 8 文字で識別性を確保
// - profile body は label に含めない (privacy + 表示量、StoredProfileMetadata
//   のみを受け取る型 signature で構造的に保証)

import type { StoredProfileMetadata } from '@jcd-editor/storage';

export const formatStoredProfileOption = (metadata: StoredProfileMetadata): string => {
  const date = new Date(metadata.updatedAt);
  const yyyy = String(date.getFullYear());
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mi = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  const dateTime = `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
  const idPrefix = metadata.id.slice(0, 8);
  return `${dateTime} (${idPrefix})`;
};
