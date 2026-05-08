// @kindly-note/browser — public exports.
//
// spec §1.2 row `@kindly-note/browser`:
//   - DOM bindings: `highlightAll`, `highlightElement`, `attachToDOM`.
//   - Imports a `Highlighter` and a DOM. Tree-shaken away on Workers/Edge.
//   - Public surface: `highlightAll`, `highlightElement`, `attachToDOM`.
//   - Depends on: `@kindly-note/core` (peer);
//     `@kindly-note/auto-detect` (peer-optional, passed by reference).

export {
  highlightElement,
  KINDLY_NOTE_HIGHLIGHT_MARKER,
  type AutoDetectorLike,
  type ElementHighlightInfo,
  type HighlightElementOptions,
} from './highlight-element.js';

export { highlightAll, type HighlightAllOptions } from './highlight-all.js';

export { attachToDOM, type AttachToDOMOptions, type AttachedHandle } from './attach-to-dom.js';

export { languageFromClass } from './language-from-class.js';
