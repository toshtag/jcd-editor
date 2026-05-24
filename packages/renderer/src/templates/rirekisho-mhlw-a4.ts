// rirekisho-mhlw-a4 は厚生労働省「履歴書様式例 (シンプル版)」を **A4 縦 2 ページ**
// として再現する template。
//
// === A3 版との関係 ===
//
// 設計データ (mhlw-pdf-rules.json / mhlw-text-bbox.json) は A3 横 (420×297mm)
// 基準。本 A4 版は同データを使い、座標変換で A4 縦 2 ページに分割する:
//
//   - x < 210mm (公式 A3 の左ページ) → そのまま A4 page 1 (top y そのまま)
//   - x >= 210mm (公式 A3 の右ページ) → x' = x - 205.23mm, y' = y + 297mm
//
// === editable mode (Phase 2.1a で追加) ===
//
// RenderInput.editable === true のとき、user data を流し込む div に
// `contenteditable="plaintext-only"` と `data-field` 属性を付与する。
// 同じ HTML が「PDF 出力時の preview」「local-web の WYSIWYG エディタ」の
// 両方で使えることを目的とする (入力 = preview = PDF を pixel 単位で一致)。
//
// editable=true の場合の追加挙動:
//   - 値が undefined / 空でも div は出力する (= 空の編集可能セル)
//   - data-field 属性で local-web が input event を listen し CareerProfile を
//     再構築する
//   - 氏名は family + given を 全角スペース で連結した 1 セル (data-field="name")
//   - ふりがな同様 (data-field="nameKana")
//   - 生年月日 (data-field="birthDate") は YYYY-MM-DD の input、年/月/日 表示は
//     editable=false の時のみ分解する (editable=true は raw 表示)
//
// editable=false (default、PDF / preview 出力時) の挙動は従来通り。

import type { CareerProfile } from '@jcd-editor/core';

import { escapeHtml } from '../_internal/html-escape';
import {
  buildCertificationRows,
  buildEducationRows,
  buildWorkRows,
  computeAgeOnDate,
  type CertificationRow,
} from '../_internal/rirekisho-mhlw-shared';
import { isNonEmpty } from '../_internal/template-format';
import type { RenderInput } from '../render-input';
import type { RenderedDocument } from '../rendered-document';
import type { TemplateDefinition } from '../template-registry';
import pdfRules from './data/mhlw-pdf-rules.json' with { type: 'json' };
import textBbox from './data/mhlw-text-bbox.json' with { type: 'json' };

const TEMPLATE_ID = 'rirekisho-mhlw-a4';
const TEMPLATE_TITLE = '履歴書';
const PROFILE_PHOTO_DEFAULT_ALT_TEXT = '証明写真';

// === Ground truth ===

const DPI = pdfRules.dpi;
const A4_PAGE_W_MM = 210;
const A4_PAGE_H_MM = 297;

const pxToMm = (px: number): number => (px / DPI) * 25.4;

// === A3 → A4 座標変換 ===

const RIGHT_PAGE_THRESHOLD_MM = 210;
const RIGHT_PAGE_X_OFFSET_MM = 205.23; // 228.85 - 23.62
const PAGE2_Y_OFFSET_MM = 297;

// 公式 PDF は罫線範囲が用紙に対して左右上下が不均等:
//   - 左罫 23.62mm / 右罫 195.75mm (= 余白 左 23.62 / 右 14.25mm、9.37mm 差)
//   - 上罫 38.86mm / 下罫 273.90mm (= 余白 上 38.86 / 下 23.10mm、15.76mm 差)
// ユーザー指示で左右と上下を均等にするため、全座標を以下の量だけシフトする。
//   X: (210 - (195.75-23.62)) / 2 - 23.62 = 18.935 - 23.62 = -4.685mm
//   Y: (297 - (273.90-38.86)) / 2 - 38.86 = 30.98 - 38.86 = -7.88mm
const MARGIN_BALANCE_X_OFFSET_MM = -4.685;
const MARGIN_BALANCE_Y_OFFSET_MM = -7.88;

const isRightPage = (xMm: number): boolean => xMm >= RIGHT_PAGE_THRESHOLD_MM;
const transformX = (xMm: number): number =>
  (isRightPage(xMm) ? xMm - RIGHT_PAGE_X_OFFSET_MM : xMm) + MARGIN_BALANCE_X_OFFSET_MM;
const transformY = (xMm: number, yMm: number): number =>
  (isRightPage(xMm) ? yMm + PAGE2_Y_OFFSET_MM : yMm) + MARGIN_BALANCE_Y_OFFSET_MM;

const PHOTO_BOX_MM = { x: 154.77, y: 27.69, w: 30.31, h: 38.69 } as const;

const HISTORY_LAYOUT = {
  leftPage: {
    yearX: 23.62,
    monthX: 43.26,
    contentX: 52.41,
    rightEdgeX: 195.75,
    firstRowY: 137.58,
    rowHeight: 9.06,
    // 罫線実測 (y=129.96, 137.58, ..., 273.90): ヘッダー除く 15 行
    maxRows: 15,
  },
  rightPage: {
    yearX: 228.85,
    monthX: 248.5,
    contentX: 257.64,
    rightEdgeX: 400.98,
    firstRowY: 35.31,
    rowHeight: 9.06,
    // 罫線実測 (y=27.60, 35.31, ..., 98.98): ヘッダー除く 7 行
    maxRows: 7,
  },
} as const;

const CERTIFICATION_LAYOUT = {
  yearX: 228.85,
  monthX: 248.5,
  contentX: 257.64,
  rightEdgeX: 400.98,
  firstRowY: 106.6,
  rowHeight: 9.06,
  maxRows: 6,
} as const;

// 公式 box の罫線実測値:
//   summary:         x=228.85〜400.98, y=171.96〜225.98 (右ページ、A3 座標)
//   personalRequest: x=228.85〜400.98, y=237.49〜273.90
const SUMMARY_BOX_MM = { x: 228.85, y: 171.96, w: 172.13, h: 54.02 } as const;
const PERSONAL_REQUEST_BOX_MM = { x: 228.85, y: 237.49, w: 172.13, h: 36.41 } as const;

// === editable mode helpers ===
//
// `editableAttrs(field, placeholder?)` は editable=true のときだけ
// `contenteditable="plaintext-only" data-field="..." data-placeholder="..."` を
// 返す。false のときは空文字列 (= 通常の read-only div、placeholder も不要)。
// placeholder は :empty::before で表示される入力ヒント。

