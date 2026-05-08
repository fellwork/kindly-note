# Build manifest — Cohort 4 (THE KEYSTONE): `@kindly-note/lang-javascript` + `@kindly-note/lang-typescript`

**Date:** 2026-05-08
**Builder:** Cohort 4 (kindly-note modernize track)
**Branch:** `feat/cohort-4-keystone`
**Spec contract:** `docs/plan/architect-spec.md` (§0 — 8 architectural shifts; §1.2 rows for both packages; §2 — plugin protocol; §5 — emitter; §8.2 THE KEYSTONE; §8.2.1 / §8.2.2 worked examples; §9 — compilation timing).
**Depends on:** `@kindly-note/core` (cohorts 1 + 3a + this cohort's matcher/extendLanguage enhancements), `@kindly-note/lang-helpers` (cohort 2a), `@kindly-note/lang-pack-ecmascript` (cohort 3b), `@kindly-note/emitters-html` (cohort 2b — used in tests).

This cohort is **THE KEYSTONE** — the architectural bet of the entire kindly-note project. If TypeScript can extend JavaScript via the typed `extendLanguage()` API without mutating the parent, spec §8.2 is fully validated end-to-end. **All 18 keystone tests pass.**

---

## Scope summary

Two language packages on a single feature branch — they're tightly coupled
(`@kindly-note/lang-typescript` depends on `@kindly-note/lang-javascript`'s
typed `JavaScriptExtensionPoints` extension surface) — plus two supporting
infrastructure changes that landed first because the keystone packages would
not have worked without them.

### Package A — `@kindly-note/lang-javascript`

The JavaScript / JSX / MJS / CJS language definition. Default-exports a
deep-frozen `LanguageDefinition<JavaScriptExtensionPoints>`. Aliases: `js`,
`jsx`, `mjs`, `cjs`. Publishes `extensible: { PARAMS_CONTAINS, CLASS_REFERENCE }`
for downstream extenders.

### Package B — `@kindly-note/lang-typescript`

The TypeScript / TSX language definition. Built ENTIRELY through the typed
`extendLanguage(javascript, ...)` API. No upstream-style array mutation.
Aliases: `ts`, `tsx`, `mts`, `cts`. Adds DECORATOR to PARAMS_CONTAINS via the
typed `extendPoints` transform; adds NAMESPACE / INTERFACE_MODE via
`addContains`; merges TS-specific keywords via `extendKeywords`; replaces
shebang and use_strict via `replaceModes`; adjusts function-decl relevance
via `transformLabeledMode`.

### Cross-cutting: workspace src-resolution config

Resolves the cohort-3b state-file lesson "Workspace src-resolution is a real
v0 DX issue." Adds a root `vitest.shared.ts` mapping `@kindly-note/*` →
`packages/*/src/index.ts` for tests. After this, `bun run test` works on a
fresh checkout without `bun run build` first. Verified by deleting all
`packages/*/dist/` and running tests — 235/235 pass.

### Cross-cutting: matcher + extendLanguage enhancements (in `@kindly-note/core`)

Four discrete additions to `@kindly-note/core` were required before
lang-javascript could compile and lang-typescript could extend cleanly:

1. **`variants` expansion at compile time** (cohort-3a open question #6). JS
   uses `variants` for `CLASS_OR_EXTENDS` (with-extends vs without) and
   `FUNCTION_DEFINITION` (named vs anonymous). Mirrors upstream
   `expandOrCloneMode`.
2. **Per-capture-group `beginScope` emit** (cohort-3a open question #4). JS's
   `class Foo extends Bar` is `match: [/class/, /\s+/, IDENT_RE, ...]` with
   `scope: { 1: 'keyword', 3: 'title.class', ... }`. Mirrors upstream
   `emitMultiClass`.
3. **Cycle resolution in `compileLanguage`**. JS's SUBST ↔ TEMPLATE_STRING
   mutual recursion required a per-call memoisation map keyed on Mode
   reference.
4. **Ref-substitution in `extendLanguage`** (the keystone fix). When
   `extendPoints.PARAMS_CONTAINS: (current) => [...current, DECORATOR]`
   produces a new array, every Mode in the parent's contains-tree that
   references the OLD array gets its `contains` field rewritten to point at
   the NEW array. Without this, decorators in function parameter lists
   would be invisible.

---

## Files created / modified

### Workspace-level

- `vitest.shared.ts` (new) — shared Vitest config with `@kindly-note/*` →
  `src/index.ts` aliases. Includes subpath aliases for `@kindly-note/core/regex`
  and `@kindly-note/core/errors`.
- `packages/{core,lang-helpers,emitters-html,lang-pack-ecmascript,lang-json}/vitest.config.ts` —
  rewrite to extend `vitest.shared.ts` via `mergeConfig`. 5 files.
- `tsconfig.json` — added `{ path: './packages/lang-javascript' }` and
  `{ path: './packages/lang-typescript' }` references.

### `packages/core/`

- `src/compile.ts` — substantial additions:
  - `CompiledMode.isMultiCapture: boolean` field.
  - `pickBeginOrMatchPattern` helper (concat-with-capture-groups, vs the
    existing `pickPattern` alternation behaviour kept for `illegal`/`end`
    arrays).
  - `mergeVariantWithParent` helper for `variants` expansion.
  - `CompiledModeMutable` internal type + per-call memoisation map for cycle
    handling.
  - Derived `beginScope` from `scope` ScopeMap when multi-capture (mirrors
    upstream `mode_compiler.js#multiClass`).
  - Deferred `Object.freeze` until all CompiledModes in the memo have been
    populated.
- `src/internal/matcher.ts` — additions:
  - `emitMultiCaptureScopes` helper for per-group emit.
  - Multi-capture branch in the `m.type === 'begin'` handler that
    short-circuits the normal buffer flow and emits structured spans.
- `src/language.ts` — extendLanguage upgrades:
  - Computes `extendPoints` BEFORE contains-tree rewriting so a
    substitution map can be built.
  - `substituteRefsInMode` recursive walker that rewrites any Mode whose
    `contains`/`variants`/`starts` references the parent's pre-extension
    extension-point value. Cycle-safe via a WeakMap-based memo.
- `tests/multi-capture.test.ts` (new) — 5 tests covering:
  - Multi-capture `match`-array emits per-group scopes (with `scope` ScopeMap).
  - Multi-capture `begin`-array emits per-group scopes (with `beginScope` ScopeMap).
  - Skipped groups (no scope at index) emit as plain text.
  - `variants` expand into N sibling modes.
  - Variant fields override parent fields.

### `packages/lang-javascript/`

- `package.json`, `tsconfig.json`, `tsconfig.test.json`, `rolldown.config.ts`,
  `vitest.config.ts` — standard layout, ESM-only, `sideEffects: false`.
- `src/index.ts` — the `LanguageDefinition<JavaScriptExtensionPoints>` value;
  composes the modes from `modes.ts`. Citations of spec §0 / §1.2 / §8.2 / §8.2.1.
- `src/extensions.ts` — `JavaScriptExtensionPoints` interface (the typed
  extension surface). Exported as a named type for downstream consumers.
- `src/modes.ts` — Mode-tree fragments: `KEYWORDS`, `NUMBER` (with variants),
  `TEMPLATE_STRING`, `SUBST` (with cyclic contains pointing to TEMPLATE_STRING),
  `JSDOC_COMMENT`, `COMMENT` (with variants), `PARAMS`, `PARAMS_CONTAINS`,
  `CLASS_REFERENCE`, `CLASS_OR_EXTENDS` (multi-capture variants),
  `FUNCTION_DEFINITION` (multi-capture variants, label `func.def`),
  `USE_STRICT` (label `use_strict`).
- `tests/javascript.test.ts` — 11 tests across 2 describe blocks: language
  shape (frozen, aliases, extensible, illegal) + end-to-end highlighting
  (class decl, function decl, strings/numbers, template literals, JSDoc,
  alias resolution).

### `packages/lang-typescript/`

- `package.json`, `tsconfig.json`, `tsconfig.test.json`, `rolldown.config.ts`,
  `vitest.config.ts` — same template.
- `src/index.ts` — single-file LanguageDefinition built via
  `extendLanguage(javascript, { ... })`. Citations of spec §0 #5 / §8.2 / §8.2.2.
  Defines TS-specific Modes inline: `DECORATOR`, `NAMESPACE`, `INTERFACE_MODE`,
  `TS_USE_STRICT`. Composes via `extendKeywords`, `extendPoints`,
  `addContains`, `replaceModes`, `transformLabeledMode`.
- `tests/keystone.test.ts` — **18 tests** covering all 6 keystone proof
  acceptances from dispatch §E plus 4 lang-typescript package-shape gates.

### `.changeset/`

- `lang-javascript-initial.md` — `'@kindly-note/lang-javascript': minor`.
- `lang-typescript-initial.md` — `'@kindly-note/lang-typescript': minor`.
- `core-matcher-keystone-prereqs.md` — `'@kindly-note/core': minor` for the 4
  matcher / extendLanguage enhancements.
- `test-resolution-config.md` — `patch` for every package whose
  `vitest.config.ts` was rewritten (7 packages).

---

## Public exports

### `@kindly-note/lang-javascript`

- `default`: `LanguageDefinition<JavaScriptExtensionPoints>` — deep-frozen.
  - `name: 'JavaScript'`, `aliases: ['js', 'jsx', 'mjs', 'cjs']`.
  - `keywords`: full ECMAScript family (KEYWORDS / LITERALS / BUILT_INS / BUILT_IN_VARIABLES).
  - `illegal: /#(?![$_A-Za-z])/` — rejects lone `#` characters not part of an identifier.
  - `extensible: { PARAMS_CONTAINS, CLASS_REFERENCE }` — typed extension surface.
- Named type: `JavaScriptExtensionPoints` — `{ readonly PARAMS_CONTAINS: readonly Mode[]; readonly CLASS_REFERENCE: Mode; }`.

### `@kindly-note/lang-typescript`

- `default`: `LanguageDefinition` — deep-frozen, produced via `extendLanguage(javascript, ...)`.
  - `name: 'TypeScript'`, `aliases: ['ts', 'tsx', 'mts', 'cts']`.
  - `keywords`: parent's keywords + TS_KEYWORDS + TS_TYPES (merged via `extendKeywords`).
  - `extensible`: composed from parent's, with PARAMS_CONTAINS extended (DECORATOR appended).
  - `contains`: parent's contains (with shebang and use_strict replaced) + DECORATOR + NAMESPACE + INTERFACE_MODE.

---

## Acceptance gates (dispatch §E, §F)

### §E — Keystone proof tests (6 mandatory)

All 6 keystone tests pass. Plus 12 supporting tests in the same file (4
package-shape, 8 sub-tests across the 6 main describe blocks).

| # | Gate | Where verified | Status |
|---|---|---|---|
| 1 | Parent untouched after extend | `keystone.test.ts > test #1` (4 sub-tests) | ✅ PASS |
| 2 | Frozen-array runtime push throws | `keystone.test.ts > test #2` (3 sub-tests: PARAMS_CONTAINS push, contains push, CLASS_REFERENCE mutate) | ✅ PASS |
| 3 | TS adds DECORATOR — visible in TS, absent in JS | `keystone.test.ts > test #3` (2 sub-tests) | ✅ PASS |
| 4 | TS-specific keywords | `keystone.test.ts > test #4` (2 sub-tests: interface scoping, type alias) | ✅ PASS |
| 5 | Generics tokenize correctly | `keystone.test.ts > test #5` (2 sub-tests) | ✅ PASS |
| 6 | End-to-end real-world TS | `keystone.test.ts > test #6` (1 sub-test: 20-line snippet renders ≥5 distinct kn-* classes) | ✅ PASS |

### §F — Verification commands (all must pass)

| Command | Status |
|---|---|
| Delete all `packages/*/dist/` directories | ✅ Done |
| `bun install` | ✅ Resolved 248 packages |
| `bun run typecheck` (`tsc -b`) | ✅ Clean — 0 errors |
| `bun run test` (workspace) | ✅ **235/235** across 7 packages |
| `bun run --filter '@kindly-note/lang-javascript' build` | ✅ Produces `dist/index.js` (7.55 kB) + `dist/*.d.ts` (~360ms) |
| `bun run --filter '@kindly-note/lang-typescript' build` | ✅ Produces `dist/index.js` (3.43 kB) + `dist/*.d.ts` (~350ms) |
| `bun run lint` (Biome) | ✅ Clean — 87 files, 0 errors |
| grep for node-builtins / DOM / hljs- in lang-javascript/src | ✅ No matches |
| grep for node-builtins / DOM / hljs- in lang-typescript/src | ✅ No matches |

---

## Test count

| Package | Before | After | Delta |
|---|---|---|---|
| `@kindly-note/core` | 56 | **61** | +5 (multi-capture + variants tests) |
| `@kindly-note/lang-helpers` | 64 | 64 | 0 |
| `@kindly-note/emitters-html` | 31 | 31 | 0 |
| `@kindly-note/lang-pack-ecmascript` | 32 | 32 | 0 |
| `@kindly-note/lang-json` | 18 | 18 | 0 |
| `@kindly-note/lang-javascript` | — | **11** | +11 |
| `@kindly-note/lang-typescript` | — | **18** | +18 |
| **Workspace total** | **201** | **235** | **+34** |

---

## What the keystone proves (spec §0 shift #5)

Spec §0 architectural shift #5 says:

> **TypeScript inherits from JavaScript through a typed `extend()` API**, not
> through array-mutation of an `exports` field.

Spec §8.2 elaborates: the `extensible: T` field is the typed extension
surface; `extendLanguage(parent, extensions)` produces a NEW
LanguageDefinition without mutating the parent. The parent is deep-frozen.
The child reaches into the parent's typed values via `extendPoints[K]:
(current) => current.concat(...)` — never via `.push()` on a parent's array.

This cohort PROVES the contract end-to-end:

- **`@kindly-note/lang-javascript`** declares `extensible: { PARAMS_CONTAINS,
  CLASS_REFERENCE }` and is deep-frozen at module init. Attempting
  `(jsLang.extensible.PARAMS_CONTAINS as Mode[]).push(...)` throws at
  runtime — proving immutability is real, not just a type-level guarantee.
- **`@kindly-note/lang-typescript`** is built ENTIRELY through
  `extendLanguage(javascript, { extendPoints, addContains, replaceModes,
  transformLabeledMode, extendKeywords })`. Zero `Object.assign(jsLang,
  ...)`. Zero `jsLang.contains.push(...)`. Zero reaching into a (no-longer-
  existing) `jsLang.exports.PARAMS_CONTAINS`.
- Highlighting `function f(@injected x: number) { return x; }` with TS
  produces a `meta` scope on `@injected` (the decorator).
- Highlighting the same code with JS produces NO `meta` scope on
  `@injected` — the parent's PARAMS_CONTAINS array is byte-for-byte
  unchanged.
- Importing both packages and snapshotting `lang-javascript.contains` BEFORE
  the test, then asserting reference-equality AFTER (with the TS module
  having executed `extendLanguage` at module init): all references match.

The 4 mechanism tests in `keystone.test.ts > test #1` make this
verifiable: the parent's `extensible` references are reference-stable
across the extend operation; pushes throw; mutations throw.

---

## Open questions / spec ambiguities (none silent)

These are surfaced explicitly per the dispatch's "no silent revisions" rule.

### #1 — `endScope` ScopeMap multi-capture (deferred)

The matcher emits per-capture-group scopes for `beginScope` (when `begin`/`match`
is an array). The symmetric case for `endScope` (when `end` is an array) is
NOT yet implemented. JS / TS do not need this in cohort 4 (no end-array modes
with ScopeMap end-scopes). Markdown emphasis is the canonical case that will
need it in the v1+ markdown ring.

**Followup:** add `emitMultiCaptureEndScopes` to the matcher's `m.type ===
'end'` branch when the first language with this need ships.

### #2 — `starts` (the post-end "next mode" link) still not implemented

Cohort 3a open question #7 stays open. Upstream's `mode.starts` causes the
matcher to enter a new mode immediately after an end fires. JS uses this in
`HTML_TEMPLATE` / `CSS_TEMPLATE` / `GRAPHQL_TEMPLATE` (tagged template
literals that subLanguage-descend into HTML/CSS/GraphQL). Cohort 4 does NOT
ship the tagged-template variants; users get a plain `string` scope on
`` html`...` `` instead of HTML highlighting. The spec §8.2.1 worked example
shows `HTML_TEMPLATE` etc. as part of JS, but cohort 4's brief explicitly
says "template literals (recognize them but no sub-language descent in v0
per c3a #1)."

**Followup:** `starts` becomes essential when cohort 6+ markdown ships
(code-fence sub-language descent). Add to `CompiledMode` and handle in
`closeMode` at that time.

### #3 — Per-keyword relevance modifier `keyword|N` not consumed

Cohort 3a open question #8 documented that `splitKeywords` accepts the
`keyword|N` syntax (where N is a relevance override) but drops the
modifier. JS uses some relevance overrides upstream (e.g.
`'function|0'`). Cohort 4 inherits the cohort-3a behaviour — relevance
overrides via this syntax are silently dropped. The keystone tests still
pass because the keystone tests do not depend on auto-detect tie-breaking.

**Followup:** wire the per-keyword relevance through KeywordDict when
`@kindly-note/auto-detect` lands and the auto-detect regression bar is
established.

### #4 — JS's tagged-template variants (HTML / CSS / GraphQL) not shipped

Per the brief: "JSX (basic — full JSX is a v1+ extension), template
literals (recognize them but no sub-language descent in v0 per c3a #1)."
Cohort 4 ships plain `TEMPLATE_STRING` (the `\`...\`` form) but not the
upstream `HTML_TEMPLATE` / `CSS_TEMPLATE` / `GRAPHQL_TEMPLATE` variants
(which require `starts` + sub-language descent — see #2).

**Followup:** add when `starts` lands AND XML/CSS/GraphQL language packs
land (cohort 5+).

### #5 — Reference-substitution in `extendLanguage` walks `contains`/`variants`/`starts` only

The `substituteRefsInMode` walker currently visits three Mode fields:
`contains`, `variants`, and `starts`. It does NOT walk `keywords`,
`scope`, `match`, etc. — those fields cannot meaningfully reference an
extensible value (they're regex sources / scope strings / keyword
dictionaries). If a future spec extension introduces an extensible point
that lives in a different Mode field, the walker needs updating.

**Followup:** add a test in `keystone.test.ts` whenever a new extension-
point shape is introduced. For now, the JS surface (PARAMS_CONTAINS as a
contains-array reference, CLASS_REFERENCE as a single Mode reference) is
fully covered.

### #6 — `__emitTokens` / `emitTokens` escape hatch untested by cohort 4

Spec §7.3 row "__emitTokens" reserves a per-language escape hatch where
the language definition can supply a custom tokeniser. Cohort 4 doesn't
exercise it (JS / TS use the standard matcher path). The matcher honors
`lang.emitTokens` if present (matcher.ts:79).

**Followup:** add an integration test when the first language that uses
`emitTokens` ships (likely `@kindly-note/lang-plaintext` or a high-perf
escape-hatch language).

### #7 — `MAX_KEYWORD_HITS` relevance dampening still NOT implemented

Cohort 3a open question #9 stays open. Each keyword's relevance is
counted unconditionally (not capped at 7 hits as upstream does). Cohort 4
keystone tests do not care about exact relevance scores — they only assert
`r.illegal === false` and inspect scope spans. Auto-detect (cohort 5+)
will need this fix.

### #8 — `lang-javascript` does NOT implement the upstream `noneOf` keyword exclusion in FUNCTION_CALL

Upstream JS has a `FUNCTION_CALL` mode with `noneOf([...BUILT_IN_GLOBALS,
"super", "import", "await"].map(x => `${x}\\s*\\(`))` to avoid matching
`super(...)`, `import(...)`, etc. as function calls. Cohort 4 simplifies
this away — cohort 4's lang-javascript does NOT include the
`FUNCTION_CALL` mode at all. Function calls are not specifically scoped.
This is documented as deferred per the brief: "JS-language full feature
parity is out of scope for the keystone cohort. The keystone is the
typed-extension API; full grammar fidelity comes in v1+."

**Followup:** when `@kindly-note/auto-detect` lands and the relevance bar
is set, restore FUNCTION_CALL with the noneOf exclusion. For now, calls
to functions are unscoped.

### #9 — JS's `UPPER_CASE_CONSTANT` and `PROPERTY_ACCESS` not shipped

Same rationale as #8 — cohort 4 ships the keystone-relevant subset of JS.
`UPPER_CASE_CONSTANT` (matches `\b[A-Z][A-Z_0-9]+\b` as `variable.constant`)
and `PROPERTY_ACCESS` (matches `.foo` as `property`) are not in the cohort
4 contains-list. The keystone tests don't need them.

**Followup:** add in v1 when full JS grammar fidelity becomes the goal.

### #10 — Variant `relevance` is taken from the variant, not max(parent, variant)

`mergeVariantWithParent` does a shallow `{ ...parent, ...variant }` — so a
variant's `relevance` (if set) overrides the parent's. This is what
upstream does too. Worth documenting because it's a subtle behaviour: a
variant that doesn't declare relevance inherits the parent's; a variant
that declares `relevance: 0` overrides it.

---

## What changed from the spec verbatim

### Matcher and `extendLanguage` enhancements (in `@kindly-note/core`)

Spec §8.2 / §8.2.1 / §8.2.2 prescribe the keystone API surface but do NOT
fully specify the implementation. Cohort 4 added four mechanisms required
to make the API actually work end-to-end. Each is documented above (see
"Cross-cutting: matcher + extendLanguage enhancements"). All four are
strict additions — no existing API surface is broken; all 201 prior tests
still pass.

The most architecturally significant of the four is **#4 ref-substitution
in `extendLanguage`**. Without it, `extendPoints.PARAMS_CONTAINS: (current)
=> [...current, DECORATOR]` produces a new array but PARAMS Mode in the
parent still references the OLD array, so decorators inside parameter
lists are never matched. The walker rewrites every Mode reference to the
old array with the new array, transparently. This makes the typed
extension API a real architectural alternative to upstream's array
mutation.

### `Mode.scope: ScopeMap` is canonical, not just `beginScope: ScopeMap`

Upstream uses `scope: { 1: ..., 3: ... }` on multi-capture begin/match
modes. Spec §8.2 worked example uses `scope: { 1: ..., 3: ... }` too.
Cohort 4 honours this: the matcher derives `beginScope` from `scope` when
multi-capture, with `beginScope` taking precedence if both are set.
Documented inline in compile.ts.

### Adjacent named export added (not in §1.2 verbatim)

`@kindly-note/lang-javascript` ships `JavaScriptExtensionPoints` as a named
type AND the LanguageDefinition's `extensible` field carries the SAME
shape. Spec §1.2 row says "named: `JavaScriptExtensionPoints` (type)" —
implemented exactly as specified.

---

## Branch state

- Branch: `feat/cohort-4-keystone` (from `main` at `f5e9a85`).
- Logical commits (in order):
  1. **Workspace src-resolution + matcher: variants expansion + per-capture-group beginScope.** (cross-cutting prereqs — vitest config + matcher + 5 new core tests).
  2. **`@kindly-note/lang-javascript` + cycle resolution + extendLanguage ref-substitution.** (lang-javascript package + the cycle-resolution and ref-substitution work in core needed by both keystone packages + 11 new lang-javascript tests).
  3. **`@kindly-note/lang-typescript`: THE KEYSTONE.** (lang-typescript package + 18 keystone tests).
  4. **Build manifest + changesets.**
- Untracked at start: `node_modules/`, `dist/`, `bun.lock` (gitignored except bun.lock).
- The branch builds on cohorts 1+2+3a+3b — `bun run test` runs all 235 tests
  across 7 packages and they all pass, with no `bun run build` precondition.

---

**STATUS: DONE.** All 6 mandatory keystone tests pass. All verification
commands (typecheck, test, build, lint, no-builtins-grep) pass. The
workspace src-resolution config works without prior builds. The architectural
bet of the entire kindly-note project — that TypeScript inherits from
JavaScript through the typed `extendLanguage()` API without mutating the
parent — is **VALIDATED END-TO-END**.
