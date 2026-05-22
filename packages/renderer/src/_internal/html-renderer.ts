// Template-internal HTML rendering helpers. Used by built-in templates
// (shokumukeirekisho-basic 等)。Not part of the public API.
//
// Note: 履歴書系 (rirekisho-mhlw-a3 / rirekisho-mhlw-a4) は table / section
// helper を使わず、ground truth 罫線を position: absolute で直接配置する
// 別アーキテクチャ。本 helper は引き続き shokumukeirekisho 側で利用される。
//
// 責務分割 (template-format.ts との対比):
//
// - template-format.ts: raw display string を返す helper (formatYearMonth /
//   formatDate / formatPeriod / formatAddress) + type guard (isNonEmpty)。
//   caller が HTML 挿入時に escapeHtml を通す。
//
// - html-renderer.ts (本ファイル): HTML fragment を組み立てる helper。
//   - renderTextList: raw string array を受け取り、helper 内で escape して
//     <ul><li>...</li></ul> を返す (caller は再 escape しない)。
//   - renderItemList: caller が既に組み立てた <li> array を <ul> で wrap
//     (helper は escape しない、既に safe HTML)。
//   - renderListItem: head + detail array から <li> を構築 (両 array とも
//     caller が escape 済み、helper 内で filter / escape しない)。
//   - renderSection: <section class="..."><h2>...</h2>${bodyHtml}</section>
//     を組み立て、bodyHtml === '' なら '' を返す。heading は defensive
//     escape (現状 caller は固定 phrase のみ渡す)。
//
// すべての helper は output-preserving であり、既存 template の HTML 出力を
// byte-for-byte 同一に保つ目的で設計されている。

import { escapeHtml } from './html-escape';
import { isNonEmpty } from './template-format';

type RenderSectionParams = {
  /**
   * Class name prefix (e.g. 'jcd-rirekisho' / 'jcd-shokumukeirekisho').
   * 固定 literal のみ。user data から構築しない。
   */
  baseClass: string;
  /**
   * Section variant suffix (e.g. 'skills' / 'work' / 'history').
   * 固定 literal のみ。user data から構築しない。
   */
  variant: string;
  /**
   * Section heading text. helper 内で escapeHtml を適用する (defensive、
   * 現状 caller は固定 Japanese phrase のみ渡す)。
   */
  heading: string;
  /**
   * Section body の HTML fragment。caller が既に escape 済みの safe HTML。
   * helper 内で再 escape しない。
   * `''` の場合は section ごと描画しない (early return)。
   */
  bodyHtml: string;
};

/**
 * Section wrapper を組み立てる。
 *
 * `<section class="${baseClass}__section ${baseClass}__section--${variant}"><h2>${heading}</h2>${bodyHtml}</section>`
 *
 * bodyHtml が空文字列なら '' を返す (空 section を出さない)。
 * heading は defensive に escapeHtml を通す。
 */
export const renderSection = (params: RenderSectionParams): string => {
  if (params.bodyHtml === '') return '';
  return `<section class="${params.baseClass}__section ${params.baseClass}__section--${params.variant}"><h2>${escapeHtml(params.heading)}</h2>${params.bodyHtml}</section>`;
};

/**
 * Pre-rendered list items を <ul> で wrap する。
 *
 * 契約:
 * - items は caller が既に組み立てた `<li>...</li>` の HTML fragment array。
 * - helper 内で escape しない (`<li>` tag が含まれるため escape したら破壊される)。
 * - 空文字列 item は filter で除外 (caller の早期 return と整合)。
 * - 全 item が空 (または配列自体が空) なら '' を返す (section 側で skip 判定可能)。
 */
export const renderItemList = (items: readonly string[]): string => {
  const valid = items.filter((item) => item.length > 0);
  if (valid.length === 0) return '';
  return `<ul>${valid.join('')}</ul>`;
};

/**
 * head と detail の連結で <li> を構築する。
 *
 * 契約 (重要、output preservation のため):
 * - head / detail には、**caller 側で既存実装と同じ条件で filter 済み**の
 *   already-safe HTML fragment を渡す。
 * - helper 内では head / detail の filter は行わない。
 * - これは既存出力の whitespace / join 結果を byte-for-byte 保つため。
 *   helper 内で勝手に filter すると、`['', 'foo']` を渡された場合に
 *   現行実装 (`['', 'foo'].join(' ') === ' foo'`) と挙動が変わる。
 *
 * 結合ルール:
 * - head 各要素は **半角スペース** で結合 (`head.join(' ')`)
 * - detail 各要素は **区切りなし** で結合 (`detail.join('')`)
 *
 * 両方空 (length 0 / length 0) なら '' を返す。
 */
export const renderListItem = (head: readonly string[], detail: readonly string[]): string => {
  if (head.length === 0 && detail.length === 0) return '';
  return `<li>${head.join(' ')}${detail.join('')}</li>`;
};

/**
 * raw string items を <ul><li>escapedItem</li></ul> として描画する safe HTML
 * fragment を返す。
 *
 * 契約:
 * - items は raw string (caller は escape しない、helper 内で escapeHtml 適用)。
 * - caller は戻り値を **再 escape しない** (safe HTML fragment)。
 * - undefined / 空配列 / 全要素 isNonEmpty で false なら '' を返す。
 * - filter は `template-format.ts` の `isNonEmpty` predicate を **そのまま
 *   再利用** する (predicate 実装の変更に追従、byte-for-byte 挙動保証)。
 *
 * `_internal/template-format.ts` から本ファイルに移動した経緯:
 * - `<ul>` / `<li>` を返す helper は HTML rendering 系の責務で、format 系
 *   (raw string 返却) と分離するのが自然。
 * - 既存挙動を完全保持 (実装をそのままコピー、import path のみ更新)。
 */
export const renderTextList = (items: readonly string[] | undefined): string => {
  if (items === undefined) return '';
  const valid = items.filter(isNonEmpty);
  if (valid.length === 0) return '';
  return `<ul>${valid.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
};
