export { builtinTemplates, createDefaultTemplateRegistry } from './builtin-templates';
export { computeAgeOnDate } from './_internal/rirekisho-mhlw-shared';
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
export { rirekishoMhlwA3Template } from './templates/rirekisho-mhlw-a3';
export { rirekishoMhlwA4Template } from './templates/rirekisho-mhlw-a4';
export { shokumukeirekishoBasicTemplate } from './templates/shokumukeirekisho-basic';
