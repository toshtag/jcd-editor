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
import { rirekishoBasicTemplate } from './templates/rirekisho-basic';
import { shokumukeirekishoBasicTemplate } from './templates/shokumukeirekisho-basic';

export const builtinTemplates: readonly TemplateDefinition[] = Object.freeze([
  rirekishoBasicTemplate,
  shokumukeirekishoBasicTemplate,
]);

export const createDefaultTemplateRegistry = (): TemplateRegistry =>
  createTemplateRegistry(builtinTemplates);
