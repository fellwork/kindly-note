# @kindly-note/core

## 0.1.0

### Minor Changes

- 167dfc9: Matcher and `extendLanguage` enhancements required by the cohort-4 keystone (spec §8.2):

  1. **`variants` expansion at compile time** (spec §9.4 / cohort-3a open question #6). Mirrors upstream `expandOrCloneMode`: a Mode with `variants: [...]` is replaced by N sibling modes, each merged with the parent fields. lang-javascript uses this for `CLASS_OR_EXTENDS` (with-extends vs without) and `FUNCTION_DEFINITION` (named vs anonymous).

  2. **Per-capture-group `beginScope` emit** (spec §8.2.1 / cohort-3a open question #4). When `match` (or `begin`) is an array AND `scope` (or `beginScope`) is a `ScopeMap`, the matcher emits each numbered capture group with its own scope. Mirrors upstream `emitMultiClass`. lang-javascript's class-declaration mode (`match: [/class/, /\s+/, IDENT_RE, ...]`) is the canonical use.

  3. **Cycle resolution in `compileLanguage`** (spec §9.1). lang-javascript's SUBST ↔ TEMPLATE_STRING mutual recursion required a per-call memoisation map keyed on Mode reference. Same Mode reference compiles to the same CompiledMode within one call; cyclic references resolve to the placeholder.

  4. **Ref-substitution in `extendLanguage`** (spec §8.2). The fundamental keystone fix: when `extendPoints.PARAMS_CONTAINS: (current) => [...current, DECORATOR]` produces a new array, every Mode in the parent's contains-tree that references the OLD array gets its `contains` field rewritten to point at the NEW array. Without this, the JS PARAMS Mode in TS's contains would still see the parent's pre-extension PARAMS_CONTAINS, and decorators inside function parameter lists would be invisible. The walk uses a WeakMap-based memo that handles cycles.

  These four enhancements together make the typed `extendLanguage()` API a real architectural alternative to upstream's array-mutation pattern. The 18-test `keystone.test.ts` in `@kindly-note/lang-typescript` validates them end-to-end.

- c866f88: Initial release of `@kindly-note/loader-fetch` — the Workers/Edge-friendly dynamic language loader (spec §4.2.3). Fetches a serialized JSON `LanguageDefinition` from a configurable URL prefix, deserializes RegExp-shaped slots into `RegExp` instances, and returns a deep-frozen `LanguageDefinition` ready to register with `createHighlighter()`. Optional `Map`-based cache short-circuits repeat loads. Uses only `globalThis.fetch`; zero Node built-ins.

  `@kindly-note/core` gains a new public surface to support the loader contract:

  - `LanguageLoader` interface (spec §4.2.1) — shared by both v0 loader packages.
  - `SerializedLanguageDefinition` / `SerializedMode` / `SerializedRegExp` types (spec §4.2.3) — the JSON wire format.
  - `deserializeLanguage()` — reconstructs a `LanguageDefinition` from its serialized form, throwing `LanguageLoadError` on shape failure.
  - `LanguageLoadError` — typed error class for loader failures, preserving the original `cause`.

### Patch Changes

- a864e29: Deepen the internal matcher: nested mode descent, end-mode handling
  (`endsWithParent`, `endSameAsBegin`), illegal-rule escalation, keyword
  detection, sub-language recursion, multi-regex union for performance.
  Public API unchanged.
- 167dfc9: Workspace src-resolution config — DX fix.

  Adds a root `vitest.shared.ts` that maps every `@kindly-note/*` import to the package's `packages/*/src/index.ts` for tests (plus the `core/regex` and `core/errors` subpath imports). Every per-package `vitest.config.ts` now extends the shared config via `mergeConfig`. Build-time resolution (rolldown for production consumers) is unchanged.

  Resolves the cohort-3b state-file lesson "Workspace src-resolution is a real v0 DX issue." Before this change, tests for downstream packages (e.g. `lang-json` consuming `lang-pack-ecmascript`'s runtime `EXTENDED_NUMBER_MODE` export) failed until `bun run build` ran, because Bun's workspace symlinks resolve via `package.json#main` → `dist/index.js`. After this change, `bun run test` works on a fresh checkout without any prior build step.

  Verified: deleting all `packages/*/dist/` directories and running `bun run test` from the repo root produces 235/235 passing tests across all 7 packages.
