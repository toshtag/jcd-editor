// rirekisho-mhlw-a3 は厚生労働省「履歴書様式例 (シンプル版・希望職種記入欄なし)」
// を罫線レベルで再現する template。
//
// === 設計の核心 ===
//
// - **A3 横、見開き 1 枚** で出力する。CSS は @page { size: A3 landscape }。
// - **罫線は ground truth JSON (mhlw-pdf-rules.json) から position: absolute
//   で直接 div として描画する**。table / grid layout は使わない。
//   Phase 0 で罫線位置 ±0mm を達成した手法。
// - **公式のラベルテキスト** (ふりがな / 氏名 / 学　歴・職　歴 など) は
//   公式 PDF の text bbox 実測値 (mhlw-text-bbox.json) を使って配置する。
// - **写真欄** は Excel autoshape (dashed box) で PDF text として抽出できなかった
//   ため、実測 bbox を photo box として個別配置。
// - **ユーザーデータの流し込み** (氏名 / 生年月日 / 住所 / 学歴職歴 / 免許資格 /
//   志望動機 / 本人希望 / 写真) は、公式様式の各欄に対応する座標に position:
//   absolute で配置する。座標は mhlw-pdf-rules.json の罫線 / mhlw-text-bbox.json
//   の label 位置を基準に算出 (詳細は本 file の HISTORY_LAYOUT_MM / etc. 定数)。
//
// === Phase 1.x で「履歴書では描画しない」と決めたもの (CONCEPT 整合) ===
//
// - WorkExperience.responsibilities / achievements / summary / tags
// - Project.* / Skill.* 全般 (本様式に列がない)
// - Certification.credentialId / credentialUrl / expirationDate / description
//
// これらは職務経歴書 (shokumukeirekisho-basic) の責務として明確に役割分担する。

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

const TEMPLATE_ID = 'rirekisho-mhlw-a3';
const TEMPLATE_TITLE = '履歴書';
const PROFILE_PHOTO_DEFAULT_ALT_TEXT = '証明写真';

// === Ground truth (公式 PDF 実測値、改変禁止) ===

const DPI = pdfRules.dpi;
const PAGE_W_MM = pdfRules.page_w_mm;
const PAGE_H_MM = pdfRules.page_h_mm;

const pxToMm = (px: number): number => (px / DPI) * 25.4;

// 写真欄 (Excel autoshape dashed box、PDF 300dpi 画像から個別実測)
const PHOTO_BOX_MM = {
  x: 154.77,
  y: 27.69,
  w: 30.31,
  h: 38.69,
} as const;

