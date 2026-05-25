// @kindly-note/emitters-markdown — public exports.
// spec §1.5 row `@kindly-note/emitters-markdown` + §13 define the surface.

export {
  markdownHtmlEmitter,
  markdownHtmlEmitterWith,
  type HtmlSanitizer,
  type MarkdownHtmlEmitterConfig,
} from './emitter.js';

// URL-policy surface — exported so consumers can compose / inspect the policy
// independently (e.g. `@kindly-note/render-markdown` reuses these). spec §13.1.
export {
  DEFAULT_URL_ALLOWLIST,
  allowlistUrlPolicy,
  defaultUrlPolicy,
  type UrlPolicy,
} from './url-policy.js';

// The code-fence renderer type is part of the `codeEmitter` option contract.
export type { CodeFenceRenderer } from './render.js';

// Escaping helpers — stable, reused by downstream packages. spec §13.1.
export { htmlEscape, normalizeBidi } from './escape.js';
