# kindly-note

A typed, modern, ESM-only syntax highlighter — a clean-break port of [highlight.js](https://highlightjs.org/) into a monorepo of small, tree-shakable, single-responsibility packages with a typed plugin protocol and a typed language-extension API. v0 is feature-complete; v1+ adds first-class markdown rendering with security-first defaults.

The architectural contract lives at [`docs/plan/architect-spec.md`](docs/plan/architect-spec.md) — read it before contributing.

---

## Quickstart

```sh
npm install @kindly-note/core @kindly-note/lang-javascript @kindly-note/emitters-html
```

```ts
import { createHighlighter } from '@kindly-note/core';
import javascript from '@kindly-note/lang-javascript';
import { htmlEmitter } from '@kindly-note/emitters-html';

const hl = createHighlighter({
  languages: [javascript],
  emitter: htmlEmitter,
});

const { value } = hl.highlight('const x: number = 1;', { language: 'javascript' });
console.log(value);
// → '<span class="kn-keyword">const</span> <span class="kn-variable">x</span> ...'
```

For DOM applications: `npm install @kindly-note/browser` and use `attachToDOM(hl)` to auto-highlight `<pre><code>` blocks.

---

## What's different from highlight.js

Eight architectural shifts versus upstream:

1. **Languages are values, not side effects.** Bundlers tree-shake unused languages by import graph alone — no global registry mutated on import.
2. **Compilation happens at registration time.** `registerLanguage(def)` returns an immutable `RegisteredLanguage` handle backed by a deep-frozen `CompiledLanguage`. Raw definitions are never mutated.
3. **Plugins are pure transforms in a typed pipeline.** No shared mutable context object. Per-plugin error isolation, per-phase tree-shaking. Sync-only in v0; async deferred to v1.
4. **Emitters are factories, not subclasses of an internal token tree.** The engine talks to emitters through six methods; sub-language data crosses the boundary as a typed `TokenStream` value.
5. **TypeScript inherits from JavaScript through a typed `extendLanguage()` API**, not through array-mutation of an `exports: any` field. The keystone of the architecture.
6. **Default CSS class prefix is `kn-`.** Upstream's `hljs-` is opt-in via `htmlEmitterWith({ classPrefix: 'hljs-' })`.
7. **No byte-for-byte fixture compat.** kindly-note ships fresh markup fixtures.
8. **Tests are Vitest + native TypeScript** across all packages.

Spec §0 has the full rationale; each shift is validated by tests in the corresponding package.

---

## Packages

v0 ships 13 packages under the `@kindly-note/*` scope.

### Engine

| Package | Purpose |
|---|---|
| [`@kindly-note/core`](packages/core/) | Engine, types, matcher, plugin pipeline, emitter contract, `extendLanguage` API |

### Languages

| Package | Purpose |
|---|---|
| [`@kindly-note/lang-helpers`](packages/lang-helpers/) | Tree-shakable Mode helpers (`cLineComment`, `cNumberMode`, etc.) and regex constants |
| [`@kindly-note/lang-pack-ecmascript`](packages/lang-pack-ecmascript/) | Shared helpers for the ECMAScript family (JS, TS, CoffeeScript, LiveScript, JSON) |
| [`@kindly-note/lang-json`](packages/lang-json/) | JSON / JSONC / JSON5 |
| [`@kindly-note/lang-javascript`](packages/lang-javascript/) | JavaScript with typed `extensible: { PARAMS_CONTAINS, CLASS_REFERENCE }` |
| [`@kindly-note/lang-typescript`](packages/lang-typescript/) | TypeScript via `extendLanguage(javascript, ...)` — the keystone |

### Emitters

| Package | Purpose |
|---|---|
| [`@kindly-note/emitters-html`](packages/emitters-html/) | Default HTML-string emitter with `kn-` prefix and `hljs-` opt-in |

### Plugins, themes, integrations

| Package | Purpose |
|---|---|
| [`@kindly-note/legacy-plugin-adapter`](packages/legacy-plugin-adapter/) | Adapter for upstream highlight.js plugins (the six `before:*` / `after:*` hooks) |
| [`@kindly-note/auto-detect`](packages/auto-detect/) | Heuristic language auto-detection with `supersetOf` tie-breaking |
| [`@kindly-note/themes-default`](packages/themes-default/) | First-party CSS themes (dark / light / high-contrast) + `compat-hljs.css` shim |

### Runtime adapters

| Package | Purpose |
|---|---|
| [`@kindly-note/loader-dynamic-import`](packages/loader-dynamic-import/) | Dynamic-`import()`-based language loader for Node, browsers, Deno, Bun |
| [`@kindly-note/loader-fetch`](packages/loader-fetch/) | Fetch-based language loader for Workers/Edge with versioned wire format |
| [`@kindly-note/browser`](packages/browser/) | DOM bindings: `highlightElement`, `highlightAll`, `attachToDOM` |

---

## Monorepo layout

```
packages/<name>/             — one published package per directory
  src/                       — TypeScript source
  tests/                     — Vitest tests (vitest.config.ts extends ../../vitest.shared.ts)
  rolldown.config.ts         — build config
  package.json               — static exports map; ESM-only
  README.md                  — install + quickstart
docs/plan/                   — architecture spec, scout reports, per-cohort build manifests
.changeset/                  — pending changeset entries for the next release
vitest.shared.ts             — workspace src-resolution alias config
biome.json                   — lint + format config
tsconfig.base.json           — shared TS config
tsconfig.json                — project references
```

Packages are linked via `workspace:*` in development; published versions are semver-locked siblings via Changesets.

---

## Development

Prerequisites: [Bun](https://bun.sh) 1.3+. (Node-only setups work for tests via Vitest, but bun is the canonical workspace runner.)

```sh
# Install deps for all packages
bun install

# Run all tests across the workspace (no build required — vitest src-resolution)
bun run test

# Per-package
bun run --filter '@kindly-note/core' test
bun run --filter '@kindly-note/lang-typescript' test

# Typecheck the whole workspace
bun run typecheck

# Lint + format with Biome
bun run lint
bun run format

# Build all packages (rolldown + rolldown-plugin-dts)
bun run build

# Add a changeset entry (run before opening a PR that touches a package)
bun run changeset
```

---

## Architecture

The full architectural contract is at [`docs/plan/architect-spec.md`](docs/plan/architect-spec.md) (~10 KLOC of TypeScript-typed spec). Highlights:

- **§0** — executive summary + the 8 architectural shifts above
- **§1** — package decomposition with dependency rules
- **§2** — modern plugin protocol (sync-only in v0; async deferred)
- **§3** — legacy-plugin adapter design with worked `highlightjs-line-numbers` example
- **§5** — emitter abstraction with the typed `TokenStream` boundary
- **§8.2** — the keystone: typed `extendLanguage(parent, extensions)` for TS-extends-JS
- **§9** — compilation timing (compile-at-register-time, immutable artifacts)
- **§13** — markdown rendering (v1+; security-first emitter defaults; CommonMark + GFM via the keystone API)

Per-cohort build manifests document architectural choices and surface any open questions:

```
docs/plan/build-manifest-c1.md     core + monorepo scaffolding
docs/plan/build-manifest-c2{a,b}.md  lang-helpers, emitters-html
docs/plan/build-manifest-c3a.md    matcher deepening
docs/plan/build-manifest-c3b.md    lang-pack-ecmascript, lang-json
docs/plan/build-manifest-c4.md     the keystone (lang-javascript + lang-typescript)
docs/plan/build-manifest-c5{a-e}.md  legacy-plugin-adapter, auto-detect, loaders, themes-default, browser
```

---

## Status

**v0 surface complete.** 13 packages, ~495 tests, lint and typecheck clean. The architectural bet (TS-extends-JS via typed `extendLanguage`) is validated end-to-end by the keystone tests in `packages/lang-typescript/tests/keystone.test.ts`.

Pre-1.0. APIs are typed and stable in shape, but the version is `0.x` until the v0.1.0 release. Release rehearsal is in progress; first publish is a Changesets dry-run + verdaccio smoke test before any real npm publish.

**Roadmap beyond v0:**
- v1+ markdown rendering ring: `lang-markdown`, `lang-markdown-gfm`, `emitters-markdown`, `emitters-mdast`, `render-markdown`, `integrations-marked`, `integrations-remark` (per spec §1.5 + §13)
- The remaining ~190 upstream highlight.js languages (mechanical port after v0 ships)
- Async plugin protocol (v1)

---

## Acknowledgments

kindly-note's grammars and scope-class semantics owe everything to the [highlight.js](https://github.com/highlightjs/highlight.js) project and its contributors. kindly-note is a clean-room reimagining of the architecture, not a code port; the tokenization patterns and language definitions are referenced from upstream but rewritten for kindly-note's typed shape. Thank you to that team for over a decade of work on syntax highlighting on the web.

---

## License

MIT — see [LICENSE](LICENSE).
