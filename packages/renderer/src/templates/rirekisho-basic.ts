// rirekisho-basic は最初の built-in テンプレート。
//
// 制約 (意図的):
// - 教育歴と職歴を年表テーブルに統合しない (section-by-section blocks 構造)。
// - profilePhoto は render しない (HTML / CSS にスペース placeholder も出さない)。
// - credentialUrl は escape された plain text のみ (<a href> 化しない)。
// - すべての CareerProfile 由来文字列は escapeHtml を通してから HTML に挿入する。
// - 日付は YYYY年MM月DD日 / YYYY年MM月 形式に文字列変換 (Date object 不使用、
//   regex 不一致時は raw string fallback)。
// - 空 entry (object のすべての field が空 / undefined) / 空 section は skip する。
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
import type { RenderInput } from '../render-input';
import type { RenderedDocument } from '../rendered-document';
import type { TemplateDefinition } from '../template-registry';

const TEMPLATE_ID = 'rirekisho-basic';
const TEMPLATE_TITLE = '履歴書';

// === Format helpers (private) ===

const YEAR_MONTH_PATTERN = /^(\d{4})-(\d{2})$/;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

const formatYearMonth = (value: string): string => {
  const match = value.match(YEAR_MONTH_PATTERN);
  if (match === null) return value;
  return `${match[1]}年${Number(match[2])}月`;
};

const formatDate = (value: string): string => {
  const match = value.match(DATE_PATTERN);
  if (match === null) return value;
  return `${match[1]}年${Number(match[2])}月${Number(match[3])}日`;
};

const isNonEmpty = <T extends string>(value: T | undefined): value is T =>
  value !== undefined && value.length > 0;

const esc = (value: string): string => escapeHtml(value);

const formatPeriod = (
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

// renderTextList は raw string array を <ul> として描画する。
// 空要素は filter、すべて空なら '' を返す (section 側で skip 判定可能)。
const renderTextList = (items: readonly string[] | undefined): string => {
  if (items === undefined) return '';
  const valid = items.filter(isNonEmpty);
  if (valid.length === 0) return '';
  return `<ul>${valid.map((item) => `<li>${esc(item)}</li>`).join('')}</ul>`;
};

// === Section: basics ===

const renderAddress = (address: NonNullable<CareerProfile['basics']['address']>): string => {
  let result = '';
  if (isNonEmpty(address.postalCode)) result += `〒${address.postalCode} `;
  if (isNonEmpty(address.prefecture)) result += address.prefecture;
  if (isNonEmpty(address.cityAndRest)) result += address.cityAndRest;
  return result;
};

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
    const addr = renderAddress(basics.address);
    if (addr.length > 0) {
      rows.push(`<dt>住所</dt><dd>${esc(addr)}</dd>`);
    }
  }

  if (rows.length === 0) return '';
  return `<dl class="jcd-rirekisho__basics">${rows.join('')}</dl>`;
};

// === Section: education ===

const renderEducationEntry = (entry: Education): string => {
  const parts: string[] = [];
  const period = formatPeriod(entry.startDate, entry.endDate, undefined);
  if (period !== undefined) parts.push(esc(period));
  if (isNonEmpty(entry.institutionName)) parts.push(esc(entry.institutionName));
  if (isNonEmpty(entry.faculty)) parts.push(esc(entry.faculty));
  if (isNonEmpty(entry.department)) parts.push(esc(entry.department));
  if (isNonEmpty(entry.degree)) parts.push(esc(entry.degree));
  if (isNonEmpty(entry.status)) parts.push(esc(entry.status));
  if (parts.length === 0 && !isNonEmpty(entry.description)) return '';

  const main = parts.join(' ');
  const description = isNonEmpty(entry.description)
    ? `<div class="jcd-rirekisho__detail">${esc(entry.description)}</div>`
    : '';
  return `<li>${main}${description}</li>`;
};

const renderEducation = (entries: Education[] | undefined): string => {
  if (entries === undefined || entries.length === 0) return '';
  const items = entries.map(renderEducationEntry).filter((s) => s.length > 0);
  if (items.length === 0) return '';
  return `<section class="jcd-rirekisho__section jcd-rirekisho__section--education"><h2>学歴</h2><ul>${items.join('')}</ul></section>`;
};

// === Section: work experiences ===

