// End-to-end tests for @kindly-note/loader-fetch. spec §4.2.3.
//
// Dispatch §D acceptance gates verified here:
//   4. Stub fetcher returns serialized JSON; loader deserializes correctly,
//      RegExp values reconstructed, the result is registerable into a
//      Highlighter and produces highlighted output.
//   5. Cache hit on second call — same specifier doesn't refetch.
//   6. Error handling — failed fetch / non-OK status / bad JSON shape /
//      transport rejection all produce a typed LanguageLoadError.
//   7. The shared LanguageLoader type is imported from @kindly-note/core.
//
// Test helper: a small serializer that produces the wire format from a
// Mode tree. v0 doesn't ship a published serializer (per dispatch §9: "v0
// doesn't need a serializer tool, just the loader") — but tests need one
// to drive the loader, so it's defined locally here. When the build
// pipeline grows a real serializer (spec §6 / future cohort), the test
// helper can be replaced with an import.

import type {
  LanguageDefinition,
  LanguageLoader,
  Mode,
  SerializedLanguageDefinition,
  SerializedMode,
  SerializedRegExp,
  SerializedRegexLike,
} from '@kindly-note/core';
import { createHighlighter } from '@kindly-note/core';
import { LanguageLoadError } from '@kindly-note/core/errors';
import { htmlEmitter } from '@kindly-note/emitters-html';
import { describe, expect, it } from 'vitest';
import { createFetchLoader } from '../src/index.js';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/** Encode a regex value to the wire format. */
function encodeRegex(re: RegExp | string): SerializedRegexLike {
  if (typeof re === 'string') return re;
  const out: SerializedRegExp = {
    __type: 'regexp',
    source: re.source,
    flags: re.flags,
  };
  return out;
}

function encodeRegexOrArray(
  v: RegExp | string | readonly (RegExp | string)[],
): SerializedRegexLike | readonly SerializedRegexLike[] {
  if (Array.isArray(v)) return v.map(encodeRegex);
  return encodeRegex(v as RegExp | string);
}

function encodeMode(m: Mode | 'self'): SerializedMode | 'self' {
  if (m === 'self') return 'self';
  const out: { -readonly [K in keyof SerializedMode]: SerializedMode[K] } = {};
  if (m.label !== undefined) out.label = m.label;
  if (m.scope !== undefined) out.scope = m.scope;
  if (m.className !== undefined) out.className = m.className;
  if (m.begin !== undefined) {
    out.begin = encodeRegexOrArray(m.begin as RegExp | string | readonly (RegExp | string)[]);
  }
  if (m.match !== undefined) {
    out.match = encodeRegexOrArray(m.match as RegExp | string | readonly (RegExp | string)[]);
  }
  if (m.end !== undefined) {
    out.end = encodeRegexOrArray(m.end as RegExp | string | readonly (RegExp | string)[]);
  }
  if (m.beginScope !== undefined) out.beginScope = m.beginScope;
  if (m.endScope !== undefined) out.endScope = m.endScope;
  if (m.contains !== undefined) out.contains = m.contains.map(encodeMode);
  if (m.variants !== undefined)
    out.variants = m.variants.map((v) => encodeMode(v) as SerializedMode);
  if (m.keywords !== undefined) out.keywords = m.keywords as SerializedMode['keywords'];
  if (m.beginKeywords !== undefined) out.beginKeywords = m.beginKeywords;
  if (m.lexemes !== undefined) {
    out.lexemes = encodeRegex(m.lexemes as RegExp | string);
  }
  if (m.relevance !== undefined) out.relevance = m.relevance;
  if (m.endsParent !== undefined) out.endsParent = m.endsParent;
  if (m.endsWithParent !== undefined) out.endsWithParent = m.endsWithParent;
  if (m.endSameAsBegin !== undefined) out.endSameAsBegin = m.endSameAsBegin;
  if (m.excludeBegin !== undefined) out.excludeBegin = m.excludeBegin;
  if (m.excludeEnd !== undefined) out.excludeEnd = m.excludeEnd;
  if (m.returnBegin !== undefined) out.returnBegin = m.returnBegin;
  if (m.returnEnd !== undefined) out.returnEnd = m.returnEnd;
  if (m.skip !== undefined) out.skip = m.skip;
  if (m.subLanguage !== undefined) out.subLanguage = m.subLanguage;
  if (m.illegal !== undefined) {
    out.illegal = encodeRegexOrArray(m.illegal as RegExp | string | readonly (RegExp | string)[]);
  }
  if (m.starts !== undefined) {
    out.starts = encodeMode(m.starts) as SerializedMode;
  }
  return out;
}

