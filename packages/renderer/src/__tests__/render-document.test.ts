import type { CareerProfile } from '@jcd-editor/core';
import { describe, expect, it } from 'vitest';

import type { DocumentKind } from '../document-kind';
import { RendererError } from '../errors';
import { renderDocument } from '../render-document';
import type { RenderInput } from '../render-input';
import type { RenderedDocument } from '../rendered-document';
import {
  createTemplateRegistry,
  type TemplateDefinition,
  type TemplateRenderer,
} from '../template-registry';

const sampleCareerProfile: CareerProfile = {
  schemaVersion: 1,
  basics: {},
};

const makeRenderedDocument = (kind: DocumentKind, templateId?: string): RenderedDocument => ({
  kind,
  title: `title for ${templateId ?? '(no id)'}`,
  html: '<section></section>',
  css: '',
  metadata: {
    language: 'ja-JP',
    page: { size: 'A4', orientation: 'portrait' },
    ...(templateId !== undefined ? { templateId } : {}),
  },
});

const makeTemplate = (
  id: string,
  kind: DocumentKind,
  renderer?: TemplateRenderer,
): TemplateDefinition => ({
  id,
  kind,
  name: id,
  render: renderer ?? ((input) => makeRenderedDocument(input.kind, id)),
});

describe('renderDocument - 明示 templateId', () => {
  it('存在する templateId で対応する template が呼ばれる', () => {
    const template = makeTemplate('rirekisho-a', 'rirekisho');
    const registry = createTemplateRegistry([template]);
    const input: RenderInput = {
      careerProfile: sampleCareerProfile,
      kind: 'rirekisho',
      templateId: 'rirekisho-a',
    };
    const result = renderDocument(input, registry);
    expect(result.kind).toBe('rirekisho');
    expect(result.metadata.templateId).toBe('rirekisho-a');
  });

  it('存在しない templateId は RendererError(TEMPLATE_NOT_FOUND) を throw する', () => {
    const registry = createTemplateRegistry([makeTemplate('rirekisho-a', 'rirekisho')]);
    const input: RenderInput = {
      careerProfile: sampleCareerProfile,
      kind: 'rirekisho',
      templateId: 'missing',
    };
    try {
      renderDocument(input, registry);
      expect.fail('expected throw');
    } catch (e) {
      expect(e).toBeInstanceOf(RendererError);
      if (e instanceof RendererError) {
        expect(e.code).toBe('TEMPLATE_NOT_FOUND');
        expect(e.message).toContain('missing');
      }
    }
  });

  it('template.kind が input.kind と異なる場合 TEMPLATE_KIND_MISMATCH を throw する', () => {
    const template = makeTemplate('shokumukeirekisho-a', 'shokumukeirekisho');
    const registry = createTemplateRegistry([template]);
    const input: RenderInput = {
      careerProfile: sampleCareerProfile,
      kind: 'rirekisho',
      templateId: 'shokumukeirekisho-a',
    };
    try {
      renderDocument(input, registry);
      expect.fail('expected throw');
    } catch (e) {
      expect(e).toBeInstanceOf(RendererError);
      if (e instanceof RendererError) {
        expect(e.code).toBe('TEMPLATE_KIND_MISMATCH');
      }
    }
  });

  it('templateId: undefined は「省略」として扱う (implicit selection に流れる)', () => {
    // exactOptionalPropertyTypes: true 下では `templateId: undefined` の
    // object literal を直接 RenderInput に assign できないが、
    // 実 runtime では JSON.parse 等から templateId フィールドが
    // undefined のまま渡るケースがある。本テストはそれが implicit
    // selection に流れることを構造的に保証する。
    const template = makeTemplate('rirekisho-only', 'rirekisho');
    const registry = createTemplateRegistry([template]);
    const input = {
      careerProfile: sampleCareerProfile,
      kind: 'rirekisho' as const,
      templateId: undefined,
    } as unknown as RenderInput;
    const result = renderDocument(input, registry);
    expect(result.metadata.templateId).toBe('rirekisho-only');
  });

  it('templateId: "" (空文字列) は「指定あり」として扱う、implicit selection に fallback しない', () => {
    // id "" の template は registry に登録していないので TEMPLATE_NOT_FOUND
    // となるべき。truthy 判定 (if (input.templateId)) だと "" は省略扱い
    // になり、kind マッチが 1 つあれば誤って成功してしまう。
    // 本テストは !== undefined 判定が正しく書かれていることを構造的に保証する。
    const template = makeTemplate('rirekisho-only', 'rirekisho');
    const registry = createTemplateRegistry([template]);
    const input: RenderInput = {
      careerProfile: sampleCareerProfile,
      kind: 'rirekisho',
      templateId: '',
    };
    try {
      renderDocument(input, registry);
      expect.fail('expected throw');
    } catch (e) {
      expect(e).toBeInstanceOf(RendererError);
      if (e instanceof RendererError) {
        expect(e.code).toBe('TEMPLATE_NOT_FOUND');
      }
    }
  });
});

