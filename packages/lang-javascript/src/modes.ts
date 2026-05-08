// Mode-tree fragments for JavaScript. Each is exported so the index file can
// compose them into the LanguageDefinition's `contains` array, and so the
// extensible PARAMS_CONTAINS / CLASS_REFERENCE values can reference them
// without circular import.
//
// spec §1.2: lang-javascript covers `js`, `jsx`, `mjs`, `cjs` aliases; spec
// §8.2.1 is the canonical worked example for the LanguageDefinition shape.
// Reference is upstream `src/languages/javascript.js` (read-only, NOT byte-
// copied — we modernise the API: scope (not className), readonly arrays,
// typed Mode values, no `hljs.` runtime injection).
//
// spec §0 architectural shift #2: every Mode is a value created here at
// module-init; the matcher in @kindly-note/core compiles them into a
// CompiledMode tree at registerLanguage time. This file imports `Mode` from
// core as a type only (no runtime edge); the helper modes come from
// @kindly-note/lang-helpers (`shebang`, `apostropheString`, `quoteString`,
// `cLineComment`, `cBlockComment`, `regexpMode`, `comment`, `backslashEscape`).

import type { Mode } from '@kindly-note/core';
import * as regex from '@kindly-note/core/regex';
import {
  apostropheString,
  backslashEscape,
  cBlockComment,
  cLineComment,
  comment,
  quoteString,
} from '@kindly-note/lang-helpers';
import * as ECMAScript from '@kindly-note/lang-pack-ecmascript';

const IDENT_RE = ECMAScript.IDENT_RE;

// ---------------------------------------------------------------------------
// Keyword set (used by every nested mode that does keyword tokenisation)
// ---------------------------------------------------------------------------

/**
 * The shared keyword dictionary referenced by the language root, by PARAMS,
 * and by the SUBST template-literal mode. spec §8.2.1 worked example mirrors
 * this exactly. Note: `$pattern` controls the lexeme tokeniser regex (per
 * compile.ts `compileKeywordPatternRe`); the IDENT_RE pattern means we
 * tokenise on identifier boundaries.
 */
export const KEYWORDS = {
  $pattern: IDENT_RE,
  keyword: ECMAScript.KEYWORDS,
  literal: ECMAScript.LITERALS,
  built_in: ECMAScript.BUILT_INS,
  'variable.language': ECMAScript.BUILT_IN_VARIABLES,
} as const;

// ---------------------------------------------------------------------------
// Numbers (JS-specific superset — covers BigInt, hex, binary, octal, exp)
// ---------------------------------------------------------------------------

const decimalDigits = '[0-9](_?[0-9])*';
const frac = `\\.(${decimalDigits})`;
const decimalInteger = '0|[1-9](_?[0-9])*|0[0-7]*[89][0-9]*';

/**
 * JavaScript number literals — covers DecimalLiteral, BigInt, hex, binary,
 * octal, and legacy octal. Mirrors upstream's `NUMBER` mode shape. Cohort 4
 * intentionally re-implements rather than reusing `EXTENDED_NUMBER_MODE` from
 * lang-pack-ecmascript: JS supports `1n`/`0xFFn`/`0b10n`/`0o7n` BigInt forms
 * that the JSON-targeted EXTENDED_NUMBER_MODE does not. relevance: 0 to match
 * upstream and to keep auto-detect honest.
 */
export const NUMBER: Mode = {
  scope: 'number',
  variants: [
    // DecimalLiteral with exponent
    {
      begin: `(\\b(${decimalInteger})((${frac})|\\.)?|(${frac}))[eE][+-]?(${decimalDigits})\\b`,
    },
    // DecimalLiteral
    { begin: `\\b(${decimalInteger})\\b((${frac})\\b|\\.)?|(${frac})\\b` },
    // BigInt
    { begin: '\\b(0|[1-9](_?[0-9])*)n\\b' },
    // Hex
    { begin: '\\b0[xX][0-9a-fA-F](_?[0-9a-fA-F])*n?\\b' },
    // Binary
    { begin: '\\b0[bB][0-1](_?[0-1])*n?\\b' },
    // Octal
    { begin: '\\b0[oO][0-7](_?[0-7])*n?\\b' },
    // Legacy octal
    { begin: '\\b0[0-7]+n?\\b' },
  ],
  relevance: 0,
};