const editableAttrs = (editable: boolean, field: string, placeholder?: string): string => {
  if (!editable) return '';
  const placeholderAttr =
    placeholder !== undefined ? ` data-placeholder="${escapeHtml(placeholder)}"` : '';
  return ` contenteditable="plaintext-only" data-field="${field}"${placeholderAttr}`;
};

// === HTML helpers ===

type Rule = { y_px?: number; y_mm?: number; x_px?: number; x_mm?: number; spans_px: number[][] };

const renderHorizontalRule = (rule: Rule): string => {
  const y = rule.y_mm as number;
  return rule.spans_px
    .map(([s, e]) => {
      const xRaw = pxToMm(s as number);
      const wMm = pxToMm((e as number) - (s as number));
      const x = transformX(xRaw);
      const yT = transformY(xRaw, y);
      return `<div class="jcd-mhlw-a4__rule jcd-mhlw-a4__rule--h" style="left:${x.toFixed(3)}mm;top:${yT.toFixed(3)}mm;width:${wMm.toFixed(3)}mm;"></div>`;
    })
    .join('');
};

const renderVerticalRule = (rule: Rule): string => {
  const xRaw = rule.x_mm as number;
  return rule.spans_px
    .map(([s, e]) => {
      const yRaw = pxToMm(s as number);
      const hMm = pxToMm((e as number) - (s as number));
      const x = transformX(xRaw);
      const yT = transformY(xRaw, yRaw);
      return `<div class="jcd-mhlw-a4__rule jcd-mhlw-a4__rule--v" style="left:${x.toFixed(3)}mm;top:${yT.toFixed(3)}mm;height:${hMm.toFixed(3)}mm;"></div>`;
    })
    .join('');
};

// === 公式ラベル ===

type TextBlock = {
  x_mm: number;
  y_mm: number;
  w_mm: number;
  h_mm: number;
  text: string;
};

const isInsidePhotoBox = (t: TextBlock): boolean => {
  const margin = 2;
  return (
    t.x_mm >= PHOTO_BOX_MM.x - margin &&
    t.x_mm <= PHOTO_BOX_MM.x + PHOTO_BOX_MM.w + margin &&
    t.y_mm >= PHOTO_BOX_MM.y - margin &&
    t.y_mm <= PHOTO_BOX_MM.y + PHOTO_BOX_MM.h + margin
  );
};

// 公式 PDF (mhlw-rirekisho-official.pdf) を pdffonts で解析した結果、本書類は
// MS-Mincho / MS-PMincho の 2 種類の明朝のみで構成されている (ゴシック・手書き
// 風は一切使われていない)。よってラベル font 振り分けは「タイトル」と「通常」
// の 2 クラスのみとし、いずれも明朝スタック (Noto Serif JP fallback chain)
// を使う。
const labelFontClass = (text: string): string => {
  if (text === '履歴書') return 'jcd-mhlw-a4__label jcd-mhlw-a4__label--title';
  return 'jcd-mhlw-a4__label';
};

const labelFontSizePt = (text: string): number => {
  // 「履歴書」タイトルの font-size: 公式 PDF の bbox 高さ ≈ 7.07mm に収まる
  // よう 22pt にする (28pt だと bbox を縦にはみ出し、下の罫線とほぼ接する)。
  if (text === '履歴書') return 22;
  // 公式 PDF bbox h で 8pt / 9pt / 10pt を判別:
  //   - h=2.84mm = 8pt: 「※「性別」 欄...」 / 「写真をはる位置」
  //   - h=3.17mm = 9pt: 「(現住所以外に連絡を希望する場合のみ記入)」
  //   - h=3.51mm = 10pt: 「ふりがな」/ 「志望の動機…」/「本人希望記入欄…」 本体
  //   - h=3.90mm = 11pt: 大部分のタイトル (現住所 / 氏名 / 学・職 等)
  if (text.startsWith('※「性別」')) return 8;
  if (text.includes('現住所以外')) return 9;
  if (text.includes('(満') || text.includes('歳）')) return 12;
  if (text === 'ふりがな') return 10;
  return 11;
};

/**
 * ラベル文字列の HTML 出力を組み立てる。
 *
 * 特例: 「本人希望記入欄（特に給料…）」 は textBbox 上 1 ラベル文字列だが、
 * 公式の見た目では本体「本人希望記入欄」 部分と括弧内「（特に…）」 部分で
 * font-size が異なる (本体 11pt、括弧 10pt)。1 つの div 内で <span> による
 * inline 切り替えで再現する。
 */
const renderLabelText = (text: string): string => {
  // 「本人希望記入欄（…）」 形式: 「本人希望記入欄」 部分 (div の baseSize) +
  // 括弧以降 (10pt) を inline span で切り替える
  if (text.startsWith('本人希望記入欄')) {
    const m = text.match(/^(本人希望記入欄)(.*)$/);
    if (m !== null) {
      const main = escapeHtml(m[1] ?? '').replace(/\n/g, '<br>');
      const rest = escapeHtml(m[2] ?? '').replace(/\n/g, '<br>');
      if (rest !== '') {
        return `${main}<span style="font-size:10pt;">${rest}</span>`;
      }
    }
  }
  return escapeHtml(text).replace(/\n/g, '<br>');
};

/**
 * textBbox の x_mm を補正する。
 *
 * 公式 PDF 上で「志望の動機〜」 ラベルは box 左罫 (x=228.85) から 約4.39mm
 * オフセット、「本人希望記入欄〜」 ラベルは 約2.69mm オフセットと 1.7mm 不揃い。
 * ユーザー指示で左余白を統一するため、本人希望ラベルの x を志望動機側
 * (textBbox 上の x=233.239) に揃える。
 */
const adjustLabelX = (text: string, xMm: number): number => {
  if (text.startsWith('本人希望記入欄')) return 233.239;
  return xMm;
};

const renderOfficialLabels = (): string => {
  return (textBbox as TextBlock[])
    .filter((t) => !isInsidePhotoBox(t))
    .map((t) => {
      const cls = labelFontClass(t.text);
      const size = labelFontSizePt(t.text);
      const safe = renderLabelText(t.text);
      const adjustedX = adjustLabelX(t.text, t.x_mm);
      const x = transformX(adjustedX);
      const y = transformY(adjustedX, t.y_mm);
      return `<div class="${cls}" style="left:${x.toFixed(3)}mm;top:${y.toFixed(3)}mm;font-size:${size}pt;">${safe}</div>`;
    })
    .join('');
};

// === 写真欄 (左ページ = page 1、座標変換不要) ===

type ProfilePhoto = NonNullable<CareerProfile['basics']['profilePhoto']>;

