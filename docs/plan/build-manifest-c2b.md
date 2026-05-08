# Build manifest — Cohort 2b: `@kindly-note/emitters-html`

**Date:** 2026-05-08
**Builder:** Cohort 2b (kindly-note modernize track)
**Branch:** `feat/emitters-html`
**Spec contract:** `docs/plan/architect-spec.md`

This manifest documents what cohort 2b produced, with verification evidence
for each dispatch acceptance gate (§C 1-7) and verification command (§D).

---

## Files created

### `packages/emitters-html/`

- `package.json` — `@kindly-note/emitters-html` 0.0.1, ESM, `sideEffects: false`,
  `peerDependencies: @kindly-note/core: workspace:*`. `exports` map declares
  one entry point + `./package.json`. spec §6.3.
- `tsconfig.json` — extends root `tsconfig.base.json`, project-references
  `../core`, emits to `./dist`.
- `tsconfig.test.json` — sibling config for Vitest (mirrors core's pattern;
  `noEmit`, `composite: false`, `types: ['node']`).
- `rolldown.config.ts` — single-entry build, `platform: 'neutral'`, `external:
  [/^@kindly-note\//]` so the core peer is never bundled.
- `vitest.config.ts` — `environment: 'node'` (no DOM globals — emitter is a pure
  string emitter, spec §1.2 / §5.1).

### `packages/emitters-html/src/`

- `index.ts` — public surface: `htmlEmitter`, `htmlEmitterWith`, `DEFAULT_CLASS_PREFIX`,
  `HtmlEmitterConfig` (type), plus `htmlEscape` and `toClassNames` re-exported
  for downstream emitters that want to share the algorithm.
- `emitter.ts` — `htmlEmitterWith(config)` factory + `htmlEmitter` default
  factory; the per-instance `HtmlEmitter` class implementing
  `Emitter<string>`. Two-pass design: engine drives the six-method contract
  building an internal token tree, then `render()` walks that tree once
  emitting HTML strings. spec §5.
- `escape.ts` — `htmlEscape(text)`. Escapes `& < > " '` per the upstream
  WHATWG-aligned algorithm (Scout §5).
- `scope-to-class.ts` — `toClassNames(scope, prefix)`. Mirrors upstream's
  `scopeToCSSClass` algorithm verbatim: `language:foo` → `language-foo`
  (prefix-free wrapper); tiered `a.b.c` → `<prefix>a b_ c__`; simple
  `keyword` → `<prefix>keyword`. spec §7.4 / Scout §5.

### `packages/emitters-html/tests/`

- `escape.test.ts` — 6 tests covering `htmlEscape` (ASCII passthrough, five
  HTML metacharacters, no double-escaping, the `<script>` case from
  acceptance D-4, the dispatch §D-4 worked attack string).
- `scope-to-class.test.ts` — 7 tests covering `toClassNames` (simple,
  tiered with the spec §7.4 verbatim case, two/three/four-tier nesting,
  `language:` form under multiple prefixes, `language:` only matches
  the prefix branch when at the start of the scope).
- `htmlEmitter.test.ts` — 10 tests covering acceptance gates D-1 (default
  `kn-` prefix), D-4 (escaping), D-5 (sub-language boundary using a
  fabricated `TokenStream`, never an `Emitter`), D-6 (TokenStream-only
  signature), and the spec §5.6 worked example end-to-end.
- `htmlEmitterWith.test.ts` — 8 tests covering acceptance gate D-2 (`hljs-`
  opt-in, override is per-factory not global, fallback to engine
  `EmitterOptions.classPrefix`, fallback to `kn-` default), gate D-3 (tiered
  scope mapping verbatim under `kn-` AND `hljs-`), gate D-5 (sub-language
  wrapper class is `language-<name>` regardless of bound prefix).

### Root / changeset

- `tsconfig.json` — root `references` updated to add `./packages/emitters-html`.
- `.changeset/emitters-html-initial.md` — minor changeset for
  `@kindly-note/emitters-html` per dispatch §F.

---

## Public exports from `@kindly-note/emitters-html`

### Runtime exports (named)
- `DEFAULT_CLASS_PREFIX: string` (the literal `'kn-'`)
- `htmlEmitter: EmitterFactory<string>` (default factory, kn- prefix)
- `htmlEmitterWith(config?: HtmlEmitterConfig): EmitterFactory<string>`
- `htmlEscape(value: string): string` (re-exported for downstream emitters)
- `toClassNames(scope: string, prefix: string): string` (re-exported for
  downstream emitters)

### Type-only exports
- `HtmlEmitterConfig` — `{ readonly classPrefix?: string }`

---

## Verification log

Every command run from the worktree root, `bun@1.3.8`. All commands required
by dispatch §D are listed; all pass.

