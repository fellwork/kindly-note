// Tests for the loader contract + serialization shape exported by
// `@kindly-note/core`. spec §4.2.1 / §4.2.3.
//
// These tests cover the deserializer in isolation. The loader implementations
// (loader-fetch, loader-dynamic-import) live in their own packages and have
// their own test files exercising the full load() → deserialize() → register
// → highlight pipeline.

import { describe, expect, it } from 'vitest';
import { LanguageLoadError } from '../src/errors.js';
import { type SerializedLanguageDefinition, deserializeLanguage } from '../src/index.js';

describe('deserializeLanguage', () => {
  const minimal: SerializedLanguageDefinition = {
    format: 'kindly-note/v0',
    definition: {
      name: 'TestLang',
      aliases: ['test', 'tst'],
      contains: [
        {
          scope: 'comment',
          // RegExp-shaped slot — must be reconstructed.
          begin: { __type: 'regexp', source: '//', flags: '' },
          end: { __type: 'regexp', source: '$', flags: 'm' },
        },
      ],
      illegal: { __type: 'regexp', source: '\\?', flags: '' },
    },
  };

  it('rebuilds a LanguageDefinition with name and contains', () => {
    const def = deserializeLanguage(minimal);
    expect(def.name).toBe('TestLang');
    expect(def.aliases).toEqual(['test', 'tst']);
    expect(def.contains).toHaveLength(1);
  });

  it('rebuilds RegExp-shaped slots into RegExp instances', () => {
    const def = deserializeLanguage(minimal);
    const mode = def.contains[0];
    expect(mode).toBeDefined();
    if (mode === undefined) return;
    expect(mode.begin).toBeInstanceOf(RegExp);
    // RegExp.source escapes "/" so the assertion uses the escaped form.
    expect((mode.begin as RegExp).source).toBe('\\/\\/');
    expect(mode.end).toBeInstanceOf(RegExp);
    expect((mode.end as RegExp).source).toBe('$');
    expect((mode.end as RegExp).flags).toBe('m');
    expect(def.illegal).toBeInstanceOf(RegExp);
  });

  it('passes through string regex values unchanged', () => {
    const def = deserializeLanguage({
      format: 'kindly-note/v0',
      definition: {
        name: 'StrRegex',
        contains: [{ scope: 's', begin: '\\bhello\\b' }],
      },
    });
    const mode = def.contains[0];
    expect(mode).toBeDefined();
    if (mode === undefined) return;
    expect(typeof mode.begin).toBe('string');
    expect(mode.begin).toBe('\\bhello\\b');
  });

  it('reconstructs nested contains and self markers', () => {
    const def = deserializeLanguage({
      format: 'kindly-note/v0',
      definition: {
        name: 'Nested',
        contains: [
          {
            scope: 'outer',
            begin: { __type: 'regexp', source: '\\(' },
            end: { __type: 'regexp', source: '\\)' },
            contains: ['self', { scope: 'inner', begin: 'x' }],
          },
        ],
      },
    });
    const outer = def.contains[0];
    expect(outer).toBeDefined();
    if (outer === undefined) return;
    expect(outer.contains).toBeDefined();
    expect(outer.contains).toHaveLength(2);
    expect(outer.contains?.[0]).toBe('self');
  });

  it('reconstructs $pattern inside object-shape keywords', () => {
    const def = deserializeLanguage({
      format: 'kindly-note/v0',
      definition: {
        name: 'KW',
        contains: [],
        keywords: {
          keyword: ['if', 'else'],
          $pattern: { __type: 'regexp', source: '[A-Za-z]+' },
        },
      },
    });
    expect(def.keywords).toBeDefined();
    expect(typeof def.keywords).toBe('object');
    const kw = def.keywords as Record<string, unknown>;
    expect(kw.$pattern).toBeInstanceOf(RegExp);
  });

  it('throws LanguageLoadError when format is unrecognized', () => {
    expect(() =>
      deserializeLanguage({ format: 'kindly-note/v999', definition: { name: 'X', contains: [] } }),
    ).toThrow(LanguageLoadError);
  });

  it('throws LanguageLoadError when definition is missing', () => {
    expect(() => deserializeLanguage({ format: 'kindly-note/v0' })).toThrow(LanguageLoadError);
  });

  it('throws LanguageLoadError when name is missing', () => {
    expect(() =>
      deserializeLanguage({ format: 'kindly-note/v0', definition: { contains: [] } }),
    ).toThrow(LanguageLoadError);
  });

  it('throws LanguageLoadError on shape-invalid regex object', () => {
    expect(() =>
      deserializeLanguage({
        format: 'kindly-note/v0',
        definition: {
          name: 'Bad',
          contains: [{ scope: 'x', begin: { __type: 'NOT_REGEXP' } }],
        },
      }),
    ).toThrow(LanguageLoadError);
  });

  it('throws LanguageLoadError when payload is not an object', () => {
    expect(() => deserializeLanguage('not an object')).toThrow(LanguageLoadError);
    expect(() => deserializeLanguage(null)).toThrow(LanguageLoadError);
    expect(() => deserializeLanguage(42)).toThrow(LanguageLoadError);
  });
});