const renderPhotoBox = (profilePhoto: ProfilePhoto | undefined): string => {
  const { x, y, w, h } = PHOTO_BOX_MM;
  // PHOTO_BOX_MM は元値で保持、表示時に座標変換 (左右上下余白の均等化を含む)
  const xT = transformX(x);
  const yT = transformY(x, y);
  const style = `left:${xT.toFixed(3)}mm;top:${yT.toFixed(3)}mm;width:${w}mm;height:${h}mm;`;

  const showGuide =
    profilePhoto === undefined ||
    profilePhoto.source === undefined ||
    profilePhoto.source.kind !== 'dataUri' ||
    !isNonEmpty(profilePhoto.source.dataUri);

  if (showGuide) {
    return `<div class="jcd-mhlw-a4__photo" style="${style}"><div class="jcd-mhlw-a4__photo-heading">写真をはる位置</div><div class="jcd-mhlw-a4__photo-body">写真をはる必要が<br>ある場合<br>1.&nbsp;縦<br>&nbsp;&nbsp;&nbsp;横<br>2.本人単身胸から上<br>3.裏面のりづけ</div></div>`;
  }

  const photo = profilePhoto as ProfilePhoto;
  const source = photo.source;
  if (source === undefined || source.kind !== 'dataUri') {
    return '';
  }
  const altText = isNonEmpty(photo.altText) ? photo.altText : PROFILE_PHOTO_DEFAULT_ALT_TEXT;
  return `<div class="jcd-mhlw-a4__photo jcd-mhlw-a4__photo--filled" style="${style}"><img class="jcd-mhlw-a4__photo-image" src="${escapeHtml(source.dataUri)}" alt="${escapeHtml(altText)}"></div>`;
};

// === basics 流し込み (座標変換 + editable mode 対応) ===

const placeOnA4 = (xMm: number, yMm: number): { left: string; top: string } => ({
  left: `${transformX(xMm).toFixed(3)}mm`,
  top: `${transformY(xMm, yMm).toFixed(3)}mm`,
});

/**
 * 氏名を「family + 全角スペース + given」の 1 セルとして描画する。
 * editable=true の場合、family or given が undefined でも空セルを出す。
 * editable=false の場合、family/given が両方ない (basics.name === undefined) なら出さない。
 */
const renderUserName = (basics: CareerProfile['basics'], editable: boolean): string => {
  if (!editable && basics.name === undefined) return '';
  const family = basics.name?.family ?? '';
  const given = basics.name?.given ?? '';
  // 公式様式の氏名は family と given の間に全角スペース 1 つ分の隙間
  const text = family !== '' && given !== '' ? `${family}　${given}` : `${family}${given}`;
  // 公式: 氏名セル box は罫線実測で 左罫 x=23.62, 右罫 x=139.02 (※性別境)。
  // 「氏」「名」 ラベルは同 box 内左寄せ (x=26.42 / 38.11) で y=44.80 にあるが、
  // 値の y=52 では label と縦に被らないので、セル box 全幅で text-align:center
  // にして box 中央 (x≈81.3mm) に値を配置する。font-size 24pt。
  const { left, top } = placeOnA4(23.62, 52);
  const attrs = editableAttrs(editable, 'name', '氏 名');
  return `<div class="jcd-mhlw-a4__name" style="left:${left};top:${top};font-size:24pt;min-width:115.4mm;text-align:center;"${attrs}>${escapeHtml(text)}</div>`;
};

const renderUserNameKana = (basics: CareerProfile['basics'], editable: boolean): string => {
  if (!editable && basics.nameKana === undefined) return '';
  const family = basics.nameKana?.family ?? '';
  const given = basics.nameKana?.given ?? '';
  const text = family !== '' && given !== '' ? `${family}　${given}` : `${family}${given}`;
  // 氏名ふりがな box (罫線実測): x=23.62〜139.02, y=38.86〜44.37。
  // 「ふりがな」 ラベル (x=26.21, w=14.17, font-size 9pt, y=39.87) の右端 x≈40.4
  // から 4mm の隙間を空けて値を left=46 に置く。
  // top はラベルと同じ y=39.87 に揃えて baseline を一致させる。
  const { left, top } = placeOnA4(46, 39.87);
  const attrs = editableAttrs(editable, 'nameKana', 'シメイ ふりがな');
  return `<div class="jcd-mhlw-a4__name-kana" style="left:${left};top:${top};font-size:10pt;min-width:91mm;"${attrs}>${escapeHtml(text)}</div>`;
};

/**
 * 生年月日を「年 / 月 / 日 / 満X歳」 の 4 セルに分解して描画する。
 * editable=true のとき各セルが個別の contenteditable (data-field="birthDate.year" etc.)。
 * 公式様式の「年 月 日生 (満　歳)」 ラベル位置に厳密に合わせるため、
 * editable / read-only 共通レイアウト。
 */
const renderBirthDate = (
  basics: CareerProfile['basics'],
  preparedOn: string | undefined,
  editable: boolean,
): string => {
  // basics.birthDate が undefined のときは空文字で 3 セルを構築 (editable のとき
  // 空セルが必要)。read-only mode で値が一切ないなら何も出さない。
  if (!editable && basics.birthDate === undefined) return '';
  let yStr = '';
  let mStr = '';
  let dStr = '';
  if (basics.birthDate !== undefined) {
    const m = basics.birthDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m !== null) {
      yStr = String(Number(m[1]));
      mStr = String(Number(m[2]));
      dStr = String(Number(m[3]));
    }
  }
  const ageStr =
    !editable && preparedOn !== undefined && basics.birthDate !== undefined
      ? (() => {
          const a = computeAgeOnDate(basics.birthDate as string, preparedOn);
          return a === undefined ? '' : String(a);
        })()
      : '';
  // ラベル位置 (実測): 年 x=60.63, 月 x=76.21, 日生 x=91.79, (満 x=107.36, 歳） x=122.94
  // 公式は値 → ラベルの順 (例: "1989年 1月 1日生 (満 32歳)")。
  // 値セルは label の **左** に幅を確保し、text-align: right で右寄せ → label と接する。
  const yPos = placeOnA4(46, 74.3);
  const mPos = placeOnA4(63, 74.3);
  const dPos = placeOnA4(80, 74.3);
  const aPos = placeOnA4(110, 74.3);
  const yAttrs = editableAttrs(editable, 'birthDate.year', 'YYYY');
  const mAttrs = editableAttrs(editable, 'birthDate.month', 'M');
  const dAttrs = editableAttrs(editable, 'birthDate.day', 'D');
  return (
    `<div class="jcd-mhlw-a4__birth-year" style="left:${yPos.left};top:${yPos.top};font-size:11pt;min-width:14mm;text-align:right;"${yAttrs}>${escapeHtml(yStr)}</div>` +
    `<div class="jcd-mhlw-a4__birth-month" style="left:${mPos.left};top:${mPos.top};font-size:11pt;min-width:12mm;text-align:right;"${mAttrs}>${escapeHtml(mStr)}</div>` +
    `<div class="jcd-mhlw-a4__birth-day" style="left:${dPos.left};top:${dPos.top};font-size:11pt;min-width:10mm;text-align:right;"${dAttrs}>${escapeHtml(dStr)}</div>` +
    (ageStr === ''
      ? ''
      : `<div class="jcd-mhlw-a4__age" style="left:${aPos.left};top:${aPos.top};font-size:11pt;min-width:12mm;text-align:right;">${ageStr}</div>`)
  );
};

