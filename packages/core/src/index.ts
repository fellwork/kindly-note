// @kindly-note/core — public exports.
// spec section 1.2 row "@kindly-note/core" defines the public surface.
//
// Subpath exports (./regex, ./errors) are available through the package.json
// exports map (spec section 6.4) and are re-exported here for the canonical
// `import { ... } from '@kindly-note/core'` path.

// Highlighter / engine surface
export {
  createHighlighter,
  type Highlighter,
  type HighlighterOptions,
  type RegisteredLanguage,
} from './highlighter.js';

// Language type system + extension keystone (spec section 8.2)
export {
  defineLanguage,
  extendLanguage,
  deepFreezeLanguage,
  type CompilerExt,
  type Keywords,
  type LanguageDefinition,
  type LanguageExtensions,
  type Mode,
  type ScopeMap,
} from './language.js';

// Compilation contract (spec section 9.4)
export {
  compileLanguage,
  type CompiledLanguage,
  type CompiledMode,
  type KeywordDict,
} from './compile.js';

// Plugin protocol (spec section 2)
export {
  definePlugin,
  defaultPluginLogger,
  runHook,
  type HighlighterReadonly,
  type HighlighterReadonlyOptions,
  type Plugin,
  type PluginContext,
  type PluginLogger,
} from './plugin.js';

// Emitter abstraction (spec section 5)
export {
  defineEmitter,
  type Emitter,
  type EmitterFactory,
  type EmitterOptions,
  type TokenNode,
  type TokenScope,
  type TokenStream,
  type TokenSubLanguage,
  type TokenText,
} from './emitter.js';

// Result + input value types
export type {
  CodeInput,
  ElementInput,
  ElementOutput,
  HighlightOptions,
  HighlightResult,
} from './result.js';

// Loader contract + serialization shape (spec §4.2.1, §4.2.3).
// The two v0 loader packages (`@kindly-note/loader-dynamic-import` and
// `@kindly-note/loader-fetch`) implement this `LanguageLoader` interface
// and depend only on these types from core.
export {
  deserializeLanguage,
  type LanguageLoader,
  type SerializedKeywords,
  type SerializedLanguageBody,
  type SerializedLanguageDefinition,
  type SerializedMode,
  type SerializedRegExp,
  type SerializedRegexLike,
} from './loader.js';

// Convenience namespaced re-exports for the subpath APIs.
// spec section 7.3: `import { regex } from '@kindly-note/core'` is the
// canonical path; importing the subpath `@kindly-note/core/regex` is also
// supported (used by F#/NSIS at module-init time per spec section 8.1).
export * as regex from './regex.js';
export * as errors from './errors.js';

// Engine version. spec section 7.3 row "versionString".
// This is a compile-time constant — it is overridden by the rolldown build
// to match the package.json version. v0 placeholder until that wiring lands.
export const VERSION = '0.0.1';
