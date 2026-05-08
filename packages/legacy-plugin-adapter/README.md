# @kindly-note/legacy-plugin-adapter

> Wraps an upstream highlight.js-shaped plugin (`{ 'before:highlight': fn, 'after:highlight': fn, ... }`) onto kindly-note's modern `Plugin` protocol — mutation semantics quarantined, per-phase tree-shaking preserved.

The upstream `highlight.js@11` plugin shape is six optional hooks that mutate a
shared context. kindly-note's modern protocol ([`@kindly-note/core`](../core)
spec §2) is six pure transforms with per-phase tree-shaking and per-plugin error
isolation. This adapter is the bridge: pass a real upstream-ecosystem plugin
(`highlightjs-line-numbers.js`, `highlightjs-copy-clipboard`, `highlightjs-badge`,
…) verbatim, get back a modern `Plugin` you can hand to `createHighlighter`.

## Install

```sh
npm install @kindly-note/core @kindly-note/legacy-plugin-adapter
# or: bun add / pnpm add / yarn add
```

`@kindly-note/core` is a peer dependency.

## Usage

```ts
import { createHighlighter } from '@kindly-note/core';
import { adaptLegacyPlugin } from '@kindly-note/legacy-plugin-adapter';
import javascript from '@kindly-note/lang-javascript';
import lineNumbers from 'highlightjs-line-numbers.js';

const hl = createHighlighter({
  languages: [javascript],
  plugins: [adaptLegacyPlugin(lineNumbers, 'line-numbers')],
});

const { value } = hl.highlight('const x = 1;\nconst y = 2;', { language: 'javascript' });
// value is the line-numbered table HTML the legacy plugin produced.
```

The optional second argument is a diagnostic name; the returned plugin's
`name` is `legacy:<name>` (default: `legacy:legacy`).

### How an `after:highlight` mutation propagates through

`highlightjs-line-numbers.js` rewrites `result.value` from inside an
`after:highlight` hook. Inside the adapter, that hook runs against a shallow
mutable copy of the engine's frozen `HighlightResult`; the adapter returns the
mutated copy as the next immutable result in the modern pipeline. Subsequent
plugins, the emitter consumer, and `hl.highlight()`'s caller all see the
rewritten `.value` — exactly as if the plugin had been registered on upstream
highlight.js. The engine's original `HighlightResult` is never touched.

The same threading works for `before:highlight` mutations of `code` /
`language`, and for `before:highlightElement` mutations of `language`.

## Hook mapping

The six legacy hooks map onto kindly-note's modern phases as follows
(architect-spec.md §3.3):

| Legacy hook                | Modern phase                                | Notes |
|----------------------------|---------------------------------------------|-------|
| `before:highlight`         | `transformCode` (+ `shortCircuit`)          | Mutable `{ code, language, result? }` shim. Setting `ctx.result` short-circuits the engine; the adapter stashes it in `PluginContext.state` and returns it from `shortCircuit`. |
| `after:highlight`          | `transformResult`                           | Shallow `{ ...result }` copy; mutated copy becomes the next immutable result. |
| `before:highlightElement`  | `beforeElement`                             | Mutable `{ el, language }` shim; `el` is by-reference passthrough. |
| `after:highlightElement`   | `afterElement`                              | Shallow-copy of `result` so legacy mutations of `result.value` don't leak back into the engine's frozen result. |
| `before:highlightBlock`    | `beforeElement` (deprecated alias)          | Pre-upgraded onto `before:highlightElement` à la upstream `upgradePluginAPI`. When the modern hook is also present, the modern wins and the deprecated is not also fired. |
| `after:highlightBlock`     | `afterElement` (deprecated alias)           | Same upgrade pattern. |

Mutation faithfulness — what the upstream contract guarantees — is preserved
inside the adapter. The modern protocol still only ever sees pure transforms.

The adapter only assigns the modern phases the legacy plugin actually uses, so
per-phase tree-shaking ([`@kindly-note/core`](../core) spec §2.7) is preserved:
a legacy plugin that only sets `after:highlight` produces a modern `Plugin`
with `transformResult` defined and every other phase `undefined`. The engine
skips absent phases at zero cost.

## API

```ts
import type { Plugin } from '@kindly-note/core';

/**
 * Wrap an upstream-shaped LegacyHLJSPlugin into a modern Plugin.
 * The returned plugin's name is `legacy:<name>` (default: `legacy:legacy`).
 */
export function adaptLegacyPlugin(
  legacy: LegacyHLJSPlugin,
  name?: string,
): Plugin;

/** Verbatim from highlight.js@11's types/index.d.ts:126-134. All hooks optional. */
export interface LegacyHLJSPlugin {
  'before:highlight'?(context: LegacyBeforeHighlightContext): void;
  'after:highlight'?(result: HighlightResult): void;
  'before:highlightElement'?(args: LegacyBeforeHighlightElementData): void;
  'after:highlightElement'?(args: LegacyAfterHighlightElementData): void;
  /** Deprecated upstream — scheduled for removal in highlight.js v12. */
  'before:highlightBlock'?(args: LegacyBeforeHighlightBlockData): void;
  /** Deprecated upstream — scheduled for removal in highlight.js v12. */
  'after:highlightBlock'?(args: LegacyAfterHighlightBlockData): void;
}
```

The four per-hook arg types — `LegacyBeforeHighlightContext`,
`LegacyBeforeHighlightElementData`, `LegacyAfterHighlightElementData`,
`LegacyBeforeHighlightBlockData`, `LegacyAfterHighlightBlockData` — are also
exported as named types for plugin authors who want to type their own hook
implementations.

The adapter does not mutate the caller-supplied `legacy` object: it clones
before pre-upgrading deprecated hooks, so the same plugin can be passed to
multiple highlighters without double-shimming.

## Status

V0. Public surface — `adaptLegacyPlugin` and `LegacyHLJSPlugin` — is stable
and matches architect-spec.md §3.2 normative. Sync-only, no DOM at runtime
(DOM types only for the legacy `Element` references), no Node built-ins; runs
unmodified on browsers, Node, Deno, Bun, and Workers/Edge.

## License

BSD-3-Clause — see [LICENSE](../../LICENSE).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
