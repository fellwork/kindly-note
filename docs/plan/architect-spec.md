# kindly-note v0 — Architecture Specification

**Date:** 2026-05-08
**Author:** Architect (round 2)
**Status:** Draft for user review gate. If approved, this document is the contract every Builder dispatch implements against.
**Inputs:** `state-modernize.md`, `topic-summary.md`, `director-notes.md`, `scout-report.md`, `scout-report-gapfill.md`, plus targeted reads of `C:\git\highlightjs-upstream\` for Scout-uncovered claims.

---

## Conventions used in this spec

- **MUST / SHALL / MUST NOT / SHOULD** are used in the RFC-2119 sense.
- **TypeScript signatures are normative.** Where prose and a `type`/`interface` block disagree, the type block wins.
- **`Scout §N`** cites `scout-report.md` section N. **`Gap §N`** cites `scout-report-gapfill.md` section N.
- **Code blocks marked `// example`** are illustrative usage; code marked `// contract` is normative.
- **Package names:** all under the `@kindly-note/*` scope. The unscoped name `kindly-note` is reserved as the umbrella convenience entry (see §1).

---

## 0. Executive summary

kindly-note v0 is a monorepo of 18 small ESM-only packages under the `@kindly-note/*` scope. The engine (`@kindly-note/core`) is ~12-15 KB minified, contains zero language data, has zero Node built-in dependencies, and runs on browsers, Node, Deno/Bun, and Workers/Edge with no runtime-conditional code.

The fundamental architectural shifts versus upstream highlight.js are:

1. **Languages are values, not side effects.** A language package's default export is a `LanguageDefinition` (a typed factory), not a registration call. Bundlers tree-shake unused languages by import-graph alone.
2. **Compilation happens at registration time, not first-use time.** `registerLanguage(def)` returns a typed `RegisteredLanguage` handle backed by an immutable `CompiledLanguage` artifact. The raw `LanguageDefinition` is never mutated. (Resolves Scout §4 / Open Q8.)
3. **Plugins are pure transforms in a typed pipeline.** No shared mutable context object. The legacy `before:*`/`after:*` shape is preserved only inside `@kindly-note/legacy-plugin-adapter`, where mutation is allowed by design and quarantined. (Resolves Scout §2.)
4. **Emitters are factories, not subclasses of an internal token tree.** The engine talks to emitters through six methods (`startScope`, `endScope`, `addText`, `addSubLanguage`, `finalize`, `render`); `addSubLanguage` receives a typed `TokenStream` value, never a foreign emitter's internals. (Resolves Scout §5.)
5. **TypeScript inherits from JavaScript through a typed `extend()` API**, not through array-mutation of an `exports` field. (Resolves Scout §8 Cat 5 / Open Q3.)
6. **Default CSS class prefix is `kn-`.** Upstream's `hljs-` is opt-in via `configure({ classPrefix: 'hljs-' })`. (Round-1 user decision.)
7. **No byte-for-byte fixture compat.** Default emitter output is designed for clarity and typed pluggability; kindly-note ships fresh markup fixtures. (Round-1 user decision.)
8. **Tests are Vitest + native TypeScript across all packages.** (Round-1 user decision.)

The 195+ language inheritance graph collapses cleanly into the package decomposition because the keystone case (TypeScript inheriting from JavaScript) is solved by a single typed mechanism in `@kindly-note/core`, demonstrated end-to-end in §8 Cat 2.

---

## 1. Package decomposition

### 1.1 Monorepo shape

- **Tool:** bun workspaces. Workspaces are declared in root `package.json#workspaces`; one `package.json` per package, all packages publish independently with semver-locked siblings. `workspace:*` protocol is supported for dev linking.
- **Layout:** `packages/<short-name>/` (e.g. `packages/core`, `packages/lang-typescript`). `package.json#name` is the published `@kindly-note/*` name.
- **Versioning:** Changesets (`@changesets/cli`). Every PR that touches a package SHALL include a changeset; releases batch them.
- **TypeScript:** Project references (`tsconfig.json` per package, root `tsconfig.json` lists references). No source-level path aliases — packages consume each other through their published name in dev via `workspace:*` ranges.

### 1.2 The package table

Every cell is filled. No "TBD."

| name | purpose-in-one-sentence | public exports | dependency rules | one runnable usage example |
|---|---|---|---|---|
| `@kindly-note/core` | The engine: compiler, parser loop, registry, plugin pipeline, types. Zero language data, zero DOM, zero Node built-ins. | `createHighlighter`, `defineLanguage`, `defineEmitter`, `definePlugin`, `regex`, `errors`, all `Language*` / `Mode*` / `Emitter*` / `Plugin*` types. | Depends on: nothing. Depended on by: every other `@kindly-note/*` package except themes. | `import { createHighlighter } from '@kindly-note/core'; import json from '@kindly-note/lang-json'; const hl = createHighlighter({ languages: [json] }); hl.highlight('{"a":1}', { language: 'json' }).value` |
| `@kindly-note/lang-helpers` | Standalone, tree-shakable mode helpers: `comment()`, `cLineComment`, `cBlockComment`, `cNumberMode`, `apostropheString`, `quoteString`, `phrasalWords`, `numberMode`, `binaryNumberMode`, `regexpMode`, `titleMode`, `methodGuard`, `endSameAsBegin`, plus `IDENT_RE` / `C_NUMBER_RE` / etc. | All names listed above as named exports. | Depends on: `@kindly-note/core` (types only — `import type`). Depended on by: every `@kindly-note/lang-*`. | `import { cLineComment, cNumberMode } from '@kindly-note/lang-helpers'; const lang = defineLanguage({ name: 'foo', contains: [cLineComment, cNumberMode] });` |
| `@kindly-note/lang-json` | JSON language definition (also covers `jsonc`, `json5` aliases). | `default` (`LanguageDefinition`). | Depends on: `@kindly-note/core` (types), `@kindly-note/lang-helpers`, `@kindly-note/lang-pack-ecmascript` (for `EXTENDED_NUMBER_MODE`). | `import json from '@kindly-note/lang-json'; createHighlighter({ languages: [json] });` |
| `@kindly-note/lang-javascript` | JavaScript language definition (also covers `js`, `jsx`, `mjs`, `cjs` aliases). Exposes typed `JavaScriptExtensionPoints` for downstream languages (TS, CoffeeScript, etc.) via `defineLanguage({ extensible: ... })`. | `default` (`LanguageDefinition<JavaScriptExtensionPoints>`); named: `JavaScriptExtensionPoints` (type). | Depends on: `@kindly-note/core`, `@kindly-note/lang-helpers`, `@kindly-note/lang-pack-ecmascript`. | `import javascript from '@kindly-note/lang-javascript'; createHighlighter({ languages: [javascript] });` |
| `@kindly-note/lang-typescript` | TypeScript language definition; extends JavaScript via the typed `extend()` API (no mutation of JS internals). | `default` (`LanguageDefinition`). | Depends on: `@kindly-note/core`, `@kindly-note/lang-helpers`, `@kindly-note/lang-pack-ecmascript`, `@kindly-note/lang-javascript`. | `import typescript from '@kindly-note/lang-typescript'; createHighlighter({ languages: [typescript] });` |
| `@kindly-note/lang-arduino` | Arduino language definition; extends C++ via the typed `extend()` API. Declares `supersetOf: 'cpp'` for auto-detect tie-breaking. | `default` (`LanguageDefinition`). | Depends on: `@kindly-note/core`, `@kindly-note/lang-cpp`. | `import arduino from '@kindly-note/lang-arduino'; createHighlighter({ languages: [arduino] });` |
| `@kindly-note/lang-fsharp` | F# language definition; uses `regex` utilities exclusively from `@kindly-note/core/regex` (Scout §8 Cat 1 resolution). | `default` (`LanguageDefinition`). | Depends on: `@kindly-note/core` (including `@kindly-note/core/regex`), `@kindly-note/lang-helpers`. | `import fsharp from '@kindly-note/lang-fsharp'; createHighlighter({ languages: [fsharp] });` |
| `@kindly-note/lang-cpp` | C++ language definition; exposes typed `CppExtensionPoints` for Arduino. | `default` (`LanguageDefinition<CppExtensionPoints>`); named: `CppExtensionPoints` (type). | Depends on: `@kindly-note/core`, `@kindly-note/lang-helpers`. | `import cpp from '@kindly-note/lang-cpp'; createHighlighter({ languages: [cpp] });` |
| `@kindly-note/lang-pack-ecmascript` | Shared mode helpers and constant lists for the ECMAScript family (JS/TS/CoffeeScript/LiveScript/JSON). Pure data + factory functions. | `IDENT_RE`, `KEYWORDS`, `LITERALS`, `BUILT_INS`, `BUILT_IN_VARIABLES`, `EXTENDED_NUMBER_MODE`, `extendedNumberMode()`. | Depends on: `@kindly-note/core` (types), `@kindly-note/lang-helpers`. Depended on by: `@kindly-note/lang-{json,javascript,typescript,coffeescript,livescript}`. | `import { EXTENDED_NUMBER_MODE } from '@kindly-note/lang-pack-ecmascript';` |
| `@kindly-note/auto-detect` | Auto-detection algorithm (`highlightAuto`); pure function over a registered language set. Includes `supersetOf` tie-breaking. | `createAutoDetector`, `AutoDetectResult`, `AutoDetectOptions`. | Depends on: `@kindly-note/core`. | `import { createAutoDetector } from '@kindly-note/auto-detect'; const ad = createAutoDetector(hl); ad.detect('console.log(1)');` |
| `@kindly-note/emitters-html` | Default HTML-string emitter. Tiered scope-to-class mapping (`title.class.inherited` → `kn-title class_ inherited__`). | `htmlEmitter` (default `EmitterFactory`), `htmlEmitterWith({ classPrefix })`. | Depends on: `@kindly-note/core` (types). | `import { htmlEmitter } from '@kindly-note/emitters-html'; createHighlighter({ emitter: htmlEmitter });` |
| `@kindly-note/emitters-hast` | hast (HTML-AST) emitter for unified/rehype interop. Output is a hast `Root` node. | `hastEmitter`. | Depends on: `@kindly-note/core` (types), `@types/hast`. | `import { hastEmitter } from '@kindly-note/emitters-hast'; createHighlighter({ emitter: hastEmitter }).highlight(code,{language}).value /* hast Root */` |
| `@kindly-note/emitters-ast` | Raw `TokenStream` emitter — no rendering at all. Output is the typed `TokenStream` value. | `astEmitter`. | Depends on: `@kindly-note/core` (types). | `import { astEmitter } from '@kindly-note/emitters-ast';` |
| `@kindly-note/legacy-plugin-adapter` | Adapter that accepts an upstream-shaped `HLJSPlugin` (six legacy hooks) and returns a modern `Plugin` with mutation semantics quarantined. | `adaptLegacyPlugin`, `LegacyHLJSPlugin` (type). | Depends on: `@kindly-note/core`. | `import { adaptLegacyPlugin } from '@kindly-note/legacy-plugin-adapter'; import lineNumbers from 'highlightjs-line-numbers.js'; hl.use(adaptLegacyPlugin(lineNumbers));` |
| `@kindly-note/browser` | DOM bindings: `highlightAll`, `highlightElement`, `attachToDOM`. Imports a `Highlighter` and a DOM. Tree-shaken away on Workers/Edge. | `highlightAll`, `highlightElement`, `attachToDOM`. | Depends on: `@kindly-note/core`, `@kindly-note/auto-detect` (peer-optional). | `import { attachToDOM } from '@kindly-note/browser'; attachToDOM(hl, { selector: 'pre code' });` |
| `@kindly-note/loader-fetch` | Fetch-based dynamic language loader — works on Workers, browsers, and Deno/Bun without `import()`. | `createFetchLoader`. | Depends on: `@kindly-note/core`. | `import { createFetchLoader } from '@kindly-note/loader-fetch'; const loader = createFetchLoader({ baseUrl: 'https://cdn/...' }); await loader.load('rust');` |
| `@kindly-note/loader-dynamic-import` | `import()`-based dynamic language loader — works on Node/browsers/Deno/Bun. | `createDynamicImportLoader`. | Depends on: `@kindly-note/core`. | `import { createDynamicImportLoader } from '@kindly-note/loader-dynamic-import'; const loader = createDynamicImportLoader(); await loader.load('@kindly-note/lang-rust');` |
| `@kindly-note/themes-default` | First-party CSS theme set: `dark.css`, `light.css`, `high-contrast.css`, plus a `kn-` → `hljs-` compatibility layer (`compat-hljs.css`). | The CSS files under `dist/` (consumed via `?url`, native CSS import, or a bundler). `theme-tokens` JSON for design-system integration. | Depends on: nothing (CSS only). | `import '@kindly-note/themes-default/dark.css';` |
| `@kindly-note/common` | Convenience bundle: re-exports `@kindly-note/core` + ~40 popular languages pre-imported. Side-effect-free; user calls `createHighlighter({ languages: COMMON_LANGUAGES })`. | `createHighlighter` (re-export), `COMMON_LANGUAGES` (a readonly array of `LanguageDefinition`). | Depends on: `@kindly-note/core` and ~40 `@kindly-note/lang-*` packages. | `import { createHighlighter, COMMON_LANGUAGES } from '@kindly-note/common'; const hl = createHighlighter({ languages: COMMON_LANGUAGES });` |
| `@kindly-note/all` | Convenience bundle: re-exports core + every published language. Use only when bundle size does not matter (Node, build steps). | `createHighlighter`, `ALL_LANGUAGES`. | Depends on: `@kindly-note/core` and every `@kindly-note/lang-*`. | `import { createHighlighter, ALL_LANGUAGES } from '@kindly-note/all';` |

