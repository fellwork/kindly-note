// `createAutoDetector(highlighter)` — pure factory over a Highlighter handle.
// Returns an object with a single `detect(code, opts?)` method that iterates
// every registered language (modulo `subset` / `disableAutodetect` filters),
// scores each via `scoreLanguage`, sorts with upstream's `supersetOf` tie-
// breaker, and returns the best plus the second-best.
//
// Spec authority:
//   - §1.2 row `@kindly-note/auto-detect`: contract surface (`createAutoDetector`,
//     `AutoDetectResult`, `AutoDetectOptions`).
//   - §4 (language pack delivery): languages reach the detector via the
//     Highlighter's registry. The detector does NOT load languages itself —
//     callers register them on the Highlighter first.
//   - §9 (`CompiledLanguage`): the compiled artifact carries `disableAutodetect`
//     and `supersetOf`; the detector reads them through `RegisteredLanguage.compiled`.
//   - Scout §6: verbatim upstream `highlightAuto` reference (in
//     `src/highlight.js:685-722`). The algorithm here is a one-to-one
//     translation — same iteration shape, same comparator, plus typed inputs
//     and the kindly-note `preferLanguage` knob.

import type { Highlighter, RegisteredLanguage } from '@kindly-note/core';
import { type LanguageScore, compareScores, scoreLanguage } from './relevance.js';

/**
 * Options for `detect()`. spec §1.2 row contract.
 */
export interface AutoDetectOptions {
  /**
   * Only consider these registered language names (canonical or alias). When
   * omitted, every registered language is considered. Mirrors upstream's
   * `languageSubset` parameter at `src/highlight.js:675`.
   */
  readonly subset?: readonly string[];
  /**
   * Languages with `disableAutodetect: true` are excluded by default. Set
   * this to `true` to include them anyway. Mirrors the upstream
   * `autoDetection(name)` filter at `src/highlight.js:678` (which kindly-note
   * inverts: detection is opt-out, not opt-in).
   */
  readonly includeDisabled?: boolean;
  /**
   * If two languages tie on `relevance`, prefer this one. Useful for editor
   * "stickiness" (last selected dialect) and for resolving close-relative
   * ties more aggressively than `supersetOf`. kindly-note extension over
   * upstream's algorithm.
   */
  readonly preferLanguage?: string;
}

/**
 * The detection result. spec §1.2 row contract.
 *
 * `language` is `undefined` when no candidate scored above zero — this maps
 * to upstream's "all languages returned 0 relevance" case, where the engine
 * normally falls back to `plaintext`. kindly-note does NOT ship a built-in
 * plaintext language (per spec §1.4 — out-of-scope packages list); the
 * caller can add their own and include it in `subset` if they want a
 * fallback alias. We return `language: undefined` to make the empty case
 * explicit.
 */
export interface AutoDetectResult {
  /** Canonical name of the detected language; undefined if no match. */
  readonly language?: string;
  /** Canonical name of the runner-up; undefined when fewer than two candidates. */
  readonly secondBest?: string;
  /** Highlighted output value from the best language ('' when none). */
  readonly value: string;
  /** Numeric relevance score of the best match (0 when none). */
  readonly relevance: number;
}

/**
 * The detector handle returned by `createAutoDetector`. Stateless — every
 * `detect()` call re-evaluates against the highlighter's *current* registry
 * (so registering a language after the detector is built still works).
 */
export interface AutoDetector {
  detect(code: string, opts?: AutoDetectOptions): AutoDetectResult;
}

/**
 * Construct an auto-detector bound to a Highlighter. spec §1.2 row.
 *
 * The returned object is a thin handle; it captures only the Highlighter
 * reference. Calling `detect()` reads `hl.listLanguages()` lazily so any
 * languages registered between `createAutoDetector(hl)` and `detect(code)`
 * are picked up automatically.
 */
export function createAutoDetector(hl: Highlighter): AutoDetector {
  return Object.freeze({
    detect(code: string, opts: AutoDetectOptions = {}): AutoDetectResult {
      const candidates = collectCandidates(hl, opts);
      if (candidates.length === 0) {
        // Empty registry / fully filtered subset — graceful zero result.
        return EMPTY_RESULT;
      }

      // Score each candidate. Mirrors upstream's `.map(name => _highlight(...))`
      // (Scout §6). N highlight passes — O(N × code length).
      const scores: LanguageScore[] = candidates.map((handle) => scoreLanguage(hl, code, handle));

      // Sort — best first. We use Array.prototype.sort which is stable in
      // modern engines (V8 13.x, JSC, SpiderMonkey), so registration order
      // breaks ties beyond the supersetOf fallback.
      scores.sort((a, b) => compareScores(a, b, opts.preferLanguage));

      const best = scores[0];
      const second = scores[1];

      // best is non-null here because we returned early above when candidates
      // was empty; TypeScript can't see that, so we narrow defensively.
      if (best === undefined) return EMPTY_RESULT;

      // When the top score is zero we report `language: undefined`. Upstream
      // unshifts a synthetic `plaintext` result so the caller always gets a
      // language back; kindly-note prefers explicitness here (spec §1.4 leaves
      // plaintext to the caller).
      if (best.relevance <= 0) {
        return Object.freeze({
          value: best.result.value,
          relevance: 0,
        });
      }

      return Object.freeze({
        language: best.name,
        ...(second !== undefined && second.relevance > 0 ? { secondBest: second.name } : {}),
        value: best.result.value,
        relevance: best.relevance,
      });
    },
  });
}

/** Singleton zero result — frozen so callers can compare reliably. */
const EMPTY_RESULT: AutoDetectResult = Object.freeze({ value: '', relevance: 0 });

/**
 * Walk the highlighter registry and produce the de-duplicated candidate list
 * for a `detect()` call.
 *
 * Filtering rules (mirrors Scout §6 minus the kindly-note `subset` / typing):
 *   1. If `subset` is provided, only those names (canonical OR alias) are
 *      considered. Names that don't resolve via `getLanguage` are silently
 *      dropped (matches upstream `.filter(getLanguage)`).
 *   2. Languages with `compiled.disableAutodetect === true` are excluded
 *      unless `includeDisabled === true` (matches upstream
 *      `.filter(autoDetection)` plus the kindly-note opt-in).
 *   3. The same language is never double-scored — aliases for one language
 *      collapse to the single `RegisteredLanguage` handle (de-duped by
 *      canonical name).
 */
function collectCandidates(
  hl: Highlighter,
  opts: AutoDetectOptions,
): readonly RegisteredLanguage[] {
  const includeDisabled = opts.includeDisabled === true;
  const seen = new Set<string>();
  const out: RegisteredLanguage[] = [];

  // Names to consider: subset when given, else every registered canonical.
  const names = opts.subset !== undefined ? opts.subset : hl.listLanguages();

  for (const name of names) {
    const handle = hl.getLanguage(name);
    if (handle === undefined) continue;
    const canonical = handle.compiled.name;
    if (seen.has(canonical)) continue;
    if (!includeDisabled && handle.compiled.disableAutodetect) continue;
    seen.add(canonical);
    out.push(handle);
  }

  return out;
}
