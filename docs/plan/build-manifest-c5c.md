# Build manifest — Cohort 5c: `@kindly-note/loader-fetch` + `@kindly-note/loader-dynamic-import`

**Date:** 2026-05-08
**Builder:** Cohort 5c (kindly-note modernize track)
**Branch:** `feat/loaders` (from `main` at `17c645c`)
**Spec contract:** `docs/plan/architect-spec.md` (§1.2 rows for both loader packages; §4 — language pack delivery, all 4 runtimes; §9 — compilation timing).
**Depends on:** `@kindly-note/core` (loader contract additions in this cohort), `@kindly-note/lang-json` (used as the dynamic-import test fixture), `@kindly-note/emitters-html` (used in end-to-end tests).

This cohort ships kindly-note's two v0 dynamic-load paths, validating spec §4.2 end-to-end:

- **`@kindly-note/loader-dynamic-import`** — uses native dynamic `import()`. Targets Node, modern browsers, Deno, Bun.
- **`@kindly-note/loader-fetch`** — uses `globalThis.fetch` to pull a pre-serialized JSON `LanguageDefinition` from a URL prefix. Targets Workers, Edge, browsers, Deno, Bun.

Both share a single `LanguageLoader` interface exported from `@kindly-note/core` (per dispatch §C: "the same nominal type from `@kindly-note/core`"). Both wrap underlying transport / shape failures in a typed `LanguageLoadError`, preserving the original `cause`.

---

## Scope summary

### Package A — `@kindly-note/loader-dynamic-import`

ESM-only language loader that uses native dynamic `import()` to resolve a specifier to a `LanguageDefinition`. Defaults: short names like `'rust'` resolve to `'@kindly-note/lang-rust'`; package-path-shaped specifiers (starting with `@` or containing `/`) pass through verbatim. Two override knobs:

- `importer?: (specifier) => Promise<unknown>` — replaces the underlying `import(...)` call. Used by tests and custom registries.
- `resolveSpecifier?: (identifier) => string` — transforms the identifier before passing to `importer`. Aligns with spec §4.2.2's example.

Initialization is synchronous (the `LanguageLoader` is returned immediately); only `load()` is async. Loaded definitions are deep-frozen before return (idempotent — language packages already freeze, but a custom `importer` returning a fresh object gets the freeze).

### Package B — `@kindly-note/loader-fetch`

ESM-only language loader that uses `globalThis.fetch` to pull a serialized JSON `LanguageDefinition` from `${baseUrl}/${specifier}.json`. Configurable: `baseUrl` (required), `fetcher?: typeof fetch` (override; defaults to `globalThis.fetch`), `cache?: Map<string, LanguageDefinition>` (optional; second + subsequent calls hit the cache).

Cache semantics are conservative — only successful loads populate the cache, so a transient 500 won't poison subsequent retries. Trailing slash on `baseUrl` is tolerated and de-duplicated. Specifier is `encodeURIComponent`'d for URL safety.

Both loaders surface failures as `LanguageLoadError` (from `@kindly-note/core/errors`), preserving the original `cause` for diagnostics.

### Cross-cutting: `@kindly-note/core` loader contract additions

Spec §4.2.1 names the `LanguageLoader` contract location as `packages/core/src/loader.ts`. This cohort adds it:

- New module `packages/core/src/loader.ts` — exports `LanguageLoader`, `SerializedLanguageDefinition`, `SerializedLanguageBody`, `SerializedRegExp`, `SerializedRegexLike`, `SerializedKeywords`, `SerializedMode`, and the `deserializeLanguage()` function.
- `packages/core/src/errors.ts` — adds `LanguageLoadError` class (preserves `cause`, includes `specifier` field).
- `packages/core/src/index.ts` — re-exports the loader types and `deserializeLanguage`.

The `SerializedLanguageDefinition` envelope is versioned (`format: 'kindly-note/v0'`) so future shape changes don't break deployed CDN artifacts. v0 simplifies spec §4.2.3 slightly: the serialized form is the source `LanguageDefinition` JSON, not a fully precompiled artifact. Compilation runs at register time (spec §9.1) regardless. A future precompiled-artifact format can ship under a new `format` tag without breaking the v0 envelope.

---