| Command | Status |
|---|---|
| `bun install` | ✅ Resolved 334 packages (workspace link to `@kindly-note/core` confirmed). |
| `bun run typecheck` (`tsc -b`) | ✅ Clean — 0 errors. References both core and emitters-html. |
| `bun run --filter '@kindly-note/emitters-html' build` (rolldown) | ✅ Produces `dist/index.js` (4.60 kB), `dist/index.d.ts` (2.47 kB), `.js.map`, `.d.ts.map`. Build time ~370 ms. |
| `bun run --filter '@kindly-note/emitters-html' test` (Vitest) | ✅ 31/31 passing across 4 test files (escape, scope-to-class, htmlEmitter, htmlEmitterWith). |
| `bun run lint` (Biome) | ✅ Clean — 38 files checked, 0 errors after a one-shot `biome format --write` to normalize Windows line endings (no semantic content changes; only EOL — verified with `git diff --numstat`). |
| `bun run test` (workspace) | ✅ All workspaces green: 42 core tests + 31 emitters-html tests = 73 total. |

### Sample build output

```
dist/index.js                  4.60 kB
dist/index.js.map             13.96 kB
dist/index-DvQfkZc-.d.ts      2.47 kB  (re-chunked .d.ts entry)
dist/index-DvQfkZc-.d.ts.map  0.44 kB
```

---

## Dispatch §C acceptance gates

| # | Gate | Test file(s) | Status |
|---|---|---|---|
| 1 | Default prefix is `kn-`: `<span class="kn-keyword">class</span>` | `tests/htmlEmitter.test.ts` ("emits '<span class=\"kn-keyword\">class</span>' for the documented one-scope case") | ✅ PASS |
| 2 | Prefix override (`hljs-` opt-in is per-factory, not global) | `tests/htmlEmitterWith.test.ts` (4 tests under "prefix override") | ✅ PASS |
| 3 | Tiered scope mapping: `'title.class.inherited'` → `'kn-title class_ inherited__'` (verbatim) | `tests/htmlEmitterWith.test.ts` ("maps 'title.class.inherited' to 'kn-title class_ inherited__' under kn- (acceptance D-3)") + `tests/scope-to-class.test.ts` ("maps a tiered scope with verbatim trailing-underscore convention") | ✅ PASS |
| 4 | HTML escaping: `<script>` → `&lt;script&gt;` and the dispatch §D-4 worked string has no raw `<` or `>` | `tests/htmlEmitter.test.ts` (escape test) + `tests/escape.test.ts` (escape unit tests) | ✅ PASS |
| 5 | Sub-language boundary: parent renders a TokenStream with `class="language-json"` wrapping span, never reaches into a foreign emitter | `tests/htmlEmitter.test.ts` (sub-language tests, including "renders a TokenStream value passed via addSubLanguage with a wrapping language- span") | ✅ PASS |
| 6 | TokenStream-only signature for `addSubLanguage` — no Emitter overload | `tests/htmlEmitterWith.test.ts` ("the addSubLanguage signature accepts only a TokenStream — no Emitter overload"); enforced at type level by inheriting `Emitter<string>` from `@kindly-note/core` whose `addSubLanguage(stream: TokenStream, language: string): void` is the sole signature | ✅ PASS |
| 7 | No `hljs-` defaults anywhere except the opt-in path. `grep hljs- src/` finds zero literal class strings | `grep hljs- packages/emitters-html/src/` returns 4 matches, all inside JSDoc comments documenting the opt-in path. Zero literal class strings emitted with `hljs-` outside the user-supplied override. | ✅ PASS |

All seven gates green.

---

## Spec consistency notes

- **`addSubLanguage(stream, language)` argument order.** Cohort 1's `Emitter`
  contract in `packages/core/src/emitter.ts` has the signature
  `addSubLanguage(stream: TokenStream, language: string): void` — `stream`
  first, `language` second. We match that exactly. The dispatch text
  paraphrased it as `addSubLanguage(name, stream)`; we followed the actual
  core contract per the dispatch's instruction to "verify this against
  `packages/core/src/emitter.ts` before designing." Tests reflect the actual
  signature.

- **`TokenSubLanguage` discriminated variant.** Cohort 1 chose to add a
  `TokenSubLanguage` variant on `TokenNode` (`{ type: 'sub-language',
  language, stream }`) for type-narrowing convenience. Our internal
  `MutableScope.children` builder uses the same shape, and `freezeStream`
  emits the same shape on `toTokenStream()`. The `render()` path
  type-narrows on `node.type` — `'text'`, `'scope'`, `'sub-language'` — and
  emits accordingly. Note the public spec §5.2 only defines `TokenScope.subLanguage?: string`
  on the scope variant; if the Architect later reverts the discriminated
  variant per the cohort 1 manifest's open question #1, this emitter only
  needs `freezeStream`/`renderNode` updates: the public surface
  (`htmlEmitter`, `htmlEmitterWith`) is unaffected.

