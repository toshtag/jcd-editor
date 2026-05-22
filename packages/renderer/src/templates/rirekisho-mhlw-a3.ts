// rirekisho-mhlw-a3 は厚生労働省「履歴書様式例 (シンプル版・希望職種記入欄なし)」
// を罫線レベルで再現する template。
//
// === 設計の核心 ===
//
// - **A3 横、見開き 1 枚** で出力する。CSS は @page { size: A3 landscape }。
// - **罫線は ground truth JSON (mhlw-pdf-rules.json) から position: absolute
//   で直接 div として描画する**。table / grid layout は使わない。
//   これは Phase 0 で罫線位置 ±0mm を達成した手法であり、cell padding /
//   font metric の影響を受けず px 単位で公式と一致する。
// - **公式のラベルテキスト** (ふりがな / 氏名 / 学　歴・職　歴 など) は
//   公式 PDF の text bbox 実測値 (mhlw-text-bbox.json) を使って配置する。
//   テンプレート側で hard-code した座標ではなく、ground truth に従う。
// - **写真欄** は Excel autoshape (dashed box) で公式 PDF 内では文字情報として
//   抽出できなかった。実測した bbox を photo box として個別に描画する。
//
// === Phase 1.1 スコープ ===
//
// 本 file は「**公式様式 (空欄状態) を 1:1 で再現できる骨格**」を提供する。
// CareerProfile の値を流し込む実装は最小限のみ:
//   - basics.name → 氏名欄に文字入れ (将来 UI で書ける)
//   - basics.profilePhoto (dataUri のみ) → 写真欄に <img> 表示
// それ以外 (生年月日 / 住所 / 電話 / 学歴・職歴 / 免許資格 etc.) は
// 流し込み未対応。Phase 1.2 (core データモデル拡張) と Phase 1.3 (UI 連動)
// で順次対応する。
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
import { isNonEmpty } from '../_internal/template-format';
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
// gray pixel (luminance 80-200) を走査して bbox を抽出。
// 詳細は docs/investigations/rirekisho-mhlw/spec.md を参照。
const PHOTO_BOX_MM = {
  x: 154.77,
  y: 27.69,
  w: 30.31,
  h: 38.69,
} as const;

// === HTML helpers ===

type Rule = { y_px?: number; y_mm?: number; x_px?: number; x_mm?: number; spans_px: number[][] };

const renderHorizontalRule = (rule: Rule): string => {
  // rule の y は y_mm (公式 PDF 実測値、改変禁止)
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
//
// text bbox に含まれる「履歴書」「ふりがな」「年 月 日現在」などの公式 phrase は
// 全て固定文字列で、user-provided data ではない。escapeHtml は defensive として
// 通すが、本来不要 (PDF 由来の static label のみ)。
//
// 写真欄内部のテキスト (写真をはる位置 / 写真をはる必要が… 等) は photo box
// 内に閉じ込めて別途描画するため、ここでは skip する (PHOTO_BOX に座標が
// 含まれる text block を除外)。

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
  // タイトル「履歴書」は HG正楷書体-PRO 28pt → kaisho (web fallback: Klee One)
  if (text === '履歴書') return 'jcd-mhlw__label jcd-mhlw__label--title';
  // 「ふりがな」「※」「現住所以外」「写真」「性別」 を含むものは Pゴシック
  if (
    text.includes('ふりがな') ||
    text.includes('※') ||
    text.includes('現住所以外') ||
    text.includes('写真') ||
    text.includes('性別')
  ) {
    return 'jcd-mhlw__label jcd-mhlw__label--gothic';
  }
  return 'jcd-mhlw__label';
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
      return `<div class="${cls}" style="left:${t.x_mm.toFixed(3)}mm;top:${t.y_mm.toFixed(3)}mm;font-size:${size}pt;">${safe}</div>`;
    })
    .join('');
};

// === 写真欄 (dashed box + 内部見出し + ユーザー画像) ===

type ProfilePhoto = NonNullable<CareerProfile['basics']['profilePhoto']>;