### 1.3 The `kindly-note` umbrella package

**Decision:** there SHALL be no top-level `kindly-note` package. The unscoped name is reserved against squatting (we publish a placeholder `0.0.0` README with a redirect note) but it has no runtime exports. The reasons:

- It would have to be either an alias for `@kindly-note/common` (forces a language set on users) or `@kindly-note/core` (confuses users who type `import hl from 'kindly-note'` and get nothing useful). Neither is tractable.
- Tooling and editors index scoped packages fine. The migration story (§7) tells users to import from `@kindly-note/core` or `@kindly-note/common` explicitly — that's a one-line change versus `import hljs from 'highlight.js'` and is a learnable pattern.

### 1.4 Out-of-scope / explicit non-packages

- **`@kindly-note/vue`** is out of scope for v0. Scout §1 noted upstream's `vuePlugin` is build-injected for specific targets only and absent from `src/highlight.js`. v0 ships without Vue integration; if there is demand, a separate `@kindly-note/integrations-vue` lands in v1. (Resolves Scout Q1.)
- **`@kindly-note/lowlight`** is out of scope. The `@kindly-note/emitters-hast` package replaces lowlight's primary value (highlight.js → hast); a thin `lowlight`-API-shaped wrapper can live in user-space.

---

## 2. Modern plugin protocol spec

### 2.1 Decision

**Pure-function pipeline with typed phase hooks.** Not a shared event emitter. Not middleware. Not async (synchronous-only in v0). Per-phase tree-shakable. Per-plugin error-isolated.

Rationale:

- **Why not a shared event emitter:** the legacy `fire(event, args)` (Scout §2) gives every plugin a reference to a mutable `args` object, which is the foundational legacy footgun. We are explicitly rejecting that pattern.
- **Why not middleware:** middleware (`(ctx, next) => next(modify(ctx))`) preserves the shared-context problem.
- **Why pure transforms:** each hook is `(input) => output`; the engine threads the output of plugin N into plugin N+1. The plugin author cannot reach across; the engine controls the flow. Dead-code elimination by phase is straightforward (a plugin that registers only `transformResult` is fully tree-shaken from `transformCode`-only call sites).
- **Why synchronous in v0:** the upstream highlighter is synchronous and the existing plugin ecosystem is synchronous. Async opens a large design space (cancellation, parallelism within one highlight call, race conditions between plugins) and offers no concrete user-pull justification today. **Out-of-scope open question:** add `transformCodeAsync` / `transformResultAsync` phases in v1 if/when language packages need to fetch grammars at highlight time. v0 says no.

### 2.2 The contract

```ts
// contract — packages/core/src/plugin.ts

/** A plugin object. Created via definePlugin(...). All hooks optional. */
export interface Plugin {
  /** Diagnostic name. Required. Appears in error messages and dev-mode logs. */
  readonly name: string;

  /** Semver of the kindly-note core API the plugin was authored against. */
  readonly apiVersion: string;

  /** Phase 1: transform code/language before the engine runs. Pure: must return the next CodeInput. */
  transformCode?(input: CodeInput, ctx: PluginContext): CodeInput;

  /** Phase 2: short-circuit the highlight by returning a complete HighlightResult. Returning undefined continues the pipeline. */
  shortCircuit?(input: CodeInput, ctx: PluginContext): HighlightResult | undefined;

  /** Phase 3: transform the result after highlighting. Pure: must return the next HighlightResult. */
  transformResult?(result: HighlightResult, ctx: PluginContext): HighlightResult;

  /** Phase 4: DOM-element pre-hook. Used by the browser package only. */
  beforeElement?(input: ElementInput, ctx: PluginContext): ElementInput;

  /** Phase 5: DOM-element post-hook. Used by the browser package only. */
  afterElement?(input: ElementOutput, ctx: PluginContext): void;
}

export interface CodeInput {
  readonly code: string;
  readonly language: string;
  readonly ignoreIllegals: boolean;
}

export interface ElementInput {
  readonly el: Element;
  readonly language: string;
}

export interface ElementOutput {
  readonly el: Element;
  readonly result: HighlightResult;
  readonly text: string;
}

export interface PluginContext {
  /** The Highlighter instance firing this hook. Read-only access to language registry, options, etc. */
  readonly highlighter: HighlighterReadonly;
  /** Per-call kv store for the plugin's own use. Cleared between highlight() calls. Not shared between plugins. */
  readonly state: Map<string, unknown>;
  /** Logger scoped to this plugin's name. */
  readonly log: PluginLogger;
}

/** Author-facing helper: definePlugin() is just an identity function with type inference. */
export function definePlugin(plugin: Plugin): Plugin {
  return plugin;
}
```

### 2.3 Engine threading semantics

For a single `highlighter.highlight(code, { language })` call:

1. The engine builds an initial `CodeInput`.
2. For each registered plugin in registration order: if `transformCode` exists, call `nextInput = plugin.transformCode(currentInput, ctx)`. The return value replaces `currentInput`.
3. For each plugin: if `shortCircuit` exists, call it. If it returns a `HighlightResult`, jump to step 5 with that result.
4. If no plugin short-circuited, the engine runs `_highlight(currentInput.language, currentInput.code, currentInput.ignoreIllegals)`.
5. For each plugin in registration order: if `transformResult` exists, call `nextResult = plugin.transformResult(currentResult, ctx)`.
6. Return `currentResult`.

`PluginContext.state` is fresh per highlight call. Plugins MUST NOT cache cross-call state on `ctx`; they MAY hold module-scoped state in their own closure.

### 2.4 Error isolation

Each plugin hook invocation is wrapped:

```ts
// contract
try {
  next = plugin.transformCode(current, ctx);
} catch (err) {
  ctx.log.error(`plugin "${plugin.name}" threw in transformCode`, err);
  if (highlighter.options.errorMode === 'throw') throw err;
  // 'safe' mode (default): skip this plugin's hook and continue
  next = current;
}
```

`errorMode: 'safe' | 'throw'` is the typed replacement for upstream's `safeMode()` / `debugMode()` toggles (resolves Scout Q11). Default is `'safe'` to preserve the do-not-break "no crashes by default" behavior.

### 2.5 Worked example: a code-prefix plugin

```ts
// example — a plugin that prepends a comment with the language name to every snippet
import { definePlugin } from '@kindly-note/core';

export const prefixPlugin = definePlugin({
  name: 'prefix-with-language',
  apiVersion: '1',
  transformCode(input, ctx) {
    const langDef = ctx.highlighter.getLanguage(input.language);
    if (!langDef) return input;
    const prefix = `// language: ${langDef.name}\n`;
    return { ...input, code: prefix + input.code };
  },
});

// usage
import { createHighlighter } from '@kindly-note/core';
import javascript from '@kindly-note/lang-javascript';
const hl = createHighlighter({ languages: [javascript], plugins: [prefixPlugin] });
hl.highlight('console.log(1)', { language: 'javascript' }).value;
// → starts with `<span class="kn-comment">// language: JavaScript</span>` …
```

### 2.6 Worked example: a result-rewrite plugin

```ts
// example — a plugin that wraps each line in a numbered <span> after highlighting
import { definePlugin } from '@kindly-note/core';

