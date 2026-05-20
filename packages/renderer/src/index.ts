export type { DocumentKind } from './document-kind';
export { RendererError, type RendererErrorCode } from './errors';
export { renderDocument } from './render-document';
export type { RenderInput } from './render-input';
export type { RenderedDocument, RenderedDocumentMetadata } from './rendered-document';
export type { TemplateId } from './template-id';
export {
  createTemplateRegistry,
  type TemplateDefinition,
  type TemplateRegistry,
  type TemplateRenderer,
} from './template-registry';
