// End-to-end tests for @kindly-note/loader-dynamic-import. spec §4.2.2.
//
// Dispatch §D acceptance gates verified here:
//   2. Stub-importer end-to-end: `loader.load('@kindly-note/lang-json')`
//      returns the expected LanguageDefinition.
//   3. Real-path integration test (skipped when not feasible) — the actual
//      `import('@kindly-note/lang-json')` round-trip.
//   6. Error handling — failed import / bad shape produce LanguageLoadError.
//   7. The shared LanguageLoader type is imported from @kindly-note/core.

import { createHighlighter } from '@kindly-note/core';
import type { LanguageLoader } from '@kindly-note/core';
import { LanguageLoadError } from '@kindly-note/core/errors';
import { htmlEmitter } from '@kindly-note/emitters-html';
import jsonLanguage from '@kindly-note/lang-json';
import { describe, expect, it } from 'vitest';
import { createDynamicImportLoader } from '../src/index.js';

describe('createDynamicImportLoader — initialization', () => {
  it('returns a LanguageLoader synchronously (init is sync)', () => {
    const loader: LanguageLoader = createDynamicImportLoader();
    // The returned object exposes a single async `load` method.
    expect(typeof loader.load).toBe('function');
    // load() returns a Promise — initialization itself is synchronous.
    expect(typeof (loader as { load: () => unknown }).load).toBe('function');
  });

  it('accepts no options and works with all-default behaviour', () => {
    const loader = createDynamicImportLoader();
    expect(loader).toBeDefined();
  });
});

describe('createDynamicImportLoader — stub importer', () => {
  it('loads a LanguageDefinition via a stub importer (default-export shape)', async () => {
    const loader = createDynamicImportLoader({
      importer: async (specifier) => {
        expect(specifier).toBe('@kindly-note/lang-json');
        // ESM-shaped: { default: <LanguageDefinition> }.
        return { default: jsonLanguage };
      },
    });
    const def = await loader.load('@kindly-note/lang-json');
    expect(def.name).toBe('JSON');
    expect(def.aliases).toEqual(['json', 'jsonc', 'json5']);
    // The loader deep-freezes its result (spec §9.1).
    expect(Object.isFrozen(def)).toBe(true);
    expect(Object.isFrozen(def.contains)).toBe(true);
  });

  it('passes the loaded definition through compileLanguage cleanly (end-to-end registration)', async () => {
    const loader = createDynamicImportLoader({
      importer: async () => ({ default: jsonLanguage }),
    });
    const def = await loader.load('@kindly-note/lang-json');
    const hl = createHighlighter({
      languages: [def],
      emitter: htmlEmitter,
    });
    const result = hl.highlight('{"a":1}', { language: 'json' });
    // Successful tokenisation — value is HTML output, illegal=false.
    expect(result.illegal).toBe(false);
    expect(typeof result.value).toBe('string');
    // The emitter returns HTML; check for at least one kn-* span class.
    expect(result.value).toContain('kn-');
  });

  it('default specifier resolution prefixes "@kindly-note/lang-" for short names', async () => {
    let observedSpecifier = '';
    const loader = createDynamicImportLoader({
      importer: async (specifier) => {
        observedSpecifier = specifier;
        return { default: jsonLanguage };
      },
    });
    await loader.load('json');
    expect(observedSpecifier).toBe('@kindly-note/lang-json');
  });

  it('default specifier resolution leaves @-prefixed names verbatim', async () => {
    let observedSpecifier = '';
    const loader = createDynamicImportLoader({
      importer: async (specifier) => {
        observedSpecifier = specifier;
        return { default: jsonLanguage };
      },
    });
    await loader.load('@scope/lang-foo');
    expect(observedSpecifier).toBe('@scope/lang-foo');
  });

  it('custom resolveSpecifier overrides the default resolution', async () => {
    let observedSpecifier = '';
    const loader = createDynamicImportLoader({
      resolveSpecifier: (id) => `https://cdn.example.com/${id}.js`,
      importer: async (specifier) => {
        observedSpecifier = specifier;
        return { default: jsonLanguage };
      },
    });
    await loader.load('json');
    expect(observedSpecifier).toBe('https://cdn.example.com/json.js');
  });

  it('accepts a naked LanguageDefinition (defensive fallback path)', async () => {
    // Some custom importers return the definition directly rather than
    // wrapping it in `{ default: ... }`. The loader handles both shapes.
    const loader = createDynamicImportLoader({
      importer: async () => jsonLanguage,
    });
    const def = await loader.load('json');
    expect(def.name).toBe('JSON');
  });
});

describe('createDynamicImportLoader — error handling', () => {
  it('wraps importer rejections in LanguageLoadError', async () => {
    const loader = createDynamicImportLoader({
      importer: async () => {
        throw new Error('module not found: foo');
      },
    });
    await expect(loader.load('foo')).rejects.toBeInstanceOf(LanguageLoadError);
    await expect(loader.load('foo')).rejects.toMatchObject({
      specifier: 'foo',
      message: expect.stringContaining('module not found'),
    });
  });

  it('preserves the original cause on a wrapped LanguageLoadError', async () => {
    const original = new Error('simulated network failure');
    const loader = createDynamicImportLoader({
      importer: async () => {
        throw original;
      },
    });
    try {
      await loader.load('foo');
      expect.unreachable('load() should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(LanguageLoadError);
      expect((err as LanguageLoadError).cause).toBe(original);
    }
  });

  it('throws LanguageLoadError when the imported module has the wrong shape', async () => {
    const loader = createDynamicImportLoader({
      importer: async () => ({ default: { not: 'a-language' } }),
    });
    await expect(loader.load('bad-shape')).rejects.toBeInstanceOf(LanguageLoadError);
  });

  it('throws LanguageLoadError when the imported module is null', async () => {
    const loader = createDynamicImportLoader({
      importer: async () => null,
    });
    await expect(loader.load('null-mod')).rejects.toBeInstanceOf(LanguageLoadError);
  });

  it('throws LanguageLoadError on empty specifier', async () => {
    const loader = createDynamicImportLoader();
    await expect(loader.load('')).rejects.toBeInstanceOf(LanguageLoadError);
  });
});

describe('createDynamicImportLoader — real dynamic import (integration)', () => {
  // Real `await import('@kindly-note/lang-json')` round-trip. This works in
  // Vitest's Node environment because Bun's workspace symlinks resolve the
  // package, but the alias plugin in vitest.shared.ts redirects bare imports
  // to the package's `src/index.ts`. Both paths produce a working
  // LanguageDefinition. If a future runtime/bundler combination breaks this,
  // mark this test as `it.skip` with the test below as the stub-only fallback.
  it('resolves @kindly-note/lang-json via the default importer end-to-end', async () => {
    const loader = createDynamicImportLoader();
    const def = await loader.load('@kindly-note/lang-json');
    expect(def.name).toBe('JSON');
    expect(def.aliases).toEqual(['json', 'jsonc', 'json5']);
    // Reference equality with the static-import default export proves the
    // dynamic-import code path returned the same module.
    // (After deepFreezeLanguage, the object is the same one that was already
    // frozen at module init in lang-json's index.ts.)
    expect(def).toBe(jsonLanguage);
  });
});
