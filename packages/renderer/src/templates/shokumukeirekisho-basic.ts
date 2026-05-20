// shokumukeirekisho-basic は 2 個目の built-in テンプレート。
//
// 制約 (意図的):
// - 業界別 / 職種別 variant ではない (basic = first / minimal を表現)。
// - basics は氏名 / メール / 電話 / 住所のみ (職務経歴書では nameKana /
//   birthDate を一般に表示しないため意図的にスキップ)。
// - profilePhoto は render しない (rirekisho-basic と同じ方針)。
// - credentialUrl は escape された plain text のみ (<a href> 化しない)。
// - section 順序は職務経歴 → プロジェクト → スキル → 資格 → 学歴
//   (educationHistory は optional final、職務経歴書は career 中心、
//   education は補足情報)。
// - 教育歴 + 職歴の年表テーブルマージは行わない (section blocks 構成)。
// - グローバル「職務要約」「自己PR」は CareerProfile に存在しないため
//   render or synthesize しない。
// - すべての CareerProfile 由来文字列は escapeHtml を通してから HTML に挿入する。
// - 日付は string-only 変換 (Date object 不使用)。
// - 空 entry / 空 section は skip する。
// - parseCareerProfile / safeParseCareerProfile は呼ばない (parse 済み入力前提)。
//
// core import policy:
// - 本 module は `@jcd-editor/core` を直接 import しない。
// - RenderInput 経由で indexed access types を使って必要な型を導出する。

import { escapeHtml } from '../_internal/html-escape';
import { renderTextList } from '../_internal/html-renderer';
import {
  formatAddress,
  formatPeriod,
  formatYearMonth,
  isNonEmpty,
} from '../_internal/template-format';
import type { RenderInput } from '../render-input';
import type { RenderedDocument } from '../rendered-document';
import type { TemplateDefinition } from '../template-registry';

type CareerProfile = RenderInput['careerProfile'];
type Basics = CareerProfile['basics'];
type WorkExperience = NonNullable<CareerProfile['workExperiences']>[number];
type Education = NonNullable<CareerProfile['educationHistory']>[number];
type Skill = NonNullable<CareerProfile['skills']>[number];
type Certification = NonNullable<CareerProfile['certifications']>[number];
type Project = NonNullable<CareerProfile['projects']>[number];

const TEMPLATE_ID = 'shokumukeirekisho-basic';
const TEMPLATE_TITLE = '職務経歴書';

const esc = (value: string): string => escapeHtml(value);

// === Section: basics (簡略版) ===
// 職務経歴書では nameKana / birthDate / profilePhoto を表示しない。

const renderBasics = (basics: Basics): string => {
  const rows: string[] = [];

  if (basics.name !== undefined) {
    rows.push(`<dt>氏名</dt><dd>${esc(basics.name.family)}　${esc(basics.name.given)}</dd>`);
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
  return `<dl class="jcd-shokumukeirekisho__basics">${rows.join('')}</dl>`;
};

// === Section: work experiences (main content) ===

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
    detail.push(`<div class="jcd-shokumukeirekisho__detail">${esc(entry.summary)}</div>`);
  }
  const responsibilities = renderTextList(entry.responsibilities);
  if (responsibilities !== '') {
    detail.push(
      `<div class="jcd-shokumukeirekisho__detail"><div>担当業務</div>${responsibilities}</div>`,
    );
  }
  const achievements = renderTextList(entry.achievements);
  if (achievements !== '') {
    detail.push(`<div class="jcd-shokumukeirekisho__detail"><div>成果</div>${achievements}</div>`);
  }

  if (head.length === 0 && detail.length === 0) return '';
  return `<li>${head.join(' ')}${detail.join('')}</li>`;
};

const renderWorkExperiences = (entries: WorkExperience[] | undefined): string => {
  if (entries === undefined || entries.length === 0) return '';
  const items = entries.map(renderWorkExperienceEntry).filter((s) => s.length > 0);
  if (items.length === 0) return '';
  return `<section class="jcd-shokumukeirekisho__section jcd-shokumukeirekisho__section--work"><h2>職務経歴</h2><ul>${items.join('')}</ul></section>`;
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
    detail.push(`<div class="jcd-shokumukeirekisho__detail">${esc(entry.summary)}</div>`);
  }
  const responsibilities = renderTextList(entry.responsibilities);
  if (responsibilities !== '') {
    detail.push(
      `<div class="jcd-shokumukeirekisho__detail"><div>担当業務</div>${responsibilities}</div>`,
    );
  }
  const achievements = renderTextList(entry.achievements);
  if (achievements !== '') {
    detail.push(`<div class="jcd-shokumukeirekisho__detail"><div>成果</div>${achievements}</div>`);
  }
  const technologies = renderTextList(entry.technologies);
  if (technologies !== '') {
    detail.push(
      `<div class="jcd-shokumukeirekisho__detail"><div>使用技術</div>${technologies}</div>`,
    );
  }

  if (head.length === 0 && detail.length === 0) return '';
  return `<li>${head.join(' ')}${detail.join('')}</li>`;
};