const renderWorkExperienceEntry = (entry: WorkExperience): string => {
  const head: string[] = [];
  const period = formatPeriod(
    entry.period?.startDate,
    entry.period?.endDate,
    entry.period?.isCurrent,
  );
  if (period !== undefined) head.push(esc(period));
  if (isNonEmpty(entry.companyName)) head.push(esc(entry.companyName));
  if (isNonEmpty(entry.position)) head.push(esc(entry.position));
  if (isNonEmpty(entry.employmentType)) head.push(esc(entry.employmentType));

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

  if (head.length === 0 && detail.length === 0) return '';
  return `<li>${head.join(' ')}${detail.join('')}</li>`;
};

const renderWorkExperiences = (entries: WorkExperience[] | undefined): string => {
  if (entries === undefined || entries.length === 0) return '';
  const items = entries.map(renderWorkExperienceEntry).filter((s) => s.length > 0);
  if (items.length === 0) return '';
  return `<section class="jcd-rirekisho__section jcd-rirekisho__section--work"><h2>職歴</h2><ul>${items.join('')}</ul></section>`;
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
  if (entries === undefined || entries.length === 0) return '';
  const items = entries.map(renderSkillEntry).filter((s) => s.length > 0);
  if (items.length === 0) return '';
  return `<section class="jcd-rirekisho__section jcd-rirekisho__section--skills"><h2>スキル</h2><ul>${items.join('')}</ul></section>`;
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

  if (head.length === 0 && detail.length === 0) return '';
  return `<li>${head.join(' ')}${detail.join('')}</li>`;
};

const renderCertifications = (entries: Certification[] | undefined): string => {
  if (entries === undefined || entries.length === 0) return '';
  const items = entries.map(renderCertificationEntry).filter((s) => s.length > 0);
  if (items.length === 0) return '';
  return `<section class="jcd-rirekisho__section jcd-rirekisho__section--certifications"><h2>資格</h2><ul>${items.join('')}</ul></section>`;
};

// === Section: projects ===

const renderProjectEntry = (entry: Project): string => {
  const head: string[] = [];
  const period = formatPeriod(entry.startDate, entry.endDate, entry.isCurrent);
  if (period !== undefined) head.push(esc(period));
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

  if (head.length === 0 && detail.length === 0) return '';
  return `<li>${head.join(' ')}${detail.join('')}</li>`;
};

const renderProjects = (entries: Project[] | undefined): string => {
  if (entries === undefined || entries.length === 0) return '';
  const items = entries.map(renderProjectEntry).filter((s) => s.length > 0);
  if (items.length === 0) return '';
  return `<section class="jcd-rirekisho__section jcd-rirekisho__section--projects"><h2>プロジェクト</h2><ul>${items.join('')}</ul></section>`;
};

// === CSS ===

const CSS = `@page { size: A4; margin: 15mm; }
.jcd-rirekisho { font-family: 'Hiragino Sans', 'Yu Gothic', 'Meiryo', sans-serif; font-size: 10.5pt; color: #000; line-height: 1.6; }
.jcd-rirekisho__title { font-size: 18pt; font-weight: bold; text-align: center; margin: 0 0 1em; }
.jcd-rirekisho__basics { display: grid; grid-template-columns: 8em 1fr; gap: 0.4em 1em; margin: 0 0 1.5em; }
.jcd-rirekisho__basics dt { font-weight: normal; color: #444; }
.jcd-rirekisho__basics dd { margin: 0; }
.jcd-rirekisho__section { margin-block-start: 1.5em; }
.jcd-rirekisho__section h2 { font-size: 13pt; border-bottom: 1pt solid #000; margin: 0 0 0.6em; padding-bottom: 0.2em; }
.jcd-rirekisho__section ul { margin: 0; padding-inline-start: 1.5em; }
.jcd-rirekisho__section li { margin-block-end: 0.6em; }
.jcd-rirekisho__detail { margin-block-start: 0.2em; }
.jcd-rirekisho__detail ul { margin: 0.2em 0; }
`;

// === Render entrypoint ===

const renderRirekishoBasic = (input: RenderInput): RenderedDocument => {
  const { careerProfile } = input;
  const sections: string[] = [];

  const basics = renderBasics(careerProfile.basics);
  const header =
    basics === ''
      ? `<header class="jcd-rirekisho__header"><h1 class="jcd-rirekisho__title">${TEMPLATE_TITLE}</h1></header>`
      : `<header class="jcd-rirekisho__header"><h1 class="jcd-rirekisho__title">${TEMPLATE_TITLE}</h1>${basics}</header>`;
  sections.push(header);

  const education = renderEducation(careerProfile.educationHistory);
  if (education !== '') sections.push(education);

  const work = renderWorkExperiences(careerProfile.workExperiences);
  if (work !== '') sections.push(work);

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
