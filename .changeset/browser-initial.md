---
'@kindly-note/browser': minor
---

Add `@kindly-note/browser`: DOM bindings for kindly-note.

Three exports complete the v0 surface for browser-side usage:

- `highlightElement(el, hl, options?)` — highlight a single DOM element.
  Reads `el.textContent`, writes the highlighted markup back via the DOM's
  markup setter, sets `el.dataset.highlighted = 'kindly-note'` (the
  idempotence marker), and attaches typed `el.result` (and optional
  `el.secondBest`) per Scout §11. spec §7.1.5.
- `highlightAll(hl, options?)` — batch scan: query every element matching
  `options.selector` (default `hl.options.cssSelector`, default
  `'pre code'`) under `options.root` (default `document`) and highlight
  each. Forwards per-element options through to `highlightElement`.
  spec §7.1.1.
- `attachToDOM(hl, options?)` — initial scan PLUS optional
  `MutationObserver` so future matching nodes are highlighted as they
  appear. Returns `{ dispose() }` to stop observing on SPA route teardown.
  spec §1.2 row.

Plugin protocol integration (spec §2):
- `beforeElement` and `afterElement` plugin phases fire from each
  `highlightElement` call, around the engine's `highlight()` call (which
  itself runs `transformCode` / `transformResult`).
- The legacy adapter's `before:/after:highlightElement` hooks therefore
  flow through unchanged when consumers pass `adaptLegacyPlugin(...)` to
  `createHighlighter`.

Class-name parsing (`languageFromClass`, also exported):
- Accepts `kn-language-foo`, `language-foo`, `lang-foo` in that priority
  order. Hyphenated language names (`objective-c`) preserved.

Auto-detect path (peer-optional):
- `@kindly-note/auto-detect` is declared as a peer-optional dependency
  (via `peerDependenciesMeta`). The browser package never imports it
  directly. Callers pass an `autoDetector` handle in via options when
  `autoDetect: true` is set; the package uses its structural shape only.

Tree-shaking:
- Package is `sideEffects: false`. Workers/Edge bundlers drop the entire
  package when no consumer imports any of the three exports.

Idempotence:
- A second `highlightElement` call on the same element is a no-op (the
  marker check short-circuits before any work). To re-highlight, the
  caller must clear `dataset.highlighted` first. spec §F.

happy-dom test environment:
- This is the first kindly-note package whose Vitest configuration
  overrides the shared default `'node'` to `'happy-dom'` — the package's
  whole point is the DOM surface. No production code path depends on
  happy-dom; consumers see only `lib.dom`-typed surfaces.
