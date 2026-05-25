# @kindly-note/loader-fetch

## 0.1.1

### Patch Changes

- Updated dependencies [2d654b6]
  - @kindly-note/core@0.2.0

## 0.1.0

### Minor Changes

- c866f88: Initial release of `@kindly-note/loader-fetch` — the Workers/Edge-friendly dynamic language loader (spec §4.2.3). Fetches a serialized JSON `LanguageDefinition` from a configurable URL prefix, deserializes RegExp-shaped slots into `RegExp` instances, and returns a deep-frozen `LanguageDefinition` ready to register with `createHighlighter()`. Optional `Map`-based cache short-circuits repeat loads. Uses only `globalThis.fetch`; zero Node built-ins.

  `@kindly-note/core` gains a new public surface to support the loader contract:

  - `LanguageLoader` interface (spec §4.2.1) — shared by both v0 loader packages.
  - `SerializedLanguageDefinition` / `SerializedMode` / `SerializedRegExp` types (spec §4.2.3) — the JSON wire format.
  - `deserializeLanguage()` — reconstructs a `LanguageDefinition` from its serialized form, throwing `LanguageLoadError` on shape failure.
  - `LanguageLoadError` — typed error class for loader failures, preserving the original `cause`.

### Patch Changes

- Updated dependencies [a864e29]
- Updated dependencies [167dfc9]
- Updated dependencies [c866f88]
- Updated dependencies [167dfc9]
  - @kindly-note/core@0.1.0