const renderProjects = (entries: Project[] | undefined): string => {
  if (entries === undefined || entries.length === 0) return '';
  const items = entries.map(renderProjectEntry).filter((s) => s.length > 0);
  if (items.length === 0) return '';
  return `<section class="jcd-shokumukeirekisho__section jcd-shokumukeirekisho__section--projects"><h2>プロジェクト</h2><ul>${items.join('')}</ul></section>`;
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
  return `<section class="jcd-shokumukeirekisho__section jcd-shokumukeirekisho__section--skills"><h2>スキル</h2><ul>${items.join('')}</ul></section>`;
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
    detail.push(
      `<div class="jcd-shokumukeirekisho__detail">認定 ID: ${esc(entry.credentialId)}</div>`,
    );
  }
  // credentialUrl は escape された plain text のみ (href にしない)
  if (isNonEmpty(entry.credentialUrl)) {
    detail.push(`<div class="jcd-shokumukeirekisho__detail">${esc(entry.credentialUrl)}</div>`);
  }
  if (entry.expirationDate !== undefined) {
    detail.push(
      `<div class="jcd-shokumukeirekisho__detail">失効: ${esc(formatYearMonth(entry.expirationDate))}</div>`,
    );
  }
  if (isNonEmpty(entry.description)) {
    detail.push(`<div class="jcd-shokumukeirekisho__detail">${esc(entry.description)}</div>`);
  }

  if (head.length === 0 && detail.length === 0) return '';
  return `<li>${head.join(' ')}${detail.join('')}</li>`;
};

const renderCertifications = (entries: Certification[] | undefined): string => {
  if (entries === undefined || entries.length === 0) return '';
  const items = entries.map(renderCertificationEntry).filter((s) => s.length > 0);
  if (items.length === 0) return '';
  return `<section class="jcd-shokumukeirekisho__section jcd-shokumukeirekisho__section--certifications"><h2>資格</h2><ul>${items.join('')}</ul></section>`;
};

// === Section: education (optional final) ===

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
    ? `<div class="jcd-shokumukeirekisho__detail">${esc(entry.description)}</div>`
    : '';
  return `<li>${main}${description}</li>`;
};

const renderEducation = (entries: Education[] | undefined): string => {
  if (entries === undefined || entries.length === 0) return '';
  const items = entries.map(renderEducationEntry).filter((s) => s.length > 0);
  if (items.length === 0) return '';
  return `<section class="jcd-shokumukeirekisho__section jcd-shokumukeirekisho__section--education"><h2>学歴</h2><ul>${items.join('')}</ul></section>`;
};

// === CSS ===

const CSS = `@page { size: A4; margin: 15mm; }
.jcd-shokumukeirekisho { font-family: 'Hiragino Sans', 'Yu Gothic', 'Meiryo', sans-serif; font-size: 10.5pt; color: #000; line-height: 1.6; }
.jcd-shokumukeirekisho__title { font-size: 18pt; font-weight: bold; text-align: center; margin: 0 0 1em; }
.jcd-shokumukeirekisho__basics { display: grid; grid-template-columns: 8em 1fr; gap: 0.4em 1em; margin: 0 0 1.5em; }
.jcd-shokumukeirekisho__basics dt { font-weight: normal; color: #444; }
.jcd-shokumukeirekisho__basics dd { margin: 0; }
.jcd-shokumukeirekisho__section { margin-block-start: 1.5em; }
.jcd-shokumukeirekisho__section h2 { font-size: 13pt; border-bottom: 1pt solid #000; margin: 0 0 0.6em; padding-bottom: 0.2em; }
.jcd-shokumukeirekisho__section ul { margin: 0; padding-inline-start: 1.5em; }
.jcd-shokumukeirekisho__section li { margin-block-end: 0.6em; }
.jcd-shokumukeirekisho__detail { margin-block-start: 0.2em; }
.jcd-shokumukeirekisho__detail ul { margin: 0.2em 0; }
`;

// === Render entrypoint ===
// section 順序: header (title + basics) → 職務経歴 → プロジェクト → スキル → 資格 → 学歴 (optional final)

const renderShokumukeirekishoBasic = (input: RenderInput): RenderedDocument => {
  const { careerProfile } = input;
  const sections: string[] = [];

  const basics = renderBasics(careerProfile.basics);
  const header =
    basics === ''
      ? `<header class="jcd-shokumukeirekisho__header"><h1 class="jcd-shokumukeirekisho__title">${TEMPLATE_TITLE}</h1></header>`
      : `<header class="jcd-shokumukeirekisho__header"><h1 class="jcd-shokumukeirekisho__title">${TEMPLATE_TITLE}</h1>${basics}</header>`;
  sections.push(header);

  const work = renderWorkExperiences(careerProfile.workExperiences);
  if (work !== '') sections.push(work);

  const projects = renderProjects(careerProfile.projects);
  if (projects !== '') sections.push(projects);

  const skills = renderSkills(careerProfile.skills);
  if (skills !== '') sections.push(skills);

  const certifications = renderCertifications(careerProfile.certifications);
  if (certifications !== '') sections.push(certifications);

  const education = renderEducation(careerProfile.educationHistory);
  if (education !== '') sections.push(education);

  const html = `<article class="jcd-shokumukeirekisho">${sections.join('')}</article>`;

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

export const shokumukeirekishoBasicTemplate: TemplateDefinition = {
  id: TEMPLATE_ID,
  kind: 'shokumukeirekisho',
  name: '職務経歴書（基本）',
  render: renderShokumukeirekishoBasic,
};
