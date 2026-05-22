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
//     (A4 page 2 へ。x オフセットの 205.23 は A3 の右ページ左端 228.85mm から
//     A4 の左マージン 23.62mm に揃えるための差)
//
// この座標変換だけで A3 と全く同じ罫線・テキスト・写真欄が A4 2 ページに
// 再構成される。data / ロジックは _internal/rirekisho-mhlw-shared.ts と共有。
//
// === 設計の核心 ===
//
// - **A4 縦 portrait、2 ページ**。CSS は @page { size: A4 portrait } + .jcd-mhlw-a4 を
//   594mm (= 297 × 2) 高さの container として position 計算に使う。
// - PDF 出力時は @page と CSS で改ページ。preview 表示時は 1 つの長い container
//   として上下に並ぶ。
// - 写真欄は A3 の左ページ (x=154.77mm) に含まれるので A4 page 1 に残る。
// - 各 user data 流し込み座標は A3 と同じ logic を A4 座標変換に通す。

import type { CareerProfile } from '@jcd-editor/core';

import { escapeHtml } from '../_internal/html-escape';
import {
  buildCertificationRows,
  buildEducationRows,
  buildWorkRows,
  computeAgeOnDate,
  type CertificationRow,
  type HistoryRow,
} from '../_internal/rirekisho-mhlw-shared';
import { formatAddress, isNonEmpty } from '../_internal/template-format';
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

const isRightPage = (xMm: number): boolean => xMm >= RIGHT_PAGE_THRESHOLD_MM;

const transformX = (xMm: number): number => (isRightPage(xMm) ? xMm - RIGHT_PAGE_X_OFFSET_MM : xMm);

const transformY = (xMm: number, yMm: number): number =>
  isRightPage(xMm) ? yMm + PAGE2_Y_OFFSET_MM : yMm;

// 写真欄 (A3 の左ページに収まるので x はそのまま、y もそのまま = page 1)
const PHOTO_BOX_MM = {
  x: 154.77,
  y: 27.69,
  w: 30.31,
  h: 38.69,
} as const;

// === 学歴・職歴 表の座標 ===
// A3 と同じ寸法だが、右ページ表は変換後の座標で配置される。

