// renderDocument は RenderInput を registry に照会して template を選択し、
// RenderedDocument を返す top-level entrypoint。
//
// 挙動の要点:
// - input.templateId !== undefined のとき: 明示選択。truthy 判定は使わない
//   (空文字列も「指定あり」として扱う)。
// - input.templateId が undefined のとき: input.kind にマッチする template
//   が 1 つの場合は implicit に選択、0 件 / 複数なら throw。
// - 選択された template.kind が input.kind と一致しない場合は throw。
// - template.render() の戻り値の kind が input.kind と一致しない場合は throw
//   (template renderer のバグ防御)。
// - metadata.templateId は registry が選択した id で **overwrite** する
//   (template renderer のバグ防御、registry が source of truth)。
// - template renderer の例外は catch / wrap しない (stack trace 保持)。
// - input は mutate しない。

import { RendererError } from './errors';
import type { RenderInput } from './render-input';
import type { RenderedDocument } from './rendered-document';
import type { TemplateDefinition, TemplateRegistry } from './template-registry';

const selectTemplate = (input: RenderInput, registry: TemplateRegistry): TemplateDefinition => {
  if (input.templateId !== undefined) {
    const template = registry.getTemplate(input.templateId);
    if (template === undefined) {
      throw new RendererError(
        `Template '${input.templateId}' not found in registry`,
        'TEMPLATE_NOT_FOUND',
      );
    }
    if (template.kind !== input.kind) {
      throw new RendererError(
        `Template '${template.id}' has kind '${template.kind}' but input.kind is '${input.kind}'`,
        'TEMPLATE_KIND_MISMATCH',
      );
    }
    return template;
  }
  const matches = registry.getTemplatesByKind(input.kind);
  if (matches.length === 0) {
    throw new RendererError(
      `No template registered for kind '${input.kind}'`,
      'TEMPLATE_NOT_FOUND',
    );
  }
  if (matches.length > 1) {
    const ids = matches.map((t) => `'${t.id}'`).join(', ');
    throw new RendererError(
      `Multiple templates registered for kind '${input.kind}': ${ids}. Specify templateId.`,
      'TEMPLATE_AMBIGUOUS',
    );
  }
  return matches[0] as TemplateDefinition;
};

export const renderDocument = (
  input: RenderInput,
  registry: TemplateRegistry,
): RenderedDocument => {
  const template = selectTemplate(input, registry);
  const rendered = template.render(input);
  if (rendered.kind !== input.kind) {
    throw new RendererError(
      `Template '${template.id}' returned RenderedDocument with kind '${rendered.kind}' but input.kind was '${input.kind}'`,
      'TEMPLATE_RENDER_KIND_MISMATCH',
    );
  }
  return {
    ...rendered,
    metadata: { ...rendered.metadata, templateId: template.id },
  };
};
