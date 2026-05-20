// rirekisho-basic は最初の built-in テンプレート。
//
// 制約 (意図的):
// - 教育歴と職歴を **年表テーブル形式 (学歴・職歴 統合 section)** で描画する。
//   row 順序は input order を保持し、global sort はしない。
// - 教育歴の row は startDate → 入学、endDate → status (default 卒業) の
//   2 row に分解。職歴の row も startDate → 入社、endDate → 退職 の 2 row
//   に分解 (isCurrent === true の entry は退職 row を抑制し、全 entries 処理後
//   に 1 つだけ「現在に至る」row を末尾に追加)。
// - 履歴書の年表テーブルでは responsibilities / achievements / summary を
//   描画しない (詳細は職務経歴書側 shokumukeirekisho-basic の責務)。
// - description は dated row (入学 / 卒業) には付けない、no-date row のみ
//   `（description）` で末尾に補足する。
// - profilePhoto は **dataUri 限定** で header 右側に render する。
//   relativePath は本テンプレートでは render しない (file system /
//   asset resolution / URL policy 未確定のため)。<img> の src / alt は
//   escapeHtml を通して double-quoted attribute value に挿入する。
//   写真が無い / source が dataUri 以外の場合は photo container も出さない
//   (空 placeholder を作らない)。画像デコード / リサイズ / 検証は
//   renderer で行わない (core validation が責務)。
// - credentialUrl は escape された plain text のみ (<a href> 化しない)。
// - すべての CareerProfile 由来文字列は escapeHtml を通してから HTML に
//   挿入する。HistoryRow は raw display string を保持し、renderHistoryRow で
//   最終的に escape する。
// - 日付は YYYY年M月D日 / YYYY年M月 形式に文字列変換 (Date object 不使用、
//   regex 不一致時は raw string fallback)。
// - 空 entry (object のすべての field が空 / undefined) は row を生成しない。
//   学歴 / 職歴 双方の row が無ければ history section ごと出さない。
// - parseCareerProfile / safeParseCareerProfile は呼ばない (parse 済み入力前提)。

import type {
  CareerProfile,
  Certification,
  Education,
  Project,
  Skill,
  WorkExperience,
} from '@jcd-editor/core';

import { escapeHtml } from '../_internal/html-escape';
import {
  renderItemList,
  renderListItem,
  renderSection,
  renderTextList,
} from '../_internal/html-renderer';
import {
  formatAddress,
  formatDate,
  formatYearMonth,
  isNonEmpty,
} from '../_internal/template-format';
import type { RenderInput } from '../render-input';
import type { RenderedDocument } from '../rendered-document';
import type { TemplateDefinition } from '../template-registry';

const TEMPLATE_ID = 'rirekisho-basic';
const TEMPLATE_TITLE = '履歴書';
const PROFILE_PHOTO_DEFAULT_ALT_TEXT = '証明写真';

// indexed access で導出: core import を broaden しない
type ProfilePhoto = NonNullable<CareerProfile['basics']['profilePhoto']>;

const esc = (value: string): string => escapeHtml(value);

// === 証明写真 (header 右側、dataUri のみ) ===
//
// 描画条件: profilePhoto.source.kind === 'dataUri' かつ dataUri が non-empty
// 上記以外 (relativePath / source 無し / dataUri 空 / 想定外 kind) は何も
// 出力しない。relativePath を `<img src>` に渡すことは privacy / file
// leakage の観点で避ける (asset resolution は将来の別 PR で対応)。
// altText が undefined / 空文字列なら fixed default '証明写真' を使う
// (固定 phrase、escape 不要)。

