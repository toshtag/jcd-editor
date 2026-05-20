// TemplateRegistry は templateId / DocumentKind から TemplateDefinition を
// lookup する小さなコンテナ。動的ロードや plugin システムは持たない。
// createTemplateRegistry が唯一の生成手段で、user が独自 registry を
// 実装することは想定しない (lock down)。

import type { DocumentKind } from './document-kind';
import { RendererError } from './errors';
import type { RenderInput } from './render-input';
import type { RenderedDocument } from './rendered-document';
import type { TemplateId } from './template-id';

export type TemplateRenderer = (input: RenderInput) => RenderedDocument;

export type TemplateDefinition = {
  id: TemplateId;
  kind: DocumentKind;
  name: string;
  render: TemplateRenderer;
};

export type TemplateRegistry = {
  getTemplates: () => readonly TemplateDefinition[];
  getTemplatesByKind: (kind: DocumentKind) => readonly TemplateDefinition[];
  getTemplate: (id: TemplateId) => TemplateDefinition | undefined;
};

export const createTemplateRegistry = (
  templates: readonly TemplateDefinition[],
): TemplateRegistry => {
  // 内部表現は配列 (挿入順保持) + id → template の Map。
  // 渡された配列を直接保持せず、shallow copy してから利用することで、
  // 呼び出し側の配列 mutation で registry 状態が変わることを防ぐ。
  const internal: TemplateDefinition[] = [];
  const byId = new Map<TemplateId, TemplateDefinition>();

  for (const template of templates) {
    if (byId.has(template.id)) {
      throw new RendererError(`Duplicate template id '${template.id}'`, 'TEMPLATE_DUPLICATE_ID');
    }
    byId.set(template.id, template);
    internal.push(template);
  }

  return {
    getTemplates: () => internal.slice(),
    getTemplatesByKind: (kind) => internal.filter((t) => t.kind === kind),
    getTemplate: (id) => byId.get(id),
  };
};