export const lineNumbersPlugin = definePlugin({
  name: 'line-numbers',
  apiVersion: '1',
  transformResult(result, ctx) {
    const lines = result.value.split('\n');
    const wrapped = lines
      .map((line, i) => `<span class="kn-line" data-line="${i + 1}">${line}</span>`)
      .join('\n');
    return { ...result, value: wrapped };
  },
});
```

The plugin returns a new `HighlightResult` object (`{ ...result, value: wrapped }`). It does NOT mutate the input `result`. The pipeline guarantees the next plugin receives the new value. (Compare with the legacy adapter's mutation in §3, which is the exception, not the rule.)

### 2.7 Per-phase tree-shaking

Each plugin object only carries the hooks it implements. The engine's pipeline iterates the plugin list once per phase and skips plugins where the hook is undefined. There is no requirement to register stub hooks. A plugin that only sets `transformCode` is fully tree-shakable from a build that doesn't compile in any DOM bindings (since `beforeElement`/`afterElement` are unused).

### 2.8 Hook-vs-`highlightAuto` asymmetry

**Decision:** the modern pipeline runs identically for `highlight()` and `highlightAuto()`. Specifically, `transformCode` and `transformResult` fire for both. The legacy adapter (§3) preserves the upstream asymmetry (`before:highlight` does not fire from auto-detect); modern plugins do not have that footgun. (Resolves Scout Q4: preserve in adapter, fix in modern protocol, document both.)

---

## 3. Legacy-plugin adapter design

### 3.1 Goal

Accept an `HLJSPlugin` object verbatim from the upstream ecosystem (the type from `highlight.js@11`'s `types/index.d.ts:126-134`), produce a modern `Plugin` that:

- Maps each of the six legacy hooks onto the modern phases in §2.
- Faithfully accepts in-place mutation of the `context` / `result` / `data` objects, because that is the contract the upstream plugin was authored against.
- Quarantines the mutation: the modern pipeline never sees a mutable context. The adapter copies into and out of the legacy shape.

### 3.2 The adapter type and function

```ts
// contract — packages/legacy-plugin-adapter/src/index.ts
import type { Plugin } from '@kindly-note/core';

/** Verbatim from upstream highlight.js types. */
export interface LegacyHLJSPlugin {
  'before:highlight'?: (context: { code: string; language: string; result?: HighlightResult }) => void;
  'after:highlight'?: (result: HighlightResult) => void;
  'before:highlightElement'?: (data: { el: Element; language: string }) => void;
  'after:highlightElement'?: (data: { el: Element; result: HighlightResult; text: string }) => void;
  'before:highlightBlock'?: (data: { block: Element; language: string }) => void; // deprecated
  'after:highlightBlock'?: (data: { block: Element; result: HighlightResult; text: string }) => void; // deprecated
}

export function adaptLegacyPlugin(legacy: LegacyHLJSPlugin, name?: string): Plugin;
```

### 3.3 The mapping

| Legacy hook | Modern phase | Mutation handling |
|---|---|---|
| `before:highlight` | `transformCode` + `shortCircuit` | The adapter constructs a mutable `legacyCtx = { code, language }`, calls `legacy['before:highlight'](legacyCtx)`, then reads back `legacyCtx.code`, `legacyCtx.language`, `legacyCtx.result`. If `legacyCtx.result` is set, returns it from `shortCircuit`. Otherwise returns `{ code, language, ignoreIllegals }` from `transformCode`. |
| `after:highlight` | `transformResult` | The adapter constructs a shallow copy `mutable = { ...result }`, calls `legacy['after:highlight'](mutable)`, returns `mutable` as the new immutable result. |
| `before:highlightElement` | `beforeElement` | Mutable shim: `legacyData = { el, language }`; call legacy hook; return `{ el, language: legacyData.language }`. |
| `after:highlightElement` | `afterElement` | Same shim pattern; legacy hooks may mutate `data.result.value`, but at this phase the DOM has already been written, so observable effects are limited. The adapter passes a shallow copy of `result`. |
| `before:highlightBlock` | (deprecated) → maps onto `before:highlightElement` | Per upstream's `upgradePluginAPI` (Scout §2), the adapter wraps it: if `before:highlightBlock` is present and `before:highlightElement` is not, install a shim that calls the block-named hook with `{ block: data.el, ...data }`. |
| `after:highlightBlock` | (deprecated) → maps onto `after:highlightElement` | Same shim pattern. |

### 3.4 Implementation skeleton

```ts
// contract / reference
export function adaptLegacyPlugin(legacy: LegacyHLJSPlugin, name = 'legacy'): Plugin {
  // Pre-upgrade deprecated hooks (mirror upstream upgradePluginAPI).
  const upgraded = { ...legacy };
  if (upgraded['before:highlightBlock'] && !upgraded['before:highlightElement']) {
    upgraded['before:highlightElement'] = (data) =>
      upgraded['before:highlightBlock']!(Object.assign({ block: data.el }, data));
  }
  if (upgraded['after:highlightBlock'] && !upgraded['after:highlightElement']) {
    upgraded['after:highlightElement'] = (data) =>
      upgraded['after:highlightBlock']!(Object.assign({ block: data.el }, data));
  }

  return {
    name: `legacy:${name}`,
    apiVersion: '1',

    transformCode(input) {
      if (!upgraded['before:highlight']) return input;
      const ctx: { code: string; language: string; result?: HighlightResult } = {
        code: input.code,
        language: input.language,
      };
      upgraded['before:highlight'](ctx);
      return { ...input, code: ctx.code, language: ctx.language };
    },

    shortCircuit(input) {
      if (!upgraded['before:highlight']) return undefined;
      // We must call before:highlight a second time?  No — collapse with transformCode.
      // Convention: the adapter folds before:highlight into a single phase by routing
      // through transformCode (which both modifies and may set ctx.result), but the engine
      // calls transformCode and shortCircuit in sequence.  We solve this by having
      // transformCode stash ctx.result in PluginContext.state; shortCircuit reads it.
      // (See impl below.)
      return undefined;
    },

    transformResult(result) {
      if (!upgraded['after:highlight']) return result;
      const mutable: HighlightResult = { ...result };
      upgraded['after:highlight'](mutable);
      return mutable;
    },

    beforeElement(input) {
      if (!upgraded['before:highlightElement']) return input;
      const data = { el: input.el, language: input.language };
      upgraded['before:highlightElement'](data);
      return { el: input.el, language: data.language };
    },

    afterElement(input) {
      if (!upgraded['after:highlightElement']) return;
      upgraded['after:highlightElement']({
        el: input.el,
        result: { ...input.result },
        text: input.text,
      });
    },
  };
}
```

The single subtle point in the implementation skeleton above is `before:highlight`'s dual nature (it both mutates code/language *and* may set `ctx.result` to short-circuit). The clean implementation is:

- The adapter holds a closure-scoped `WeakMap<PluginContext, BeforeHighlightCtx>` capturing the mutated context object across `transformCode` → `shortCircuit` for the same call. The engine guarantees `ctx` is the same reference for both phases of a single call.

That detail is implementation-internal; the public adapter contract is the table in §3.3.

### 3.5 Worked end-to-end example: `highlightjs-line-numbers.js`

This is a real upstream-ecosystem plugin (https://github.com/wcoder/highlightjs-line-numbers.js/) that uses `after:highlight` to rewrite `result.value` into a table-rendered set of numbered lines. Roughly:

```js
// example — what the legacy plugin looks like
const lineNumbersLegacy = {
  'after:highlight': (result) => {
    const lines = result.value.split('\n');
    const html = lines
      .map((line, i) => `<tr><td class="ln-num" data-num="${i + 1}"></td><td class="ln-code">${line}</td></tr>`)
      .join('');
    result.value = `<table class="hljs-ln">${html}</table>`;
  },
};
```

End-to-end with the adapter:

```ts
// example — kindly-note user code
import { createHighlighter } from '@kindly-note/core';
import { adaptLegacyPlugin } from '@kindly-note/legacy-plugin-adapter';
import javascript from '@kindly-note/lang-javascript';
import { lineNumbersLegacy } from 'highlightjs-line-numbers.js'; // hypothetical default export

const hl = createHighlighter({
  languages: [javascript],
  plugins: [adaptLegacyPlugin(lineNumbersLegacy, 'highlightjs-line-numbers')],
});

const out = hl.highlight('const x = 1;\nconst y = 2;', { language: 'javascript' });
console.log(out.value);
// → `<table class="hljs-ln"><tr><td class="ln-num" data-num="1"></td>…
```

What happened, step by step:

1. `hl.highlight(code, { language })` runs the plugin pipeline §2.3 step 2 (`transformCode`). The adapter's `transformCode` runs but `lineNumbersLegacy` has no `before:highlight`, so it returns input unchanged.
2. Step 3 (`shortCircuit`): adapter's `shortCircuit` checks the WeakMap for a stashed result; none, returns `undefined`.
3. Step 4: engine runs `_highlight()` with the input, producing a `HighlightResult` with `.value` containing the `<span class="kn-keyword">const</span>` etc.
4. Step 5 (`transformResult`): adapter's `transformResult` runs. It builds `mutable = { ...result }`, calls `lineNumbersLegacy['after:highlight'](mutable)`, which mutates `mutable.value` to the table HTML. The adapter returns `mutable` as the new result.
5. Step 6: pipeline returns the table-wrapped result.

The legacy plugin's mutation is preserved exactly. The modern pipeline only ever sees an immutable transform: the input `result` is unchanged; a new object is returned. Subsequent plugins in the chain see the rewritten value, not the original.

---

## 4. Language pack delivery — all 4 runtimes

### 4.1 The default story (no loader)

In every runtime, the default and recommended pattern is **static import + `createHighlighter`**:

```ts
// example — works in browser, Node, Deno, Bun, Workers
import { createHighlighter } from '@kindly-note/core';
import javascript from '@kindly-note/lang-javascript';
import json from '@kindly-note/lang-json';

const hl = createHighlighter({ languages: [javascript, json] });
```

This is the canonical path. It tree-shakes perfectly. It needs no loader. Workers/Edge bundlers (Wrangler, esbuild, Vite SSR for edge) handle this identically to browsers because every package is ESM with a static `exports` map (§6).

### 4.2 The dynamic story (when languages aren't known at build time)

For markdown previewers, code playgrounds, and editors that load language definitions on demand, kindly-note ships two loaders.

#### 4.2.1 The loader contract

```ts
// contract — packages/core/src/loader.ts
export interface LanguageLoader {
  /**
   * Resolve a language identifier (alias or canonical name) to a LanguageDefinition.
   * Implementations decide what the identifier means: a package name, a URL slug, a
   * registry key. Callers don't care.
   */
  load(identifier: string): Promise<LanguageDefinition>;

  /** Optional: list languages this loader knows how to load synchronously. */
  list?(): readonly string[];
}

export interface HighlighterWithLoader extends Highlighter {
  /** Async variant of highlight() that awaits the loader if the language isn't registered. */
  highlightAsync(code: string, options: HighlightOptions): Promise<HighlightResult>;
}
```

A `LanguageLoader` is plugged into the highlighter via `createHighlighter({ loader: ... })`. When user code calls `highlightAsync('rust', code)` and `rust` is not yet registered, the highlighter calls `loader.load('rust')`, awaits, registers, and proceeds.

#### 4.2.2 `@kindly-note/loader-dynamic-import` — the import() loader

Works on Node, modern browsers, Deno, Bun (any runtime with native dynamic `import()`):

```ts
// contract
export function createDynamicImportLoader(opts?: {
  /** Override the package name resolution. Default: '@kindly-note/lang-' + identifier. */
  resolveSpecifier?: (identifier: string) => string;
}): LanguageLoader;

