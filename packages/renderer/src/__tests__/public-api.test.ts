import type { CareerProfile } from '@jcd-editor/core';
import { describe, expect, it } from 'vitest';

import * as Renderer from '../index';
import type {
  DocumentKind,
  RenderedDocument,
  RenderedDocumentMetadata,
  RendererErrorCode,
  RenderInput,
  TemplateDefinition,
  TemplateId,
  TemplateRegistry,
  TemplateRenderer,
} from '../index';
import { createTemplateRegistry, RendererError } from '../index';

describe('@jcd-editor/renderer 公開 API', () => {
  it('DocumentKind は rirekisho と shokumukeirekisho を受け付ける', () => {
    const rirekisho: DocumentKind = 'rirekisho';
    const shokumukeirekisho: DocumentKind = 'shokumukeirekisho';
    expect(rirekisho).toBe('rirekisho');
    expect(shokumukeirekisho).toBe('shokumukeirekisho');
  });

  it('RenderedDocumentMetadata の完全な object literal を型として受け付ける', () => {
    const metadata: RenderedDocumentMetadata = {
      language: 'ja-JP',
      page: {
        size: 'A4',
        orientation: 'portrait',
      },
    };
    expect(metadata.language).toBe('ja-JP');
    expect(metadata.page.size).toBe('A4');
    expect(metadata.page.orientation).toBe('portrait');
  });

  it('RenderedDocumentMetadata は templateId を任意で持てる', () => {
    const metadata: RenderedDocumentMetadata = {
      language: 'ja-JP',
      page: { size: 'A4', orientation: 'portrait' },
      templateId: 'rirekisho-default',
    };
    expect(metadata.templateId).toBe('rirekisho-default');
  });

  it('RenderedDocument の完全な object literal を型として受け付ける', () => {
    const document: RenderedDocument = {
      kind: 'rirekisho',
      title: '履歴書',
      html: '<section></section>',
      css: 'section { padding: 0; }',
      metadata: {
        language: 'ja-JP',
        page: { size: 'A4', orientation: 'portrait' },
      },
    };
    expect(document.kind).toBe('rirekisho');
    expect(document.title).toBe('履歴書');
    expect(document.html).toContain('<section');
    expect(document.css).toContain('section');
    expect(document.metadata.language).toBe('ja-JP');
  });

  it('TemplateId は string として扱える', () => {
    const id: TemplateId = 'rirekisho-default';
    expect(id).toBe('rirekisho-default');
  });

  it('RenderInput の完全な object literal を型として受け付ける', () => {
    const careerProfile: CareerProfile = {
      schemaVersion: 1,
      basics: {},
    };
    const input: RenderInput = {
      careerProfile,
      kind: 'rirekisho',
      templateId: 'rirekisho-default',
    };
    expect(input.kind).toBe('rirekisho');
    expect(input.templateId).toBe('rirekisho-default');
    expect(input.careerProfile.schemaVersion).toBe(1);
  });

  it('RenderInput は templateId を省略できる', () => {
    const careerProfile: CareerProfile = {
      schemaVersion: 1,
      basics: {},
    };
    const input: RenderInput = {
      careerProfile,
      kind: 'shokumukeirekisho',
    };
    expect(input.templateId).toBeUndefined();
  });

  it('RendererErrorCode は string literal union として全 code を assign できる', () => {
    const codes: RendererErrorCode[] = [
      'TEMPLATE_NOT_FOUND',
      'TEMPLATE_KIND_MISMATCH',
      'TEMPLATE_AMBIGUOUS',
      'TEMPLATE_RENDER_KIND_MISMATCH',
      'TEMPLATE_DUPLICATE_ID',
    ];
    expect(codes).toHaveLength(5);
  });

  it('RendererError を runtime 値として export する', () => {
    expect(typeof RendererError).toBe('function');
    const error = new RendererError('test', 'TEMPLATE_NOT_FOUND');
    expect(error).toBeInstanceOf(RendererError);
  });

  it('createTemplateRegistry を runtime 値として export する', () => {
    expect(typeof createTemplateRegistry).toBe('function');
  });

  it('TemplateRenderer 型は (input: RenderInput) => RenderedDocument を受け付ける', () => {
    const renderer: TemplateRenderer = (input) => ({
      kind: input.kind,
      title: 't',
      html: '',
      css: '',
      metadata: { language: 'ja-JP', page: { size: 'A4', orientation: 'portrait' } },
    });
    const careerProfile = { schemaVersion: 1 as const, basics: {} };
    const result = renderer({ careerProfile, kind: 'rirekisho' });
    expect(result.kind).toBe('rirekisho');
  });

  it('TemplateDefinition / TemplateRegistry の完全な object literal を型として受け付ける', () => {
    const definition: TemplateDefinition = {
      id: 'sample',
      kind: 'rirekisho',
      name: 'Sample',
      render: (input) => ({
        kind: input.kind,
        title: 't',
        html: '',
        css: '',
        metadata: { language: 'ja-JP', page: { size: 'A4', orientation: 'portrait' } },
      }),
    };
    const registry: TemplateRegistry = createTemplateRegistry([definition]);
    expect(registry.getTemplate('sample')).toBe(definition);
  });

  it('公開 API に内部ヘルパ escapeHtml を含めない', () => {
    expect('escapeHtml' in Renderer).toBe(false);
  });

  it('公開 API の runtime 値は明示的に許可されたもののみ', () => {
    // RendererError / createTemplateRegistry 等の runtime 値を含むが、
    // internal helper や accidental default export がないことを保証する。
    expect(Object.keys(Renderer).sort()).toEqual(['RendererError', 'createTemplateRegistry']);
  });
});
