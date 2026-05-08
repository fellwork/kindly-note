// @kindly-note/lang-json — the JSON / JSONC / JSON5 language definition.
//
// spec §1.2 row `@kindly-note/lang-json`:
//   - default export: a `LanguageDefinition` (deep-frozen at module init).
//   - aliases: 'jsonc', 'json5' (the canonical name is 'json').
//   - depends on: @kindly-note/core (types), @kindly-note/lang-helpers
//     (cLineComment, cBlockComment), @kindly-note/lang-pack-ecmascript
//     (EXTENDED_NUMBER_MODE).
//
// Spec §0 architectural shifts validated by this package:
//   #1 Languages-as-values — the export is a typed value, not a function
//      that mutates a shared `hljs` argument.
//   #2 Compile-at-register-time, immutable — `defineLanguage()` deep-freezes
//      the definition at module init; the matcher in @kindly-note/core
//      compiles a fresh CompiledLanguage at register time.
//
// Reference shape (NOT byte-copied) is upstream's `src/languages/json.js`. We
// modernise: typed Mode shape, frozen contains array, scope (not className),
// and the comment helpers from @kindly-note/lang-helpers.
//
// JSON, JSONC (JSON-with-Comments — TypeScript / VS Code config files), and
// JSON5 (relaxed JSON with single-quoted strings, comments, trailing commas)
// share the same lexical surface for the purposes of syntax highlighting.
// Round-1 user lock: byte-for-byte fixture parity is NOT a goal; structural
// correctness (correct scopes on each lexeme) is.

import type { LanguageDefinition, Mode } from '@kindly-note/core';
import { defineLanguage } from '@kindly-note/core';
import {
  apostropheString,
  cBlockComment,
  cLineComment,
  quoteString,
} from '@kindly-note/lang-helpers';
import { EXTENDED_NUMBER_MODE } from '@kindly-note/lang-pack-ecmascript';

/**
 * The three JSON literal lexemes. JSON's own spec narrows the literal set to
 * exactly these three values (RFC 8259 §3); we keep them inline rather than
 * pulling lang-pack-ecmascript's broader `LITERALS` array because JSON
 * forbids `undefined` / `NaN` / `Infinity`. Spec §1.2 cross-package coupling
 * note: this list is JSON-specific.
 */
const JSON_LITERALS: readonly string[] = ['true', 'false', 'null'];

/**
 * Property-name attribute Mode. Matches a quoted string immediately followed
 * (with optional whitespace) by `:`. The `(?=...)` lookahead means only the
 * string is consumed; the `:` is left for the PUNCTUATION mode to claim.
 *
 * Reference: upstream `json.js#ATTRIBUTE`. Modernisation: typed Mode shape,
 * `scope: 'attr'` instead of the deprecated `className`. Spec §1.2.
 *
 * Relevance is bumped to 1.01 (matching upstream) because the ATTRIBUTE
 * pattern with the lookahead is a strong JSON signal — it disambiguates JSON
 * from a wrong-language scan that just happens to contain quoted strings.
 */
const ATTRIBUTE: Mode = {
  scope: 'attr',
  // Two alternatives: double-quoted or single-quoted, each followed by a
  // colon-with-optional-whitespace lookahead. JSON5 / JSONC permit
  // single-quoted keys. Standard JSON only allows double-quoted; we still
  // accept both for the unified `json|jsonc|json5` surface — the surrounding
  // language's `illegal: '\\S'` does NOT trigger inside this mode (the
  // matcher only checks the top frame's illegal — see compile.ts /
  // matcher.ts).
  begin: /(("(\\.|[^\\"\r\n])*")|('(\\.|[^\\'\r\n])*'))(?=\s*:)/,
  relevance: 1.01,
};

/**
 * Punctuation Mode. Matches structural delimiters: `{`, `}`, `[`, `]`, `,`,
 * `:`. spec §5.6 numbered call-trace shows these emit `<span class="kn-punctuation">…</span>`
 * with the `punctuation` scope.
 *
 * Relevance 0 — punctuation alone isn't a strong language signal.
 */
const PUNCTUATION: Mode = {
  scope: 'punctuation',
  match: /[{}[\],:]/,
  relevance: 0,
};

/**
 * Literal Mode for `true` / `false` / `null`. Uses `beginKeywords` to anchor
 * the lexeme so the surrounding language-level `illegal: '\\S'` does NOT
 * abort.
 *
 * Reference: upstream `json.js#LITERALS_MODE`. Why a Mode instead of relying
 * on the language-level `keywords: { literal: [...] }`? Per upstream's
 * inline note: "using a mode here allows us to use the very tight `illegal:
 * \\S` rule later to flag any other character" — modes are matched as
 * `begin` candidates BEFORE the per-frame `illegal` rule fires, so a plain
 * `true` survives the strict illegal sweep.
 *
 * The synthetic end (`\\B|\\b`) injected by compile.ts when no `end` is
 * declared closes this mode immediately after the begin lexeme is consumed,
 * which makes the engine emit `<span class="kn-literal">true</span>` and
 * pop back to the root for the next token. Validated by tests/json.test.ts.
 */
const LITERALS_MODE: Mode = {
  scope: 'literal',
  beginKeywords: JSON_LITERALS.join(' '),
};

/**
 * The JSON LanguageDefinition. spec §0 shift #1: a deep-frozen value, not a
 * factory function. Spec §1.2 row aliases: `json` (canonical), `jsonc`,
 * `json5`.
 *
 * Order of `contains` matters — the matcher compiles them into a multi-regex
 * union and JavaScript's leftmost-then-first-alternative regex semantics give
 * earlier alternatives priority when two modes' begin patterns match at the
 * same position. ATTRIBUTE comes before string modes so `"foo":` is matched
 * as an attribute, not a plain string.
 */
const json: LanguageDefinition = defineLanguage({
  name: 'JSON',
  aliases: ['json', 'jsonc', 'json5'],
  // Language-level keywords mirror upstream — kept for parity (and for any
  // auto-detect heuristic in cohort 4+). The LITERALS_MODE above does the
  // actual scoping work.
  keywords: {
    literal: JSON_LITERALS,
  },
  contains: [
    // 1. ATTRIBUTE first — the lookahead disambiguates `"key":` from a plain
    //    quoted string value. Upstream order.
    ATTRIBUTE,
    // 2. PUNCTUATION — `{`, `}`, `[`, `]`, `,`, `:`.
    PUNCTUATION,
    // 3. apostropheString / quoteString from lang-helpers — these handle
    //    string VALUES (after the property-name lookahead has been claimed).
    apostropheString,
    quoteString,
    // 4. LITERALS_MODE — `true` / `false` / `null` as scoped literals.
    LITERALS_MODE,
    // 5. EXTENDED_NUMBER_MODE — `0`, `42`, `-3`, `2.5`, `1e6`, `0xFF`.
    //    Re-used from lang-pack-ecmascript; spec §1.2 explicitly cites this
    //    as the canonical cross-package consumer pattern.
    EXTENDED_NUMBER_MODE,
    // 6. Comments — JSONC and JSON5 permit `//` and `/* */`. Standard JSON
    //    forbids comments, but tolerating them in a single shared definition
    //    matches upstream's behaviour and the dispatch's three-alias surface.
    cLineComment,
    cBlockComment,
  ],
  // Strict parser stance: any non-whitespace lexeme outside the recognised
  // modes triggers `IllegalSyntaxError`, surfacing as `result.illegal: true`.
  // Spec §0 shift: explicit, typed illegal handling. Mirrors upstream
  // `illegal: '\\S'`.
  illegal: '\\S',
});

export default json;