// ---------------------------------------------------------------------------
// Template literals + ${...} substitution
// ---------------------------------------------------------------------------
//
// SUBST and TEMPLATE_STRING are mutually-recursive: a template literal contains
// SUBST entries; SUBST entries can contain TEMPLATE_STRING (nested templates).
// We resolve the cycle by building both modes' `contains` arrays at module
// init via reusable arrays — `SUBST.contains` is allowed to reference earlier
// nodes (apostropheString / quoteString / NUMBER) and the deferred-built
// TEMPLATE_STRING. Both are deep-frozen by `defineLanguage` at module init,
// AFTER the cycle is resolved.

// Built first as an empty-contains scaffold; populated after TEMPLATE_STRING.
const SUBST: { -readonly [K in keyof Mode]: Mode[K] } = {
  scope: 'subst',
  begin: '\\$\\{',
  end: '\\}',
  keywords: KEYWORDS,
  contains: [],
};

/** Plain template literal — `\`...\``. */
export const TEMPLATE_STRING: Mode = {
  scope: 'string',
  begin: '`',
  end: '`',
  contains: [backslashEscape, SUBST as Mode],
};

// Now patch SUBST's contains to include TEMPLATE_STRING (recursive nesting).
// Mirrors upstream's `SUBST.contains = SUBST_INTERNALS.concat({ ... })`.
SUBST.contains = [apostropheString, quoteString, TEMPLATE_STRING, { match: /\$\d+/ }, NUMBER];

export { SUBST };

// ---------------------------------------------------------------------------
// Comments — line + block + JSDoc with @-tag detection
// ---------------------------------------------------------------------------

/**
 * JSDoc `/** ... * /` comment with @tag and {type} sub-modes. Mirrors upstream
 * `JSDOC_COMMENT` from javascript.js. `@param`, `@returns`, etc. become
 * `doctag`; `{Type}` becomes `type`; the variable name following becomes
 * `variable`.
 */
export const JSDOC_COMMENT: Mode = comment('/\\*\\*(?!/)', '\\*/', {
  relevance: 0,
  contains: [
    {
      // Lookahead for `@TagName` — then dive into the doctag/type/variable submodes.
      begin: '(?=@[A-Za-z]+)',
      relevance: 0,
      contains: [
        { scope: 'doctag', begin: '@[A-Za-z]+' },
        {
          scope: 'type',
          begin: '\\{',
          end: '\\}',
          excludeBegin: true,
          excludeEnd: true,
          relevance: 0,
        },
        {
          scope: 'variable',
          begin: `${IDENT_RE}(?=\\s*(-)|$)`,
          endsParent: true,
          relevance: 0,
        },
        // Eat spaces (not newlines) so we can find types or variables.
        { begin: /(?=[^\n])\s/, relevance: 0 },
      ],
    },
  ],
});

/**
 * Comment alternation — JSDoc first (longer match wins), then C block, then
 * line comment. Mirrors upstream's `COMMENT` variant.
 */
export const COMMENT: Mode = {
  scope: 'comment',
  variants: [JSDOC_COMMENT, cBlockComment, cLineComment],
};

// ---------------------------------------------------------------------------
// PARAMS / PARAMS_CONTAINS — published as part of JavaScriptExtensionPoints
// ---------------------------------------------------------------------------

/**
 * The contents that may appear inside function parameter lists. Mirrors
 * upstream's `PARAMS_CONTAINS = SUBST_AND_COMMENTS.concat([...])` shape. Spec
 * §8.2.1 worked example. This array is what
 * `JavaScriptExtensionPoints.PARAMS_CONTAINS` exposes; lang-typescript appends
 * a `DECORATOR` to it via `extendPoints.PARAMS_CONTAINS`.
 *
 * The returned readonly array is frozen by `defineLanguage`'s deep-freeze pass
 * at module init (spec §9.1).
 */
export const PARAMS_CONTAINS: readonly Mode[] = [
  // Comments (must come first so `// comment` inside params doesn't misparse).
  COMMENT,
  // String / template forms — JS allows any string flavour as a default value.
  apostropheString,
  quoteString,
  TEMPLATE_STRING,
  // Skip numbers when they are part of a variable name (e.g. `$1`).
  { match: /\$\d+/ },
  NUMBER,
  // Recursive parens for nested expressions (default values that are calls).
  {
    begin: /(\s*)\(/,
    end: /\)/,
    keywords: KEYWORDS,
    contains: ['self', COMMENT, apostropheString, quoteString, TEMPLATE_STRING, NUMBER],
  },
];