describe('renderDocument - implicit (templateId 省略)', () => {
  it('kind マッチが 1 つなら そのテンプレートが呼ばれる', () => {
    const template = makeTemplate('rirekisho-only', 'rirekisho');
    const registry = createTemplateRegistry([template]);
    const input: RenderInput = {
      careerProfile: sampleCareerProfile,
      kind: 'rirekisho',
    };
    const result = renderDocument(input, registry);
    expect(result.kind).toBe('rirekisho');
    expect(result.metadata.templateId).toBe('rirekisho-only');
  });

  it('kind マッチなし → TEMPLATE_NOT_FOUND', () => {
    const registry = createTemplateRegistry([makeTemplate('rirekisho-only', 'rirekisho')]);
    const input: RenderInput = {
      careerProfile: sampleCareerProfile,
      kind: 'shokumukeirekisho',
    };
    try {
      renderDocument(input, registry);
      expect.fail('expected throw');
    } catch (e) {
      expect(e).toBeInstanceOf(RendererError);
      if (e instanceof RendererError) {
        expect(e.code).toBe('TEMPLATE_NOT_FOUND');
        expect(e.message).toContain('shokumukeirekisho');
      }
    }
  });

  it('kind マッチ複数 → TEMPLATE_AMBIGUOUS', () => {
    const registry = createTemplateRegistry([
      makeTemplate('rirekisho-a', 'rirekisho'),
      makeTemplate('rirekisho-b', 'rirekisho'),
    ]);
    const input: RenderInput = {
      careerProfile: sampleCareerProfile,
      kind: 'rirekisho',
    };
    try {
      renderDocument(input, registry);
      expect.fail('expected throw');
    } catch (e) {
      expect(e).toBeInstanceOf(RendererError);
      if (e instanceof RendererError) {
        expect(e.code).toBe('TEMPLATE_AMBIGUOUS');
        expect(e.message).toContain('rirekisho-a');
        expect(e.message).toContain('rirekisho-b');
      }
    }
  });
});