// === 学歴・職歴 表の座標 (公式 PDF 罫線実測値ベース) ===
//
// 学歴・職歴は 2 ブロックにまたがる:
//   - 左ページ下表: heading y=131.885, 行 y=137.58〜219.29mm (約 9 行)
//   - 右ページ上表: heading y=29.512, 行 y=35.31〜126.15mm (約 11 行)
//
// 列構成は両ブロックで同じ寸法:
//   - 年セル: 約 19.6mm 幅
//   - 月セル: 約 9.1mm 幅
//   - 内容セル: 約 143mm 幅
//
// 行は 罫線間隔 約 9.06mm = 25.7pt。文字サイズ 10pt 程度で配置。
const HISTORY_LAYOUT = {
  // 左ページ下表
  leftPage: {
    yearX: 23.62,
    monthX: 43.26,
    contentX: 52.41,
    rightEdgeX: 195.75,
    firstRowY: 137.58,
    rowHeight: 9.06,
    maxRows: 9,
  },
  // 右ページ上表 (左ページ末尾から連続)
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

// 免許・資格 表 (右ページ中段、heading y=100.85, 行 y=106.6-160.95mm)
const CERTIFICATION_LAYOUT = {
  yearX: 228.85,
  monthX: 248.5,
  contentX: 257.64,
  rightEdgeX: 400.98,
  firstRowY: 106.6,
  rowHeight: 9.06,
  maxRows: 6,
} as const;

// 志望の動機 欄 (右ページ、y=164.76-225.98mm、x=228.85-400.98mm)
const SUMMARY_BOX_MM = { x: 230, y: 172, w: 169, h: 53 } as const;

// 本人希望記入欄 (右ページ、y=229.79-273.90mm)
const PERSONAL_REQUEST_BOX_MM = { x: 230, y: 237, w: 169, h: 37 } as const;

// === HTML helpers ===

type Rule = { y_px?: number; y_mm?: number; x_px?: number; x_mm?: number; spans_px: number[][] };

const renderHorizontalRule = (rule: Rule): string => {
  const y = rule.y_mm as number;
  return rule.spans_px
    .map(([s, e]) => {
      const x = pxToMm(s as number);
      const w = pxToMm((e as number) - (s as number));
      return `<div class="jcd-mhlw__rule jcd-mhlw__rule--h" style="left:${x.toFixed(3)}mm;top:${y.toFixed(3)}mm;width:${w.toFixed(3)}mm;"></div>`;
    })
    .join('');
};

const renderVerticalRule = (rule: Rule): string => {
  const x = rule.x_mm as number;
  return rule.spans_px
    .map(([s, e]) => {
      const y = pxToMm(s as number);
      const h = pxToMm((e as number) - (s as number));
      return `<div class="jcd-mhlw__rule jcd-mhlw__rule--v" style="left:${x.toFixed(3)}mm;top:${y.toFixed(3)}mm;height:${h.toFixed(3)}mm;"></div>`;
    })
    .join('');
};

// === 公式ラベル (固定 phrase) 描画 ===

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
// の 2 クラスのみとし、いずれも明朝スタックを使う。
const labelFontClass = (text: string): string => {
  if (text === '履歴書') return 'jcd-mhlw__label jcd-mhlw__label--title';
  return 'jcd-mhlw__label';
};

const labelFontSizePt = (text: string): number => {
  // タイトル font-size: 公式 PDF の bbox 高さに収まる 22pt (28pt は bbox 超過)
  if (text === '履歴書') return 22;
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
      return `<div class="${cls}" style="left:${t.x_mm.toFixed(3)}mm;top:${t.y_mm.toFixed(3)}mm;font-size:${size}pt;">${safe}</div>`;
    })
    .join('');
};

// === 写真欄 (dashed box + 内部見出し + ユーザー画像) ===

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
    return `<div class="jcd-mhlw__photo" style="${style}"><div class="jcd-mhlw__photo-heading">写真をはる位置</div><div class="jcd-mhlw__photo-body">写真をはる必要が<br>ある場合<br>1.&nbsp;縦<br>&nbsp;&nbsp;&nbsp;横<br>2.本人単身胸から上<br>3.裏面のりづけ</div></div>`;
  }

  const photo = profilePhoto as ProfilePhoto;
  const source = photo.source;
  if (source === undefined || source.kind !== 'dataUri') {
    return '';
  }
  const altText = isNonEmpty(photo.altText) ? photo.altText : PROFILE_PHOTO_DEFAULT_ALT_TEXT;
  return `<div class="jcd-mhlw__photo jcd-mhlw__photo--filled" style="${style}"><img class="jcd-mhlw__photo-image" src="${escapeHtml(source.dataUri)}" alt="${escapeHtml(altText)}"></div>`;
};

// === basics 流し込み ===

const renderUserName = (basics: CareerProfile['basics']): string => {
  if (basics.name === undefined) return '';
  const family = escapeHtml(basics.name.family);
  const given = escapeHtml(basics.name.given);
  return `<div class="jcd-mhlw__name" style="left:60mm;top:44.80mm;font-size:14pt;">${family}　${given}</div>`;
};

const renderUserNameKana = (basics: CareerProfile['basics']): string => {
  if (basics.nameKana === undefined) return '';
  const family = escapeHtml(basics.nameKana.family);
  const given = escapeHtml(basics.nameKana.given);
  return `<div class="jcd-mhlw__name-kana" style="left:60mm;top:39.87mm;font-size:9pt;">${family}　${given}</div>`;
};

