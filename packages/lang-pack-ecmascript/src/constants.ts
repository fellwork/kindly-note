// ECMAScript-family shared constant lists.
//
// spec §1.2 row `@kindly-note/lang-pack-ecmascript` mandates these exports:
//   `IDENT_RE`, `KEYWORDS`, `LITERALS`, `BUILT_INS`, `BUILT_IN_VARIABLES`,
//   `EXTENDED_NUMBER_MODE`, `extendedNumberMode()`.
//
// This file owns the keyword/built-in/literal *string lists* — pure data,
// no Mode helpers. The factory + Mode `EXTENDED_NUMBER_MODE` lives in
// `./number-mode.ts`.
//
// Reference shape (NOT byte-copied) is upstream's `src/languages/lib/ecmascript.js`.
// We modernise: every exported list is a `readonly string[]` literal-typed at
// the value site, deep-frozen at module init, never mutated. spec §0
// architectural shift #1 (languages-as-values) and §9 (compile-at-register-time,
// immutable). The arrays remain plain string lists so consumers can spread them
// into `Keywords` records or `BeginKeywords` strings without copying.
//
// `IDENT_RE` is re-exported here as a convenience for ECMAScript-family lang
// packages — `@kindly-note/lang-helpers` is the canonical owner (per the
// `IDENT_RE` constant declared there for cross-language use). Re-exporting from
// the same source keeps lang-helpers and lang-pack-ecmascript in lock-step
// without forking the literal — see open question in build-manifest-c3b.md.

export { IDENT_RE } from '@kindly-note/lang-helpers';

/**
 * ECMAScript reserved words and contextual keywords. Mirrors upstream
 * `src/languages/lib/ecmascript.js#KEYWORDS`. Used by JS/TS lang packs.
 *
 * Frozen at module init via `Object.freeze`; consumers may still spread
 * (`[...KEYWORDS]`) to compose with their own additions.
 */
export const KEYWORDS: readonly string[] = Object.freeze([
  'as',
  'in',
  'of',
  'if',
  'for',
  'while',
  'finally',
  'var',
  'new',
  'function',
  'do',
  'return',
  'void',
  'else',
  'break',
  'catch',
  'instanceof',
  'with',
  'throw',
  'case',
  'default',
  'try',
  'switch',
  'continue',
  'typeof',
  'delete',
  'let',
  'yield',
  'const',
  'class',
  'debugger',
  'async',
  'await',
  'static',
  'import',
  'from',
  'export',
  'extends',
  'using',
]);

/**
 * ECMAScript literal lexemes. JSON narrows to `'true' | 'false' | 'null'`
 * (the JSON spec); JS/TS pull the full list including `'undefined'`/`'NaN'`/
 * `'Infinity'`. Mirrors upstream's superset.
 */
export const LITERALS: readonly string[] = Object.freeze([
  'true',
  'false',
  'null',
  'undefined',
  'NaN',
  'Infinity',
]);

/**
 * Global constructor / object names exposed by the JS host (browser + Node
 * + Workers). Mirrors upstream's TYPES list. We keep them as a separate
 * frozen array so consumers can use `BUILT_INS` or just the constructors as
 * needed.
 */
const TYPES: readonly string[] = Object.freeze([
  // Fundamental objects
  'Object',
  'Function',
  'Boolean',
  'Symbol',
  // Numbers + dates
  'Math',
  'Date',
  'Number',
  'BigInt',
  // Text
  'String',
  'RegExp',
  // Indexed collections
  'Array',
  'Float32Array',
  'Float64Array',
  'Int8Array',
  'Uint8Array',
  'Uint8ClampedArray',
  'Int16Array',
  'Int32Array',
  'Uint16Array',
  'Uint32Array',
  'BigInt64Array',
  'BigUint64Array',
  // Keyed collections
  'Set',
  'Map',
  'WeakSet',
  'WeakMap',
  // Structured data
  'ArrayBuffer',
  'SharedArrayBuffer',
  'Atomics',
  'DataView',
  'JSON',
  // Control abstraction objects
  'Promise',
  'Generator',
  'GeneratorFunction',
  'AsyncFunction',
  // Reflection
  'Reflect',
  'Proxy',
  // Internationalization
  'Intl',
  // WebAssembly
  'WebAssembly',
]);

/** Standard error constructors. Mirrors upstream `ERROR_TYPES`. */
const ERROR_TYPES: readonly string[] = Object.freeze([
  'Error',
  'EvalError',
  'InternalError',
  'RangeError',
  'ReferenceError',
  'SyntaxError',
  'TypeError',
  'URIError',
]);

/**
 * Global functions / values that aren't constructors but are part of the
 * standard global surface. Mirrors upstream `BUILT_IN_GLOBALS`.
 */
const BUILT_IN_GLOBALS: readonly string[] = Object.freeze([
  'setInterval',
  'setTimeout',
  'clearInterval',
  'clearTimeout',
  'require',
  'exports',
  'eval',
  'isFinite',
  'isNaN',
  'parseFloat',
  'parseInt',
  'decodeURI',
  'decodeURIComponent',
  'encodeURI',
  'encodeURIComponent',
  'escape',
  'unescape',
]);

/**
 * Composite list of every "built-in" name the engine should treat as a
 * built_in scope: globals + types + error types. Mirrors upstream `BUILT_INS`.
 *
 * Frozen and non-mutating; consumers can spread into their own `Keywords`
 * dict (`{ built_in: [...BUILT_INS, ...mine] }`) without aliasing.
 */
export const BUILT_INS: readonly string[] = Object.freeze([
  ...BUILT_IN_GLOBALS,
  ...TYPES,
  ...ERROR_TYPES,
]);

/**
 * Variables that appear like keywords in normal code but are runtime-bound
 * (`this`, `super`, `arguments`, `console`, `window`, `document`, `module`,
 * `global`, `localStorage`, `sessionStorage`). Mirrors upstream
 * `BUILT_IN_VARIABLES`.
 *
 * Used by lang-javascript / lang-typescript with the `variable.language` scope.
 */
export const BUILT_IN_VARIABLES: readonly string[] = Object.freeze([
  'arguments',
  'this',
  'super',
  'console',
  'window',
  'document',
  'localStorage',
  'sessionStorage',
  'module',
  'global',
]);
