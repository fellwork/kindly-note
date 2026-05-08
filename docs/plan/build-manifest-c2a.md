# Build manifest — Cohort 2a: `@kindly-note/lang-helpers`

**Date:** 2026-05-08
**Builder:** Cohort 2a (kindly-note modernize track)
**Branch:** `feat/lang-helpers`
**Spec contract:** `docs/plan/architect-spec.md`
**Depends on:** `@kindly-note/core` (cohort 1, on `main`)

This manifest documents what cohort 2a produced, with verification evidence
for every Director-mandated acceptance gate from the dispatch.

---

## Files created

### Workspace-level
- `.gitattributes` — forces LF on `*.ts`, `*.json`, `*.md`, etc. The repo's
  Biome config already mandates LF; without `.gitattributes`, Windows checkouts
  with `core.autocrlf=true` (the default that ships with most Git-for-Windows
  installs) rewrite source files to CRLF on disk and the repository's
  `bun run lint` gate fails on a fresh worktree. The on-disk repo (and `git
  ls-files --eol`) already stores everything as LF — `.gitattributes` just
  stops the working-tree conversion. **Decision flagged below as cross-cutting.**

### `packages/lang-helpers/`
- `package.json` — `@kindly-note/lang-helpers` 0.0.1, ESM, `sideEffects: false`,
  single root export, depends on `@kindly-note/core` via `workspace:*`.
- `tsconfig.json` — extends `../../tsconfig.base.json`, `rootDir: ./src`,
  `outDir: ./dist`, `references: [{ path: ../core }]` for project-references.
- `tsconfig.test.json` — sibling for Vitest's transform layer; pulls in
  `tests/**/*` plus `node` types.
- `rolldown.config.ts` — single-entry build (`index`), `platform: 'neutral'`,
  `external: ['@kindly-note/core']`, `dts()` plugin.
- `vitest.config.ts` — `environment: 'node'`.

### `packages/lang-helpers/src/`
- `index.ts` — public surface; only `export * from './modes.js'` and
  `export * from './regex-constants.js'`. No top-level statements (acceptance
  gate #2: tree-shakable + no side effects on import).
- `modes.ts` — Mode-producing helpers and constants. Every value is deep-frozen
  at module-init time. spec §1.2 + §0 shifts #1 + #2.
- `regex-constants.ts` — regex *source-string* constants. Pure data.
- `internal/deep-freeze.ts` — small recursive freezer scoped to this package.
  Distinct from core's `deepFreezeLanguage` (scoped to `LanguageDefinition`);
  duplicating six lines is cheaper than crossing the types-only edge.

### `packages/lang-helpers/tests/`
- `modes.test.ts` — 55 tests: acceptance gates #1, #2, #4 (frozen output,
  no-side-effect imports, referential transparency); per-helper behavior
  for `comment()`, `cLineComment`, `cBlockComment`, `hashComment`,
  `apostropheString`, `quoteString`, `backslashEscape`, `phrasalWords`,
  `numberMode`, `cNumberMode`, `binaryNumberMode`, `regexpMode`, `titleMode`,
  `underscoreTitleMode`, `methodGuard`, `endSameAsBegin`, `shebang`.
- `regex-constants.test.ts` — 9 tests covering each constant.

**Total tests in the new package: 64, all passing.**
**Total tests across the monorepo (after cohort 2a): 106 (42 + 64).**

### `.changeset/`
- `lang-helpers-initial.md` — `'@kindly-note/lang-helpers': minor` for the
  initial 0.0.1 release.

## Files modified

- `tsconfig.json` (root) — added `{ path: './packages/lang-helpers' }` to
  `references` so `tsc -b` picks up the new package.

---

## Public exports from `@kindly-note/lang-helpers`

In alphabetical order, with type / runtime split.

### Runtime exports (named)

#### Spec §1.2 mandate
- `apostropheString: Mode` (constant, frozen)
- `binaryNumberMode: Mode` (constant, frozen)
- `cBlockComment: Mode` (constant, frozen)
- `cLineComment: Mode` (constant, frozen)
- `cNumberMode: Mode` (constant, frozen)
- `comment(begin, end, modeOptions?): Mode` (factory; returns fresh frozen Mode)
- `endSameAsBegin(mode): Mode` (factory; returns fresh frozen Mode)
- `methodGuard: Mode` (constant, frozen)
- `numberMode: Mode` (constant, frozen)
- `phrasalWords: Mode` (constant, frozen)
- `quoteString: Mode` (constant, frozen)
- `regexpMode: Mode` (constant, frozen)
- `titleMode: Mode` (constant, frozen)
- `BINARY_NUMBER_RE: string` (regex source)
- `C_NUMBER_RE: string` (regex source)
- `IDENT_RE: string` (regex source)
- `NUMBER_RE: string` (regex source)
- `RE_STARTERS_RE: string` (regex source)

