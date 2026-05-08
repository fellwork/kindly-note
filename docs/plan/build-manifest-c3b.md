# Build manifest — Cohort 3b: `@kindly-note/lang-pack-ecmascript` + `@kindly-note/lang-json`

**Date:** 2026-05-08
**Builder:** Cohort 3b (kindly-note modernize track)
**Branch:** `feat/cohort-3b`
**Spec contract:** `docs/plan/architect-spec.md` (§0, §1.2 rows for both
packages, §5, §9, §12)
**Depends on:** `@kindly-note/core` (cohort 1 + 3a matcher), `@kindly-note/lang-helpers`
(cohort 2a), `@kindly-note/emitters-html` (cohort 2b — used in tests).

This cohort is the first end-to-end exercise of the cohort-3a deepened
matcher (`packages/core/src/internal/matcher.ts`). lang-json validates spec §0
shifts #1 (languages-as-values) and #2 (compile-at-register-time, immutable).

---

## Scope summary

Two packages on a single feature branch — they're tightly coupled
(`@kindly-note/lang-json` depends on `@kindly-note/lang-pack-ecmascript`'s
`EXTENDED_NUMBER_MODE`).

### Package A — `@kindly-note/lang-pack-ecmascript`

Shared mode helpers + constant lists for the ECMAScript family
(JSON / JS / TS / CoffeeScript / LiveScript). Pure data + factory functions.
spec §1.2 mandates the surface: `IDENT_RE`, `KEYWORDS`, `LITERALS`,
`BUILT_INS`, `BUILT_IN_VARIABLES`, `EXTENDED_NUMBER_MODE`,
`extendedNumberMode()`.

### Package B — `@kindly-note/lang-json`

The JSON language definition. Default exports a deep-frozen
`LanguageDefinition`. Aliases: `json`, `jsonc`, `json5`. spec §1.2 — the
"first real `@kindly-note/lang-*` package" that exercises the matcher.

---

## Files created

### Workspace-level
- `tsconfig.json` (root) — added `{ path: './packages/lang-pack-ecmascript' }`
  and `{ path: './packages/lang-json' }` to `references` so `tsc -b` builds
  both new packages.

### `packages/lang-pack-ecmascript/`
- `package.json` — `@kindly-note/lang-pack-ecmascript` 0.0.1, ESM,
  `sideEffects: false`, single root export. Depends on `@kindly-note/core`
  (types) + `@kindly-note/lang-helpers` (re-exports `IDENT_RE`).
- `tsconfig.json` — references `../core` and `../lang-helpers`.
- `tsconfig.test.json` — sibling for Vitest; pulls in `tests/**/*` plus `node`
  types.
- `rolldown.config.ts` — single-entry build, `platform: 'neutral'`,
  `external: [/^@kindly-note\//]`, `dts()` plugin.
- `vitest.config.ts` — `environment: 'node'`.

### `packages/lang-pack-ecmascript/src/`
- `index.ts` — public surface; named exports of the §1.2-mandated symbols
  plus `EXTENDED_NUMBER_RE`. No top-level statements other than re-exports.
- `constants.ts` — `KEYWORDS`, `LITERALS`, `BUILT_INS`, `BUILT_IN_VARIABLES`
  (and the private `TYPES` / `ERROR_TYPES` / `BUILT_IN_GLOBALS` lists that
  compose into `BUILT_INS`). All `Object.freeze`d. Re-exports `IDENT_RE` from
  `@kindly-note/lang-helpers`.
- `number-mode.ts` — `EXTENDED_NUMBER_RE` (regex source), `EXTENDED_NUMBER_MODE`
  (deep-frozen Mode), `extendedNumberMode(overrides)` (factory returning a
  fresh frozen Mode each call).
- `internal/deep-freeze.ts` — small recursive freezer. Distinct from the
  freezers in `@kindly-note/core/language.ts` and
  `@kindly-note/lang-helpers/internal/deep-freeze.ts` (same rationale as
  cohort 2a's open question #6 — duplicating six lines is cheaper than
  crossing the types-only edge).

### `packages/lang-pack-ecmascript/tests/`
- `constants.test.ts` — 14 tests: frozen-array gate (acceptance #2 of
  dispatch §D), content checks (canonical ECMAScript surface), `IDENT_RE`
  source-string + identity-with-lang-helpers parity check.
- `number-mode.test.ts` — 18 tests: frozen Mode constant, regex coverage
  (integers, floats, exponents, hex, NaN, ±Infinity, rejection of garbage),
  factory invariants (fresh frozen Mode, no-aliasing, no-mutation-of-
  constant).