// impl
export function createDynamicImportLoader(opts = {}): LanguageLoader {
  const resolve = opts.resolveSpecifier ?? ((id) => `@kindly-note/lang-${id}`);
  return {
    async load(identifier) {
      const mod = await import(resolve(identifier));
      return mod.default as LanguageDefinition;
    },
  };
}
```

#### 4.2.3 `@kindly-note/loader-fetch` — the Workers/Edge loader

Workers and Edge runtimes do not support dynamic `import()` of arbitrary URLs at runtime; the bundler must resolve all `import()` specifiers at build time. For runtime-loaded grammars, kindly-note ships precompiled JSON-serializable artifacts and a fetch-based loader.

The serialization format is the typed `SerializedLanguageDefinition`:

```ts
// contract — packages/core/src/serialize.ts
export interface SerializedLanguageDefinition {
  readonly format: 'kindly-note/v0';
  readonly name: string;
  readonly aliases?: readonly string[];
  readonly disableAutodetect?: boolean;
  readonly supersetOf?: string;
  /** The compiled mode tree as JSON-serializable data. RegExp objects are encoded as { __regex: source, flags }. */
  readonly compiled: CompiledLanguageJSON;
}

export function serializeLanguage(def: LanguageDefinition): SerializedLanguageDefinition;
export function deserializeLanguage(s: SerializedLanguageDefinition): LanguageDefinition;
```

The fetch loader:

```ts
// contract
export function createFetchLoader(opts: {
  /** e.g. 'https://cdn.kindly-note.dev/v0/lang/' — language `rust` becomes baseUrl + 'rust.json' */
  baseUrl: string;
  /** Optional cache implementation. Defaults to in-memory Map. */
  cache?: { get(k: string): SerializedLanguageDefinition | undefined; set(k: string, v: SerializedLanguageDefinition): void };
  /** fetch impl override (for non-global-fetch runtimes). Defaults to globalThis.fetch. */
  fetchImpl?: typeof fetch;
}): LanguageLoader;
```

Each `@kindly-note/lang-*` package SHALL ship both:
1. The `LanguageDefinition` factory as the default export (used by static imports + `loader-dynamic-import`).
2. A pre-serialized `<name>.json` file under `dist/serialized/` (used by `loader-fetch`). This is generated by the build pipeline (§6).

The serialized form has the language pre-compiled — Workers cold start does no regex compilation work. (See §9 for the compilation timing decision that makes this possible.)

### 4.3 No filesystem loaders

Per the locked scope decision: there is no `@kindly-note/loader-fs`. Node users use `loader-dynamic-import`. There is no built-in `import.meta.glob`-style or filesystem-walk loader; users who want one can write it in user-space against the `LanguageLoader` interface.

---

## 5. Emitter abstraction design

### 5.1 The `EmitterFactory` contract

```ts
// contract — packages/core/src/emitter.ts

export interface EmitterFactory<TOutput> {
  /** Diagnostic name. */
  readonly name: string;

  /** Construct a new emitter for one highlight() call. */
  create(opts: EmitterOptions): Emitter<TOutput>;
}

export interface EmitterOptions {
  readonly classPrefix: string;
  readonly language: string;
  /** Allow an emitter to access its own per-call config. Out-of-band channel. */
  readonly emitterConfig?: unknown;
}

export interface Emitter<TOutput> {
  /** Open a scope. Engine calls this when entering a matched mode. */
  startScope(scope: string): void;

  /** Close the most-recently-opened scope. */
  endScope(): void;

  /** Add a literal text run. */
  addText(text: string): void;

  /**
   * Add a sub-language token stream. The parent emitter MUST treat this as
   * an opaque value; it does not need to know the child emitter's internal shape.
   * The child emitter has already been finalized.
   */
  addSubLanguage(stream: TokenStream, language: string): void;

  /** Close any unclosed scopes. Called once per highlight call after parsing. */
  finalize(): void;

  /** Produce the final output (string, hast, AST, …). Called once after finalize. */
  render(): TOutput;

  /**
   * Produce the canonical TokenStream — used by the engine for sub-language insertion.
   * Every emitter MUST implement this regardless of TOutput shape, because it is how
   * a sub-language emitter hands its tokens to the parent.
   */
  toTokenStream(): TokenStream;
}
```

### 5.2 The `TokenStream` value type

```ts
// contract — packages/core/src/token-stream.ts

/** A typed, JSON-serializable token tree. The engine's lingua franca for sub-language data. */
export type TokenStream = TokenNode;

export type TokenNode = TokenScope | TokenText;

export interface TokenScope {
  readonly type: 'scope';
  /** undefined for the root node. */
  readonly scope?: string;
  /** Set when this node is a sub-language root. Carries the sub-language name. */
  readonly subLanguage?: string;
  readonly children: readonly TokenNode[];
}

export interface TokenText {
  readonly type: 'text';
  readonly text: string;
}
```

This is the critical design move: **`addSubLanguage` receives a `TokenStream`, not an `Emitter`**. A parent emitter cannot reach into a child emitter's internals because it never has a reference to one; it only ever sees a frozen typed value.

This eliminates the upstream `__addSublanguage(emitter, name)` leak (Scout §5: the upstream `TokenTreeEmitter.__addSublanguage` reads `emitter.root` directly, coupling parent emitter to child emitter implementation).

### 5.3 The default emitter: `@kindly-note/emitters-html`

```ts
// reference — packages/emitters-html/src/index.ts
import { defineEmitter } from '@kindly-note/core';

export const htmlEmitter = defineEmitter<string>({
  name: 'html',
  create(opts) {
    const tree = new TokenTreeBuilder();
    return {
      startScope: (s) => tree.openScope(s),
      endScope: () => tree.closeScope(),
      addText: (t) => tree.addText(t),
      addSubLanguage: (stream, lang) => tree.addSubLanguage(stream, lang),
      finalize: () => tree.closeAll(),
      render: () => renderHtml(tree.root, opts.classPrefix),
      toTokenStream: () => tree.snapshot(),
    };
  },
});
```

`renderHtml` walks the `TokenStream` and emits HTML strings. The scope-to-CSS rule is preserved verbatim from upstream's `scopeToCSSClass` (Scout §5):

- `"language:foo"` → `"language-foo"`
- `"title.class.inherited"` → `"<prefix>title class_ inherited__"` (multi-class, tier-suffixed underscores)
- `"keyword"` → `"<prefix>keyword"`

…with `<prefix>` defaulting to `"kn-"` per round-1 user decision. The tier-suffix rule itself is unchanged because existing themes (and the hljs-compat layer) depend on it; only the `kn-` vs `hljs-` prefix is the user-configurable knob.

### 5.4 Stub spec: `@kindly-note/emitters-hast`

```ts
// reference
import type { Root, Element, Text, ElementContent } from 'hast';
import { defineEmitter } from '@kindly-note/core';

export const hastEmitter = defineEmitter<Root>({
  name: 'hast',
  create(opts) {
    const tree = new TokenTreeBuilder();
    return {
      startScope: (s) => tree.openScope(s),
      endScope: () => tree.closeScope(),
      addText: (t) => tree.addText(t),
      addSubLanguage: (stream, lang) => tree.addSubLanguage(stream, lang),
      finalize: () => tree.closeAll(),
      render: () => tokenStreamToHast(tree.snapshot(), opts.classPrefix),
      toTokenStream: () => tree.snapshot(),
    };
  },
});
```

`tokenStreamToHast` produces a `Root` with `Element` children whose `properties.className` matches the same scope-to-class rules as the HTML emitter. Consumers of unified/rehype pipelines plug the result directly into a transformer.

### 5.5 Stub spec: `@kindly-note/emitters-ast`

```ts
// reference
export const astEmitter = defineEmitter<TokenStream>({
  name: 'ast',
  create(opts) {
    const tree = new TokenTreeBuilder();
    return {
      startScope: (s) => tree.openScope(s),
      endScope: () => tree.closeScope(),
      addText: (t) => tree.addText(t),
      addSubLanguage: (stream, lang) => tree.addSubLanguage(stream, lang),
      finalize: () => tree.closeAll(),
      render: () => tree.snapshot(), // identity — output is the stream itself
      toTokenStream: () => tree.snapshot(),
    };
  },
});
```

The trivial emitter. Useful for testing, for serializing to disk, for piping into a custom renderer.

### 5.6 Numbered call-trace: `highlight('json', '{"a":1}')`

Engine state: language `json` registered, default emitter `htmlEmitter`, `classPrefix: 'kn-'`.

1. **Engine:** call `htmlEmitter.create({ classPrefix: 'kn-', language: 'json' })`. Returns `e: Emitter<string>`.
2. **Engine:** parse loop matches `{` against the JSON `punctuation` mode.
3. → `e.startScope("punctuation")`.
4. → `e.addText("{")`.
5. → `e.endScope()`.
6. **Engine:** parse loop matches `"a"` against the `attr` mode.
7. → `e.startScope("attr")`.
8. → `e.addText("\"a\"")`.
9. → `e.endScope()`.
10. **Engine:** parse loop matches `:` against the `punctuation` mode.
11. → `e.startScope("punctuation")`.
12. → `e.addText(":")`.
13. → `e.endScope()`.
14. **Engine:** parse loop matches `1` against the `number` mode (`EXTENDED_NUMBER_MODE`).
15. → `e.startScope("number")`.
16. → `e.addText("1")`.
17. → `e.endScope()`.
18. **Engine:** parse loop matches `}` against the `punctuation` mode.
19. → `e.startScope("punctuation")`.
20. → `e.addText("}")`.
21. → `e.endScope()`.
22. **Engine:** end of input. → `e.finalize()`.
23. **Engine:** → `result.value = e.render()`.

`e.render()` walks the internal token tree and produces:
```html
<span class="kn-punctuation">{</span><span class="kn-attr">&quot;a&quot;</span><span class="kn-punctuation">:</span><span class="kn-number">1</span><span class="kn-punctuation">}</span>
```

Note `addSubLanguage` is not called for this input (no embedded language). For an example where it is — consider an HTML language definition with `subLanguage: 'css'` for `<style>` blocks: when the engine recurses, it calls `_highlight('css', innerText)` with a fresh emitter `eCss`, finalizes it, then calls `eParent.addSubLanguage(eCss.toTokenStream(), 'css')`. The parent emitter receives the typed `TokenStream` value — never the child emitter object.

### 5.7 Engine-side wiring of sub-languages

```ts
// reference — packages/core/src/engine.ts (sketch)
function processSubLanguage(top, modeBuffer, parentEmitter, continuations, subLangCfg) {
  let result;
  if (typeof top.subLanguage === 'string') {
    if (!languages[top.subLanguage]) {
      parentEmitter.addText(modeBuffer);
      return;
    }
    result = _highlight(top.subLanguage, modeBuffer, true, continuations[top.subLanguage]);
    continuations[top.subLanguage] = result._top;
  } else {
    result = autoDetector.detect(modeBuffer, top.subLanguage.length ? top.subLanguage : undefined);
  }
  if (top.relevance > 0) relevance += result.relevance;
  // Critical: pass the TokenStream value, NOT the child emitter:
  parentEmitter.addSubLanguage(result._tokenStream, result.language);
}
```

`result._tokenStream` is a private property the engine attaches; plugin authors and user code never reach for it. The public API exposes only `result.value` (the rendered output), `result.language`, `result.relevance`, `result.illegal`.

---

## 6. Build-pipeline recommendation

### 6.1 Decision: **rolldown** for every package, plus **bun** + Changesets at the workspace level (round-2 user override)

> Round-2 user override of Architect's earlier tsup+pnpm choice. The locked tooling stack is: rolldown (build), bun (runtime + package manager + workspace runner), Changesets (versioning), Biome (lint/format), Vitest (tests).

- **rolldown** over **tsup**: rolldown is the Rust-implemented Rollup-compatible bundler from the Vite team. Same plugin and output mental model as Rollup, an order of magnitude faster, and a future-aligned bet (Vite 6+ ships with it). tsup wraps esbuild — fast but with esbuild's quirks around dts and code-splitting; rolldown gives us the Rollup ecosystem (plugins, treeshake quality, output cleanliness) at near-esbuild speed.
- **rolldown** over **unbuild**: unbuild is a higher-level wrapper around Rollup. rolldown IS the new Rollup; we'd rather configure rolldown directly than wrap it. Less indirection.
- **rolldown** over **tshy**: tshy is dual-publish (CJS + ESM); kindly-note is ESM-only.
- **rolldown** over **Rollup directly**: rolldown is API-compatible with Rollup for the configurations we need; mechanical migration if rolldown ever proves limiting. Where we need a custom IIFE bundle (the `@kindly-note/all` browser bundle, if we ship one), rolldown steps aside cleanly into a hand-written config.

- **bun** over **pnpm**: bun is the runtime + package manager + workspace runner + script runner combined. Faster install, native TS execution for tooling scripts, no separate `pnpm-workspace.yaml` (workspaces live in `package.json`). Vitest remains the test runner (not `bun test`) for cross-runtime consistency and ecosystem maturity. **We pin a stable bun version in `package.json#packageManager`** to keep CI deterministic.

