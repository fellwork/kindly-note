// @kindly-note/loader-fetch — fetch-based language loader for Workers / Edge / browsers.
//
// spec §1.2 row `@kindly-note/loader-fetch`:
//   - Public exports: `createFetchLoader`.
//   - Depends on: `@kindly-note/core`.
//   - Runtimes: Workers, browsers, Deno/Bun (anywhere `globalThis.fetch`
//     exists). Notably WITHOUT a runtime dynamic-`import()` requirement —
//     this is the Workers/Edge story.
// spec §4.2.3 — the canonical loader for environments where the bundler
// must resolve all `import()` specifiers at build time. Fetches a
// pre-serialized JSON `LanguageDefinition` from a URL prefix and
// reconstructs it via `deserializeLanguage` (in `@kindly-note/core`).
//
// Dispatch §C contract (cohort 5c, kindly-note modernize track):
//
//   export interface FetchLoaderOptions {
//     readonly baseUrl: string;
//     readonly fetcher?: typeof fetch;
//     readonly cache?: Map<string, LanguageDefinition<unknown>>;
//   }
//   export function createFetchLoader(opts: FetchLoaderOptions): LanguageLoader;
//
// Serialization format (spec §4.2.3 + dispatch §C):
//
//   {
//     "format": "kindly-note/v0",
//     "definition": {
//       "name": "JSON",
//       "aliases": ["json", "jsonc", "json5"],
//       "contains": [
//         {
//           "scope": "attr",
//           "begin": { "__type": "regexp", "source": "...", "flags": "" },
//           "relevance": 1.01
//         },
//         ...
//       ],
//       "illegal": { "__type": "regexp", "source": "\\S", "flags": "" }
//     }
//   }
//
// Every `RegExp`-shaped slot is encoded as a tagged object; everything else
// is plain JSON. The deserializer (in core's `loader.ts`) walks the tree
// and rebuilds `RegExp` instances. v0 ships the loader/deserializer pair —
// a serializer tool can be added later (spec §6 build pipeline).

import { deepFreezeLanguage, deserializeLanguage } from '@kindly-note/core';
import type { LanguageDefinition, LanguageLoader } from '@kindly-note/core';
import { LanguageLoadError } from '@kindly-note/core/errors';

/**
 * Configuration for `createFetchLoader`. spec §4.2.3 + dispatch §C.
 */
export interface FetchLoaderOptions {
  /**
   * URL prefix where serialized language artifacts live. The loader fetches
   * `${baseUrl}/${specifier}.json` (a single trailing slash on baseUrl is
   * tolerated and de-duplicated).
   *
   * Example: `'https://cdn.kindly-note.dev/v0/lang'` + specifier `'rust'`
   * resolves to `'https://cdn.kindly-note.dev/v0/lang/rust.json'`.
   */
  readonly baseUrl: string;

  /**
   * Fetch implementation. Default: `globalThis.fetch`.
   *
   * Tests stub this to return a synthetic Response. Real callers leave it
   * unset on Workers / modern browsers / Node 18+ / Deno / Bun (every
   * runtime kindly-note targets exposes `globalThis.fetch`).
   *
   * The signature matches the standard `fetch` type — both for
   * compatibility with Workers' `fetch` (which accepts a `Request | string |
   * URL`) and so callers can supply a custom fetch (e.g. with retries,
   * auth, etc.).
   */
  readonly fetcher?: typeof fetch;

  /**
   * Optional cache. When provided, second + subsequent calls to `load(s)`
   * with the same specifier return the cached `LanguageDefinition` without
   * re-fetching. The cache is keyed on the raw specifier string (NOT the
   * resolved URL) — callers passing the same identifier under different
   * baseUrls should construct separate loaders.
   *
   * Default: undefined (no caching). Provide a `new Map()` to enable
   * in-memory caching.
   */
  readonly cache?: Map<string, LanguageDefinition<unknown>>;
}

/**
 * Build the URL for a given specifier under the configured baseUrl. The
 * helper trims a trailing slash from baseUrl so callers can supply either
 * `'.../lang'` or `'.../lang/'`.
 */
