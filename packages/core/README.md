# @kindly-note/core

The kindly-note engine: types, language compiler, matcher, plugin pipeline, and emitter contract. Zero language data, zero DOM, zero Node built-ins — runs unchanged on browsers, Node, Deno/Bun, and Workers/Edge.

## Install

```sh
npm install @kindly-note/core
bun add @kindly-note/core
pnpm add @kindly-note/core
```

## Usage

`@kindly-note/core` does not ship language data. Pair it with one or more `@kindly-note/lang-*` packages and call `createHighlighter`:

```ts
import { createHighlighter } from '@kindly-note/core';
import json from '@kindly-note/lang-json';

const hl = createHighlighter({ languages: [json] });
const result = hl.highlight('{"a":1}', { language: 'json' });

result.value;        // string rendered by the active emitter (default: HTML-ish)
result.language;     // 'json'
result.illegal;      // false
result._tokenStream; // typed TokenStream the emitter consumed (debug-only)
```

`result.value` is whatever the active emitter produced. With the default recording emitter you get the literal text plus scope tags; swap in `@kindly-note/emitters-html`, `-hast`, or `-ast` to get HTML, a hast `Root`, or the raw `TokenStream`.

You can also register languages after construction:

```ts
const hl = createHighlighter();
const handle = hl.registerLanguage(json); // returns RegisteredLanguage with a frozen compiled snapshot
```

## API

### Runtime exports

- `compileLanguage(def)` — compile a `LanguageDefinition` into an immutable `CompiledLanguage`. Used internally by `registerLanguage`; exposed for tooling.
- `createHighlighter(options?)` — construct a `Highlighter`. Accepts `{ languages, plugins, emitter, classPrefix, errorMode }`.
- `defaultPluginLogger` — minimal `PluginLogger` used when no logger is configured.
- `defineEmitter(factory)` — identity helper that types an emitter factory against the engine's `EmitterFactory` contract.
- `defineLanguage(def)` — identity helper that types and deep-freezes a `LanguageDefinition` at module load.
- `definePlugin(plugin)` — identity helper that types a `Plugin` against the pipeline contract.
- `deepFreezeLanguage(def)` — recursively freeze a language definition; called by `defineLanguage`.
- `deserializeLanguage(serialized)` — rehydrate a `SerializedLanguageDefinition` (from a loader) into a `LanguageDefinition`.
- `errors` — namespace of typed error classes (`UnknownLanguageError`, `IllegalMatchError`, `PluginError`, …) for `errorMode: 'throw'`.
- `extendLanguage(base, extensions)` — typed inheritance keystone. `extensions` is constrained by the base's `CompilerExt` parameter, so TypeScript can extend JavaScript without array-mutating internals.
- `regex` — namespace of regex utilities (`either`, `concat`, `lookahead`, `optional`, …) for language authors. Also available via the subpath `@kindly-note/core/regex`.
- `runHook(hook, plugins, input, ctx, errorMode)` — internal pipeline runner; exposed for advanced integrations.
- `VERSION` — engine version string (matches `package.json#version`).

### Type-only exports

- `CodeInput`, `ElementInput`, `ElementOutput` — plugin pipeline I/O shapes.
- `CompiledLanguage`, `CompiledMode`, `KeywordDict` — engine-side compiled artifacts.
- `CompilerExt`, `LanguageDefinition`, `LanguageExtensions`, `Mode`, `ScopeMap`, `Keywords` — language authoring types.
- `Emitter`, `EmitterFactory`, `EmitterOptions` — emitter contract.
- `Highlighter`, `HighlighterOptions`, `RegisteredLanguage` — top-level engine types.
- `HighlighterReadonly`, `HighlighterReadonlyOptions`, `Plugin`, `PluginContext`, `PluginLogger` — plugin authoring types.
- `HighlightOptions`, `HighlightResult` — `highlight()` I/O.
- `LanguageLoader`, `SerializedLanguageDefinition`, `SerializedLanguageBody`, `SerializedMode`, `SerializedKeywords`, `SerializedRegExp`, `SerializedRegexLike` — loader contract for `@kindly-note/loader-fetch` / `-dynamic-import`.
- `TokenNode`, `TokenScope`, `TokenStream`, `TokenSubLanguage`, `TokenText` — token-tree shapes emitters consume.

## Architecture

`@kindly-note/core` implements the architectural shifts spelled out in [architect-spec.md §0](../../docs/plan/architect-spec.md):

- **Languages are values, not side effects** (#1). `defineLanguage` returns a typed, deep-frozen `LanguageDefinition`. Bundlers tree-shake unused languages by import-graph alone.
- **Compile-at-register, not first-use** (#2). `registerLanguage` runs `compileLanguage` immediately and stores an immutable `CompiledLanguage` snapshot — the source `LanguageDefinition` is never mutated (verified by `tests/highlighter.test.ts` acceptance #4).
- **Pure-function plugin pipeline** (#3). `Plugin` hooks (`transformCode`, `shortCircuit`, `transformResult`, `beforeElement`, `afterElement`) are pure transforms; the engine threads outputs forward. No shared mutable context — that footgun is quarantined in `@kindly-note/legacy-plugin-adapter`.
- **Emitters are factories** (#4). `defineEmitter` returns an `EmitterFactory`; the engine talks to emitters through six methods (`startScope`, `endScope`, `addText`, `addSubLanguage`, `finalize`, `render`) and passes `addSubLanguage` a typed `TokenStream` value, never another emitter's internals.
- **Typed `extendLanguage`** (#5). The TS-extends-JS keystone is a single typed mechanism: a base language declares its `CompilerExt` extension points and `extendLanguage(base, ext)` enforces them at compile time.

## Status

v0.1.0 — see [architect-spec.md](../../docs/plan/architect-spec.md) for the full normative contract.

## License

MIT — see [LICENSE](../../LICENSE).
