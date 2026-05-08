# Build manifest — Cohort 5a: `@kindly-note/legacy-plugin-adapter`

**Date:** 2026-05-08
**Builder:** Cohort 5a (kindly-note modernize track)
**Branch:** `feat/legacy-plugin-adapter` (from `main` at `17c645c`)
**Spec contract:** `docs/plan/architect-spec.md` (§3 — Legacy-plugin adapter design; §1.2 row `@kindly-note/legacy-plugin-adapter`; §2 — Modern plugin protocol).
**Depends on:** `@kindly-note/core` (cohorts 1 + 3a + 4 — Plugin protocol, PluginContext, runHook). Test fixtures additionally use `@kindly-note/lang-json` (cohort 3b) and `@kindly-note/emitters-html` (cohort 2b).

This manifest documents what cohort 5a produced, with verification evidence
for every Director-mandated acceptance gate from the dispatch.

---

## Scope summary

A single new package: `@kindly-note/legacy-plugin-adapter`. Wraps an upstream
`highlight.js@11`-shaped `HLJSPlugin` (six legacy `before:* / after:*` hooks
— Scout §2 verbatim) into a modern `@kindly-note/core` `Plugin` (spec §2).
Mutation semantics from upstream's `fire()` dispatch are preserved INSIDE
the adapter; the modern protocol stays pure (per-phase tree-shaking,
per-plugin error isolation).

The package is the v0 unblocker for the upstream plugin ecosystem
(`highlightjs-line-numbers.js`, `highlightjs-copy-clipboard`, `highlightjs-badge`,
etc.) — those plugins can be passed verbatim to kindly-note's modern
highlighter via `adaptLegacyPlugin(...)`.

---

## Files created

### `packages/legacy-plugin-adapter/`
- `package.json` — `@kindly-note/legacy-plugin-adapter` 0.0.1, ESM-only,
  `sideEffects: false`, single root export, peerDep on `@kindly-note/core`,
  devDeps on `@kindly-note/emitters-html` and `@kindly-note/lang-json` for the
  worked-example test only.
- `tsconfig.json` — extends `../../tsconfig.base.json`, `rootDir: ./src`,
  `outDir: ./dist`, `references: [{ path: ../core }]`, `lib: ["ES2022", "DOM"]`
  (DOM types only — no runtime DOM dependency; spec §3 + dispatch §F).
- `tsconfig.test.json` — sibling for Vitest, also pulls in `lib.dom`.
- `rolldown.config.ts` — single-entry build (`index`), `platform: 'neutral'`,
  `external: [/^@kindly-note\//]`, `dts()` plugin.
- `vitest.config.ts` — `environment: 'node'`, extends the shared root config
  (`vitest.shared.ts`) so `@kindly-note/*` imports resolve to sibling
  `src/index.ts` files for tests.

### `packages/legacy-plugin-adapter/src/`
- `index.ts` — public surface (spec §1.2 row): exports
  `adaptLegacyPlugin` (function) and `LegacyHLJSPlugin` (type) plus the four
  per-hook arg types as named type re-exports.
- `adapter.ts` — the adapter implementation. Cites spec §3.3 mapping table
  in a doc-comment header; per-section comments cite §3.3 row N at each
  hook-mapping site. Implements the closure-scoped state slot for
  `before:highlight`'s dual nature via `PluginContext.state` (a clean
  alternative to the WeakMap sketch in spec §3.4 — same semantics; the engine
  guarantees ctx is the same reference across `transformCode` and
  `shortCircuit` within a single call, see `highlighter.ts:143-154`).