const renderProfilePhoto = (profilePhoto: ProfilePhoto | undefined): string => {
  if (profilePhoto === undefined) return '';
  if (profilePhoto.source === undefined) return '';
  if (profilePhoto.source.kind !== 'dataUri') return '';
  if (!isNonEmpty(profilePhoto.source.dataUri)) return '';

  const altText = isNonEmpty(profilePhoto.altText)
    ? profilePhoto.altText
    : PROFILE_PHOTO_DEFAULT_ALT_TEXT;
  return `<div class="jcd-rirekisho__photo"><img class="jcd-rirekisho__photo-image" src="${esc(profilePhoto.source.dataUri)}" alt="${esc(altText)}"></div>`;
};

// === Section: basics ===

const renderBasics = (basics: CareerProfile['basics']): string => {
  const rows: string[] = [];

  if (basics.name !== undefined) {
    rows.push(`<dt>氏名</dt><dd>${esc(basics.name.family)}　${esc(basics.name.given)}</dd>`);
  }
  if (basics.nameKana !== undefined) {
    rows.push(
      `<dt>フリガナ</dt><dd>${esc(basics.nameKana.family)}　${esc(basics.nameKana.given)}</dd>`,
    );
  }
  if (basics.birthDate !== undefined) {
    rows.push(`<dt>生年月日</dt><dd>${esc(formatDate(basics.birthDate))}</dd>`);
  }
  if (isNonEmpty(basics.email)) {
    rows.push(`<dt>メールアドレス</dt><dd>${esc(basics.email)}</dd>`);
  }
  if (isNonEmpty(basics.phone)) {
    rows.push(`<dt>電話番号</dt><dd>${esc(basics.phone)}</dd>`);
  }
  if (basics.address !== undefined) {
    const addr = formatAddress(basics.address);
    if (addr.length > 0) {
      rows.push(`<dt>住所</dt><dd>${esc(addr)}</dd>`);
    }
  }

  if (rows.length === 0) return '';
  return `<dl class="jcd-rirekisho__basics">${rows.join('')}</dl>`;
};

// === 学歴・職歴 統合年表 (history) ===
//
// HistoryRow は raw display string を保持する (escape はここでは行わない)。
// renderHistoryRow が最終的に escapeHtml を通して HTML に変換する。

type HistoryRow =
  | { kind: 'heading'; label: '学歴' | '職歴' }
  | { kind: 'entry'; date: string; content: string };

const educationSubject = (entry: Education): string => {
  const parts: string[] = [];
  if (isNonEmpty(entry.institutionName)) parts.push(entry.institutionName);
  if (isNonEmpty(entry.faculty)) parts.push(entry.faculty);
  if (isNonEmpty(entry.department)) parts.push(entry.department);
  if (isNonEmpty(entry.degree)) parts.push(entry.degree);
  return parts.join(' ');
};

const buildEducationRows = (entries: Education[] | undefined): HistoryRow[] => {
  if (entries === undefined || entries.length === 0) return [];

  const rows: HistoryRow[] = [];

  for (const entry of entries) {
    const subject = educationSubject(entry);
    const description = isNonEmpty(entry.description) ? entry.description : '';

    // dated row: startDate → 入学
    if (entry.startDate !== undefined) {
      const date = formatYearMonth(entry.startDate);
      const content = subject === '' ? '入学' : `${subject} 入学`;
      rows.push({ kind: 'entry', date, content });
    }

    // dated row: endDate → status (default 卒業)
    if (entry.endDate !== undefined) {
      const date = formatYearMonth(entry.endDate);
      const ending = isNonEmpty(entry.status) ? entry.status : '卒業';
      const content = subject === '' ? ending : `${subject} ${ending}`;
      rows.push({ kind: 'entry', date, content });
    }

    // no-date row: date が無いが意味のある field がある
    if (entry.startDate === undefined && entry.endDate === undefined) {
      const contentParts: string[] = [];
      if (subject !== '') contentParts.push(subject);
      if (isNonEmpty(entry.status)) contentParts.push(entry.status);
      let content = contentParts.join(' ');
      if (description !== '') {
        content = content === '' ? `（${description}）` : `${content}（${description}）`;
      }
      if (content !== '') {
        rows.push({ kind: 'entry', date: '', content });
      }
    }
  }

  if (rows.length === 0) return [];
  return [{ kind: 'heading', label: '学歴' }, ...rows];
};