function buildUrl(baseUrl: string, specifier: string): string {
  const trimmed = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  // Specifiers are passed verbatim — they're identifiers (e.g. `'rust'`),
  // not URL-unsafe strings. We encode anyway for safety.
  return `${trimmed}/${encodeURIComponent(specifier)}.json`;
}

/**
 * Create a `LanguageLoader` that resolves specifiers via `fetch`. spec §4.2.3.
 *
 * Initialization is synchronous (returns the loader immediately); only
 * `load()` is async. Errors from the underlying fetch, JSON parse, or
 * deserialization are wrapped in `LanguageLoadError`, preserving the
 * original cause.
 *
 * The returned loader's `load()` deep-freezes its result before returning,
 * matching spec §9.1 — language definitions are frozen at module init for
 * static imports; the fetch loader maintains the same invariant for
 * dynamically-loaded ones.
 *
 * Caching semantics: when `opts.cache` is provided, the cache is checked
 * before fetching. On hit, the cached definition is returned without
 * touching the fetcher. On miss, the fetched-and-deserialized definition
 * is stored under the original specifier key.
 */
export function createFetchLoader(opts: FetchLoaderOptions): LanguageLoader {
  if (typeof opts.baseUrl !== 'string' || opts.baseUrl.length === 0) {
    throw new TypeError(
      'createFetchLoader: opts.baseUrl is required and must be a non-empty string',
    );
  }
  const fetcher = opts.fetcher ?? globalThis.fetch;
  if (typeof fetcher !== 'function') {
    // Defensive — runtimes that don't expose globalThis.fetch (older Node
    // without --experimental-fetch, for example) need to supply their own
    // fetcher. We surface the error eagerly at create time so misconfigured
    // deployments fail fast.
    throw new TypeError(
      'createFetchLoader: globalThis.fetch is unavailable. Pass `fetcher` explicitly.',
    );
  }
  const baseUrl = opts.baseUrl;
  const cache = opts.cache;

  return {
    async load(specifier: string): Promise<LanguageDefinition<unknown>> {
      if (typeof specifier !== 'string' || specifier.length === 0) {
        throw new LanguageLoadError(String(specifier), 'specifier must be a non-empty string');
      }
      // Cache hit short-circuit — avoids re-fetching on subsequent calls.
      if (cache !== undefined) {
        const cached = cache.get(specifier);
        if (cached !== undefined) return cached;
      }

      const url = buildUrl(baseUrl, specifier);
      let response: Response;
      try {
        response = await fetcher(url);
      } catch (cause) {
        throw new LanguageLoadError(
          specifier,
          `fetch("${url}") failed: ${stringifyCause(cause)}`,
          cause,
        );
      }
      if (!response.ok) {
        throw new LanguageLoadError(
          specifier,
          `fetch("${url}") returned non-OK status ${response.status} ${response.statusText}`,
        );
      }

      let payload: unknown;
      try {
        payload = await response.json();
      } catch (cause) {
        throw new LanguageLoadError(
          specifier,
          `failed to parse JSON from "${url}": ${stringifyCause(cause)}`,
          cause,
        );
      }

      // deserializeLanguage throws LanguageLoadError on shape failure —
      // callers see a single error type for both transport and shape errors.
      const def = deserializeLanguage(payload);
      const frozen = deepFreezeLanguage(def);

      // Populate the cache only after a successful load.
      if (cache !== undefined) {
        cache.set(specifier, frozen);
      }
      return frozen;
    },
  };
}

function stringifyCause(cause: unknown): string {
  if (cause instanceof Error) return cause.message;
  try {
    return JSON.stringify(cause);
  } catch {
    return String(cause);
  }
}

// Re-export the shared types so consumers can `import type { LanguageLoader }
// from '@kindly-note/loader-fetch'`. Per dispatch §C, both loader packages
// export the same nominal type from `@kindly-note/core`.
export type {
  LanguageLoader,
  SerializedLanguageDefinition,
  SerializedRegExp,
} from '@kindly-note/core';
