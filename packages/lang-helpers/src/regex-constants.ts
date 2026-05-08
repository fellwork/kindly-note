// Regex source-string constants used across language definitions.
//
// spec §1.2 row `@kindly-note/lang-helpers` lists `IDENT_RE`, `C_NUMBER_RE`,
// `BINARY_NUMBER_RE`, `RE_STARTERS_RE`, `NUMBER_RE` as named exports of this
// package. We additionally publish `MATCH_NOTHING_RE` and `UNDERSCORE_IDENT_RE`
// since (a) upstream `src/lib/modes.js` exports them and (b) they appear in
// derived helpers (`underscoreTitleMode`, `methodGuard`).
//
// All values are regex *source strings*, not RegExp instances. The matcher in
// @kindly-note/core compiles them at compile-time (spec §9.4). Keeping them as
// strings is what makes them composable with `regex.concat(...)` and friends
// without paying the per-call new RegExp cost.
//
// These are constants, not factories. Importing one helper does not cost the
// bytes of the others (spec §1.2: tree-shakable; package.json#sideEffects: false).

/** A regex that never matches anything. Used as a sentinel "no match" rule. */
export const MATCH_NOTHING_RE = /\b\B/;

/** Identifier — letter followed by word characters. */
export const IDENT_RE = '[a-zA-Z]\\w*';

/** Identifier including a leading underscore. */
export const UNDERSCORE_IDENT_RE = '[a-zA-Z_]\\w*';

/** Plain decimal number (no sign, no exponent). */
export const NUMBER_RE = '\\b\\d+(\\.\\d+)?';

/**
 * C-style number — covers hex (`0x...`), decimal (`0...`, `123`, `12.3`,
 * `.5`), and exponent (`1e6`, `1.2e-3`). Single capture-group-laden source
 * mirrors upstream's literal text; downstream emitters do not depend on the
 * group structure. Optional leading minus is captured to keep parity.
 */
export const C_NUMBER_RE = '(-?)(\\b0[xX][a-fA-F0-9]+|(\\b\\d+(\\.\\d*)?|\\.\\d+)([eE][-+]?\\d+)?)';

/** Binary literal `0b...`. */
export const BINARY_NUMBER_RE = '\\b(0b[01]+)';

/**
 * Operators / punctuation that may *precede* a regex literal in JS-like
 * languages. After such a token, `/foo/` is a regex; otherwise it is division.
 * Mirrors upstream's RE_STARTERS_RE source verbatim — the parser ordering of
 * alternatives matters for first-match semantics.
 */
export const RE_STARTERS_RE =
  '!|!=|!==|%|%=|&|&&|&=|\\*|\\*=|\\+|\\+=|,|-|-=|/=|/|:|;|<<|<<=|<=|<|===|==|=|>>>=|>>=|>=|>>>|>>|>|\\?|\\[|\\{|\\(|\\^|\\^=|\\||\\|=|\\|\\||~';