const renderBirthDateAndAge = (
  basics: CareerProfile['basics'],
  preparedOn: string | undefined,
): string => {
  if (basics.birthDate === undefined) return '';
  // 公式: y=74.30mm に「年 月 日生 (満　歳)」label がある。
  // それぞれの label の右隣に数字を入れる位置:
  //   年: x=68mm (label「年」x=60.63)
  //   月: x=83mm (label「月」x=76.21)
  //   日: x=99mm (label「日生」x=91.79)
  //   満N歳: x=110mm (label「(満」x=107.36, 「歳）」x=122.94)
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
  return (
    `<div class="jcd-mhlw__birth-year" style="left:68mm;top:74.30mm;font-size:11pt;">${y}</div>` +
    `<div class="jcd-mhlw__birth-month" style="left:83mm;top:74.30mm;font-size:11pt;">${mo}</div>` +
    `<div class="jcd-mhlw__birth-day" style="left:99mm;top:74.30mm;font-size:11pt;">${d}</div>` +
    (ageStr === ''
      ? ''
      : `<div class="jcd-mhlw__age" style="left:113mm;top:74.30mm;font-size:11pt;">${ageStr}</div>`)
  );
};

const renderGender = (basics: CareerProfile['basics']): string => {
  if (!isNonEmpty(basics.gender)) return '';
  // 「※性別」label: x=139.89, y=71.72mm。その下の欄に書く想定 → y=81mm 程度
  return `<div class="jcd-mhlw__gender" style="left:147mm;top:71.72mm;font-size:11pt;">${escapeHtml(basics.gender)}</div>`;
};

const renderPreparedOn = (preparedOn: string | undefined): string => {
  if (preparedOn === undefined) return '';
  // 「年 月 日現在」label の左側 (右上隅): y=31.33mm
  const m = preparedOn.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m === null) return '';
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  return (
    `<div class="jcd-mhlw__prepared-year" style="left:104mm;top:31.33mm;font-size:11pt;">${y}</div>` +
    `<div class="jcd-mhlw__prepared-month" style="left:118mm;top:31.33mm;font-size:11pt;">${mo}</div>` +
    `<div class="jcd-mhlw__prepared-day" style="left:130mm;top:31.33mm;font-size:11pt;">${d}</div>`
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
    html += `<div class="jcd-mhlw__${prefix}-kana" style="left:46mm;top:${(baseY - 7).toFixed(2)}mm;font-size:9pt;">${escapeHtml(addressKana)}</div>`;
  }
  if (address !== undefined) {
    const addr = formatAddress(address);
    if (addr.length > 0) {
      html += `<div class="jcd-mhlw__${prefix}" style="left:46mm;top:${baseY}mm;font-size:11pt;">${escapeHtml(addr)}</div>`;
    }
  }
  if (isNonEmpty(phone)) {
    html += `<div class="jcd-mhlw__${prefix}-phone" style="left:175mm;top:${baseY}mm;font-size:11pt;">${escapeHtml(phone)}</div>`;
  }
  return html;
};