## Files created / modified

### Workspace-level

- `tsconfig.json` — added `{ path: './packages/loader-dynamic-import' }` and `{ path: './packages/loader-fetch' }` references.
- `vitest.shared.ts` — added `'loader-dynamic-import'` and `'loader-fetch'` to the `@kindly-note/*` → `src/index.ts` alias list.

### `packages/core/`

- `src/loader.ts` (new) — `LanguageLoader` interface, `Serialized*` JSON wire types, `deserializeLanguage()` walker.
- `src/errors.ts` — added `LanguageLoadError` class.
- `src/index.ts` — re-exports `deserializeLanguage`, `LanguageLoader`, and the `Serialized*` types.
- `tests/loader.test.ts` (new) — 10 tests for the `deserializeLanguage` deserializer (RegExp reconstruction, nested contains, `'self'` markers, `$pattern` keywords, shape-error throws).

### `packages/loader-dynamic-import/`

- `package.json`, `tsconfig.json`, `tsconfig.test.json`, `rolldown.config.ts`, `vitest.config.ts` — standard layout, ESM-only, `sideEffects: false`, `platform: 'neutral'`, externalizes `@kindly-note/*`.
- `src/index.ts` — `createDynamicImportLoader` + `DynamicImportLoaderOptions`. Re-exports `LanguageLoader` from `@kindly-note/core`.
- `tests/loader.test.ts` — 14 tests across 4 describe blocks:
  - Initialization (synchronous return, default-options behavior).
  - Stub-importer end-to-end (default-export shape, end-to-end registration via `createHighlighter`, default specifier resolution, custom resolver, naked-LanguageDefinition fallback).
  - Error handling (importer rejection, cause preservation, wrong-shape import, null import, empty specifier).
  - Real dynamic import integration (`await import('@kindly-note/lang-json')`).

### `packages/loader-fetch/`

- `package.json`, `tsconfig.json`, `tsconfig.test.json`, `rolldown.config.ts`, `vitest.config.ts` — same template; `tsconfig*.json` add `"DOM"` to `lib` so TypeScript can resolve `fetch` / `Response` types (the runtime usage is `globalThis.fetch`, no DOM API actually called).
- `src/index.ts` — `createFetchLoader` + `FetchLoaderOptions`. Re-exports `LanguageLoader`, `SerializedLanguageDefinition`, `SerializedRegExp` from `@kindly-note/core`.
- `tests/loader.test.ts` — 17 tests across 4 describe blocks:
  - Initialization (synchronous return, missing-baseUrl throw, missing-fetch throw).
  - Happy path (URL build, RegExp reconstruction, trailing-slash handling, end-to-end Highlighter integration with a JSON-like serialized payload).
  - Caching (cache hit returns same reference, no-cache default, distinct entries per specifier).
  - Error handling (fetcher rejection + cause preservation, non-OK status, bad JSON, wrong shape, empty specifier, no-cache-on-failure).
  - Includes a local test-only `serializeLanguage` helper that produces the v0 wire format from a `LanguageDefinition`. v0 doesn't ship a published serializer (per dispatch §9: "v0 doesn't need a serializer tool, just the loader") — when a real serializer ships in a later cohort, the helper can be replaced with an import.

### `.changeset/`

- `loader-dynamic-import-initial.md` — `'@kindly-note/loader-dynamic-import': minor`.
- `loader-fetch-initial.md` — `'@kindly-note/loader-fetch': minor` AND `'@kindly-note/core': minor` (for the loader contract additions in core).

---

## Public exports

### `@kindly-note/loader-dynamic-import`

- `createDynamicImportLoader(opts?: DynamicImportLoaderOptions): LanguageLoader`
- `DynamicImportLoaderOptions` (interface)
- `LanguageLoader` (re-exported from `@kindly-note/core`)

### `@kindly-note/loader-fetch`

- `createFetchLoader(opts: FetchLoaderOptions): LanguageLoader`
- `FetchLoaderOptions` (interface)
- `LanguageLoader`, `SerializedLanguageDefinition`, `SerializedRegExp` (re-exported from `@kindly-note/core`)

### `@kindly-note/core` (new in this cohort)