- `types.ts` — the upstream-shaped `LegacyHLJSPlugin` interface (spec §3.2;
  Scout §2 verbatim from `highlight.js@11`'s `types/index.d.ts:126-134`),
  plus four named per-hook arg types so test code can import them by name.

### `packages/legacy-plugin-adapter/tests/`
- `adapter.test.ts` — **27 tests**. Covers dispatch §D acceptance gates 2-7:
  hook-to-phase mapping; mutation faithfulness (code rewrite, language
  redirect); short-circuit faithfulness; `after:highlight` value mutation +
  multi-plugin chain; mutation quarantine (frozen-result pass-through);
  error isolation (safe + throw modes; no stale shortCircuit slot after
  swallowed transformCode throw); element hooks; deprecated `*:highlightBlock`
  alias upgrade.
- `line-numbers.test.ts` — **4 tests**. The dispatch §D-6 worked example:
  end-to-end with a real language (`@kindly-note/lang-json`) and emitter
  (`@kindly-note/emitters-html`). Verifies `result.value` contains
  `hljs-line-numbers` markup; verifies plugin chain ordering (observer-before
  vs observer-after); verifies the legacy plugin object is unchanged after
  adaptation.
- `tests/fixtures/highlightjs-line-numbers.ts` — synthesis of the
  `highlightjs-line-numbers.js` upstream plugin shape. Deliberately faithful
  but NOT byte-copied (dispatch §D-7).

**Total tests in the new package: 31, all passing.**
**Total tests across the monorepo (after cohort 5a): 266 (235 + 31).**

### `.changeset/`
- `legacy-plugin-adapter-initial.md` — `'@kindly-note/legacy-plugin-adapter': minor`
  for the initial 0.0.1 release.

## Files modified

- `tsconfig.json` (root) — added `{ path: './packages/legacy-plugin-adapter' }`
  to `references` so `tsc -b` picks up the new package.
- `vitest.shared.ts` (root) — added `'legacy-plugin-adapter'` to
  `KINDLY_NOTE_PACKAGES` so the bare-package alias resolves
  `@kindly-note/legacy-plugin-adapter` → `packages/legacy-plugin-adapter/src/index.ts`
  for tests.

---

## Public exports from `@kindly-note/legacy-plugin-adapter`

### Runtime exports (named)
- `adaptLegacyPlugin(legacy: LegacyHLJSPlugin, name?: string): Plugin`

### Type exports (named)
- `LegacyHLJSPlugin` — spec §3.2 normative shape (the six hooks).
- `LegacyBeforeHighlightContext` — arg of `before:highlight`.
- `LegacyBeforeHighlightElementData` — arg of `before:highlightElement`.
- `LegacyAfterHighlightElementData` — arg of `after:highlightElement`.
- `LegacyBeforeHighlightBlockData` — arg of deprecated `before:highlightBlock`.
- `LegacyAfterHighlightBlockData` — arg of deprecated `after:highlightBlock`.

---

## The 6-hook mapping (spec §3.3 normative)

| Legacy hook                | Modern phase                           | Mutation handling |
|----------------------------|----------------------------------------|-------------------|
| `before:highlight`         | `transformCode` + `shortCircuit`       | Mutable `legacyCtx = { code, language }`; legacy hook mutates; adapter reads back code/language and stashes any `legacyCtx.result` in `PluginContext.state` for `shortCircuit` to return. |
| `after:highlight`          | `transformResult`                      | Shallow mutable copy via `{ ...result }`; legacy hook mutates `value` etc.; adapter returns the mutated copy as the next immutable result. |
| `before:highlightElement`  | `beforeElement`                        | Mutable `data = { el, language }`; legacy hook may mutate `language`; adapter returns `{ el, language: data.language }`. |
| `after:highlightElement`   | `afterElement`                         | Shallow-copy of `result` so legacy mutations of `result.value` don't escape into the engine's frozen result. |
| `before:highlightBlock`    | (deprecated alias) → `beforeElement`   | Mirror upstream `upgradePluginAPI`: when the modern hook is absent and the deprecated one is present, install a shim that calls the deprecated hook with `{ block: data.el, ... }`. Feed back any `block.language` mutation. |
| `after:highlightBlock`     | (deprecated alias) → `afterElement`    | Same pattern. When BOTH the deprecated and modern hooks are present, the modern wins; the deprecated is NOT also fired. |

---

## Acceptance gate verification (dispatch §D)

### D-1: All 235 prior tests still pass
- Verified: `bun run test` reports 31 + 61 + 31 + 64 + 32 + 11 + 18 + 18 = 266
  passing (the 31 from this cohort plus all 235 prior). Zero failures.

### D-2: Each of the 6 hooks fires in the right modern phase
- Six dedicated unit tests in `tests/adapter.test.ts > hook → modern-phase mapping`.
- Each asserts: (a) the right modern phase function is defined; (b) the
  unrelated phases are `undefined` (per-phase tree-shaking, spec §2.7).

### D-3: Mutation faithfulness (`before:highlight` rewrites code)
- Test `before:highlight mutation faithfulness > a "before:highlight" plugin
  that sets context.code = "replaced" mutates the engine's input` — uses two
  plugins: the first replaces `ctx.code`; the second observes it via its own
  `before:highlight`. The observed code IS `'replaced'` and `result.code`
  surfaces the same — proof the mutation reached the engine.
- Test `…can mutate context.language to redirect to another language` —
  registers two real languages and verifies the engine produced a result for
  the redirected language.

### D-4: Short-circuit faithfulness
- Test `before:highlight short-circuit > setting context.result short-circuits
  the engine; the result is what the plugin set` — passes a custom
  `HighlightResult` via `ctx.result`; engine returns exactly that result.
- Test `NOT setting context.result lets the engine run normally` — control.

### D-5: `after:highlight` mutation
- Test `after:highlight mutation > a plugin that rewrites result.value
  produces the mutated value in the engine return`.
- Test `multiple after:highlight plugins chain — plugin N sees plugin N-1's
  mutation` — verifies the modern pipeline correctly threads the new result
  object through the next plugin.

### D-6: `highlightjs-line-numbers` worked example (spec §3.5)
- `tests/line-numbers.test.ts > end-to-end: register highlighter + adapted
  line-numbers plugin → result.value contains hljs-line-numbers markup`.
- Cites spec §3.5 in test docstring + per-step comments. Uses a real
  language (`@kindly-note/lang-json`), a real emitter
  (`@kindly-note/emitters-html`), and `adaptLegacyPlugin(lineNumbersLegacy,
  'highlightjs-line-numbers')`. Asserts:
    - `result.value` contains `class="hljs-line-numbers"`.
    - `result.value` contains `<table`.
    - `result.value` contains `data-num="1"` and `data-num="2"` (one per
      input line).
- The fixture (`tests/fixtures/highlightjs-line-numbers.ts`) is shaped like
  upstream's `highlightjs-line-numbers.js` plugin but is NOT byte-copied
  (dispatch §D-7). It registers `after:highlight` and rewrites
  `result.value` into a `<table>`-of-`<tr>`-rows.

### D-7: No upstream code copied; mutation quarantined; modern protocol pure
- **No upstream code copied** — verified by inspection. The fixture is a
  short synthesis (~12 lines); the adapter is implemented from spec §3
  + Scout §2, not from upstream `src/highlight.js`.
- **Mutation quarantined** — three dedicated tests in `tests/adapter.test.ts >
  mutation quarantine`:
    1. `transformResult` returns a NEW `HighlightResult` object — does not
       mutate its (frozen) input.
    2. `transformCode` returns a NEW `CodeInput` — does not mutate its
       (frozen) input.
    3. `afterElement` shall not let legacy mutations of `result.value` leak
       back into the engine's frozen `HighlightResult`.
- **Modern protocol pure** — verified by inspection. The adapter's hooks
  return new objects (`{ ...input, code: ..., language: ... }`,
  `{ ...result }`); the input objects are never mutated by the adapter
  itself. Mutation is confined to the per-call `legacyCtx` shim object that
  exists only inside the adapter's hook closure.

---

## Verification commands run

| Command | Result |
|---|---|
| `bun install` | 0 failures, 334 packages installed (including 1 new workspace package). |
| `bun run typecheck` | `tsc -b` passes (8 packages, all green). |
| `bun run --filter '@kindly-note/legacy-plugin-adapter' build` | rolldown produces `dist/index.js` (3.15 kB), `dist/index.d.ts` chunked, sourcemap, types — exit 0. |
| `bun run --filter '@kindly-note/legacy-plugin-adapter' test` | 31/31 pass. |
| `bun run test` (workspace) | 266/266 pass (35 + 61 + 31 + 64 + 32 + 11 + 18 + 18 — old 235 baseline + 31 new). |
| `bun run lint` | `biome check .` passes (98 files, 0 errors). |

---

## Constraints honored (dispatch §F)

- **Spec §3 cited in code where the 6-hook mapping happens** — `src/adapter.ts`
  has a doc-comment header containing the full mapping table with `spec §3.3`
  citation, and per-section comments at each hook-mapping site cite the
  specific row (`spec §3.3 row N`).
- **Sync-only (v0 plugin protocol lock)** — the adapter contains no async
  primitives; every hook is a synchronous call.
- **No node-builtins, no DOM at runtime** — `tsconfig.json` adds `lib.dom`
  for type visibility ONLY (`HTMLElement`, `Element` in the legacy types);
  the adapter does not call any DOM API. `el` references are by-reference
  passthrough only.
- **Branch first; logical commits; Co-Author footer** — branch
  `feat/legacy-plugin-adapter` cut from `main` at `17c645c` before any work.

---

## Notes for cohort review / future cohorts

1. **`PluginContext.state` is the right home for the cross-phase shortCircuit
   slot.** The spec §3.4 sketch suggested a closure-scoped WeakMap; the
   actual core API exposes per-plugin per-call state via `PluginContext.state`
   (a `Map<string, unknown>` cleared between highlight calls — see
   `highlighter.ts:149`). The adapter uses a string key
   (`'@kindly-note/legacy-plugin-adapter:shortCircuit'`) so it cannot
   collide with arbitrary user-plugin keys. Same semantics as the WeakMap
   sketch; one less private data structure.

2. **The clone-on-adapt of `legacy` is a non-obvious correctness property.**
   Upstream's `upgradePluginAPI` mutates the user's plugin in-place; we
   clone first via `{ ...legacy }` so passing the same plugin object to two
   different highlighters does not double-shim. There is a test guarding
   this (`adapter.test.ts > does not mutate the caller-supplied legacy
   plugin object`).

3. **DOM types are in `lib.dom`, not at runtime.** `tsconfig.json` declares
   `lib: ["ES2022", "DOM"]` so `HTMLElement` / `Element` are visible to the
   type-checker. The adapter never reads any DOM property — `el` is treated
   as an opaque reference. Confirms with the spec acceptance for "no actual
   DOM dependency at runtime".

4. **Per-phase tree-shaking is preserved by the conditional hook
   installation pattern.** The adapter only assigns `adapted.transformCode`,
   `adapted.shortCircuit`, etc., when the corresponding legacy hook is
   present. A consumer that only uses `after:highlight` plugins gets a
   modern Plugin object whose other phase hooks are `undefined`, and the
   engine skips them at zero cost (spec §2.7).

5. **`shortCircuit` only runs when `transformCode` ran successfully.** If a
   thrown legacy hook is swallowed by safe-mode error isolation (spec §2.4),
   `PluginContext.state` never sees the slot, and `shortCircuit` returns
   `undefined`. There is a test for this (`error isolation > safe-mode after
   a transformCode throw: the adapter's shortCircuit returns undefined (no
   stale state)`).

---

**STATUS: DONE** — every dispatch §D acceptance gate green; all verification
commands (§E) green; manifest + changeset (§F) written.