const workAnnotation = (entry: WorkExperience): string => {
  const parts: string[] = [];
  if (isNonEmpty(entry.employmentType)) parts.push(entry.employmentType);
  if (isNonEmpty(entry.position)) parts.push(entry.position);
  if (parts.length === 0) return '';
  return `（${parts.join(' / ')}）`;
};

const buildWorkRows = (entries: WorkExperience[] | undefined): HistoryRow[] => {
  if (entries === undefined || entries.length === 0) return [];

  const rows: HistoryRow[] = [];
  let hasCurrent = false;

  for (const entry of entries) {
    const company = isNonEmpty(entry.companyName) ? entry.companyName : '';
    const annotation = workAnnotation(entry);
    const startDate = entry.period?.startDate;
    const endDate = entry.period?.endDate;
    const isCurrent = entry.period?.isCurrent === true;

    if (isCurrent) hasCurrent = true;

    // dated row: startDate → 入社
    if (startDate !== undefined) {
      const date = formatYearMonth(startDate);
      const content = company === '' ? `入社${annotation}` : `${company} 入社${annotation}`;
      rows.push({ kind: 'entry', date, content });
    }

    // dated row: endDate → 退職 (ただし isCurrent === true なら抑制)
    if (!isCurrent && endDate !== undefined) {
      const date = formatYearMonth(endDate);
      const content = company === '' ? '退職' : `${company} 退職`;
      rows.push({ kind: 'entry', date, content });
    }

    // no-date row: date が無く isCurrent でもないが company / annotation がある
    if (startDate === undefined && endDate === undefined && !isCurrent) {
      const contentParts: string[] = [];
      if (company !== '') contentParts.push(company);
      const content = contentParts.join('') + annotation;
      if (content !== '') {
        rows.push({ kind: 'entry', date: '', content });
      }
    }
  }

  // aggregate: 複数 current でも 1 行のみ
  if (hasCurrent) {
    rows.push({ kind: 'entry', date: '', content: '現在に至る' });
  }

  if (rows.length === 0) return [];
  return [{ kind: 'heading', label: '職歴' }, ...rows];
};

const renderHistoryRow = (row: HistoryRow): string => {
  if (row.kind === 'heading') {
    // label は固定 union ('学歴' | '職歴')、escape 不要
    return `<tr class="jcd-rirekisho__history-heading"><td colspan="2">${row.label}</td></tr>`;
  }
  const dateCell = row.date === '' ? '' : esc(row.date);
  const contentCell = esc(row.content);
  return `<tr><td>${dateCell}</td><td>${contentCell}</td></tr>`;
};

const renderHistorySection = (careerProfile: CareerProfile): string => {
  const educationRows = buildEducationRows(careerProfile.educationHistory);
  const workRows = buildWorkRows(careerProfile.workExperiences);
  if (educationRows.length === 0 && workRows.length === 0) return '';

  const rowsHtml = [...educationRows, ...workRows].map(renderHistoryRow).join('');
  const tableBody = `<table class="jcd-rirekisho__history-table"><thead><tr><th>年月</th><th>内容</th></tr></thead><tbody>${rowsHtml}</tbody></table>`;
  return renderSection({
    baseClass: 'jcd-rirekisho',
    variant: 'history',
    heading: '学歴・職歴',
    bodyHtml: tableBody,
  });
};

// === Section: skills ===

const renderSkillEntry = (entry: Skill): string => {
  const parts: string[] = [];
  if (isNonEmpty(entry.name)) parts.push(esc(entry.name));
  const meta: string[] = [];
  if (isNonEmpty(entry.category)) meta.push(esc(entry.category));
  if (isNonEmpty(entry.level)) meta.push(esc(entry.level));
  if (meta.length > 0) parts.push(`(${meta.join(' / ')})`);
  if (isNonEmpty(entry.description)) parts.push(esc(entry.description));
  if (parts.length === 0) return '';
  return `<li>${parts.join(' ')}</li>`;
};