function serializeLanguage(def: LanguageDefinition<unknown>): SerializedLanguageDefinition {
  return {
    format: 'kindly-note/v0',
    definition: {
      name: def.name,
      ...(def.aliases !== undefined ? { aliases: def.aliases } : {}),
      ...(def.disableAutodetect !== undefined ? { disableAutodetect: def.disableAutodetect } : {}),
      ...(def.supersetOf !== undefined ? { supersetOf: def.supersetOf } : {}),
      ...(def.caseInsensitive !== undefined ? { caseInsensitive: def.caseInsensitive } : {}),
      ...(def.keywords !== undefined
        ? { keywords: def.keywords as SerializedLanguageDefinition['definition']['keywords'] }
        : {}),
      contains: def.contains.map((m) => encodeMode(m) as SerializedMode),
      ...(def.illegal !== undefined
        ? {
            illegal: encodeRegexOrArray(
              def.illegal as RegExp | string | readonly (RegExp | string)[],
            ),
          }
        : {}),
      ...(def.classNameAliases !== undefined ? { classNameAliases: def.classNameAliases } : {}),
    },
  };
}

/** Synthesize a `Response`-like object that exposes the methods loader-fetch needs. */
function makeJsonResponse(payload: unknown): Response {
  // We use the Web Fetch Response if available — Node 18+/Workers/Deno/Bun
  // provide it. The test runs in Vitest's Node env, where Response exists.
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function makeErrorResponse(status: number, statusText: string): Response {
  return new Response('', { status, statusText });
}

/** A tiny deterministic LanguageDefinition used for round-trip tests. */
const tinyLanguage: LanguageDefinition<unknown> = Object.freeze({
  name: 'Tiny',
  aliases: Object.freeze(['tn']),
  contains: Object.freeze([
    Object.freeze({
      scope: 'comment',
      begin: /\/\//,
      end: /$/,
    }),
    Object.freeze({
      scope: 'literal',
      beginKeywords: 'true false null',
    }),
  ]),
  illegal: '\\?',
}) as LanguageDefinition<unknown>;

const tinyPayload: SerializedLanguageDefinition = serializeLanguage(tinyLanguage);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('createFetchLoader — initialization', () => {
  it('returns a LanguageLoader synchronously', () => {
    const loader: LanguageLoader = createFetchLoader({
      baseUrl: 'https://cdn.example.com/lang',
      fetcher: async () => makeJsonResponse(tinyPayload),
    });
    expect(typeof loader.load).toBe('function');
  });

  it('throws TypeError if baseUrl is missing', () => {
    expect(() =>
      createFetchLoader({
        baseUrl: '',
        fetcher: async () => makeJsonResponse(tinyPayload),
      } as Parameters<typeof createFetchLoader>[0]),
    ).toThrow(TypeError);
  });

  it('throws TypeError if no fetcher AND no globalThis.fetch (defensive)', () => {
    const originalFetch = globalThis.fetch;
    try {
      // @ts-expect-error -- intentionally clobbering for this defensive case
      globalThis.fetch = undefined;
      expect(() => createFetchLoader({ baseUrl: 'https://example.com/lang' })).toThrow(TypeError);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe('createFetchLoader — happy path', () => {
  it('fetches JSON and returns a deep-frozen LanguageDefinition', async () => {
    let observedUrl = '';
    const loader = createFetchLoader({
      baseUrl: 'https://cdn.example.com/lang',
      fetcher: async (input) => {
        observedUrl = String(input);
        return makeJsonResponse(tinyPayload);
      },
    });
    const def = await loader.load('tiny');
    expect(observedUrl).toBe('https://cdn.example.com/lang/tiny.json');
    expect(def.name).toBe('Tiny');
    expect(def.aliases).toEqual(['tn']);
    expect(Object.isFrozen(def)).toBe(true);
  });

  it('reconstructs RegExp values from the wire format', async () => {
    const loader = createFetchLoader({
      baseUrl: 'https://cdn.example.com/lang',
      fetcher: async () => makeJsonResponse(tinyPayload),
    });
    const def = await loader.load('tiny');
    const comment = def.contains[0];
    expect(comment).toBeDefined();
    if (comment === undefined) return;
    expect(comment.begin).toBeInstanceOf(RegExp);
    expect(comment.end).toBeInstanceOf(RegExp);
    // illegal was encoded as a string (not a RegExp) in tinyLanguage.
    expect(typeof def.illegal).toBe('string');
  });

  it('tolerates a trailing slash on baseUrl', async () => {
    let observedUrl = '';
    const loader = createFetchLoader({
      baseUrl: 'https://cdn.example.com/lang/',
      fetcher: async (input) => {
        observedUrl = String(input);
        return makeJsonResponse(tinyPayload);
      },
    });
    await loader.load('tiny');
    expect(observedUrl).toBe('https://cdn.example.com/lang/tiny.json');
  });

  it('the loaded LanguageDefinition can drive a Highlighter end-to-end', async () => {
    // Build a serialized JSON-language equivalent inline so we don't depend
    // on lang-json's transitive dependencies in this package's tests.
    const jsonLikePayload: SerializedLanguageDefinition = {
      format: 'kindly-note/v0',
      definition: {
        name: 'JSONLite',
        aliases: ['jsonlite'],
        contains: [
          {
            scope: 'punctuation',
            match: { __type: 'regexp', source: '[{}\\[\\],:]' },
            relevance: 0,
          },
          {
            scope: 'literal',
            beginKeywords: 'true false null',
          },
          {
            scope: 'string',
            begin: { __type: 'regexp', source: '"' },
            end: { __type: 'regexp', source: '"' },
          },
        ],
        keywords: { literal: ['true', 'false', 'null'] },
      },
    };
    const loader = createFetchLoader({
      baseUrl: 'https://cdn.example.com/lang',
      fetcher: async () => makeJsonResponse(jsonLikePayload),
    });
    const def = await loader.load('jsonlite');
    const hl = createHighlighter({
      languages: [def],
      emitter: htmlEmitter,
    });
    const result = hl.highlight('{"a":true}', { language: 'jsonlite' });
    expect(result.illegal).toBe(false);
    expect(typeof result.value).toBe('string');
    expect(result.value).toContain('kn-');
  });
});

describe('createFetchLoader — caching', () => {
  it('returns the cached definition on second call without re-fetching', async () => {
    let fetchCount = 0;
    const cache = new Map<string, LanguageDefinition<unknown>>();
    const loader = createFetchLoader({
      baseUrl: 'https://cdn.example.com/lang',
      cache,
      fetcher: async () => {
        fetchCount += 1;
        return makeJsonResponse(tinyPayload);
      },
    });
    const first = await loader.load('tiny');
    const second = await loader.load('tiny');
    expect(fetchCount).toBe(1);
    // Same object reference — the cache returned exactly what it stored.
    expect(second).toBe(first);
  });

  it('does not cache when no cache is provided', async () => {
    let fetchCount = 0;
    const loader = createFetchLoader({
      baseUrl: 'https://cdn.example.com/lang',
      fetcher: async () => {
        fetchCount += 1;
        return makeJsonResponse(tinyPayload);
      },
    });
    await loader.load('tiny');
    await loader.load('tiny');
    expect(fetchCount).toBe(2);
  });

  it('cache misses on different specifiers and stores each separately', async () => {
    const cache = new Map<string, LanguageDefinition<unknown>>();
    const loader = createFetchLoader({
      baseUrl: 'https://cdn.example.com/lang',
      cache,
      fetcher: async (input) => {
        // Always return tinyPayload but with a different name reflecting
        // the URL — so we can verify each entry is the right one.
        const url = String(input);
        const slug = url.split('/').pop()?.replace('.json', '') ?? 'unknown';
        return makeJsonResponse({
          ...tinyPayload,
          definition: { ...tinyPayload.definition, name: slug },
        });
      },
    });
    const a = await loader.load('alpha');
    const b = await loader.load('beta');
    expect(a.name).toBe('alpha');
    expect(b.name).toBe('beta');
    expect(cache.size).toBe(2);
  });
});

describe('createFetchLoader — error handling', () => {
  it('wraps fetcher rejections in LanguageLoadError', async () => {
    const loader = createFetchLoader({
      baseUrl: 'https://cdn.example.com/lang',
      fetcher: async () => {
        throw new Error('network down');
      },
    });
    await expect(loader.load('tiny')).rejects.toBeInstanceOf(LanguageLoadError);
    await expect(loader.load('tiny')).rejects.toMatchObject({
      specifier: 'tiny',
      message: expect.stringContaining('network down'),
    });
  });

  it('preserves the original cause on a wrapped LanguageLoadError', async () => {
    const original = new Error('TLS handshake failed');
    const loader = createFetchLoader({
      baseUrl: 'https://cdn.example.com/lang',
      fetcher: async () => {
        throw original;
      },
    });
    try {
      await loader.load('tiny');
      expect.unreachable('load() should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(LanguageLoadError);
      expect((err as LanguageLoadError).cause).toBe(original);
    }
  });

  it('throws LanguageLoadError on non-OK HTTP status', async () => {
    const loader = createFetchLoader({
      baseUrl: 'https://cdn.example.com/lang',
      fetcher: async () => makeErrorResponse(404, 'Not Found'),
    });
    await expect(loader.load('missing')).rejects.toBeInstanceOf(LanguageLoadError);
    await expect(loader.load('missing')).rejects.toMatchObject({
      specifier: 'missing',
      message: expect.stringContaining('404'),
    });
  });

  it('throws LanguageLoadError when the response body is not valid JSON', async () => {
    const loader = createFetchLoader({
      baseUrl: 'https://cdn.example.com/lang',
      fetcher: async () =>
        new Response('not json', {
          status: 200,
          headers: { 'content-type': 'text/plain' },
        }),
    });
    await expect(loader.load('tiny')).rejects.toBeInstanceOf(LanguageLoadError);
  });

  it('throws LanguageLoadError when the JSON has the wrong shape', async () => {
    const loader = createFetchLoader({
      baseUrl: 'https://cdn.example.com/lang',
      fetcher: async () =>
        makeJsonResponse({
          format: 'kindly-note/v999',
          definition: { name: 'X', contains: [] },
        }),
    });
    await expect(loader.load('tiny')).rejects.toBeInstanceOf(LanguageLoadError);
  });

  it('throws LanguageLoadError on empty specifier', async () => {
    const loader = createFetchLoader({
      baseUrl: 'https://cdn.example.com/lang',
      fetcher: async () => makeJsonResponse(tinyPayload),
    });
    await expect(loader.load('')).rejects.toBeInstanceOf(LanguageLoadError);
  });

  it('does not populate the cache on a failed fetch', async () => {
    const cache = new Map<string, LanguageDefinition<unknown>>();
    const loader = createFetchLoader({
      baseUrl: 'https://cdn.example.com/lang',
      cache,
      fetcher: async () => makeErrorResponse(500, 'Internal Server Error'),
    });
    await expect(loader.load('flaky')).rejects.toBeInstanceOf(LanguageLoadError);
    expect(cache.size).toBe(0);
  });
});
