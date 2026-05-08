// @kindly-note/lang-typescript — TypeScript language definition.
//
// spec §1.2 row `@kindly-note/lang-typescript`:
//   - default export: a `LanguageDefinition` (deep-frozen at module init).
//   - aliases: `ts`, `tsx`, `mts`, `cts`.
//   - depends on: @kindly-note/{core, lang-helpers, lang-pack-ecmascript,
//     lang-javascript}.
//
// THIS PACKAGE IS THE KEYSTONE END-TO-END PROOF.
//
// spec §0 architectural shift #5 + §8.2 THE KEYSTONE: TypeScript inherits
// from JavaScript through the typed `extend()` API, not through array-mutation
// of an `exports` field. The implementation here uses ONLY:
//   - `extendLanguage(javascript, LanguageExtensions<JavaScriptExtensionPoints>)`
//   - the typed `extendPoints` transform on the descendant
//   - the typed `addContains`, `replaceModes`, `transformLabeledMode`,
//     `extendKeywords` extensions
//
// The implementation does NOT:
//   - call `Object.assign(jsLanguage.keywords, ...)` (upstream mutation pattern
//     — forbidden by spec)
//   - push into `jsLanguage.contains` (frozen — would throw at runtime)
//   - reach into `jsLanguage.exports.PARAMS_CONTAINS` (the `exports: any`
//     field is removed by spec §8 Cat 5; replaced by the typed `extensible`
//     surface)
//
// The keystone proof tests live in `tests/keystone.test.ts`.

import type { LanguageDefinition, Mode, ScopeMap } from '@kindly-note/core';
import { extendLanguage } from '@kindly-note/core';
import { shebang } from '@kindly-note/lang-helpers';
import javascript from '@kindly-note/lang-javascript';
import * as ECMAScript from '@kindly-note/lang-pack-ecmascript';

const IDENT_RE = ECMAScript.IDENT_RE;

// ---------------------------------------------------------------------------
// TypeScript-specific keyword sets
// ---------------------------------------------------------------------------

/** TS primitive types — `any`, `void`, `number`, etc. */
const TS_TYPES: readonly string[] = [
  'any',
  'void',
  'number',
  'boolean',
  'string',
  'object',
  'never',
  'symbol',
  'bigint',
  'unknown',
];

/** TS-specific keywords — `interface`, `type`, `public`, etc. */
const TS_KEYWORDS: readonly string[] = [
  'type',
  'interface',
  'public',
  'private',
  'protected',
  'implements',
  'declare',
  'abstract',
  'readonly',
  'enum',
  'override',
  'satisfies',
  // Note: `namespace` is a TS keyword but it's also a valid variable name
  // (`const namespace = 'bar'`). Upstream excludes it from the keyword list
  // and uses a structural mode (NAMESPACE below) to scope it only at
  // declaration sites. We mirror that.
];

// ---------------------------------------------------------------------------
// TypeScript-specific Modes
// ---------------------------------------------------------------------------

/**
 * Decorator: `@injected`, `@Component`, `@inject(token)`. spec §8.2.2 worked
 * example. Added to JS's PARAMS_CONTAINS via `extendPoints` AND added as a
 * top-level mode via `addContains` (so decorators outside parameter lists are
 * also scoped — e.g. `@Component class Foo {}`).
 */
const DECORATOR: Mode = {
  scope: 'meta',
  match: `@${IDENT_RE}`,
};

/**
 * Namespace declaration: `namespace Foo { ... }`. Multi-capture-group: keyword
 * + space + class name. spec §8.2.2 worked example. Cohort 4's matcher emits
 * per-group scopes (the `isMultiCapture` path).
 */
const NAMESPACE: Mode = {
  match: [/namespace/, /\s+/, IDENT_RE],
  scope: { 1: 'keyword', 3: 'title.class' } as ScopeMap,
};

