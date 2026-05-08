// @kindly-note/loader-dynamic-import — `import()`-based language loader.
//
// spec §1.2 row `@kindly-note/loader-dynamic-import`:
//   - Public exports: `createDynamicImportLoader`.
//   - Depends on: `@kindly-note/core`.
//   - Runtimes: Node, modern browsers, Deno, Bun (anywhere native dynamic
//     `import()` works).
// spec §4.2.2 — the canonical loader contract for runtimes that DO support
// dynamic import. The Workers/Edge story (no runtime import()) is the
// `@kindly-note/loader-fetch` package's responsibility.
//
// Dispatch §C contract (cohort 5c, kindly-note modernize track):
//
//   export interface DynamicImportLoaderOptions {
//     readonly importer?: (specifier: string) => Promise<unknown>;
//   }
//   export function createDynamicImportLoader(opts?: DynamicImportLoaderOptions): LanguageLoader;
//
// The dispatch contract diverges slightly from spec §4.2.2's example
// (`resolveSpecifier` callback) — the cohort-5c brief asks for an `importer`
// override instead. The two are equivalent: both let tests substitute the
// import without breaking the `LanguageLoader` interface. We expose both
// surfaces (`importer` is the dispatch-level testing knob; `resolveSpecifier`
// is the spec-level identifier-shaping knob) so tests, applications, and
// custom registries each have a clean entry point.

import { deepFreezeLanguage } from '@kindly-note/core';
import type { LanguageDefinition, LanguageLoader } from '@kindly-note/core';
import { LanguageLoadError } from '@kindly-note/core/errors';

/**
 * Configuration for `createDynamicImportLoader`. spec §4.2.2 + dispatch §C.
 */
export interface DynamicImportLoaderOptions {
  /**
   * Function used to import a resolved specifier. Default: `(s) => import(s)`.
   *
   * Tests stub this to return a synthetic module without actually executing a
   * module-resolution pass against the file system. Real callers leave it
   * unset.
   */
  readonly importer?: (specifier: string) => Promise<unknown>;

  /**
   * Override the package-name resolution. Default behavior:
   *   - If the identifier already starts with `@kindly-note/lang-` or contains
   *     a `/` (looks like a package path), use it verbatim.
   *   - Otherwise, prefix with `@kindly-note/lang-` (so `'rust'` becomes
   *     `'@kindly-note/lang-rust'`). spec §4.2.2 default behaviour.
   *
   * Custom registries can supply a function that maps identifiers to URLs or
   * to package names in their own namespace.
   */
  readonly resolveSpecifier?: (identifier: string) => string;
}

/**
 * Default specifier resolver. Mirrors spec §4.2.2's prose: an unprefixed name
 * `'rust'` resolves to `'@kindly-note/lang-rust'`, while a fully-qualified
 * name passes through unchanged.
 */
function defaultResolveSpecifier(identifier: string): string {
  if (identifier.startsWith('@')) return identifier;
  if (identifier.includes('/')) return identifier;
  return `@kindly-note/lang-${identifier}`;
}

/**
 * Default importer. Wraps native dynamic `import()`. Note: rolldown / Vitest
 * see this as a true runtime import (no bundling at build time), which is
 * what we want — the loader resolves languages on demand.
 */
function defaultImporter(specifier: string): Promise<unknown> {
  return import(specifier);
}

/**
 * Coerce an imported module to a `LanguageDefinition`. Language packages ship
 * the definition as the default export (spec §1.2 across every `lang-*` row);
 * we accept either `mod.default` (ESM) or — as a defensive fallback — a
 * naked `LanguageDefinition` if a custom importer returns one directly.
 *
 * This narrows by structure rather than nominal type: an object with a
 * non-empty string `name` and an array `contains` is treated as a candidate.
 * Anything else throws a typed `LanguageLoadError`.
 */
function coerceToLanguageDefinition(specifier: string, mod: unknown): LanguageDefinition<unknown> {
  if (mod === null || typeof mod !== 'object') {
    throw new LanguageLoadError(specifier, `imported module is not an object (got ${typeof mod})`);
  }
  const obj = mod as Record<string, unknown>;
  // ESM modules expose `default`. Some test stubs return the LanguageDefinition
  // directly — accept both.
  const candidate = 'default' in obj && obj.default !== undefined ? obj.default : mod;
  if (
    candidate === null ||
    typeof candidate !== 'object' ||
    typeof (candidate as Record<string, unknown>).name !== 'string' ||
    !Array.isArray((candidate as Record<string, unknown>).contains)
  ) {
    throw new LanguageLoadError(
      specifier,
      'imported module did not expose a LanguageDefinition (expected `{ name: string, contains: Mode[] }` as default export)',
    );
  }
  return candidate as LanguageDefinition<unknown>;
}

/**
 * Create a `LanguageLoader` that resolves specifiers via dynamic `import()`.
 * spec §4.2.2.
 *
 * Initialization is synchronous (returns the loader immediately); only
 * `load()` is async. Errors from the underlying `importer` or shape-check
 * are wrapped in `LanguageLoadError`, preserving the original cause.
 *
 * The returned loader's `load()` deep-freezes its result before returning,
 * so subsequent `createHighlighter({ languages: [loaded] })` registrations
 * see a fully-immutable definition (matches the static-import path's
 * module-init freeze; spec §9.1).
 */
export function createDynamicImportLoader(opts: DynamicImportLoaderOptions = {}): LanguageLoader {
  const importer = opts.importer ?? defaultImporter;
  const resolveSpecifier = opts.resolveSpecifier ?? defaultResolveSpecifier;

  return {
    async load(specifier: string): Promise<LanguageDefinition<unknown>> {
      if (typeof specifier !== 'string' || specifier.length === 0) {
        throw new LanguageLoadError(String(specifier), 'specifier must be a non-empty string');
      }
      const resolved = resolveSpecifier(specifier);
      let mod: unknown;
      try {
        mod = await importer(resolved);
      } catch (cause) {
        throw new LanguageLoadError(
          specifier,
          `dynamic import("${resolved}") failed: ${stringifyCause(cause)}`,
          cause,
        );
      }
      const def = coerceToLanguageDefinition(specifier, mod);
      // Deep-freeze the loaded definition (idempotent — language packages
      // already freeze, but a custom importer might return a fresh object).
      // Matches spec §9.1: the registry sees only frozen values.
      return deepFreezeLanguage(def);
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
// from '@kindly-note/loader-dynamic-import'` without a separate core import.
// Per dispatch §C: "`LanguageLoader` interface is shared between the two
// packages (both export the same type or both implement a common type from
// `@kindly-note/core`)."
export type { LanguageLoader } from '@kindly-note/core';
