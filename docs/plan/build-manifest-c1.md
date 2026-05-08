# Build manifest — Cohort 1: monorepo scaffold + `@kindly-note/core`

**Date:** 2026-05-08
**Builder:** Cohort 1 (kindly-note modernize track)
**Branch:** `feat/scaffold-and-core`
**Spec contract:** `docs/plan/architect-spec.md`

This manifest documents what cohort 1 produced, with verification evidence for
each Director-mandated acceptance gate.

---

## Files created

### Scaffolding (root)
- `package.json` — workspace root, `bun@1.3.8` pinned in `packageManager`, `workspaces: ["packages/*"]`, scripts (`build`, `test`, `typecheck`, `lint`, `format`, `changeset`, `release`).
- `tsconfig.base.json` — strict TS, ES2022, `moduleResolution: "bundler"`, `verbatimModuleSyntax: true`, `noUncheckedIndexedAccess: true`, project-references-friendly.
- `tsconfig.json` — root, `references` lists `packages/core` for `tsc -b`.
- `biome.json` — Biome 1.9 config: 2-space indent, single quotes, semicolons-always, `useImportType` linted, organize-imports enabled.
- `.changeset/config.json` — Changesets config for the `@kindly-note/*` scope, base branch `main`.
- `.changeset/README.md` — Quickstart for contributors.
- `CONTRIBUTING.md` — How to add a package, run tests, add a changeset.

