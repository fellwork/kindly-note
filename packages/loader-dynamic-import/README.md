# @kindly-note/loader-dynamic-import

Dynamic-`import()`-based language loader for Node, modern browsers, Deno, and Bun.

## Install

```sh
bun add @kindly-note/loader-dynamic-import
# or: npm install @kindly-note/loader-dynamic-import
```

`@kindly-note/core` is a peer-style dependency declared automatically; install whichever language packages you intend to load (e.g. `@kindly-note/lang-rust`).

## Usage

```ts
import { createDynamicImportLoader } from '@kindly-note/loader-dynamic-import';
import { createHighlighter } from '@kindly-note/core';

const loader = createDynamicImportLoader();

// Short names are prefixed with `@kindly-note/lang-`:
const lang = await loader.load('rust'); // resolves to @kindly-note/lang-rust

const hl = createHighlighter({ languages: [lang] });
hl.highlight(code, { language: 'rust' });
```

`createDynamicImportLoader()` returns synchronously; only `loader.load(...)` is async. Loaded definitions are deep-frozen before being handed back, so the registry sees only immutable values (matches the static-import path's module-init freeze; spec §9.1).

## Specifier resolution

By default the loader applies these rules to whatever string you pass to `load(...)`:

| Input shape                   | Example              | Resolved specifier passed to `import()` |
| ----------------------------- | -------------------- | --------------------------------------- |
| Short name                    | `'rust'`             | `'@kindly-note/lang-rust'`              |
| Already `@`-scoped            | `'@my-org/lang-foo'` | `'@my-org/lang-foo'` (passed through)   |
| Contains `/` (path-shaped)    | `'./local/lang.js'`  | `'./local/lang.js'` (passed through)    |

This is a strict superset of the spec §4.2.2 example: the unprefixed-name case is preserved, and full package paths or relative specifiers travel through untouched.

## Options

```ts
export interface DynamicImportLoaderOptions {
  /** Replaces the underlying `import(...)` call. Default: `(s) => import(s)`. */
  readonly importer?: (specifier: string) => Promise<unknown>;

  /** Transforms the identifier before it reaches `importer`. Default: the table above. */
  readonly resolveSpecifier?: (identifier: string) => string;
}
```

- `importer` — the testing-level knob. Substitute a stub to return a synthetic module without touching the file system or the network.
- `resolveSpecifier` — the identifier-shaping knob. Map short names into your own registry (URLs, private package names, etc.) without rewriting the import call.

The two compose without conflict: `resolveSpecifier` runs first, then its output is passed to `importer`.

```ts
const loader = createDynamicImportLoader({
  resolveSpecifier: (id) => `https://cdn.example.com/lang/${id}.js`,
});
```

Failures from either hook (rejected promise, wrong-shape module, null return) are wrapped in a `LanguageLoadError` (from `@kindly-note/core/errors`) with the original cause preserved.

## When to use this vs loader-fetch

Use this package on any runtime where native dynamic `import()` of arbitrary specifiers works at runtime: Node, modern browsers (with bundler support), Deno, Bun.

Use [`@kindly-note/loader-fetch`](../loader-fetch) on Workers and Edge runtimes, where the bundler must resolve every `import()` specifier at build time. `loader-fetch` pulls a pre-serialized JSON `LanguageDefinition` over `globalThis.fetch` instead.

Both loaders implement the same `LanguageLoader` interface from `@kindly-note/core`, so application code can be written against the interface and swap loaders by environment without changing the call site.

## API

### `createDynamicImportLoader(opts?: DynamicImportLoaderOptions): LanguageLoader`

Construct a loader. Synchronous; returns immediately.

### `LanguageLoader` (re-exported from `@kindly-note/core`)

```ts
interface LanguageLoader {
  load(identifier: string): Promise<LanguageDefinition<unknown>>;
  list?(): readonly string[];
}
```

The typed extension surface (`TExtensible`) is erased at the loader boundary because the loader cannot know the language's identity at compile time. If you need the typed `extensible` (e.g. to extend a dynamically-loaded `lang-javascript`), static-import the language package instead — that path preserves the full type.

### `LanguageLoadError` (re-exported from `@kindly-note/core/errors`)

Thrown for any transport or shape failure. Carries `specifier` and the original `cause`.

## Status

v0. Public API is stable for the v0 surface. See spec §4.2.2 and the cohort-5c build manifest (`docs/plan/build-manifest-c5c.md`) for the full contract and acceptance gates.

## License

BSD-3-Clause.

<!--
Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
-->
