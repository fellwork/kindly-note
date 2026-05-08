// Per-language relevance scoring + tie-breaker comparator. spec §1.2 row
// `@kindly-note/auto-detect`; Scout §6 (upstream's `highlightAuto` impl in
// `src/highlight.js:685-722`).
//
// This module is pure: it takes a Highlighter handle, runs `hl.highlight(code,
// { language: name })` once per candidate language, and returns a typed
// `LanguageScore`. The sort comparator implements the same `supersetOf`
// fallback as upstream — when language A and language B tie on `relevance`,
// the one that does NOT declare `supersetOf` of the other wins (so plain JS
// beats TS for plain-JS code, mirroring upstream lang-arduino vs lang-cpp tie-
// break).
//
// MAX_KEYWORD_HITS dampening: NOT implemented in v0. Tracked as build-
// manifest-c3a open question #9; the underlying matcher accumulates each
// keyword hit unconditionally instead of capping at upstream's 7-hit limit.
// For this v0 detector that means longer code samples can score *higher* on a
// language than upstream would — but the sort ORDER is the same so long as
// the same dampening rule is applied (or omitted) uniformly across all
// candidates. Detection accuracy on the cohort acceptance gates is therefore
// preserved; the absolute scores are larger than upstream by a constant
// factor proportional to keyword-repetition density.

import type { HighlightResult, Highlighter, RegisteredLanguage } from '@kindly-note/core';

/**
 * The per-language scoring artifact. One per candidate language considered
 * for a `detect()` call. `result` is the full HighlightResult for the
 * language, including the rendered `value` so the winner can be returned
 * without re-running the engine.
 */
export interface LanguageScore {
  readonly name: string;
  readonly relevance: number;
  readonly result: HighlightResult;
  readonly handle: RegisteredLanguage;
}

/**
 * Score a single candidate language. Mirrors upstream `_highlight(name, code,
 * false)` from `src/highlight.js:678` — runs the full highlight pipeline and
 * reads `relevance`. When the parser hits an `illegal` rule the highlighter's
 * `safe` errorMode catches it and returns `{ relevance: 0, illegal: true }`,
 * so illegal-marked results naturally drop to 0 in the sort.
 *
 * We pass `ignoreIllegals: false` deliberately — illegal-mark = "this
 * language is wrong for this code", which is the upstream signal.
 */
export function scoreLanguage(
  hl: Highlighter,
  code: string,
  handle: RegisteredLanguage,
): LanguageScore {
  const name = handle.compiled.name;
  const result = hl.highlight(code, { language: name, ignoreIllegals: false });
  // When the language hit an illegal rule we treat its relevance as 0 even if
  // the matcher accumulated some pre-illegal score before throwing. Mirrors
  // upstream — `IllegalSyntaxError` wipes relevance via the safe-mode return
  // (highlighter.ts driveMatcher: `return { relevance: 0, illegal: true }`).
  // This branch is defensive only; the highlighter already does this.
  const relevance = result.illegal ? 0 : result.relevance;
  return Object.freeze({ name, relevance, result, handle });
}

/**
 * Sort comparator implementing upstream's tie-break rule for `highlightAuto`.
 * Scout §6 verbatim:
 *
 *   if (a.relevance !== b.relevance) return b.relevance - a.relevance;
 *   if (a.language && b.language) {
 *     if (getLanguage(a.language).supersetOf === b.language) return 1;
 *     else if (getLanguage(b.language).supersetOf === a.language) return -1;
 *   }
 *   return 0;
 *
 * Plus an additional `preferLanguage` knob (kindly-note extension) that wins
 * over the supersetOf fallback when present.
 *
 * Returns a negative number when `a` should sort before `b` (i.e. `a` is
 * better). Stable sort means original registration order breaks ties beyond
 * supersetOf.
 */
export function compareScores(a: LanguageScore, b: LanguageScore, preferLanguage?: string): number {
  if (a.relevance !== b.relevance) return b.relevance - a.relevance;

  // First the explicit preference. spec §1.2 (kindly-note extension over
  // upstream behavior) — useful in editor UIs where the user opted into a
  // dialect.
  if (preferLanguage !== undefined) {
    if (a.name === preferLanguage) return -1;
    if (b.name === preferLanguage) return 1;
  }

  // supersetOf fallback. The language whose `supersetOf` points at the other
  // sorts AFTER (so the parent language wins). Mirrors Scout §6 exactly.
  const aSuper = a.handle.compiled.supersetOf;
  const bSuper = b.handle.compiled.supersetOf;
  if (aSuper !== undefined && languageMatches(aSuper, b.name)) return 1;
  if (bSuper !== undefined && languageMatches(bSuper, a.name)) return -1;

  return 0;
}

/**
 * Case-insensitive name match for supersetOf comparison. Upstream stores
 * canonical names in `getLanguage(...).supersetOf` and compares with `===`;
 * kindly-note's canonical name uses original casing (e.g. 'JavaScript') so we
 * compare case-insensitively to allow `supersetOf: 'javascript'` to resolve
 * against either canonical-cased or alias forms.
 */
function languageMatches(supersetOf: string, candidateName: string): boolean {
  return supersetOf.toLowerCase() === candidateName.toLowerCase();
}