/**
 * The function-parameter mode itself. Mirrors upstream `PARAMS`. Used inside
 * FUNCTION_DEFINITION's contains.
 */
export const PARAMS: Mode = {
  scope: 'params',
  begin: /(\s*)\(/,
  end: /\)/,
  excludeBegin: true,
  excludeEnd: true,
  keywords: KEYWORDS,
  contains: PARAMS_CONTAINS,
};

// ---------------------------------------------------------------------------
// CLASS_REFERENCE — published as part of JavaScriptExtensionPoints
// ---------------------------------------------------------------------------

/**
 * Match a class-name-shaped identifier. spec §8.2.1: published via
 * `JavaScriptExtensionPoints.CLASS_REFERENCE` for descendants like TypeScript
 * to use inside their `interface ... extends Foo` modes.
 *
 * Mirrors upstream's `CLASS_REFERENCE` regex shape (PascalCase / FOOBar /
 * PFs cases) without the underscore-`_:` keyword-relevance mechanism (cohort 4
 * focuses on shape; relevance refinement is a follow-up).
 */
export const CLASS_REFERENCE: Mode = {
  scope: 'title.class',
  match: regex.either(
    // Hard-coded exception
    /\bJSON/,
    // Float32Array, OutT
    /\b[A-Z][a-z]+([A-Z][a-z]*|\d)*/,
    // CSSFactory, CSSFactoryT
    /\b[A-Z]{2,}([A-Z][a-z]+|\d)+([A-Z][a-z]*)*/,
    // FPs, FPsT
    /\b[A-Z]{2,}[a-z]+([A-Z][a-z]+|\d)*([A-Z][a-z]*)*/,
  ),
  relevance: 0,
};

// ---------------------------------------------------------------------------
// CLASS_OR_EXTENDS — multi-capture mode with per-group scope
// ---------------------------------------------------------------------------

/**
 * `class Foo extends Bar` and `class Foo`. Cohort 4 is the FIRST language to
 * use multi-capture-group `match` arrays with `scope` as a ScopeMap. The
 * matcher's `isMultiCapture` + `beginScope` path handles per-group emit. Spec
 * §8.2.1.
 */
export const CLASS_OR_EXTENDS: Mode = {
  variants: [
    // class Car extends Vehicle (with optional dotted-namespace extender)
    {
      match: [
        /class/,
        /\s+/,
        IDENT_RE,
        /\s+/,
        /extends/,
        /\s+/,
        regex.concat(IDENT_RE, '(', regex.concat(/\./, IDENT_RE), ')*'),
      ],
      scope: {
        1: 'keyword',
        3: 'title.class',
        5: 'keyword',
        7: 'title.class.inherited',
      },
    },
    // class Car
    {
      match: [/class/, /\s+/, IDENT_RE],
      scope: { 1: 'keyword', 3: 'title.class' },
    },
  ],
};

// ---------------------------------------------------------------------------
// FUNCTION_DEFINITION — multi-capture mode + label for descendants
// ---------------------------------------------------------------------------

/**
 * `function foo(`. Multi-capture-group with per-group scope emit (keyword +
 * title.function). Labelled `func.def` so descendants (TypeScript) can adjust
 * its relevance via `transformLabeledMode`. spec §8.2.1 / §8.2.2.
 */
export const FUNCTION_DEFINITION: Mode = {
  label: 'func.def',
  variants: [
    {
      match: [/function/, /\s+/, IDENT_RE, /(?=\s*\()/],
      scope: { 1: 'keyword', 3: 'title.function' },
    },
    // anonymous function
    {
      match: [/function/, /\s*(?=\()/],
      scope: { 1: 'keyword' },
    },
  ],
  contains: [PARAMS],
  illegal: /%/,
};

// ---------------------------------------------------------------------------
// USE_STRICT — labelled so TypeScript can swap it for a stricter variant
// ---------------------------------------------------------------------------

/**
 * `'use strict'` / `'use asm'` directive. Labelled `use_strict` so TypeScript
 * (which forbids `'use asm'`) can swap it via `replaceModes`. spec §8.2.2.
 */
export const USE_STRICT: Mode = {
  label: 'use_strict',
  scope: 'meta',
  relevance: 10,
  begin: /^\s*['"]use (strict|asm)['"]/,
};
