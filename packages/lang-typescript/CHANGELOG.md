# @kindly-note/lang-typescript

## 0.1.1

### Patch Changes

- Updated dependencies [2d654b6]
  - @kindly-note/core@0.2.0
  - @kindly-note/lang-helpers@0.1.1
  - @kindly-note/lang-javascript@0.1.1
  - @kindly-note/lang-pack-ecmascript@0.1.1

## 0.1.0

### Minor Changes

- 167dfc9: Initial release of `@kindly-note/lang-typescript`: the TypeScript / TSX language definition. The default export is a deep-frozen `LanguageDefinition` produced via the typed `extendLanguage()` API on top of `@kindly-note/lang-javascript` (spec §0 architectural shift #5; spec §8.2 THE KEYSTONE; spec §8.2.2 worked example). Aliases: `ts`, `tsx`, `mts`, `cts`. **This package is the keystone end-to-end proof point**: TypeScript inherits from JavaScript through the typed `extend()` API — never through array-mutation of an `exports` field, never through reaching into the parent's internal `contains` array. The 18-test `keystone.test.ts` proves the parent is untouched, frozen-array runtime push throws, decorators are visible in TS but not in JS, TS-specific keywords (`interface`, `type`, etc.) are recognised, generics tokenize without illegal-syntax, and a 20-line real-world TS snippet renders with at least 5 distinct `kn-*` CSS classes.

### Patch Changes

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

- 167dfc9: Workspace src-resolution config — DX fix.

  Adds a root `vitest.shared.ts` that maps every `@kindly-note/*` import to the package's `packages/*/src/index.ts` for tests (plus the `core/regex` and `core/errors` subpath imports). Every per-package `vitest.config.ts` now extends the shared config via `mergeConfig`. Build-time resolution (rolldown for production consumers) is unchanged.

  Resolves the cohort-3b state-file lesson "Workspace src-resolution is a real v0 DX issue." Before this change, tests for downstream packages (e.g. `lang-json` consuming `lang-pack-ecmascript`'s runtime `EXTENDED_NUMBER_MODE` export) failed until `bun run build` ran, because Bun's workspace symlinks resolve via `package.json#main` → `dist/index.js`. After this change, `bun run test` works on a fresh checkout without any prior build step.

  Verified: deleting all `packages/*/dist/` directories and running `bun run test` from the repo root produces 235/235 passing tests across all 7 packages.

- Updated dependencies [a864e29]
- Updated dependencies [167dfc9]
- Updated dependencies [1d1632c]
- Updated dependencies [167dfc9]
- Updated dependencies [1366dc3]
- Updated dependencies [c866f88]
- Updated dependencies [167dfc9]
  - @kindly-note/core@0.1.0
  - @kindly-note/lang-helpers@0.1.0
  - @kindly-note/lang-javascript@0.1.0
  - @kindly-note/lang-pack-ecmascript@0.1.0
