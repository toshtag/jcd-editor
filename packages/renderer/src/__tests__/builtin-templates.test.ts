import { parseCareerProfile } from '@jcd-editor/core';
import { describe, expect, it } from 'vitest';

import { builtinTemplates, createDefaultTemplateRegistry } from '../builtin-templates';
import { renderDocument } from '../render-document';
import type { TemplateDefinition } from '../template-registry';
import { rirekishoBasicTemplate } from '../templates/rirekisho-basic';
import { shokumukeirekishoBasicTemplate } from '../templates/shokumukeirekisho-basic';

const MIN_PROFILE = parseCareerProfile({ schemaVersion: 1, basics: {} });

describe('builtinTemplates - 構造', () => {
  it('exactly 2 件のテンプレートを含む', () => {
    expect(builtinTemplates).toHaveLength(2);
  });

  it('rirekishoBasicTemplate を含む (identity-equal)', () => {
    expect(builtinTemplates).toContain(rirekishoBasicTemplate);
  });

  it('shokumukeirekishoBasicTemplate を含む (identity-equal)', () => {
    expect(builtinTemplates).toContain(shokumukeirekishoBasicTemplate);
  });

  it('順序が [rirekishoBasicTemplate, shokumukeirekishoBasicTemplate]', () => {
    expect(builtinTemplates).toEqual([rirekishoBasicTemplate, shokumukeirekishoBasicTemplate]);
  });

  it('すべての id がユニーク', () => {
    const ids = builtinTemplates.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('kinds が rirekisho / shokumukeirekisho を完全にカバー', () => {
    const kinds = new Set(builtinTemplates.map((t) => t.kind));
    expect(kinds).toEqual(new Set(['rirekisho', 'shokumukeirekisho']));
  });

  it('各要素が TemplateDefinition の shape (id / kind / name / render)', () => {
    for (const t of builtinTemplates) {
      expect(typeof t.id).toBe('string');
      expect(typeof t.kind).toBe('string');
      expect(typeof t.name).toBe('string');
      expect(typeof t.render).toBe('function');
    }
  });
});

describe('builtinTemplates - mutation 防御', () => {
  // readonly TemplateDefinition[] 型のため、直接 mutation method を呼ぶと
  // TypeScript 型エラーになる。runtime freeze の挙動を検証するため、
  // unknown 経由で mutable array として扱う cast を使う。
  // 主 assertion は「最終配列の length / 順序が不変」に置く。
  // TypeError 投出は strict mode と Node バージョン依存のため強制しない。

  const makeExtraTemplate = (): TemplateDefinition => ({
    id: 'extra-template',
    kind: 'rirekisho',
    name: 'extra',
    render: () => ({
      kind: 'rirekisho',
      title: 'x',
      html: '',
      css: '',
      metadata: { language: 'ja-JP', page: { size: 'A4', orientation: 'portrait' } },
    }),
  });

  it('Object.isFrozen(builtinTemplates) === true', () => {
    expect(Object.isFrozen(builtinTemplates)).toBe(true);
  });

  it('push を試みても配列の length と順序が変わらない', () => {
    const mutable = builtinTemplates as unknown as TemplateDefinition[];
    try {
      mutable.push(makeExtraTemplate());
    } catch {
      // strict mode では TypeError、非 strict では silently 無視されうる
    }
    expect(builtinTemplates).toHaveLength(2);
    expect(builtinTemplates).toEqual([rirekishoBasicTemplate, shokumukeirekishoBasicTemplate]);
  });

  it('index 代入を試みても配列の対応要素が変わらない', () => {
    const mutable = builtinTemplates as unknown as TemplateDefinition[];
    const extra = makeExtraTemplate();
    try {
      mutable[0] = extra;
    } catch {
      // 同上
    }
    expect(builtinTemplates[0]).toBe(rirekishoBasicTemplate);
    expect(builtinTemplates).toHaveLength(2);
  });

  it('splice を試みても配列の length と順序が変わらない', () => {
    const mutable = builtinTemplates as unknown as TemplateDefinition[];
    try {
      mutable.splice(0, 1);
    } catch {
      // 同上
    }
    expect(builtinTemplates).toHaveLength(2);
    expect(builtinTemplates).toEqual([rirekishoBasicTemplate, shokumukeirekishoBasicTemplate]);
  });

  it('pop を試みても配列の length が変わらない', () => {
    const mutable = builtinTemplates as unknown as TemplateDefinition[];
    try {
      mutable.pop();
    } catch {
      // 同上
    }
    expect(builtinTemplates).toHaveLength(2);
  });
});

describe('createDefaultTemplateRegistry - 挙動', () => {
  it('TemplateRegistry の 3 つのメソッドを持つ object を返す', () => {
    const registry = createDefaultTemplateRegistry();
    expect(typeof registry.getTemplates).toBe('function');
    expect(typeof registry.getTemplatesByKind).toBe('function');
    expect(typeof registry.getTemplate).toBe('function');
  });

  it('getTemplates() が 2 件を順序通り返す', () => {
    const registry = createDefaultTemplateRegistry();
    expect(registry.getTemplates()).toEqual([
      rirekishoBasicTemplate,
      shokumukeirekishoBasicTemplate,
    ]);
  });

  it('getTemplate("rirekisho-basic") で rirekishoBasicTemplate を返す', () => {
    const registry = createDefaultTemplateRegistry();
    expect(registry.getTemplate('rirekisho-basic')).toBe(rirekishoBasicTemplate);
  });

  it('getTemplate("shokumukeirekisho-basic") で shokumukeirekishoBasicTemplate を返す', () => {
    const registry = createDefaultTemplateRegistry();
    expect(registry.getTemplate('shokumukeirekisho-basic')).toBe(shokumukeirekishoBasicTemplate);
  });

  it('getTemplatesByKind("rirekisho") で [rirekishoBasicTemplate]', () => {
    const registry = createDefaultTemplateRegistry();
    expect(registry.getTemplatesByKind('rirekisho')).toEqual([rirekishoBasicTemplate]);
  });

  it('getTemplatesByKind("shokumukeirekisho") で [shokumukeirekishoBasicTemplate]', () => {
    const registry = createDefaultTemplateRegistry();
    expect(registry.getTemplatesByKind('shokumukeirekisho')).toEqual([
      shokumukeirekishoBasicTemplate,
    ]);
  });

  it('複数回呼び出しで異なる registry インスタンスを返す (caching なし)', () => {
    const r1 = createDefaultTemplateRegistry();
    const r2 = createDefaultTemplateRegistry();
    expect(r1).not.toBe(r2);
  });
});

describe('createDefaultTemplateRegistry - renderDocument 統合', () => {
  it('rirekisho の implicit selection で renderDocument が成功する', () => {
    const registry = createDefaultTemplateRegistry();
    const result = renderDocument({ careerProfile: MIN_PROFILE, kind: 'rirekisho' }, registry);
    expect(result.kind).toBe('rirekisho');
    expect(result.metadata.templateId).toBe('rirekisho-basic');
  });

  it('shokumukeirekisho の implicit selection で renderDocument が成功する', () => {
    const registry = createDefaultTemplateRegistry();
    const result = renderDocument(
      { careerProfile: MIN_PROFILE, kind: 'shokumukeirekisho' },
      registry,
    );
    expect(result.kind).toBe('shokumukeirekisho');
    expect(result.metadata.templateId).toBe('shokumukeirekisho-basic');
  });

  it('明示 templateId rirekisho-basic で renderDocument が成功する', () => {
    const registry = createDefaultTemplateRegistry();
    const result = renderDocument(
      {
        careerProfile: MIN_PROFILE,
        kind: 'rirekisho',
        templateId: 'rirekisho-basic',
      },
      registry,
    );
    expect(result.metadata.templateId).toBe('rirekisho-basic');
  });

  it('明示 templateId shokumukeirekisho-basic で renderDocument が成功する', () => {
    const registry = createDefaultTemplateRegistry();
    const result = renderDocument(
      {
        careerProfile: MIN_PROFILE,
        kind: 'shokumukeirekisho',
        templateId: 'shokumukeirekisho-basic',
      },
      registry,
    );
    expect(result.metadata.templateId).toBe('shokumukeirekisho-basic');
  });
});

describe('builtinTemplates - 構造的整合性 (registry 作成可能性)', () => {
  it('createTemplateRegistry(builtinTemplates) が TEMPLATE_DUPLICATE_ID で throw しない (id が unique)', () => {
    expect(() => createDefaultTemplateRegistry()).not.toThrow();
  });

  it('各 DocumentKind に対して 1 個のテンプレート (implicit selection が ambiguous にならない)', () => {
    const registry = createDefaultTemplateRegistry();
    expect(registry.getTemplatesByKind('rirekisho')).toHaveLength(1);
    expect(registry.getTemplatesByKind('shokumukeirekisho')).toHaveLength(1);
  });
});