/**
 * Interface declaration: `interface Foo extends Bar { ... }`. The body opens
 * with `{` (excluded from the match — `excludeEnd: true`). The mode reaches
 * into the parent's typed extension surface for `CLASS_REFERENCE` (used in
 * `interface Foo extends Bar` to scope `Bar` as a class reference). spec
 * §8.2.2 worked example.
 *
 * The closure over `javascript.extensible!` is what makes this work — TS
 * pulls the parent's published Mode via the typed `extensible` field, NOT
 * by reaching into JS's internal contains array. spec §0 shift #5.
 */
const INTERFACE_MODE: Mode = {
  beginKeywords: 'interface',
  end: /\{/,
  excludeEnd: true,
  keywords: {
    keyword: 'interface extends',
    built_in: TS_TYPES,
  },
  // Spec §8.2.2: closure-over-parent's-extensible. The CLASS_REFERENCE Mode
  // exposed via JavaScriptExtensionPoints scopes `Bar` as a class reference.
  // Note: javascript.extensible is non-null (we know JS publishes it) but TS
  // here narrows via `!` — mirrors the spec's worked example exactly.
  contains: [javascript.extensible!.CLASS_REFERENCE],
};

/**
 * `'use strict'` (TypeScript variant). Upstream's TS replaces the JS variant
 * because TS forbids `'use asm'` (pure-asm.js mode). Mirrors upstream
 * `swapMode(tsLanguage, "use_strict", USE_STRICT)`.
 */
const TS_USE_STRICT: Mode = {
  label: 'use_strict',
  scope: 'meta',
  relevance: 10,
  begin: /^\s*['"]use strict['"]/,
};

// ---------------------------------------------------------------------------
// The keystone: extendLanguage(javascript, ...)
// ---------------------------------------------------------------------------

/**
 * The TypeScript LanguageDefinition. Built ENTIRELY through the typed
 * `extendLanguage()` API. spec §8.2 THE KEYSTONE:
 *   - Parent (`javascript`) is never mutated.
 *   - The extension surface (`JavaScriptExtensionPoints`) is statically typed.
 *   - Each extendPoints transform receives the parent's frozen value and
 *     returns the new value (never mutates).
 *
 * This is the architectural bet of the entire kindly-note project. If this
 * compiles, runs, and passes the keystone tests, spec §8.2 / §8.2.1 / §8.2.2
 * are validated end-to-end.
 */
const typescript: LanguageDefinition<unknown> = extendLanguage(javascript, {
  name: 'TypeScript',
  aliases: ['ts', 'tsx', 'mts', 'cts'],

  // Merge TS-specific keywords with JS's. spec §8.2.2: shallow merge
  // (concat-and-dedupe per key) handled by `extendKeywords` in core.
  extendKeywords: {
    keyword: TS_KEYWORDS,
    built_in: TS_TYPES,
  },

  // Spec §8.2.2: typed extension via `extendPoints`. The transform receives
  // the parent's frozen `PARAMS_CONTAINS` and returns a NEW array containing
  // DECORATOR. The parent's array is never written to.
  extendPoints: {
    PARAMS_CONTAINS: (current) => [...current, DECORATOR],
  },

  // Append the TS-only top-level modes. spec §8.2.2.
  addContains: [DECORATOR, NAMESPACE, INTERFACE_MODE],

  // Replace shebang and use-strict labelled modes. spec §8.2.2:
  //   - shebang: TS gets a simpler shebang (no node-binary anchor).
  //   - use_strict: TS forbids `'use asm'`.
  replaceModes: [
    { label: 'shebang', with: shebang() },
    { label: 'use_strict', with: TS_USE_STRICT },
  ],

  // Adjust the function-def relevance. `() => {}` is more typical in TS than
  // `function foo()`, so the named-function-decl gets a relevance of 0
  // (mirrors upstream `functionDeclaration.relevance = 0`). spec §8.2.2.
  transformLabeledMode: [{ label: 'func.def', transform: (m) => ({ ...m, relevance: 0 }) }],
});

export default typescript;