- `LanguageLoader` (interface)
- `SerializedLanguageDefinition`, `SerializedLanguageBody`, `SerializedRegExp`, `SerializedRegexLike`, `SerializedKeywords`, `SerializedMode` (interfaces / types)
- `deserializeLanguage(input: unknown): LanguageDefinition<unknown>`
- `LanguageLoadError` (class, exported from `@kindly-note/core/errors` and `@kindly-note/core`)

---

## Acceptance gates (dispatch §D, §E, §F)

### §D — Acceptance gates

| # | Gate | Where verified | Status |
|---|---|---|---|
| 1 | All 235 prior tests still pass | `bun run test` workspace — total 276 (+41) | PASS |
| 2 | Dynamic-import loader, end-to-end with stub importer | `loader-dynamic-import/tests/loader.test.ts > 'loads a LanguageDefinition via a stub importer'` | PASS |
| 3 | Dynamic-import loader, real `await import()` path | `loader-dynamic-import/tests/loader.test.ts > 'real dynamic import (integration)'` — works under Vitest's Node env via the `vitest.shared.ts` alias plugin (no `it.skip` needed) | PASS |
| 4 | Fetch loader, stub fetcher → deserialize → register → highlight | `loader-fetch/tests/loader.test.ts > 'the loaded LanguageDefinition can drive a Highlighter end-to-end'` | PASS |
| 5 | Fetch loader, cache hit on second call | `loader-fetch/tests/loader.test.ts > 'returns the cached definition on second call without re-fetching'` (asserts `fetchCount === 1` after two loads) | PASS |
| 6 | Both loaders, error handling produces `LanguageLoadError` | Both packages have a dedicated `error handling` describe block; each test asserts `instanceof LanguageLoadError` and (where applicable) preserves the original `cause` | PASS |
| 7 | `LanguageLoader` interface is shared between both packages | Both packages re-export `LanguageLoader` from `@kindly-note/core`; the type is defined once in `packages/core/src/loader.ts` | PASS |

### §E — Verification commands

| Command | Status |
|---|---|
| `bun install` | PASS — 250 packages |
| `bun run typecheck` | PASS — 0 errors |
| `bun run --filter '@kindly-note/loader-fetch' build` | PASS — `dist/index.js` (3.03 kB) + `dist/*.d.ts` (~480ms) |
| `bun run --filter '@kindly-note/loader-dynamic-import' build` | PASS — `dist/index.js` (3.46 kB) + `dist/*.d.ts` (~380ms) |
| `bun run --filter '@kindly-note/loader-fetch' test` | PASS — 17/17 |
| `bun run --filter '@kindly-note/loader-dynamic-import' test` | PASS — 14/14 |
| `bun run test` (workspace) | PASS — **276/276** across 9 packages |
| `bun run lint` | PASS — 103 files, 0 errors |
| grep for `node:` / `from 'fs'` / `from 'path'` in loader source | PASS — 0 matches |

---

## Test count

| Package | Before | After | Delta |
|---|---|---|---|
| `@kindly-note/core` | 61 | **71** | +10 (deserializer tests) |
| `@kindly-note/lang-helpers` | 64 | 64 | 0 |
| `@kindly-note/emitters-html` | 31 | 31 | 0 |
| `@kindly-note/lang-pack-ecmascript` | 32 | 32 | 0 |
| `@kindly-note/lang-json` | 18 | 18 | 0 |
| `@kindly-note/lang-javascript` | 11 | 11 | 0 |
| `@kindly-note/lang-typescript` | 18 | 18 | 0 |
| `@kindly-note/loader-dynamic-import` | — | **14** | +14 |
| `@kindly-note/loader-fetch` | — | **17** | +17 |
| **Workspace total** | **235** | **276** | **+41** |

---

## What this cohort proves (spec §4)

Spec §4 prescribes "language pack delivery — all 4 runtimes":

> For markdown previewers, code playgrounds, and editors that load language definitions on demand, kindly-note ships two loaders.

This cohort PROVES the contract end-to-end:

