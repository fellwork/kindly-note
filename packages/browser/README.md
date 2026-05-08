# @kindly-note/browser

DOM bindings for kindly-note: `highlightElement`, `highlightAll`, `attachToDOM`.

This package is a thin DOM adapter around a `Highlighter` from
[`@kindly-note/core`](../core). It is the only package in the kindly-note
ecosystem that touches the DOM — everything else is DOM-agnostic, so it
tree-shakes away cleanly on Workers, Edge, and other non-DOM runtimes
(spec §1.2).

## Install

```sh
npm install @kindly-note/browser @kindly-note/core
```

`@kindly-note/auto-detect` is a peer-optional dependency. Install it only
if you want the [auto-detect path](#auto-detect-path).

## Usage

All three entry points take a `Highlighter` you've already constructed
(typically via `createHighlighter` from `@kindly-note/core` or
`@kindly-note/common`).

### Single element

```ts
import { highlightElement } from '@kindly-note/browser';

highlightElement(document.querySelector('pre code')!, hl);
```

### All blocks under a root

```ts
import { highlightAll } from '@kindly-note/browser';

highlightAll(hl, { selector: 'pre code' });
```

`selector` defaults to `hl.options.cssSelector` (which itself defaults to
`'pre code'`). Pass `root` to scope the query to a Shadow DOM, a
content island, or a `DocumentFragment`.

### Auto-watch with MutationObserver

```ts
import { attachToDOM } from '@kindly-note/browser';

const handle = attachToDOM(hl);
// later, e.g. on SPA route unmount:
handle.dispose();
```

`attachToDOM` does an initial scan, then installs a `MutationObserver`
so dynamically added matching nodes are highlighted as they appear.
Pass `observeMutations: false` for a one-shot scan equivalent to
`highlightAll`.

## Class-name parsing

`languageFromClass(el)` reads the language token from the element's
`class` attribute. Three prefixes are recognised, in priority order:

1. `kn-language-foo` — kindly-note's bracketed convention.
2. `language-foo` — the long-form convention used by highlight.js,
   markdown-it, Prism, and most Markdown renderers.
3. `lang-foo` — the short-form alias.

The first hit wins; the captured token is returned as written
(case is preserved). A malformed class like `language-` does not match.

We do **not** walk the parent's `classList`. Place the language class on
the element your selector matches, or pass `language` explicitly via
`HighlightElementOptions`.

## Auto-detect path

When the language can't be resolved from class or options, you can opt
into auto-detect by passing an `AutoDetector` instance from
`@kindly-note/auto-detect`:

```ts
import { highlightElement } from '@kindly-note/browser';
import { createAutoDetector } from '@kindly-note/auto-detect';

const autoDetector = createAutoDetector(hl);

highlightElement(el, hl, { autoDetect: true, autoDetector });
```

The same `autoDetect` / `autoDetector` options are forwarded by
`highlightAll` and `attachToDOM` to every per-element call. When the
detector finds a runner-up, it is exposed on `(el as any).secondBest`
(matching the upstream do-not-break shape).

## Idempotence

`highlightElement` checks `el.dataset.highlighted` and skips work when
the marker is already set. Calling `highlightElement` twice on the same
element is safe and cheap — useful when a render cycle, a mutation
observer, and an explicit call all race for the same `<pre><code>`.

The marker value is exported as `KINDLY_NOTE_HIGHLIGHT_MARKER`
(`'kindly-note'`). It deliberately differs from upstream's `'yes'` so a
page mid-migration can tell which engine wrote the markup.

To force a re-highlight after a `textContent` change:

```ts
delete (el as HTMLElement).dataset.highlighted;
highlightElement(el, hl);
```

## API

| Export | Shape |
| --- | --- |
| `highlightElement` | `(el: Element, hl: Highlighter, options?: HighlightElementOptions) => void` |
| `highlightAll` | `(hl: Highlighter, options?: HighlightAllOptions) => void` |
| `attachToDOM` | `(hl: Highlighter, options?: AttachToDOMOptions) => AttachedHandle` |
| `languageFromClass` | `(el: Element) => string \| undefined` |
| `KINDLY_NOTE_HIGHLIGHT_MARKER` | `'kindly-note'` (the `dataset.highlighted` value) |

Type exports: `HighlightElementOptions`, `HighlightAllOptions`,
`AttachToDOMOptions`, `AttachedHandle`, `AutoDetectorLike`,
`ElementHighlightInfo`.

## Status

v0. Implements the spec §7.1 DOM API migration (the modern equivalents of
upstream's `hljs.highlightAll()`, `hljs.highlightElement(el)`, and the
`pre code` auto-init dance). Public surface is locked per spec §1.2.

## License

BSD-3-Clause.

---

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