**Stability note:** rolldown is pre-1.0 as of 2026-05; pin a known-good version in `package.json#devDependencies` and bump deliberately. If rolldown blocks any v0 milestone, fall back to Rollup-direct (the configs are nearly identical) — that's the migration safety net.

### 6.2 Per-package build config (template)

```ts
// reference — rolldown.config.ts (template — every @kindly-note/* package overrides only input/external)
import { defineConfig } from 'rolldown';
import dts from 'rolldown-plugin-dts';

export default defineConfig({
  input: 'src/index.ts',
  output: {
    dir: 'dist',
    format: 'esm',
    sourcemap: true,
    entryFileNames: '[name].js',
  },
  platform: 'neutral',         // no Node built-ins; Workers/Edge-friendly
  treeshake: true,
  plugins: [dts()],            // emits .d.ts alongside .js
});
```

Outputs land in `dist/`:
- `dist/index.js` (ESM)
- `dist/index.d.ts`
- `dist/index.js.map`

### 6.3 Per-package `exports` map (static, hand-written)

```jsonc
// reference — every @kindly-note/lang-* package's package.json
{
  "name": "@kindly-note/lang-typescript",
  "version": "0.0.1",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    },
    "./serialized": {
      "types": "./dist/serialized.d.ts",
      "import": "./dist/serialized.json"
    },
    "./package.json": "./package.json"
  },
  "sideEffects": false,
  "files": ["dist", "src"],
  "scripts": { "build": "rolldown -c", "test": "vitest run", "typecheck": "tsc -b" }
}
```