const renderSkills = (entries: Skill[] | undefined): string => {
  const items = (entries ?? []).map(renderSkillEntry);
  return renderSection({
    baseClass: 'jcd-rirekisho',
    variant: 'skills',
    heading: 'スキル',
    bodyHtml: renderItemList(items),
  });
};

// === Section: certifications ===

const renderCertificationEntry = (entry: Certification): string => {
  const head: string[] = [];
  if (entry.acquiredDate !== undefined) {
    head.push(esc(formatYearMonth(entry.acquiredDate)));
  }
  if (isNonEmpty(entry.name)) head.push(esc(entry.name));
  if (isNonEmpty(entry.issuer)) head.push(esc(entry.issuer));

  const detail: string[] = [];
  if (isNonEmpty(entry.credentialId)) {
    detail.push(`<div class="jcd-rirekisho__detail">認定 ID: ${esc(entry.credentialId)}</div>`);
  }
  // credentialUrl は escape された plain text のみ (href にしない)
  if (isNonEmpty(entry.credentialUrl)) {
    detail.push(`<div class="jcd-rirekisho__detail">${esc(entry.credentialUrl)}</div>`);
  }
  if (entry.expirationDate !== undefined) {
    detail.push(
      `<div class="jcd-rirekisho__detail">失効: ${esc(formatYearMonth(entry.expirationDate))}</div>`,
    );
  }
  if (isNonEmpty(entry.description)) {
    detail.push(`<div class="jcd-rirekisho__detail">${esc(entry.description)}</div>`);
  }

  return renderListItem(head, detail);
};

const renderCertifications = (entries: Certification[] | undefined): string => {
  const items = (entries ?? []).map(renderCertificationEntry);
  return renderSection({
    baseClass: 'jcd-rirekisho',
    variant: 'certifications',
    heading: '資格',
    bodyHtml: renderItemList(items),
  });
};

// === Section: projects ===

const renderProjectEntry = (entry: Project): string => {
  const head: string[] = [];
  const startDate = entry.startDate === undefined ? '' : formatYearMonth(entry.startDate);
  const endDate =
    entry.isCurrent === true
      ? '現在'
      : entry.endDate === undefined
        ? ''
        : formatYearMonth(entry.endDate);
  let period = '';
  if (startDate !== '' && endDate !== '') period = `${startDate} - ${endDate}`;
  else if (startDate !== '') period = startDate;
  else if (endDate !== '') period = endDate;
  if (period !== '') head.push(esc(period));
  if (isNonEmpty(entry.name)) head.push(esc(entry.name));
  if (isNonEmpty(entry.organizationName)) head.push(esc(entry.organizationName));
  if (isNonEmpty(entry.role)) head.push(esc(entry.role));

  const detail: string[] = [];
  if (isNonEmpty(entry.summary)) {
    detail.push(`<div class="jcd-rirekisho__detail">${esc(entry.summary)}</div>`);
  }
  const responsibilities = renderTextList(entry.responsibilities);
  if (responsibilities !== '') {
    detail.push(`<div class="jcd-rirekisho__detail"><div>担当業務</div>${responsibilities}</div>`);
  }
  const achievements = renderTextList(entry.achievements);
  if (achievements !== '') {
    detail.push(`<div class="jcd-rirekisho__detail"><div>成果</div>${achievements}</div>`);
  }
  const technologies = renderTextList(entry.technologies);
  if (technologies !== '') {
    detail.push(`<div class="jcd-rirekisho__detail"><div>使用技術</div>${technologies}</div>`);
  }

  return renderListItem(head, detail);
};