const renderAddress = (basics: CareerProfile['basics']): string => {
  // 現住所欄: ふりがな (y=81.95mm の label の右)、〒住所 (y=87mm 程度)、電話 (y=87mm 右)
  // 連絡先欄: ふりがな (y=104.48mm), 〒住所 (y=109.66mm), 電話 (y=109.66mm 右)
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

// === 学歴・職歴 表 === (row 構築ロジックは _internal/rirekisho-mhlw-shared.ts)

const renderHistoryRowAt = (
  row: HistoryRow,
  x: { yearX: number; monthX: number; contentX: number },
  y: number,
): string => {
  if (row.kind === 'heading') {
    return `<div class="jcd-mhlw__history-heading" style="left:${x.contentX + 2}mm;top:${y.toFixed(2)}mm;font-size:11pt;">${row.label}</div>`;
  }
  const yearHtml =
    row.year === ''
      ? ''
      : `<div class="jcd-mhlw__history-year" style="left:${x.yearX + 2}mm;top:${y.toFixed(2)}mm;font-size:11pt;">${escapeHtml(row.year)}</div>`;
  const monthHtml =
    row.month === ''
      ? ''
      : `<div class="jcd-mhlw__history-month" style="left:${x.monthX + 2}mm;top:${y.toFixed(2)}mm;font-size:11pt;">${escapeHtml(row.month)}</div>`;
  const contentHtml = `<div class="jcd-mhlw__history-content" style="left:${x.contentX + 2}mm;top:${y.toFixed(2)}mm;font-size:11pt;">${escapeHtml(row.content)}</div>`;
  return yearHtml + monthHtml + contentHtml;
};

const renderHistorySection = (careerProfile: CareerProfile): string => {
  // historyRows が指定されていればそれを優先 (WYSIWYG エディタ出力)。
  // 未指定なら従来通り educationHistory + workExperiences から合成。
  let allRows: HistoryRow[];
  if (careerProfile.historyRows !== undefined) {
    allRows = careerProfile.historyRows.map((r) => ({
      kind: 'entry' as const,
      year: r.year ?? '',
      month: r.month ?? '',
      content: r.content ?? '',
    }));
  } else {
    const educationRows = buildEducationRows(careerProfile.educationHistory);
    const workRows = buildWorkRows(careerProfile.workExperiences);
    allRows = [...educationRows, ...workRows];
  }
  if (allRows.length === 0) return '';

  // 公式様式の行数 (左 9 行 + 右 11 行 = 20 行) を超えた分は切り捨て。
  // 切り捨て発生時は最後の行に「(他 N 件は紙面上限により非表示)」を入れる
  // ことも考えられるが、Phase 1.3-a では単純切り捨て + console.warn なし。
  // 将来 Phase 1.4 (A4 縦 2 ページ版) ではあふれ分も自然に出る。
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

// === 免許・資格 表 === (row 構築ロジックは _internal/rirekisho-mhlw-shared.ts)

const renderCertificationSection = (careerProfile: CareerProfile): string => {
  let rows: CertificationRow[];
  if (careerProfile.certificationRows !== undefined) {
    rows = careerProfile.certificationRows.map((r) => ({
      year: r.year ?? '',
      month: r.month ?? '',
      content: r.content ?? '',
    }));
  } else {
    rows = buildCertificationRows(careerProfile.certifications);
  }
  if (rows.length === 0) return '';
  const layout = CERTIFICATION_LAYOUT;
  const rowsToRender = rows.slice(0, layout.maxRows);
  const html: string[] = [];
  for (let i = 0; i < rowsToRender.length; i += 1) {
    const row = rowsToRender[i] as CertificationRow;
    const y = layout.firstRowY + i * layout.rowHeight;
    const yearHtml =
      row.year === ''
        ? ''
        : `<div class="jcd-mhlw__cert-year" style="left:${layout.yearX + 2}mm;top:${y.toFixed(2)}mm;font-size:11pt;">${escapeHtml(row.year)}</div>`;
    const monthHtml =
      row.month === ''
        ? ''
        : `<div class="jcd-mhlw__cert-month" style="left:${layout.monthX + 2}mm;top:${y.toFixed(2)}mm;font-size:11pt;">${escapeHtml(row.month)}</div>`;
    const contentHtml =
      row.content === ''
        ? ''
        : `<div class="jcd-mhlw__cert-content" style="left:${layout.contentX + 2}mm;top:${y.toFixed(2)}mm;font-size:11pt;">${escapeHtml(row.content)}</div>`;
    html.push(yearHtml + monthHtml + contentHtml);
  }
  return html.join('');
};

// === 志望の動機 + 本人希望記入欄 (フリーテキスト) ===

const renderFreeTextBox = (
  cls: string,
  box: { x: number; y: number; w: number; h: number },
  text: string | undefined,
): string => {
  if (!isNonEmpty(text)) return '';
  const safe = escapeHtml(text).replace(/\n/g, '<br>');
  return `<div class="jcd-mhlw__free-text ${cls}" style="left:${box.x}mm;top:${box.y}mm;width:${box.w}mm;height:${box.h}mm;">${safe}</div>`;
};

// === CSS ===

const CSS = `@page { size: A3 landscape; margin: 0; }
.jcd-mhlw {
  position: relative;
  width: ${PAGE_W_MM}mm;
  height: ${PAGE_H_MM}mm;
  background: #fff;
  color: #000;
  font-family: "Noto Serif JP", "Yu Mincho", "MS Mincho", "Hiragino Mincho ProN", serif;
}
.jcd-mhlw__rule { position: absolute; background: #000; }
.jcd-mhlw__rule--h { height: 0.5pt; }
.jcd-mhlw__rule--v { width: 0.5pt; }

.jcd-mhlw__label {
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
.jcd-mhlw__label--title {
  letter-spacing: 0.3em;
}

/* ユーザーデータ流し込み — 全て position: absolute、罫線内に収まる前提 */
.jcd-mhlw__name, .jcd-mhlw__name-kana,
.jcd-mhlw__birth-year, .jcd-mhlw__birth-month, .jcd-mhlw__birth-day, .jcd-mhlw__age,
.jcd-mhlw__gender,
.jcd-mhlw__prepared-year, .jcd-mhlw__prepared-month, .jcd-mhlw__prepared-day,
.jcd-mhlw__address, .jcd-mhlw__address-kana, .jcd-mhlw__address-phone,
.jcd-mhlw__contact-address, .jcd-mhlw__contact-address-kana, .jcd-mhlw__contact-address-phone,
.jcd-mhlw__history-heading, .jcd-mhlw__history-year, .jcd-mhlw__history-month, .jcd-mhlw__history-content,
.jcd-mhlw__cert-year, .jcd-mhlw__cert-month, .jcd-mhlw__cert-content {
  position: absolute;
  z-index: 4;
  line-height: 1.1;
  white-space: nowrap;
  color: #000;
}
.jcd-mhlw__history-heading {
  font-weight: 500;
  letter-spacing: 0.2em;
}
.jcd-mhlw__free-text {
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

.jcd-mhlw__photo {
  position: absolute;
  box-sizing: border-box;
  border: 0.75pt dashed #808080;
  padding: 2.5mm 1.5mm 1.5mm;
  /* 公式 PDF は写真欄案内も明朝。本文と同じ明朝スタックを継承するため
     font-family は指定しない (article 既定を使う)。 */
  font-size: 7.5pt;
  line-height: 1.5;
  z-index: 2;
  color: #000;
  overflow: hidden;
}
.jcd-mhlw__photo--filled { padding: 0; }
.jcd-mhlw__photo-heading {
  text-align: center;
  font-size: 8.5pt;
  margin-bottom: 1.5mm;
  letter-spacing: 0.08em;
}
.jcd-mhlw__photo-body { font-size: 7pt; }
.jcd-mhlw__photo-image { width: 100%; height: 100%; object-fit: cover; display: block; }
`;

// === Render entrypoint ===

const renderRirekishoMhlwA3 = (input: RenderInput): RenderedDocument => {
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
    'jcd-mhlw__summary',
    SUMMARY_BOX_MM,
    careerProfile.basics.summary,
  );
  const personalRequest = renderFreeTextBox(
    'jcd-mhlw__personal-request',
    PERSONAL_REQUEST_BOX_MM,
    careerProfile.basics.personalRequest,
  );

  // 1 つの大きなテキストとして結合 (order は意味なし、全て absolute positioning)
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

  const html = `<article class="jcd-mhlw">${rules}${labels}${userData}</article>`;

  return {
    kind: input.kind,
    title: TEMPLATE_TITLE,
    html,
    css: CSS,
    metadata: {
      language: 'ja-JP',
      page: { size: 'A3', orientation: 'landscape' },
      templateId: TEMPLATE_ID,
    },
  };
};

export const rirekishoMhlwA3Template: TemplateDefinition = {
  id: TEMPLATE_ID,
  kind: 'rirekisho',
  name: '履歴書（厚労省様式 A3）',
  render: renderRirekishoMhlwA3,
};