- **`@kindly-note/loader-dynamic-import`** loads `@kindly-note/lang-json` via a real `await import()` and the loaded definition drives `createHighlighter` to produce HTML output. The loader returns the same frozen object as the static-import default export.
- **`@kindly-note/loader-fetch`** takes a JSON-shaped serialized payload (with `RegExp` slots tagged `{ __type: 'regexp', source, flags }`), deserializes it to a usable `LanguageDefinition`, and the result drives `createHighlighter`. The fetch loader is fully Workers/Edge-friendly (`globalThis.fetch`, no `node:*`, no dynamic `import()`).
- Both loaders share a single `LanguageLoader` interface from `@kindly-note/core`. A consumer can write code against the interface and swap loaders by environment without changing the call site.
- Both wrap their underlying failures in `LanguageLoadError` with `cause` preservation. Application code branches on a single error type for both transport and shape failures.

The fetch-loader's wire format (`format: 'kindly-note/v0'`) is versioned. A future precompiled-artifact format can ship as `format: 'kindly-note/v1-compiled'` (or similar) without breaking deployed v0 artifacts on existing CDN deployments.

---

## Open questions / spec ambiguities (none silent)

These are surfaced explicitly per the dispatch's "no silent revisions" rule.

### #1 — Serializer tool not shipped (per dispatch instruction)

Per dispatch §9: "v0 doesn't need a serializer tool, just the loader. Pre-serialization tooling can come later." The cohort ships only `deserializeLanguage`. The loader-fetch test file contains a local `serializeLanguage` helper sufficient for testing the deserializer round-trip; it's not exported from any package.

**Followup:** when the build pipeline (spec §6) grows a precompiled-artifact path, ship a published `serializeLanguage` (likely as a CLI under `@kindly-note/build-tools` or as a function in `@kindly-note/core`).

### #2 — Wire format simplified vs. spec §4.2.3

Spec §4.2.3 names the serialized envelope `SerializedLanguageDefinition` and says it carries "the compiled mode tree as JSON-serializable data." The cohort ships v0 carrying the SOURCE definition (not the precompiled artifact) — compilation runs at register time as for static imports (spec §9.1). The trade-off:

- **For (cohort decision):** simpler to implement and test; smaller payload per language; lets consumers run different `compileLanguage` versions; aligns with §9.1's "compile at registration time" invariant.
- **Against:** Workers cold-start does the compile work on the device. Spec §4.2.3 cites this as the motivation for precompiled artifacts.

The envelope is versioned (`format: 'kindly-note/v0'`), so a future precompiled format can ship under `'kindly-note/v1-compiled'` without breaking deployed v0 artifacts.

**Followup:** ship the precompiled format when (a) a real perf benchmark shows Worker cold-start regression at language scale, AND (b) the `CompiledLanguage` JSON shape is stable enough to commit to a wire format.

### #3 — `loader-fetch` adds `"DOM"` to `lib` for `fetch` / `Response` types

`tsconfig.json` and `tsconfig.test.json` for `@kindly-note/loader-fetch` set `"lib": ["ES2022", "DOM"]`. The runtime usage only references `globalThis.fetch` and the `Response` value (no DOM API calls), but TypeScript needs the `fetch` symbol declared. `lib.dom.d.ts` is the declaration source TS uses. This is a TYPE-LEVEL choice; rolldown's `platform: 'neutral'` ensures the bundle has zero DOM-API usage at runtime.

**Followup:** consider switching to `@types/node` minus `"DOM"` once Node fully ships `fetch` types in `lib.es2024.d.ts` (TS 5.4+ partially does this, but `Response` / `Request` are still DOM-lib-only across all current TS versions). For v0, the DOM-lib pull is invisible to runtime consumers.

### #4 — Default `resolveSpecifier` behaviour: `@-prefixed` and `path/`-containing identifiers pass through

Spec §4.2.2 implementation example uses `'@kindly-note/lang-' + identifier` as the default. The cohort generalises: an identifier already starting with `@` or containing `/` passes through unchanged. This lets users mix short names (`'rust'`) and full package paths (`'@my-org/lang-foo'`) without a custom `resolveSpecifier`. The behaviour is documented in the JSDoc on `resolveSpecifier`.

**Followup:** none. This is a strict superset of the spec's example; the §4.2.2 example case (`'rust'` → `'@kindly-note/lang-rust'`) is preserved.

### #5 — `LanguageLoader.load()` returns `LanguageDefinition<unknown>`, not `LanguageDefinition<TExt>`