`sideEffects: false` is correct for kindly-note packages because **no language pack registers itself on import** (this is the §0 architectural shift #1). The user explicitly passes the imported `LanguageDefinition` to `createHighlighter`. This is the structural fix for Scout §9 pain points 2-4.

### 6.4 The `@kindly-note/core` exports map

```jsonc
{
  "exports": {
    ".":          { "types": "./dist/index.d.ts",   "import": "./dist/index.js" },
    "./regex":    { "types": "./dist/regex.d.ts",   "import": "./dist/regex.js" },
    "./errors":   { "types": "./dist/errors.d.ts",  "import": "./dist/errors.js" },
    "./serialize":{ "types": "./dist/serialize.d.ts","import": "./dist/serialize.js" },
    "./package.json": "./package.json"
  }
}
```

The `./regex` subpath is the typed home for `concat`, `lookahead`, `either`, `optional`, `anyNumberOfTimes`. F# and NSIS (Scout §8 Cat 1) import from `@kindly-note/core/regex` instead of reaching into a relative file path. (See §8 Cat 1 below.)

### 6.5 Workspace-level tooling

| Concern | Tool | Notes |
|---|---|---|
| Runtime + package manager + workspace runner | bun | `bun install`; `bun run --filter '*' build` for fan-out; workspaces declared in root `package.json#workspaces`. `package.json#packageManager` pins bun version for CI. |
| Versioning + release | Changesets | Independent versioning; `auto`-mode for the simple cases. |
| Linting | Biome | Faster than ESLint+Prettier; handles TS natively. |
| Tests | Vitest | Per-package. Root has a `vitest.workspace.ts` for run-all. |
| TypeScript | Project references | Each package has its own `tsconfig.json` extending a shared `tsconfig.base.json`. |
| CI | GitHub Actions matrix | Node 20 / 22, browsers via Playwright (only for `@kindly-note/browser`), Workers smoke (Wrangler). |

### 6.6 Source-map policy

Every published package ships sourcemaps (`dist/*.js.map`) with a sources-content embed. Bundle-size cost is paid only by users who download `.map` files explicitly; production builds in browser apps drop them by default. This is a small DX win and a standard hygiene practice.

### 6.7 `.d.ts` declarations

Generated by `rolldown-plugin-dts` (which delegates to `tsc` under the hood for type extraction). Every public export has typed signatures. Internal types not re-exported from `src/index.ts` do not appear in `dist/index.d.ts`. **Fallback:** if `rolldown-plugin-dts` proves unstable for any package, that package can split the dts step out into a sibling script (`tsc --declaration --emitDeclarationOnly --outDir dist`) running in series after `rolldown -c`. This is per-package, not workspace-wide.

---

## 7. Migration-from-highlight.js story

### 7.1 Audience A — end-user with `import hljs from 'highlight.js'`

#### 7.1.1 Default install + browser one-liner

**BEFORE (highlight.js):**
```js
import hljs from 'highlight.js';
import 'highlight.js/styles/github.css';
hljs.highlightAll();
```

**AFTER (kindly-note):**
```ts
import { createHighlighter } from '@kindly-note/common';
import { COMMON_LANGUAGES } from '@kindly-note/common';
import { attachToDOM } from '@kindly-note/browser';
import '@kindly-note/themes-default/dark.css';

const hl = createHighlighter({ languages: COMMON_LANGUAGES });
attachToDOM(hl, { selector: 'pre code' });
```

The CSS classes are now `kn-keyword` etc. If the user has their own existing theme that uses `hljs-*` classes:

```ts
const hl = createHighlighter({
  languages: COMMON_LANGUAGES,
  classPrefix: 'hljs-', // opt-in compat with upstream themes
});
```

…and their existing theme keeps working unchanged.

#### 7.1.2 Programmatic call

**BEFORE:**
```js
import hljs from 'highlight.js/lib/core';
import javascript from 'highlight.js/lib/languages/javascript';
hljs.registerLanguage('javascript', javascript);
const out = hljs.highlight(code, { language: 'javascript' }).value;
```

**AFTER:**
```ts
import { createHighlighter } from '@kindly-note/core';
import javascript from '@kindly-note/lang-javascript';
const hl = createHighlighter({ languages: [javascript] });
const out = hl.highlight(code, { language: 'javascript' }).value;
```

The language registration is now the explicit `languages: [javascript]` option, and the `LanguageDefinition` is the imported value — no string-keyed registry side effect at import time.

#### 7.1.3 Auto-detect

**BEFORE:**
```js
const out = hljs.highlightAuto(code).value;
```

**AFTER:**
```ts
import { createAutoDetector } from '@kindly-note/auto-detect';
const ad = createAutoDetector(hl);
const out = ad.detect(code).value;
```

(`detect` returns the same `{ value, language, secondBest, relevance }` shape; `secondBest` is preserved.)

#### 7.1.4 Plugins (legacy)

**BEFORE:**
```js
import hljs from 'highlight.js';
import lineNumbers from 'highlightjs-line-numbers.js';
hljs.addPlugin(lineNumbers);
hljs.highlightAll();
```

**AFTER:**
```ts
import { createHighlighter } from '@kindly-note/common';
import { adaptLegacyPlugin } from '@kindly-note/legacy-plugin-adapter';
import { attachToDOM } from '@kindly-note/browser';
import lineNumbers from 'highlightjs-line-numbers.js';

const hl = createHighlighter({ plugins: [adaptLegacyPlugin(lineNumbers)] });
attachToDOM(hl);
```

#### 7.1.5 Element-by-element

**BEFORE:**
```js
hljs.highlightElement(document.querySelector('pre code'));
```

**AFTER:**
```ts
import { highlightElement } from '@kindly-note/browser';
highlightElement(hl, document.querySelector('pre code')!);
```

### 7.2 Audience B — plugin author

**BEFORE — a result-rewriting plugin:**
```js
const myPlugin = {
  'after:highlight': (result) => {
    result.value = '<div class="wrapper">' + result.value + '</div>';
  },
};
hljs.addPlugin(myPlugin);
```

**AFTER — published as a kindly-note plugin:**
```ts
import { definePlugin } from '@kindly-note/core';

export const myPlugin = definePlugin({
  name: 'my-wrapper',
  apiVersion: '1',
  transformResult(result) {
    return { ...result, value: `<div class="wrapper">${result.value}</div>` };
  },
});
```

Two structural shifts:
1. The plugin returns a new value rather than mutating the input.
2. The plugin has a typed `apiVersion` so the engine can warn on mismatches.

Plugin authors who want to support both ecosystems publish two entries: their existing `HLJSPlugin` for upstream users, and a kindly-note `Plugin` (which can be a thin wrapper around their core logic).

### 7.3 Capability migration table (do-not-break list → kindly-note construct)

| Capability (Scout §11) | kindly-note construct |
|---|---|
| `highlight(code, {language})` returning `{value, relevance, illegal}` | `Highlighter.highlight(code, {language}): HighlightResult` (`@kindly-note/core`) |
| Language registration by string name | `createHighlighter({ languages: [...] })` + `Highlighter.getLanguage(name)` (`@kindly-note/core`) |
| Language aliases | `LanguageDefinition.aliases?: string[]` declared by each lang package; resolved by `Highlighter.getLanguage` |
| `highlightAuto(code, subset?)` returning `{language, secondBest, value}` | `createAutoDetector(hl).detect(code, subset?)` (`@kindly-note/auto-detect`) |
| `configure({classPrefix, cssSelector, ignoreUnescapedHTML})` | `createHighlighter({ classPrefix, cssSelector, ignoreUnescapedHTML })`. Default `classPrefix` is `'kn-'`; pass `'hljs-'` for upstream-theme compat. |
| `addPlugin` / `removePlugin` (modern) | `createHighlighter({ plugins: [...] })` + `Highlighter.use(plugin) / unuse(plugin)` (`@kindly-note/core`) |
| All 6 legacy hooks | `adaptLegacyPlugin(legacyPluginObj)` (`@kindly-note/legacy-plugin-adapter`) — see §3 |
| `before:highlight` context mutation (legacy) | Adapter's mutable shim (§3.4); modern protocol uses `transformCode` returning new `CodeInput` |
| `after:highlight` result mutation (legacy) | Adapter's mutable shim (§3.4); modern protocol uses `transformResult` returning new `HighlightResult` |
| `highlightElement(el)` DOM API | `highlightElement(hl, el)` (`@kindly-note/browser`) |
| `highlightAll()` auto-init | `attachToDOM(hl, { selector? })` (`@kindly-note/browser`) |
| `disableAutodetect: true` on lang def | `LanguageDefinition.disableAutodetect?: boolean` honored by `@kindly-note/auto-detect` |
| `newInstance()` — isolated highlighter | `createHighlighter({...})` is the constructor. Each call is independent — no global singleton exists in v0. |
| `subLanguage` | `Mode.subLanguage?: string \| string[]` — honored by engine; sub-language tokens are inserted via `Emitter.addSubLanguage(stream, language)` (matches the normative §5.2 signature). |
| `supersetOf` field | `LanguageDefinition.supersetOf?: string` — used by `@kindly-note/auto-detect` for tie-breaking |
| Scope-to-CSS-class tiered mapping | Preserved verbatim by `htmlEmitter`. `"title.class.inherited"` → `"kn-title class_ inherited__"` (§5.3) |
| `hljs.regex` utilities | `import { regex } from '@kindly-note/core'` — same names: `concat`, `lookahead`, `either`, `optional`, `anyNumberOfTimes` |
| `compilerExtensions` on Language | `LanguageDefinition.compilerExtensions?: CompilerExt[]` — accepted by the compiler |
| `__emitTokens` escape hatch | `LanguageDefinition.emitTokens?: (code, emitter) => void` — promoted to a stable, named field (no `__` prefix) |
| `SAFE_MODE` default-on error swallowing | `createHighlighter({ errorMode: 'safe' \| 'throw' })` — default `'safe'`; replaces `hljs.debugMode()`/`safeMode()` |
| `versionString` | `Highlighter.versionString: string` and exported from `@kindly-note/core` as `VERSION` |
| Default `hljs-` CSS prefix | **CHANGED.** Default is `'kn-'`; opt-in to `'hljs-'` for theme compat. |

### 7.4 The `kn-` ↔ `hljs-` decision and theme story

The default `classPrefix` is `'kn-'` (round-1 user lock). This means:
- Out-of-the-box, kindly-note ships with `@kindly-note/themes-default` providing `dark`, `light`, `high-contrast` themes that target `.kn-*` classes.
- Users who already have an upstream theme they want to keep:

```ts
import { createHighlighter } from '@kindly-note/core';
const hl = createHighlighter({ classPrefix: 'hljs-' });
// then: import 'highlight.js/styles/github.css';
```

- A `@kindly-note/themes-default/compat-hljs.css` ships as well — a copy of the kindly-note default theme with all selectors re-rooted to `.hljs-*`. This lets users opt into kindly-note theming while keeping the `hljs-` prefix because they have third-party CSS targeting it.

The tiered scope-to-class mapping itself (`title.class.inherited` → `kn-title class_ inherited__`) is unchanged from upstream. Only the prefix changes.

---

## 8. Coupling-debt resolution table

### 8.1 Cat 1 — Language → core internals by file path

**Upstream symptom (Scout §8):** `src/languages/fsharp.js` and `src/languages/nsis.js` do `import * as regex from '../lib/regex.js'`.

**Decision: provide a stable, typed `@kindly-note/core/regex` subpath; allow but discourage the pattern.**

- The `LanguageFn` argument provides `regex` as a property (legacy path). In kindly-note, the engine still passes a typed `LanguageContext` to factory functions, with `ctx.regex` available.
- Languages that prefer a top-level import use `import * as regex from '@kindly-note/core/regex'`. This is fully supported, fully typed, ESM-clean.
- Forbidding the pattern would force F#/NSIS to re-route through the factory argument, which is a sequencing constraint (the `regex` reference is needed at module-init time for top-level constants in F#'s definition). Allowing the subpath is the simpler path.
- We document the convention: prefer the factory argument; use the subpath only when needed at module-init. (This is style guidance, not a lint rule. v0 does not ship a custom lint plugin to enforce it.)

### 8.2 Cat 2 — Language → language (THE KEYSTONE)

**Upstream symptom:** `src/languages/typescript.js` does:
```js
import javascript from "./javascript.js";
const tsLanguage = javascript(hljs);
Object.assign(tsLanguage.keywords, KEYWORDS);
tsLanguage.exports.PARAMS_CONTAINS.push(DECORATOR);
tsLanguage.contains = tsLanguage.contains.concat([...]);
swapMode(tsLanguage, "shebang", hljs.SHEBANG());
```

It calls JavaScript's factory, then mutates the returned `Language` object's `keywords`, `exports.PARAMS_CONTAINS`, and `contains` arrays in place; replaces modes by label-lookup; and finally renames the result.

**Decision: typed `defineLanguage({ extensible })` + `extendLanguage(parent, extensions)`.**

The base language declares its extension surface as a typed shape; the child language consumes it through a typed `extend()` that produces a new language definition without mutating the parent. Concretely:

```ts
// contract — packages/core/src/language.ts

export interface LanguageDefinition<TExtensible = unknown> {
  readonly name: string;
  readonly aliases?: readonly string[];
  readonly disableAutodetect?: boolean;
  readonly supersetOf?: string;
  readonly caseInsensitive?: boolean;
  readonly keywords?: Keywords;
  readonly contains: readonly Mode[];
  readonly illegal?: string | RegExp | readonly (string | RegExp)[];
  readonly classNameAliases?: Readonly<Record<string, string>>;
  readonly compilerExtensions?: readonly CompilerExt[];
  readonly emitTokens?: (code: string, emitter: Emitter<unknown>) => void;
  /**
   * The typed extension surface this language exposes to descendants.
   * If omitted, the language is final (cannot be extended via extendLanguage).
   */
  readonly extensible?: TExtensible;
}

/** The author-facing factory. Identity function with type inference. */
export function defineLanguage<T = undefined>(def: LanguageDefinition<T>): LanguageDefinition<T> {
  return def;
}

/**
 * Produce a new LanguageDefinition that extends `parent`. The extensions object
 * is typed against the parent's `extensible` shape — TypeScript-side, the keys
 * and value shapes of `extensions` are statically known at the call site.
 */
export function extendLanguage<TExt>(
  parent: LanguageDefinition<TExt>,
  extensions: LanguageExtensions<TExt>
): LanguageDefinition<unknown>;

export interface LanguageExtensions<TExt> {
  /** Override identity (typically the only required field). */
  readonly name: string;
  readonly aliases?: readonly string[];
  readonly supersetOf?: string;

  /** Append new modes to the parent's contains. */
  readonly addContains?: readonly Mode[];

  /** Replace modes by `label` (typed against parent.extensible's mode-label union if declared). */
  readonly replaceModes?: ReadonlyArray<{
    label: string;
    with: Mode;
  }>;

  /** Merge keyword sets (typed shallow merge against parent.keywords). */
  readonly extendKeywords?: Keywords;

  /**
   * Type-safe access to parent's named extension points. The shape comes from
   * the parent's `extensible` declaration. Each known point produces a new
   * value (never mutates parent).
   */
  readonly extendPoints?: TExt extends object
    ? Partial<{ [K in keyof TExt]: (current: TExt[K]) => TExt[K] }>
    : never;

  /**
   * Apply a function to the function-declaration mode's relevance.
   * Modeled separately to avoid stringly-typed mode lookups.
   */
  readonly transformLabeledMode?: ReadonlyArray<{
    label: string;
    transform: (mode: Mode) => Mode;
  }>;
}
```

The important properties of this design:

1. **Parent is never mutated.** `extendLanguage` walks the parent definition, applies the requested overrides into a new `LanguageDefinition`, and returns it. The parent object is structurally shared (deep-frozen) but never written to.
2. **The extension surface is typed.** A parent declares `extensible: { PARAMS_CONTAINS: Mode[]; CLASS_REFERENCE: Mode }` and the child's `extendPoints` is statically constrained to those keys.
3. **No reaching into internals.** `extendPoints[K]` receives `current: TExt[K]` (the parent's frozen value) and returns the new value; the child does not Array.push into the parent's arrays.

#### 8.2.1 Worked code sample — `@kindly-note/lang-javascript`

```ts
// reference — packages/lang-javascript/src/index.ts
import { defineLanguage, type Mode } from '@kindly-note/core';
import { cLineComment, cBlockComment, apostropheString, quoteString, shebang } from '@kindly-note/lang-helpers';
import * as ECMAScript from '@kindly-note/lang-pack-ecmascript';

export interface JavaScriptExtensionPoints {
  /** The contains-array used inside function parameter parsing. Descendants append to it. */
  readonly PARAMS_CONTAINS: readonly Mode[];
  /** The mode that matches a class reference (used in `interface ... extends Foo` etc.). */
  readonly CLASS_REFERENCE: Mode;
}

const PARAMS_CONTAINS: readonly Mode[] = Object.freeze([
  /* …all the param modes from upstream's javascript.js, frozen… */
]);

const CLASS_REFERENCE: Mode = Object.freeze({
  scope: 'title.class',
  match: ECMAScript.IDENT_RE,
  relevance: 0,
});

const javascript = defineLanguage<JavaScriptExtensionPoints>({
  name: 'JavaScript',
  aliases: ['js', 'jsx', 'mjs', 'cjs'],
  keywords: {
    $pattern: ECMAScript.IDENT_RE,
    keyword: ECMAScript.KEYWORDS,
    literal: ECMAScript.LITERALS,
    built_in: ECMAScript.BUILT_INS,
    'variable.language': ECMAScript.BUILT_IN_VARIABLES,
  },
  contains: [
    shebang({ label: 'shebang', binary: 'node', relevance: 5 }),
    /* …USE_STRICT, strings, comments, numbers, regex, function-def, etc.,
        each carrying a `label` if descendants need to swap them … */
  ],
  illegal: /#(?![$_A-Za-z])/,
  extensible: { PARAMS_CONTAINS, CLASS_REFERENCE },
});

export default javascript;
export type { JavaScriptExtensionPoints };
```

#### 8.2.2 Worked code sample — `@kindly-note/lang-typescript`

```ts
// reference — packages/lang-typescript/src/index.ts
import { extendLanguage } from '@kindly-note/core';
import javascript, { type JavaScriptExtensionPoints } from '@kindly-note/lang-javascript';
import * as ECMAScript from '@kindly-note/lang-pack-ecmascript';
import { shebang } from '@kindly-note/lang-helpers';

const TYPES = ['any', 'void', 'number', 'boolean', 'string', 'object', 'never', 'symbol', 'bigint', 'unknown'];
const TS_KEYWORDS = ['type', 'interface', 'public', 'private', 'protected', 'implements', 'declare', 'abstract', 'readonly', 'enum', 'override', 'satisfies'];

const DECORATOR: Mode = { scope: 'meta', match: '@' + ECMAScript.IDENT_RE };

const NAMESPACE: Mode = {
  begin: [/namespace/, /\s+/, ECMAScript.IDENT_RE],
  beginScope: { 1: 'keyword', 3: 'title.class' },
};

const INTERFACE_MODE = (parentRefs: JavaScriptExtensionPoints): Mode => ({
  beginKeywords: 'interface',
  end: /\{/,
  excludeEnd: true,
  keywords: { keyword: 'interface extends', built_in: TYPES },
  contains: [parentRefs.CLASS_REFERENCE],
});

const USE_STRICT: Mode = { scope: 'meta', relevance: 10, begin: /^\s*['"]use strict['"]/ };

const typescript = extendLanguage(javascript, {
  name: 'TypeScript',
  aliases: ['ts', 'tsx', 'mts', 'cts'],

  extendKeywords: {
    keyword: TS_KEYWORDS, // merged with parent
    built_in: TYPES,
  },

  extendPoints: {
    // Append DECORATOR and the [CLASS_REFERENCE, ATTR, OPTIONAL_KEY] nested array
    // to PARAMS_CONTAINS — but as a transform, not a mutation:
    PARAMS_CONTAINS: (current) => [
      ...current,
      DECORATOR,
      // The parent's PARAMS_CONTAINS already contains the JS attribute-highlight rule;
      // descendants compose with it through `current`, not through reaching into JS internals.
    ],
  },

  // Append the TS-only top-level modes
  addContains: [
    DECORATOR,
    NAMESPACE,
    // INTERFACE_MODE needs CLASS_REFERENCE — closure over the parent's extensible:
    INTERFACE_MODE(javascript.extensible!),
    // OPTIONAL_KEY_OR_ARGUMENT etc.
  ],

  // Replace shebang and use-strict labeled modes
  replaceModes: [
    { label: 'shebang', with: shebang() },
    { label: 'use_strict', with: USE_STRICT },
  ],

  // Adjust the function-def relevance
  transformLabeledMode: [
    { label: 'func.def', transform: (m) => ({ ...m, relevance: 0 }) },
  ],
});

export default typescript;
```

The key shift versus upstream: TypeScript composes a new language from the JavaScript description through declarative transforms. `javascript`'s value is deep-frozen; TS's call to `extendLanguage(javascript, ...)` produces a sibling `LanguageDefinition` without altering the JS one. A bundler that imports both gets two distinct `LanguageDefinition` objects; tree-shaking is unaffected.

The cost: TS's package depends on JS's package (Scout §8 Cat 2 acknowledged unavoidable). The benefit: that dependency is fully typed, the public surface (`JavaScriptExtensionPoints`) is opt-in for the JS package, and the worst legacy footgun (untyped `exports: any`) is gone.

#### 8.2.3 Arduino → C++ (the simpler Cat 2 case)

```ts
// reference — packages/lang-arduino/src/index.ts
import { extendLanguage } from '@kindly-note/core';
import cpp from '@kindly-note/lang-cpp';

const ARDUINO_KEYWORDS = { type: ['boolean', 'byte', 'word', 'String'], built_in: [/* … */], literal: ['HIGH', 'LOW', 'true', 'false'] };

export default extendLanguage(cpp, {
  name: 'Arduino',
  aliases: ['ino'],
  supersetOf: 'cpp',
  extendKeywords: ARDUINO_KEYWORDS,
});
```

C++ does not declare an `extensible` — it is `LanguageDefinition<undefined>`. Arduino doesn't need to reach into C++'s internals; merging keywords and renaming is sufficient. `extendKeywords` is typed to merge into `Keywords` regardless of the parent's `extensible` shape.

### 8.3 Cat 3 — Language shared libraries

**Upstream symptom (Scout §8):** `src/languages/lib/ecmascript.js`, `css-shared.js`, `java.js`, `kws_swift.js`, `mathematica.js` are imported by ≥2 sibling languages.

**Decision: own packages for the shared libs that have ≥2 dependents and are not trivial.**

| Upstream file | kindly-note package | Used by |
|---|---|---|
| `lib/ecmascript.js` | `@kindly-note/lang-pack-ecmascript` | `lang-{json, javascript, typescript, coffeescript, livescript}` |
| `lib/css-shared.js` | `@kindly-note/lang-pack-css` | `lang-{css, less, scss, stylus}` |
| `lib/java.js` | `@kindly-note/lang-pack-java` | `lang-{java, kotlin}` |
| `lib/kws_swift.js` | `@kindly-note/lang-pack-swift` | `lang-{swift}` (single dependent → still extracted because it's substantial; alternatively inline if it stays single-use) |
| `lib/mathematica.js` | inline into `@kindly-note/lang-mathematica` | single dependent, large data, no benefit to extraction |

**Policy:** A shared lib is extracted iff (a) ≥2 sibling lang packages use it, OR (b) it is large enough (>1 KB minified) that extraction is a clear win. Otherwise inline.

This is a Builder-time call per package; the Architect's policy is the rule above.

### 8.4 Cat 5 — Untyped `Language.exports` field

**Upstream symptom (Scout §3, §8):** `javascript.js` returns `exports: { PARAMS_CONTAINS, CLASS_REFERENCE }` (`exports: any` per `types/index.d.ts`); `typescript.js` does `tsLanguage.exports.PARAMS_CONTAINS.push(DECORATOR)`.

**Decision: replaced by `LanguageDefinition.extensible: T` (typed) + `extendLanguage(parent, { extendPoints: ... })`. (See §8.2.)**

Concretely:
- `LanguageDefinition` no longer has an `exports?: any` field. It has `extensible?: T`.
- `T` is the publishing language's choice of typed shape. JS publishes `JavaScriptExtensionPoints`. C++ publishes none (`extensible` omitted → `T = undefined`).
- TS reaches into JS's extensions through the typed transform `extendPoints.PARAMS_CONTAINS: (current) => current.concat(...)`. This is statically checked.
- The plugin protocol is uninvolved. Extension is a language-package concern, not a plugin-system concern.

This eliminates the untyped escape hatch entirely. The kindly-note `LanguageDefinition` type forbids storing arbitrary side data on a language; if a language wants to publish reusable modes, it does so as named exports of its package or as a typed `extensible`.

### 8.5 Resolution table (one-row summary)

| Cat | Symptom | kindly-note resolution |
|---|---|---|
| 1 | `lang-fsharp` imports `core/lib/regex.js` directly | Provide stable typed subpath `@kindly-note/core/regex`. Allowed; factory-arg path is preferred. |
| 2 | `lang-typescript` calls `javascript(hljs)` and mutates the result | `extendLanguage(parent, { extendPoints, addContains, replaceModes, ... })`. Parent is frozen; child produces a new `LanguageDefinition`. |
| 3 | Shared lang helpers in `src/languages/lib/*.js` | Promote to `@kindly-note/lang-pack-<family>` packages when ≥2 dependents OR >1 KB. Otherwise inline. |
| 5 | Untyped `Language.exports` field used by TS to mutate JS arrays | Removed entirely. Replaced by `LanguageDefinition.extensible: T` (typed, immutable, opt-in) + the `extendPoints` transform on the descendant. |

---

## 9. Compilation-timing decision

### 9.1 The decision

**kindly-note compiles language definitions at registration time, into an immutable `CompiledLanguage` artifact, never mutating the source `LanguageDefinition`.**

Specifically:
- Each `@kindly-note/lang-*` package exports a `LanguageDefinition` (deep-frozen at module init).
- `createHighlighter({ languages: [foo, bar] })` calls `compileLanguage(def)` for each. The result is stored in the highlighter's internal map keyed by language name AND each alias.
- The original `LanguageDefinition` is never mutated. `compileLanguage(def) === compileLanguage(def)` returns equal-but-not-identical artifacts (each call produces a fresh compiled tree); the highlighter caches by reference internally so a `LanguageDefinition` registered twice in two highlighters compiles twice (but each highlighter only compiles once).

Per-package opt-in: `@kindly-note/lang-*` packages MAY ship a precompiled artifact under `dist/serialized/<name>.json` (the `SerializedLanguageDefinition` from §4.2.3). When a fetch loader loads the serialized form, it skips the compile step entirely.

### 9.2 Why not the upstream pattern (mutate-on-first-use)

Upstream `compileMode` (Scout §4) mutates `mode.isCompiled = true` on the raw definition object. This is rejected for kindly-note because:
- It precludes `Object.freeze` on the language definition. Frozen-by-default is core to the immutability story.
- It causes shared-mode helpers (e.g., `cNumberMode` exported from `@kindly-note/lang-helpers`) to accumulate compilation state across compiles. Two highlighters sharing a helper would corrupt each other's state.
- It makes the timing of "when is this compiled?" non-obvious to users. The error surface is a class of "why did changing the definition not take effect?" bugs.

### 9.3 Why not also compile-at-build-time (precompiled-only)

Compile-at-build-time (the language package ships only the serialized JSON, no source factory) is rejected as the only path because:
- It hard-codes a regex-engine choice and emitter coupling at build time. If the user wants a different engine variant or a customized emitter, they need the original `LanguageDefinition`.
- It bloats the language packages: each package would carry both the source AND the serialized form to remain useful.
- Static `import` of a language pulls in the JS factory only; dynamic compile-on-register has zero cold-start cost on browsers/Node where the regex engine is fast.

It IS available as an opt-in (per §4.2.3), specifically for Workers/Edge cold-start optimization. Users who care plug in `@kindly-note/loader-fetch` and pull serialized artifacts; users who don't care use static imports.

### 9.4 The compilation contract

```ts
// contract — packages/core/src/compile.ts

export interface CompiledLanguage {
  readonly name: string;
  readonly aliases: readonly string[];
  readonly disableAutodetect: boolean;
  readonly supersetOf?: string;
  readonly emitTokens?: (code: string, emitter: Emitter<unknown>) => void;
  /** The compiled root mode. Frozen. */
  readonly root: CompiledMode;
}

export interface CompiledMode {
  readonly scope?: string;
  readonly beginRe?: RegExp;
  readonly endRe?: RegExp;
  readonly illegalRe?: RegExp;
  readonly keywords?: KeywordDict;
  readonly contains: readonly CompiledMode[];
  readonly matcher: ResumableMultiRegex;
  /** … all the other fields the parser needs … */
}

export function compileLanguage(def: LanguageDefinition<unknown>): CompiledLanguage;
```

`compileLanguage` is the only place mode cloning, regex compilation, keyword-dict construction, and `expandOrCloneMode` (Scout §4) happen. The output is fully frozen (`Object.freeze` recursively on the `CompiledMode` tree). The output never references the input's mode objects directly — it deep-clones during compile, so the source `LanguageDefinition` can stay shared between highlighters without aliasing the compiled state.

(Resolves Open Q8, Scout Q2.)

---

## 10. Open-questions resolution

This section addresses each of the 13 open questions in `topic-summary.md` and the 12 Scout open questions in `scout-report.md`. Each row identifies the spec section that answers it and gives a one-line answer. None are deferred.

### 10.1 Topic-summary open questions

| Q | Topic | Section | One-line answer |
|---|---|---|---|
| 1 | Plugin protocol shape | §2 | Pure-function pipeline with typed phase hooks; not a shared event emitter. |
| 2 | Language definition format | §1, §8.2, §9 | Keep the mode-tree shape (it works) but make it typed + frozen and add `extensible: T` for inheritance. Drop the `exports: any` field. |
| 3 | Emitter abstraction | §5 | Pluggable `EmitterFactory<TOutput>`; engine talks to emitters via 6 methods; sub-language is passed as a typed `TokenStream` value. |
| 4 | Auto-detect placement | §1 (`@kindly-note/auto-detect`) | Separate package. `createAutoDetector(highlighter)` works against a registered language set. |
| 5 | Theme delivery / CSS class compatibility | §7.4 | Default `kn-` prefix; first-party themes ship for `.kn-*`; opt-in `classPrefix: 'hljs-'` for upstream-theme reuse; tier-suffix mapping unchanged. |
| 6 | Build pipeline | §6 | rolldown per package, bun workspaces, Changesets, Biome, Vitest, ESM-only, static `exports` map per package. (Round-2 user override.) |
| 7 | Language pack delivery for runtimes | §4 | Static import + `createHighlighter` is canonical. Two loaders ship: `loader-dynamic-import` (Node/browsers/Deno/Bun) and `loader-fetch` (Workers/Edge, plus a serialized JSON format). No filesystem loader. |
| 8 | Compilation timing | §9 | Compile at register time into an immutable `CompiledLanguage`. Source `LanguageDefinition` is frozen. Optional precompiled JSON for Workers cold-start. |

(Topic-summary lists 8 numbered questions, not 13; Director's brief refers to "13" because it includes the 12 Scout questions. Both lists are covered.)

### 10.2 Scout open questions

| Q | Topic | Section | One-line answer |
|---|---|---|---|
| 1 | `vuePlugin` | §1.4 | Out of scope for v0; possibly a `@kindly-note/integrations-vue` package in v1. Reserved as an open question for v1, not blocking now. |
| 2 | Compilation caching | §9 | Compile at register time; output is immutable; source is frozen; no caching state on the language. |
| 3 | `exports` field for inter-language sharing | §8.4 | Replaced by typed `extensible: T` on `LanguageDefinition` + `extendPoints` on the descendant. |
| 4 | `before:highlight` / `highlightAuto` asymmetry | §2.8 | Modern protocol fires `transformCode`/`transformResult` for both `highlight()` and `highlightAuto()` (consistent). Legacy adapter preserves upstream's asymmetry (auto-detect skips `before:highlight`) for compat. |
| 5 | `__emitter` standardization | §5 | Yes — `EmitterFactory<TOutput>` is a stable typed first-class concept, not a beta `__`-prefixed option. |
| 6 | `supersetOf` cross-package reference | §1, §8.2 | `supersetOf` remains a string (language name). Auto-detect requires both languages registered. Strings, not package names — too brittle to bind to package identity at the language-definition layer. |
| 7 | Typed `exports` field | §8.4 | Replaced by typed `extensible`; the old escape hatch is gone. |
| 8 | Scope-name compatibility | §5.3, §7.4 | Tier-suffix mapping preserved verbatim. Default prefix `kn-`; opt-in `hljs-` via `classPrefix` for theme compat. |
| 9 | Test directory contents | §6.5, §7 | Vitest + native TS tests across all packages (round-1 user lock). The 534 upstream markup fixtures are NOT a regression bar (round-1 lock); kindly-note generates fresh fixtures. |
| 10 | DOM dependency split | §1, §7 | DOM functions live exclusively in `@kindly-note/browser`. `@kindly-note/core` has zero DOM dependency. |
| 11 | `SAFE_MODE` default behavior | §2.4 | Replaced by typed `errorMode: 'safe' \| 'throw'` on `createHighlighter`. Default `'safe'`. The two `debugMode()`/`safeMode()` methods are not in v0. |
| 12 | F#/NSIS direct regex import | §8.1 | Provide stable subpath `@kindly-note/core/regex`. Both factory-arg and subpath are supported; factory-arg is preferred. |

### 10.3 Open questions deliberately left for v1+ (not deferrals — scoped out)

These are surfaced explicitly because they appeared in inputs and the spec answers them with "out of scope for v0":

- **Async plugin phases.** §2.1: synchronous-only in v0; revisit in v1 once driving use cases exist.
- **`@kindly-note/integrations-vue` and other framework adapters.** §1.4: not v0.
- **A `kindly-note` umbrella package at the unscoped name.** §1.3: name reserved against squatting; no runtime exports.
- **Lint rules enforcing factory-arg-over-subpath for `regex`.** §8.1: style guide only in v0; lint plugin is v1+.

---

## 11. Anti-pattern self-audit

(Per Director's instruction — re-read own spec for these failure modes.)

- **Did this spec revise the user's locked decisions?** Audit:
  - Round-0 ESM-only: preserved (§6, every package `"type": "module"`).
  - Round-0 no Node built-ins in core: preserved (`@kindly-note/core` has zero deps; no `node:` imports anywhere).
  - Round-0 no filesystem language loaders: preserved (§4.3 explicitly).
  - Round-0 adapter for legacy plugins: present (§3, full mapping + worked example).
  - Round-1 `kn-` as default CSS prefix: preserved (§5.3, §7.4 — `kn-` is default, `hljs-` is opt-in).
  - Round-1 no byte-for-byte fixture compat: preserved (§5 designs for clarity, not byte-equivalence; §10.2 Q9).
  - Round-1 Vitest+native-TS test stack: preserved (§6.5).
  - **No locked decisions revised.** ✓
- **Did this spec silently defer any of the 10 mandatory sections?** Audit:
  - §1 Package decomp: 20 packages tabled, every cell filled. ✓
  - §2 Plugin protocol: full TS contract, 2 worked examples, error isolation, async deferred to v1 with reasoning. ✓
  - §3 Adapter: full mapping table, implementation skeleton, end-to-end `highlightjs-line-numbers` worked example. ✓
  - §4 Language pack delivery: 4 runtimes addressed, 2 loaders specified, no-loader default highlighted. ✓
  - §5 Emitter: full `EmitterFactory<TOutput>` contract, `TokenStream` type, 3 emitters specced, 23-step call trace for `highlight('json',…)`. ✓
  - §6 Build pipeline: rolldown + bun chosen (round-2 user override of original tsup+pnpm) with rationale, exports map, sourcemaps, dts via `rolldown-plugin-dts`. ✓
  - §7 Migration story: A/B audiences, capability table, prefix decision worked. ✓
  - §8 Coupling-debt: all 4 categories with worked TS code samples for keystone Cat 2. ✓
  - §9 Compilation timing: register-time-into-immutable-`CompiledLanguage` chosen with rejected-alternative analysis. ✓
  - §10 Open-questions: topic-summary 8 + Scout 12 = 20 questions, each assigned to a spec section with a one-line answer. ✓
  - **No mandatory section deferred.** ✓
- **Are there sample-level cases hidden by aggregate prose?** Audit:
  - Plugin protocol: §2.5 + §2.6 are concrete signatures. ✓
  - Emitter contract: §5.6 numbered call trace. ✓
  - Legacy adapter: §3.5 end-to-end example. ✓
  - TS/JS coupling: §8.2.1 + §8.2.2 are concrete code, not prose. ✓
- **Over-invented packages?** Audit:
  - `@kindly-note/loader-fetch` separate from `loader-dynamic-import`: justified because the runtime targets diverge (Workers can't `import()` arbitrary URLs). ✓
  - `@kindly-note/lang-pack-ecmascript` separate from `lang-helpers`: justified because lang-helpers is the universal mode-helper home (`comment`, `cNumberMode`); ECMAScript helpers are specific to a 5-language family. Inlining into `lang-helpers` would inflate every other lang package. ✓
  - `@kindly-note/lang-pack-css/-java/-swift`: same justification. ✓
  - `@kindly-note/auto-detect` separate from `core`: justified because auto-detect requires loading multiple languages and is opt-in for many use cases (programmatic per-language highlights don't need it). ✓
  - `@kindly-note/themes-default` separate from emitters: justified because CSS is its own pipeline and the package contains no JS at all. ✓
  - **No package without justification.** ✓

---

## 12. What this spec does not specify (and why)

These are intentionally Builder-time decisions, not Architect decisions, and are flagged explicitly to keep the spec honest:

- **Exact regex-engine internals.** The `ResumableMultiRegex` algorithm from upstream (Scout §4) is preserved structurally; the implementation is a mechanical port. Builders may improve performance but the algorithmic surface is locked.
- **Test-fixture format on disk.** Vitest + TS gives flexibility; the per-package `tests/` shape (single big file vs many small files, snapshot vs assertion) is a Builder choice.
- **CI matrix details (exact Node versions, browser combinations).** §6.5 lists the policy; the GitHub Actions YAML is Builder.
- **Bundle-size budget per package.** §0 mentions ~12-15 KB for `@kindly-note/core`; Builders enforce via size-limit or similar in CI.
- **Public website / docs site.** Out of scope for v0 architecture.

---

STATUS: DONE — All 10 mandatory sections specified with TypeScript contracts, worked examples (including the keystone TS/JS coupling resolution and the legacy-adapter end-to-end), the 23-step emitter call trace, and explicit answers for all 8 topic-summary + 12 Scout open questions; locked user decisions (kn- prefix, no fixture-byte-compat, Vitest+TS) preserved; anti-pattern self-audit clean.