#### Spec §1.2 "etc." (upstream parity / used in spec worked examples)
- `backslashEscape: Mode` (constant, frozen) — sub-mode used by
  `apostropheString` and `quoteString`. Shared via reference.
- `hashComment: Mode` (constant, frozen) — `#`-comment for Python/Ruby/shell.
- `MATCH_NOTHING_RE: RegExp` — sentinel "never matches" rule.
- `shebang(opts?): Mode` (factory; returns fresh frozen Mode) — used in
  spec §8.2.1 worked example for `@kindly-note/lang-javascript`.
- `underscoreTitleMode: Mode` (constant, frozen) — title mode that allows a
  leading underscore.
- `UNDERSCORE_IDENT_RE: string` — identifier with leading underscore.

### Type-only exports
- `ShebangOptions` — options interface for `shebang()`.

### Subpath
None. The package exposes only its root entry. spec §1.2 lists the surface as
flat named exports of the package; tree-shaking handles the per-symbol cost.

---

## Verification log

Every command run from the repo root, `bun@1.3.8`. All commands required by
dispatch §D pass.

| Command | Status |
|---|---|
| `bun install` | ✅ Resolved 243 packages, 0 errors. |
| `bun run typecheck` (`tsc -b`) | ✅ Clean — 0 errors, 0 warnings. Both `core` and `lang-helpers` build cleanly via project references. |
| `bun run --filter '@kindly-note/lang-helpers' build` (rolldown) | ✅ Produces `dist/index.js`, `dist/index.d.ts`, sourcemaps. Build time ~390ms. |
| `bun run --filter '@kindly-note/lang-helpers' test` (Vitest) | ✅ 64/64 passing across 2 test files. |
| `bun run lint` (Biome over the whole repo) | ✅ Clean — 36 files, 0 errors. |
| `bun run test` (workspace fan-out) | ✅ 106/106 passing (cohort 1's 42 + cohort 2a's 64). |

### Sample build output
```
dist/index.js        chunk │ size:  8.89 kB
dist/index.d.ts      chunk │ size:  6.84 kB  (via re-chunk)
dist/index.js.map    asset │ size: 20.64 kB
```

---

## Sample-based acceptance (dispatch §C)

| # | Gate | Where verified | Status |
|---|---|---|---|
| 1 | **Frozen output.** Every Mode-returning helper (`comment(begin, end)`, `cLineComment`, etc.) returns a deep-frozen object. `Object.isFrozen(result)` is true; nested arrays/objects are also frozen. Pushing into a frozen `contains` throws. | `tests/modes.test.ts` "acceptance #1 — frozen output" suite (16 sub-tests covering every helper, plus the `push`-throws and field-mutation-throws cases). | ✅ PASS |
| 2 | **Tree-shakable.** Every export is a named export. No default export. `index.ts` has only `export * from ...`. `package.json#sideEffects: false`. Importing the module mutates no globals. | `package.json`, `src/index.ts`, plus `tests/modes.test.ts` "acceptance #2 — no side effects on import" suite. | ✅ PASS |
| 3 | **Type-correctness.** Every helper's return type is `Mode` from `@kindly-note/core`. `import type { Mode }` is the only edge to core (verified: `dist/index.js` has zero runtime references to `@kindly-note/core` after dts erasure). | TypeScript compile (`tsc -b`); test imports use `import type { Mode } from '@kindly-note/core'`. | ✅ PASS |
| 4 | **Pure / referentially-transparent.** `cLineComment` (a value) is identity-stable across imports; `comment('//', '$')` (a factory call) returns equal-but-distinct objects each call. | `tests/modes.test.ts` "acceptance #4 — pure / referentially-transparent" suite (3 sub-tests). | ✅ PASS |
| 5 | **No upstream code copy.** All TypeScript was written fresh against the kindly-note `Mode` shape. No upstream `.js` was ported line-by-line. | Manual: every file declares `Mode` types from `@kindly-note/core`, uses TS-native control flow, and has documented divergences (e.g., `shebang` does not include the upstream `on:begin` callback — see open question 4). | ✅ PASS |

---

## Open questions / spec ambiguities

These are surfaced per dispatch's "surface unknowns silently resolved" rule.
Each has a documented default with a code comment citing the spec; flag for
Architect review where listed as decision-required.

1. **Beyond the §1.2 list, which upstream `lib/modes.js` exports should ship?**
   The spec §1.2 row mandates 13 helpers and 5 regex constants; it ends with
   "etc." and the dispatch tells me to "look at upstream `src/lib/modes.js`
   for the canonical list — port the *names and intent*". The spec's worked
   examples (§8.2.1, §8.2.4) import `shebang` from this package, and upstream
   exports `shebang`, `hashComment`, `underscoreTitleMode`, `MATCH_NOTHING_RE`,
   `UNDERSCORE_IDENT_RE`, `BACKSLASH_ESCAPE` — all of which I included as named
   exports under the camelCase convention. *Decision required from Architect:*
   keep all six, or trim to only the ones used in spec worked examples
   (`shebang`)? My recommendation: keep all six; they're tiny, tree-shakable,
   and cohort 2b/2c will need them when porting JS/TS/Ruby/Python.