const HISTORY_LAYOUT = {
  // A3 の左ページ下表 → A4 page 1 下部
  leftPage: {
    yearX: 23.62,
    monthX: 43.26,
    contentX: 52.41,
    rightEdgeX: 195.75,
    firstRowY: 137.58,
    rowHeight: 9.06,
    maxRows: 9,
  },
  // A3 の右ページ上表 → A4 page 2 上部 (transformY で +297)
  rightPage: {
    yearX: 228.85,
    monthX: 248.5,
    contentX: 257.64,
    rightEdgeX: 400.98,
    firstRowY: 35.31,
    rowHeight: 9.06,
    maxRows: 11,
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

const SUMMARY_BOX_MM = { x: 230, y: 172, w: 169, h: 53 } as const;
const PERSONAL_REQUEST_BOX_MM = { x: 230, y: 237, w: 169, h: 37 } as const;

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

const labelFontClass = (text: string): string => {
  if (text === '履歴書') return 'jcd-mhlw-a4__label jcd-mhlw-a4__label--title';
  if (
    text.includes('ふりがな') ||
    text.includes('※') ||
    text.includes('現住所以外') ||
    text.includes('写真') ||
    text.includes('性別')
  ) {
    return 'jcd-mhlw-a4__label jcd-mhlw-a4__label--gothic';
  }
  return 'jcd-mhlw-a4__label';
};

const labelFontSizePt = (text: string): number => {
  if (text === '履歴書') return 28;
  if (text.startsWith('※「性別」')) return 11;
  if (text.includes('現住所以外')) return 9;
  if (text.includes('(満') || text.includes('歳）')) return 12;
  return 11;
};

const renderOfficialLabels = (): string => {
  return (textBbox as TextBlock[])
    .filter((t) => !isInsidePhotoBox(t))
    .map((t) => {
      const cls = labelFontClass(t.text);
      const size = labelFontSizePt(t.text);
      const safe = escapeHtml(t.text).replace(/\n/g, '<br>');
      const x = transformX(t.x_mm);
      const y = transformY(t.x_mm, t.y_mm);
      return `<div class="${cls}" style="left:${x.toFixed(3)}mm;top:${y.toFixed(3)}mm;font-size:${size}pt;">${safe}</div>`;
    })
    .join('');
};

// === 写真欄 (左ページ = page 1、座標変換不要) ===

type ProfilePhoto = NonNullable<CareerProfile['basics']['profilePhoto']>;

const renderPhotoBox = (profilePhoto: ProfilePhoto | undefined): string => {
  const { x, y, w, h } = PHOTO_BOX_MM;
  const style = `left:${x}mm;top:${y}mm;width:${w}mm;height:${h}mm;`;

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

// === basics 流し込み (座標変換) ===

const placeOnA4 = (xMm: number, yMm: number): { left: string; top: string } => ({
  left: `${transformX(xMm).toFixed(3)}mm`,
  top: `${transformY(xMm, yMm).toFixed(3)}mm`,
});

const renderUserName = (basics: CareerProfile['basics']): string => {
  if (basics.name === undefined) return '';
  const family = escapeHtml(basics.name.family);
  const given = escapeHtml(basics.name.given);
  const { left, top } = placeOnA4(60, 44.8);
  return `<div class="jcd-mhlw-a4__name" style="left:${left};top:${top};font-size:14pt;">${family}　${given}</div>`;
};

const renderUserNameKana = (basics: CareerProfile['basics']): string => {
  if (basics.nameKana === undefined) return '';
  const family = escapeHtml(basics.nameKana.family);
  const given = escapeHtml(basics.nameKana.given);
  const { left, top } = placeOnA4(60, 39.87);
  return `<div class="jcd-mhlw-a4__name-kana" style="left:${left};top:${top};font-size:9pt;">${family}　${given}</div>`;
};

const renderBirthDateAndAge = (
  basics: CareerProfile['basics'],
  preparedOn: string | undefined,
): string => {
  if (basics.birthDate === undefined) return '';
  const m = basics.birthDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m === null) return '';
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const ageStr =
    preparedOn !== undefined
      ? (() => {
          const a = computeAgeOnDate(basics.birthDate as string, preparedOn);
          return a === undefined ? '' : String(a);
        })()
      : '';
  const yPos = placeOnA4(68, 74.3);
  const mPos = placeOnA4(83, 74.3);
  const dPos = placeOnA4(99, 74.3);
  const aPos = placeOnA4(113, 74.3);
  return (
    `<div class="jcd-mhlw-a4__birth-year" style="left:${yPos.left};top:${yPos.top};font-size:11pt;">${y}</div>` +
    `<div class="jcd-mhlw-a4__birth-month" style="left:${mPos.left};top:${mPos.top};font-size:11pt;">${mo}</div>` +
    `<div class="jcd-mhlw-a4__birth-day" style="left:${dPos.left};top:${dPos.top};font-size:11pt;">${d}</div>` +
    (ageStr === ''
      ? ''
      : `<div class="jcd-mhlw-a4__age" style="left:${aPos.left};top:${aPos.top};font-size:11pt;">${ageStr}</div>`)
  );
};

const renderGender = (basics: CareerProfile['basics']): string => {
  if (!isNonEmpty(basics.gender)) return '';
  const { left, top } = placeOnA4(147, 71.72);
  return `<div class="jcd-mhlw-a4__gender" style="left:${left};top:${top};font-size:11pt;">${escapeHtml(basics.gender)}</div>`;
};

const renderPreparedOn = (preparedOn: string | undefined): string => {
  if (preparedOn === undefined) return '';
  const m = preparedOn.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m === null) return '';
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const yPos = placeOnA4(104, 31.33);
  const mPos = placeOnA4(118, 31.33);
  const dPos = placeOnA4(130, 31.33);
  return (
    `<div class="jcd-mhlw-a4__prepared-year" style="left:${yPos.left};top:${yPos.top};font-size:11pt;">${y}</div>` +
    `<div class="jcd-mhlw-a4__prepared-month" style="left:${mPos.left};top:${mPos.top};font-size:11pt;">${mo}</div>` +
    `<div class="jcd-mhlw-a4__prepared-day" style="left:${dPos.left};top:${dPos.top};font-size:11pt;">${d}</div>`
  );
};

const renderAddressBlock = (
  prefix: string,
  baseY: number,
  address: CareerProfile['basics']['address'],
  addressKana: string | undefined,
  phone: string | undefined,
): string => {
  let html = '';
  if (isNonEmpty(addressKana)) {
    const { left, top } = placeOnA4(46, baseY - 7);
    html += `<div class="jcd-mhlw-a4__${prefix}-kana" style="left:${left};top:${top};font-size:9pt;">${escapeHtml(addressKana)}</div>`;
  }
  if (address !== undefined) {
    const addr = formatAddress(address);
    if (addr.length > 0) {
      const { left, top } = placeOnA4(46, baseY);
      html += `<div class="jcd-mhlw-a4__${prefix}" style="left:${left};top:${top};font-size:11pt;">${escapeHtml(addr)}</div>`;
    }
  }
  if (isNonEmpty(phone)) {
    const { left, top } = placeOnA4(175, baseY);
    html += `<div class="jcd-mhlw-a4__${prefix}-phone" style="left:${left};top:${top};font-size:11pt;">${escapeHtml(phone)}</div>`;
  }
  return html;
};

const renderAddress = (basics: CareerProfile['basics']): string => {
  return (
    renderAddressBlock('address', 87, basics.address, basics.addressKana, basics.phone) +
    renderAddressBlock(
      'contact-address',
      109.66,
      basics.contactAddress,
      basics.contactAddressKana,
      basics.contactPhone,
    )
  );
};

// === 学歴・職歴 表 ===

const renderHistoryRowAt = (
  row: HistoryRow,
  x: { yearX: number; monthX: number; contentX: number },
  yMm: number,
): string => {
  if (row.kind === 'heading') {
    const { left, top } = placeOnA4(x.contentX + 2, yMm);
    return `<div class="jcd-mhlw-a4__history-heading" style="left:${left};top:${top};font-size:11pt;">${row.label}</div>`;
  }
  const yearPos = placeOnA4(x.yearX + 2, yMm);
  const monthPos = placeOnA4(x.monthX + 2, yMm);
  const contentPos = placeOnA4(x.contentX + 2, yMm);
  const yearHtml =
    row.year === ''
      ? ''
      : `<div class="jcd-mhlw-a4__history-year" style="left:${yearPos.left};top:${yearPos.top};font-size:11pt;">${escapeHtml(row.year)}</div>`;
  const monthHtml =
    row.month === ''
      ? ''
      : `<div class="jcd-mhlw-a4__history-month" style="left:${monthPos.left};top:${monthPos.top};font-size:11pt;">${escapeHtml(row.month)}</div>`;
  const contentHtml = `<div class="jcd-mhlw-a4__history-content" style="left:${contentPos.left};top:${contentPos.top};font-size:11pt;">${escapeHtml(row.content)}</div>`;
  return yearHtml + monthHtml + contentHtml;
};

const renderHistorySection = (careerProfile: CareerProfile): string => {
  const educationRows = buildEducationRows(careerProfile.educationHistory);
  const workRows = buildWorkRows(careerProfile.workExperiences);
  const allRows = [...educationRows, ...workRows];
  if (allRows.length === 0) return '';
  const left = HISTORY_LAYOUT.leftPage;
  const right = HISTORY_LAYOUT.rightPage;
  const leftCapacity = left.maxRows;
  const rightCapacity = right.maxRows;
  const totalCapacity = leftCapacity + rightCapacity;
  const rowsToRender = allRows.slice(0, totalCapacity);
  const html: string[] = [];
  for (let i = 0; i < rowsToRender.length; i += 1) {
    const row = rowsToRender[i] as HistoryRow;
    if (i < leftCapacity) {
      const y = left.firstRowY + i * left.rowHeight;
      html.push(renderHistoryRowAt(row, left, y));
    } else {
      const y = right.firstRowY + (i - leftCapacity) * right.rowHeight;
      html.push(renderHistoryRowAt(row, right, y));
    }
  }
  return html.join('');
};

// === 免許・資格 表 ===

const renderCertificationSection = (careerProfile: CareerProfile): string => {
  const rows = buildCertificationRows(careerProfile.certifications);
  if (rows.length === 0) return '';
  const layout = CERTIFICATION_LAYOUT;
  const rowsToRender = rows.slice(0, layout.maxRows);
  const html: string[] = [];
  for (let i = 0; i < rowsToRender.length; i += 1) {
    const row = rowsToRender[i] as CertificationRow;
    const y = layout.firstRowY + i * layout.rowHeight;
    const yearPos = placeOnA4(layout.yearX + 2, y);
    const monthPos = placeOnA4(layout.monthX + 2, y);
    const contentPos = placeOnA4(layout.contentX + 2, y);
    const yearHtml =
      row.year === ''
        ? ''
        : `<div class="jcd-mhlw-a4__cert-year" style="left:${yearPos.left};top:${yearPos.top};font-size:11pt;">${escapeHtml(row.year)}</div>`;
    const monthHtml =
      row.month === ''
        ? ''
        : `<div class="jcd-mhlw-a4__cert-month" style="left:${monthPos.left};top:${monthPos.top};font-size:11pt;">${escapeHtml(row.month)}</div>`;
    const contentHtml =
      row.content === ''
        ? ''
        : `<div class="jcd-mhlw-a4__cert-content" style="left:${contentPos.left};top:${contentPos.top};font-size:11pt;">${escapeHtml(row.content)}</div>`;
    html.push(yearHtml + monthHtml + contentHtml);
  }
  return html.join('');
};

// === 志望の動機 + 本人希望記入欄 ===

const renderFreeTextBox = (
  cls: string,
  box: { x: number; y: number; w: number; h: number },
  text: string | undefined,
): string => {
  if (!isNonEmpty(text)) return '';
  const safe = escapeHtml(text).replace(/\n/g, '<br>');
  const { left, top } = placeOnA4(box.x, box.y);
  return `<div class="jcd-mhlw-a4__free-text ${cls}" style="left:${left};top:${top};width:${box.w}mm;height:${box.h}mm;">${safe}</div>`;
};

// === CSS ===
//
// container は 高さ A4×2 = 594mm。@page で改ページ。preview 表示時は 1 つの
// 縦長 container が見える。print 時は 2 ページに分かれる。

const CSS = `@page { size: A4 portrait; margin: 0; }
.jcd-mhlw-a4 {
  position: relative;
  width: ${A4_PAGE_W_MM}mm;
  height: ${A4_PAGE_H_MM * 2}mm;
  background: #fff;
  color: #000;
  font-family: "Noto Serif JP", "Yu Mincho", "MS Mincho", "Hiragino Mincho ProN", serif;
}
.jcd-mhlw-a4__rule { position: absolute; background: #000; }
.jcd-mhlw-a4__rule--h { height: 0.5pt; }
.jcd-mhlw-a4__rule--v { width: 0.5pt; }

.jcd-mhlw-a4__label {
  position: absolute;
  z-index: 3;
  font-size: 11pt;
  line-height: 1.15;
  white-space: nowrap;
  color: #000;
}
.jcd-mhlw-a4__label--gothic {
  font-family: "Noto Sans JP", "Yu Gothic", "Hiragino Sans", sans-serif;
}
.jcd-mhlw-a4__label--title {
  font-family: "Klee One", "Hiragino Mincho ProN", "Yu Mincho", serif;
  font-weight: 500;
  letter-spacing: 0.2em;
  transform: scaleY(0.823);
  transform-origin: top left;
  margin-top: -1.5mm;
}

.jcd-mhlw-a4__name, .jcd-mhlw-a4__name-kana,
.jcd-mhlw-a4__birth-year, .jcd-mhlw-a4__birth-month, .jcd-mhlw-a4__birth-day, .jcd-mhlw-a4__age,
.jcd-mhlw-a4__gender,
.jcd-mhlw-a4__prepared-year, .jcd-mhlw-a4__prepared-month, .jcd-mhlw-a4__prepared-day,
.jcd-mhlw-a4__address, .jcd-mhlw-a4__address-kana, .jcd-mhlw-a4__address-phone,
.jcd-mhlw-a4__contact-address, .jcd-mhlw-a4__contact-address-kana, .jcd-mhlw-a4__contact-address-phone,
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
  font-size: 10pt;
  line-height: 1.5;
  white-space: pre-wrap;
  color: #000;
  overflow: hidden;
  padding: 1mm 2mm;
  box-sizing: border-box;
}

.jcd-mhlw-a4__photo {
  position: absolute;
  box-sizing: border-box;
  border: 0.75pt dashed #808080;
  padding: 2.5mm 1.5mm 1.5mm;
  font-family: "Noto Sans JP", "Yu Gothic", sans-serif;
  font-size: 7.5pt;
  line-height: 1.5;
  z-index: 2;
  color: #000;
  overflow: hidden;
}
.jcd-mhlw-a4__photo--filled { padding: 0; }
.jcd-mhlw-a4__photo-heading {
  text-align: center;
  font-size: 8.5pt;
  margin-bottom: 1.5mm;
  letter-spacing: 0.08em;
}
.jcd-mhlw-a4__photo-body { font-size: 7pt; }
.jcd-mhlw-a4__photo-image { width: 100%; height: 100%; object-fit: cover; display: block; }
`;

// === Render entrypoint ===

const renderRirekishoMhlwA4 = (input: RenderInput): RenderedDocument => {
  const { careerProfile } = input;
  const preparedOn = careerProfile.meta?.preparedOn;

  const rules = (pdfRules.h_lines as Rule[])
    .map(renderHorizontalRule)
    .concat((pdfRules.v_lines as Rule[]).map(renderVerticalRule))
    .join('');

  const labels = renderOfficialLabels();
  const photo = renderPhotoBox(careerProfile.basics.profilePhoto);
  const userName = renderUserName(careerProfile.basics);
  const userNameKana = renderUserNameKana(careerProfile.basics);
  const birthDate = renderBirthDateAndAge(careerProfile.basics, preparedOn);
  const gender = renderGender(careerProfile.basics);
  const prepared = renderPreparedOn(preparedOn);
  const address = renderAddress(careerProfile.basics);
  const history = renderHistorySection(careerProfile);
  const certifications = renderCertificationSection(careerProfile);
  const summary = renderFreeTextBox(
    'jcd-mhlw-a4__summary',
    SUMMARY_BOX_MM,
    careerProfile.basics.summary,
  );
  const personalRequest = renderFreeTextBox(
    'jcd-mhlw-a4__personal-request',
    PERSONAL_REQUEST_BOX_MM,
    careerProfile.basics.personalRequest,
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

  const html = `<article class="jcd-mhlw-a4">${rules}${labels}${userData}</article>`;

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