Per dispatch §C, the loader's return is `Promise<LanguageDefinition<unknown>>`. The typed extension surface (`TExtensible`) is erased at the loader boundary because the loader doesn't know the language's identity at compile time. Users who need the typed `extensible` (e.g., to extend a dynamically-loaded `lang-javascript`) should static-import the language package — that path preserves the full type.

**Followup:** none in v0. A v1 enhancement could add `loader.loadTyped<T>(specifier): Promise<LanguageDefinition<T>>` that takes a runtime type assertion, but the keystone tests already cover the static-import path's type fidelity.

### #6 — `HighlighterWithLoader.highlightAsync` (spec §4.2.1) NOT implemented in this cohort

Spec §4.2.1 also names a `HighlighterWithLoader` interface that adds `highlightAsync(code, options)` — auto-loads on demand if a language isn't registered. This cohort ships only the `LanguageLoader` half. Wiring the loader into `createHighlighter` (so a missing-language call triggers `loader.load()`) is a separate change to `@kindly-note/core`'s `Highlighter`.

**Followup:** add `loader: LanguageLoader` to `HighlighterOptions` and `highlightAsync()` to `Highlighter` in a follow-up cohort. The current cohort gives users a working loader they can call manually:

```ts
const loader = createDynamicImportLoader();
const def = await loader.load('rust');
const hl = createHighlighter({ languages: [def] });
hl.highlight(code, { language: 'rust' });
```

That covers the static-load-then-register path. The "load on first call" auto-wire is convenience, not capability.

---

## What changed from the spec verbatim

### Loader contract location: `core/src/loader.ts` (matches spec §4.2.1 inline comment)

Spec §4.2.1 includes the inline `// contract — packages/core/src/loader.ts`. The cohort places the contract there. The `LanguageLoader` interface is exported via `@kindly-note/core`'s top-level index for convenience.

### `DynamicImportLoaderOptions` exposes BOTH `importer` AND `resolveSpecifier`

Dispatch §C spec'd `importer`; spec §4.2.2 spec'd `resolveSpecifier`. Both are useful for distinct purposes (testing vs. identifier-shaping), and they compose without conflict. Both are exposed.

### `createFetchLoader` validates `baseUrl` and `fetcher` eagerly at create-time

Spec §4.2.3 doesn't explicitly mandate eager validation. The cohort fails fast on a missing `baseUrl` or missing `fetcher` (when `globalThis.fetch` is undefined) so misconfigured deployments error at module init rather than first `load()`. This is a strict addition; a valid construction sees no behavior change.

### Cache semantics: only successful loads populate the cache

Spec §4.2.3 doesn't specify cache failure-mode semantics. The cohort populates the cache only AFTER a successful fetch + deserialize. A transient 500 doesn't poison subsequent retries. Documented inline.

### `LanguageLoadError` carries `specifier` field + `cause`

Spec §4.2 doesn't mandate a typed loader error class. The cohort ships `LanguageLoadError` (in `@kindly-note/core/errors`) so application code can branch on a single error type. The class preserves the original `cause` per ECMAScript Error.cause spec.

---

## Branch state

- Branch: `feat/loaders` (from `main` at `17c645c`).
- Logical commits (in order):
  1. `core: LanguageLoader contract + SerializedLanguageDefinition + deserializer.` (core changes only — loader.ts, errors.ts addition, index.ts re-exports, tests).
  2. `loader-dynamic-import: createDynamicImportLoader (spec §4.2.2).` (full new package + 14 tests + workspace tsconfig + vitest.shared updates).
  3. `loader-fetch: createFetchLoader (spec §4.2.3).` (full new package + 17 tests).
  4. `Build manifest + changesets.`
- The branch builds on cohorts 1+2+3a+3b+4. `bun run test` runs all 276 tests across 9 packages without a `bun run build` precondition.

---

**STATUS: DONE.** Both loader packages are shipped. All 7 dispatch §D acceptance gates pass. All 9 verification commands pass. The 235 prior tests still pass; the workspace total is now 276. The architectural bet of spec §4 — "two loaders cover all 4 runtimes via a shared `LanguageLoader` interface" — is **VALIDATED END-TO-END**.
