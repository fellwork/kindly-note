# @kindly-note/loader-fetch

Fetch-based language loader for kindly-note. Pulls serialized JSON `LanguageDefinition` artifacts from a URL prefix using `globalThis.fetch` — the canonical loader for Workers, Edge runtimes, and any environment where the bundler must resolve every `import()` specifier at build time.

## Install

```sh
npm install @kindly-note/loader-fetch @kindly-note/core
bun add @kindly-note/loader-fetch @kindly-note/core
pnpm add @kindly-note/loader-fetch @kindly-note/core
```

## Usage

```ts
import { createHighlighter } from '@kindly-note/core';
import { createFetchLoader } from '@kindly-note/loader-fetch';

const loader = createFetchLoader({
  baseUrl: 'https://cdn.example.com/kn-langs',
});

const rust = await loader.load('rust');
// → fetches https://cdn.example.com/kn-langs/rust.json,
//   deserializes the `kindly-note/v0` envelope, and returns a
//   deep-frozen LanguageDefinition.

const hl = createHighlighter({ languages: [rust] });
const result = hl.highlight('fn main() {}', { language: 'rust' });
```

The loader implements the `LanguageLoader` contract from `@kindly-note/core`, so it also drops directly into a highlighter that resolves languages on demand:

```ts
const hl = createHighlighter({ loader });
const result = await hl.highlightAsync('fn main() {}', { language: 'rust' });
```

## Wire format

Serialized artifacts use a versioned envelope so future shape changes don't break deployed CDN payloads:

```json
{
  "format": "kindly-note/v0",
  "definition": {
    "name": "JSON",
    "aliases": ["json", "jsonc"],
    "contains": [
      {
        "scope": "attr",
        "begin": { "__type": "regexp", "source": "\"[^\"]*\"", "flags": "" }
      }
    ],
    "illegal": { "__type": "regexp", "source": "\\S", "flags": "" }
  }
}
```

Every `RegExp` slot is encoded as `{ __type: 'regexp', source, flags }`; everything else is plain JSON. The deserializer in `@kindly-note/core` walks the tree and rebuilds `RegExp` instances. v0 ships the loader/deserializer pair — a published serializer tool can ship later under a new `format` tag without breaking deployed v0 artifacts.

See architect-spec.md §4.2.3 for the normative envelope definition.

## Options

```ts
interface FetchLoaderOptions {
  readonly baseUrl: string;
  readonly fetcher?: typeof fetch;
  readonly cache?: Map<string, LanguageDefinition<unknown>>;
}
```

- **`baseUrl`** (required) — URL prefix where serialized artifacts live. The loader fetches `${baseUrl}/${specifier}.json`. A single trailing slash is tolerated and de-duplicated.
- **`fetcher`** — `fetch` implementation override. Defaults to `globalThis.fetch`. Tests stub this to return synthetic `Response` objects; production callers can supply a custom `fetch` with retries, auth headers, or telemetry. Validated eagerly at create-time so misconfigured deployments fail fast.
- **`cache`** — optional `Map<string, LanguageDefinition>`. When provided, second + subsequent calls to `load(specifier)` return the cached definition without re-fetching. Keyed on the raw specifier (not the resolved URL); construct separate loaders per `baseUrl`. Default: undefined (no caching).

## When to use this vs `loader-dynamic-import`

kindly-note ships two loaders because the runtime targets diverge:

| | `loader-fetch` | `loader-dynamic-import` |
|---|---|---|
| Resolves via | `globalThis.fetch` + JSON | native `import(specifier)` |
| Workers / Edge | yes (canonical) | no — bundler must resolve all specifiers at build time |
| Browsers | yes | yes |
| Node / Deno / Bun | yes | yes (canonical) |
| Source needed | pre-serialized `<name>.json` on a CDN | published `@kindly-note/lang-*` package |

Use `loader-fetch` when targeting Workers/Edge or when serving language packs from a CDN. Use `loader-dynamic-import` on Node/browsers/Deno/Bun when you have direct access to the published `@kindly-note/lang-*` modules.

The default and recommended path for known-at-build-time languages is **neither** loader — static `import` + `createHighlighter({ languages: [...] })` tree-shakes perfectly across all four runtimes (architect-spec.md §4.1).

## API

### Runtime exports

- `createFetchLoader(opts: FetchLoaderOptions): LanguageLoader` — construct a `LanguageLoader` that resolves specifiers via `fetch`. Initialization is synchronous; only `load()` is async. Errors from `fetch`, JSON parsing, and deserialization are wrapped in `LanguageLoadError` with the original cause preserved. The returned definition is deep-frozen, matching the immutability invariant of statically imported languages (architect-spec.md §9.1).

### Type-only exports

- `FetchLoaderOptions` — options object accepted by `createFetchLoader`.
- `LanguageLoader` — re-exported from `@kindly-note/core`. The shared loader contract; both `loader-fetch` and `loader-dynamic-import` produce values of this type.
- `SerializedLanguageDefinition` — re-exported from `@kindly-note/core`. The `kindly-note/v0` envelope shape.
- `SerializedRegExp` — re-exported from `@kindly-note/core`. The `{ __type: 'regexp', source, flags }` tagged shape.

## Status

v0.0.1 — see [architect-spec.md §4.2.3](../../docs/plan/architect-spec.md) for the normative contract and [build-manifest-c5c.md](../../docs/plan/build-manifest-c5c.md) for the cohort 5c build record.

## License

MIT — see [LICENSE](../../LICENSE).
