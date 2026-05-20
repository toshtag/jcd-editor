import type { CareerProfile } from '@jcd-editor/core';
import { describe, expect, it } from 'vitest';

import * as Renderer from '../index';
import type {
  DocumentKind,
  RenderedDocument,
  RenderedDocumentMetadata,
  RenderInput,
  TemplateId,
} from '../index';

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

  it('公開 API に内部ヘルパ escapeHtml を含めない', () => {
    expect('escapeHtml' in Renderer).toBe(false);
  });

  it('公開 API は型のみで、実行時値を持たない', () => {
    // index.ts は type-only export のため、実行時 namespace には何も
    // 含まれない (TypeScript の `export type` の保証)。
    expect(Object.keys(Renderer)).toEqual([]);
  });
});
