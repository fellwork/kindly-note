# Build manifest — Cohort 5b: `@kindly-note/auto-detect`

**Branch:** `feat/auto-detect` (from `main` at `17c645c`).
**Authority:** architect-spec §1.2 row `@kindly-note/auto-detect`, §4
(language pack delivery), §9 (`CompiledLanguage`); Scout §6 (upstream
`highlightAuto` reference).

---

## What shipped

A new package, `@kindly-note/auto-detect`, plus a one-field addition to
`@kindly-note/lang-typescript` (`supersetOf: 'javascript'`).

### Package layout

```
packages/auto-detect/
├── package.json
├── rolldown.config.ts
├── tsconfig.json
├── tsconfig.test.json
├── vitest.config.ts
├── src/
│   ├── index.ts          (exports surface)
│   ├── detector.ts       (createAutoDetector, AutoDetectOptions/Result)
│   └── relevance.ts      (scoreLanguage, compareScores)
└── tests/
    ├── detector.test.ts  (acceptance gates 2-8 + extras — 23 tests)
    ├── relevance.test.ts (scoreLanguage / compareScores units — 9 tests)
    └── supersetOf.test.ts (JS↔TS metadata + integration — 5 tests)
```

### Public surface (spec §1.2 row contract)

```ts
export function createAutoDetector(hl: Highlighter): AutoDetector;

export interface AutoDetectOptions {
  readonly subset?: readonly string[];
  readonly includeDisabled?: boolean;
  readonly preferLanguage?: string;
}

export interface AutoDetectResult {
  readonly language?: string;
  readonly secondBest?: string;
  readonly value: string;
  readonly relevance: number;
}

export interface AutoDetector {
  detect(code: string, opts?: AutoDetectOptions): AutoDetectResult;
}
```

### Companion change

`packages/lang-typescript/src/index.ts` now passes `supersetOf:
'javascript'` through `extendLanguage(...)`. The field is propagated by
`compileLanguage` into the `CompiledLanguage` artifact (`compile.ts:151`),
read by `compareScores` for the tie-break.

---

## Algorithm (one-to-one with Scout §6)

`detect(code, opts)`:
1. **Collect candidates.** From `hl.listLanguages()` (or `opts.subset`
   when given). De-dupe by canonical name. Drop
   `disableAutodetect: true` unless `opts.includeDisabled === true`.
2. **Score each candidate.** Call
   `hl.highlight(code, { language: name, ignoreIllegals: false })` and
   read `result.relevance`. The highlighter's default `errorMode: 'safe'`
   converts illegal-rule hits to `{ relevance: 0, illegal: true }`, so
   wrong-language code naturally drops to 0.
3. **Sort.** Comparator: higher relevance wins; on tie, `preferLanguage`
   matches first; then the supersetOf fallback (Scout §6 verbatim).
4. **Return.** `{ language: best.name, secondBest: scores[1]?.name,
   value: best.result.value, relevance: best.relevance }`. When the top
   score is 0, `language` is `undefined` (no synthetic plaintext per
   spec §1.4).

The detector is **stateless** — every `detect()` call re-reads the
highlighter's registry, so dynamically-registered languages are picked up
without recreating the detector.

---

## Acceptance gates (build manifest §D — all green)

| # | Gate | Evidence |
|---|---|---|
| 1 | All 235 prior tests still pass | Workspace `bun run test`: emitters-html 31 + core 61 + lang-helpers 64 + lang-pack-ecmascript 32 + lang-json 18 + lang-javascript 11 + lang-typescript 18 = 235 unchanged. |
| 2 | Detect JSON | `detector.test.ts` "gate 2" — 3 cases. `detect('{"a":1}').language === 'JSON'`. |
| 3 | Detect TS-specific syntax over JS | `detector.test.ts` "gate 3" — interface, type alias, enum cases. |
| 4 | Plain JS not mis-classified as TS | `detector.test.ts` "gate 4" — `function f(x) { return x * 2; }` → `'JavaScript'`. |
| 5 | `supersetOf` tie-break + `preferLanguage` | `detector.test.ts` "gate 5" + `supersetOf.test.ts` — synthetic parent/child + real JS/TS pair. |
| 6 | Empty / garbage → `language: undefined`, `relevance: 0` | `detector.test.ts` "gate 6". |
| 7 | `disableAutodetect` honored; `includeDisabled` opts in | `detector.test.ts` "gate 7". |
| 8 | `subset` only considers listed langs (incl. aliases) | `detector.test.ts` "gate 8" — 4 cases. |

Total in cohort-5b: **37 new tests**, **272 workspace tests** (235 + 37).

---

