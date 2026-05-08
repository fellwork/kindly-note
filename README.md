# kindly-note

A typed, modern, ESM-only fork of [highlight.js](https://highlightjs.org/). v0 is in active
development; the architectural contract lives at
[`docs/plan/architect-spec.md`](docs/plan/architect-spec.md).

## What's different from highlight.js

The fundamental architectural shifts are:

1. **Languages are values, not side effects.** Bundlers tree-shake unused languages by import
   graph alone — no global registry mutated on import.
2. **Compilation happens at registration time.** `registerLanguage(def)` returns an immutable
   `RegisteredLanguage` handle backed by a deep-frozen `CompiledLanguage`. Raw definitions are
   never mutated.
3. **Plugins are pure transforms in a typed pipeline.** No shared mutable context object;
   per-plugin error isolation; per-phase tree-shaking.
4. **Emitters are factories, not subclasses of an internal token tree.** The engine talks
   to emitters through six methods; sub-language data crosses the boundary as a typed
   `TokenStream` value.
5. **TypeScript inherits from JavaScript through a typed `extendLanguage()` API**, not
   through array-mutation of an `exports: any` field.
6. **Default CSS class prefix is `kn-`.** Upstream's `hljs-` is opt-in via
   `createHighlighter({ classPrefix: 'hljs-' })`.
7. **No byte-for-byte fixture compat.** kindly-note ships fresh markup fixtures.
8. **Tests are Vitest + native TypeScript across all packages.**

For the full design rationale, read `docs/plan/architect-spec.md` (it's the contract every
build dispatch implements against).

## Monorepo layout

```
packages/
  core/                    @kindly-note/core — engine, types, plugin pipeline
  (more packages land in subsequent cohorts: lang-*, emitters-*, browser, loaders, themes)
docs/plan/                 architecture spec, scout reports, build manifests
.changeset/                pending changeset entries (one per PR)
```

Each package publishes independently; `workspace:*` is used for dev linking.

## Quickstart

Prerequisites: [Bun](https://bun.sh) 1.3+. (Node-only setups work for tests via Vitest, but
bun is the canonical workspace runner.)

```sh
bun install
bun run typecheck
bun run --filter '@kindly-note/core' test
bun run --filter '@kindly-note/core' build
```

## Status

Cohort 1 is `@kindly-note/core` plus the monorepo scaffolding. Subsequent cohorts add
language packages, emitter packages, the browser bindings, and migration tooling.

## License

BSD-3-Clause. See [LICENSE](LICENSE).