2. **`comment()`'s `modeOptions.contains` merge strategy.** Upstream's
   `comment()` calls `inherit(defaults, modeOptions)`, which performs a
   shallow merge — caller's `contains` *replaces* the doctag/prose contains.
   I diverged: when the caller supplies `contains`, I *append* their modes
   after the built-ins so doctag/prose still apply. This matches the
   intent (the doctag/prose are the value-add of `comment()` over a raw
   begin/end Mode); a caller who wants to drop them can use `comment(...)`
   and then post-process, or skip `comment()` entirely. *Decision required:*
   keep my appending semantics, or revert to shallow-replace per upstream?
   Tested in `modes.test.ts` "comment() … appends caller-supplied contains".

3. **`endSameAsBegin` is a typed Mode field, not a runtime callback.**
   Upstream's `END_SAME_AS_BEGIN` injects two callbacks (`on:begin`,
   `on:end`) onto the mode. spec §0 shift #2 forbids per-Mode runtime
   mutation hooks and the `Mode` type in `@kindly-note/core/language.ts`
   already declares `readonly endSameAsBegin?: boolean` (line 75). I
   therefore implement `endSameAsBegin(mode)` as a small wrapper that adds
   `endSameAsBegin: true` to the Mode, leaving the begin/end-equality wiring
   to the matcher in core. **The matcher must implement this field for the
   helper to be functional at parse time** — currently the cohort-1 minimal
   matcher does not yet wire it up (per `build-manifest-c1.md` open question
   #6, the matcher is "first-match wins" only). This is consistent with
   cohort 1's manifest; full matcher semantics are scoped for the cohort
   that ships the first real `lang-*` package. No spec deviation; just a
   forward-reference.

4. **`shebang()` does not install a non-zero-index reject callback.**
   Upstream uses `"on:begin": (m, resp) => { if (m.index !== 0) resp.ignoreMatch(); }`
   to ensure the shebang only matches at column 0 of line 0. I rely on the
   `^` anchor in the regex (`'^#![ ]*\\/'`) to enforce the same constraint.
   This is functionally equivalent for the typical case (single-line input
   for the shebang at file start) and removes a runtime callback that the
   spec §0 shift #2 architecture forbids. *Decision required:* if there's
   a multiline-input edge case where `^` matches a `#!` mid-file (i.e.,
   the engine compiles with the `m` flag), the helper would over-match.
   This needs the matcher to compile shebang's begin without the `m` flag,
   which is the matcher's normal default per cohort-1 code. No deviation
   under that assumption.

5. **`regex` constants are SCREAMING_SNAKE; helpers are camelCase.** spec §1.2
   shows `IDENT_RE`, `C_NUMBER_RE`, etc. (constant case) and `cLineComment`,
   `cNumberMode` (camelCase). I followed that exactly. No deviation; documented
   here for clarity because upstream uses ALL_CAPS for both.

6. **`.gitattributes` introduction.** Cross-cutting infrastructure file added
   to make the `bun run lint` gate (§D) pass on a fresh Windows checkout. The
   file pins LF for source files; the repo's index already stored LF, so
   Linux/macOS users see no change. *Decision required:* keep `.gitattributes`?
   Alternatives: (a) add a setup step to docs telling Windows contributors to
   set `git config core.autocrlf=false` locally; (b) configure the repo's
   `.git/config` (not portable across clones). I picked (.gitattributes)
   because it's the canonical, portable, zero-action fix.

---

## What changed from the spec verbatim

- **None.** Where the spec was under-specified (open questions 1, 2, 6), I
  picked a documented default with a code comment citing the spec section and
  flagged it above. No silent revisions.
- The `comment()` signature uses `modeOptions: Partial<Mode>` (TypeScript) where
  upstream's signature is `(begin, end, modeOptions = {})` JSDoc-typed as
  `Mode | {}`. The intent is identical; the type is tighter.
- `endSameAsBegin` returns a *new* Mode (frozen) instead of upstream's
  `Object.assign(mode, ...)` which mutates the input. spec §0 shift #2 mandates
  this. Test `endSameAsBegin … does not mutate the input Mode` verifies it.

---

## Branch state

- Branch: `feat/lang-helpers` (from `main`).
- Commits to be made: see commits below.
- Untracked at start: `node_modules/`, `dist/`, `bun.lock` (gitignored).
- The branch builds on cohort 1 — `bun run test` runs all 106 tests across
  both packages and they all pass.

Ready for cohort 2b (next: a real `@kindly-note/lang-*` package, likely JSON,
which exercises lang-helpers' `cLineComment` / `cNumberMode` / `quoteString`).
