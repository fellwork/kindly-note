// @kindly-note/render-markdown — public exports.
// spec §1.5 row `@kindly-note/render-markdown` + §13.

export { renderMarkdown, type RenderMarkdownOptions } from './render-markdown.js';

// Re-export the security-policy + emitter-config surface so consumers can
// configure rendering without a second import from @kindly-note/emitters-markdown.
export type {
  CodeFenceRenderer,
  HtmlSanitizer,
  MarkdownHtmlEmitterConfig,
  UrlPolicy,
} from '@kindly-note/emitters-markdown';