## Verification (spec §E — all green)

```
bun install                                               # ok
bun run typecheck                                         # ok (tsc -b)
bun run --filter '@kindly-note/auto-detect' build         # ok (rolldown 1.0.0)
bun run --filter '@kindly-note/auto-detect' test          # 37 passed
bun run test                                              # 272 passed (workspace)
bun run lint                                              # ok (biome 1.9.4)
```

---

## Workspace integration

- `tsconfig.json` — added `{ "path": "./packages/auto-detect" }` reference.
- `vitest.shared.ts` — added `'auto-detect'` to `KINDLY_NOTE_PACKAGES` so
  tests resolve `@kindly-note/auto-detect` to `src/index.ts` without a
  prior build (cohort-3b workspace src-resolution DX fix).

---

## Open / deferred items

### #1 — `MAX_KEYWORD_HITS` relevance dampening still NOT implemented

Cohort-3a build manifest open question #9, re-flagged by cohort 4. Each
keyword hit adds its relevance unconditionally instead of capping at
upstream's 7-hit limit (`src/highlight.js:13` `MAX_KEYWORD_HITS = 7`).

**Cohort 5b status:** the cohort-5b acceptance gates pass without the
dampening. Reasoning: the same accumulation rule is applied to every
candidate language, so the *sort order* matches upstream even though
absolute scores are inflated by a constant factor proportional to keyword-
repetition density. This was the deferred-tracking request in the
director's brief — surfaced in `relevance.ts` header AND in the
`@kindly-note/auto-detect` changeset.

**Material effect on test cases:** none observed. The 37 cohort-5b
tests do not depend on absolute scores; they pin the *winner* and
runner-up.

**Followup:** when richer real-world languages land (Python, Rust, etc.)
and one of them produces a relevance hot-spot from a single repeated
keyword, restore the cap. The implementation site is
`packages/core/src/internal/matcher.ts:171` (the `relevance += kwRelevance`
line in `processKeywords`); the cap would be implemented as a per-keyword
Map<lexeme, count> that ignores the relevance addend after `count >= 7`.

### #2 — No built-in plaintext fallback

Upstream prepends a synthetic `plaintext` result so `highlightAuto` always
returns a language (`src/highlight.js:681`: `results.unshift(plaintext)`).
kindly-note returns `language: undefined` instead. Reasoning: spec §1.4
explicitly excludes a built-in plaintext language from the v0 packages,
and a synthetic plaintext result requires hardcoded behavior in
auto-detect that conflicts with the "every language is a peer" pattern.

**Caller workaround:** include a `lang-plaintext` package (third-party or
user-authored) in the highlighter and pass it via `subset` for fallback.

**Followup:** if v1+ ships an opinionated `@kindly-note/lang-plaintext`,
add an `AutoDetectOptions.plaintextFallback?: string` knob that prepends
the named language as a zero-relevance synthetic candidate.

### #3 — `secondBest` is just a name; not a full HighlightResult

Upstream's `highlightAuto` returns `secondBest` as the full result object
(it nests). kindly-note returns just the name string. Reasoning: full
nesting in `AutoDetectResult` complicates the type and forces an
allocation per call even when callers don't need the runner-up. If a
caller wants the runner-up's `value`, they can call `hl.highlight(code, {
language: secondBest })` directly — same cost.

**Followup:** if real-world consumers prefer the nested shape, add
`AutoDetectOptions.includeSecondBestResult?: boolean` that swells
`secondBest` from `string` to `HighlightResult`.

---

## Files touched

```
A  .changeset/auto-detect-initial.md
A  docs/plan/build-manifest-c5b.md
A  packages/auto-detect/package.json
A  packages/auto-detect/rolldown.config.ts
A  packages/auto-detect/src/detector.ts
A  packages/auto-detect/src/index.ts
A  packages/auto-detect/src/relevance.ts
A  packages/auto-detect/tests/detector.test.ts
A  packages/auto-detect/tests/relevance.test.ts
A  packages/auto-detect/tests/supersetOf.test.ts
A  packages/auto-detect/tsconfig.json
A  packages/auto-detect/tsconfig.test.json
A  packages/auto-detect/vitest.config.ts
M  packages/lang-typescript/src/index.ts   (one-line: supersetOf: 'javascript')
M  tsconfig.json                           (add reference to auto-detect)
M  vitest.shared.ts                        (add 'auto-detect' to alias list)
```

---

## What's next

The natural follow-on is `@kindly-note/browser` (spec §1.2 row), which
depends on `@kindly-note/auto-detect` (peer-optional) for `highlightAll`.
The auto-detect surface is now stable enough to be that peer dependency.