const renderGender = (basics: CareerProfile['basics'], editable: boolean): string => {
  const v = basics.gender ?? '';
  if (!editable && !isNonEmpty(v)) return '';
  // 性別セル box (実測罫線): 左罫 x=139.02, 右罫 x=195.75, 上罫 y=71.71, 下罫 y=80.77
  // 同じ行内に ※性別 ラベル (x=139.89〜151.57, y=71.72) が左寄せヘッダーとして
  // 入っている。値はラベル右隣の空き (x≈153〜195.75) に置く。
  // y は box 中央寄り (≈74.30、生年月日と同じ baseline)。
  const { left, top } = placeOnA4(153, 74.3);
  const attrs = editableAttrs(editable, 'gender', '男性 / 女性 / 記載しない');
  return `<div class="jcd-mhlw-a4__gender" style="left:${left};top:${top};font-size:11pt;min-width:42mm;text-align:center;"${attrs}>${escapeHtml(v)}</div>`;
};

const renderPreparedOn = (preparedOn: string | undefined, editable: boolean): string => {
  if (!editable && preparedOn === undefined) return '';
  let yStr = '';
  let mStr = '';
  let dStr = '';
  if (preparedOn !== undefined) {
    const m = preparedOn.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m !== null) {
      yStr = String(Number(m[1]));
      mStr = String(Number(m[2]));
      dStr = String(Number(m[3]));
    }
  }
  // ラベル位置 (実測): 年 x=112.79, 月 x=124.22, 日現在 x=134.48 (y=31.33)
  // 公式は「YYYY 年 MM 月 DD 日現在」 の順。値セルは label の **左** に配置し
  // text-align:right で label と接する。
  // 年セル: 右端 x≈112 → left=98, min-width=14
  // 月セル: 右端 x≈124 → left=116, min-width=8
  // 日セル: 右端 x≈134 → left=126, min-width=8
  const yPos = placeOnA4(98, 31.33);
  const mPos = placeOnA4(116, 31.33);
  const dPos = placeOnA4(126, 31.33);
  const yAttrs = editableAttrs(editable, 'preparedOn.year', 'YYYY');
  const mAttrs = editableAttrs(editable, 'preparedOn.month', 'M');
  const dAttrs = editableAttrs(editable, 'preparedOn.day', 'D');
  return (
    `<div class="jcd-mhlw-a4__prepared-year" style="left:${yPos.left};top:${yPos.top};font-size:11pt;min-width:14mm;text-align:right;"${yAttrs}>${escapeHtml(yStr)}</div>` +
    `<div class="jcd-mhlw-a4__prepared-month" style="left:${mPos.left};top:${mPos.top};font-size:11pt;min-width:8mm;text-align:right;"${mAttrs}>${escapeHtml(mStr)}</div>` +
    `<div class="jcd-mhlw-a4__prepared-day" style="left:${dPos.left};top:${dPos.top};font-size:11pt;min-width:8mm;text-align:right;"${dAttrs}>${escapeHtml(dStr)}</div>`
  );
};

/**
 * 住所欄を「ふりがな + 郵便番号 + 住所本文 + 電話」 4 セルとして描画する。
 * 公式様式に合わせ、郵便番号と住所本文は別セル (〒 ラベルはテンプレート側に
 * 既に描画されているので user セルには含めない)。
 *
 * editable mode の data-field:
 *   - addressKana / contactAddressKana
 *   - address.postalCode / contactAddress.postalCode (例: "105-0013")
 *   - address.full / contactAddress.full (郵便番号を除いた住所本文)
 *   - phone / contactPhone
 *
 * 公式 PDF の構造:
 *   - 「現住所 〒」 ラベル (x≈26mm) の右に郵便番号セル (x≈58mm)
 *   - 改行 (1 行下) して住所本文セル (x≈40mm から幅広)
 *   - ふりがなは住所欄の上端 (kana の y は住所上端 -5mm)
 */