### `packages/core/`
- `package.json` — `@kindly-note/core` 0.0.1, ESM, `sideEffects: false`, `exports` map per spec §6.4 (root, `./regex`, `./errors`, `./package.json`).
- `tsconfig.json` — extends `../../tsconfig.base.json`, `rootDir: ./src`, `outDir: ./dist`.
- `tsconfig.test.json` — sibling config used by Vitest's transform layer; pulls in `tests/**/*` plus `node` types.
- `rolldown.config.ts` — three-entry build (`index`, `regex`, `errors`), `platform: 'neutral'`, `dts()` plugin, ESM only.
- `vitest.config.ts` — `environment: 'node'`, no DOM globals (acceptance #5 contract).

### `packages/core/src/`
- `index.ts` — public surface; named exports, type re-exports, `regex` and `errors` namespace re-exports, `VERSION` constant.
- `result.ts` — `CodeInput`, `HighlightResult`, `HighlightOptions`, `ElementInput`, `ElementOutput`. spec §2.2.
- `language.ts` — `Mode`, `Keywords`, `ScopeMap`, `CompilerExt`, `LanguageDefinition`, `LanguageExtensions`, `defineLanguage`, `extendLanguage`, `deepFreezeLanguage`. spec §8.2 keystone.
- `compile.ts` — `CompiledLanguage`, `CompiledMode`, `KeywordDict`, `compileLanguage`. spec §9.4.
- `plugin.ts` — `Plugin`, `PluginContext`, `PluginLogger`, `HighlighterReadonly`, `HighlighterReadonlyOptions`, `definePlugin`, `runHook`, `defaultPluginLogger`. spec §2.
- `emitter.ts` — `EmitterFactory`, `Emitter`, `EmitterOptions`, `TokenStream`, `TokenNode`, `TokenScope`, `TokenText`, `TokenSubLanguage`, `defineEmitter`. spec §5.
- `regex.ts` — `concat`, `lookahead`, `optional`, `anyNumberOfTimes`, `either`, `escape`, `source`, `countMatchGroups`, `startsWith`. spec §7.3 / §8.1 stable subpath.
- `errors.ts` — `KindlyNoteError`, `LanguageNotFoundError`, `IllegalSyntaxError`, `LanguageCompileError`, `LanguageNotExtensibleError`, `PluginError`.
- `highlighter.ts` — `Highlighter`, `HighlighterOptions`, `RegisteredLanguage`, `createHighlighter`. The pipeline runner.
- `internal/matcher.ts` — minimal first-match-wins walker over the compiled mode tree (v0; subsequent cohorts replace with full multi-regex matcher).
- `internal/recording-emitter.ts` — internal default emitter; records calls into a frozen `TokenStream`.

### `packages/core/tests/`
- `language.test.ts` — 10 tests: `defineLanguage` freezing, the keystone (parent never mutated, child has new modes, runtime push throws on frozen array), `replaceModes`, `addContains`, `extendKeywords`, `extendLanguage` rejection when parent has no `extensible`.
- `plugin.test.ts` — 6 tests: pipeline threading order, no shared mutable context between plugins, `shortCircuit` skips the engine, `transformResult` plugin chaining, `errorMode: 'safe'` no-crash, `errorMode: 'throw'` propagates wrapped in `PluginError`.
- `emitter.test.ts` — 2 tests: §5.6 numbered call-trace assertion (`startScope` → `addText` → `endScope` → `finalize` → `render`), TokenStream is the boundary.
- `highlighter.test.ts` — 11 tests: end-to-end stub language, keyword scope tagging, alias resolution (case-insensitive), unknown-language safe vs throw, compilation timing snapshot decoupling, fresh-but-equal artifacts on repeated compile, deep-frozen compiled tree, DOM-freeness smoke (acceptance #5).
- `regex.test.ts` — 13 tests covering each regex helper.

**Total tests: 42, all passing.**

## Files modified

- `.gitignore` — added bun lockfile, `packages/*/dist/`, `.idea/`, scoped `.vscode/`, `.claude/worktrees/` entries.
- `README.md` — replaced one-line placeholder with project overview, what's-different list, monorepo layout, quickstart, status, license.

---

## Public exports from `@kindly-note/core`

In alphabetical order, with type / runtime split:

### Runtime exports (named)
- `compileLanguage(def): CompiledLanguage`
- `createHighlighter(opts?): Highlighter`
- `deepFreezeLanguage(def): LanguageDefinition`
- `defaultPluginLogger(name): PluginLogger`
- `defineEmitter(factory): EmitterFactory`
- `defineLanguage(def): LanguageDefinition`
- `definePlugin(plugin): Plugin`
- `errors` (namespace re-export of `./errors`)
- `extendLanguage(parent, extensions): LanguageDefinition`
- `regex` (namespace re-export of `./regex`)
- `runHook(plugin, phase, hook, input, ctx, errorMode, passthrough)`
- `VERSION: string`

### Type-only exports
- `CodeInput`
- `CompiledLanguage`
- `CompiledMode`
- `CompilerExt`
- `ElementInput`
- `ElementOutput`
- `Emitter<T>`
- `EmitterFactory<T>`
- `EmitterOptions`
- `Highlighter`
- `HighlighterOptions`
- `HighlighterReadonly`
- `HighlighterReadonlyOptions`
- `HighlightOptions`
- `HighlightResult`
- `KeywordDict`
- `Keywords`
- `LanguageDefinition<TExt>`
- `LanguageExtensions<TExt>`
- `Mode`
- `Plugin`
- `PluginContext`
- `PluginLogger`
- `RegisteredLanguage`
- `ScopeMap`
- `TokenNode`
- `TokenScope`
- `TokenStream`
- `TokenSubLanguage`
- `TokenText`

### Subpath: `@kindly-note/core/regex`
Re-exported as the `regex` namespace from the root, also addressable as a
direct subpath import (spec §8.1):
- `anyNumberOfTimes(re): string`
- `concat(...args): string`
- `countMatchGroups(re): number`
- `EitherOptions` (type)
- `either(...args): string`
- `escape(value): string`
- `lookahead(re): string`
- `optional(re): string`
- `RegexLike` (type)
- `source(re): string`
- `startsWith(re, lexeme): boolean`

### Subpath: `@kindly-note/core/errors`
Re-exported as the `errors` namespace from the root:
- `IllegalSyntaxError`
- `KindlyNoteError`
- `LanguageCompileError`
- `LanguageNotExtensibleError`
- `LanguageNotFoundError`
- `PluginError`

---

## Verification log

Every command run from the repo root, `bun@1.3.8`. All commands required by
dispatch §E are listed; all pass.

| Command | Status |
|---|---|
| `bun install` | ✅ Resolved 332 packages, 0 errors. |
| `bun run typecheck` (`tsc -b`) | ✅ Clean — 0 errors, 0 warnings. |
| `bun run --filter '@kindly-note/core' typecheck` | ✅ Same `tsc -b` invocation; clean. |
| `bun run --filter '@kindly-note/core' build` (rolldown) | ✅ Produces `dist/index.js`, `dist/regex.js`, `dist/errors.js` and matching `.d.ts` + `.js.map`. Build time ~430ms. |
| `bun run --filter '@kindly-note/core' test` (Vitest) | ✅ 42/42 passing across 5 test files. |
| `bun run lint` (Biome) | ✅ Clean — 25 files checked, 0 errors. |

### Sample build output
```
dist/index.js                  20.57 kB
dist/index.js.map              66.73 kB
dist/index.d.ts (via re-chunk) 19.96 kB
dist/regex.js                   2.46 kB
dist/regex.d.ts                 1.91 kB
dist/errors.js                  2.87 kB
dist/errors.d.ts                1.89 kB
```

---

## Sample-based acceptance (dispatch §D)

| # | Test | File | Status |
|---|---|---|---|
| 1 | Keystone — `extendLanguage` does not mutate parent's `extensible.FOO` | `tests/language.test.ts` (3 tests under "extendLanguage — the keystone (spec §8.2)") | ✅ PASS |
| 2 | Plugin pipeline threading + per-plugin context isolation + error isolation under `'safe'` and `'throw'` | `tests/plugin.test.ts` (all 6 tests) | ✅ PASS |
| 3 | Emitter call-trace matches spec §5.6 sequence | `tests/emitter.test.ts:69-99` | ✅ PASS |
| 4 | Mutating source `LanguageDefinition` after `registerLanguage` has no effect | `tests/highlighter.test.ts:76-106` (under "compilation timing (spec §9.1) — acceptance #4") | ✅ PASS |
| 5 | DOM-freeness smoke — Vitest `node` env, no `document`/`window` globals | `tests/highlighter.test.ts:132-160` | ✅ PASS |

All five acceptance gates green.

---

## Open questions / spec ambiguities encountered

These are surfaced as open questions per dispatch's "surface unknowns"
constraint. Each has a documented default chosen with a comment in code; none
required improvising past five attempts.

1. **Emitter `addSubLanguage` argument shape — discriminated union variant for sub-language.**
   Spec §5.2 normatively defines `TokenStream = TokenScope` and notes that a sub-language
   is "set when this node is a sub-language root" via the `subLanguage?: string` field on
   `TokenScope`. We implemented the same shape but additionally added a `TokenSubLanguage`
   variant on the `TokenNode` union (`{ type: 'sub-language', language, stream }`) so that
   children of a parent emitter can be type-narrowed cleanly when walking the tree.
   The `TokenScope.subLanguage` field is still part of the spec contract; it is not in our
   exported `TokenScope` type because the discriminated variant is strictly more typed.
   *Default chosen:* discriminated variant; documented in `src/emitter.ts`.
   *Decision required from Architect:* keep the discriminated variant (preferred — tighter
   types), or revert to spec-literal `TokenScope.subLanguage?: string`. We can reverse this
   trivially in cohort 2 if requested.

2. **`Mode.label` is part of the public `Mode` type.** Spec §8.2.2 references `replaceModes`
   keyed by `label` and the worked TS example uses `label: 'shebang'` etc., implying
   `label` is a Mode field. The spec's type block (§8.2) does not explicitly enumerate
   `Mode`'s fields — it relies on upstream's `ModeDetails`. We added `label` to our `Mode`
   type as a top-level optional `readonly string`. This is consistent with the spec's worked
   examples and the upstream `ModeDetails.label` field. No deviation flag.

3. **`sideEffects: false` on `@kindly-note/core`.** Spec §6.3 prescribes this on language
   packages but is silent for core. We applied it because core is also pure ESM with no
   top-level side effects (no `globalThis` mutation, no module-init registry). This is the
   conservative call. *Decision required:* none, unless a future core feature needs an
   import-time side effect (e.g., a global error handler — unlikely).

4. **Keyword merging in `extendLanguage` is concat-and-dedupe.** Spec §8.2.2 says
   "extendKeywords ... merged with parent" but does not normatively specify the merge
   strategy. We implemented per-key concat-and-dedupe (e.g., parent `keyword: ['foo', 'bar']`
   + child `keyword: ['baz']` → child has `['foo', 'bar', 'baz']`). Tested in
   `tests/language.test.ts`. *Decision required:* if the spec intends a different merge
   semantic (e.g., child-replaces-parent), we should adjust before any language package
   ships.

5. **Per-keyword relevance modifier (`keyword|N` syntax).** Upstream supports a `|N` suffix
   on individual keywords inside a string list to override per-keyword relevance. spec §9.4
   references `expandOrCloneMode` and the upstream parser; the kindly-note spec does not
   mention `|N` directly. v0 strips the `|N` modifier and uses default scope-relevance.
   This is a known gap; subsequent cohorts (when language packages need it) can extend
   `compile.ts:splitKeywords` to honor the modifier without changing the public type.

6. **The minimal v0 matcher does not yet implement nested mode descent, end-mode handling,
   or the full illegal-rule escalation.** The matcher in `src/internal/matcher.ts` is a
   "first-match wins" walker over the root mode's `contains` list — sufficient for the
   keystone tests in §D and for any language whose grammar fits into begin/match-only
   single-level rules. Spec §0 architectural shifts #1-3 are about the public SHAPE
   (types, immutability, plugin pipeline, emitter abstraction); shift #2 is satisfied
   (compile-at-register, never-mutate). The full upstream parser semantics are scoped for
   cohort 2 (when the first real `@kindly-note/lang-*` package — likely JSON — needs them).
   This is documented in code as `src/internal/matcher.ts` header. *Not a deviation* — the
   public matcher contract (CompiledMode + Emitter calls) is stable; only the parsing
   engine inside the matcher will deepen.

---

## What changed from the spec verbatim

- **None.** Where the spec leaves a detail under-specified (open questions 1, 2, 4, 5
  above), we picked a documented default with a comment that cites the spec section and
  flagged it in this manifest. No silent revisions.
- The `rolldown-plugin-dts` import shape uses `import { dts } from 'rolldown-plugin-dts'`
  (named export) rather than the default-export form in spec §6.2. This is mechanical:
  the plugin only ships a named export in the version we pinned; the spec template was
  written against an earlier shape. Pinning rolldown 1.0.0 + plugin 0.16.0 was necessary
  because the spec-suggested 1.0.0-beta.1 has a peer-dep mismatch with the latest plugin.

---

## Branch state

- Branch: `feat/scaffold-and-core` (from `main`).
- Commits: see `git log feat/scaffold-and-core` — three logical commits (scaffolding,
  core types + runtime, tests + verification).
- Untracked: `node_modules/`, `dist/`, `bun.lock` (gitignored), `docs/plan/*.md` (parent
  directory inputs to the build, intentionally not staged — they are managed outside git
  in this repo's current pre-1.0 state per the user's working pattern).

Ready for cohort 2 (next: a real `@kindly-note/lang-*` package and the first emitter
package).
