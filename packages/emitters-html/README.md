# @kindly-note/emitters-html

> Default HTML-string emitter for kindly-note. Tiered scope-to-class mapping with a
> `kn-` class prefix by default, and an opt-in `hljs-` mode for upstream-compatible
> themes.

This package implements the `EmitterFactory<string>` contract from
[`@kindly-note/core`](../core). It is a pure string emitter — no DOM access, no
`node:` built-ins, no global state. Runs unmodified on browsers, Node, Deno, Bun,
and Workers/Edge.

## Install

```sh
npm install @kindly-note/core @kindly-note/emitters-html
# or: bun add / pnpm add / yarn add
```

`@kindly-note/core` is a peer dependency.

## Usage

### Default `kn-` prefix

`htmlEmitter` is the default factory. It produces class names with the `kn-`
prefix, matching the themes shipped in `@kindly-note/themes-default`.

```ts
import { createHighlighter } from '@kindly-note/core';
import { htmlEmitter } from '@kindly-note/emitters-html';
import json from '@kindly-note/lang-json';

const hl = createHighlighter({
  emitter: htmlEmitter,
  languages: [json],
});

const { value } = hl.highlight('{"a":1}', { language: 'json' });
// value contains: <span class="kn-attr">"a"</span> ...
```

A single keyword scope produces a single-class span:

```html
<span class="kn-keyword">class</span>
```

### `hljs-` opt-in (upstream-compatible themes)

If you already have a highlight.js theme CSS file you want to keep — e.g.
`highlight.js/styles/github.css` — build a factory bound to the `hljs-` prefix:

```ts
import { createHighlighter } from '@kindly-note/core';
import { htmlEmitterWith } from '@kindly-note/emitters-html';

const hl = createHighlighter({
  emitter: htmlEmitterWith({ classPrefix: 'hljs-' }),
});

const { value } = hl.highlight(code, { language: 'javascript' });
```

The same one-keyword case now emits:

```html
<span class="hljs-keyword">class</span>
```

The bound prefix is per-factory, not global. Two factories built with different
prefixes produce independent emitters from the same engine.

## Tiered scope mapping

Scope names with dot tiers map to multiple classes, with a trailing `_` per tier
beyond the first. This matches upstream highlight.js verbatim (spec §5.3, §7.4)
so existing themes — including the `compat-hljs.css` layer in
`@kindly-note/themes-default` — keep working unchanged. Only the prefix on the
first tier is configurable.

| scope | classes (under `kn-`) |
|---|---|
| `keyword` | `kn-keyword` |
| `title.class` | `kn-title class_` |
| `title.class.inherited` | `kn-title class_ inherited__` |
| `language:json` (sub-language wrapper) | `language-json` (no prefix) |

The sub-language wrapper is intentionally prefix-free: existing themes target
`.language-foo` directly.

## API

```ts
import type { EmitterFactory } from '@kindly-note/core';

/** The default factory. Equivalent to htmlEmitterWith(). */
export const htmlEmitter: EmitterFactory<string>;

/** Build a factory bound to a specific class prefix. */
export function htmlEmitterWith(
  config?: HtmlEmitterConfig,
): EmitterFactory<string>;

export interface HtmlEmitterConfig {
  /** CSS class prefix. Defaults to 'kn-'. Pass 'hljs-' for upstream compat. */
  readonly classPrefix?: string;
}

/** The literal 'kn-'. */
export const DEFAULT_CLASS_PREFIX: string;

/** Re-exported for downstream emitters that want to share the algorithm. */
export function htmlEscape(value: string): string;
export function toClassNames(scope: string, prefix: string): string;
```

Prefix resolution order (per `create()` call):

1. The factory's bound `classPrefix`, if `htmlEmitterWith({ classPrefix })` set one.
2. Otherwise the engine's `EmitterOptions.classPrefix` (e.g. from
   `createHighlighter({ classPrefix: 'hljs-' })`).
3. Otherwise `'kn-'`.

## Status

V0. Public surface — `htmlEmitter`, `htmlEmitterWith`, `HtmlEmitterConfig`,
`DEFAULT_CLASS_PREFIX` — is stable. The re-exported `htmlEscape` and
`toClassNames` helpers are stable enough for downstream emitters to depend on.

## License

BSD-3-Clause.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