const renderAddressBlock = (
  prefix: string,
  kanaY: number, // ふりがな ラベル / 値 の y (公式 textBbox の y_mm と同じ)
  postalY: number, // 郵便番号 (and 〒 ラベルの y、住所欄上端)
  fullY: number, // 住所本文 (改行後) の y
  address: CareerProfile['basics']['address'],
  addressKana: string | undefined,
  phone: string | undefined,
  editable: boolean,
  fieldPrefix: string,
): string => {
  let html = '';

  // ふりがな (kana) - ふりがな box (罫線実測): 住所欄上端の 1 段上の細い帯。
  // 「ふりがな」 ラベル (x=26.21, w=14.17, font-size 9pt) の右端 x≈40.4 から
  // 4mm の隙間を空けて left=46。top はラベル top と同じ kanaY に置いて、
  // ラベル baseline と値 baseline を揃える。
  const kanaVal = addressKana ?? '';
  if (editable || isNonEmpty(kanaVal)) {
    const { left, top } = placeOnA4(46, kanaY);
    const attrs = editableAttrs(editable, `${fieldPrefix}Kana`, '住所ふりがな');
    html += `<div class="jcd-mhlw-a4__${prefix}-kana" style="left:${left};top:${top};font-size:10pt;min-width:111mm;"${attrs}>${escapeHtml(kanaVal)}</div>`;
  }

  // 郵便番号 (例 "105-0013")、〒 はラベルとして固定描画されているので user は番号のみ。
  // 〒 ラベル (x=42.00, w=3.90) の右端 ≈46mm のすぐ横に置く。
  const postal = address?.postalCode ?? '';
  if (editable || isNonEmpty(postal)) {
    const { left, top } = placeOnA4(47, postalY);
    const attrs = editableAttrs(editable, `${fieldPrefix}.postalCode`, '000-0000');
    html += `<div class="jcd-mhlw-a4__${prefix}-postal" style="left:${left};top:${top};font-size:11pt;min-width:25mm;"${attrs}>${escapeHtml(postal)}</div>`;
  }

  // 住所本文 (郵便番号を除く)。core では prefecture + cityAndRest だが、UI 上は
  // 1 セルで「東京都港区...」と書く。data-field="address.full" として user に
  // 渡し、local-web は parseAddressFull で逆変換。
  const addressFull =
    address === undefined
      ? ''
      : [address.prefecture, address.cityAndRest]
          .filter((s) => s !== undefined && s !== '')
          .join('');
  if (editable || isNonEmpty(addressFull)) {
    const { left, top } = placeOnA4(30, fullY);
    const attrs = editableAttrs(editable, `${fieldPrefix}.full`, '都道府県 市区町村 番地');
    html += `<div class="jcd-mhlw-a4__${prefix}" style="left:${left};top:${top};font-size:11pt;min-width:130mm;"${attrs}>${escapeHtml(addressFull)}</div>`;
  }

  // 電話 box (罫線実測): x=160.44〜195.75 (w=35.31), y=postalY-6.24〜postalY+16.45。
  // 「電話」 ラベル (x=163.25, y=postalY-5.22) の下、box 縦中央寄りに値を置く。
  // 値は box 全幅で text-align:center し、box 横中央 (≈x=178) に表示。
  const phoneVal = phone ?? '';
  if (editable || isNonEmpty(phoneVal)) {
    const { left, top } = placeOnA4(160.44, postalY + 4);
    const phoneField = fieldPrefix === 'address' ? 'phone' : 'contactPhone';
    const attrs = editableAttrs(editable, phoneField, '000-0000-0000');
    html += `<div class="jcd-mhlw-a4__${prefix}-phone" style="left:${left};top:${top};font-size:11pt;min-width:35.31mm;text-align:center;"${attrs}>${escapeHtml(phoneVal)}</div>`;
  }
  return html;
};

const renderAddress = (basics: CareerProfile['basics'], editable: boolean): string => {
  // 公式 textBbox のラベル位置 (y_mm):
  //   現住所: ふりがな y=81.95, 〒/現住所 y=87.01, 住所本文 (改行) y=94
  //   連絡先: ふりがな y=104.48, 〒/連絡先 y=109.66, 住所本文 (改行) y=116
  return (
    renderAddressBlock(
      'address',
      81.95,
      87,
      94,
      basics.address,
      basics.addressKana,
      basics.phone,
      editable,
      'address',
    ) +
    renderAddressBlock(
      'contact-address',
      104.48,
      109.66,
      116,
      basics.contactAddress,
      basics.contactAddressKana,
      basics.contactPhone,
      editable,
      'contactAddress',
    )
  );
};

// === 学歴・職歴 表 (Phase 2.1b で editable mode 対応) ===
//
// historyRows が存在すればそれを優先 (WYSIWYG エディタの出力)。
// 未指定なら educationHistory + workExperiences から旧来通り合成する。

type HistoryRowOrEntry =
  | { kind: 'heading'; label: '学歴' | '職歴' }
  | {
      kind: 'entry';
      year: string;
      month: string;
      content: string;
      // editable mode で WYSIWYG 側の historyRows array index を data-field に
      // 反映するため、source row index を保持する。
      sourceIndex?: number;
    };

// 行内の縦中央寄せオフセット (mm)。罫線で囲まれた行 box (rowHeight=9.06mm) に
// 対し、font-size 11pt (≈ cap 高 3.9mm + ascender/descender) のテキストを
// box の縦中央に置くには top に約 2.4mm のオフセットを足す必要がある。
// (rowHeight - text 表示高 ≈ 4.27) / 2 ≈ 2.4
const ROW_VERTICAL_CENTER_OFFSET_MM = 2.4;

/**
 * 学歴・職歴 内容セルの text-align を内容に応じて切り替える:
 *   - 「学歴」「職歴」: 中央寄せ (見出し行扱い)
 *   - 「以上」: 右寄せ (末尾の締め文言)
 *   - その他: 左寄せ (default、通常の本文)
 */
const contentTextAlign = (content: string): 'left' | 'center' | 'right' => {
  const trimmed = content.trim();
  if (trimmed === '学歴' || trimmed === '職歴') return 'center';
  if (trimmed === '以上') return 'right';
  return 'left';
};