**Subtotal: 32 tests, all passing.**

### `packages/lang-json/`
- `package.json` — `@kindly-note/lang-json` 0.0.1, ESM, `sideEffects: false`,
  single root export. Depends on `@kindly-note/core`,
  `@kindly-note/lang-helpers`, `@kindly-note/lang-pack-ecmascript`. Dev-deps
  on `@kindly-note/emitters-html` (used by one test for the htmlEmitter
  preservation gate).
- `tsconfig.json` — references the three runtime deps.
- `tsconfig.test.json`, `rolldown.config.ts`, `vitest.config.ts` — same
  template.

### `packages/lang-json/src/`
- `index.ts` — single-file LanguageDefinition. ATTRIBUTE / PUNCTUATION /
  LITERALS_MODE Modes inline (small grammar; no benefit from splitting). Uses
  `apostropheString`, `quoteString`, `cLineComment`, `cBlockComment` from
  `@kindly-note/lang-helpers` and `EXTENDED_NUMBER_MODE` from
  `@kindly-note/lang-pack-ecmascript`. Wrapped in `defineLanguage()` so the
  whole tree is deep-frozen at module-init.

### `packages/lang-json/tests/`
- `json.test.ts` — 18 tests across 7 describe blocks:
  1. Frozen LanguageDefinition (acceptance #2)
  2. End-to-end highlight (acceptance #3 — the proof point: every JSON
     token type gets the correct scope)
  3. Alias resolution (acceptance #4 — `jsonc` / `json5` resolve to the
     same handle as `json`)
  4. Nested objects/arrays (acceptance #5 — exercises the cohort-3a
     deepened matcher's nested-mode descent)
  5. Whitespace + EOL preservation (acceptance #6)
  6. Compilation immutability (acceptance #7)
  7. Sanity — illegal handling, empty arrays/objects, number variants

**Subtotal: 18 tests, all passing.**

### `.changeset/`
- `lang-pack-ecmascript-initial.md` — `'@kindly-note/lang-pack-ecmascript': minor`
  for the initial 0.0.1 release.
- `lang-json-initial.md` — `'@kindly-note/lang-json': minor` for the initial
  0.0.1 release.

---

## Public exports

### `@kindly-note/lang-pack-ecmascript`

#### Spec §1.2 mandate (named)
- `IDENT_RE: string` — re-exported from `@kindly-note/lang-helpers` (so the
  two packages stay in lock-step on the canonical identifier-regex source).
- `KEYWORDS: readonly string[]` — frozen.
- `LITERALS: readonly string[]` — frozen. Includes JSON's narrower triple
  (`true`/`false`/`null`) plus JS extras (`undefined`/`NaN`/`Infinity`).
- `BUILT_INS: readonly string[]` — frozen. Composite of GLOBALS + TYPES +
  ERROR_TYPES.
- `BUILT_IN_VARIABLES: readonly string[]` — frozen. `this`, `super`,
  `arguments`, `console`, `window`, `document`, etc.
- `EXTENDED_NUMBER_MODE: Mode` — deep-frozen Mode constant.
- `extendedNumberMode(overrides?: Partial<Mode>): Mode` — factory; returns a
  fresh frozen Mode each call.

#### Adjacent named export (convenience)
- `EXTENDED_NUMBER_RE: string` — the source string of
  `EXTENDED_NUMBER_MODE.match`. Exposed so language packs that need to compose
  the regex with surrounding context (`regex.concat(LOOKAHEAD,
  EXTENDED_NUMBER_RE)`) don't unwrap the Mode.

### `@kindly-note/lang-json`

- `default`: `LanguageDefinition` — deep-frozen at module init.
  - `name: 'JSON'`
  - `aliases: ['json', 'jsonc', 'json5']`
  - `keywords: { literal: ['true', 'false', 'null'] }`
  - `contains`: ATTRIBUTE → PUNCTUATION → apostropheString → quoteString →
    LITERALS_MODE → EXTENDED_NUMBER_MODE → cLineComment → cBlockComment
  - `illegal: '\\S'` (strict — non-whitespace outside the recognised modes
    fires `IllegalSyntaxError` → `result.illegal: true`)

---

## Acceptance gates (dispatch §D)

| # | Gate | Where verified | Status |
|---|---|---|---|
| 1 | All 151 prior tests still pass | `bun run test` workspace-wide before/after every commit | ✅ PASS — 151 prior + 50 new = 201 |
| 2 | lang-pack-ecmascript exports work; `Object.isFrozen(EXTENDED_NUMBER_MODE)` is true | `tests/constants.test.ts` (frozen-array suite + IDENT_RE), `tests/number-mode.test.ts` (frozen Mode constant) | ✅ PASS |
| 3 | lang-json end-to-end: every JSON token type scoped correctly | `tests/json.test.ts` "highlights a flat JSON object with every token type" (single test asserts attr / string / number / literal scopes on a single representative input matching the dispatch's example) | ✅ PASS |
| 4 | JSON aliases resolve | `tests/json.test.ts` "lang-json — alias resolution" suite (4 tests: `jsonc` and `json5` resolve to same handle as `json`; case-insensitive; `listLanguages` returns canonical name) | ✅ PASS |
| 5 | Nested-object correctness (matcher cohort-3a exercise) | `tests/json.test.ts` "lang-json — nested objects and arrays" suite (2 tests: deeply nested object/array + array-of-objects) | ✅ PASS — the deepened matcher correctly descends into nested objects |
| 6 | Whitespace + EOL preservation | `tests/json.test.ts` "lang-json — whitespace and EOL preservation" suite (2 tests: TokenStream walker + htmlEmitter render preserve `\n`/`\t`/spaces) | ✅ PASS |
| 7 | Compilation immutability | `tests/json.test.ts` "lang-json — compilation immutability" + the existing core-package tests/highlighter.test.ts compilation-timing acceptance | ✅ PASS |
| 8 | No node-builtins, no DOM, no `hljs-` defaults in src/ | `grep -E "^import .*['\"]node:|process\.|fs\.|path\.|require\(|document\.|window\.|hljs-"` in both packages' src trees | ✅ PASS — zero matches |

---

## Verification log

All commands run from repo root, `bun@1.3.8`, after the final commit.

| Command | Status |
|---|---|
| `bun install` | ✅ Resolved 246 packages, 0 errors. |
| `bun run typecheck` (`tsc -b`) | ✅ Clean — 0 errors, 0 warnings. All 5 packages build cleanly via project references. |
| `bun run --filter '@kindly-note/lang-pack-ecmascript' build` (rolldown) | ✅ Produces `dist/index.js` (6.56 kB) + `dist/*.d.ts` + sourcemaps. ~370ms. |
| `bun run --filter '@kindly-note/lang-pack-ecmascript' test` (Vitest) | ✅ 32/32 across 2 test files. |
| `bun run --filter '@kindly-note/lang-json' build` (rolldown) | ✅ Produces `dist/index.js` (3.61 kB) + `dist/*.d.ts` + sourcemaps. ~375ms. |
| `bun run --filter '@kindly-note/lang-json' test` (Vitest) | ✅ 18/18 in 1 test file. |
| `bun run test` (workspace fan-out) | ✅ 201/201 across 5 packages (56 core + 31 emitters-html + 64 lang-helpers + 32 lang-pack-ecmascript + 18 lang-json). |
| `bun run lint` (Biome over the whole repo) | ✅ Clean — 69 files, 0 errors. |
| grep node-builtins / DOM / hljs- in lang-pack-ecmascript/src | ✅ No matches. |
| grep node-builtins / DOM / hljs- in lang-json/src | ✅ No matches. |

---

## Test count

| Package | Before | After | Delta |
|---|---|---|---|
| `@kindly-note/core` | 56 | 56 | 0 |
| `@kindly-note/lang-helpers` | 64 | 64 | 0 |
| `@kindly-note/emitters-html` | 31 | 31 | 0 |
| `@kindly-note/lang-pack-ecmascript` | — | **32** | +32 |
| `@kindly-note/lang-json` | — | **18** | +18 |
| **Workspace total** | **151** | **201** | **+50** |

---

## Matcher exercise — what cohort-3b proved

The dispatch named JSON as the "smallest real-world exercise of the deepened
matcher" (cohort 3a). Sample-based gates 3 / 5 are the ones that actually
push the matcher past where its own acceptance tests went:

- **Gate 3 (full-grammar token-stream walk).** Highlighting
  `{"a": 1, "b": "hi", "c": true, "d": null, "e": [1, 2.5, -3]}` produces a
  TokenStream where `attr`, `string`, `number`, `literal`, and `punctuation`
  scopes all appear at the right positions. The matcher correctly:
  - opens / closes ATTRIBUTE for property keys (with `(?=\s*:)` lookahead,
    consuming only the quoted-string portion of the lexeme);
  - opens / closes LITERALS_MODE per `beginKeywords` `(?:true|false|null)\b`
    expansion handled in `compile.ts` (cohort 3a's keyword-detection path);
  - drives EXTENDED_NUMBER_MODE through the multi-regex union for
    `1`, `2.5`, `-3` (the `match`-only Mode form, no `end`).
- **Gate 5 (nested descent).** `{"a": {"b": [1, {"c": 2}]}}` is a real
  three-deep recursive structure. Although the JSON grammar doesn't use
  explicit child-mode push/pop (every JSON token is a sibling at the root,
  thanks to `match`-only modes that synthetic-end immediately), the matcher
  must:
  - keep each PUNCTUATION emit independent (no leaking between `[` and `]`);
  - re-enter the multi-regex union for every position;
  - and crucially: NOT let `illegal: '\\S'` fire on whitespace between
    structural tokens (whitespace falls into the root buffer; no contained
    begin matches; the per-frame `illegal` regex matches `\\S` only at the
    next non-whitespace char which IS already claimed by a contained begin).

Both gates passed first-try. **No matcher bug surfaced in cohort 3b.** The
deepened matcher (cohort 3a) is sound for JSON's grammar shape.

---

## Open questions / spec ambiguities

These are surfaced explicitly per the dispatch's "no silent revisions" rule.
Each has a documented default with a code comment citing the spec.

### #1 — IDENT_RE ownership: lang-helpers OR lang-pack-ecmascript?

**Spec position:** §1.2 lists `IDENT_RE` as a public export of BOTH
`@kindly-note/lang-helpers` and `@kindly-note/lang-pack-ecmascript`. Same
constant, two homes.

**Cohort 3b decision:** `@kindly-note/lang-helpers` owns the literal value
(declared in `regex-constants.ts`); `@kindly-note/lang-pack-ecmascript`
re-exports the SAME identifier (`export { IDENT_RE } from
'@kindly-note/lang-helpers'`). A test in `constants.test.ts` asserts identity
(`IDENT_RE === helpers.IDENT_RE`) so they CANNOT drift.

**Why this way:** lang-helpers is the lower-level helper home; ECMAScript-
specific consumers (JS / TS / CoffeeScript / LiveScript) reach for IDENT_RE
through lang-pack-ecmascript per §8.2.1's worked example
(`ECMAScript.IDENT_RE`). Re-export keeps both surfaces honored without a
forked literal. **Decision required from Architect:** confirm re-export over
inlining. My recommendation: re-export — duplicate literal is the bug class
spec §0 shift #2 is built to prevent.

### #2 — JSON `keywords: { literal: [...] }` AND `LITERALS_MODE` redundancy

**Upstream pattern:** json.js declares BOTH `keywords: { literal: LITERALS }`
on the language AND a separate `LITERALS_MODE` with
`beginKeywords: LITERALS.join(' ')`. Upstream comment explains: "using a
mode here allows us to use the very tight `illegal: \\S` rule later" — the
mode-based match runs BEFORE the per-frame illegal sweep, so plain
`true`/`false`/`null` survive.

**Cohort 3b decision:** kept both, mirroring upstream. The language-level
`keywords` is technically redundant in our matcher (every literal is caught
by LITERALS_MODE first), but it's harmless and matches upstream's auto-detect
heuristics for cohort 4+. Tests confirm `literal`-scoped emit comes from
LITERALS_MODE (not from the language-level keyword tokenizer), but the
language-level keywords are still present for downstream parity.

**Followup:** When `@kindly-note/auto-detect` lands (cohort 4+), revisit
whether the language-level `keywords` adds relevance score on a JSON match.
If yes, keep; if no, drop and document a divergence from upstream.

### #3 — JSONC / JSON5 surface unification

**Spec position:** §1.2 row says "covers `jsonc`, `json5` aliases" — a single
`LanguageDefinition` aliased three ways.

**Cohort 3b decision:** unified surface. JSONC adds line/block comments;
JSON5 additionally relaxes single-quoted strings, trailing commas, hex
literals, etc. The cohort-3b LanguageDefinition accepts ALL of these — JSON5
single-quoted keys via `apostropheString`, comments via `cLineComment` /
`cBlockComment`, hex literals via `EXTENDED_NUMBER_MODE`. Standard JSON
inputs are still highlighted correctly because the JSON5-specific lexemes
simply never appear.

**Trade-off:** strict-JSON consumers will see JSONC/JSON5 inputs as `illegal:
false` even though they're not valid RFC-8259 JSON. This matches upstream's
permissive single-grammar-three-aliases behavior.

**Followup:** if a consumer needs strict JSON-only validation, ship a
`@kindly-note/lang-json-strict` later (cohort 5+) with comments and JSON5
features removed. Spec §10 (out-of-scope for v1) leaves room for it.

### #4 — Trailing-decimal `12.` matches in EXTENDED_NUMBER_RE

The upstream regex source `\\d+(\\.\\d*)?` allows `12.` (digit-then-dot, no
trailing digits). My `number-mode.test.ts` documents this as "matches" since
the regex source mirrors upstream verbatim. Strict JSON forbids `12.` (it
requires `12` or `12.0`). The matcher / language definition currently accepts
it.

**Followup:** see open question #3 — `lang-json-strict` would tighten this.
For v0, the looseness matches upstream and the dispatch's "byte-for-byte
fixture compat is NOT a goal" round-1 user lock.

### #5 — JSON's `LITERALS_MODE` synthetic-end behavior is matcher-implicit

LITERALS_MODE has `beginKeywords` but no `end`. cohort 3a's `compile.ts`
inserts a synthetic `\\B|\\b` end pattern when `end` is omitted on a non-root
mode (compile.ts:181-186). The matcher then opens the literal mode on
`true`/`false`/`null` begin, immediately matches `\\b` as the synthetic end,
and pops. This produces the expected `<span class="kn-literal">true</span>`.

**Why flag it:** the behavior is correct but relies on a subtle detail of the
compile step. If a future cohort changes how synthetic ends work,
LITERALS_MODE may regress silently. The acceptance test
`tests/json.test.ts > literals → 'literal' scope` is the canary.

### #6 — `ATTRIBUTE` regex contains internal capture groups

The ATTRIBUTE begin regex
`/(("(\\.|[^\\"\r\n])*")|('(\\.|[^\\'\r\n])*'))(?=\s*:)/`
has multiple internal capture groups (5+). `MultiRegex` (cohort 3a's
`countMatchGroups` path) handles this correctly — the wrapper sentinel group
is added at position 1, and the rule's own groups become positions 2..6.
Branch detection still works because the sentinel at position 1 is
non-undefined when the alternation fires.

This is the FIRST language pack to put a multi-capture-group regex into the
union. The cohort-3a build manifest open question #4 (beginScope /
multi-capture-group emit) explicitly says "Cohort 3b (lang-pack-ecmascript)
likely needs this" — but JSON does NOT need it (ATTRIBUTE uses a single
whole-mode `scope: 'attr'`, not a per-capture-group `scopeMap`). The matcher
exercise still validates that the multi-regex union handles internal groups
correctly without confusing branch detection.

**Status:** No-issue. Cohort 4 (lang-javascript / lang-typescript) will be
the first to actually exercise per-capture-group scope emit.

---

## What changed from the spec verbatim

- **None.** Spec §1.2 mandated the lang-pack-ecmascript surface and the
  lang-json shape; both are implemented exactly as listed. Where the
  underlying grammar was ambiguous (open questions above), I picked a
  documented default with code-comment citation. No silent revisions.

- **One adjacent export added (not in §1.2 verbatim):** `EXTENDED_NUMBER_RE`
  (the source string of EXTENDED_NUMBER_MODE.match). Justification: language
  packs that need to compose the number regex with `regex.concat(...)` (per
  spec §8.2 worked examples) want the source without unwrapping the Mode.
  Same precedent as lang-helpers exporting `BACKSLASH_ESCAPE` source-strings
  alongside the full Mode (build-manifest-c2a.md open question #1).

---

## Branch state

- Branch: `feat/cohort-3b` (from `main` at `7527caf`).
- Logical commits (suggested order):
  1. `@kindly-note/lang-pack-ecmascript` package (constants + number-mode +
     deep-freeze + tests + tsconfig wiring).
  2. `@kindly-note/lang-json` package (LanguageDefinition + tests + tsconfig
     wiring).
  3. Build manifest + changesets.
- Untracked at start: `node_modules/`, `dist/`, `bun.lock` (gitignored).
- The branch builds on cohorts 1+2+3a — `bun run test` runs all 201 tests
  across 5 packages and they all pass.

Ready for cohort 4 — `@kindly-note/lang-javascript` + `@kindly-note/lang-typescript`,
the keystone end-to-end proof point. Cohort 4 will be the first to exercise
per-capture-group `beginScope` (cohort-3a open question #4) and the typed
`extendLanguage` API (the "Cat 2 keystone" — TS extending JS via
`extensible: JavaScriptExtensionPoints`).
