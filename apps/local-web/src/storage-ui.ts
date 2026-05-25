// Storage UI helper。`<select>` option の label format を pure function として
// 切り出し、main.ts の DOM wiring から分離 / test 可能にする。
//
// 設計判断:
//
// - バージョン一覧は「宛先・用途名」を主軸に表示する (例「A 社用 — 確定 5/25」)
//   - 名前が空なら「(名称未設定)」
//   - 未確定 (isCommitted=false) なら「● 未確定」マークを付ける
//   - 確定済みなら確定日時、未確定なら更新日時を添える
// - profile body は label に含めない (privacy + 表示量、StoredProfileMetadata
//   のみを受け取る型 signature で構造的に保証)

import { isCommitted, type StoredProfileMetadata } from '@jcd-editor/storage';

const formatDateTime = (iso: string): string => {
  const date = new Date(iso);
  const yyyy = String(date.getFullYear());
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mi = String(date.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
};

export const formatStoredProfileOption = (metadata: StoredProfileMetadata): string => {
  const name = metadata.name.trim() === '' ? '(名称未設定)' : metadata.name;
  const committed = isCommitted(metadata);
  const mark = committed ? '' : ' ● 未確定';
  const stamp =
    committed && metadata.committedAt !== undefined
      ? `確定 ${formatDateTime(metadata.committedAt)}`
      : `更新 ${formatDateTime(metadata.updatedAt)}`;
  return `${name}${mark} — ${stamp}`;
};