const renderHistoryRowAt = (
  row: HistoryRowOrEntry,
  x: { yearX: number; monthX: number; contentX: number; rightEdgeX: number },
  yMm: number,
  editable: boolean,
): string => {
  // yMm は box の上罫 y。値テキストを box 縦中央に置くためにオフセットを足す。
  const yCentered = yMm + ROW_VERTICAL_CENTER_OFFSET_MM;
  if (row.kind === 'heading') {
    // 「学歴」「職歴」 heading: content box 全幅で中央寄せ
    const contentWidthMm = x.rightEdgeX - x.contentX;
    const { left, top } = placeOnA4(x.contentX, yCentered);
    return `<div class="jcd-mhlw-a4__history-heading" style="left:${left};top:${top};font-size:11pt;width:${contentWidthMm.toFixed(2)}mm;text-align:center;">${row.label}</div>`;
  }
  // 年セル: box 全幅 (yearX〜monthX) で text-align:center (4 桁固定なので
  // 中央揃え)。月セル: box 全幅 (monthX〜contentX) で 1〜2 桁に応じて右/中央。
  const yearWidthMm = x.monthX - x.yearX;
  const monthWidthMm = x.contentX - x.monthX;
  const contentWidthMm = x.rightEdgeX - x.contentX;
  const yearPos = placeOnA4(x.yearX, yCentered);
  const monthPos = placeOnA4(x.monthX, yCentered);
  const contentPos = placeOnA4(x.contentX, yCentered);
  const hasSourceIndex = editable && typeof row.sourceIndex === 'number';
  // 見出し行 (「学歴」「職歴」「現在に至る」「以上」 等) の年/月セルには
  // placeholder を出さない (公式の見え方に合わせる、見出しは年月が無いのが自然)
  const isHeadingLike =
    row.content === '学歴' ||
    row.content === '職歴' ||
    row.content === '現在に至る' ||
    row.content === '以上';
  const yearPlaceholder = isHeadingLike ? undefined : 'YYYY';
  const monthPlaceholder = isHeadingLike ? undefined : 'M';
  const yearAttrs = hasSourceIndex
    ? editableAttrs(true, `historyRows.${row.sourceIndex}.year`, yearPlaceholder)
    : '';
  const monthAttrs = hasSourceIndex
    ? editableAttrs(true, `historyRows.${row.sourceIndex}.month`, monthPlaceholder)
    : '';
  const contentAttrs = hasSourceIndex
    ? editableAttrs(true, `historyRows.${row.sourceIndex}.content`, '学歴・職歴を記入')
    : '';

  // editable mode のときは空セルでも div を出す (placeholder 表示)
  const showEmpty = editable && hasSourceIndex;
  // 月セルは常に右寄せ。月罫線 box (幅 9.15mm) に対し、2 桁 (11/12、幅 ≈4mm)
  // の文字を box の中央寄りに見せるため、左 padding 2.5mm、右 padding 2.75mm
  // (= (9.15-4)/2 ≈ 2.575) を確保。1 桁 (4 等、幅 ≈2mm) も同 padding 設定で
  // box 中央寄りに揃う。
  const monthLeftPad = 2.5;
  const monthRightPad = 2.75;
  const monthInnerWidth = monthWidthMm - monthLeftPad - monthRightPad;
  // 内容セルも左右に 2mm の padding を取って box 罫線とくっつかないように
  const contentLeftPad = 2;
  const contentRightPad = 2;
  const contentInnerWidth = contentWidthMm - contentLeftPad - contentRightPad;
  const contentAlign = contentTextAlign(row.content);
  const yearHtml =
    row.year === '' && !showEmpty
      ? ''
      : `<div class="jcd-mhlw-a4__history-year" style="left:${yearPos.left};top:${yearPos.top};font-size:11pt;width:${yearWidthMm.toFixed(2)}mm;text-align:center;"${yearAttrs}>${escapeHtml(row.year)}</div>`;
  // 月 box を左に padding 分シフトして配置
  const monthLeftMm = x.monthX + monthLeftPad;
  const monthPosShifted = placeOnA4(monthLeftMm, yCentered);
  const monthHtml =
    row.month === '' && !showEmpty
      ? ''
      : `<div class="jcd-mhlw-a4__history-month" style="left:${monthPosShifted.left};top:${monthPos.top};font-size:11pt;width:${monthInnerWidth.toFixed(2)}mm;text-align:right;"${monthAttrs}>${escapeHtml(row.month)}</div>`;
  // content セルは左 padding 分シフトして配置、その分 width も狭める
  const contentLeftMm = x.contentX + contentLeftPad;
  const contentPosShifted = placeOnA4(contentLeftMm, yCentered);
  const contentHtml = `<div class="jcd-mhlw-a4__history-content" style="left:${contentPosShifted.left};top:${contentPos.top};font-size:11pt;width:${contentInnerWidth.toFixed(2)}mm;text-align:${contentAlign};"${contentAttrs}>${escapeHtml(row.content)}</div>`;
  return yearHtml + monthHtml + contentHtml;
};

const renderHistorySection = (careerProfile: CareerProfile, editable: boolean): string => {
  const left = HISTORY_LAYOUT.leftPage;
  const right = HISTORY_LAYOUT.rightPage;
  const leftCapacity = left.maxRows;
  const rightCapacity = right.maxRows;
  const totalCapacity = leftCapacity + rightCapacity;

  let allRows: HistoryRowOrEntry[];

  if (editable) {
    // editable mode (PC 版 WYSIWYG): 紙の罫線と同じく常に全 totalCapacity 行を
    // 描画し、すべて編集可能。historyRows にデータがある分だけ値を入れ、残りは
    // 空セル + sourceIndex で表示 (= 紙の Excel のように、どこからでも入力可能)。
    const source = careerProfile.historyRows ?? [];
    allRows = Array.from({ length: totalCapacity }, (_, idx) => ({
      kind: 'entry' as const,
      year: source[idx]?.year ?? '',
      month: source[idx]?.month ?? '',
      content: source[idx]?.content ?? '',
      sourceIndex: idx,
    }));
  } else if (careerProfile.historyRows !== undefined) {
    // PDF 出力 (editable=false) で historyRows がある: そのまま描画 (空セルは出さない)
    allRows = careerProfile.historyRows.map((r, idx) => ({
      kind: 'entry' as const,
      year: r.year ?? '',
      month: r.month ?? '',
      content: r.content ?? '',
      sourceIndex: idx,
    }));
  } else {
    // PDF 出力で historyRows なし: legacy として educationHistory + workExperiences
    // から合成 (heading 行を含む read-only モード)
    const educationRows = buildEducationRows(careerProfile.educationHistory);
    const workRows = buildWorkRows(careerProfile.workExperiences);
    allRows = [...educationRows, ...workRows] as HistoryRowOrEntry[];
  }

  if (allRows.length === 0) return '';
  const rowsToRender = allRows.slice(0, totalCapacity);
  const html: string[] = [];
  for (let i = 0; i < rowsToRender.length; i += 1) {
    const row = rowsToRender[i] as HistoryRowOrEntry;
    if (i < leftCapacity) {
      const y = left.firstRowY + i * left.rowHeight;
      html.push(renderHistoryRowAt(row, left, y, editable));
    } else {
      const y = right.firstRowY + (i - leftCapacity) * right.rowHeight;
      html.push(renderHistoryRowAt(row, right, y, editable));
    }
  }
  return html.join('');
};

// === 免許・資格 ===

type CertRow = { year: string; month: string; content: string; sourceIndex?: number };