const renderPhotoBox = (profilePhoto: ProfilePhoto | undefined): string => {
  const { x, y, w, h } = PHOTO_BOX_MM;
  const style = `left:${x}mm;top:${y}mm;width:${w}mm;height:${h}mm;`;

  // 画像が無い場合は公式のガイドテキストを表示 (default phrase)
  const showGuide =
    profilePhoto === undefined ||
    profilePhoto.source === undefined ||
    profilePhoto.source.kind !== 'dataUri' ||
    !isNonEmpty(profilePhoto.source.dataUri);

  if (showGuide) {
    return `<div class="jcd-mhlw__photo" style="${style}"><div class="jcd-mhlw__photo-heading">写真をはる位置</div><div class="jcd-mhlw__photo-body">写真をはる必要が<br>ある場合<br>1.&nbsp;縦<br>&nbsp;&nbsp;&nbsp;横<br>2.本人単身胸から上<br>3.裏面のりづけ</div></div>`;
  }

  // dataUri が指定された場合は写真欄に画像を貼る (ガイドテキストは出さない)
  const photo = profilePhoto as ProfilePhoto;
  const source = photo.source;
  if (source === undefined || source.kind !== 'dataUri') {
    return '';
  }
  const altText = isNonEmpty(photo.altText) ? photo.altText : PROFILE_PHOTO_DEFAULT_ALT_TEXT;
  return `<div class="jcd-mhlw__photo jcd-mhlw__photo--filled" style="${style}"><img class="jcd-mhlw__photo-image" src="${escapeHtml(source.dataUri)}" alt="${escapeHtml(altText)}"></div>`;
};

// === ユーザーデータ流し込み (Phase 1.1 は最小限) ===
//
// 公式様式の氏名欄 (header の氏名行) の位置は y≈44.80mm の「氏」label の右側。
// CSS で氏名欄として位置決めし、basics.name から family + given を全角スペース
// 連結で挿入する。
//
// 流し込み位置の決定方針:
//   - "氏" のラベル bbox: x=26.42, y=44.80mm (mhlw-text-bbox.json より)
//   - その右側 (x ≈ 60mm) から氏名を表示
//   - 学歴・職歴 / 免許資格表 etc. の流し込みは Phase 1.3 以降

const renderUserName = (basics: CareerProfile['basics']): string => {
  if (basics.name === undefined) return '';
  const family = escapeHtml(basics.name.family);
  const given = escapeHtml(basics.name.given);
  // x: 約 60mm から開始、y: 「氏」ラベルと同じ y=44.80mm に揃える
  return `<div class="jcd-mhlw__name" style="left:60mm;top:44.80mm;font-size:14pt;">${family}　${given}</div>`;
};

const renderUserNameKana = (basics: CareerProfile['basics']): string => {
  if (basics.nameKana === undefined) return '';
  const family = escapeHtml(basics.nameKana.family);
  const given = escapeHtml(basics.nameKana.given);
  // ふりがな label (x=26.21, y=39.87mm) の右隣、少しサイズ落として表示
  return `<div class="jcd-mhlw__name-kana" style="left:60mm;top:39.87mm;font-size:9pt;">${family}　${given}</div>`;
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
.jcd-mhlw__label--gothic {
  font-family: "Noto Sans JP", "Yu Gothic", "Hiragino Sans", sans-serif;
}
.jcd-mhlw__label--title {
  font-family: "Klee One", "Hiragino Mincho ProN", "Yu Mincho", serif;
  font-weight: 500;
  letter-spacing: 0.2em;
  transform: scaleY(0.823);
  transform-origin: top left;
  margin-top: -1.5mm;
}

.jcd-mhlw__name, .jcd-mhlw__name-kana {
  position: absolute;
  z-index: 4;
  line-height: 1.1;
  white-space: nowrap;
  color: #000;
}

.jcd-mhlw__photo {
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

  const rules = (pdfRules.h_lines as Rule[])
    .map(renderHorizontalRule)
    .concat((pdfRules.v_lines as Rule[]).map(renderVerticalRule))
    .join('');

  const labels = renderOfficialLabels();
  const photo = renderPhotoBox(careerProfile.basics.profilePhoto);
  const userName = renderUserName(careerProfile.basics);
  const userNameKana = renderUserNameKana(careerProfile.basics);

  const html = `<article class="jcd-mhlw">${rules}${labels}${photo}${userNameKana}${userName}</article>`;

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
