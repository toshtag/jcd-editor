import { describe, expect, it } from 'vitest';

import type { DocumentKind } from '../document-kind';
import { RendererError } from '../errors';
import type { RenderedDocument } from '../rendered-document';
import {
  createTemplateRegistry,
  type TemplateDefinition,
  type TemplateRenderer,
} from '../template-registry';

const makeRenderedDocument = (kind: DocumentKind, templateId: string): RenderedDocument => ({
  kind,
  title: `title for ${templateId}`,
  html: '<section></section>',
  css: '',
  metadata: {
    language: 'ja-JP',
    page: { size: 'A4', orientation: 'portrait' },
    templateId,
  },
});

const makeTemplate = (
  id: string,
  kind: DocumentKind,
  name: string = id,
  renderer?: TemplateRenderer,
): TemplateDefinition => ({
  id,
  kind,
  name,
  render: renderer ?? ((input) => makeRenderedDocument(input.kind, id)),
});

describe('createTemplateRegistry', () => {
  it('空配列で registry を作成できる', () => {
    const registry = createTemplateRegistry([]);
    expect(registry.getTemplates()).toEqual([]);
  });

  it('1 つのテンプレートを持つ registry を作成できる', () => {
    const template = makeTemplate('rirekisho-default', 'rirekisho');
    const registry = createTemplateRegistry([template]);
    expect(registry.getTemplates()).toEqual([template]);
  });

  it('同一 kind の複数テンプレートを許容する', () => {
    const t1 = makeTemplate('rirekisho-a', 'rirekisho');
    const t2 = makeTemplate('rirekisho-b', 'rirekisho');
    const registry = createTemplateRegistry([t1, t2]);
    expect(registry.getTemplates()).toEqual([t1, t2]);
  });

  it('異なる kind の複数テンプレートを許容する', () => {
    const t1 = makeTemplate('rirekisho-default', 'rirekisho');
    const t2 = makeTemplate('shokumukeirekisho-default', 'shokumukeirekisho');
    const registry = createTemplateRegistry([t1, t2]);
    expect(registry.getTemplates()).toEqual([t1, t2]);
  });

  it('同一 id の重複は RendererError(TEMPLATE_DUPLICATE_ID) を throw する', () => {
    const t1 = makeTemplate('duplicate-id', 'rirekisho');
    const t2 = makeTemplate('duplicate-id', 'rirekisho');
    expect(() => createTemplateRegistry([t1, t2])).toThrow(RendererError);
    try {
      createTemplateRegistry([t1, t2]);
    } catch (e) {
      expect(e).toBeInstanceOf(RendererError);
      if (e instanceof RendererError) {
        expect(e.code).toBe('TEMPLATE_DUPLICATE_ID');
        expect(e.message).toContain('duplicate-id');
      }
    }
  });

  it('同一 id が異なる kind に紐づいていても重複は throw する', () => {
    const t1 = makeTemplate('shared-id', 'rirekisho');
    const t2 = makeTemplate('shared-id', 'shokumukeirekisho');
    expect(() => createTemplateRegistry([t1, t2])).toThrow(RendererError);
  });

  it('createTemplateRegistry に渡した配列を変更しても registry 内部状態が変化しない', () => {
    const t1 = makeTemplate('rirekisho-default', 'rirekisho');
    const inputArray = [t1];
    const registry = createTemplateRegistry(inputArray);
    (inputArray as TemplateDefinition[]).push(makeTemplate('rirekisho-extra', 'rirekisho'));
    expect(registry.getTemplates()).toEqual([t1]);
  });
});

describe('TemplateRegistry.getTemplates', () => {
  it('挿入順に返る', () => {
    const t1 = makeTemplate('a', 'rirekisho');
    const t2 = makeTemplate('b', 'shokumukeirekisho');
    const t3 = makeTemplate('c', 'rirekisho');
    const registry = createTemplateRegistry([t1, t2, t3]);
    expect(registry.getTemplates().map((t) => t.id)).toEqual(['a', 'b', 'c']);
  });

  it('戻り値配列を変更しても次回呼び出しに影響しない', () => {
    const t1 = makeTemplate('a', 'rirekisho');
    const registry = createTemplateRegistry([t1]);
    const first = registry.getTemplates() as TemplateDefinition[];
    first.push(makeTemplate('b', 'rirekisho'));
    const second = registry.getTemplates();
    expect(second).toEqual([t1]);
  });
});

describe('TemplateRegistry.getTemplatesByKind', () => {
  it('kind フィルタが正しく機能する', () => {
    const r1 = makeTemplate('r1', 'rirekisho');
    const s1 = makeTemplate('s1', 'shokumukeirekisho');
    const r2 = makeTemplate('r2', 'rirekisho');
    const registry = createTemplateRegistry([r1, s1, r2]);
    expect(registry.getTemplatesByKind('rirekisho')).toEqual([r1, r2]);
    expect(registry.getTemplatesByKind('shokumukeirekisho')).toEqual([s1]);
  });

  it('マッチがなければ空配列を返す', () => {
    const registry = createTemplateRegistry([makeTemplate('r1', 'rirekisho')]);
    expect(registry.getTemplatesByKind('shokumukeirekisho')).toEqual([]);
  });
});

describe('TemplateRegistry.getTemplate', () => {
  it('存在する id で TemplateDefinition を返す', () => {
    const t = makeTemplate('rirekisho-default', 'rirekisho');
    const registry = createTemplateRegistry([t]);
    expect(registry.getTemplate('rirekisho-default')).toBe(t);
  });

  it('存在しない id で undefined を返す', () => {
    const registry = createTemplateRegistry([makeTemplate('rirekisho-default', 'rirekisho')]);
    expect(registry.getTemplate('missing')).toBeUndefined();
  });
});
