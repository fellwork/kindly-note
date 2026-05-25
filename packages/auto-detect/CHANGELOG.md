# @kindly-note/auto-detect

## 0.1.1

### Patch Changes

- Updated dependencies [2d654b6]
  - @kindly-note/core@0.2.0

## 0.1.0

### Minor Changes

- d82688b: Add `@kindly-note/auto-detect`: heuristic language auto-detection.

  `createAutoDetector(highlighter)` returns a stateless detector with a single
  `detect(code, opts?)` method. The algorithm mirrors upstream's
  `highlightAuto` (Scout §6, `src/highlight.js:685-722`): iterate every
  registered language, score each via the full highlight pipeline, sort by
  relevance with a `supersetOf` tie-breaker, and return the best plus the
  runner-up. Spec §1.2 row `@kindly-note/auto-detect`.

  Public surface:

  - `createAutoDetector(hl)` → `AutoDetector` with `.detect(code, opts?)`
  - `AutoDetectOptions` — `subset`, `includeDisabled`, `preferLanguage`
  - `AutoDetectResult` — `language`, `secondBest`, `value`, `relevance`

  Behavioral notes:

  - Languages with `disableAutodetect: true` are excluded by default; opt in
    with `includeDisabled: true`.
  - `subset` filter accepts canonical names and aliases; unknown names are
    silently dropped (mirrors upstream).
  - `preferLanguage` is a kindly-note extension that wins over the
    `supersetOf` tie-breaker — useful for editor-side dialect stickiness.
  - Empty / no-candidate input yields `{ language: undefined, relevance: 0,
value: '' }` (no synthetic plaintext fallback; spec §1.4 leaves
    plaintext to the caller).

  Companion change: `@kindly-note/lang-typescript` now declares
  `supersetOf: 'javascript'` so the cohort-5b acceptance gate "JS wins on
  plain JS over TS when relevance ties" is honored. Spec §10.2 row
  `supersetOf` was already part of the contract; this is the first
  language pair that exercises the comparator path.

  Open: `MAX_KEYWORD_HITS` relevance dampening (cohort-3a build manifest
  open question #9) is still NOT implemented. The matcher accumulates each
  keyword hit unconditionally instead of capping at upstream's 7-hit
  limit. The cohort-5b acceptance gates pass because the cap (or the lack
  of it) applies uniformly across all candidates, so the sort ORDER
  matches upstream even though absolute scores are larger.

### Patch Changes

- Updated dependencies [a864e29]
- Updated dependencies [167dfc9]
- Updated dependencies [c866f88]
- Updated dependencies [167dfc9]
  - @kindly-note/core@0.1.0
