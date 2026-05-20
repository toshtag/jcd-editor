// TemplateId は renderer が扱うテンプレートの識別子。
// render-input.ts と template-registry.ts の相互参照を防ぐため、
// 単独ファイルに分離している (foundation 層では type-only でも
// 相互参照を避ける方針)。

export type TemplateId = string;
