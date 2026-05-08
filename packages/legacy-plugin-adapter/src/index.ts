// @kindly-note/legacy-plugin-adapter — public surface.
// spec §1.2 row "@kindly-note/legacy-plugin-adapter": exports
// `adaptLegacyPlugin` (function) and `LegacyHLJSPlugin` (type).

export { adaptLegacyPlugin } from './adapter.js';
export type {
  LegacyAfterHighlightBlockData,
  LegacyAfterHighlightElementData,
  LegacyBeforeHighlightBlockData,
  LegacyBeforeHighlightContext,
  LegacyBeforeHighlightElementData,
  LegacyHLJSPlugin,
} from './types.js';
