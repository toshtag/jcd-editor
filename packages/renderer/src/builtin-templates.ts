// 公開 API: built-in templates の bundle 配列と default registry factory。
//
// 配列の順序は DocumentKind の宣言順 (rirekisho → shokumukeirekisho) に揃え、
// 将来テンプレートを追加する際は **append-only** semantics とする
// (既存順序の入れ替え / 削除は breaking change として扱う、UI が表示順に
// 依存しうるため)。
//
// shallow freeze で配列レベルの mutation (push / index 代入 / splice 等)
// を runtime で防ぐ。template 本体の field 書き換え
// (例: builtinTemplates[0].name = 'mutated') は防がない — 必要になれば
// 別 PR で deep freeze を検討する。
//
// createDefaultTemplateRegistry は createTemplateRegistry(builtinTemplates) の
// 薄い wrapper。引数なし / caching なし、各呼び出しで新規 TemplateRegistry
// インスタンスを返す。custom テンプレートを混ぜたい場合は
// createTemplateRegistry([...builtinTemplates, customTemplate]) で明示的に
// composition する。

import {
  createTemplateRegistry,
  type TemplateDefinition,
  type TemplateRegistry,
} from './template-registry';
import { rirekishoMhlwA4Template } from './templates/rirekisho-mhlw-a4';
import { shokumukeirekishoBasicTemplate } from './templates/shokumukeirekisho-basic';

// rirekisho の default は 'rirekisho-mhlw-a4' (公式 厚労省様式 A4 縦 2 ページ)。
// 実運用で一般的な A4 印刷 / メール提出に合わせ default に採用。
// A3 横 (見開き) 版 'rirekisho-mhlw-a3' は templateId 明示で選択可能だが、
// kind=rirekisho の implicit selection が ambiguous にならないよう registry には載せていない。
// 旧 'rirekisho-basic' は CONCEPT.md の JIS 様式スコープと乖離していたため、
// 同じく registry から外している (file 自体は Phase 1.5 で削除予定)。
export const builtinTemplates: readonly TemplateDefinition[] = Object.freeze([
  rirekishoMhlwA4Template,
  shokumukeirekishoBasicTemplate,
]);

export const createDefaultTemplateRegistry = (): TemplateRegistry =>
  createTemplateRegistry(builtinTemplates);