- **Engine-level `EmitterOptions.classPrefix` vs factory-level `htmlEmitterWith`
  override.** Spec §7.4 documents two paths to switch to `hljs-`:
  `createHighlighter({ classPrefix: 'hljs-' })` (engine-level) or a
  user-built factory `htmlEmitterWith({ classPrefix: 'hljs-' })` (factory-level).
  We implement both: when the factory was constructed with an explicit
  `classPrefix`, that wins; otherwise the engine's `opts.classPrefix`
  applies (with `kn-` as a defensive fallback if the engine supplies
  empty/undefined). This satisfies dispatch §C-2's "per-emitter, not global"
  requirement: two factories with different bound prefixes are independent
  regardless of the shared engine.

---

## What is NOT in this package

- **No `EmitterOptions.emitterConfig` consumption.** spec §5.1 reserves
  `emitterConfig?: unknown` as an out-of-band channel; this emitter doesn't
  need anything from it in v0. Adding consumption later is non-breaking.
- **No DOM access.** No `document`, `window`, `Node`, `Element`, etc. — this
  is a pure string emitter. Tests run in Vitest's `node` environment.
- **No `node:` builtins.** The package runs unmodified on browsers, Node,
  Deno, Bun, and Workers/Edge. spec §1.2 / dispatch constraint.
- **No CSS / theme files.** Themes ship from `@kindly-note/themes-default`
  (later cohort, spec §1.2). This emitter only emits class strings; CSS
  rules targeting those classes are someone else's package.

---

## Open questions / spec ambiguities encountered

These are the spots where the spec underspecified and I picked a documented
default. None require an Architect decision before this package ships, but
they are surfaced for visibility.

1. **Empty-string `EmitterOptions.classPrefix` from the engine — fall through
   to `kn-`?** If an upstream engine wired with `createHighlighter({
   classPrefix: '' })` calls `htmlEmitter.create({ classPrefix: '', language:
   'json' })`, do we honor the empty string ("user wants no prefix at all")
   or fall back to the `kn-` default? We chose the latter: empty-string
   engine prefix is treated as "engine didn't say", and the `kn-` default
   wins. Author intent for "no prefix" is expressed via
   `htmlEmitterWith({ classPrefix: '' })` (per-factory bound prefix), where
   the empty string IS honored. Documented in `emitter.ts` near the
   `classPrefix` resolution. *Decision required:* none, unless the
   Architect prefers a stricter "honor whatever the engine sends" rule.

2. **`renderHtml` does not emit a wrapping root `<span>`.** Upstream's
   `HTMLRenderer` doesn't either; the caller wraps in their own
   `<pre><code>`. We follow upstream verbatim. spec §5.6's expected output
   in the JSON example confirms this — no outer wrapper.

3. **Sub-language wrapper class uses `language-<name>` (no prefix).** spec
   §7.4 doesn't quote this directly, but spec §5.6's prose describes a
   sub-language insertion pattern, and Scout §5 + upstream `html_renderer.js`
   are explicit: `language:foo` strips into `language-foo` without the
   user prefix. We follow that. Tested in `htmlEmitter.test.ts` and
   `htmlEmitterWith.test.ts`. *Decision required:* none — this matches
   theme convention and the sub-language test in dispatch §C-5.

---

## What changed from the spec verbatim

- **None semantically.** The class strings, the scope-to-class algorithm,
  the prefix policy, the escape set, and the sub-language wrapper all match
  spec §5, §6.3, §7.4, and Scout §5 verbatim.

- **`addSubLanguage(stream, language)` argument order in tests.** Dispatch
  text said `(name, stream)`; cohort 1's actual `Emitter` contract is
  `(stream, language)` — same two values, different order. We matched the
  contract, per dispatch's "verify against `packages/core/src/emitter.ts`
  before designing" instruction.

---

## Branch state

- Branch: `feat/emitters-html` (from `main` at `9a57a10`).
- Working tree: 31 new files under `packages/emitters-html/`, plus
  `tsconfig.json` (root references), plus `.changeset/emitters-html-initial.md`.
- Commits: one logical commit (package skeleton + source + tests +
  manifest + changeset). Co-Author footer present.
- Untracked: `node_modules/`, `dist/`, `.tsbuildinfo` (gitignored).

Ready for cohort 3 (next: a real `@kindly-note/lang-*` package, or
`@kindly-note/emitters-hast`, or the `auto-detect` package).