const renderProjects = (entries: Project[] | undefined): string => {
  const items = (entries ?? []).map(renderProjectEntry);
  return renderSection({
    baseClass: 'jcd-rirekisho',
    variant: 'projects',
    heading: 'プロジェクト',
    bodyHtml: renderItemList(items),
  });
};

// === CSS ===

const CSS = `@page { size: A4; margin: 15mm; }
.jcd-rirekisho { font-family: 'Hiragino Sans', 'Yu Gothic', 'Meiryo', sans-serif; font-size: 10.5pt; color: #000; line-height: 1.6; }
.jcd-rirekisho__header { display: flex; align-items: flex-start; gap: 1em; margin: 0 0 1.5em; }
.jcd-rirekisho__header-main { flex: 1; min-width: 0; }
.jcd-rirekisho__title { font-size: 18pt; font-weight: bold; text-align: center; margin: 0 0 1em; }
.jcd-rirekisho__basics { display: grid; grid-template-columns: 8em 1fr; gap: 0.4em 1em; margin: 0; }
.jcd-rirekisho__basics dt { font-weight: normal; color: #444; }
.jcd-rirekisho__basics dd { margin: 0; }
.jcd-rirekisho__photo { width: 30mm; height: 40mm; flex-shrink: 0; border: 0.5pt solid #ccc; }
.jcd-rirekisho__photo-image { width: 100%; height: 100%; object-fit: cover; display: block; }
.jcd-rirekisho__section { margin-block-start: 1.5em; }
.jcd-rirekisho__section h2 { font-size: 13pt; border-bottom: 1pt solid #000; margin: 0 0 0.6em; padding-bottom: 0.2em; }
.jcd-rirekisho__section ul { margin: 0; padding-inline-start: 1.5em; }
.jcd-rirekisho__section li { margin-block-end: 0.6em; }
.jcd-rirekisho__detail { margin-block-start: 0.2em; }
.jcd-rirekisho__detail ul { margin: 0.2em 0; }
.jcd-rirekisho__history-table { width: 100%; border-collapse: collapse; margin: 0; }
.jcd-rirekisho__history-table th, .jcd-rirekisho__history-table td { border-bottom: 0.5pt solid #ccc; padding: 0.3em 0.5em; vertical-align: top; text-align: left; }
.jcd-rirekisho__history-table th { font-weight: normal; background: #f5f5f5; width: 8em; }
.jcd-rirekisho__history-heading td { font-weight: bold; text-align: center; background: #fafafa; }
`;

// === Render entrypoint ===

const renderRirekishoBasic = (input: RenderInput): RenderedDocument => {
  const { careerProfile } = input;
  const sections: string[] = [];

  const basics = renderBasics(careerProfile.basics);
  const photo = renderProfilePhoto(careerProfile.basics.profilePhoto);
  // header-main wrapper を photo 有無に関係なく常時 wrap する
  // (条件分岐の複雑性を避け、photo を flex で横並びにする layout を一貫させる)。
  const header = `<header class="jcd-rirekisho__header"><div class="jcd-rirekisho__header-main"><h1 class="jcd-rirekisho__title">${TEMPLATE_TITLE}</h1>${basics}</div>${photo}</header>`;
  sections.push(header);

  const history = renderHistorySection(careerProfile);
  if (history !== '') sections.push(history);

  const skills = renderSkills(careerProfile.skills);
  if (skills !== '') sections.push(skills);

  const certifications = renderCertifications(careerProfile.certifications);
  if (certifications !== '') sections.push(certifications);

  const projects = renderProjects(careerProfile.projects);
  if (projects !== '') sections.push(projects);

  const html = `<article class="jcd-rirekisho">${sections.join('')}</article>`;

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

export const rirekishoBasicTemplate: TemplateDefinition = {
  id: TEMPLATE_ID,
  kind: 'rirekisho',
  name: '履歴書（基本）',
  render: renderRirekishoBasic,
};
