# @kindly-note/loader-dynamic-import

## 0.1.1

### Patch Changes

- Updated dependencies [2d654b6]
  - @kindly-note/core@0.2.0

## 0.1.0

### Minor Changes

- c866f88: Initial release of `@kindly-note/loader-dynamic-import` — the dynamic-`import()`-based language loader (spec §4.2.2). Resolves a language identifier (short name like `'rust'`, or a full package path like `'@kindly-note/lang-rust'`) and uses native dynamic `import()` to pull the `LanguageDefinition`. Works on Node, modern browsers, Deno, and Bun.

  The loader exposes two override knobs: `importer` (substitute the import call — used by tests and custom registries) and `resolveSpecifier` (transform the identifier before importing). Errors from the underlying import or shape-check are wrapped in `LanguageLoadError` (from `@kindly-note/core/errors`), preserving the original `cause`.

  The shared `LanguageLoader` interface is imported from `@kindly-note/core` so both v0 loaders implement the same nominal type.

### Patch Changes

- Updated dependencies [a864e29]
- Updated dependencies [167dfc9]
- Updated dependencies [c866f88]
- Updated dependencies [167dfc9]
  - @kindly-note/core@0.1.0
