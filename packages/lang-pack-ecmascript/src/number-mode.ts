// EXTENDED_NUMBER_MODE — the canonical "ECMAScript-family number" Mode.
//
// spec §1.2 row `@kindly-note/lang-pack-ecmascript` mandates this surface:
//   - `EXTENDED_NUMBER_MODE` (a frozen Mode constant)
//   - `extendedNumberMode(overrides)` (a factory accepting a partial Mode
//     override and returning a fresh frozen Mode)
//
// The pattern covers everything the JSON / JS / TS / CoffeeScript / LiveScript
// number lexers want to match:
//   - `0xFF` hex literals (with optional sign)
//   - `123` / `12.3` / `.5` decimal literals
//   - `1e6` / `1.2e-3` exponents
//   - `NaN`, `Infinity`, `-Infinity`, `+Infinity`
//
// Reference shape (NOT byte-copied) is upstream's
// `src/languages/lib/ecmascript.js#EXTENDED_NUMBER_RE` /
// `EXTENDED_NUMBER_MODE`. We modernise: the Mode is deep-frozen at module-init
// (spec §0 architectural shift #2 — every helper produces a frozen Mode value),
// and the factory returns a *new* frozen Mode each call so callers can compose
// without aliasing.
//
// `relevance: 0` matches the upstream choice: number literals alone aren't a
// strong language signal, so they don't bias auto-detect.

import type { Mode } from '@kindly-note/core';
import { deepFreeze } from './internal/deep-freeze.js';

/**
 * Source string of the extended ECMAScript number regex. Exported separately
 * so language packs that need to compose it with surrounding context (e.g.,
 * `regex.concat(LOOKAHEAD, EXTENDED_NUMBER_RE)`) can grab the source without
 * unwrapping the Mode.
 */
export const EXTENDED_NUMBER_RE =
  '([-+]?)(\\b0[xX][a-fA-F0-9]+|(\\b\\d+(\\.\\d*)?|\\.\\d+)([eE][-+]?\\d+)?)|NaN|[-+]?Infinity';

/**
 * The canonical "ECMAScript family number" Mode. Frozen at module-init.
 *
 * Used by:
 *   - `@kindly-note/lang-json` (JSON numbers; numbers are the only literal
 *     form besides the keyword literals `true`/`false`/`null`).
 *   - `@kindly-note/lang-javascript` / `lang-typescript` (number literals;
 *     superset including hex, exp, ±Infinity, NaN).
 *   - `@kindly-note/lang-coffeescript` / `lang-livescript` for parity with
 *     the JS family.
 *
 * The Mode is referentially identity-stable across imports: two callers see
 * the same `EXTENDED_NUMBER_MODE` reference. Both consumers can safely place
 * it inside their own frozen `contains` arrays — the matcher in
 * `@kindly-note/core` never mutates Modes (spec §9.2: "shared-mode helpers …
 * would corrupt each other's state" — explicitly avoided here by deep
 * freezing).
 */
export const EXTENDED_NUMBER_MODE: Mode = deepFreeze<Mode>({
  scope: 'number',
  match: EXTENDED_NUMBER_RE,
  relevance: 0,
});

/**
 * Build a fresh `EXTENDED_NUMBER_MODE` Mode with caller-supplied overrides
 * merged on top of the defaults. Returns a *new* deep-frozen Mode each call.
 *
 * Useful when a language wants the standard ECMAScript number pattern but
 * with a different scope (e.g., `'literal'` for relevance tuning), a non-zero
 * relevance, or extra contained sub-modes.
 *
 * Spec §0 architectural shift #2: helpers produce frozen Modes; the source
 * mode `EXTENDED_NUMBER_MODE` is never mutated. Callers can safely re-call the
 * factory in a tight loop — every output is independent.
 *
 * @example
 *   const TS_NUMBER = extendedNumberMode({ scope: 'literal', relevance: 1 });
 */
export function extendedNumberMode(overrides: Partial<Mode> = {}): Mode {
  return deepFreeze<Mode>({
    scope: 'number',
    match: EXTENDED_NUMBER_RE,
    relevance: 0,
    ...overrides,
  });
}