const renderCertificationSection = (careerProfile: CareerProfile, editable: boolean): string => {
  const layout = CERTIFICATION_LAYOUT;
  let rows: CertRow[];
  if (editable) {
    // editable mode: 紙の罫線と同じく常に layout.maxRows 行を描画し、すべて編集可能
    const source = careerProfile.certificationRows ?? [];
    rows = Array.from({ length: layout.maxRows }, (_, idx) => ({
      year: source[idx]?.year ?? '',
      month: source[idx]?.month ?? '',
      content: source[idx]?.content ?? '',
      sourceIndex: idx,
    }));
  } else if (careerProfile.certificationRows !== undefined) {
    rows = careerProfile.certificationRows.map((r, idx) => ({
      year: r.year ?? '',
      month: r.month ?? '',
      content: r.content ?? '',
      sourceIndex: idx,
    }));
  } else {
    rows = (buildCertificationRows(careerProfile.certifications) as CertificationRow[]).map(
      (r) => ({
        year: r.year,
        month: r.month,
        content: r.content,
      }),
    );
  }
  if (rows.length === 0) return '';
  const rowsToRender = rows.slice(0, layout.maxRows);
  const html: string[] = [];
  for (let i = 0; i < rowsToRender.length; i += 1) {
    const row = rowsToRender[i] as CertRow;
    // box 上罫 y に行内縦中央オフセット (+2.4mm) を加える
    const y = layout.firstRowY + i * layout.rowHeight + ROW_VERTICAL_CENTER_OFFSET_MM;
    // 学歴職歴表と同じく、年は box 全幅で中央寄せ、月は常に右寄せ
    // (padding を左右にバランスよく取って 1〜2 桁とも box 中央寄りに見える)
    const yearWidthMm = layout.monthX - layout.yearX;
    const monthWidthMm = layout.contentX - layout.monthX;
    const monthLeftPad = 2.5;
    const monthRightPad = 2.75;
    const monthInnerWidth = monthWidthMm - monthLeftPad - monthRightPad;
    const yearPos = placeOnA4(layout.yearX, y);
    const monthPos = placeOnA4(layout.monthX + monthLeftPad, y);
    const contentPos = placeOnA4(layout.contentX + 2, y);
    const hasSourceIndex = editable && typeof row.sourceIndex === 'number';
    const yearAttrs = hasSourceIndex
      ? editableAttrs(true, `certificationRows.${row.sourceIndex}.year`, 'YYYY')
      : '';
    const monthAttrs = hasSourceIndex
      ? editableAttrs(true, `certificationRows.${row.sourceIndex}.month`, 'M')
      : '';
    const contentAttrs = hasSourceIndex
      ? editableAttrs(true, `certificationRows.${row.sourceIndex}.content`, '免許・資格を記入')
      : '';

    const showEmpty = editable && hasSourceIndex;
    const yearHtml =
      row.year === '' && !showEmpty
        ? ''
        : `<div class="jcd-mhlw-a4__cert-year" style="left:${yearPos.left};top:${yearPos.top};font-size:11pt;width:${yearWidthMm.toFixed(2)}mm;text-align:center;"${yearAttrs}>${escapeHtml(row.year)}</div>`;
    const monthHtml =
      row.month === '' && !showEmpty
        ? ''
        : `<div class="jcd-mhlw-a4__cert-month" style="left:${monthPos.left};top:${monthPos.top};font-size:11pt;width:${monthInnerWidth.toFixed(2)}mm;text-align:right;"${monthAttrs}>${escapeHtml(row.month)}</div>`;
    const contentHtml =
      row.content === '' && !showEmpty
        ? ''
        : `<div class="jcd-mhlw-a4__cert-content" style="left:${contentPos.left};top:${contentPos.top};font-size:11pt;min-width:130mm;"${contentAttrs}>${escapeHtml(row.content)}</div>`;
    html.push(yearHtml + monthHtml + contentHtml);
  }
  return html.join('');
};

// === 志望の動機 + 本人希望記入欄 ===

const renderFreeTextBox = (
  cls: string,
  box: { x: number; y: number; w: number; h: number },
  text: string | undefined,
  editable: boolean,
  field: string,
  placeholder?: string,
): string => {
  const value = text ?? '';
  if (!editable && !isNonEmpty(value)) return '';
  const safe = escapeHtml(value).replace(/\n/g, '<br>');
  const { left, top } = placeOnA4(box.x, box.y);
  const attrs = editableAttrs(editable, field, placeholder);
  return `<div class="jcd-mhlw-a4__free-text ${cls}" style="left:${left};top:${top};width:${box.w}mm;height:${box.h}mm;"${attrs}>${safe}</div>`;
};

// === CSS ===

