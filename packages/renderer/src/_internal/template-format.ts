// Template-internal formatting helpers. Used by built-in templates
// (rirekisho-basic, shokumukeirekisho-basic, ...). Not part of public API.
//
// 責務:
//
// - formatYearMonth / formatDate / formatPeriod / formatAddress
//   raw display string を返す。HTML へ挿入する直前に caller が
//   `escapeHtml` を必ず通すこと。helper 内では escape しない
//   (escape の責務は caller に集約、format helper は string 変換のみ)。
//
// - isNonEmpty
//   string 限定の type guard。format 系 / HTML rendering 系の両方で
//   predicate として使われる。
//
// HTML fragment 系 helper (renderTextList / renderItemList / renderListItem /
// renderSection) は `_internal/html-renderer.ts` に移動済み。format = raw
// string、html-renderer = safe HTML の責務分離を維持する。

const YEAR_MONTH_PATTERN = /^(\d{4})-(\d{2})$/;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export const formatYearMonth = (value: string): string => {
  const match = value.match(YEAR_MONTH_PATTERN);
  if (match === null) return value;
  return `${match[1]}年${Number(match[2])}月`;
};

export const formatDate = (value: string): string => {
  const match = value.match(DATE_PATTERN);
  if (match === null) return value;
  return `${match[1]}年${Number(match[2])}月${Number(match[3])}日`;
};

export const isNonEmpty = <T extends string>(value: T | undefined): value is T =>
  value !== undefined && value.length > 0;

export const formatPeriod = (
  startDate: string | undefined,
  endDate: string | undefined,
  isCurrent: boolean | undefined,
): string | undefined => {
  const start = startDate === undefined ? '' : formatYearMonth(startDate);
  const end = isCurrent === true ? '現在' : endDate === undefined ? '' : formatYearMonth(endDate);
  if (start === '' && end === '') return undefined;
  if (start === '') return end;
  if (end === '') return start;
  return `${start} - ${end}`;
};

// AddressLike は PostalAddress と structural に互換な型。core を import せずに
// 利用するためここで宣言する。
type AddressLike = {
  postalCode?: string;
  prefecture?: string;
  cityAndRest?: string;
};

export const formatAddress = (address: AddressLike): string => {
  let result = '';
  if (isNonEmpty(address.postalCode)) result += `〒${address.postalCode} `;
  if (isNonEmpty(address.prefecture)) result += address.prefecture;
  if (isNonEmpty(address.cityAndRest)) result += address.cityAndRest;
  return result;
};
