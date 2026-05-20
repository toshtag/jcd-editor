// RenderedDocument は renderer の出力契約を表す。
//
// - `html` は印刷対象ドキュメントの HTML markup を表す。完全な
//   `<!doctype html>` / `<html>` / `<head>` を含む形にはしない。
//   それらへの合成は将来の PDF package / renderer pipeline (Phase 5 以降)
//   が担当する。
// - `html` には user-provided raw HTML を含めてはならない。
//   `CareerProfile` 由来の文字列は render 時に escape 済みでなければならない
//   (renderer 内部の escapeHtml ヘルパを使用する)。
// - `css` は `html` と分離して保持する。`<style>` タグへの注入や
//   `link rel="stylesheet"` 参照に変換するかは pipeline の責務とする。
// - `metadata` は必須。全 render 実装で必ず metadata を返すことで、
//   downstream が undefined をハンドリングする必要を排除する。

import type { DocumentKind } from './document-kind';

export type RenderedDocumentMetadata = {
  language: 'ja-JP';
  page: {
    size: 'A4';
    orientation: 'portrait';
  };
  templateId?: string;
};

export type RenderedDocument = {
  kind: DocumentKind;
  title: string;
  html: string;
  css: string;
  metadata: RenderedDocumentMetadata;
};