const CSS = `@page { size: A4 portrait; margin: 0; }
.jcd-mhlw-a4 {
  position: relative;
  width: ${A4_PAGE_W_MM}mm;
  height: ${A4_PAGE_H_MM * 2}mm;
  background: #fff;
  color: #000;
  font-family: "Noto Serif JP", "Yu Mincho", "MS Mincho", "Hiragino Mincho ProN", serif;
}
.jcd-mhlw-a4__rule {
  position: absolute;
  background: #000;
  /* print 時に background を保持しないと罫線が消える (Chromium default は
     background-color を印刷対象から除外する)。罫線は本書類で必須要素なので
     exact 適用で強制的に印刷に含める。標準 print-color-adjust と prefix 版
     -webkit-print-color-adjust を両方指定 (古い Chromium / Safari fallback)。 */
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
/* 公式 PDF の罫線は非常に細い (画像比較で 300dpi 1px 相当 = 0.25pt ≈ 0.088mm)。
   現状 0.5pt は太すぎたので 0.25pt に下げる。print 時には print-color-adjust:exact
   で background が保持されるため、細い罫線でも消えない。 */
.jcd-mhlw-a4__rule--h { height: 0.25pt; }
.jcd-mhlw-a4__rule--v { width: 0.25pt; }

.jcd-mhlw-a4__label {
  position: absolute;
  z-index: 3;
  font-size: 11pt;
  line-height: 1.15;
  white-space: nowrap;
  color: #000;
}
/* 「履歴書」タイトル: 公式は MS-PMincho (明朝) で 3 文字を字間広めに配置。
   本文と同じ明朝スタックを使い、letter-spacing で字間を広げる。font-size は
   labelFontSizePt() 側で 22pt に設定。font-weight / transform は使わない。 */
.jcd-mhlw-a4__label--title {
  letter-spacing: 0.3em;
}

.jcd-mhlw-a4__name, .jcd-mhlw-a4__name-kana,
.jcd-mhlw-a4__birth-year, .jcd-mhlw-a4__birth-month, .jcd-mhlw-a4__birth-day, .jcd-mhlw-a4__age, .jcd-mhlw-a4__birth-raw,
.jcd-mhlw-a4__gender,
.jcd-mhlw-a4__prepared-year, .jcd-mhlw-a4__prepared-month, .jcd-mhlw-a4__prepared-day, .jcd-mhlw-a4__prepared-raw,
.jcd-mhlw-a4__address, .jcd-mhlw-a4__address-kana, .jcd-mhlw-a4__address-postal, .jcd-mhlw-a4__address-phone,
.jcd-mhlw-a4__contact-address, .jcd-mhlw-a4__contact-address-kana, .jcd-mhlw-a4__contact-address-postal, .jcd-mhlw-a4__contact-address-phone,
.jcd-mhlw-a4__history-heading, .jcd-mhlw-a4__history-year, .jcd-mhlw-a4__history-month, .jcd-mhlw-a4__history-content,
.jcd-mhlw-a4__cert-year, .jcd-mhlw-a4__cert-month, .jcd-mhlw-a4__cert-content {
  position: absolute;
  z-index: 4;
  line-height: 1.1;
  white-space: nowrap;
  color: #000;
}
.jcd-mhlw-a4__history-heading {
  font-weight: 500;
  letter-spacing: 0.2em;
}
.jcd-mhlw-a4__free-text {
  position: absolute;
  z-index: 4;
  /* 自由記述欄本文はヘッダーラベル本体 (志望動機 / 本人希望記入欄、11pt) と
     同じ size に揃える (ユーザー指示「項目タイトルと同じに」)。 */
  font-size: 11pt;
  white-space: pre-wrap;
  color: #000;
  overflow: hidden;
  padding: 1mm 2mm;
  box-sizing: border-box;
}
/* 本人希望記入欄: box 内に 9.06mm 間隔の中間罫線 4 本があるので、テキストの
   line-height を罫線間隔と一致させて各行がぴったり罫線に乗るようにする。 */
.jcd-mhlw-a4__personal-request {
  line-height: 9.06mm;
  padding-top: 0;
}
/* 志望動機: 中間罫線なしの 1 セル box。読みやすさ重視で line-height は本文の
   標準値 (1.6 ≈ 9pt × 1.6 ≈ 5mm)。 */
.jcd-mhlw-a4__summary {
  line-height: 1.6;
}

/* editable mode の見た目:
   - 非アクティブ時も薄い背景色で入力可能箇所を可視化 (ユーザーがどこを
     クリックすればよいか分かる)
   - hover で色を少し濃く
   - focus でさらに濃く + outline で active セルを示す
   read-only mode (preview / PDF 出力) では contenteditable 属性自体が無いので
   これらの :focus / :hover / non-active 装飾はすべて適用されない。 */
[contenteditable="plaintext-only"] {
  background: rgba(120, 170, 255, 0.08);
  border-radius: 1px;
}
[contenteditable="plaintext-only"]:hover:not(:focus) {
  background: rgba(120, 170, 255, 0.18);
}
[contenteditable="plaintext-only"]:focus {
  outline: none;
  background: rgba(255, 230, 100, 0.32);
  box-shadow: 0 0 0 1px rgba(120, 110, 30, 0.5);
}
[contenteditable="plaintext-only"]:empty::before {
  content: attr(data-placeholder);
  color: rgba(0, 0, 0, 0.28);
}

.jcd-mhlw-a4__photo {
  position: absolute;
  box-sizing: border-box;
  border: 0.75pt dashed #808080;
  /* 公式 PDF (textBbox) では:
     - 「写真をはる位置」 (heading) が y=33.10mm (box top=27.69 から +5.41mm)
     - 「写真をはる必要が...」 (body) が y=40.42mm (box top から +12.73mm)
     padding-top で box 上端から heading までの距離を確保 (+5mm)。 */
  padding: 5mm 1.5mm 1.5mm;
  /* 公式 PDF (pdffonts 解析) の通り、写真欄の案内テキストも明朝。本文と
     同じスタックを継承するため font-family は指定しない (article 既定を
     使う)。 */
  font-size: 7.5pt;
  line-height: 1.5;
  z-index: 2;
  color: #000;
  overflow: hidden;
  /* 写真欄ガイド (border / 案内テキスト) を print 時にも残すため exact 適用。 */
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
.jcd-mhlw-a4__photo--filled { padding: 0; }
.jcd-mhlw-a4__photo-heading {
  text-align: center;
  /* 公式 bbox h=2.84mm = 8pt 相当 */
  font-size: 8pt;
  /* heading (y=33.10) と body (y=40.42) の間隔 = 7.32mm 確保。
     heading の line-height 込み高さ ≈ 3mm なので margin-bottom ≈ 4mm。 */
  margin-bottom: 4mm;
  letter-spacing: 0.08em;
}
.jcd-mhlw-a4__photo-body { font-size: 7pt; }
.jcd-mhlw-a4__photo-image { width: 100%; height: 100%; object-fit: cover; display: block; }
`;

// === Render entrypoint ===

const renderRirekishoMhlwA4 = (input: RenderInput): RenderedDocument => {
  const { careerProfile, editable: editableInput } = input;
  const editable = editableInput === true;
  const preparedOn = careerProfile.meta?.preparedOn;

  const rules = (pdfRules.h_lines as Rule[])
    .map(renderHorizontalRule)
    .concat((pdfRules.v_lines as Rule[]).map(renderVerticalRule))
    .join('');

  const labels = renderOfficialLabels();
  const photo = renderPhotoBox(careerProfile.basics.profilePhoto);
  const userName = renderUserName(careerProfile.basics, editable);
  const userNameKana = renderUserNameKana(careerProfile.basics, editable);
  const birthDate = renderBirthDate(careerProfile.basics, preparedOn, editable);
  const gender = renderGender(careerProfile.basics, editable);
  const prepared = renderPreparedOn(preparedOn, editable);
  const address = renderAddress(careerProfile.basics, editable);
  // Phase 2.1a スコープ: 学歴職歴 / 免許資格 表は editable 未対応 (Phase 2.1b)
  const history = renderHistorySection(careerProfile, editable);
  const certifications = renderCertificationSection(careerProfile, editable);
  const summary = renderFreeTextBox(
    'jcd-mhlw-a4__summary',
    SUMMARY_BOX_MM,
    careerProfile.basics.summary,
    editable,
    'summary',
    '志望の動機、特技、好きな学科、アピールポイントなどを記入',
  );
  const personalRequest = renderFreeTextBox(
    'jcd-mhlw-a4__personal-request',
    PERSONAL_REQUEST_BOX_MM,
    careerProfile.basics.personalRequest,
    editable,
    'personalRequest',
    '特に給料・職種・勤務時間・勤務地・その他についての希望などを記入',
  );

  const userData =
    photo +
    userNameKana +
    userName +
    birthDate +
    gender +
    prepared +
    address +
    history +
    certifications +
    summary +
    personalRequest;

  const articleAttrs = editable ? ' data-editable="true"' : '';
  const html = `<article class="jcd-mhlw-a4"${articleAttrs}>${rules}${labels}${userData}</article>`;

  return {
    kind: input.kind,
    title: TEMPLATE_TITLE,
    html,
    css: CSS,
    metadata: {
      language: 'ja-JP',
      page: { size: 'A4', orientation: 'portrait' },
      templateId: TEMPLATE_ID,
    },
  };
};

export const rirekishoMhlwA4Template: TemplateDefinition = {
  id: TEMPLATE_ID,
  kind: 'rirekisho',
  name: '履歴書（厚労省様式 A4 縦 2 ページ）',
  render: renderRirekishoMhlwA4,
};