describe('renderDocument - 出力検証', () => {
  it('template が kind !== input.kind の RenderedDocument を返すと TEMPLATE_RENDER_KIND_MISMATCH', () => {
    // template renderer が誤って異なる kind を返す bug を防御。
    const template: TemplateDefinition = {
      id: 'liar',
      kind: 'rirekisho',
      name: 'liar',
      render: () => makeRenderedDocument('shokumukeirekisho', 'liar'),
    };
    const registry = createTemplateRegistry([template]);
    const input: RenderInput = {
      careerProfile: sampleCareerProfile,
      kind: 'rirekisho',
      templateId: 'liar',
    };
    try {
      renderDocument(input, registry);
      expect.fail('expected throw');
    } catch (e) {
      expect(e).toBeInstanceOf(RendererError);
      if (e instanceof RendererError) {
        expect(e.code).toBe('TEMPLATE_RENDER_KIND_MISMATCH');
      }
    }
  });

  it('template が metadata.templateId を省略しても registry の id がセットされる', () => {
    const template: TemplateDefinition = {
      id: 'silent',
      kind: 'rirekisho',
      name: 'silent',
      render: (input) => makeRenderedDocument(input.kind), // templateId 省略
    };
    const registry = createTemplateRegistry([template]);
    const result = renderDocument(
      {
        careerProfile: sampleCareerProfile,
        kind: 'rirekisho',
        templateId: 'silent',
      },
      registry,
    );
    expect(result.metadata.templateId).toBe('silent');
  });

  it('template が metadata.templateId に異なる値を返しても registry の id で overwrite される', () => {
    const template: TemplateDefinition = {
      id: 'correct',
      kind: 'rirekisho',
      name: 'correct',
      render: (input) => makeRenderedDocument(input.kind, 'wrong-id'),
    };
    const registry = createTemplateRegistry([template]);
    const result = renderDocument(
      {
        careerProfile: sampleCareerProfile,
        kind: 'rirekisho',
        templateId: 'correct',
      },
      registry,
    );
    expect(result.metadata.templateId).toBe('correct');
  });

  it('template が metadata.templateId に同じ値を返した場合も最終的に同じ id が残る', () => {
    const template = makeTemplate('matching', 'rirekisho');
    const registry = createTemplateRegistry([template]);
    const result = renderDocument(
      {
        careerProfile: sampleCareerProfile,
        kind: 'rirekisho',
        templateId: 'matching',
      },
      registry,
    );
    expect(result.metadata.templateId).toBe('matching');
  });
});

describe('renderDocument - input の不変性', () => {
  it('renderDocument 呼び出しで input オブジェクトが変更されない', () => {
    const template = makeTemplate('rirekisho-only', 'rirekisho');
    const registry = createTemplateRegistry([template]);
    const input: RenderInput = {
      careerProfile: sampleCareerProfile,
      kind: 'rirekisho',
      templateId: 'rirekisho-only',
    };
    const careerProfileBefore = input.careerProfile;
    const kindBefore = input.kind;
    const templateIdBefore = input.templateId;
    renderDocument(input, registry);
    expect(input.careerProfile).toBe(careerProfileBefore);
    expect(input.kind).toBe(kindBefore);
    expect(input.templateId).toBe(templateIdBefore);
  });

  it('template renderer が受け取る input は呼び出し側の input と同一参照', () => {
    let captured: RenderInput | undefined;
    const template: TemplateDefinition = {
      id: 'capture',
      kind: 'rirekisho',
      name: 'capture',
      render: (received) => {
        captured = received;
        return makeRenderedDocument(received.kind, 'capture');
      },
    };
    const registry = createTemplateRegistry([template]);
    const input: RenderInput = {
      careerProfile: sampleCareerProfile,
      kind: 'rirekisho',
      templateId: 'capture',
    };
    renderDocument(input, registry);
    expect(captured).toBe(input);
  });
});

describe('renderDocument - CareerProfile 受容性', () => {
  it('最小の CareerProfile ({ schemaVersion: 1, basics: {} }) で render できる', () => {
    const template = makeTemplate('rirekisho-min', 'rirekisho');
    const registry = createTemplateRegistry([template]);
    const input: RenderInput = {
      careerProfile: { schemaVersion: 1, basics: {} },
      kind: 'rirekisho',
    };
    const result = renderDocument(input, registry);
    expect(result.kind).toBe('rirekisho');
  });
});

describe('renderDocument - template 例外の透過', () => {
  it('template が throw した非 RendererError 例外はそのまま propagate する', () => {
    const customError = new Error('template internal failure');
    const template: TemplateDefinition = {
      id: 'broken',
      kind: 'rirekisho',
      name: 'broken',
      render: () => {
        throw customError;
      },
    };
    const registry = createTemplateRegistry([template]);
    const input: RenderInput = {
      careerProfile: sampleCareerProfile,
      kind: 'rirekisho',
      templateId: 'broken',
    };
    try {
      renderDocument(input, registry);
      expect.fail('expected throw');
    } catch (e) {
      expect(e).toBe(customError);
      expect(e).not.toBeInstanceOf(RendererError);
    }
  });
});
