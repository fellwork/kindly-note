// @kindly-note/lang-javascript — the JavaScript / JSX / MJS / CJS language definition.
//
// spec §1.2 row `@kindly-note/lang-javascript`:
//   - default export: a `LanguageDefinition<JavaScriptExtensionPoints>` (deep-frozen at module init).
//   - named export: `JavaScriptExtensionPoints` (type) — the `extensible` shape.
//   - aliases: `js`, `jsx`, `mjs`, `cjs`.
//   - depends on: @kindly-note/core, @kindly-note/lang-helpers, @kindly-note/lang-pack-ecmascript.
//
// Spec §0 architectural shifts validated by this package:
//   #1 Languages-as-values — the export is a typed value, not a function that
//      mutates a shared `hljs` argument.
//   #2 Compile-at-register-time, immutable — `defineLanguage()` deep-freezes
//      the definition at module init; the matcher in @kindly-note/core
//      compiles a fresh CompiledLanguage at register time.
//   #5 TypeScript inherits from JavaScript through a typed `extend()` API,
//      not through array-mutation of an `exports` field. This package is the
//      keystone PARENT — it publishes a typed `extensible` surface
//      (`JavaScriptExtensionPoints`) for `@kindly-note/lang-typescript` (and
//      future descendants like CoffeeScript) to consume via `extendLanguage()`.
//
// Reference shape (NOT byte-copied) is upstream's `src/languages/javascript.js`.
// We modernise: typed Mode shape, frozen contains array, scope (not className),
// no `hljs.` runtime injection, ScopeMap-keyed multi-capture (`scope: { 1: ..., 3: ... }`)
// rendered through the cohort-4-extended matcher's per-capture-group emit.
// Round-1 user lock: byte-for-byte fixture parity is NOT a goal; structural
// correctness (correct scopes on each lexeme) is.

import type { LanguageDefinition, Mode } from '@kindly-note/core';
import { defineLanguage } from '@kindly-note/core';
import { apostropheString, quoteString, regexpMode, shebang } from '@kindly-note/lang-helpers';
import type { JavaScriptExtensionPoints } from './extensions.js';
import {
  CLASS_OR_EXTENDS,
  CLASS_REFERENCE,
  COMMENT,
  FUNCTION_DEFINITION,
  KEYWORDS,
  NUMBER,
  PARAMS_CONTAINS,
  TEMPLATE_STRING,
  USE_STRICT,
} from './modes.js';

// Re-export the type so consumers (especially `@kindly-note/lang-typescript`)
// can satisfy `extendLanguage<JavaScriptExtensionPoints>(javascript, ...)` at
// the call site. spec §1.2 row "named: `JavaScriptExtensionPoints` (type)".
export type { JavaScriptExtensionPoints } from './extensions.js';

/**
 * The JavaScript LanguageDefinition. spec §0 shift #1: a deep-frozen value,
 * not a factory function. spec §1.2 row aliases: `js` (canonical-lowercase),
 * `jsx`, `mjs`, `cjs`. The `extensible` field publishes the typed extension
 * surface lang-typescript consumes (spec §8.2 THE KEYSTONE).
 *
 * Order of `contains` follows upstream's `javascript.js` ordering. The
 * leftmost-then-first-alternative regex semantics in the matcher's union mean
 * that an earlier mode wins when two candidates match the same position —
 * which is why class-decls and function-decls come BEFORE the bare
 * CLASS_REFERENCE / generic identifier.
 */
const javascript: LanguageDefinition<JavaScriptExtensionPoints> =
  defineLanguage<JavaScriptExtensionPoints>({
    name: 'JavaScript',
    aliases: ['js', 'jsx', 'mjs', 'cjs'],
    keywords: KEYWORDS,
    illegal: /#(?![$_A-Za-z])/,
    contains: [
      // Shebang at the start of a file (`#!/usr/bin/env node`). Labelled so
      // TypeScript can replace it with a less-restrictive variant.
      shebang({ label: 'shebang', binary: 'node', relevance: 5 }),
      USE_STRICT,
      apostropheString,
      quoteString,
      TEMPLATE_STRING,
      COMMENT,
      // Skip numbers when they are part of a variable name (e.g. `$1`).
      { match: /\$\d+/ } as Mode,
      NUMBER,
      // Class-declaration first so `class Foo` does NOT match CLASS_REFERENCE
      // (which would scope `Foo` as `title.class` without keywords for `class`).
      CLASS_OR_EXTENDS,
      CLASS_REFERENCE,
      // Function-declaration. Labelled so TypeScript can adjust its relevance.
      FUNCTION_DEFINITION,
      // Property-name attribute mode: `foo:` in object literals.
      {
        scope: 'attr',
        match: '\\b[A-Za-z_$][\\w$]*(?=\\s*:)',
        relevance: 0,
      } as Mode,
      // Catch the common "while/if/switch/catch/for" keyword set so they don't
      // get swallowed up by something else looking function-like.
      { beginKeywords: 'while if switch catch for' } as Mode,
      // Regex literal — must come AFTER strings so `'/foo/'` doesn't fire it.
      regexpMode,
      // Constructor — `constructor(` is a special title.function.
      {
        match: [/\bconstructor(?=\s*\()/],
        scope: { 1: 'title.function' },
      } as Mode,
      // Spread / rest token.
      { match: /\.\.\./, relevance: 0 } as Mode,
      // `$ident` — relevance booster for jQuery-style code (`$.something`,
      // `$(selector)`).
      { match: '\\$[(.]', relevance: 0 } as Mode,
    ],
    // spec §8.2: the typed extension surface. `extendLanguage` consumes this
    // shape; `extendPoints[K]` receives `current: TExt[K]` and returns the
    // new value (never mutates the parent).
    extensible: {
      PARAMS_CONTAINS,
      CLASS_REFERENCE,
    },
  });

export default javascript;
